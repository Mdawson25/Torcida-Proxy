async function readAIResponse(response,kind){
  var data;
  try{data=await response.json();}catch(e){throw new Error('The service returned an unreadable response. Please try again.');}
  if(!response.ok||data.error){
    var code=data.error&&data.error.code;
    if(code==='ACCESS_CODE_REQUIRED'){
      var access=window.prompt('Enter the Torcida access code supplied by the app owner.');
      if(access){try{sessionStorage.setItem('tc_ai_access',access);}catch(e){}throw new Error('Access code entered. Please try your request again.');}
    }
    throw new Error(data.error&&typeof data.error.message==='string'?data.error.message:'The request failed. Please try again.');
  }
  if(!Array.isArray(data.content))throw new Error('The service returned an unexpected result. Please try again.');
  if(data.stop_reason==='max_tokens')throw new Error('The result was incomplete. Please try again with a more specific request.');
  var text=data.content.filter(function(b){return b&&b.type==='text'&&typeof b.text==='string';}).map(function(b){return b.text;}).join('');
  return TorcidaData.normalizeAI(TorcidaData.parseAI(text),kind);
}
