const { createHash, timingSafeEqual } = require('node:crypto');
const { parseAI, normalizeAI } = require('../assets/data.js');

const ORIGINS = new Set(['https://torcida-orcin.vercel.app', 'https://torcida-proxy.vercel.app']);
for (const host of [process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL]) if(host) ORIGINS.add('https://'+host);
const CAPS = { identify: 1400, selector: 800, pairing: 500, recipes: 1400, quiz: 1000, ash: 800, occasion: 1000, alternatives: 1400 };
const memory = new Map();
function limit(name, fallback, max) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
function fail(status, code, message, retry) { return Object.assign(new Error(message), { status, code, retry }); }
function validAccess(value) {
  const expected = process.env.TORCIDA_ACCESS_CODE;
  if (!expected) return true;
  if (typeof value !== 'string' || value.length > 512) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(CAPS, body.operation)) throw fail(400, 'INVALID_REQUEST', 'Choose a supported Torcida feature.');
  if (Buffer.byteLength(JSON.stringify(body)) > 3500000) throw fail(413, 'IMAGE_TOO_LARGE', 'This photo is too large. Choose a smaller photo or search by name.');
  if (!Array.isArray(body.messages) || body.messages.length !== 1 || body.messages[0]?.role !== 'user') throw fail(400, 'INVALID_REQUEST', 'Send one request at a time.');
  if (body.system !== undefined && (typeof body.system !== 'string' || body.system.length > 3000)) throw fail(400, 'INVALID_REQUEST', 'The request instructions are too long.');
  let inputBytes = Buffer.byteLength(body.system || ''), images = 0, hasText = false;
  const content = body.messages[0].content;
  function text(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 20000) throw fail(400, 'INVALID_REQUEST', 'Enter a shorter cigar name or request.');
    inputBytes += Buffer.byteLength(value); hasText = true;
    return { type: 'text', text: value };
  }
  let clean;
  if (typeof content === 'string') clean = [text(content)];
  else if (Array.isArray(content) && content.length <= 3) clean = content.map(block => {
    if (block?.type === 'text') return text(block.text);
    const source = block?.source;
    if (block?.type !== 'image' || !['identify', 'ash'].includes(body.operation) || ++images > 1 || source?.type !== 'base64' || !['image/jpeg','image/png','image/webp','image/gif'].includes(source.media_type) || typeof source.data !== 'string' || source.data.length > 3000000 || !source.data.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(source.data)) throw fail(400, 'INVALID_IMAGE', 'Use a supported, smaller photo or search by name.');
    // Conservative reservation for one image, not a provider billing estimate.
    inputBytes += 8192;
    return { type: 'image', source: { type: 'base64', media_type: source.media_type, data: source.data } };
  });
  else throw fail(400, 'INVALID_REQUEST', 'The request format is invalid.');
  if (!hasText || inputBytes > 50000) throw fail(400, 'INVALID_REQUEST', 'The request is too long. Please shorten it.');
  if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1)) throw fail(400, 'INVALID_REQUEST', 'The response limit is invalid.');
  const maxTokens = Math.min(body.max_tokens || CAPS[body.operation], CAPS[body.operation]);
  return { operation: body.operation, reserved: inputBytes + maxTokens + 1024, payload: { model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5', max_tokens: maxTokens, system: body.system || 'Return only valid compact JSON. Do not include markdown.', messages: [{ role: 'user', content: clean }] } };
}

// All counters are checked and reserved together. No refund on errors: requests
// that time out may still incur upstream usage. The keys expire automatically.
const RESERVE = `
for i=1,#KEYS do
  if tonumber(redis.call('GET', KEYS[i]) or '0') + tonumber(ARGV[(i-1)*3+1]) > tonumber(ARGV[(i-1)*3+2]) then return i end
end
for i=1,#KEYS do
  redis.call('INCRBY', KEYS[i], ARGV[(i-1)*3+1])
  redis.call('EXPIRE', KEYS[i], ARGV[(i-1)*3+3])
end
return 0`;
async function reserveUsage(ip, reserved, fetcher = fetch, now = Date.now()) {
  const minute = Math.floor(now / 60000), day = new Date(now).toISOString().slice(0, 10);
  const hash = createHash('sha256').update(ip).digest('hex').slice(0,32);
  const counters = [
    [`tc:minute:${minute}:${hash}`, 1, limit('AI_REQUESTS_PER_MINUTE', 10, 60), 120],
    [`tc:day:${day}:${hash}`, 1, limit('AI_REQUESTS_PER_DAY', 100, 1000), 172800],
    [`tc:global:${day}`, 1, limit('AI_DAILY_REQUEST_LIMIT', 500, 10000), 172800],
    [`tc:budget:${day}`, reserved, limit('AI_DAILY_TOKEN_BUDGET', 250000, 10000000), 172800]
  ];
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  let exceeded;
  if (url && token) {
    try {
      if (!url.startsWith('https://')) throw new Error('Invalid store URL');
      const response = await fetcher(url, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(['EVAL',RESERVE,String(counters.length),...counters.map(c=>c[0]),...counters.flatMap(c=>c.slice(1).map(String))]), signal:AbortSignal.timeout(3000) });
      const data = await response.json();
      if (!response.ok || data.error || !Number.isInteger(data.result) || data.result < 0 || data.result > counters.length) throw new Error('Store failed');
      exceeded = data.result;
    } catch { throw fail(503, 'LIMIT_STORE_UNAVAILABLE', 'AI is temporarily unavailable. Your collection is still available. Please try again later.'); }
  } else if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    for (const [key,value] of memory) if (value.expires <= now) memory.delete(key);
    exceeded = counters.findIndex(([key,amount,cap]) => (memory.get(key)?.count || 0) + amount > cap) + 1;
    if (!exceeded) for (const [key,amount,,ttl] of counters) memory.set(key,{count:(memory.get(key)?.count || 0)+amount,expires:now+ttl*1000});
  } else {
    throw fail(503, 'LIMIT_STORE_REQUIRED', 'AI usage controls are being set up. Your saved collection is still available.');
  }
  if (exceeded) throw fail(429, 'USAGE_LIMIT', exceeded < 3 ? 'Your AI request limit has been reached. Please try again later.' : 'Torcida has reached its daily AI allowance. Please try again tomorrow.', exceeded === 1 ? 60 : 86400 - Math.floor(now/1000)%86400);
}

async function handler(req,res) {
  const origin = req.headers.origin;
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
  if (origin && ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin',origin);
  if (origin && !ORIGINS.has(origin)) return res.status(403).json({error:{code:'ORIGIN_DENIED',message:'Open Torcida from its published app address.'}});
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Torcida-Access');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {res.setHeader('Allow','POST, OPTIONS');return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Use POST for this request.'}});}
  try {
    if (!validAccess(req.headers['x-torcida-access'])) throw fail(401,'ACCESS_CODE_REQUIRED','Enter your Torcida access code to use AI features.');
    if (!process.env.ANTHROPIC_KEY) throw fail(503,'AI_NOT_CONFIGURED','AI is not configured yet. Your collection is still available.');
    const request = validateRequest(req.body);
    // Vercel supplies this header. Do not use a client-controlled request/body ID.
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
    await reserveUsage(ip,request.reserved);
    const response = await fetch('https://api.anthropic.com/v1/messages', {method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify(request.payload),signal:AbortSignal.timeout(16000)});
    if (!response.ok) {
      if(response.status===429)throw fail(429,'PROVIDER_BUSY','AI is busy. Please try again in a minute.',60);
      throw fail(502,'PROVIDER_ERROR','AI could not complete this request. Please try again later.');
    }
    const data=await response.json();
    if(data.stop_reason==='max_tokens')throw fail(422,'INCOMPLETE_RESULT','The AI response was incomplete. Please try a more specific request.');
    if(!Array.isArray(data.content))throw fail(502,'INVALID_RESULT','AI returned an unexpected result. Please try again.');
    let normalized;
    try {
      const text=data.content.filter(b=>b?.type==='text'&&typeof b.text==='string').map(b=>b.text).join('');
      normalized=normalizeAI(parseAI(text),request.operation);
    } catch(error) {throw fail(502,'INVALID_RESULT',error.message);}
    return res.status(200).json({content:[{type:'text',text:JSON.stringify(normalized)}],stop_reason:'end_turn'});
  } catch(error) {
    if(error.retry)res.setHeader('Retry-After',String(error.retry));
    const timedOut = error.name==='TimeoutError'||error.name==='AbortError';
    return res.status(error.status || (timedOut?504:502)).json({error:{code:error.code || (timedOut?'AI_TIMEOUT':'AI_UNAVAILABLE'),message:error.status?error.message:timedOut?'AI took too long. Please try again.':'AI is temporarily unavailable. Please try again later.'}});
  }
}

module.exports = handler;
module.exports.validateRequest = validateRequest;
module.exports.reserveUsage = reserveUsage;
