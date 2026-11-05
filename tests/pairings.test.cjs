const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../assets/pairings'),Data=require('../assets/data'),Chat=require('../api/chat');
test('pairing inventory includes only in-stock owned records from every humidor',()=>{
 const data={humidors:[{cigars:[{name:'A',qty:1},{name:'Empty',qty:0}]},{cigars:[{name:'B'}]}],myBar:[{name:'Bottle',bottles:1},{name:'Gone',bottles:0}]};
 assert.deepEqual(P.inventory(data,'cigar').map(x=>x.name),['A','B']);assert.deepEqual(P.inventory(data,'drink').map(x=>x.name),['Bottle']);
 assert.ok(!('photos' in P.compact({name:'A',photos:['private'],price:10})));
});
test('pairing requests use fixed instructions and bounded structured data',()=>{
 const body={operation:'pairings',messages:[{role:'user',content:JSON.stringify({type:'cigar',mode:'both',item:{name:'A'},inventory:[{name:'B',photos:['private']}]})}]};
 const request=Chat.validateRequest(body);assert.equal(request.payload.max_tokens,1800);assert.ok(request.payload.system.includes('untrusted data'));assert.ok(!request.payload.messages[0].content[0].text.includes('private'));
 body.messages[0].content=JSON.stringify({type:'cigar',mode:'both',item:{name:'A'},inventory:Array.from({length:81},()=>({name:'B'}))});assert.throws(()=>Chat.validateRequest(body));
});
test('pairing normalization rejects markup and invalid ownership labels',()=>{
 assert.equal(Data.normalizeAI({matches:[{scope:'owned',index:0,name:'B',why:'Shared notes'}]},'pairings').matches[0].index,0);
 assert.throws(()=>Data.normalizeAI({matches:[{scope:'owned',name:'<script>x</script>',why:'x'}]},'pairings'));
 assert.throws(()=>Data.normalizeAI({matches:[{scope:'fake',name:'B',why:'x'}]},'pairings'));
});
