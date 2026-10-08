import test from 'node:test';
import assert from 'node:assert/strict';
import '../my-3d2dge-agent.js';
import { HUNT_ANIMALS, huntAnimalHitZones, WILLOW_RUN_WORLD, huntBowGiftStance } from '../content/campaign/willow-run.js';
import { WillowAnimalRig, createWillowHuman, deerPoseJoints, animalLocalPoint, poseWillowBow, fitWillowBowShoulder } from '../src/willow-run-rigs.js';
import { jointScreen } from '../src/western-animation.js';
import { createHuntAnimator, prepareHuntHuman } from '../src/willow-run-animation.js';
import { lowerTorso } from '../src/expedition-animation.js';
import { willowResidence } from '../src/willow-run-actors.js';
const E=globalThis.My3D2dge;

test('physical deer zones and native joints agree in every pose, facing and ground height',()=>{
  for(const sample of HUNT_ANIMALS.filter(a=>a.kind==='deer'))for(const pose of['drink','browse','head-up'])for(let i=0;i<8;i++){
    const body={...sample,x:123,y:456,z:18,facing:i*Math.PI/4,hunt:{pose}},J=deerPoseJoints(body),zones=huntAnimalHitZones(body);
    for(const [joint,id]of[['body','body'],['chest','vital'],['neck','neck'],['head','head']]){const actual=animalLocalPoint(body,J[joint]),target=zones.find(z=>z.id===id);assert.ok(Math.hypot(actual[0]-target.x,actual[1]-target.y,actual[2]-target.z)<1e-8);}
    assert.ok(zones.every(z=>Number.isFinite(z.x+z.y+z.z)&&z.rx>0&&z.ry>0&&z.height>0));
  }
});
test('native quadruped gait keeps finite two-bone limbs across death, fear and speeds',()=>{
  for(const kind of['deer','horse','bear'])for(const speed of[0,25,120])for(const hp of[100,0]){
    const rig=new WillowAnimalRig(E,kind,kind),body={id:kind,kind,hp,dead:hp===0,facing:2.1,fear:90,phase:'drink',vx:speed,vy:10};rig.update(.25,body);assert.ok(Object.values(rig.J).flat().every(Number.isFinite));
    if(hp>0)for(let i=0;i<4;i++){const a=rig.J['hip'+i],b=rig.J['knee'+i],c=rig.J['foot'+i],length=kind==='horse'?16:kind==='bear'?12:10;assert.ok(Math.abs(Math.hypot(...b.map((n,k)=>n-a[k]))-length)<1e-6);assert.ok(Math.abs(Math.hypot(...c.map((n,k)=>n-b[k]))-length)<1e-6);}
  }
});
test('settled carcasses lie on one flank and collapse reaches that exact endpoint',()=>{
  const sample=HUNT_ANIMALS.find(a=>a.kind==='deer');for(let i=0;i<8;i++){
    const rig=new WillowAnimalRig(E,sample.id,'deer'),body={...sample,hp:0,dead:true,facing:i*Math.PI/4};const end=JSON.parse(JSON.stringify(rig.pose(body)));assert.equal(end.body[2],7);assert.equal(end.head[2],4);for(let k=0;k<4;k++){assert.equal(end['foot'+k][2],1);assert.equal(end['foot'+k][1],23);}
    assert.deepEqual(rig.pose({...body,presentationFall:1}),end);const start=rig.pose({...body,presentationFall:0});assert.equal(start.body[2],19);for(const t of[.2,.5,.8])assert.ok(Object.values(rig.pose({...body,presentationFall:t})).flat().every(Number.isFinite));
  }
});
test('full native bow draw moves the string hand away while both hands stay within arm reach',()=>{
  const h=createWillowHuman(E,'mara'),r=h.rig;for(const pitch of[-.5,0,.5]){
    r.update(0,{x:0,y:0,z:0,facing:1.3});const relaxed=poseWillowBow(E,r,0,pitch),full=poseWillowBow(E,r,1,pitch);assert.ok(full.nock[0]<relaxed.nock[0]-3);
    for(const side of['L','R']){const d=r.J['hand'+side].map((n,k)=>n-r.J['sh'+side][k]);assert.ok(Math.hypot(...d)<r.o.armUpper+r.o.armLower);}
    assert.ok(Object.values(r.J).flat().every(Number.isFinite));assert.ok(full.top[2]>full.grip[2]&&full.bottom[2]<full.grip[2]);
  }
});
test('accepted cargo shares one elapsed clip and a first reset event survives',()=>{
  const a=createHuntAnimator(),s={},stream={generation:1,events:[{seq:1,kind:'load',actorId:'juno',targetId:'willow-cedar-buck',sourceId:'juno'}]};a.update(0,s,stream);a.update(.2,s,stream);assert.equal(a.clip('juno'),a.clip('willow-cedar-buck'));assert.equal(a.clip('juno').age,.2);
  a.update(0,s,{generation:2,events:[{seq:1,kind:'unload',actorId:'mara',targetId:'willow-creek-doe',sourceId:'copper'}]});assert.equal(a.clip('juno'),undefined);assert.equal(a.clip('mara').age,0);assert.equal(a.clip('mara').sourceId,'copper');
});
test('a mounting follow-up is assigned only to the carrier after the shared load finishes',()=>{
  const a=createHuntAnimator(),s={},load={seq:1,kind:'load',actorId:'juno',targetId:'buck'},mount={seq:2,kind:'mount',actorId:'juno',targetId:'bracken'};a.update(0,s,{generation:1,events:[load]});a.update(.2,s,{generation:1,events:[load,mount]});a.update(1.5,s,{generation:1,events:[load,mount]});assert.equal(a.clip('juno').kind,'mount');assert.ok(Math.abs(a.clip('juno').age-.05)<1e-8);assert.equal(a.clip('buck'),undefined);
});
test('native bow meets the physical standing release origin at eight headings without moving feet',()=>{
  const v=E.VIEWS.threequarter,cv=E.charView(v);for(let i=0;i<8;i++){
    const facing=i*Math.PI/4,r=createWillowHuman(E,'mara').rig;r.update(0,{facing,x:0,y:0,z:0});const feet=[r.J.footL.slice(),r.J.footR.slice()],source=v.p(Math.cos(facing)*14,Math.sin(facing)*14,32),local=fitWillowBowShoulder(E,r,v,[0,0],source),b=poseWillowBow(E,r,1,0,0,local),hit=jointScreen(r,cv,[0,0],b.grip);
    assert.ok(Math.hypot(hit[0]-source[0],hit[1]-source[1])<1e-6);assert.deepEqual([r.J.footL,r.J.footR],feet);assert.ok(Object.values(r.J).flat().every(Number.isFinite));
  }
});
test('resting carcasses and rear loads have one region through their exclusive attachment',()=>{
  const all={doe:{id:'doe',regionId:null,attachment:{type:'large-load',targetId:'bracken'}},bracken:{id:'bracken',regionId:'willow-run'}};assert.equal(willowResidence(all.doe,all,'snowbound'),'willow-run');all.doe.attachment={type:'rest',targetId:'hunt-bench-mara'};assert.equal(willowResidence(all.doe,all,'willow-run'),'snowbound');
  all.doe.attachment={type:'carried',targetId:'bracken'};all.bracken.attachment={type:'carried',targetId:'doe'};assert.equal(willowResidence(all.doe,all,'snowbound'),null);
});
test('native bench cutting reaches the actual surface while both feet stay on their authored workpoint',()=>{
  const v=E.VIEWS.threequarter,cv=E.charView(v),camp=WILLOW_RUN_WORLD.camp;
  for(const id of['mara','orla'])for(const progress of[0,.25,.5,.75,1]){
    const bench=id==='mara'?camp.benchMara:camp.benchJuno,position=camp.workpoints[id],body={id,...position,facing:-Math.PI/2},rig=createWillowHuman(E,id).rig;rig.update(0,body);const root=v.p(body.x,body.y,0),feet=['L','R'].map(side=>jointScreen(rig,cv,root,'foot'+side)),a=prepareHuntHuman(E,body,rig,root,v);a.preserveFeet=true;lowerTorso(E,rig,1.5,2);const forward=-12+progress*33,left=v.p(bench.x+forward-4,bench.y-6,bench.z+12),right=v.p(bench.x+forward,bench.y-6,bench.z+9);a.pair(left,right,33,1,'skinning-contact');
    assert.deepEqual(a.root,root);for(const [i,side]of['L','R'].entries()){const at=jointScreen(rig,cv,a.root,'foot'+side);assert.ok(Math.hypot(at[0]-feet[i][0],at[1]-feet[i][1])<1e-6);}assert.equal(a.diagnostics.length,2);assert.ok(a.diagnostics.every(c=>c.error<1e-6));assert.ok(Object.values(rig.J).flat().every(Number.isFinite));a.restore();
  }
});

test('Juno places the bow at the actual horse rack with her healthy hand in eight directions',()=>{
  const v=E.VIEWS.threequarter,cv=E.charView(v);
  for(let i=0;i<8;i++){
    const facing=i*Math.PI/4,horse={id:'copper',kind:'horse',x:340,y:1160,z:0,facing},body={id:'juno',...huntBowGiftStance(horse)},rig=createWillowHuman(E,'juno').rig;
    const animal=new WillowAnimalRig(E,horse.id,'horse');animal.pose(horse);
    const target=v.p(...animal.world(horse,[-18,-8,38])),anim=createHuntAnimator(),state={};
    anim.update(0,state,{generation:1,events:[{seq:1,kind:'give-bow',actorId:'juno',targetId:'juno-ash-bow',sourceId:'copper',from:body,target:horse}]});
    anim.update(.625,state,{generation:1,events:[]});rig.update(0,body);
    const clip=anim.clip('juno');assert.equal(clip.kind,'give-bow');
    const root=v.p(body.x,body.y,0),feet=['L','R'].map(side=>jointScreen(rig,cv,root,'foot'+side));
    const torsoLength=Math.hypot(...rig.J.shC.map((n,k)=>n-rig.J.hipC[k]));
    const a=prepareHuntHuman(E,body,rig,root,v,{clip,project:(x,y,z)=>v.p(x,y,z),propPoint:target});
    assert.deepEqual(a.root,root);for(const [k,side]of['L','R'].entries())assert.deepEqual(jointScreen(rig,cv,a.root,'foot'+side),feet[k]);
    const contact=a.diagnostics.find(c=>c.side==='L');assert.ok(contact);assert.ok(contact.error<1e-6);
    const right=rig.J.handR.map((n,k)=>n-rig.J.shR[k]);assert.ok(Math.hypot(...right)<=rig.o.armUpper+rig.o.armLower);
    assert.ok(Math.abs(Math.hypot(...rig.J.shC.map((n,k)=>n-rig.J.hipC[k]))-torsoLength)<1);
    assert.ok(Object.values(rig.J).flat().every(Number.isFinite));a.restore();
  }
});

test('the mounted wind lesson points with the healthy arm while preserving both stirrup contacts',()=>{
  const v=E.VIEWS.threequarter,cv=E.charView(v),horse={id:'bracken',kind:'horse',x:860,y:1300,z:0,facing:0},animal=new WillowAnimalRig(E,horse.id,'horse');animal.pose(horse);
  const sockets=animal.sockets({w:(x,y,z)=>v.p(x,y,z)},horse),body={id:'juno',x:horse.x,y:horse.y,z:0,facing:0,mounted:true},root=v.p(body.x,body.y,0);
  const prepare=clip=>{const rig=createWillowHuman(E,'juno').rig;rig.update(0,body);return prepareHuntHuman(E,body,rig,root,v,{clip,mounted:true,sockets,project:(x,y,z)=>v.p(x,y,z)});};
  const resting=prepare(),gesture=prepare({kind:'wind-lesson',age:.6,duration:1.2,target:{x:880,y:1260,z:0}});
  assert.deepEqual(gesture.root,resting.root);
  for(const side of['L','R'])assert.deepEqual(jointScreen(gesture.rig,cv,gesture.root,'foot'+side),jointScreen(resting.rig,cv,resting.root,'foot'+side));
  assert.notDeepEqual(gesture.rig.J.handL,resting.rig.J.handL);
  for(const [a,b,length]of[['shL','elbowL',gesture.rig.o.armUpper],['elbowL','handL',gesture.rig.o.armLower]])assert.ok(Math.abs(Math.hypot(...gesture.rig.J[a].map((n,i)=>n-gesture.rig.J[b][i]))-length)<1e-6);
  assert.ok(Object.values(gesture.rig.J).flat().every(Number.isFinite));resting.restore();gesture.restore();
});
