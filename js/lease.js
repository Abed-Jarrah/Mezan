(function(global){
  function leaseUrl(chatUrl){return String(chatUrl||'').replace(/\/chat$/, '/lease')}
  async function request(url,idToken,deviceId,operation){
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},body:JSON.stringify({operation,deviceId})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||'Lease request failed');error.status=response.status;throw error}
    return data;
  }
  global.MezanLease={leaseUrl,requestBody:(operation,deviceId)=>({operation,deviceId}),acquire:(idToken,deviceId,url)=>request(url||leaseUrl(global.CHAT_API_URL),idToken,deviceId,'acquire'),renew:(idToken,deviceId,url)=>request(url||leaseUrl(global.CHAT_API_URL),idToken,deviceId,'renew'),release:(idToken,deviceId,url)=>request(url||leaseUrl(global.CHAT_API_URL),idToken,deviceId,'release')};
})(window);
