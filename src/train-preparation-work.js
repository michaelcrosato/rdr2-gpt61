/** Native preparation contacts. This owner moves only called NPCs, observes
 * actual material locations and never writes stock or accepted work time. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_TOOL_CASE,TRAIN_KIT_IDS,TRAIN_CHARGE_HALF_EXTENTS} from '../content/campaign/train-equipment.js';
import * as Camp from '../content/campaign/train-preparation-camp.js';
import * as MaskGearData from '../content/campaign/train-gear-data.js';
import * as PreparationLayout from './train-preparation-layout.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,TRAIN_MASK_APPROACHES,TRAIN_MASK_V2_APPROACHES,TRAIN_MASK_BASKET_SOLIDS} from '../content/campaign/train-gear-data.js';
import {createTrainCampWorkProvider} from './train-camp-work.js';
import {resolveFixedRef,inspectCustodyRequest,sourceForRevision,validCustodyRevision} from './rival-continuation.js';
import {powderFixedContactRoles} from './train-powder.js';
import {preparationOperationAllowed} from './train-preparation.js';
import {preparedCampSite,validatePreparationCampSetup,capturePreparationBodyBounds} from './train-preparation-layout.js';
import {blockedAt} from './campaign-navigation.js';
import {followPreparationActor,facePreparationWatchGuard} from './train-preparation-navigation.js';
import {isPreparationWatchOperation,selectPreparationWatchFixture,preparationWatchFixture,preparationWatchContact,validatePreparationWatchWork} from './train-preparation-watch.js';
import {preparationMaskOperationMode,validatePreparationMaskWork} from './train-preparation-mask.js';
import {validatePreparationStable,completePreparationStable,ownsPreparationStableActor} from './train-preparation-stable.js';
import {validatePreparationCopperRecovery} from './train-preparation-copper-recovery.js';
import {validateTrainStableCare,ownsTrainStableCareActor} from './train-stable-care.js';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),copy=structuredClone;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const finitePoint=p=>keys(p,['x','y','z'])&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const original=objectId=>({sourceMissionId:RIVAL_ID,objectId}),gearRef=()=>({sourceMissionId:TRAIN_ID,objectId:TRAIN_MASK_ID});
const train=s=>s.campaign.missions[TRAIN_ID].train;
const active=s=>s.campaign?.activeMissionId===TRAIN_ID&&s.mission.stage===2&&s.region==='snowbound'&&train(s).preparationVersion===1;
const stamp=a=>JSON.stringify([a.x,a.y,a.z,a.vx,a.vy,a.facing,a.pose,a.crouch,a.mounted,a.hp,a.holstered,a.reloadTimer,a.reloadWeaponId,a.toolHeld,a.carrying,a.weaponAction,a.handInjury,a.injured,a.attachment]);
const poses=new WeakMap();
const UP=Object.freeze([0,0,1]);
export function getPreparationWorkPose(s,id){const e=poses.get(s)?.get(id),a=s.entities?.[id],pending=s.campaign?.missions?.[TRAIN_ID]?.train?.powder?.pending;return e&&a&&e.body===a&&e.at===s.elapsed&&e.liveStamp===stamp(a)&&pending?.some(w=>w.kind===e.operationKind&&w.workId===e.workId)?e:null;}
function revisionAt(s,at){return s.campaign.missions[RIVAL_ID].rival.continuation.events.filter(e=>e.at<=at).length;}
function sourceAt(s,ref,at){return sourceForRevision(s,ref,revisionAt(s,at),at);}
export function validatePreparationMaskEvidence(s,e,at=s.elapsed){
  try{
    if(!keys(e,['schema','choice','at','revision','actorPosition','itemRef','itemState','issueEventId'])||e.schema!==1||!['bring','uncovered'].includes(e.choice)||!Number.isFinite(e.at)||e.at<train(s).preparation.startedAt||e.at>at||at>s.elapsed||!finitePoint(e.actorPosition)||!Number.isSafeInteger(e.revision))return false;
    if(!validCustodyRevision(s,e.revision,e.at))return false;
    const item=sourceForRevision(s,gearRef(),e.revision,e.at);
    if(e.at===s.elapsed&&!same(e.actorPosition,point(s.entities.mara)))return false;
    if(!item)return e.choice==='uncovered'&&e.itemRef===null&&e.itemState===null&&e.issueEventId===null;
    return same(e.itemRef,gearRef())&&same(e.itemState,{owner:item.owner,location:item.location})&&e.issueEventId===item.issueEventId&&item.owner==='mara'&&(e.choice==='bring'||item.location.type!=='worn');
  }catch{return false;}
}
export const PREPARATION_PROOF_OWNERS=Object.freeze({layout:validatePreparationCampSetup,mask:validatePreparationMaskEvidence,work:validatePreparationWork,stable:validatePreparationStable,stableComplete:completePreparationStable,copperRecovery:validatePreparationCopperRecovery,stableCare:validateTrainStableCare});
const siteReady=preparedCampSite;
function simpleConfig(kind,objectId,maskVersion=1){
  if(kind==='inspect-child-seal'){const slot=Camp.TRAIN_CHILD_CONTACTS[objectId];return slot&&{site:'quarry-charge-worktop',actors:{mara:{pose:Camp.TRAIN_STORE_MARA,target:Camp.TRAIN_STORE_MARA_HAND,elbowHint:UP},ruth:{pose:slot.approach,target:slot.grip,elbowHint:UP}}};}
  if(['open-tin','inspect-primer-tin'].includes(kind))return{site:'quarry-charge-worktop',actors:{...kind==='open-tin'?{}:{mara:{pose:Camp.TRAIN_STORE_MARA,target:Camp.TRAIN_STORE_MARA_HAND,elbowHint:UP}},ruth:{pose:Camp.TRAIN_TIN_APPROACH,target:Camp.TRAIN_TIN_HAND,elbowHint:UP}}};
  if(['issue-kit','inspect-wire-and-tools'].includes(kind))return{site:'ruth-wiring-case-stand',actors:{mara:{pose:Camp.TRAIN_CASE_MARA,target:Camp.TRAIN_CASE_MARA_HAND},ruth:{pose:Camp.TRAIN_CASE_RUTH,target:Camp.TRAIN_CASE_RUTH_HAND}}};
  if(kind==='issue-mask'){const approaches=maskVersion===3?MaskGearData.TRAIN_MASK_V3_APPROACHES:maskVersion===2?TRAIN_MASK_V2_APPROACHES:TRAIN_MASK_APPROACHES;if(!approaches)return null;return{site:'ada-mending-worktop',actors:Object.fromEntries(['mara','ada'].map(id=>[id,{pose:approaches[id],elbowHint:approaches[id].elbowHint,target:{x:TRAIN_MASK_SOURCE.x,y:TRAIN_MASK_SOURCE.y,z:TRAIN_MASK_SOURCE.handZ}}]))};}
  return null;
}
const intentKinds={inspectChild:'inspect-child-seal',inspectTin:'inspect-primer-tin',inspectKit:'inspect-wire-and-tools',openTin:'open-tin',issueKit:'issue-kit',issueMask:'issue-mask'};
const watchOperation=work=>({kind:'guard-handover',actorIds:['mara',work.args.fromActorId,work.args.toActorId],refs:[],to:null,options:copy(work.args)});
const intentConfig=(work,s,world,remember=false)=>work&&(work.kind==='watch'?selectPreparationWatchFixture(s,watchOperation(work),world,{remember}):simpleConfig(intentKinds[work.kind],work.args?.objectId,work.maskApproachVersion));
/** Ordinary player guidance uses the same authored approach as the owner. */
export function preparationPlayerApproach(s){try{const work=train(s).preparation?.work,f=work?.watchFixture,config=work?.kind==='watch'?(f?preparationWatchFixture(f.anchor,f.rotation,work.args.fromActorId,work.args.toActorId):null):intentConfig(work,s);return active(s)&&work?.workId===null&&config?.actors.mara&&(!config.site||siteReady(s,config.site))?{siteId:config.site||'levi-holding-anchor',point:point(config.actors.mara.pose),facing:config.actors.mara.pose.facing}:null;}catch{return null;}}
function exactOperation(op){
  if(op.to!==null)return false;
  if(op.kind==='open-tin')return same(op.refs,[original('cap-tin')])&&keys(op.options,[]);
  if(['issue-kit','issue-mask'].includes(op.kind))return same(op.refs,[])&&keys(op.options,[]);
  if(!keys(op.options,['topic','ref']))return false;
  const ref=op.options.ref;
  if(op.kind==='inspect-child-seal')return op.options.topic==='child-seal'&&Object.hasOwn(Camp.TRAIN_CHILD_CONTACTS,ref?.objectId)&&same(ref,original(ref.objectId))&&same(op.refs,[ref,original('charge-crate')]);
  if(op.kind==='inspect-primer-tin')return op.options.topic==='primer-tin'&&same(ref,original('cap-tin'))&&same(op.refs,[ref]);
  if(op.kind==='inspect-wire-and-tools')return op.options.topic==='wire-and-tools'&&same(ref,{sourceMissionId:TRAIN_ID,objectId:TRAIN_KIT_IDS[0]})&&same(op.refs,TRAIN_KIT_IDS.map(objectId=>({sourceMissionId:TRAIN_ID,objectId})));
  return false;
}
/** Fixed policy used by the whole-Save validator; caller flags cannot approve
 * missing worksite deployment or change material identity/destination. */
export function validatePreparationWork(s,op,startedAt){
  try{
    const p=train(s).preparation;if(!p||!Number.isFinite(startedAt)||startedAt<p.startedAt||startedAt>s.elapsed)return false;
    if(preparationMaskOperationMode(op))return validatePreparationMaskWork(s,op,startedAt);
    if(isPreparationWatchOperation(op))return validatePreparationWatchWork(s,op,startedAt);
    const config=simpleConfig(op.kind,op.options?.ref?.objectId);if(!config||!exactOperation(op)||!siteReady(s,config.site,startedAt)||!same(op.actorIds,Object.keys(config.actors)))return false;
    if(op.kind.startsWith('inspect-')){
      if(!p.completed.some(e=>e.kind==='store'&&e.at<=startedAt)||op.to!==null)return false;
      const ref=op.options.ref,item=sourceAt(s,ref,startedAt);if(!item)return false;
      if(op.kind==='inspect-child-seal')return item.location.type==='crate'&&item.location.targetId==='charge-crate'&&sourceAt(s,original('charge-crate'),startedAt)?.location.targetId==='quarry-charge-store';
      if(op.kind==='inspect-primer-tin')return item.location.type==='station'&&item.location.targetId==='quarry-charge-store';
      return TRAIN_KIT_IDS.every(id=>sourceAt(s,{sourceMissionId:TRAIN_ID,objectId:id},startedAt)?.location.targetId===TRAIN_TOOL_CASE.id);
    }
    return preparationOperationAllowed(s,op,startedAt)&&(['issue-kit','issue-mask'].includes(op.kind)||sourceAt(s,original('cap-tin'),startedAt)?.location.targetId==='quarry-charge-store');
  }catch{return false;}
}
/** Bound translation and every intermediate yaw of another occupied body.
 * Turning uses its whole horizontal radius, not only endpoint projections. */
export function sweptPreparationBodyBounds(previous,current){
  const byId=new Map((previous||[]).map(b=>[b.id,b])),byBody=new Map((previous||[]).map(b=>[b.bodyId,b]));
  return current.map(b=>{
    const a=byId.get(b.id)||byBody.get(b.bodyId);if(!a)return{...b};
    if(a.bodyFacing!==b.bodyFacing||a.bodyPose!==b.bodyPose){
      const radius=Math.max(a.bodyRadiusXY,b.bodyRadiusXY),x=Math.min(a.rootPoint.x,b.rootPoint.x)-radius,y=Math.min(a.rootPoint.y,b.rootPoint.y)-radius,z=Math.min(a.bodyMinZ,b.bodyMinZ);
      return{...b,x,y,z,w:Math.max(a.rootPoint.x,b.rootPoint.x)+radius-x,h:Math.max(a.rootPoint.y,b.rootPoint.y)+radius-y,height:Math.max(a.bodyMaxZ,b.bodyMaxZ)-z};
    }
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),z=Math.min(a.z,b.z);return{...b,x,y,z,w:Math.max(a.x+a.w,b.x+b.w)-x,h:Math.max(a.y+a.h,b.y+b.h)-y,height:Math.max(a.z+a.height,b.z+b.height)-z};
  });
}
export function createTrainPreparationWorkProvider(E,worldFor){
  const workActors=new WeakMap(),before=new WeakMap();let kernel;
  function otherBounds(s){
    const excluded=workActors.get(s)||new Set(),out=[];
    const work=train(s).preparation?.work,version=work?.kind==='issueMask'?(work.maskApproachVersion??(work.workId!==null?1:(PreparationLayout.DEFAULT_PREPARATION_BODY_GEOMETRY_VERSION??2))):(work?.bodyGeometryVersion??2);
    for(const row of capturePreparationBodyBounds(s,{geometryVersion:version}))if(!excluded.has(row.id)&&row.regionId==='snowbound'){
      const bodyRadiusXY=Math.max(...row.volumes.flatMap(v=>[v.min.x,v.max.x].flatMap(x=>[v.min.y,v.max.y].map(y=>Math.hypot(x-row.point.x,y-row.point.y))))),meta={bodyId:row.id,rootPoint:{...row.point},bodyFacing:row.pose.facing,bodyPose:JSON.stringify([row.pose,row.binding,row.radius,row.height]),bodyRadiusXY,bodyMinZ:Math.min(...row.volumes.map(v=>v.min.z)),bodyMaxZ:Math.max(...row.volumes.map(v=>v.max.z))};
      for(const [i,v]of row.volumes.entries())out.push({id:`${row.id}:${i}`,...meta,x:v.min.x,y:v.min.y,z:v.min.z,w:v.max.x-v.min.x,h:v.max.y-v.min.y,height:v.max.z-v.min.z});
    }
    return out;
  }
  function materialBounds(s){
    const out=[],box=(id,c,h)=>({id,x:c.x-h.x,y:c.y-h.y,z:c.z-h.z,w:h.x*2,h:h.y*2,height:h.z*2});
    const objects=s.campaign.missions[RIVAL_ID].objects;
    if(siteReady(s,'quarry-charge-worktop')){
      if(objects['charge-crate'].location.type==='station'&&objects['charge-crate'].location.targetId==='quarry-charge-store'){
        out.push(...Camp.TRAIN_CRATE_SOLIDS);
        for(const [id,slot]of Object.entries(Camp.TRAIN_CHILD_CONTACTS))if(objects[id].location.type==='crate'&&objects[id].location.targetId==='charge-crate')out.push(box(id,slot.center,TRAIN_CHARGE_HALF_EXTENTS));
      }
      if(objects['cap-tin'].location.type==='station'&&objects['cap-tin'].location.targetId==='quarry-charge-store')out.push(box('cap-tin',Camp.TRAIN_TIN_CENTER,Camp.TRAIN_TIN_SHAPE));
    }
    if(siteReady(s,'ruth-wiring-case-stand'))for(const [id,slot]of Object.entries(Camp.TRAIN_KIT_SLOTS)){const item=train(s).powder.kit[id];if(item?.location.type==='container'&&item.location.targetId===TRAIN_TOOL_CASE.id)out.push(box(id,slot.center,slot.halfExtents));}
    if(siteReady(s,'ada-mending-worktop'))out.push(...TRAIN_MASK_BASKET_SOLIDS);
    return out;
  }
  function physicalWorld(s){const base=worldFor(s),now=otherBounds(s),old=before.get(s),boxes=sweptPreparationBodyBounds(old?.boxes,now),priorBodies=new Set(old?.boxes.map(b=>b.bodyId)),currentBodies=new Set(now.map(b=>b.bodyId)),motionProven=!!old&&[...priorBodies].every(id=>currentBodies.has(id))&&[...currentBodies].every(id=>priorBodies.has(id));return{...base,motionProven,bodySampleAt:old?.at,obstacles:[...base.obstacles,...materialBounds(s),...boxes]};}
  kernel=createTrainCampWorkProvider(E,physicalWorld);
  const configFor=(s,op)=>isPreparationWatchOperation(op)?selectPreparationWatchFixture(s,op,worldFor(s)):simpleConfig(op.kind,op.options?.ref?.objectId,op.kind==='issue-mask'?train(s).preparation?.work?.maskApproachVersion:undefined);
  function entries(s,op){const config=configFor(s,op);if(!config)return null;workActors.set(s,new Set(op.actorIds));const result=op.actorIds.map(id=>kernel.prepareNativeActor(s,id,config.actors[id].target,{elbowHint:config.actors[id].elbowHint}));let map=poses.get(s);if(!map){map=new Map();poses.set(s,map);}const candidates=train(s).powder.pending.filter(w=>{if(w.kind!==op.kind)return false;const owned=inspectCustodyRequest(s,w.requestId)?.operation||train(s).powder.physicalEvents.find(event=>event.id===w.workId)?.data.operation;if(!owned)return false;const {cause,...actual}=owned,{cause:ignored,...expected}=op;return same(actual,expected);}),workId=typeof op.cause?.eventId==='string'?op.cause.eventId:candidates.length===1?candidates[0].workId:null;for(const e of result)map.set(e.body.id,{...e,liveStamp:stamp(e.body),operationKind:op.kind,workId});return result;}
  function fixedContact(s,id){if(id==='station:levi-holding')return preparationWatchContact(s);if(id==='quarry-charge-store')return copy(Camp.TRAIN_STORE_CONTACT);if(id===TRAIN_TOOL_CASE.id)return copy(Camp.TRAIN_CASE_CONTACT);if(id===TRAIN_MASK_SOURCE.id)return{x:TRAIN_MASK_SOURCE.x,y:TRAIN_MASK_SOURCE.y,z:TRAIN_MASK_SOURCE.handZ};return null;}
  function refPoint(s,ref){
    const item=resolveFixedRef(s,ref),l=item.location;
    if(item.kind==='sealed-quarry-charges'&&l.type==='station'&&l.targetId==='quarry-charge-store')return copy(Camp.TRAIN_CRATE_GRIP);
    if(item.kind==='sealed-charge'&&l.type==='crate'&&resolveFixedRef(s,original(l.targetId)).location.targetId==='quarry-charge-store')return copy(Camp.TRAIN_CHILD_CONTACTS[item.id].center);
    if(item.kind==='cap-tin'&&l.type==='station'&&l.targetId==='quarry-charge-store')return copy(Camp.TRAIN_TIN_CENTER);
    if(l.type==='container'&&l.targetId===TRAIN_TOOL_CASE.id&&Camp.TRAIN_KIT_SLOTS[item.id])return copy(Camp.TRAIN_KIT_SLOTS[item.id].center);
    throw new TypeError('Unproved preparation object location');
  }
  function contactWindow(s,op,span){
    const config=configFor(s,op);if(!active(s)||!config||span.finish!==s.elapsed||span.start>span.finish||span.finish-span.start>.1+1e-7)return null;
    const list=entries(s,op),world=physicalWorld(s),peopleClear=list.every(e=>!blockedAt(world,e.body.x,e.body.y,9));
    const actors=list.map(e=>({id:e.body.id,root:point(e.body),hand:copy(e.joints[2]),regionId:'snowbound',alive:e.body.hp>0,mounted:!!e.body.mounted,handUsable:e.usable,handFree:kernel.handFree(s,e.body.id)}));
    const endpoint=(p,extra)=>{const a=actors.reduce((best,a)=>!best||distance(a.hand,p)<distance(best.hand,p)?a:best,null);return{...extra,point:p,regionId:'snowbound',actorId:a.id,maxHandDistance:22};};
    return{...span,sweptClear:peopleClear&&(span.start===span.finish||world.motionProven&&world.bodySampleAt===span.start)&&kernel.inspectNativeInterval(s,JSON.stringify({kind:op.kind,actorIds:op.actorIds,refs:op.refs,to:op.to,options:op.options}),span.start,span.finish,list),actors,sources:op.refs.map(ref=>endpoint(refPoint(s,ref),{ref})),destinations:[],fixedContacts:powderFixedContactRoles(op).map(role=>({...role,point:fixedContact(s,role.id),maxHandDistance:22}))};
  }
  function prepare(s,work,dt){
    if(!active(s)||!Number.isFinite(dt)||dt<=0||dt>.1)return false;
    if(work.workId===null){if(work.kind==='issueMask'&&work.maskApproachVersion===undefined){const version=MaskGearData.TRAIN_MASK_V3_APPROACHES&&(PreparationLayout.DEFAULT_PREPARATION_BODY_GEOMETRY_VERSION??2)===3?3:2;work.maskApproachVersion=version;train(s).preparation.work.maskApproachVersion=version;}else if(work.kind!=='issueMask'&&work.bodyGeometryVersion===undefined&&(PreparationLayout.DEFAULT_PREPARATION_BODY_GEOMETRY_VERSION??2)===3){work.bodyGeometryVersion=3;train(s).preparation.work.bodyGeometryVersion=3;}}
    const config=intentConfig(work,s,worldFor(s),true);if(!config||config.site&&!siteReady(s,config.site))return false;
    let ready=true;
    for(const [id,role]of Object.entries(config.actors)){
      const a=s.entities[id];if(id!=='mara'&&(ownsPreparationStableActor(s,id)||ownsTrainStableCareActor(s,id)))return false;if(work.kind==='watch'&&id!=='mara'){a.holstered=true;a.aiming=false;}
      if(work.kind==='watch'&&id===work.args.fromActorId){a.vx=0;a.vy=0;a.route=[];delete a.routeTarget;facePreparationWatchGuard(s,id,dt,{worldFor});}
      else if(id!=='mara')followPreparationActor(s,id,role.pose,65,dt,{worldFor});
      const arrived=distance(point(a),role.pose)<=(id==='mara'?3:.051);
      if(arrived){if(id!=='mara'){a.pose=role.pose.pose;if(Math.hypot(a.vx||0,a.vy||0)>.01||Math.abs(Math.atan2(Math.sin((a.facing||0)-role.pose.facing),Math.cos((a.facing||0)-role.pose.facing)))>1e-6)ready=false;}}else ready=false;
      if(!kernel.handFree(s,id)||!kernel.handUsable(s,id))ready=false;
    }
    if(!ready)return false;
    // The explicit work request turns Mara only once its people are present.
    // Her position and ordinary crouch/standing control remain authoritative.
    if(config.actors.mara)s.entities.mara.facing=config.actors.mara.pose.facing;
    for(const [id,role]of Object.entries(config.actors))if(kernel.prepareNativeActor(s,id,role.target,{elbowHint:role.elbowHint}).human.rig.spW>1e-7)ready=false;
    return ready;
  }
  function prepareExchange(s,kind,dt){
    if(!active(s)||!Number.isFinite(dt)||dt<=0||dt>.1)return false;
    const targets=Camp.TRAIN_PREPARATION_EXCHANGE_APPROACHES[kind];if(!targets)return false;
    const guard=s.campaign.missions[RIVAL_ID].captivity.guardId;
    for(const [id,target]of Object.entries(targets)){
      const actor=s.entities[id];if(!actor||actor.hp<=0||actor.mounted||actor.attachment||id===guard||ownsPreparationStableActor(s,id)||ownsTrainStableCareActor(s,id)||Object.values(s.entities).some(a=>a.leading&&a.leaderId===id))continue;
      followPreparationActor(s,id,target,65,dt,{worldFor});if(distance(point(actor),target)<=.051){actor.pose=target.pose;}
    }return true;
  }
  return{context(s,base,dt=0){return{...base,preparationProofOwners:PREPARATION_PROOF_OWNERS,
    preparePreparationWork:(s,w)=>prepare(s,w,dt),
    preparePreparationExchange:prepareExchange,
    prepareCampWork(s){base.prepareCampWork(s);workActors.set(s,new Set());if(!active(s))return;const pending=train(s).powder.pending;for(const w of pending){const op=inspectCustodyRequest(s,w.requestId)?.operation||train(s).powder.physicalEvents.find(e=>e.id===w.workId)?.data.operation;if(configFor(s,op||{}))contactWindow(s,op,{start:s.elapsed,finish:s.elapsed});}before.set(s,{at:s.elapsed,boxes:otherBounds(s)});},
    powderContactWindow:(s,op,span)=>configFor(s,op)?contactWindow(s,op,span):base.powderContactWindow(s,op,span),
    fixedContact:(s,id)=>fixedContact(s,id)||base.fixedContact(s,id),
    custodySnapshot(s,args){if(args.refs.some(ref=>{try{refPoint(s,ref);return true;}catch{return false;}}))return{actors:args.actorIds.map(id=>({id,point:point(s.entities[id])})),sources:args.refs.map(ref=>({ref,point:refPoint(s,ref)})),destinations:[]};return base.custodySnapshot(s,args);},
    authorizePreparationInspection:(s,op)=>active(s)&&op.kind.startsWith('inspect-')&&validatePreparationWork(s,op,s.elapsed),
    authorizeCustodyOp:(s,op)=>configFor(s,op)?active(s)&&validatePreparationWork(s,op,s.elapsed):base.authorizeCustodyOp(s,op),
    preparationMaskEvidence(s,{choice}){const c=s.campaign.missions[RIVAL_ID].rival.continuation,item=s.itemInstances[TRAIN_MASK_ID],e={schema:1,choice,at:s.elapsed,revision:c.events.length,actorPosition:point(s.entities.mara),itemRef:item?gearRef():null,itemState:item?{owner:item.owner,location:copy(item.location)}:null,issueEventId:item?.issueEventId??null};return validatePreparationMaskEvidence(s,e)?e:null;},
  };}};
}
