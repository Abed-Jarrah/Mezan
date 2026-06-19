(function(global){
  const CLIENT_ID='792973323075-7ujki7407gpuq5ttfn0va4q82eupf06r.apps.googleusercontent.com';
  let initialized=false,tokenClient=null,idToken=null,driveToken=null,profile=null;
  const listeners=new Set(),signInResolvers=[];
  let driveTokenResolver=null;

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
    if(!global.google?.accounts?.id)return false;
    if(!initialized){
      global.google.accounts.id.initialize({client_id:CLIENT_ID,callback:response=>setToken(response?.credential)});
      initialized=true;
    }
    return true;
  }
  function initDriveTokenClient(){
    if(!global.google?.accounts?.oauth2?.initTokenClient)return false;
    if(!tokenClient){
      tokenClient=global.google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:'https://www.googleapis.com/auth/drive.appdata',callback:response=>{
        const resolver=driveTokenResolver;driveTokenResolver=null;
        if(response?.access_token){driveToken=response.access_token;resolver?.resolve(driveToken)}
        else resolver?.reject(new Error(response?.error||'Google Drive authorization failed'));
      }});
    }
    return true;
  }
  function requestDriveToken(){
    if(driveToken)return Promise.resolve(driveToken);
    if(!initDriveTokenClient())return Promise.reject(new Error('Google Drive authorization is unavailable'));
    return new Promise((resolve,reject)=>{
      driveTokenResolver={resolve,reject};
      try{tokenClient.requestAccessToken()}catch(error){driveTokenResolver=null;reject(error)}
    });
  }
  function signIn(){
    if(idToken)return Promise.resolve(idToken);
    if(!init())return Promise.reject(new Error('Google sign-in is unavailable'));
    return new Promise((resolve,reject)=>{
      signInResolvers.push({resolve,reject});
      try{global.google.accounts.id.prompt()}catch(error){signInResolvers.splice(signInResolvers.findIndex(item=>item.resolve===resolve),1);reject(error)}
    });
  }
  function renderButton(container,options){
    if(!container||idToken||!init())return false;
    try{
      global.google.accounts.id.renderButton(container,Object.assign({type:'standard',theme:'filled_blue',size:'large',shape:'pill',text:'signin_with'},options||{}));
      return true;
    }catch{return false}
  }
  function signOut(){
    idToken=null;driveToken=null;profile=null;
    if(driveTokenResolver){driveTokenResolver.reject(new Error('Signed out'));driveTokenResolver=null}
    global.google?.accounts?.id?.disableAutoSelect?.();
    global.localStorage?.removeItem('mezan_google_profile');
    notify();
  }
  global.MezanAuth={CLIENT_ID,init,signIn,renderButton,requestDriveToken,getDriveToken:()=>driveToken,getIdToken:()=>idToken,isSignedIn:()=>!!idToken,getProfile:()=>profile,onChange(callback){listeners.add(callback);return()=>listeners.delete(callback)},signOut,decodeIdTokenForDisplay,
    // Test-only seam. Do not use this to authenticate a production user.
    __setTestToken(token,displayProfile){setToken(token,displayProfile||null)}
  };
  // GIS loads async/defer; this hook fires when it's ready so the UI can re-render and draw the button.
  global.onGoogleLibraryLoad=function(){init();notify()};
})(window);
