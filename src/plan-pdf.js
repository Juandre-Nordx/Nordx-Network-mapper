import {routePoints,alongRoute,connectionType} from '../public/connection-route.js';
import {deviceColor,deviceTextColor} from '../public/device-colors.js';

function reportHeader(doc,plan,section){
 const width=doc.page.width-72;
 doc.rect(36,28,width,25).fill('#153E35');
 doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('NORDX  /  NETWORK MAPPER',46,36,{lineBreak:false});
 doc.font('Helvetica').fontSize(8).text('NETWORK & CCTV DOCUMENTATION',36,37,{width:width-10,align:'right',lineBreak:false});
 doc.fillColor('#153E35').font('Helvetica-Bold').fontSize(18).text(plan.name,36,63,{width:width*.65,height:23,ellipsis:true});
 doc.font('Helvetica').fontSize(10).text(`Company: ${plan.client_name}`,36,89,{width:width*.65,height:14,ellipsis:true});
 doc.fontSize(9).fillColor('#577066').text(`Site: ${plan.site_name}`,36,105,{width:width*.65,height:13,ellipsis:true});
 const date=new Date(plan.updated_at);
 const saved=Number.isNaN(date.getTime())?'Not recorded':date.toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'long',year:'numeric'});
 doc.fontSize(8).text(`Last saved: ${saved}`,36,72,{width,align:'right',lineBreak:false});
 doc.fontSize(8).text(`${plan.diagram.nodes.length} devices  /  ${plan.diagram.edges.length} connections`,36,89,{width,align:'right',lineBreak:false});
 doc.font('Helvetica-Bold').fontSize(9).fillColor('#153E35').text(section.toUpperCase(),36,120,{lineBreak:false});
 doc.font('Helvetica');
}

function reportTable(doc,plan,title,headings,rows,fractions){
 const width=doc.page.width-72,widths=fractions.map(f=>f*width);
 let y=0;
 function newPage(){
  doc.addPage();reportHeader(doc,plan,title);y=140;
  doc.rect(36,y,width,24).fill('#153E35');let x=36;
  headings.forEach((heading,i)=>{doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff').text(heading,x+8,y+8,{width:widths[i]-16,lineBreak:false});x+=widths[i];});
  doc.font('Helvetica');y+=24;
 }
 newPage();
 rows.forEach((row,index)=>{
  doc.font('Helvetica').fontSize(9);
  const height=Math.max(30,...row.map((value,i)=>doc.heightOfString(String(value),{width:widths[i]-16})+16));
  if(y+height>doc.page.height-64)newPage();
  doc.rect(36,y,width,height).fill(index%2?'#ffffff':'#f1f5ef');
  let x=36;
  row.forEach((value,i)=>{doc.font('Helvetica').fontSize(9).fillColor('#153E35').text(String(value),x+8,y+8,{width:widths[i]-16,height:height-12});x+=widths[i];});
  y+=height;doc.moveTo(36,y).lineTo(36+width,y).lineWidth(.4).stroke('#dfe5db');
 });
}

export function drawPlanReport(doc,plan){
 const byId=drawPlanDiagram(doc,plan);
 if(!plan.diagram.nodes.length)doc.fontSize(12).fillColor('#577066').text('No devices added to this plan yet.',60,240,{width:doc.page.width-120,align:'center'});
 if(plan.diagram.edges.length){
  const rows=plan.diagram.edges.map((e,i)=>[String(i+1),connectionType(e),`${byId.get(e.from)?.label||'Unknown'}\nPort: ${e.masterPort||'Unspecified'}`,`${byId.get(e.to)?.label||'Unknown'}\nPort: ${e.slavePort||'Unspecified'}`]);
  reportTable(doc,plan,'Connection schedule',['#','CONNECTION TYPE','MASTER DEVICE / PORT','SLAVE DEVICE / PORT'],rows,[.06,.18,.38,.38]);
 }
 if(plan.diagram.groups?.length){
  const rows=plan.diagram.groups.flatMap(group=>{
   const members=plan.diagram.nodes.filter(n=>n.groupId===group.id);
   return members.length?members.map(n=>[group.name,n.label,n.type==='voip'?'VoIP phone':n.type]):[[group.name,'No devices assigned','—']];
  });
  reportTable(doc,plan,'Cabinets and device groups',['CABINET / GROUP','DEVICE','DEVICE TYPE'],rows,[.34,.44,.22]);
 }
 const range=doc.bufferedPageRange();
 for(let i=range.start;i<range.start+range.count;i++){
  doc.switchToPage(i);const y=doc.page.height-48,width=doc.page.width-72;
  doc.moveTo(36,y-8).lineTo(doc.page.width-36,y-8).lineWidth(.5).stroke('#dfe5db');
  doc.font('Helvetica').fontSize(7).fillColor('#577066').text(i===0?'M = master port  /  S = slave port  /  Dashed line = wireless':'Nordx Network Mapper | Connection and equipment documentation',36,y,{width:width-90,height:10,lineBreak:false});
  doc.text(`Page ${i-range.start+1} of ${range.count}`,36,y,{width,align:'right',lineBreak:false});
 }
}

// Fit the saved content, including device sizes and cabinet headings, to the page.
export function drawPlanDiagram(doc,plan){
 const nodes=plan.diagram.nodes,byId=new Map(nodes.map(n=>[n.id,n]));
 reportHeader(doc,plan,'Network diagram');
 const anchors=plan.diagram.edges.flatMap(e=>e.anchors||[]);
 const left=Math.min(0,...nodes.map(n=>n.x-(n.width??130)/2-24));
 const top=Math.min(0,...nodes.map(n=>n.y-(n.height??54)/2-52));
 const right=Math.max(300,...anchors.map(p=>p.x+24),...nodes.map(n=>n.x+(n.width??130)/2+24));
 const bottom=Math.max(200,...anchors.map(p=>p.y+24),...nodes.map(n=>n.y+(n.height??54)/2+24));
 const availableWidth=doc.page.width-100,availableHeight=doc.page.height-180;
 doc.rect(36,132,doc.page.width-72,doc.page.height-184).lineWidth(.5).stroke('#dfe5db');
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
  doc.lineWidth(.7).roundedRect(x-width/2,y-height/2,width,height,Math.min(5,height/4)).fillAndStroke(color,'#153E35');
  doc.fillColor(deviceTextColor(color)).fontSize(Math.min(9,14*scale)).text(n.label,x-width/2+3,y-height/2+3,{width:Math.max(1,width-6),height:height/2,ellipsis:true});
  doc.fontSize(Math.min(7,11*scale)).text(n.type==='voip'?'VoIP phone':n.type,x-width/2+3,y+2,{width:Math.max(1,width-6),height:height/2-2,ellipsis:true});
 }
 // Keep labels proportional to the fitted network instead of fixed-size badges.
 const labelFontSize=Math.max(4.5,Math.min(6,11*scale));
 const labelHeight=labelFontSize+3,padding=2;
 const labelOffset=Math.max(5,Math.min(8,16*scale));
 // The connection schedule retains full port names when a diagram label is shortened.
 for(const edge of plan.diagram.edges){
  const a=byId.get(edge.from),b=byId.get(edge.to);if(!a||!b)continue;
  const points=routePoints(edge,a,b);
  for(const [port,prefix,fraction] of [[edge.masterPort,'M: ',.16],[connectionType(edge),'',.5],[edge.slavePort,'S: ',.84]]){
   if(!port)continue;
   const point=alongRoute(points,fraction),[px,py]=pos(point);
   doc.fontSize(labelFontSize);
   const label=prefix+port,width=Math.min(doc.widthOfString(label)+padding*2,Math.max(44,Math.min(90,160*scale)));
   const x=Math.max(38,Math.min(doc.page.width-38-width,px-point.dy*labelOffset-width/2));
   const y=Math.max(125,Math.min(doc.page.height-50,py+point.dx*labelOffset-labelHeight/2));
   doc.roundedRect(x,y,width,labelHeight,2).fill('#ffffff');
   doc.fillColor('#153E35').text(label,x+padding,y+1,{width:width-padding*2,height:labelHeight-1,lineBreak:false,align:'center',ellipsis:true});
  }
 }
 return byId;
}
