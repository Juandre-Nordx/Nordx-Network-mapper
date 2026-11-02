import {routePoints,alongRoute,connectionType} from '../public/connection-route.js';
import {deviceColor,deviceTextColor} from '../public/device-colors.js';

// Fit the saved content, including device sizes and cabinet headings, to the page.
export function drawPlanDiagram(doc,plan){
 const nodes=plan.diagram.nodes,byId=new Map(nodes.map(n=>[n.id,n]));
 const date=new Date(plan.updated_at);
 const saved=Number.isNaN(date.getTime())?'Not recorded':date.toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'long',year:'numeric'});
 doc.fillColor('#153E35').fontSize(22).text('Nordx Network Mapper',36,30);
 doc.fontSize(12).text(`Company: ${plan.client_name}`,36,60,{width:doc.page.width-72,height:16,ellipsis:true});
 doc.fontSize(11).text(`${plan.site_name} / ${plan.name}`,36,80,{width:doc.page.width-72,height:16,ellipsis:true});
 doc.fontSize(9).text(`Last saved: ${saved} | M = master port; S = slave port`,36,100);
 const anchors=plan.diagram.edges.flatMap(e=>e.anchors||[]);
 const left=Math.min(0,...nodes.map(n=>n.x-(n.width??130)/2-24));
 const top=Math.min(0,...nodes.map(n=>n.y-(n.height??54)/2-52));
 const right=Math.max(300,...anchors.map(p=>p.x+24),...nodes.map(n=>n.x+(n.width??130)/2+24));
 const bottom=Math.max(200,...anchors.map(p=>p.y+24),...nodes.map(n=>n.y+(n.height??54)/2+24));
 const availableWidth=doc.page.width-100,availableHeight=doc.page.height-180;
 const scale=Math.min(availableWidth/(right-left),availableHeight/(bottom-top));
 const pos=n=>[50+(availableWidth-(right-left)*scale)/2+(n.x-left)*scale,140+(availableHeight-(bottom-top)*scale)/2+(n.y-top)*scale];
 for(const group of plan.diagram.groups||[]){
  const members=nodes.filter(n=>n.groupId===group.id);if(!members.length)continue;
  const x=Math.min(...members.map(n=>pos(n)[0]-(n.width??130)*scale/2))-8;
  const y=Math.min(...members.map(n=>pos(n)[1]-(n.height??54)*scale/2))-20;
  const right=Math.max(...members.map(n=>pos(n)[0]+(n.width??130)*scale/2))+8;
  const bottom=Math.max(...members.map(n=>pos(n)[1]+(n.height??54)*scale/2))+8;
  doc.roundedRect(x,y,right-x,bottom-y,5).fillAndStroke('#EFF6E9','#7c998c');
  doc.fillColor('#153E35').fontSize(8).text(group.name,x+4,y+4,{width:right-x-8,height:12,ellipsis:true});
 }
 for(const edge of plan.diagram.edges){
  const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;
  const points=routePoints(edge,a,b);doc.save();if(edge.connectionType==='wireless')doc.dash(6,{space:4});doc.moveTo(...pos(points[0]));for(const p of points.slice(1))doc.lineTo(...pos(p));doc.stroke('#7c998c').restore();
 }
 for(const n of nodes){
  const [x,y]=pos(n),width=(n.width??130)*scale,height=(n.height??54)*scale,color=deviceColor(n,'#C4E9AD');
  doc.roundedRect(x-width/2,y-height/2,width,height,Math.min(5,height/4)).fillAndStroke(color,'#153E35');
  doc.fillColor(deviceTextColor(color)).fontSize(Math.min(9,14*scale)).text(n.label,x-width/2+3,y-height/2+3,{width:Math.max(1,width-6),height:height/2,ellipsis:true});
  doc.fontSize(Math.min(7,11*scale)).text(n.type==='voip'?'VoIP phone':n.type,x-width/2+3,y+2,{width:Math.max(1,width-6),height:height/2-2,ellipsis:true});
 }
 // Draw labels last, with a white backing so lines and cabinet fills cannot hide ports.
 for(const edge of plan.diagram.edges){
  const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;
  const points=routePoints(edge,a,b);
  for(const [port,prefix,fraction] of [[edge.masterPort,'M: ',.16],[connectionType(edge),'',.5],[edge.slavePort,'S: ',.84]]){
   if(!port)continue;
   const point=alongRoute(points,fraction),[px,py]=pos(point);
   doc.fontSize(8);
   const label=prefix+port,width=Math.min(doc.widthOfString(label)+8,190);
   const x=Math.max(38,Math.min(doc.page.width-38-width,px-point.dy*13-width/2));
   const y=Math.max(125,Math.min(doc.page.height-50,py+point.dx*13-6));
   doc.roundedRect(x,y,width,14,3).fill('#ffffff');
   doc.fillColor('#153E35').text(label,x+4,y+2,{width:width-8,height:10,align:'center',ellipsis:true});
  }
 }
 return byId;
}
