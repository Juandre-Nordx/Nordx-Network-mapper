const svg=document.querySelector('#diagram');
const data=JSON.parse(document.querySelector('#initial-diagram').textContent);
const ns='http://www.w3.org/2000/svg';
let selected=null,connecting=false,source=null,drag=null,dirty=false,pending=null;
const status=document.querySelector('#status');
const dialog=document.querySelector('#port-dialog');
const portForm=document.querySelector('#port-form');
const masterInput=document.querySelector('#master-port');
const slaveInput=document.querySelector('#slave-port');
const portError=document.querySelector('#port-error');
function el(type,attrs){const e=document.createElementNS(ns,type);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function portLabel(a,b,ratio,label){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
 const x=a.x+dx*ratio-dy/length*16,y=a.y+dy*ratio+dx/length*16;
 const t=el('text',{x,y,'text-anchor':'middle',fill:'#153E35','font-size':12,'paint-order':'stroke',stroke:'#fff','stroke-width':5,'stroke-linejoin':'round'});
 t.textContent=label.length>28?label.slice(0,27)+'…':label;return t;
}
function render(){
 svg.replaceChildren();
 data.edges.forEach((edge,index)=>{
  const a=data.nodes.find(n=>n.id===edge.from),b=data.nodes.find(n=>n.id===edge.to);if(!a||!b)return;
  const g=el('g',{'data-edge-index':index,tabindex:0,role:'button','aria-label':`${a.label} master port ${edge.masterPort||'unspecified'} to ${b.label} slave port ${edge.slavePort||'unspecified'}. Edit connection ports.`});
  const title=el('title',{});title.textContent=g.getAttribute('aria-label');g.append(title);
  g.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'transparent','stroke-width':18}));
  g.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#8da69a','stroke-width':3}));
  if(edge.masterPort)g.append(portLabel(a,b,0.28,'M: '+edge.masterPort));
  if(edge.slavePort)g.append(portLabel(a,b,0.72,'S: '+edge.slavePort));
  svg.append(g);
 });
 for(const n of data.nodes){
  const g=el('g',{'data-id':n.id,transform:`translate(${n.x},${n.y})`,tabindex:0,role:'button','aria-label':n.label});
  g.append(el('rect',{x:-65,y:-27,width:130,height:54,rx:9,fill:n.id===selected?'#C4E9AD':'#fff',stroke:'#153E35','stroke-width':2}));
  const t=el('text',{'text-anchor':'middle',y:-2,fill:'#153E35','font-size':14});t.textContent=n.label.length>18?n.label.slice(0,17)+'…':n.label;
  const s=el('text',{'text-anchor':'middle',y:17,fill:'#537267','font-size':11});s.textContent=n.type;g.append(t,s);svg.append(g);
 }
}
function openPorts(from,to,index=null){
 const a=data.nodes.find(n=>n.id===from),b=data.nodes.find(n=>n.id===to);if(!a||!b)return;
 pending={from,to,index};const edge=index===null?null:data.edges[index];
 document.querySelector('#port-devices').textContent=`Master device: ${a.label}. Slave device: ${b.label}.`;
 masterInput.value=edge?.masterPort||'';slaveInput.value=edge?.slavePort||'';portError.textContent='';
 source=null;dialog.showModal();masterInput.focus();
}
portForm.addEventListener('submit',e=>{
 e.preventDefault();if(!pending)return;
 const masterPort=masterInput.value.trim(),slavePort=slaveInput.value.trim();
 if(!masterPort||!slavePort){portError.textContent='Enter both master and slave ports.';return;}
 const {from,to,index}=pending;
 const duplicate=data.edges.some((edge,i)=>i!==index&&((edge.from===from&&edge.to===to&&edge.masterPort===masterPort&&edge.slavePort===slavePort)||(edge.from===to&&edge.to===from&&edge.masterPort===slavePort&&edge.slavePort===masterPort)));
 if(duplicate){portError.textContent='This connection already exists with these ports.';return;}
 if(index===null&&data.edges.length>=600){portError.textContent='A plan can contain at most 600 connections.';return;}
 const edge={from,to,masterPort,slavePort};if(index===null)data.edges.push(edge);else data.edges[index]=edge;
 dirty=true;dialog.close();render();status.textContent='Connection ports applied. Save your diagram.';
});
function cancelledPorts(){status.textContent=connecting?'Connection cancelled. Select the master device.':'Port edit cancelled.';}
document.querySelector('#port-cancel').onclick=()=>{cancelledPorts();dialog.close();};
dialog.addEventListener('cancel',cancelledPorts);
dialog.addEventListener('close',()=>{pending=null;source=null;});
function chooseDevice(id){
 selected=id;
 if(connecting){
  if(source&&source!==id){const from=source;const legacyIndex=data.edges.findIndex(e=>e.from===from&&e.to===id&&!e.masterPort&&!e.slavePort);openPorts(from,id,legacyIndex<0?null:legacyIndex);}
  else{source=id;status.textContent='Master selected. Select the slave device.';}
 }
 render();
}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.addEventListener('pointerdown',e=>{
 const edge=e.target.closest('[data-edge-index]');if(edge){const index=Number(edge.dataset.edgeIndex),connection=data.edges[index];openPorts(connection.from,connection.to,index);return;}
 const g=e.target.closest('[data-id]');if(!g)return;const id=g.dataset.id;chooseDevice(id);
 if(!connecting){const n=data.nodes.find(n=>n.id===id),p=point(e);drag={n,dx:p.x-n.x,dy:p.y-n.y};svg.setPointerCapture(e.pointerId);}
});
svg.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const edge=e.target.closest('[data-edge-index]'),node=e.target.closest('[data-id]');if(!edge&&!node)return;e.preventDefault();if(edge){const index=Number(edge.dataset.edgeIndex),connection=data.edges[index];openPorts(connection.from,connection.to,index);}else chooseDevice(node.dataset.id);});
svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);drag.n.x=Math.max(65,Math.min(1135,p.x-drag.dx));drag.n.y=Math.max(30,Math.min(770,p.y-drag.dy));dirty=true;render();});
svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
document.querySelector('#add').onclick=()=>{if(data.nodes.length>=300)return;data.nodes.push({id:crypto.randomUUID(),label:document.querySelector('#label').value.trim()||'Device',type:document.querySelector('#type').value,x:150+Math.random()*700,y:100+Math.random()*400});dirty=true;render();};
document.querySelector('#connect').onclick=e=>{connecting=!connecting;source=null;e.target.textContent=connecting?'Finish connecting':'Connect devices';status.textContent=connecting?'Select the master device, then the slave device.':'Drag devices to position them. Click a connection to edit ports.';};
document.querySelector('#remove').onclick=()=>{data.nodes=data.nodes.filter(n=>n.id!==selected);data.edges=data.edges.filter(e=>e.from!==selected&&e.to!==selected);selected=null;source=null;dirty=true;render();};
document.querySelector('#save').onclick=async()=>{status.textContent='Saving…';try{const r=await fetch(`/plans/${svg.dataset.planId}/diagram`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify(data)});if(!r.ok||r.redirected||!(r.headers.get('content-type')||'').includes('application/json'))throw Error();dirty=false;status.textContent='Diagram saved.';}catch{status.textContent='Save failed. Check your connection and sign-in status.';}};
const background=document.querySelector('#background');
function setBackground(){svg.style.backgroundImage=background.value?`url("/uploads/${background.value}")`:'';}
background.value=data.backgroundUploadId?String(data.backgroundUploadId):'';setBackground();
background.onchange=()=>{data.backgroundUploadId=background.value?Number(background.value):null;dirty=true;setBackground();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});render();
