import { PRODUCTION_PUBLIC_SITE_URL } from "@/lib/site-url";

/**
 * Self-contained recovery script injected in <head> before any Next.js bundles load.
 * - Migrates browsers still on *.vercel.app to the canonical www origin and unregisters SWs
 * - Handles failed /_next/static/ script tags
 * Must stay plain JS — no imports inside the IIFE string.
 */
export function buildCacheRecoveryInlineScript(
  canonicalOrigin: string = PRODUCTION_PUBLIC_SITE_URL
): string {
  const canon = JSON.stringify(canonicalOrigin);
  return `(function(){
var CANON=${canon};
try{
  var h=(location.hostname||"").toLowerCase();
  if(h.slice(-11)===".vercel.app"){
    try{
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){
        navigator.serviceWorker.getRegistrations().then(function(regs){
          return Promise.all((regs||[]).map(function(r){return r.unregister();}));
        }).catch(function(){});
      }
    }catch(e){}
    location.replace(CANON+location.pathname+location.search+location.hash);
    return;
  }
}catch(e){}
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
}

/** @deprecated Prefer buildCacheRecoveryInlineScript() so the canonical origin is injected. */
export const CACHE_RECOVERY_INLINE_SCRIPT = buildCacheRecoveryInlineScript();
