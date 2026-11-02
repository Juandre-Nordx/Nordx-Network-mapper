import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deviceColor,deviceTextColor} from '../public/device-colors.js';
test('device colours preserve legacy defaults and choose readable text on network fills',()=>{
 assert.equal(deviceColor({}),'#ffffff');assert.equal(deviceColor({},'#C4E9AD'),'#C4E9AD');assert.equal(deviceColor({color:'#2563EB'}),'#2563eb');assert.equal(deviceColor({color:'url(example)'}),'#ffffff');
 assert.equal(deviceTextColor('#000000'),'#ffffff');assert.equal(deviceTextColor('#ffffff'),'#000000');assert.equal(deviceTextColor('#2563eb'),'#ffffff');assert.equal(deviceTextColor('#ffff00'),'#000000');
});
