/** Detached native component predictions. Synthetic prospective roots below
 * are not route/landing/work receipts; the final case reads genuine history. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import {createTrainHuman} from '../../src/train-native/rigs.js';
import {captureNativeGroundLocomotion as capture,applyNativeGroundLocomotion as apply} from '../../src/train-native/locomotion-state.js';
import {predictNativeGroundStep as predict,isOrdinaryNativeGroundBody as ordinary} from '../../src/train-native/ground-motion-step.js';
import {createTrainCampWorkProvider} from '../../src/train-camp-work.js';
import * as Journey from '../../src/campaign-journey.js';

const E=globalThis.My3D2dge,copy=structuredClone;
const initial={id:'inez',category:'npc',x:500,y:1200,z:0,facing:0,vx:0,vy:0,hp:87,crouch:false};
function human(body=initial){const h=createTrainHuman(E,body);h.rig.update(0,body);return h;}
function frozen(v){if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;}
const nativeBody=b=>({...b,pose:b.pose||(b.crouch?'crouch':null)});

test('the pure body predicate shares ordinary-domain guards without native updates or inherited/accessor reads',()=>{
 const before=JSON.stringify(initial);assert.equal(ordinary(frozen(copy(initial))),true);assert.equal(ordinary({...initial,crouch:true}),true);assert.equal(ordinary({...initial,z:20,onGround:true}),true);
 for(const bad of[null,undefined,[],{...initial,vx:NaN},{...initial,hp:0},{...initial,category:'mount'},{...initial,mounted:true},{...initial,attachment:{type:'rest'}},{...initial,onGround:false},{...initial,z:1},{...initial,toolHeld:'pliers'},{...initial,pose:'guard'},Object.assign(Object.create({mounted:false}),initial)])assert.equal(ordinary(bad),false);
 let reads=0;const accessor={...initial};Object.defineProperty(accessor,'x',{enumerable:true,get(){reads++;throw new Error('must not execute');}});assert.equal(ordinary(accessor),false);const inherited=Object.create({get x(){reads++;return 500;}}),{x,...withoutX}=initial;Object.assign(inherited,withoutX);assert.equal(ordinary(inherited),false);
 const nested={...initial,rig:{}};Object.defineProperty(nested.rig,'size',{enumerable:true,get(){reads++;return 1.6;}});assert.equal(ordinary(nested),false);
 const canonical={...initial};Object.defineProperty(canonical,'traversal',{get(){reads++;throw new Error('canonical adapter must not execute');}});assert.equal(ordinary(canonical),true);assert.equal(reads,0);
 const cyclic={...initial};cyclic.self=cyclic;assert.equal(ordinary(cyclic),false);assert.equal(JSON.stringify(initial),before);
});

test('one pure step exactly matches native turns, sideways history, braking, crouch and JSON continuation',()=>{
 const direct=human();direct.rig.kick(.5);let body={...initial},steps=0,sideRetained=false,braking=false,blending=false;
 const directions=[...Array.from({length:6},()=>({vx:65,vy:0,facing:0})),...Array.from({length:6},()=>({vx:0,vy:65,facing:0})),...Array.from({length:3},()=>({vx:35,vy:-25,facing:1.8})),...Array.from({length:6},()=>({vx:0,vy:0,crouch:true})),...Array.from({length:4},()=>({vx:0,vy:0,crouch:false}))];
 for(const input of directions){
  const dt=[.025,.05,.1][steps++%3],from=capture(direct.rig),fromRaw=JSON.stringify(from);
  body={...body,...input,x:body.x+input.vx*dt,y:body.y+input.vy*dt};const before=JSON.stringify(body),saved=JSON.parse(fromRaw),result=predict(E,frozen(copy(body)),frozen(saved),dt);
  direct.rig.update(dt,nativeBody(body));assert.deepEqual(result.toRecord,capture(direct.rig));assert.deepEqual(result.human.rig.J,direct.rig.J);assert.deepEqual([result.human.rig.x,result.human.rig.y,result.human.rig.z],[body.x,body.y,body.z]);assert.equal(result.toRecord.clock,from.clock+dt);
  assert.equal(JSON.stringify(from),fromRaw);assert.equal(JSON.stringify(saved),fromRaw);assert.equal(JSON.stringify(body),before);
  assert.ok(Object.isFrozen(result.toRecord)&&Object.isFrozen(result.toRecord.profile)&&Object.isFrozen(result.toRecord.movement)&&Object.isFrozen(result.toRecord.poseWeights));
  sideRetained ||= input.vx===0&&input.vy===0&&Math.abs(result.toRecord.movement[1])>.1;
  braking ||= input.vx===0&&input.vy===0&&result.toRecord.speedWeight>0;
  blending ||= result.toRecord.poseWeights.crouch>0&&result.toRecord.poseWeights.crouch<1;
  result.human.rig.J.footL[0]+=500;result.human.rig.mv[0]=99;assert.deepEqual(capture(direct.rig),result.toRecord,'returned private rig cannot mutate the original native Human or captured record');
 }
 assert.ok(sideRetained&&braking&&blending,'all real retained histories were exercised');
});

test('the ordinary desired crouch adapter preserves exact native pose precedence and explicit grounded elevated roots',()=>{
 const source=human(),from=capture(source.rig),crouched=predict(E,{...initial,crouch:true},from,.05);
 assert.equal(crouched.toRecord.poseWeights.crouch,.45);
 const standing=predict(E,{...initial,crouch:true,pose:'stand'},crouched.toRecord,.05);
 assert.equal(standing.toRecord.poseWeights.crouch,0,'named stand matches the owning existing camp adapter');
 const elevated={...initial,z:20,onGround:true},step=predict(E,elevated,from,.05);assert.equal(step.human.rig.z,20);assert.equal(elevated.z,20);
 const noWeights=human();delete noWeights.rig.poseW;const absent=capture(noWeights.rig);assert.equal(absent.poseWeights,null);
 const actual=predict(E,initial,JSON.parse(JSON.stringify(absent)),.05);noWeights.rig.update(.05,nativeBody(initial));assert.deepEqual(actual.toRecord,capture(noWeights.rig),'native update itself creates its normal weights; apply does not fabricate an earlier blend');
});

test('invalid time, nonordinary bodies and mismatched records reject atomically without input/root/global writes',()=>{
 const from=capture(human().rig),raw=JSON.stringify(from),body=frozen(copy(initial)),bodyRaw=JSON.stringify(body),styleRaw=JSON.stringify(E.style),current=E.current;
 for(const dt of[undefined,null,0,-.05,NaN,Infinity,.10000000001,'0.05'])assert.throws(()=>predict(E,body,from,dt),TypeError);
 const mutations=[b=>delete b.z,b=>delete b.vx,b=>b.x=NaN,b=>b.y=Infinity,b=>b.facing=NaN,b=>b.vx=Infinity,b=>b.vy=NaN,b=>b.hp=0,b=>b.dead=true,b=>b.category='mount',b=>b.kind='horse',b=>b.mounted=true,b=>b.attachment={type:'rest',anchorId:'bed'},b=>b.support={surfaceId:'deck'},b=>b.onGround=false,b=>b.onGround='yes',b=>b.grounded=false,b=>b.jumping=true,b=>b.z=1,b=>b.vz=1,b=>b.air=true,b=>b.bound=true,b=>b.restrained=true,b=>b.carrying='charge',b=>b.toolHeld='pliers',b=>b.weaponAction={kind:'fire'},b=>b.reloadTimer=.1,b=>b.attack={spec:{}},b=>b.hurt=true,b=>b.dash=true,b=>b.point=true,b=>b.aim=.1,b=>b.aiming=true,b=>b.climb=true,b=>b.pose='guard',b=>b.stance='ready',b=>b.down=.1,b=>b.run=1,b=>b.crouch='true'];
 for(const mutate of mutations){const bad=copy(initial);mutate(bad);const before=copy(bad);assert.throws(()=>predict(E,bad,from,.05),TypeError);assert.deepEqual(bad,before);}
 for(const mutate of[r=>r.profile.legUpper+=.01,r=>r.profile.weapon='gun',r=>r.poseWeights.wave=.1,r=>r.speedWeight=1.251,r=>r.movement=[1,1],r=>r.phase=NaN,r=>r.clock=1e16,r=>r.extra='not-native']){const bad=copy(from);mutate(bad);const before=copy(bad);assert.throws(()=>predict(E,body,bad,.05),TypeError);assert.deepEqual(bad,before);}
 assert.throws(()=>predict(null,body,from,.05),TypeError);assert.equal(JSON.stringify(from),raw);assert.equal(JSON.stringify(body),bodyRaw);assert.equal(JSON.stringify(E.style),styleRaw);assert.equal(E.current,current);
});

test('accessors, changing nested data and unresolved finite native results cannot escape validation',()=>{
 const from=capture(human().rig);let reads=0;const accessor={...initial};Object.defineProperty(accessor,'x',{enumerable:true,get(){reads++;return 500;}});assert.throws(()=>predict(E,accessor,from,.05),TypeError);assert.equal(reads,0,'no getter executes during validation or native update');
 const nested=copy(from);Object.defineProperty(nested.profile,'size',{enumerable:true,get(){reads++;return 1.6;}});assert.throws(()=>predict(E,initial,nested,.05),TypeError);assert.equal(reads,0);
 const adapter={...initial};Object.defineProperty(adapter,'traversal',{get(){reads++;throw new Error('canonical adapter must not execute');}});assert.ok(predict(E,adapter,from,.05));assert.equal(reads,0);
 const cyclic={...initial};cyclic.self=cyclic;assert.throws(()=>predict(E,cyclic,from,.05),TypeError);assert.equal(cyclic.self,cyclic);
 const huge={...initial,vx:Number.MAX_VALUE,vy:Number.MAX_VALUE};assert.throws(()=>predict(E,huge,from,.1),TypeError,'finite inputs with an unresolved speed must refuse');
 const decoded=copy(from);decoded.squashVelocity=1e308;assert.throws(()=>predict(E,initial,decoded,.1),TypeError,'an overflowed native spring cannot become an accepted motion record');
});

test('a prediction uses one native update and promises no subdivision/semigroup equivalence',()=>{
 const source=human();source.rig.update(.05,{...initial,vx:65});const from=capture(source.rig),body={...initial,vx:0,vy:65,facing:1};
 const whole=predict(E,body,from,.1),half=predict(E,body,from,.05),twice=predict(E,body,half.toRecord,.05);
 assert.notDeepEqual(whole.toRecord,twice.toRecord,'the engine blends and integrates once for the supplied dt');
 const direct=human();apply(direct.rig,JSON.parse(JSON.stringify(from)));direct.rig.update(.1,nativeBody(body));assert.deepEqual(whole.toRecord,capture(direct.rig));assert.deepEqual(whole.human.rig.J,direct.rig.J);
});

test('unchanged genuine PR9 game bytes supply retained native braking history for detached prediction only',()=>{
 const raw=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);
 const provider=createTrainCampWorkProvider(E,Journey.worldForCampaign);provider.prepareNativeActor(s,'mara');
 for(let i=0;i<6;i++){Journey.stepCampaign(s,.05,{mx:1,my:0});provider.prepareNativeActor(s,'mara');}
 Journey.stepCampaign(s,.05,{});const actual=provider.prepareNativeActor(s,'mara'),from=capture(actual.human.rig),before=Journey.serializeCampaign(s),joints=copy(actual.human.rig.J);
 assert.equal(Math.hypot(s.player.vx,s.player.vy),0);assert.ok(from.speedWeight>0);
 const predicted=predict(E,s.player,JSON.parse(JSON.stringify(from)),.05);assert.ok(predicted.toRecord.speedWeight<from.speedWeight);assert.ok(predicted.toRecord.speedWeight>=0);assert.equal(predicted.toRecord.clock,from.clock+.05);
 assert.equal(Journey.serializeCampaign(s),before,'prediction neither advances actual time nor adopts motion/positions/stock');assert.deepEqual(actual.human.rig.J,joints);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(before)),before);
});
