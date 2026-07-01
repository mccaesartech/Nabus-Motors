/**
 * Self-contained recovery script injected in <head> before any Next.js bundles load.
 * Only handles failed /_next/static/ script tags — no fetch patching or build-ID reloads.
 * Must stay plain JS — no imports, no TypeScript syntax.
 */
export const CACHE_RECOVERY_INLINE_SCRIPT = `(function(){
var RELOAD_KEY="tg-reload-attempts",MAX=2;
function reload(){
  try{
    var a=Number(sessionStorage.getItem(RELOAD_KEY)||"0");
    if(a>=MAX)return;
    sessionStorage.setItem(RELOAD_KEY,String(a+1));
    location.reload();
  }catch(e){}
}
window.addEventListener("error",function(e){
  var t=e.target;
  if(t&&t.tagName==="SCRIPT"){
    var src=t.src||"";
    if(src.indexOf("/_next/static/")!==-1){e.preventDefault();reload();}
  }
},true);
})();`;
