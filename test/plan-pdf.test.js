import {test} from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import {drawPlanDiagram} from '../src/plan-pdf.js';

test('PDF diagram fits a large plan and prints company, saved date and both port labels on its first page',()=>{
 const doc=new PDFDocument({layout:'landscape',size:'A4',margin:36});
 doc.resume();
 let page=1;doc.on('pageAdded',()=>page++);
 const texts=[],rectangles=[],text=doc.text.bind(doc),roundedRect=doc.roundedRect.bind(doc);
 doc.text=(value,x,y,options)=>{texts.push({value,x,y,page});return text(value,x,y,options);};
 doc.roundedRect=(x,y,width,height,radius)=>{rectangles.push({x,y,width,height});return roundedRect(x,y,width,height,radius);};
 drawPlanDiagram(doc,{client_name:'Example Company',site_name:'Head office',name:'Network',updated_at:'2026-11-01T23:00:00Z',diagram:{
  groups:[{id:'rack',name:'Main rack'}],
  nodes:[{id:'a',label:'Router',type:'router',x:0,y:0,groupId:'rack'},{id:'b',label:'Switch',type:'switch',x:2400,y:1600,width:360,height:240}],
  edges:[{from:'a',to:'b',masterPort:'Gi0/1',slavePort:'ether2',connectionType:'fibre',anchors:[{x:2200,y:0},{x:2200,y:1400}]}]
 }});
 assert.ok(texts.some(t=>t.value==='Company: Example Company'&&t.page===1));
 assert.ok(texts.some(t=>t.value.includes('Last saved: 02 November 2026')));
 for(const label of ['M: Gi0/1','S: ether2','Fibre']){
  const item=texts.find(t=>t.value===label);assert.ok(item,label);assert.equal(item.page,1);assert.ok(item.y>=125&&item.y<doc.page.height-36);
 }
 for(const r of rectangles){assert.ok(r.x>=36&&r.y>=120);assert.ok(r.x+r.width<=doc.page.width-36);assert.ok(r.y+r.height<=doc.page.height-36);}
 assert.equal(page,1);doc.end();
});
