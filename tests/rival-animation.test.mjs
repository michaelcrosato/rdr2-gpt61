import test from 'node:test';
import assert from 'node:assert/strict';
import '../my-3d2dge-agent.js';
import { RIVAL_CAST, RIVAL_ENEMIES } from '../content/campaign/bellwether-works.js';
import { createRivalHuman, RivalMountRig, RIVAL_MOUNT_COATS, boundRivalPose, poseRivalCarbine } from '../src/rival-rigs.js';
import { createRivalAnimator, prepareRivalHuman, fitRivalSeatFeet } from '../src/rival-animation.js';
import { createRivalActors, rivalResidence, ownsRivalActor } from '../src/rival-actors.js';
import { jointScreen } from '../src/western-animation.js';
import { seatPose } from '../src/expedition-animation.js';
const E=globalThis.My3D2dge,v=E.VIEWS.threequarter,cv=E.charView(v),project=(x,y,z=0)=>v.p(x,y,z);
const mockContext=()=>new Proxy({measureText:s=>({width:s.length*5})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,value)=>(o[k]=value,true)});
function renderActors(s){const pending=[],r={view:v,w:project,visible:()=>true,shadow:()=>{},queue:(x,y,z,fn)=>pending.push(fn)},actors=createRivalActors(E,{reduceMotion:false});actors.update(0,s);actors.draw(r,s);const g=mockContext();for(const draw of pending)draw(g);return actors.inspect();}
function fixture(type,facing=0){const entities={mara:{id:'mara',x:500,y:500,z:0,hp:100,kind:'human',facing},copper:{id:'copper',kind:'horse',x:500,y:500,z:0,hp:100,facing},levi:{id:'levi',kind:'human',x:500,y:500,z:0,hp:100,facing,bound:true,attachment:{type,targetId:type==='carried'?'mara':'copper',strap:true}}};if(type==='carried')entities.mara.carrying='levi';else Object.assign(entities.mara,{mounted:true,mountId:'copper'});return{region:'bellwether-works',campaign:{activeMissionId:'snowbound-the-names-they-took',missions:{}},entities,player:entities.mara,horse:entities.copper,weapons:{}};}

test('Bellwether faces, outfits and mount coats have independent original identities',()=>{
  const ids=['ruth','bastian','emmett','levi','calder'],outfits=ids.map(id=>createRivalHuman(E,id,RIVAL_CAST.find(a=>a.id===id)));
  assert.equal(new Set(outfits.map(h=>h.colors.coat)).size,ids.length);
  assert.equal(new Set(ids.map(id=>RIVAL_CAST.find(a=>a.id===id).rig.voiceId)).size,ids.length);
  assert.equal(new Set(['plover','cinder','button','skein','grout'].map(id=>RIVAL_MOUNT_COATS[id].fur)).size,5);
  assert.ok(RIVAL_ENEMIES.every(body=>createRivalHuman(E,body.id,body).rig.o.weapon===null));
});
test('all six riders retain real narrow-stirrup contacts in eight headings',()=>{
  for(const id of['mara','tomas','inez','ruth','bastian','emmett'])for(let i=0;i<8;i++){
    const facing=i*Math.PI/4,horse={id:'button',x:400,y:800,z:13,facing,hp:100},mount=new RivalMountRig(E,horse.id);mount.pose(horse);const sockets=mount.sockets({w:project},horse),body={id,x:400,y:800,z:13,mounted:true,facing},rig=createRivalHuman(E,id).rig;rig.update(0,body);const a=prepareRivalHuman(E,body,rig,project(400,800,13),v,{sockets});
    assert.equal(a.diagnostics.filter(d=>d.kind==='rival-seat').length,2);assert.ok(a.diagnostics.every(d=>d.error<1e-7));assert.ok(Object.values(rig.J).flat().every(Number.isFinite));a.restore();
  }
});
test('bound Levi occupies his own rear seat without inheriting the driver joints',()=>{
  for(let i=0;i<8;i++){
    const f=i*Math.PI/4,horse={id:'copper',x:400,y:800,z:0,facing:f,hp:100},mount=new RivalMountRig(E,horse.id);mount.pose(horse);const sockets=mount.sockets({w:project},horse),rear={...sockets,saddle:sockets.rear,stirrupL:sockets.rearStirrupL,stirrupR:sockets.rearStirrupR},rig=createRivalHuman(E,'levi').rig;rig.update(0,{facing:f});const root=seatPose(E,rig,cv,project(400,800,0),rear,1,true);fitRivalSeatFeet(E,rig,cv,root,rear);boundRivalPose(E,rig);
    for(const side of['L','R']){const q=jointScreen(rig,cv,root,'foot'+side),p=rear['stirrup'+side];assert.ok(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-7);}assert.ok(Math.hypot(...rig.J.handL.map((n,k)=>n-rig.J.handR[k]))<2);
  }
});
test('standing, crouching and mounted rifle tips agree with physical world muzzle origins',()=>{
  for(const stance of['standing','crouching','mounted'])for(let i=0;i<8;i++){
    const facing=i*Math.PI/4,body={id:'mara',x:400,y:800,z:12,facing,hp:100,crouch:stance==='crouching',mounted:stance==='mounted'},rig=createRivalHuman(E,'mara').rig;rig.update(0,{...body,z:0,pose:body.crouch?'crouch':null});const feet=[rig.J.footL.slice(),rig.J.footR.slice()],root=project(body.x,body.y,body.z),source=project(body.x+Math.cos(facing)*16,body.y+Math.sin(facing)*16,body.z+(body.mounted?64:29)),shape=poseRivalCarbine(E,rig,v,root,source),hit=jointScreen(rig,cv,root,shape.tip);
    assert.ok(Math.hypot(hit[0]-source[0],hit[1]-source[1])<1e-7);assert.deepEqual([rig.J.footL,rig.J.footR],feet);assert.ok(Object.values(rig.J).flat().every(Number.isFinite));
  }
});
test('accepted captive clips share one elapsed clock and queue load, strap and mount in order',()=>{
  const s={},a=createRivalAnimator(),events=[{seq:1,kind:'lift',actorId:'mara',targetId:'levi'},{seq:2,kind:'load',actorId:'mara',targetId:'levi'},{seq:3,kind:'strap',actorId:'mara',targetId:'levi'},{seq:4,kind:'mount',actorId:'mara',targetId:'copper'}];a.update(0,s,{generation:1,events});assert.equal(a.clip('mara'),a.clip('levi'));a.update(1.56,s,{generation:1,events});assert.equal(a.clip('mara').kind,'load');assert.equal(a.clip('mara'),a.clip('levi'));a.update(1.75,s,{generation:1,events});assert.equal(a.clip('mara').kind,'strap');assert.equal(a.clip('levi'),undefined);a.update(1.2,s,{generation:1,events});assert.equal(a.clip('mara').kind,'mount');assert.equal(a.clip('copper'),undefined);
  a.update(0,s,{generation:2,events:[{seq:1,kind:'unload',actorId:'mara',targetId:'levi',sourceId:'copper'}]});assert.equal(a.clip('mara').kind,'unload');assert.equal(a.clip('mara').age,0);
});
test('reduced motion preserves accepted contact time and suppresses ornamental clock only',()=>{
  const a=createRivalAnimator(),s={},event={seq:1,kind:'bind',actorId:'mara',targetId:'levi'};a.update(0,s,{generation:1,events:[event]},true);a.update(.8,s,{generation:1,events:[event]},true);assert.equal(a.clip('mara').age,.8);assert.equal(a.clip('levi'),a.clip('mara'));assert.equal(a.clock,0);
});
test('crate loading finishes before the accepted mount and never gives Plover a human clip',()=>{
  const a=createRivalAnimator(),s={},events=[{seq:1,kind:'load-crate',actorId:'ruth',targetId:'charge-crate',sourceId:'ruth'},{seq:2,kind:'mount',actorId:'ruth',targetId:'plover'}];a.update(0,s,{generation:1,events});assert.equal(a.clip('ruth').kind,'load-crate');assert.equal(a.clip('plover'),undefined);a.update(1.56,s,{generation:1,events});assert.equal(a.clip('ruth').kind,'mount');assert.equal(a.clip('plover'),undefined);
});
test('human carry and passenger groups draw the authoritative captive exactly once and preserve saved state',()=>{
  for(const type of['carried','passenger'])for(let i=0;i<8;i++){
    const s=fixture(type,i*Math.PI/4),before=JSON.stringify(s),result=renderActors(s);assert.equal(result.drawn.filter(id=>id==='levi').length,1);assert.equal(new Set(result.drawn).size,result.drawn.length);assert.equal(JSON.stringify(s),before);assert.ok(result.contacts.length>=2);assert.ok(result.contacts.every(c=>c.error<1e-7));
    if(type==='passenger')assert.equal(result.contacts.filter(c=>c.kind==='bound-passenger-seat').length,2);else assert.equal(result.contacts.filter(c=>c.kind==='bound-human-support').length,2);
  }
});
test('attachment residence follows one carrier or mount and rejects cycles',()=>{
  const all={levi:{id:'levi',regionId:null,attachment:{type:'passenger',targetId:'copper'}},copper:{id:'copper',regionId:'bellwether-works'}};assert.equal(rivalResidence(all.levi,all,'snowbound'),'bellwether-works');all.levi.attachment={type:'holding',targetId:'levi-holding',regionId:'snowbound'};assert.equal(rivalResidence(all.levi,all,'bellwether-works'),'snowbound');all.levi.attachment={type:'carried',targetId:'copper'};all.copper.attachment={type:'carried',targetId:'levi'};assert.equal(rivalResidence(all.levi,all,'snowbound'),null);
  assert.equal(ownsRivalActor({campaign:{activeMissionId:'snowbound-a-quiet-table'}},{id:'mara'}),false);assert.equal(ownsRivalActor({campaign:{activeMissionId:'snowbound-a-quiet-table'}},{id:'levi'}),true);
});


// Native contact fixtures only; these do not establish browser delivery,
// gesture usability or a complete story route.
test('the cap giver and receiver meet the same physical tin contact in eight headings and both motion preferences',()=>{
  for(const reduced of [false,true])for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,from={id:'mara',x:500,y:500,z:0,hp:100,facing:angle},to={id:'ruth',x:500+Math.cos(angle)*20,y:500+Math.sin(angle)*20,z:0,hp:100,facing:angle+Math.PI};
    const target={x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:32},animator=createRivalAnimator(),state={};
    animator.update(0,state,{generation:1,events:[{seq:1,kind:'give-cap',actorId:'mara',sourceId:'mara',targetId:'cap-tin',target,from},{seq:2,kind:'receive-cap',actorId:'ruth',sourceId:'ruth',targetId:'cap-tin',target,from:to}]},reduced);
    animator.update(.6,state,{generation:1,events:[]},reduced);
    const contacts=[];
    for(const body of[from,to]){const rig=createRivalHuman(E,body.id).rig;rig.update(0,body);const a=prepareRivalHuman(E,body,rig,project(body.x,body.y,body.z),v,{clip:animator.clip(body.id),project,propPoint:project(target.x,target.y,target.z)});assert.equal(a.diagnostics.length,1);assert.ok(a.diagnostics.every(d=>d.error<1e-7));contacts.push(a.diagnostics[0]);assert.ok(Object.values(rig.J).flat().every(Number.isFinite));a.restore();}
    assert.deepEqual(contacts[0].target,contacts[1].target);assert.equal(contacts[0].side,'R');assert.equal(contacts[1].side,'L');
  }
});


test('Bastian and Tomas meet at one paper contact with their gun hands free',()=>{
  for(const reduced of[false,true])for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,from={id:'bastian',x:500,y:500,z:0,hp:100,facing:angle,holstered:true},to={id:'tomas',x:500+Math.cos(angle)*20,y:500+Math.sin(angle)*20,z:0,hp:100,facing:angle+Math.PI,holstered:true};
    const target={x:(from.x+to.x)/2,y:(from.y+to.y)/2,z:32},animator=createRivalAnimator(),state={};
    animator.update(0,state,{generation:1,events:[{seq:1,kind:'give-plans',actorId:'bastian',sourceId:'bastian',targetId:'route-diagram',target,from},{seq:2,kind:'receive-plans',actorId:'tomas',sourceId:'tomas',targetId:'route-diagram',target,from:to}]},reduced);
    animator.update(.625,state,{generation:1,events:[]},reduced);
    const contacts=[];
    for(const body of[from,to]){const rig=createRivalHuman(E,body.id).rig;rig.update(0,body);const a=prepareRivalHuman(E,body,rig,project(body.x,body.y,body.z),v,{clip:animator.clip(body.id),project,propPoint:project(target.x,target.y,target.z)});assert.equal(a.diagnostics.length,1);assert.ok(a.diagnostics.every(d=>d.error<1e-7));contacts.push(a.diagnostics[0]);a.restore();}
    assert.deepEqual(contacts[0].target,contacts[1].target);assert.equal(contacts[0].side,'L');assert.equal(contacts[1].side,'R');
  }
});
