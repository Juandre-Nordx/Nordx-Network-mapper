export const CONNECTION_TYPES=['cable','fibre','wireless','coax','other'];
export function connectionType(edge){return ({cable:'Ethernet cable',fibre:'Fibre',wireless:'Wireless',coax:'Coax',other:'Other'})[edge.connectionType]||'Ethernet cable';}
export function routePoints(edge,a,b){
 const points=[a,...(edge.anchors||[]),b].map(p=>({x:p.x,y:p.y}));
 function trim(node,towards){const dx=towards.x-node.x,dy=towards.y-node.y;const factor=Math.max(Math.abs(dx)/((node.width??130)/2),Math.abs(dy)/((node.height??54)/2));const t=factor?Math.min(.45,1/factor):0;return {x:node.x+dx*t,y:node.y+dy*t};}
 points[0]=trim(a,points[1]);points[points.length-1]=trim(b,points[points.length-2]);return points;
}
export function alongRoute(points,fraction){
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
 let remaining=lengths.reduce((a,b)=>a+b,0)*fraction;
 for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],length=lengths[i]||1,t=remaining/length;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,dx:(b.x-a.x)/length,dy:(b.y-a.y)/length};}remaining-=lengths[i];}
}
export function insertAnchor(edge,a,b,point){
 const points=[a,...(edge.anchors||[]),b];let best=Infinity,index=0;
 for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],dx=q.x-p.x,dy=q.y-p.y;const t=Math.max(0,Math.min(1,((point.x-p.x)*dx+(point.y-p.y)*dy)/(dx*dx+dy*dy||1)));const distance=Math.hypot(point.x-p.x-dx*t,point.y-p.y-dy*t);if(distance<best){best=distance;index=i;}}
 (edge.anchors ||= []).splice(index,0,{x:point.x,y:point.y});
}
