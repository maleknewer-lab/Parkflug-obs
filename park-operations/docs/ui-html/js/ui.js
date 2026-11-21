/* UI behaviour only — no data, no business logic.
   Menu, light/dark toggle, side sheet, segmented controls, clickable rows,
   signature pad, toast. Safe to port 1:1 into React components. */
(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* Hamburger menu */
var menu=$("#menu"),scrim=$("#scrim"),menuBtn=$("#menuBtn");
function openMenu(o){if(!menu)return;menu.classList.toggle("on",o);scrim&&scrim.classList.toggle("on",o);menuBtn&&menuBtn.setAttribute("aria-expanded",o)}
menuBtn&&menuBtn.addEventListener("click",function(){openMenu(true)});
$("#menuClose")&&$("#menuClose").addEventListener("click",function(){openMenu(false)});
scrim&&scrim.addEventListener("click",function(){openMenu(false)});

/* Theme: light "Mist grey" / dark "Graphite" */
$("#themeBtn")&&$("#themeBtn").addEventListener("click",function(){
  var r=document.documentElement;
  var dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
  r.dataset.theme=dark?"light":"dark";try{localStorage.setItem("theme",r.dataset.theme)}catch(e){}
});

/* Account sheet */
$("#meBtn")&&$("#meBtn").addEventListener("click",function(){location.href="konto.html"});

/* Side sheet: close via ✕, scrim or Esc -> data-close-href */
var sheet=$("#sheet");
function closeSheet(){if(!sheet)return;var h=sheet.dataset.closeHref;if(h)location.href=h;else{sheet.classList.remove("on");$("#sheetScrim")&&$("#sheetScrim").classList.remove("on")}}
$$("#shClose,#ivClose,[aria-label='Schließen']",sheet||document).forEach(function(b){if(sheet&&sheet.contains(b))b.addEventListener("click",closeSheet)});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){openMenu(false);closeSheet()}});

/* Clickable rows/cards: data-href */
document.addEventListener("click",function(e){
  if(e.target.closest("a,button,input,select,textarea,label"))return;
  var el=e.target.closest("[data-href]");if(el)location.href=el.dataset.href;
});

/* Segmented controls: visual toggle; backend/React decides the filter */
document.addEventListener("click",function(e){
  var b=e.target.closest(".seg button");if(!b)return;
  $$("button",b.parentNode).forEach(function(x){x.classList.toggle("on",x===b)});
  b.parentNode.dispatchEvent(new CustomEvent("seg:change",{bubbles:true,detail:{button:b,data:Object.assign({},b.dataset)}}));
});

/* Signature pad (driver check-in) */
$$("canvas.sig").forEach(function(cv){
  var dpr=window.devicePixelRatio||1;cv.width=cv.clientWidth*dpr;cv.height=cv.clientHeight*dpr;
  var ctx=cv.getContext("2d");ctx.scale(dpr,dpr);ctx.lineWidth=2.2;ctx.lineCap="round";ctx.strokeStyle="#0d1430";
  var drawing=false;
  function pos(e){var r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
  cv.addEventListener("pointerdown",function(e){drawing=true;cv.setPointerCapture(e.pointerId);var p=pos(e);ctx.beginPath();ctx.moveTo(p[0],p[1])});
  cv.addEventListener("pointermove",function(e){if(!drawing)return;var p=pos(e);ctx.lineTo(p[0],p[1]);ctx.stroke()});
  cv.addEventListener("pointerup",function(){drawing=false;cv.dataset.signed="1"});
  var clr=$("#ckClr");clr&&clr.addEventListener("click",function(){ctx.clearRect(0,0,cv.width,cv.height);delete cv.dataset.signed});
});

/* Toast: window.toast("Text") */
var tt;window.toast=function(m){var t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("on");clearTimeout(tt);tt=setTimeout(function(){t.classList.remove("on")},2600)};
})();
