(function(global){
  const CLIENT_ID='792973323075-7ujki7407gpuq5ttfn0va4q82eupf06r.apps.googleusercontent.com';
  let initialized=false,idToken=null,profile=null;
  const listeners=new Set(),signInResolvers=[];

  function decodeIdTokenForDisplay(token){
    if(typeof token!=='string')return null;
    try{
      const payload=token.split('.')[1];
      if(!payload)return null;
      const base64=payload.replace(/-/g,'+').replace(/_/g,'/');
      const json=decodeURIComponent(Array.from(atob(base64),char=>`%${char.charCodeAt(0).toString(16).padStart(2,'0')}`).join(''));
      const value=JSON.parse(json);
      return {name:typeof value.name==='string'?value.name:'',email:typeof value.email==='string'?value.email:'',picture:typeof value.picture==='string'?value.picture:''};
    }catch{return null}
  }
  function notify(){listeners.forEach(listener=>listener())}
  function setToken(token,displayProfile){
    idToken=token||null;
    profile=displayProfile||decodeIdTokenForDisplay(idToken);
    if(idToken){while(signInResolvers.length)signInResolvers.shift().resolve(idToken)}
    notify();
  }
  function init(){
    if(initialized||!global.google?.accounts?.id)return false;
    global.google.accounts.id.initialize({client_id:CLIENT_ID,callback:response=>setToken(response?.credential)});
    initialized=true;
    return true;
  }
  function signIn(){
    if(idToken)return Promise.resolve(idToken);
    if(!init())return Promise.reject(new Error('Google sign-in is unavailable'));
    return new Promise((resolve,reject)=>{
      signInResolvers.push({resolve,reject});
      try{global.google.accounts.id.prompt()}catch(error){signInResolvers.splice(signInResolvers.findIndex(item=>item.resolve===resolve),1);reject(error)}
    });
  }
  function signOut(){
    idToken=null;profile=null;
    global.google?.accounts?.id?.disableAutoSelect?.();
    global.localStorage?.removeItem('mezan_google_profile');
    notify();
  }
  global.MezanAuth={CLIENT_ID,init,signIn,getIdToken:()=>idToken,isSignedIn:()=>!!idToken,getProfile:()=>profile,onChange(callback){listeners.add(callback);return()=>listeners.delete(callback)},signOut,decodeIdTokenForDisplay,
    // Test-only seam. Do not use this to authenticate a production user.
    __setTestToken(token,displayProfile){setToken(token,displayProfile||null)}
  };
})(window);
