/** Headless harness smoke: real native geometry/physics, stubbed canvas shell.
 * This does not replace the queued browser/visual check. */
import test from 'node:test';import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
const E=globalThis.My3D2dge,NativeGame=E.Game;
globalThis.window=globalThis;globalThis.document={getElementById:()=>({textContent:''})};
E.Game=class{constructor(){this.cam={};this.errors=[];this.view=E.VIEWS.threequarter;}focus(){}start(scene){this.scene=scene;}};
try{await import('../../fixtures/train-native.js');}finally{E.Game=NativeGame;}
const context=()=>new Proxy({globalAlpha:1,globalCompositeOperation:'source-over',measureText:s=>({width:s.length*5})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
function draw(){const view=E.VIEWS.threequarter,pending=[],r={view,w:(...p)=>view.p(...p),visible:()=>true,queue:(x,y,z,fn,o)=>pending.push({k:view.order(x,y,z)+(o?.bias||0),fn})};probe.game.scene.update();const before=JSON.stringify(probe.scene);probe.game.scene.draw(r);pending.sort((a,b)=>a.k-b.k);const g=context();for(const p of pending)p.fn(g);assert.equal(JSON.stringify(probe.scene),before);return probe.inspect();}
for(const name of['overview','brake','regulator','whistle','entry','roof','papers','cast','mounted','gangway','charge'])test('prepared '+name+' fixture uses coherent native motion/contacts and identical normal/reduced physics',()=>{
 let normal;
 for(const reduced of[false,true]){probe.setup(name,reduced);probe.frame(.55);const snap=draw(),ids=snap.actors.map(a=>a.id);assert.equal(new Set(ids).size,ids.length);for(const id of probe.expected)assert.equal(ids.filter(i=>i===id).length,1);assert.ok(snap.contacts.every(c=>c.reachable&&c.errorFinite&&c.error<=1e-5),JSON.stringify(snap.errors));assert.deepEqual(snap.errors,[]);const physics=JSON.stringify(probe.physics());if(reduced)assert.equal(physics,normal);else normal=physics;if(name==='gangway')assert.equal(probe.scene.actors[0].support.carId,'morrow-tool-wagon');assert.ok(probe.scene.consist.cursor>probe.seedCursor);}
});
