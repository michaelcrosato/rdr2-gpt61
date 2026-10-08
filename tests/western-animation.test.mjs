import test from 'node:test';
import assert from 'node:assert/strict';
import { localFromScreen, jointScreen, sampleTrack, solveLimb, createWesternAnimator, savePose } from '../src/western-animation.js';
const view = { ax: 1.5, ay: 0, by: .75, bz: -.774, p(x,y,z) { return [1.5*x,.75*y-.774*z]; }, toGround(x,y) { return [x/1.5,y/.75]; } };
function rig(facing=0,size=1.7) {
 return { facing, spin: 0, _cheat: 0, sq: .08, o: {size,armUpper:5.5,armLower:5.4,legUpper:7.4,legLower:7.4,cheat:.5}, J:{shR:[0,3.5,24],handR:[1,4,16],bladeDir:[1,0,0]}, _w(p) { const c=Math.cos(this.facing+this._cheat),s=Math.sin(this.facing+this._cheat),k=(1-this.sq*.4)*this.o.size;return[(p[0]*c-p[1]*s)*k,(p[0]*s+p[1]*c)*k,p[2]*(1+this.sq)*this.o.size]; } };
}
test('screen sockets invert the character projection at eight facings and three cast sizes',()=>{
 for(const size of [1.57,1.7,1.83]) for(let i=0;i<8;i++){
  const r=rig(i*Math.PI/4,size),root=[174,270],p=[182,238],local=localFromScreen(r,view,root,p,31);
  const hit=jointScreen(r,view,root,local);assert.ok(Math.hypot(hit[0]-p[0],hit[1]-p[1])<1e-8);assert.ok(local.every(Number.isFinite));
 }
});
test('limb adapter uses reachable IK result instead of the requested out-of-reach endpoint',()=>{
 const r=rig(),out=solveLimb({ik3(a,b,l1,l2){const d=b.map((n,i)=>n-a[i]),len=Math.hypot(...d),k=Math.min(1,(l1+l2-.01)/len);const end=a.map((n,i)=>n+d[i]*k);return[a.map((n,i)=>(n+end[i])/2),end]}},r,'R',[100,100,100]);
 assert.ok(Math.hypot(...out.map((n,i)=>n-r.J.shR[i]))<r.o.armUpper+r.o.armLower);assert.deepEqual(r.J.handR,out);assert.ok(r.J.elbowR.every(Number.isFinite));
});
test('timeline holds contact, clamps endpoints and restores original rig transforms',()=>{
 assert.equal(sampleTrack([[0,0],[.3,1],[.7,1],[1,0]],.5),1);assert.equal(sampleTrack([[0,0],[1,1]],2),1);
 const r=rig();const original=r.J.handR.slice(),restore=savePose(r);r.J.handR=[99,0,0];r._cheat=.8;r.o.cheat=0;restore();assert.deepEqual(r.J.handR,original);assert.equal(r._cheat,0);assert.equal(r.o.cheat,.5);
});
test('first accepted action and first post-retry action animate without persisted events',()=>{
 const a=createWesternAnimator({}),s={player:{}};
 a.update(0,s,{generation:1,seq:1,events:[{seq:1,kind:'coat',actorId:'mara',targetId:'coat'}]});assert.equal(a.clip('mara').kind,'coat');
 a.update(.1,s,{generation:2,seq:1,events:[{seq:1,kind:'pickup',actorId:'mara',targetId:'oil'}]});assert.equal(a.clip('mara').kind,'pickup:oil');assert.equal(a.clip('mara').age,0);
 a.update(.1,{player:{}},{generation:3,seq:0,events:[]});assert.equal(a.clip('mara'),undefined);
});
test('simultaneous Pavel drop/disarm stay separate and Voss restraint targets Voss',()=>{
 const a=createWesternAnimator({}),s={player:{}};
 a.update(0,s,{generation:1,seq:2,events:[{seq:1,kind:'pavel-drop',actorId:'pavel',targetId:'pavel'},{seq:2,kind:'disarm',actorId:'mara',targetId:'pavel'}]});assert.equal(a.clip('pavel').kind,'pavel-drop');assert.equal(a.clip('mara').kind,'disarm');
 a.update(0,s,{generation:2,seq:1,events:[{seq:1,kind:'restrain',actorId:'mara',targetId:'voss'}]});assert.equal(a.clip('voss').kind,'restrain');assert.equal(a.clip('pavel'),undefined);
});
test('a shared melee timeline advances once and expires for both participants',()=>{
 const a=createWesternAnimator({}),s={player:{}},stream={generation:1,seq:1,events:[{seq:1,kind:'shove',actorId:'mara',targetId:'pavel'}]};
 a.update(0,s,stream);a.update(.15,s,stream);assert.equal(a.clip('mara').age,.15);assert.equal(a.clip('pavel').age,.15);
 a.update(.4,s,stream);assert.equal(a.clip('mara'),undefined);assert.equal(a.clip('pavel'),undefined);
});
