import {deviceColor,deviceTextColor} from './device-colors.js';
const svg=document.querySelector('#diagram');
const data=JSON.parse(document.querySelector('#initial-diagram').textContent);
const ns='http://www.w3.org/2000/svg';
let selected=null,connecting=false,source=null,drag=null,dirty=false,pending=null,pan=null,panMode=false,activePointer=null,resize=null;
const view={x:0,y:0,width:1200,height:800};
const panButton=document.querySelector('#pan-canvas');
let viewInitialized=false;
function applyView(){
 view.x=view.width>=1600?(1200-view.width)/2:Math.max(-200,Math.min(1400-view.width,view.x));
 view.y=view.height>=1200?(800-view.height)/2:Math.max(-200,Math.min(1000-view.height,view.y));
 svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);
}
function sizeView(reset=false){
 const width=svg.clientWidth,height=svg.clientHeight;if(!width||!height)return;
 const centerX=view.x+view.width/2,centerY=view.y+view.height/2;
 const fitScale=Math.min(width/1200,height/800);
 const scale=width<650?Math.max(fitScale,width/600):fitScale;
 view.width=width/scale;view.height=height/scale;
 view.x=reset||!viewInitialized?Math.min(0,(1200-view.width)/2):centerX-view.width/2;
 view.y=reset||!viewInitialized?Math.min(0,(800-view.height)/2):centerY-view.height/2;
 viewInitialized=true;applyView();
}
function setPanMode(enabled){panMode=enabled;panButton.setAttribute('aria-pressed',String(enabled));svg.classList.toggle('pan-mode',enabled);}
panButton.onclick=()=>{setPanMode(!panMode);if(panMode){connecting=false;source=null;document.querySelector('#connect').textContent='Connect devices';}status.textContent=panMode?'Drag anywhere on the canvas to move around.':'Drag empty space to move around, or drag a device to reposition it.';render();};
document.querySelector('#reset-view').onclick=()=>sizeView(true);
new ResizeObserver(()=>sizeView()).observe(svg);

const status=document.querySelector('#status');
const dialog=document.querySelector('#port-dialog');
const portForm=document.querySelector('#port-form');
const masterInput=document.querySelector('#master-port');
const slaveInput=document.querySelector('#slave-port');
const portError=document.querySelector('#port-error');
const sizeForm=document.querySelector('#device-size-form');
const widthInput=document.querySelector('#device-width'),heightInput=document.querySelector('#device-height');
const colorInput=document.querySelector('#device-color');
function changeDeviceColor(){const node=data.nodes.find(n=>n.id===selected);if(!node)return;node.color=colorInput.value;dirty=true;render();status.textContent='Device colour updated. Save your diagram.';}
colorInput.addEventListener('input',changeDeviceColor);colorInput.addEventListener('change',changeDeviceColor);
document.querySelector('#reset-device-color').onclick=()=>{const node=data.nodes.find(n=>n.id===selected);if(!node)return;node.color='#ffffff';dirty=true;render();status.textContent='Device colour reset. Save your diagram.';};
function dimensions(node){return {width:node.width??130,height:node.height??54};}
function resizeDevice(node,width,height){
 node.width=Math.round(Math.max(80,Math.min(360,width)));node.height=Math.round(Math.max(48,Math.min(240,height)));
 node.x=Math.max(node.width/2,Math.min(1200-node.width/2,node.x));node.y=Math.max(node.height/2,Math.min(800-node.height/2,node.y));
 dirty=true;render();
}
sizeForm.addEventListener('submit',e=>{e.preventDefault();const node=data.nodes.find(n=>n.id===selected);if(!node||!sizeForm.reportValidity())return;resizeDevice(node,Number(widthInput.value),Number(heightInput.value));status.textContent='Device size updated. Save your diagram.';});
data.groups ||= [];
let activeGroupId=null,groupDrag=null;
const groupPicker=document.querySelector('#group-picker');
const deviceGroup=document.querySelector('#device-group');
const groupName=document.querySelector('#group-name');
const membersDialog=document.querySelector('#group-dialog');
const membersForm=document.querySelector('#group-members-form');
let editingGroupId=null;
function groupBounds(group){
 const members=data.nodes.filter(n=>n.groupId===group.id);if(!members.length)return null;
 const left=Math.min(...members.map(n=>n.x-dimensions(n).width/2))-20,right=Math.max(...members.map(n=>n.x+dimensions(n).width/2))+20;
 const top=Math.min(...members.map(n=>n.y-dimensions(n).height/2))-48,bottom=Math.max(...members.map(n=>n.y+dimensions(n).height/2))+20;
 return {left,top,width:right-left,height:bottom-top};
}
function renderGroupControls(chosen){
 if(activeGroupId&&!data.groups.some(g=>g.id===activeGroupId))activeGroupId=null;
 groupPicker.replaceChildren(new Option('Choose a group',''));deviceGroup.replaceChildren(new Option('Ungrouped',''));
 for(const group of data.groups){groupPicker.add(new Option(group.name,group.id));deviceGroup.add(new Option(group.name,group.id));}
 groupPicker.value=activeGroupId||'';deviceGroup.value=chosen?.groupId||'';
 const active=data.groups.find(g=>g.id===activeGroupId);groupName.value=active?.name||'';groupName.disabled=!active;
 for(const id of ['rename-group','manage-group','remove-group'])document.querySelector('#'+id).disabled=!active;
}
document.querySelector('#create-group-form').addEventListener('submit',e=>{
 e.preventDefault();if(data.groups.length>=100){status.textContent='A plan can contain at most 100 groups.';return;}
 const name=document.querySelector('#new-group-name').value.trim();if(!name)return;
 const group={id:crypto.randomUUID(),name};data.groups.push(group);activeGroupId=group.id;
 const node=data.nodes.find(n=>n.id===selected);if(node)node.groupId=group.id;
 document.querySelector('#new-group-name').value='';dirty=true;render();status.textContent='Group created. Add devices and save your diagram.';
});
groupPicker.onchange=()=>{activeGroupId=groupPicker.value||null;render();};
deviceGroup.onchange=()=>{const node=data.nodes.find(n=>n.id===selected);if(!node)return;if(deviceGroup.value){node.groupId=deviceGroup.value;activeGroupId=deviceGroup.value;}else delete node.groupId;dirty=true;render();status.textContent='Device group updated. Save your diagram.';};
document.querySelector('#edit-group-form').addEventListener('submit',e=>{e.preventDefault();const group=data.groups.find(g=>g.id===activeGroupId),name=groupName.value.trim();if(!group||!name)return;group.name=name;dirty=true;render();status.textContent='Group renamed. Save your diagram.';});
document.querySelector('#remove-group').onclick=()=>{if(!activeGroupId)return;for(const node of data.nodes)if(node.groupId===activeGroupId)delete node.groupId;data.groups=data.groups.filter(g=>g.id!==activeGroupId);activeGroupId=null;dirty=true;render();status.textContent='Group removed. Devices and connections kept. Save your diagram.';};
document.querySelector('#manage-group').onclick=()=>{
 const group=data.groups.find(g=>g.id===activeGroupId);if(!group)return;editingGroupId=group.id;
 document.querySelector('#group-dialog-title').textContent='Devices in '+group.name;
 const list=document.querySelector('#group-members');list.replaceChildren();
 if(!data.nodes.length){const p=document.createElement('p');p.textContent='Add devices to the canvas first.';list.append(p);}
 for(const node of data.nodes){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.name='members';input.value=node.id;input.checked=node.groupId===group.id;const current=data.groups.find(g=>g.id===node.groupId);span.textContent=node.label+(current&&current.id!==group.id?' — currently in '+current.name:'');label.append(input,span);list.append(label);}
 membersDialog.showModal();
};
membersForm.addEventListener('submit',e=>{e.preventDefault();if(!data.groups.some(g=>g.id===editingGroupId))return;const members=new Set(new FormData(membersForm).getAll('members'));for(const node of data.nodes){if(members.has(node.id))node.groupId=editingGroupId;else if(node.groupId===editingGroupId)delete node.groupId;}dirty=true;membersDialog.close();render();status.textContent='Group devices updated. Save your diagram.';});
document.querySelector('#cancel-group-members').onclick=()=>membersDialog.close();
membersDialog.addEventListener('close',()=>{editingGroupId=null;});

function boundary(node,towards){const {width,height}=dimensions(node),dx=towards.x-node.x,dy=towards.y-node.y;const scale=Math.max(Math.abs(dx)/(width/2),Math.abs(dy)/(height/2));const ratio=scale?Math.min(0.45,1/scale):0;return {x:node.x+dx*ratio,y:node.y+dy*ratio};}
function el(type,attrs){const e=document.createElementNS(ns,type);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function portLabel(a,b,ratio,label){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
 const x=a.x+dx*ratio-dy/length*16,y=a.y+dy*ratio+dx/length*16;
 const t=el('text',{x,y,'text-anchor':'middle',fill:'#153E35','font-size':12,'paint-order':'stroke',stroke:'#fff','stroke-width':5,'stroke-linejoin':'round'});
 t.textContent=label.length>28?label.slice(0,27)+'…':label;return t;
}
function render(){
 const chosen=data.nodes.find(n=>n.id===selected);renderGroupControls(chosen);sizeForm.hidden=!chosen;if(chosen){const size=dimensions(chosen);widthInput.value=size.width;heightInput.value=size.height;colorInput.value=deviceColor(chosen);}
 svg.replaceChildren();
 const defs=el('defs',{}),pattern=el('pattern',{id:'canvas-dots',width:20,height:20,patternUnits:'userSpaceOnUse'});
 pattern.append(el('circle',{cx:1,cy:1,r:1,fill:'#bfcfc3'}));defs.append(pattern);svg.append(defs);
 svg.append(el('rect',{x:0,y:0,width:1200,height:800,fill:'url(#canvas-dots)'}));
 if(background.value)svg.append(el('image',{x:0,y:0,width:1200,height:800,href:`/uploads/${background.value}`,preserveAspectRatio:'xMidYMid meet','pointer-events':'none'}));
 for(const group of data.groups){
  const bounds=groupBounds(group);if(!bounds)continue;
  const {left,top,width,height}=bounds,g=el('g',{'data-cabinet-id':group.id});
  const title=el('title',{});title.textContent=group.name;g.append(title);
  g.append(el('rect',{x:left,y:top,width,height,rx:10,fill:'#C4E9AD','fill-opacity':0.14,stroke:group.id===activeGroupId?'#153E35':'#7c998c','stroke-dasharray':'8 5','pointer-events':'none'}));
  g.append(el('rect',{'data-group-handle':group.id,x:left,y:top,width,height:28,rx:5,fill:'#153E35',tabindex:0,role:'button','aria-label':'Move group '+group.name}));
  const label=el('text',{x:left+10,y:top+19,fill:'#fff','font-size':13});const limit=Math.max(5,Math.floor((width-20)/7));label.textContent=group.name.length>limit?group.name.slice(0,limit-1)+'…':group.name;g.append(label);svg.append(g);
 }
 data.edges.forEach((edge,index)=>{
  const a=data.nodes.find(n=>n.id===edge.from),b=data.nodes.find(n=>n.id===edge.to);if(!a||!b)return;
  const g=el('g',{'data-edge-index':index,tabindex:0,role:'button','aria-label':`${a.label} master port ${edge.masterPort||'unspecified'} to ${b.label} slave port ${edge.slavePort||'unspecified'}. Edit connection ports.`});
  const title=el('title',{});title.textContent=g.getAttribute('aria-label');g.append(title);
  g.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'transparent','stroke-width':18}));
  g.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#8da69a','stroke-width':3}));
  const start=boundary(a,b),end=boundary(b,a);
  if(edge.masterPort)g.append(portLabel(start,end,0.28,'M: '+edge.masterPort));
  if(edge.slavePort)g.append(portLabel(start,end,0.72,'S: '+edge.slavePort));
  svg.append(g);
 });
 for(const n of data.nodes){
  const g=el('g',{'data-id':n.id,transform:`translate(${n.x},${n.y})`,tabindex:0,role:'button','aria-label':n.label});
  const {width,height}=dimensions(n),color=deviceColor(n),textColor=deviceTextColor(color);
  g.append(el('rect',{x:-width/2,y:-height/2,width,height,rx:9,fill:color,stroke:'#153E35','stroke-width':2}));
  if(n.id===selected)g.append(el('rect',{x:-width/2-4,y:-height/2-4,width:width+8,height:height+8,rx:12,fill:'none',stroke:'#237ec4','stroke-width':3,'stroke-dasharray':'6 3','pointer-events':'none'}));
  const t=el('text',{'text-anchor':'middle',y:-2,fill:textColor,'font-size':14});const maxChars=Math.max(5,Math.floor((width-16)/7));t.textContent=n.label.length>maxChars?n.label.slice(0,maxChars-1)+'…':n.label;
  const s=el('text',{'text-anchor':'middle',y:17,fill:textColor,'font-size':11});s.textContent=n.type==='voip'?'VoIP phone':n.type;g.append(t,s);
  if(n.id===selected&&!connecting&&!panMode)g.append(el('rect',{'data-resize':n.id,x:width/2-14,y:height/2-14,width:28,height:28,rx:5,fill:'#153E35',stroke:'#fff','stroke-width':2,tabindex:0,role:'button','aria-label':'Resize '+n.label}));
  svg.append(g);
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
 selected=id;const selectedNode=data.nodes.find(n=>n.id===id);if(selectedNode?.groupId)activeGroupId=selectedNode.groupId;
 if(connecting){
  if(source&&source!==id){const from=source;const legacyIndex=data.edges.findIndex(e=>e.from===from&&e.to===id&&!e.masterPort&&!e.slavePort);openPorts(from,id,legacyIndex<0?null:legacyIndex);}
  else{source=id;status.textContent='Master selected. Select the slave device.';}
 }
 render();
}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
svg.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||activePointer!==null)return;
 const edge=e.target.closest('[data-edge-index]'),g=e.target.closest('[data-id]'),cabinet=e.target.closest('[data-group-handle]');
 if(panMode||(!edge&&!g&&!cabinet)){
  e.preventDefault();const rect=svg.getBoundingClientRect();
  pan={clientX:e.clientX,clientY:e.clientY,x:view.x,y:view.y,scaleX:view.width/rect.width,scaleY:view.height/rect.height};
  activePointer=e.pointerId;svg.classList.add('is-panning');svg.setPointerCapture(e.pointerId);return;
 }
 if(cabinet){
  activeGroupId=cabinet.dataset.groupHandle;selected=null;
  if(connecting){render();status.textContent='Finish connecting before moving a group.';return;}
  const members=data.nodes.filter(n=>n.groupId===activeGroupId).map(n=>({node:n,x:n.x,y:n.y}));if(!members.length)return;
  e.preventDefault();const p=point(e);groupDrag={members,x:p.x,y:p.y};activePointer=e.pointerId;svg.setPointerCapture(e.pointerId);render();return;
 }
 const handle=e.target.closest('[data-resize]');
 if(handle&&!connecting){e.preventDefault();const n=data.nodes.find(n=>n.id===handle.dataset.resize),p=point(e);resize={n,startX:p.x,startY:p.y,...dimensions(n)};activePointer=e.pointerId;svg.setPointerCapture(e.pointerId);return;}
 if(edge){const index=Number(edge.dataset.edgeIndex),connection=data.edges[index];openPorts(connection.from,connection.to,index);return;}
 const id=g.dataset.id;chooseDevice(id);
 if(!connecting){e.preventDefault();const n=data.nodes.find(n=>n.id===id),p=point(e);drag={n,dx:p.x-n.x,dy:p.y-n.y};activePointer=e.pointerId;svg.setPointerCapture(e.pointerId);}
});
svg.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const groupHandle=e.target.closest('[data-group-handle]');if(groupHandle){e.preventDefault();activeGroupId=groupHandle.dataset.groupHandle;render();groupPicker.focus();return;}if(e.target.closest('[data-resize]')){e.preventDefault();widthInput.focus();return;}const edge=e.target.closest('[data-edge-index]'),node=e.target.closest('[data-id]');if(!edge&&!node)return;e.preventDefault();if(edge){const index=Number(edge.dataset.edgeIndex),connection=data.edges[index];openPorts(connection.from,connection.to,index);}else chooseDevice(node.dataset.id);});
svg.addEventListener('pointermove',e=>{
 if(e.pointerId!==activePointer)return;
 if(pan){e.preventDefault();view.x=pan.x-(e.clientX-pan.clientX)*pan.scaleX;view.y=pan.y-(e.clientY-pan.clientY)*pan.scaleY;applyView();return;}
 if(groupDrag){const p=point(e),members=groupDrag.members;const minX=Math.max(...members.map(m=>dimensions(m.node).width/2-m.x)),maxX=Math.min(...members.map(m=>1200-dimensions(m.node).width/2-m.x)),minY=Math.max(...members.map(m=>dimensions(m.node).height/2-m.y)),maxY=Math.min(...members.map(m=>800-dimensions(m.node).height/2-m.y));const dx=Math.max(minX,Math.min(maxX,p.x-groupDrag.x)),dy=Math.max(minY,Math.min(maxY,p.y-groupDrag.y));for(const m of members){m.node.x=m.x+dx;m.node.y=m.y+dy;}dirty=true;render();return;}
 if(resize){const p=point(e);resizeDevice(resize.n,resize.width+2*(p.x-resize.startX),resize.height+2*(p.y-resize.startY));return;}
 if(!drag)return;const p=point(e),size=dimensions(drag.n);drag.n.x=Math.max(size.width/2,Math.min(1200-size.width/2,p.x-drag.dx));drag.n.y=Math.max(size.height/2,Math.min(800-size.height/2,p.y-drag.dy));dirty=true;render();
});
function endGesture(e){if(e.pointerId!==activePointer)return;drag=null;pan=null;resize=null;groupDrag=null;activePointer=null;svg.classList.remove('is-panning');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);}
svg.addEventListener('pointerup',endGesture);svg.addEventListener('pointercancel',endGesture);svg.addEventListener('lostpointercapture',endGesture);
document.querySelector('#add').onclick=()=>{if(data.nodes.length>=300)return;const id=crypto.randomUUID();data.nodes.push({id,color:document.querySelector('#new-device-color').value,label:document.querySelector('#label').value.trim()||'Device',type:document.querySelector('#type').value,x:Math.max(65,Math.min(1135,view.x+view.width/2)),y:Math.max(27,Math.min(773,view.y+view.height/2))});selected=id;dirty=true;render();};
document.querySelector('#connect').onclick=e=>{setPanMode(false);connecting=!connecting;source=null;e.target.textContent=connecting?'Finish connecting':'Connect devices';status.textContent=connecting?'Select the master device, then the slave device.':'Drag devices to position them. Click a connection to edit ports.';render();};
document.querySelector('#remove').onclick=()=>{data.nodes=data.nodes.filter(n=>n.id!==selected);data.edges=data.edges.filter(e=>e.from!==selected&&e.to!==selected);selected=null;source=null;dirty=true;render();};
document.querySelector('#save').onclick=async()=>{status.textContent='Saving…';try{const r=await fetch(`/plans/${svg.dataset.planId}/diagram`,{method:'POST',headers:{'content-type':'application/json','x-csrf-token':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify(data)});if(!r.ok||r.redirected||!(r.headers.get('content-type')||'').includes('application/json'))throw Error();dirty=false;status.textContent='Diagram saved.';}catch{status.textContent='Save failed. Check your connection and sign-in status.';}};
const background=document.querySelector('#background');
function setBackground(){render();}
background.value=data.backgroundUploadId?String(data.backgroundUploadId):'';
background.onchange=()=>{data.backgroundUploadId=background.value?Number(background.value):null;dirty=true;setBackground();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});render();sizeView(true);
