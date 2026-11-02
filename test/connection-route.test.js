import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routePoints,alongRoute,insertAnchor,connectionType} from '../public/connection-route.js';

test('routes attach to device boundaries and insert anchors into the closest segment',()=>{
 const a={x:100,y:100},b={x:700,y:500},edge={anchors:[{x:400,y:100},{x:400,y:500}]};
 const points=routePoints(edge,a,b);
 assert.deepEqual(points[0],{x:165,y:100});assert.deepEqual(points.at(-1),{x:635,y:500});
 assert.deepEqual(points.slice(1,-1),edge.anchors);
 insertAnchor(edge,a,b,{x:420,y:300});assert.deepEqual(edge.anchors,[{x:400,y:100},{x:420,y:300},{x:400,y:500}]);
 const middle=alongRoute([{x:0,y:0},{x:100,y:0},{x:100,y:300}],.5);
 assert.deepEqual(middle,{x:100,y:100,dx:0,dy:1});
 assert.equal(connectionType({}),'Ethernet cable');assert.equal(connectionType({connectionType:'fibre'}),'Fibre');
 assert.ok(Number.isFinite(alongRoute([{x:0,y:0},{x:0,y:0}],.5).x));
});
