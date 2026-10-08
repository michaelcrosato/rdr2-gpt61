import test from 'node:test';
import assert from 'node:assert/strict';
import '../my-3d2dge-agent.js';
import { createExpeditionAnimator, fitContactRoot, seatPose } from '../src/expedition-animation.js';
import { createExpeditionHuman } from '../src/expedition-cast.js';
import { expeditionResidence } from '../src/expedition-actors.js';
import { jointScreen, localFromScreen } from '../src/western-animation.js';
import { NORTH_CUTTING_WORLD } from '../content/campaign/north-cutting.js';

const view={ax:1.5,ay:0,by:.75,bz:-.774,p(x,y,z){return[1.5*x,.75*y-.774*z];},toGround(x,y){return[x/1.5,y/.75];}};
function rig(facing=0,size=1.7){return{facing,spin:0,_cheat:0,sq:0,o:{size,armUpper:5.5,armLower:5.4},J:{shR:[0,3.5,24]},_w(p){const c=Math.cos(this.facing),s=Math.sin(this.facing);return[(p[0]*c-p[1]*s)*this.o.size,(p[0]*s+p[1]*c)*this.o.size,p[2]*this.o.size];}};}
test('northern contacts fit within arm reach at adult and child sizes in eight directions',()=>{
  for(const size of[1.2,1.58,1.7,1.93])for(let i=0;i<8;i++){
    const r=rig(i*Math.PI/4,size),root=[100,150],socket=[185,80],height=31,at=fitContactRoot(r,view,root,socket,'R',height),local=localFromScreen(r,view,at,socket,height);
    assert.ok(at.every(Number.isFinite));assert.ok(Math.hypot(...local.map((n,k)=>n-r.J.shR[k]))<r.o.armUpper+r.o.armLower);
    const projected=jointScreen(r,view,at,local);assert.ok(Math.hypot(projected[0]-socket[0],projected[1]-socket[1])<1e-8);
  }
});
test('carry and receiver share one elapsed timeline, including a first action after region reset',()=>{
  const a=createExpeditionAnimator({}),s={},handoff={seq:1,kind:'handoff',actorId:'inez',targetId:'silas',sourceId:'mara'},stream={generation:1,events:[handoff]};
  a.update(0,s,stream);a.update(.2,s,stream);assert.equal(a.clip('inez'),a.clip('silas'));assert.equal(a.clip('silas').age,.2);assert.equal(a.clip('silas').sourceId,'mara');
  a.update(0,s,{generation:2,events:[{seq:1,kind:'unload',actorId:'mara',targetId:'silas',sourceId:'thimble'}]});assert.equal(a.clip('inez'),undefined);assert.equal(a.clip('mara').age,0);assert.equal(a.clip('silas').sourceId,'thimble');
  a.update(2,s,{generation:2,events:[]});assert.equal(a.clip('mara'),undefined);assert.equal(a.clip('silas'),undefined);
});
test('native driver and injured passenger feet meet their separate stirrups in eight directions',()=>{
  const E=globalThis.My3D2dge,cv=E.charView(E.VIEWS.threequarter);
  for(const id of['mara','inez','silas'])for(let i=0;i<8;i++){
    const h=createExpeditionHuman(E,id),rig=h.rig;rig.facing=i*Math.PI/4;const f=Math.cos(rig.facing)<0?-1:1;
    const sockets={flip:f,saddle:[200,256],stirrupL:[200-7*f,275],stirrupR:[200+8*f,274],reins:[200+18*f,251]},root=seatPose(E,rig,cv,[200,300],sockets,1,id==='silas');
    for(const side of['L','R']){const hit=jointScreen(rig,cv,root,'foot'+side),target=sockets['stirrup'+side];assert.ok(Math.hypot(hit[0]-target[0],hit[1]-target[1])<1e-6);}
    assert.ok(Object.values(rig.J).flat().every(Number.isFinite));
  }
});
test('native climbing keeps the collision-root projection fixed and restores the base skin',()=>{
  const E=globalThis.My3D2dge,worldView=E.VIEWS.threequarter,anim=createExpeditionAnimator(E),rig=createExpeditionHuman(E,'mara').rig;
  for(const progress of[.1,.35,.65,.9]){
    const from={x:1540,y:590,z:0},to={x:1590,y:525,z:36},u=progress*progress*(3-2*progress),body={id:'mara',traversal:{kind:'climb',from,to,progress},x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u,z:36*u};rig.update(0,body);
    const original=rig.J.handR.slice(),root=worldView.p(body.x,body.y,body.z),pose=anim.apply(body,rig,root,worldView,{project:(x,y,z)=>worldView.p(x,y,z)});assert.deepEqual(pose.root,root);assert.ok(Object.values(rig.J).flat().every(Number.isFinite));pose.restore();assert.deepEqual(rig.J.handR,original);
  }
});
test('both native rescuers reach the next stone grip at the midpoint of every authored ascent',()=>{
  const E=globalThis.My3D2dge,v=E.VIEWS.threequarter,cv=E.charView(v),anim=createExpeditionAnimator(E);
  for(const id of['mara','inez'])for(const edge of NORTH_CUTTING_WORLD.climbs){
    const body={id,x:(edge.from.x+edge.to.x)/2,y:(edge.from.y+edge.to.y)/2,z:(edge.from.z+edge.to.z)/2,facing:Math.atan2(edge.to.y-edge.from.y,edge.to.x-edge.from.x),traversal:{...edge,kind:'climb',progress:.5}},rig=createExpeditionHuman(E,id).rig;rig.update(0,body);
    const root=v.p(body.x,body.y,body.z),pose=anim.apply(body,rig,root,v,{project:(x,y,z)=>v.p(x,y,z)});assert.deepEqual(pose.root,root);
    for(const contact of pose.diagnostics.filter(d=>d.side==='L'||d.side==='R')){assert.ok(contact.error<1e-6,`${id} ${edge.id} ${contact.side}: ${contact.error}`);assert.deepEqual(contact.hit,jointScreen(rig,cv,root,'hand'+contact.side));}
    assert.equal(pose.diagnostics.filter(d=>d.side==='L'||d.side==='R').length,2);pose.restore();
  }
});
test('resting and passenger patients render in their attached region, with cycles rejected',()=>{
  const all={silas:{id:'silas',regionId:null,attachment:{type:'rest',targetId:'silas-bed',regionId:'snowbound'}},thimble:{id:'thimble',regionId:'north-cutting'}};
  assert.equal(expeditionResidence(all.silas,all,'north-cutting'),'snowbound');
  all.silas.attachment={type:'passenger',targetId:'thimble'};assert.equal(expeditionResidence(all.silas,all,'snowbound'),'north-cutting');
  all.thimble.attachment={type:'carried',targetId:'silas'};assert.equal(expeditionResidence(all.silas,all,'snowbound'),null);
});
test('rapid accepted strap and care gestures wait for their patient placement clip',()=>{
  const a=createExpeditionAnimator({}),s={},events=[{seq:1,kind:'load',actorId:'inez',targetId:'silas'},{seq:2,kind:'strap',actorId:'inez',targetId:'silas'}],stream={generation:1,events};a.update(0,s,stream);assert.equal(a.clip('inez').age,-1.8);a.update(.3,s,stream);assert.equal(a.clip('silas').age,.3);assert.equal(a.clip('inez').age,-1.5);a.update(1.5,s,stream);assert.equal(a.clip('silas'),undefined);assert.equal(a.clip('inez').age,0);
  a.update(0,s,{generation:2,events:[{seq:1,kind:'setdown',actorId:'moss',targetId:'silas'},{seq:2,kind:'care',actorId:'elin',targetId:'silas'}]});assert.equal(a.clip('elin').age,-1.3);
});
test('an accepted auto-mount follows the delayed passenger strap without replacing it',()=>{
  const a=createExpeditionAnimator({}),s={},events=[{seq:1,kind:'load',actorId:'inez',targetId:'silas'},{seq:2,kind:'strap',actorId:'inez',targetId:'silas'}],stream={generation:1,events};
  a.update(0,s,stream);a.update(.95,s,stream);events.push({seq:3,kind:'mount',actorId:'inez',targetId:'thimble'});a.update(0,s,stream);
  assert.equal(a.clip('inez').kind,'strap');assert.equal(a.clip('silas').kind,'load');assert.equal(a.clip('inez').next.kind,'mount');
  a.update(.85,s,stream);assert.equal(a.clip('silas'),undefined);assert.equal(a.clip('inez').kind,'strap');assert.ok(Math.abs(a.clip('inez').age)<1e-8);
  a.update(1.3,s,stream);assert.equal(a.clip('inez').kind,'mount');assert.ok(Math.abs(a.clip('inez').age-.1)<1e-8);a.update(1,s,stream);assert.equal(a.clip('inez'),undefined);
});
test('native mount starts at the accepted approach and dismount ends at the accepted safe ground',()=>{
  const E=globalThis.My3D2dge,worldView=E.VIEWS.threequarter,cv=E.charView(worldView),s={},r=createExpeditionHuman(E,'mara').rig,anim=createExpeditionAnimator(E),project=(x,y,z)=>worldView.p(x,y,z),saddle=project(1460,620,0),sockets={flip:1,saddle:[saddle[0]+1,saddle[1]-44],stirrupL:[saddle[0]-7,saddle[1]-27],stirrupR:[saddle[0]+8,saddle[1]-28],reins:[saddle[0]+18,saddle[1]-48]};
  const from={x:1434,y:620,z:0},body={id:'mara',x:1460,y:620,z:0,mounted:true};r.update(0,body);const original=r.J.footR.slice();anim.update(0,s,{generation:1,events:[{seq:1,kind:'mount',actorId:'mara',targetId:'copper',from,target:{x:1460,y:620,z:0}}]});
  let pose=anim.apply(body,r,project(body.x,body.y,body.z),worldView,{project,sockets});assert.deepEqual(pose.root,project(from.x,from.y,0));pose.restore();assert.deepEqual(r.J.footR,original);
  const landing={x:1494,y:620,z:0};Object.assign(body,landing,{mounted:false});r.update(0,body);anim.update(0,s,{generation:2,events:[{seq:1,kind:'dismount',actorId:'mara',targetId:'copper',from:{x:1460,y:620,z:23},target:landing}]});anim.update(.94,s,{generation:2,events:[]});
  pose=anim.apply(body,r,project(body.x,body.y,body.z),worldView,{project,sockets});assert.ok(Math.hypot(...pose.root.map((n,k)=>n-project(landing.x,landing.y,0)[k]))<.1);assert.ok(Object.values(r.J).flat().every(Number.isFinite));pose.restore();
});
