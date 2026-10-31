const svg=document.querySelector('#diagram');
const data=JSON.parse(document.querySelector('#initial-diagram').textContent);
const ns='http://www.w3.org/2000/svg';let selected=null,connecting=false,source=null,drag=null,dirty=false;
const status=document.querySelector('#status');
function el(type,attrs){const e=document.createElementNS(ns,type);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function render(){svg.replaceChildren();for(const edge of data.edges){const a=data.nodes.find(n=>n.id===edge.from),b=data.nodes.find(n=>n.id===edge.to);if(a&&b)svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#8da69a','stroke-width':3}));}for(const n of data.nodes){const g=el('g',{'data-id':n.id,transform:`translate(${n.x},${n.y})`,tabindex:0,role:'button','aria-label':n.label});g.append(el('rect',{x:-65,y:-27,width:130,height:54,rx:9,fill:n.id===selected?'#C4E9AD':'#fff',stroke:'#153E35','stroke-width':2}));const t=el('text',{'text-anchor':'middle',y:-2,fill:'#153E35','font-size':14});t.textContent=n.label.length>18?n.label.slice(0,17)+'…':n.label;const s=el('text',{'text-anchor':'middle',y:17,fill:'#537267','font-size':11});s.textContent=n.type;g.append(t,s);svg.append(g);}}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.addEventListener('pointerdown',e=>{const g=e.target.closest('[data-id]');if(!g)return;const id=g.dataset.id;selected=id;if(connecting){if(source&&source!==id){if(!data.edges.some(x=>x.from===source&&x.to===id))data.edges.push({from:source,to:id});dirty=true;source=null;status.textContent='Connection added. Save your diagram.';}else{source=id;status.textContent='Select the second device.';}}else{const n=data.nodes.find(n=>n.id===id),p=point(e);drag={n,dx:p.x-n.x,dy:p.y-n.y};svg.setPointerCapture(e.pointerId);}render();});
svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);drag.n.x=Math.max(65,Math.min(1135,p.x-drag.dx));drag.n.y=Math.max(30,Math.min(770,p.y-drag.dy));dirty=true;render();});
svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
document.querySelector('#add').onclick=()=>{if(data.nodes.length>=300)return;data.nodes.push({id:crypto.randomUUID(),label:document.querySelector('#label').value.trim()||'Device',type:document.querySelector('#type').value,x:150+Math.random()*700,y:100+Math.random()*400});dirty=true;render();};
document.querySelector('#connect').onclick=e=>{connecting=!connecting;source=null;e.target.textContent=connecting?'Finish connecting':'Connect devices';};
document.querySelector('#remove').onclick=()=>{data.nodes=data.nodes.filter(n=>n.id!==selected);data.edges=data.edges.filter(e=>e.from!==selected&&e.to!==selected);selected=null;dirty=true;render();};
document.querySelector('#save').onclick=async()=>{status.textContent='Saving…';try{const r=await fetch(`/plans/${svg.dataset.planId}/diagram`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify(data)});if(!r.ok||r.redirected||!(r.headers.get('content-type')||'').includes('application/json'))throw Error();dirty=false;status.textContent='Diagram saved.';}catch{status.textContent='Save failed. Check your connection and sign-in status.';}};
const background=document.querySelector('#background');
function setBackground(){svg.style.backgroundImage=background.value?`url("/uploads/${background.value}")`:'';}
background.value=data.backgroundUploadId?String(data.backgroundUploadId):'';setBackground();
background.onchange=()=>{data.backgroundUploadId=background.value?Number(background.value):null;dirty=true;setBackground();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});render();
// Multipart forms send the CSRF token as a header via fetch.
