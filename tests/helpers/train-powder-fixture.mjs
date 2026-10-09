import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as Journey from '../../src/campaign-journey.js';
import {followActor,clearLine} from '../../src/campaign-navigation.js';
import {RIVAL_ID,RIVAL_WORLD} from '../../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {TRAIN_TOOL_CASE} from '../../content/campaign/train-equipment.js';
import * as Custody from '../../src/rival-continuation.js';
import * as Powder from '../../src/train-powder.js';

// SCOPED COMPONENT FIXTURE, not a twenty-scene mission or full Journey Save
// proof. The untouched earned W6 graph is validated/migrated by its real codec.
// Only an empty component is staged in the still-unavailable train record.
// Approaches use actual shared native navigation/camp obstacles. Hand contacts
// use the explicit z33 fixture below; native IK/swept wrist/carry proof is separate.
const raw=gunzipSync(readFileSync(new URL('../fixtures/journey-v4-rival-webkit-current-complete.json.gz',import.meta.url))).toString();
const point=a=>({x:a.x,y:a.y,z:a.z||0}),hand=a=>({...point(a),z:(a.z||0)+33}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function createPowderFixture({componentGraph=null}={}){
  const s=componentGraph?structuredClone(componentGraph):Journey.restoreCampaign(raw);assert.ok(s);assert.equal(s.version,5);
  if(!componentGraph){s.campaign.missions[TRAIN_ID].train.powder=Powder.createTrainPowderRecord();Journey.campaignAction(s,'holster');}
  assert.equal(s.entities.mara.holstered,true);
  const world=Journey.worldForCampaign(s),settings={blocked:false,lostHand:false,throwPhysical:false};
  const fixedContact=(_s,id)=>{
    if(id===TRAIN_TOOL_CASE.id)return{x:TRAIN_TOOL_CASE.x,y:TRAIN_TOOL_CASE.y,z:TRAIN_TOOL_CASE.handZ};
    if(id===RIVAL_WORLD.camp.charges.id)return{...point(RIVAL_WORLD.camp.charges),z:33};
    throw new Error('This limited camp fixture has no train terrain');
  };
  function locationPoint(location){
    if(location.type==='carried')return hand(s.entities[location.targetId]);
    if(location.type==='station'||location.type==='container')return fixedContact(s,location.targetId);
    if(location.type==='crate')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
    if(location.type==='tin')return locationPoint(s.campaign.missions[RIVAL_ID].objects['cap-tin'].location);
    if(location.type==='charge')return locationPoint(s.campaign.missions[RIVAL_ID].objects[location.targetId].location);
    throw new Error('Unimplemented fixture location');
  }
  function refPoint(ref){return locationPoint(Custody.resolveFixedRef(s,ref).location);}
  const ctx={
    fixedContact,worldFor:()=>world,pointForLocation:(_s,location)=>locationPoint(location),
    handUsable:(_s,id)=>!!s.entities[typeof id==='string'?id:id.id]&&!settings.lostHand,
    handFree:(_s,id)=>s.entities[typeof id==='string'?id:id.id]?.holstered!==false,
    canContain:(_s,item,to)=>!!item&&!!to,
    authorizeCustodyOp(_s,op){
      const allowed=['issue-kit','open-tin','move-object','unseal-charge','attach-primer','remove-primer','attach-fuse','light-fuse','cut-clamp'];
      return allowed.includes(op.kind)&&op.actorIds.every(id=>s.entities[id]?.hp>0&&!s.entities[id].mounted&&s.entities[id].holstered!==false);
    },
    custodySnapshot(_s,{actorIds,refs,destinations}){return{actors:actorIds.map(id=>({id,point:point(s.entities[id])})),sources:refs.map(ref=>({ref,point:refPoint(ref)})),destinations:destinations.map(location=>({location,point:locationPoint(location)}))};},
    powderContactWindow(_s,op,{start,finish}){
      const actors=op.actorIds.map(id=>({id,root:point(s.entities[id]),hand:hand(s.entities[id]),regionId:s.entities[id].regionId,alive:s.entities[id].hp>0,mounted:!!s.entities[id].mounted,handUsable:!settings.lostHand,handFree:s.entities[id].holstered!==false}));
      const endpoint=(position,extra)=>{
        const actor=actors.reduce((best,a)=>!best||dist(a.hand,position)<dist(best.hand,position)?a:best,null);
        return{...extra,point:position,regionId:'snowbound',actorId:actor?.id,maxHandDistance:actor?dist(actor.hand,position):Infinity};
      };
      return{start,finish,sweptClear:!settings.blocked,actors,
        sources:op.refs.map(ref=>endpoint(refPoint(ref),{ref})),
        destinations:op.to?[endpoint(locationPoint(op.to.location),{location:op.to.location})]:[],
        fixedContacts:Powder.powderFixedContactRoles(op).map(role=>{const position=fixedContact(s,role.id),actor=actors.find(a=>a.id===role.actorId);return{...role,point:position,maxHandDistance:dist(actor.hand,position)};}),
      };
    },
    validateCustodyCause:Powder.validatePowderCustodyCause,
    prepareCustodyPhysicalEffects(){return{apply(){if(settings.throwPhysical)throw new Error('Deliberate owner physical-result failure');},rollback(){}};},
  };
  function tick(dt=.1){s.elapsed+=dt;return Powder.stepPowderWork(s,dt,ctx);}
  function approach(id,target){
    for(let i=0;i<2000&&Math.hypot(s.entities[id].x-target.x,s.entities[id].y-target.y)>1;i++){
      followActor(world,s.entities[id],target,105,.1,0,9);tick();
    }
    assert.ok(Math.hypot(s.entities[id].x-target.x,s.entities[id].y-target.y)<=1,`Actual approach failed for ${id}`);
  }
  function complete(request,{success=true}={}){assert.ok(request);for(let i=0;i<30&&Powder.trainPowderRecord(s).pending.length;i++)tick();assert.equal(Powder.trainPowderRecord(s).pending.length,0);const result=Powder.trainPowderRecord(s).physicalEvents.find(event=>event.data?.workId===request.workId);assert.ok(result);assert.ok(success?['work-completed','circuit-work-completed','preparation-inspection-completed'].includes(result.kind):result.kind==='work-cancelled',`Unexpected physical result ${result.kind}`);}
  function history(){return Custody.validateRivalContinuation(s)&&Powder.validatePowderWorkHistory(Powder.trainPowderRecord(s),s.elapsed,{...Custody.custodyValidationLinks(s),fixedContactFor:id=>fixedContact(s,id)});}
  return{s,ctx,settings,tick,approach,complete,history};
}
