import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative,moveNative} from './helpers/train-preparation-route.mjs';
import {createPowderFixture} from './helpers/train-powder-fixture.mjs';
import * as Preparation from '../src/train-preparation.js';
import * as Powder from '../src/train-powder.js';
import * as Custody from '../src/rival-continuation.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_STORE_MARA} from '../content/campaign/train-preparation-camp.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,TRAIN_MASK_APPROACHES,trainGearLocation,validateTrainGear,trainFaceCovered} from '../src/train-gear.js';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),hand=a=>({...point(a),z:(a.z||0)+TRAIN_MASK_SOURCE.handZ}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const speech={notice(){},talk(s,id,speaker,text,choices){s.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};}};
function fixture(){
  // Existing clinic and briefing + actual call/store exchange use normal
  // Native movement/verbs. The NEW work below is explicitly a component hand
  // fixture, not Native IK/held-volume proof, public input or whole-Save proof.
  const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-call',speech),true);moveNative(s,TRAIN_STORE_MARA);assert.equal(Preparation.interactTrainPreparation(s,'train:prepare-talk:store',speech),true);while(s.dialog)assert.equal(Preparation.chooseTrainPreparation(s,'train-prepare-next',speech),true);
  // A coarse20-unit planning cell at the actual clear work approach overlaps
  // the new solid. Use a clear outside waypoint, then ordinary small movement
  // inputs to the real metadata point; no body assignment or solid resizing.
  const target=TRAIN_MASK_APPROACHES.mara;moveNative(s,{x:target.x+24,y:target.y});
  for(let i=0;i<300&&Math.hypot(s.player.x-target.x,s.player.y-target.y)>.05;i++){const d=Math.hypot(s.player.x-target.x,s.player.y-target.y);Journey.stepCampaign(s,Math.min(.01,d/105),{mx:(target.x-s.player.x)/d,my:(target.y-s.player.y)/d});}
  assert.ok(Math.hypot(s.player.x-target.x,s.player.y-target.y)<=.05,'actual body reaches the authored mask approach');
  const f=createPowderFixture({componentGraph:JSON.parse(Journey.serializeCampaign(s))});f.approach('ada',TRAIN_MASK_APPROACHES.ada);
  const fixedContact=(_s,id)=>id===TRAIN_MASK_SOURCE.id?{x:TRAIN_MASK_SOURCE.x,y:TRAIN_MASK_SOURCE.y,z:TRAIN_MASK_SOURCE.handZ}:null;
  const locationPoint=location=>location.type==='carried'?hand(f.s.entities[location.targetId]):location.type==='worn'?{...point(f.s.entities.mara),z:(f.s.entities.mara.z||0)+50}:location.type==='saddle'?{...point(f.s.entities.copper),z:(f.s.entities.copper.z||0)+40}:null;
  Object.assign(f.ctx,{
    fixedContact,pointForLocation:(_s,location)=>locationPoint(location),
    authorizeCustodyOp:(_s,op)=>Preparation.preparationOperationAllowed(f.s,op)&& (op.kind==='issue-mask'||op.kind==='move-object'&&op.refs.length===1&&op.refs[0].objectId===TRAIN_MASK_ID),
    canContain:(_s,item,to)=>item.id===TRAIN_MASK_ID&&to.owner==='mara'&&trainGearLocation(to.location),
    custodySnapshot(_s,{actorIds,refs,destinations}){return{actors:actorIds.map(id=>({id,point:point(f.s.entities[id])})),sources:refs.map(ref=>({ref,point:locationPoint(Custody.resolveFixedRef(f.s,ref).location)})),destinations:destinations.map(location=>({location,point:locationPoint(location)}))};},
    powderContactWindow(_s,op,{start,finish}){
      const actors=op.actorIds.map(id=>({id,root:point(f.s.entities[id]),hand:hand(f.s.entities[id]),regionId:'snowbound',alive:f.s.entities[id].hp>0,mounted:!!f.s.entities[id].mounted,handUsable:!f.settings.lostHand,handFree:f.s.entities[id].holstered!==false}));
      const endpoint=(p,extra)=>({...extra,point:p,regionId:'snowbound',actorId:'mara',maxHandDistance:distance(p,actors.find(a=>a.id==='mara').hand)});
      return{start,finish,sweptClear:!f.settings.blocked,actors,sources:op.refs.map(ref=>endpoint(locationPoint(Custody.resolveFixedRef(f.s,ref).location),{ref})),destinations:op.to?[endpoint(locationPoint(op.to.location),{location:op.to.location})]:[],fixedContacts:Powder.powderFixedContactRoles(op).map(role=>({...role,point:fixedContact(f.s,role.id),maxHandDistance:distance(actors.find(a=>a.id===role.actorId).hand,fixedContact(f.s,role.id))}))};
    },
  });return f;
}

test('actual component basket issue and wearing keep one finite item and preserve every earlier serialized baseline/event',()=>{
  const f=fixture(),c=f.s.campaign.missions[RIVAL_ID].rival.continuation,baseline=JSON.stringify(c.baseline),events=JSON.stringify(c.events),prior=c.events.length,kit=structuredClone(Powder.trainPowderRecord(f.s).kit);
  assert.equal(c.gearVersion,undefined);assert.equal(f.s.itemInstances[TRAIN_MASK_ID],undefined);const request=Powder.requestMaskHandoff(f.s,f.ctx);assert.ok(request);f.tick(.1);assert.equal(c.gearVersion,undefined);assert.equal(f.s.itemInstances[TRAIN_MASK_ID],undefined);f.complete(request);
  assert.equal(c.gearVersion,1);assert.equal(validateTrainGear(f.s),true);assert.equal(JSON.stringify(c.baseline),baseline);assert.equal(JSON.stringify(c.events.slice(0,prior)),events);assert.deepEqual(Powder.trainPowderRecord(f.s).kit,kit);assert.equal(Powder.requestMaskHandoff(f.s,f.ctx),null);assert.equal(Custody.validateRivalContinuation(f.s),true);
  const ref={sourceMissionId:TRAIN_ID,objectId:TRAIN_MASK_ID},item=f.s.itemInstances[TRAIN_MASK_ID];assert.strictEqual(Custody.resolveFixedRef(f.s,ref),item);assert.equal(trainFaceCovered(f.s),false);
  const issue=c.events.at(-1);assert.equal(Custody.sourceForRevision(f.s,ref,prior,issue.at),null,'no earlier prefix invents the newly issued gear');assert.deepEqual(Custody.sourceForRevision(f.s,ref,prior+1,issue.at),item);
  f.complete(Powder.requestPowderTransfer(f.s,ref,['mara'],{owner:'mara',location:{type:'worn',targetId:'mara',slot:'face'}},f.ctx));assert.equal(trainFaceCovered(f.s),true);assert.equal(Custody.validateRivalContinuation(f.s),true);assert.equal(JSON.stringify(c.baseline),baseline);assert.equal(Object.values(f.s.itemInstances).filter(item=>item.id===TRAIN_MASK_ID).length,1);
  const raw=JSON.parse(JSON.stringify(f.s));delete raw.campaign.missions[RIVAL_ID].rival.continuation.gearVersion;assert.equal(Custody.validateRivalContinuation(raw),false);assert.equal(validateTrainGear(raw),false);
  for(const mutate of [
    s=>{s.campaign.missions[RIVAL_ID].rival.continuation.gearVersion=2;},
    s=>{s.itemInstances[TRAIN_MASK_ID].issueEventId='snowbound-the-names-they-took:continued:99999';},
    s=>{s.campaign.missions[TRAIN_ID].train.powder.kit[TRAIN_MASK_ID]=structuredClone(s.itemInstances[TRAIN_MASK_ID]);},
    s=>{s.itemInstances[TRAIN_MASK_ID].location={type:'worn',targetId:'bastian',slot:'face'};},
  ]){const bad=JSON.parse(JSON.stringify(f.s));mutate(bad);assert.equal(Custody.validateRivalContinuation(bad),false,mutate.toString());}
});

test('a deliberate physical issue failure rolls back item and optional marker while retaining prior exact histories',()=>{
  const f=fixture(),c=f.s.campaign.missions[RIVAL_ID].rival.continuation,before={baseline:JSON.stringify(c.baseline),events:JSON.stringify(c.events),refs:structuredClone(Powder.trainPowderRecord(f.s).custodyEventRefs),items:structuredClone(f.s.itemInstances)};
  f.settings.throwPhysical=true;f.complete(Powder.requestMaskHandoff(f.s,f.ctx),{success:false});assert.equal(c.gearVersion,undefined);assert.deepEqual(f.s.itemInstances,before.items);assert.equal(JSON.stringify(c.baseline),before.baseline);assert.equal(JSON.stringify(c.events),before.events);assert.deepEqual(Powder.trainPowderRecord(f.s).custodyEventRefs,before.refs);assert.equal(Custody.validateRivalContinuation(f.s),true);
  f.settings.throwPhysical=false;f.complete(Powder.requestMaskHandoff(f.s,f.ctx));assert.equal(validateTrainGear(f.s),true);assert.equal(c.events.filter(e=>e.kind==='issue-mask').length,1);
});
