// composants/StyleGlobal.jsx — habillage commun à tout le site (survols, focus, animations, barres de défilement).
// Aucun impact sur le fonctionnement : uniquement du visuel.
import React from "react";

const CSS = `
:root{--gn-bleu:#123A7A;--gn-bleu-vif:#2F6FDE;--gn-rouge:#C0172D;--gn-texte:#14213A;--gn-bord:#D3DDEA;--gn-fond:#E9EFF7}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:#E9EFF7;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
::selection{background:#2F6FDE;color:#fff}
button,a,input,select,textarea{transition:background-color .15s ease,border-color .15s ease,box-shadow .18s ease,transform .18s ease,filter .15s ease,opacity .15s ease}
button:not(:disabled){cursor:pointer}
button:disabled{cursor:not-allowed}
button:not(:disabled):hover{filter:brightness(1.07)}
button:not(:disabled):active{transform:translateY(1px) scale(.992)}
a:hover{filter:brightness(1.06)}
:focus-visible{outline:3px solid rgba(47,111,222,.55);outline-offset:2px}
input:not([type=checkbox]):not([type=radio]):focus,select:focus,textarea:focus{border-color:#2F6FDE!important;box-shadow:0 0 0 4px rgba(47,111,222,.16);outline:none}
input[type=checkbox],input[type=radio]{accent-color:#123A7A}
.gh-btn-anim{transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease,background-color .2s ease}
.gh-btn-anim:hover{transform:translateY(-3px);box-shadow:0 18px 32px -18px rgba(7,20,46,.55)!important;filter:none!important}
.gh-card-anim{transition:transform .2s ease,box-shadow .2s ease}
.gh-card-anim:hover{transform:translateY(-3px);box-shadow:0 20px 36px -20px rgba(7,20,46,.45)!important}
.gh-link-anim:hover{transform:translateY(-1px)}
.gn-menu-item:not(.gn-actif):hover{background:rgba(255,255,255,.075)!important;color:#fff!important}
.gn-groupe:hover{background:rgba(255,255,255,.05)!important}
.gn-appear{animation:gnAppear .38s ease both}
@keyframes gnAppear{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes gnPulse{0%,100%{opacity:1}50%{opacity:.45}}
.gn-pulse{animation:gnPulse 1.8s ease-in-out infinite}
*::-webkit-scrollbar{width:10px;height:10px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:#B8C6DB;border-radius:10px;border:2px solid transparent;background-clip:content-box}
*::-webkit-scrollbar-thumb:hover{background:#8FA3C0;background-clip:content-box;border:2px solid transparent}
table{border-collapse:collapse}
@media (max-width:640px){button,select,input{min-height:40px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{.gn-appear{animation:none}}
`;

// S'installe tout seul dès que le site démarre (il suffit que App.jsx l'importe)
if (typeof document !== "undefined" && !document.getElementById("gn-style-global")) {
  const el = document.createElement("style");
  el.id = "gn-style-global";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function StyleGlobal() {
  return null;
}
