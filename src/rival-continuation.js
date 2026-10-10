/** Version-five continuation of the SAME Rival objects. The old operation's
 * flags, scores, exchanges and transactions remain historical facts.
 * New possessions arise only from later accepted physical work. */
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_ID,TRAIN_WORLD,TRAIN_CARS} from '../content/campaign/brass-cutting.js';
import {TRAIN_KIT_DEFINITIONS,TRAIN_TOOL_CASE} from '../content/campaign/train-equipment.js';
import {TRAIN_BRIEFING_TABLE,TRAIN_BRIEFING_PAPER_CONTACTS} from '../content/campaign/train-camp.js';
import {inspectCustodyContactWindow} from './custody-contact.js';
import {isOriginalWeaponRef,resolveOriginalWeapon,prepareRivalWeaponLoan,validateRivalWeaponLoans,weaponLoanHistoricalState} from './rival-weapon-loan.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,isTrainGearRef,trainGearLocation,createTrainGearInstance,validateTrainGear} from './train-gear.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>JSON.parse(JSON.stringify(v));
const exactKeys=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const rec=s=>s?.campaign?.missions?.[RIVAL_ID];
const powder=s=>s?.campaign?.missions?.[TRAIN_ID]?.train?.powder;
const chargeIds=Array.from({length:4},(_,i)=>`quarry-sealed-charge-${i+1}`);
const rivalKinds={sightglass:'sightglass','cap-tin':'cap-tin','charge-crate':'sealed-quarry-charges','route-diagram':'document','seizure-list':'document','levi-debt-card':'debt-card',...Object.fromEntries(chargeIds.map(id=>[id,'sealed-charge']))};
const kitKinds=Object.fromEntries(TRAIN_KIT_DEFINITIONS.map(item=>[item.id,item.kind]));
const custodians=new Set(['mara','ruth','juno','tomas','bastian','della','inez','hob']);
const participants=new Set([...custodians,'ada']);

export const CUSTODY_WORK_SECONDS=Object.freeze({
  'issue-kit':TRAIN_TOOL_CASE.openSeconds,'open-tin':1.1,'move-object':.9,
  'unseal-charge':.65,'attach-primer':.8,'remove-primer':.8,'attach-fuse':.8,
  'light-fuse':.6,'blast-charge':0,'return-papers':1,'establish-guard':1,
  'guard-handover':1.1,'wire-pay-out':0,'cut-clamp':1.1,'damage-primer':0,
  'fasten-terminal':1,'disconnect-terminal':.7,'test-circuit':.6,
  'stroke-detonator':.4,'begin-wire':.6,
  'lend-weapon':1,'return-weapon':1,
  'issue-mask':TRAIN_MASK_SOURCE.issueSeconds,
});
export const CUSTODY_RECOVERY_SECONDS=2;
const operationKinds=new Set(['issue-kit','open-tin','move-object','unseal-charge','attach-primer','remove-primer','attach-fuse','light-fuse','blast-charge','return-papers','establish-guard','guard-handover','wire-pay-out','cut-clamp','damage-primer','lend-weapon','return-weapon','issue-mask']);
const finitePoint=p=>exactKeys(p,['x','y','z'])&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const refKey=ref=>`${ref.sourceMissionId}/${ref.objectId}`;
const stateOf=s=>rec(s)?.rival?.continuation;
const currentModel=s=>({objects:copy(rec(s).objects),kit:copy(powder(s)?.kit||{}),gear:s.itemInstances?.[TRAIN_MASK_ID]?{[TRAIN_MASK_ID]:copy(s.itemInstances[TRAIN_MASK_ID])}:{},guardPresent:Object.hasOwn(rec(s).captivity,'guardId'),guardId:rec(s).captivity.guardId??null});
function referenceKnown(ref){return isOriginalWeaponRef(ref)||isTrainGearRef(ref)||exactKeys(ref,['sourceMissionId','objectId'])&&(ref.sourceMissionId===RIVAL_ID&&(rivalKinds[ref.objectId]||/^quarry-primer-[1-6]$/.test(ref.objectId))||ref.sourceMissionId===TRAIN_ID&&kitKinds[ref.objectId]);}
function normalizeOperation(op){
  if(!object(op)||Object.keys(op).some(key=>!['kind','actorIds','refs','to','options','cause'].includes(key))||!operationKinds.has(op.kind)||!Array.isArray(op.actorIds)||new Set(op.actorIds).size!==op.actorIds.length||op.actorIds.some(id=>!participants.has(id))||op.actorIds.includes('ada')&&op.kind!=='issue-mask'||!Array.isArray(op.refs)||op.refs.some(ref=>!referenceKnown(ref))||new Set(op.refs.map(refKey)).size!==op.refs.length||!exactKeys(op.cause,['missionId','eventId'])||op.cause.missionId!==TRAIN_ID||!/^powder-event-[1-9]\d*$/.test(op.cause.eventId))return null;
  const value={kind:op.kind,actorIds:copy(op.actorIds),refs:copy(op.refs),to:op.to===undefined?null:copy(op.to),options:copy(op.options||{}),cause:copy(op.cause)};
  if(value.to!==null&&(!exactKeys(value.to,['owner','location'])||!custodians.has(value.to.owner)||!permittedLocation(value.to.location)))return null;
  const fields={ 'issue-kit':[],'open-tin':[],'move-object':[],'unseal-charge':['chargeId'],'attach-primer':['chargeId','primerId','mode'],'remove-primer':['chargeId','primerId'],'attach-fuse':['chargeId','fuseId'],'light-fuse':['chargeId','fuseId'],'blast-charge':['chargeId','trigger','physicalReceipt'],'return-papers':[],'establish-guard':['toActorId'],'guard-handover':['fromActorId','toActorId'],'wire-pay-out':['motion'],'cut-clamp':[],'damage-primer':['chargeId','primerId','physicalReceipt'],'lend-weapon':['weaponId'],'return-weapon':['weaponId'],'issue-mask':[] };
  const fittedMask=value.kind==='move-object'&&value.refs.length===1&&isTrainGearRef(value.refs[0])&&value.options?.maskFitVersion===2&&value.to?.owner==='mara'&&['worn','carried'].includes(value.to?.location?.type);
  if(!exactKeys(value.options,fittedMask?['maskFitVersion']:fields[value.kind])||!value.actorIds.length&&!['blast-charge','damage-primer'].includes(value.kind)||value.to!==null&&!['move-object','cut-clamp'].includes(value.kind))return null;
  if(value.refs.some(isOriginalWeaponRef)&&!['lend-weapon','return-weapon'].includes(value.kind))return null;
  return value;
}
export function physicalSnapshot(s,{actorIds,refs,destinations},ctx){
  if(!ctx||typeof ctx.custodySnapshot!=='function'||!Array.isArray(actorIds)||!Array.isArray(refs)||!Array.isArray(destinations))return null;
  try{
    for(const ref of refs)resolveFixedRef(s,ref);
    const result=ctx.custodySnapshot(s,{actorIds:copy(actorIds),refs:copy(refs),destinations:copy(destinations)});
    if(!exactKeys(result,['actors','sources','destinations'])||![result.actors,result.sources,result.destinations].every(Array.isArray)||result.actors.length!==actorIds.length||result.sources.length!==refs.length||result.destinations.length!==destinations.length)return null;
    if(result.actors.some((entry,i)=>!exactKeys(entry,['id','point'])||entry.id!==actorIds[i]||!finitePoint(entry.point)||!s.entities[entry.id]||s.entities[entry.id].hp<=0||Math.hypot(...['x','y','z'].map(k=>(s.entities[entry.id][k]||0)-entry.point[k]))>1e-6))return null;
    if(result.sources.some((entry,i)=>!exactKeys(entry,['ref','point'])||!same(entry.ref,refs[i])||!finitePoint(entry.point))||result.destinations.some((entry,i)=>!exactKeys(entry,['location','point'])||!same(entry.location,destinations[i])||!finitePoint(entry.point)))return null;
    return copy(result);
  }catch{return null;}
}
function bindings(s,refs){return refs.map(ref=>({ref:copy(ref),value:copy(resolveFixedRef(s,ref))}));}
function sameBindings(s,list){try{return list.every(entry=>same(entry.value,resolveFixedRef(s,entry.ref)));}catch{return false;}}
function lockedKeys(op){return [...op.actorIds.map(id=>'actor/'+id),...op.refs.map(ref=>refKey(ref)),...(op.kind==='issue-kit'?['container/'+TRAIN_TOOL_CASE.id]:[]),...(op.kind==='issue-mask'?['container/'+TRAIN_MASK_SOURCE.id]:[])];}
function componentLockConflict(s,op){
  const p=powder(s),wanted=lockedKeys(op);
  for(const work of p?.pending||[]){
    // Continuation-backed work is checked against its owning requests below.
    if(stateOf(s).requests[work.requestId])continue;
    const start=p.physicalEvents.find(e=>e.id===work.workId),other=start?.data?.operation;
    if(!object(other)||!Array.isArray(other.actorIds)||!Array.isArray(other.refs)||other.actorIds.some(id=>!participants.has(id))||other.refs.some(ref=>!referenceKnown(ref)))return true;
    if([...other.actorIds.map(id=>'actor/'+id),...other.refs.map(refKey)].some(key=>wanted.includes(key)))return true;
  }
  return false;
}
function accessReady(s,op,ctx){
  // Providers own the actual world, hands and finite carrying capacity. A
  // caller cannot replace any of these with a permissive cause boolean.
  if(['worldFor','pointForLocation','canContain','handUsable','handFree','powderContactWindow'].some(key=>typeof ctx?.[key]!=='function')||!ctx.worldFor(s))return false;
  for(const id of op.actorIds){const actor=s.entities[id];if(!actor||actor.hp<=0||actor.mounted||ctx.handUsable(s,id,op)!==true||ctx.handFree(s,id,op)!==true)return false;}
  if(op.to){
    const item=resolveFixedRef(s,op.refs[0]);
    if(ctx.canContain(s,item,op.to)!==true||!finitePoint(ctx.pointForLocation(s,op.to.location)))return false;
  }
  return true;
}
function contactReady(s,op,ctx,snapshot){
  if(!op.actorIds.length)return ['blast-charge','damage-primer'].includes(op.kind);
  const roles=op.kind==='issue-mask'?['mara','ada'].map(actorId=>({id:TRAIN_MASK_SOURCE.id,actorId,regionId:TRAIN_MASK_SOURCE.regionId})):op.kind==='issue-kit'?['mara','ruth'].map(actorId=>({id:TRAIN_TOOL_CASE.id,actorId,regionId:TRAIN_TOOL_CASE.regionId})):op.kind==='return-papers'?[{id:'actor:tomas:paper-handoff',actorId:'mara',regionId:'snowbound'}]:['establish-guard','guard-handover'].includes(op.kind)?op.actorIds.map(actorId=>({id:'station:levi-holding',actorId,regionId:'snowbound'})):['lend-weapon','return-weapon'].includes(op.kind)?[...['mara','bastian'].map(actorId=>({id:'station:community-rescue-chest',actorId,regionId:'snowbound'})),{id:'actor:bastian:weapon-handoff',actorId:'mara',regionId:'snowbound'}]:[];
  if(roles.length&&typeof ctx.fixedContact!=='function')return false;
  const fixedContacts=roles.map(role=>({...role,point:ctx.fixedContact(s,role.id)}));
  if(fixedContacts.some(contact=>!finitePoint(contact.point)))return false;
  const expected={start:s.elapsed,finish:s.elapsed,actorIds:op.actorIds,refs:op.refs,destinations:op.to?[op.to.location]:[],fixedContacts};
  const contact=inspectCustodyContactWindow(ctx.powderContactWindow(s,op,{start:s.elapsed,finish:s.elapsed}),expected);
  return !!contact&&same(contact,snapshot);
}
export function beginCustodyRequest(s,operation,ctx){
  if(!usesRivalContinuation(s)||!rec(s).mission.completed||!Number.isFinite(s.elapsed)||typeof ctx?.authorizeCustodyOp!=='function'||typeof ctx?.powderContactWindow!=='function')return null;
  try{
    const op=normalizeOperation(operation),c=stateOf(s);if(!op||ctx.authorizeCustodyOp(s,op)!==true||!accessReady(s,op,ctx)||!object(powder(s))||!object(powder(s).kit)||!Array.isArray(powder(s).custodyEventRefs))return null;
    if(['lend-weapon','return-weapon'].includes(op.kind)&&!prepareRivalWeaponLoan(s,op))return null;
    const keys=lockedKeys(op);if(componentLockConflict(s,op)||Object.values(c.requests).some(request=>lockedKeys(request.operation).some(key=>keys.includes(key))))return null;
    const snapshot=physicalSnapshot(s,{actorIds:op.actorIds,refs:op.refs,destinations:op.to?[op.to.location]:[]},ctx);if(!snapshot||!contactReady(s,op,ctx,snapshot))return null;
    const sourceBindings=bindings(s,op.refs);
    if(c.initializedAt===null){const {gear,...oldModel}=currentModel(s);if(Object.keys(gear).length)return null;c.initializedAt=s.elapsed;c.baseline={at:s.elapsed,...oldModel};}
    const id=`${TRAIN_ID}:custody-request:${++c.requestSerial}`;
    c.requests[id]={id,operation:op,startedAt:s.elapsed,sourceBindings};
    return{requestId:id,kind:op.kind,requiredSeconds:CUSTODY_WORK_SECONDS[op.kind]};
  }catch{return null;}
}
export function inspectCustodyRequest(s,id){const request=stateOf(s)?.requests?.[id];return request?copy(request):null;}
export function cancelCustodyRequest(s,id){const c=stateOf(s);if(!c?.requests?.[id])return false;delete c.requests[id];return true;}
/** Owner-side rollback for one synchronous physical hazard interruption.
 * Powder restores its own pending/events; it never writes this ledger. The
 * ordinary guarded commit separately restores material and blast effects.
 */
export function prepareCustodyInterruption(s){
  if(!usesRivalContinuation(s)||!Number.isFinite(s.elapsed)||!object(stateOf(s)))return null;
  const c=stateOf(s),snapshot=copy(c),at=s.elapsed;
  return{rollback(){if(stateOf(s)!==c||s.elapsed!==at)throw new TypeError('A custody interruption cannot roll back another accepted frame');for(const key of Object.keys(c))delete c[key];Object.assign(c,copy(snapshot));return true;}};
}
const ref=(sourceMissionId,objectId)=>({sourceMissionId,objectId});
function modelObject(model,reference){
  if(isTrainGearRef(reference))return model.gear?.[reference.objectId];
  if(reference.sourceMissionId===TRAIN_ID)return model.kit[reference.objectId];
  if(/^quarry-primer-[1-6]$/.test(reference.objectId))return model.objects['cap-tin']?.primers?.find(p=>p.id===reference.objectId);
  return model.objects[reference.objectId];
}
function chargePowder(charge){return charge.powder||(charge.powder={schema:1,mode:null,primerId:null,fuseRef:null,spent:false,blastId:null,spentPrimerId:null,spentFuseRef:null});}
function requiredReferences(op,ids){return ids.every(([mission,id])=>op.refs.some(r=>r.sourceMissionId===mission&&r.objectId===id));}
function permittedLocation(location){
  if(!object(location))return false;
  if(location.type==='worn')return trainGearLocation(location);
  if(['carried','saddle','crate'].includes(location.type))return exactKeys(location,['type','targetId'])&&(location.type==='carried'?custodians.has(location.targetId):location.type==='crate'?location.targetId==='charge-crate':['copper','plover','bracken','cinder','tomas-mount'].includes(location.targetId));
  if(['station','container'].includes(location.type)){
    if(!exactKeys(location,['type','targetId','regionId']))return false;
    if(location.type==='container')return location.targetId===TRAIN_TOOL_CASE.id&&location.regionId===TRAIN_TOOL_CASE.regionId;
    const stations=location.regionId===TRAIN_WORLD.id?Object.values(TRAIN_WORLD.stations):location.regionId==='snowbound'?[...RIVAL_WORLD.camp.props,TRAIN_BRIEFING_TABLE,...Object.values(TRAIN_BRIEFING_PAPER_CONTACTS)]:[];
    return stations.some(station=>station.id===location.targetId);
  }
  if(location.type==='car'){
    const contact=TRAIN_CARS.find(car=>car.id===location.carId)?.contacts.find(contact=>contact.id===location.contactId);
    return exactKeys(location,['type','carId','contactId','local','regionId'])&&finitePoint(location.local)&&location.regionId===TRAIN_WORLD.id&&contact&&same(location.local,contact.local);
  }
  return false;
}
function lengthOf(points){if(!Array.isArray(points)||!points.length||points.some(p=>!finitePoint(p)))throw new TypeError('Finite physical trace required');return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(...['x','y','z'].map(k=>p[k]-points[i][k])),0);}
function account(model){
  const crate=model.objects['charge-crate'];if(!crate)return;
  crate.issuedCount=4;crate.issuedChargeIds=[...chargeIds];
  crate.chargeIds=chargeIds.filter(id=>{const c=model.objects[id];return !c.powder?.spent&&c.location.type==='crate'&&c.location.targetId===crate.id;});
  crate.count=crate.chargeIds.length;crate.consumedChargeIds=chargeIds.filter(id=>model.objects[id]?.powder?.spent);
  for(const id of crate.chargeIds)model.objects[id].owner=crate.owner;
}
function deriveOperation(model,op,id,at,derivation=null){
  const next=copy(model),o=op.options,tin=next.objects['cap-tin'];
  const child=chargeIds.includes(o.chargeId)?next.objects[o.chargeId]:null;
  const unit=typeof o.primerId==='string'?tin?.primers?.find(p=>p.id===o.primerId):null;
  const fail=message=>{throw new TypeError(message);};
  const need=(ok,message)=>{if(!ok)fail(message);};
  if(op.kind==='issue-mask'){
    need(same(op.actorIds,['mara','ada'])&&op.refs.length===0&&op.to===null&&!next.gear[TRAIN_MASK_ID],'Only Ada’s actual first basket handoff can issue the windwrap');next.gear[TRAIN_MASK_ID]=createTrainGearInstance(at,id);
  }else if(op.kind==='issue-kit'){
    need(op.actorIds.includes('mara')&&op.actorIds.includes('ruth')&&op.refs.length===0&&op.to===null&&Object.keys(next.kit).length===0,'Only the actual first case issue can create kit');
    for(const definition of TRAIN_KIT_DEFINITIONS){const {ownerId,location,...data}=definition;next.kit[data.id]={...copy(data),owner:ownerId,location:{...copy(location),regionId:TRAIN_TOOL_CASE.regionId},sourceOwnerId:ownerId,sourceCaseId:TRAIN_TOOL_CASE.id,issuedAt:at,issueEventId:id};}
    Object.assign(next.kit['brass-wire-spool'],{onReel:420,deployedLength:0,cutoffLength:0,lostLength:0,deploymentClosed:false});
    for(const fuseId of ['brass-fuse-a','brass-fuse-b'])Object.assign(next.kit[fuseId],{state:'intact',chargeId:null,litAt:null,spentAt:null});
  }else if(op.kind==='open-tin'){
    need(op.actorIds.includes('ruth')&&requiredReferences(op,[[RIVAL_ID,'cap-tin']])&&tin&&tin.primers===undefined&&tin.openingEventId===undefined,'Only the actual first tin opening can reveal primers');
    tin.openedAt=at;tin.openingEventId=id;tin.primers=Array.from({length:6},(_,i)=>({id:`quarry-primer-${i+1}`,kind:'game-primer',state:'in-tin',location:{type:'tin',targetId:'cap-tin',compartment:'usable'},sourceTinId:'cap-tin',openingEventId:id,chargeId:null,lastChargeId:null,lastEventId:id}));
  }else if(op.kind==='move-object'){
    need(op.refs.length>=1&&op.to&&permittedLocation(op.to.location),'A physical exclusive destination is required');
    const item=modelObject(next,op.refs[0]);need(item&&item.kind!=='game-primer'&&!item.powder?.spent&&item.state!=='spent'&&(item.kind!=='game-fuse'||item.chargeId===null&&item.state==='intact'),'Consumed, attached fuse and derived primer custody cannot move independently');
    if(isTrainGearRef(op.refs[0]))need(op.refs.length===1&&same(op.actorIds,['mara'])&&op.to.owner==='mara'&&trainGearLocation(op.to.location),'Only Mara can carry, wear or saddle the same owned windwrap');
    else need(op.to.location.type!=='worn','Only the finite windwrap can occupy the face slot');
    need(item.owner!==null&&['mara','ruth','juno','tomas','bastian','della','inez','hob'].includes(op.to.owner),'Unsupported current custodian');
    if(op.to.location.type==='carried')need(op.to.owner===op.to.location.targetId,'Carrier must be custodian');
    if(item.location.type==='carried')need(op.actorIds.includes(item.location.targetId),'An actual carrying source must join the handoff');
    if(op.to.location.type==='carried')need(op.actorIds.includes(op.to.location.targetId),'An actual receiving carrier must join the handoff');
    if(op.to.location.type==='crate')need(item.kind==='sealed-charge'&&op.to.location.targetId==='charge-crate'&&op.to.owner===next.objects['charge-crate'].owner&&!item.powder?.primerId&&!item.powder?.fuseRef,'Only unprimed original children enter their crate');
    if(item.kind==='sealed-charge'&&op.to.location.type==='car'){
      const contact=TRAIN_CARS.find(car=>car.id===op.to.location.carId)?.contacts.find(contact=>contact.id===op.to.location.contactId);
      need(contact?.kind==='charge-placement'&&!chargeIds.some(id=>id!==item.id&&!next.objects[id].powder?.spent&&next.objects[id].location.type==='car'&&next.objects[id].location.carId===op.to.location.carId&&next.objects[id].location.contactId===op.to.location.contactId),'A finite charge socket must be free');
    }
    need(!same({owner:item.owner,location:item.location},op.to),'A transfer cannot be a duplicate no-op');item.owner=op.to.owner;item.location=copy(op.to.location);
    if(item.powder?.fuseRef){const fuse=modelObject(next,item.powder.fuseRef);need(fuse,'Attached fuse must exist');fuse.owner=item.owner;}
  }else if(op.kind==='unseal-charge'){
    need(child&&child.sealed===true&&!child.powder?.spent&&requiredReferences(op,[[RIVAL_ID,child.id]]),'An actual sealed original child is required');child.sealed=false;chargePowder(child);
  }else if(op.kind==='attach-primer'){
    need(child&&child.sealed===false&&unit&&unit.state==='in-tin'&&['wired','fused'].includes(o.mode)&&requiredReferences(op,[[RIVAL_ID,'cap-tin'],[RIVAL_ID,child.id],[RIVAL_ID,unit.id]]),'An owned unsealed child and available original primer are required');
    need(o.mode==='wired'?child.id===chargeIds[0]:[chargeIds[1],chargeIds[2]].includes(child.id),'Unsupported charge/primer role');
    const p=chargePowder(child);need(!p.spent&&p.primerId===null,'Charge already primed/spent');p.mode=o.mode;p.primerId=unit.id;Object.assign(unit,{state:'attached',location:{type:'charge',targetId:child.id},chargeId:child.id,lastChargeId:child.id,lastEventId:id});
  }else if(op.kind==='damage-primer'){
    need(child&&unit&&unit.state==='attached'&&child.powder?.primerId===unit.id&&requiredReferences(op,[[RIVAL_ID,'cap-tin'],[RIVAL_ID,child.id],[RIVAL_ID,unit.id]]),'Actual attached primer required');unit.state='damaged';unit.lastEventId=id;
  }else if(op.kind==='remove-primer'){
    need(child&&unit&&['attached','damaged'].includes(unit.state)&&child.powder?.primerId===unit.id&&requiredReferences(op,[[RIVAL_ID,'cap-tin'],[RIVAL_ID,child.id],[RIVAL_ID,unit.id]]),'Actual attached primer required');
    need(!child.powder.fuseRef||next.kit[child.powder.fuseRef.objectId]?.state==='intact','A burning or spent fuse cannot release its live primer');
    const damaged=unit.state==='damaged';child.powder.primerId=null;Object.assign(unit,{state:damaged?'damaged':'in-tin',location:{type:'tin',targetId:'cap-tin',compartment:damaged?'unserviceable':'usable'},chargeId:null,lastChargeId:child.id,lastEventId:id});
  }else if(op.kind==='attach-fuse'){
    const fuse=next.kit[o.fuseId],p=child&&chargePowder(child);need(child&&p&&!p.spent&&p.mode==='fused'&&p.primerId&&fuse?.kind==='game-fuse'&&fuse.state==='intact'&&fuse.chargeId===null&&p.fuseRef===null&&o.fuseId===(child.id===chargeIds[1]?'brass-fuse-a':'brass-fuse-b')&&requiredReferences(op,[[RIVAL_ID,child.id],[TRAIN_ID,o.fuseId]]),'Actual appropriate hinge fuse required');
    p.fuseRef=ref(TRAIN_ID,o.fuseId);fuse.location={type:'charge',targetId:child.id};fuse.owner=child.owner;fuse.chargeId=child.id;
  }else if(op.kind==='light-fuse'){
    const fuse=next.kit[o.fuseId],p=child?.powder;need(child&&p&&!p.spent&&p.primerId&&tin.primers.find(primer=>primer.id===p.primerId)?.state==='attached'&&p.fuseRef?.objectId===o.fuseId&&fuse?.state==='intact'&&child.location.type==='car'&&child.location.contactId===(child.id===chargeIds[1]?'private-hinge-a':'private-hinge-b')&&requiredReferences(op,[[RIVAL_ID,child.id],[RIVAL_ID,p.primerId],[TRAIN_ID,o.fuseId]]),'Actual unlit placed charge, attached primer and fuse required');fuse.state='burning';fuse.litAt=at;
  }else if(op.kind==='blast-charge'){
    need(child&&!child.powder?.spent&&['fuse','projectile'].includes(o.trigger)&&requiredReferences(op,[[RIVAL_ID,child.id]]),'Actual unspent blast child required');
    const p=chargePowder(child);if(o.trigger==='fuse')need(p.fuseRef&&next.kit[p.fuseRef.objectId]?.state==='burning','Actual burning fuse required');
    need(requiredReferences(op,[...(p.primerId?[[RIVAL_ID,p.primerId]]:[]),...(p.fuseRef?[[TRAIN_ID,p.fuseRef.objectId]]:[])]),'Every committed attached unit must be locked by the blast request');
    if(p.primerId){const primer=tin.primers.find(unit=>unit.id===p.primerId);need(primer,'Missing attached primer');Object.assign(primer,{state:'spent',location:{type:'consumed',eventId:id,regionId:'brass-cutting'},chargeId:null,lastChargeId:child.id,lastEventId:id});p.spentPrimerId=p.primerId;p.primerId=null;}
    if(p.fuseRef){const fuse=modelObject(next,p.fuseRef);need(fuse,'Missing attached fuse');Object.assign(fuse,{state:'spent',location:{type:'consumed',eventId:id,regionId:'brass-cutting'},owner:null,spentAt:at});p.spentFuseRef=copy(p.fuseRef);p.fuseRef=null;}
    child.sealed=false;child.owner=null;child.location={type:'consumed',eventId:id,regionId:'brass-cutting'};p.spent=true;p.blastId=id;
  }else if(op.kind==='return-papers'){
    need(requiredReferences(op,[[RIVAL_ID,'route-diagram'],[RIVAL_ID,'seizure-list']])&&op.actorIds.includes('mara')&&op.actorIds.includes('tomas'),'Both actual speakers and papers required');
    for(const key of ['route-diagram','seizure-list']){const paper=next.objects[key];need(paper?.owner==='mara'&&paper.location.type==='carried'&&paper.location.targetId==='mara','Actual borrowed originals required');paper.owner='tomas';paper.location={type:'carried',targetId:'tomas'};}
  }else if(op.kind==='establish-guard'||op.kind==='guard-handover'){
    need(['bastian','inez','hob'].includes(o.toActorId)&&op.actorIds.includes(o.toActorId)&&op.actorIds.includes('mara'),'Actual named incoming keeper and Mara required');
    if(op.kind==='establish-guard')need(!next.guardPresent,'Known guard requires a handover');else need(next.guardPresent&&next.guardId===o.fromActorId&&op.actorIds.includes(o.fromActorId)&&o.fromActorId!==o.toActorId,'Actual outgoing keeper required');
    next.guardPresent=true;next.guardId=o.toActorId;
  }else if(op.kind==='wire-pay-out'){
    const spool=next.kit['brass-wire-spool'],m=o.motion;need(spool&&!spool.deploymentClosed&&requiredReferences(op,[[TRAIN_ID,spool.id]])&&object(m)&&m.actorId===op.actorIds[0]&&finitePoint(m.from)&&finitePoint(m.to)&&object(m.trace)&&m.trace.clear===true&&m.trace.hit===null,'Accepted owned wire motion required');
    const amount=lengthOf(m.trace.groundPoints);need(amount>0&&amount<=spool.onReel+1e-7&&Math.abs(amount-m.trace.length3d)<1e-7&&same(m.trace.groundPoints[0],m.from)&&same(m.trace.groundPoints.at(-1),m.to)&&m.trace.groundPoints.slice(1).every((p,i)=>Math.hypot(...['x','y','z'].map(k=>p[k]-m.trace.groundPoints[i][k]))<=4+1e-7),'Payout must equal its actual bounded ground trace');spool.onReel-=amount;spool.deployedLength+=amount;
  }else if(op.kind==='cut-clamp'){
    const spool=next.kit['brass-wire-spool'],lead=next.kit['brass-circuit-lead'];need(spool&&lead&&!spool.deploymentClosed&&requiredReferences(op,[[TRAIN_ID,spool.id],[TRAIN_ID,lead.id],[TRAIN_ID,'brass-terminal-pliers']])&&object(derivation),'Actual cut/clamp geometry required');
    const cutoff=lengthOf(derivation.cutoffPoints),lost=lengthOf(derivation.lostPoints);need(cutoff+lost<=spool.onReel+1e-7&&op.to&&permittedLocation(op.to.location),'Measured finite cut required');spool.onReel-=cutoff+lost;spool.cutoffLength+=cutoff;spool.lostLength+=lost;spool.deploymentClosed=true;lead.owner=op.to.owner;lead.location=copy(op.to.location);
  }else if(!['lend-weapon','return-weapon'].includes(op.kind))fail('Unsupported continuation operation');
  account(next);return next;
}
function effectsBetween(before,after){const effects=[];for(const [mission,key]of [[RIVAL_ID,'objects'],[TRAIN_ID,'kit'],[TRAIN_ID,'gear']])for(const id of new Set([...Object.keys(before[key]),...Object.keys(after[key])]))if(!same(before[key][id]??null,after[key][id]??null))effects.push({ref:ref(mission,id),before:before[key][id]??null,after:after[key][id]??null});return effects;}
function applyModel(s,model){
  for(const [target,source]of [[rec(s).objects,model.objects],[powder(s).kit,model.kit]]){
    for(const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];
    for(const [key,value]of Object.entries(source)){if(object(target[key])){for(const property of Object.keys(target[key]))if(!Object.hasOwn(value,property))delete target[key][property];Object.assign(target[key],copy(value));}else target[key]=copy(value);}
  }
  if(model.gear[TRAIN_MASK_ID])s.itemInstances[TRAIN_MASK_ID]=copy(model.gear[TRAIN_MASK_ID]);else delete s.itemInstances[TRAIN_MASK_ID];
  if(model.guardPresent)rec(s).captivity.guardId=model.guardId;else delete rec(s).captivity.guardId;
}
function validReceipt(s,request,receipt){
  return exactKeys(receipt,['startedAt','finishedAt','acceptedSeconds','actors','sources','destinations','cause'])&&[receipt.startedAt,receipt.finishedAt,receipt.acceptedSeconds].every(Number.isFinite)&&receipt.startedAt===request.startedAt&&receipt.finishedAt===s.elapsed&&receipt.acceptedSeconds>=CUSTODY_WORK_SECONDS[request.operation.kind]-1e-7&&receipt.acceptedSeconds>=0&&receipt.acceptedSeconds<=receipt.finishedAt-receipt.startedAt+1e-7&&same(receipt.cause,request.operation.cause);
}
export function commitCustody(s,{requestId,acceptedWorkReceipt},ctx){
  const c=stateOf(s),request=c?.requests?.[requestId];if(!request||!usesRivalContinuation(s)||typeof ctx?.authorizeCustodyOp!=='function'||typeof ctx?.validateCustodyCause!=='function'||typeof ctx?.prepareCustodyPhysicalEffects!=='function')return null;
  const transactions=[];let before=null,oldEvents,oldRefs;const oldGearPresent=Object.hasOwn(c,'gearVersion'),oldGearVersion=c.gearVersion;
  try{
    const op=request.operation;if(ctx.authorizeCustodyOp(s,op)!==true||!accessReady(s,op,ctx)||!sameBindings(s,request.sourceBindings)||!validReceipt(s,request,acceptedWorkReceipt)||ctx.validateCustodyCause(s,op,acceptedWorkReceipt,requestId)!==true)return null;
    const snap=physicalSnapshot(s,{actorIds:op.actorIds,refs:op.refs,destinations:op.to?[op.to.location]:[]},ctx);if(!snap||!contactReady(s,op,ctx,snap)||!same(snap,{actors:acceptedWorkReceipt.actors,sources:acceptedWorkReceipt.sources,destinations:acceptedWorkReceipt.destinations}))return null;
    let derivation=null;
    if(op.kind==='wire-pay-out'&&(typeof ctx.validateAcceptedMotion!=='function'||ctx.validateAcceptedMotion(s,op.options.motion)!==true))return null;
    if(op.kind==='damage-primer'&&(typeof ctx.validateTerminalStrain!=='function'||ctx.validateTerminalStrain(s,op.options.physicalReceipt)!==true))return null;
    if(op.kind==='cut-clamp'){if(typeof ctx.wireCutGeometry!=='function')return null;derivation=ctx.wireCutGeometry(s,op,acceptedWorkReceipt);}
    const id=`${RIVAL_ID}:continued:${c.events.length+1}`;
    before=currentModel(s);const after=deriveOperation(before,op,id,s.elapsed,derivation),event={id,seq:c.events.length+1,requestId,kind:op.kind,at:s.elapsed,operation:copy(op),workReceipt:copy(acceptedWorkReceipt),derivation:copy(derivation),effects:effectsBetween(before,after),guardChange:same([before.guardPresent,before.guardId],[after.guardPresent,after.guardId])?null:{before:before.guardId,after:after.guardId}};
    if(['lend-weapon','return-weapon'].includes(op.kind)){const tx=prepareRivalWeaponLoan(s,op);if(!tx)return null;event.weaponChange=copy(tx.change);transactions.push(tx);}
    if(op.kind==='blast-charge'){
      if(typeof ctx.blastGeometry!=='function'||typeof ctx.prepareBlastEffects!=='function')return null;
      const physical=ctx.blastGeometry(s,{chargeRef:ref(RIVAL_ID,op.options.chargeId),trigger:op.options.trigger,cause:op.cause});
      if(!object(physical)||!same(physical,op.options.physicalReceipt))return null;derivation={...copy(physical),custodyEventId:id};event.derivation=derivation;transactions.push(ctx.prepareBlastEffects(s,derivation));
    }
    transactions.push(ctx.prepareCustodyPhysicalEffects(s,op,event));
    if(transactions.some(tx=>!object(tx)||typeof tx.apply!=='function'||typeof tx.rollback!=='function'||tx.apply.constructor.name==='AsyncFunction'||tx.rollback.constructor.name==='AsyncFunction'))return null;
    oldEvents=c.events.length;oldRefs=[...powder(s).custodyEventRefs];
    applyModel(s,after);c.events.push(event);if(op.kind==='issue-mask')c.gearVersion=1;powder(s).custodyEventRefs.push(id);delete c.requests[requestId];
    for(const tx of transactions){const result=tx.apply();if(result&&typeof result.then==='function')throw new TypeError('Physical custody commits must be synchronous');}
    if(!same(currentModel(s),after)||c.events.length!==oldEvents+1||c.events.at(-1)!==event||!same(powder(s).custodyEventRefs,[...oldRefs,id])||!validateRivalWeaponLoans(s,c.events)||!validateTrainGear(s))throw new TypeError('Physical result changed canonical custody authority');
    return{eventId:id,event:copy(event),changedRefs:event.effects.map(effect=>copy(effect.ref))};
  }catch{
    if(before&&oldEvents!==undefined){for(const tx of transactions.reverse())try{tx?.rollback?.();}catch{}applyModel(s,before);if(oldGearPresent)c.gearVersion=oldGearVersion;else delete c.gearVersion;c.events.length=oldEvents;powder(s).custodyEventRefs.splice(0,powder(s).custodyEventRefs.length,...oldRefs);c.requests[requestId]=request;}
    return null;
  }
}
export function applyAcceptedMotion(s,operation,acceptedWorkReceipt,ctx){const requested=beginCustodyRequest(s,operation,ctx);if(!requested)return null;const result=commitCustody(s,{requestId:requested.requestId,acceptedWorkReceipt},ctx);if(!result)cancelCustodyRequest(s,requested.requestId);return result;}
export function createRivalContinuation(){return{schema:1,initializedAt:null,baseline:null,requestSerial:0,requests:{},events:[]};}
export function enableRivalContinuation(record){
  if(!record?.rival||record.rival.continuationVersion!==undefined||record.rival.continuation!==undefined)return false;
  record.rival.continuationVersion=1;record.rival.continuation=createRivalContinuation();return true;
}
export function usesRivalContinuation(s){return s?.version===5&&rec(s)?.rival?.continuationVersion===1;}
export function resolveFixedRef(s,reference,expectedKind=null){
  if(!exactKeys(reference,['sourceMissionId','objectId']))throw new TypeError('A fixed source/object reference is required');
  if(isOriginalWeaponRef(reference)){const weapon=resolveOriginalWeapon(s,reference);if(expectedKind!==null&&weapon.kind!==expectedKind)throw new TypeError('Incompatible original firearm');return weapon;}
  let value,kind;
  if(reference.sourceMissionId===RIVAL_ID){
    kind=rivalKinds[reference.objectId];
    if(kind)value=rec(s)?.objects?.[reference.objectId];
    else if(/^quarry-primer-[1-6]$/.test(reference.objectId)){
      kind='game-primer';const tin=rec(s)?.objects?.['cap-tin'],c=rec(s)?.rival?.continuation;
      if(tin?.openingEventId&&c?.events?.some(event=>event.id===tin.openingEventId&&event.kind==='open-tin'))value=tin.primers?.find(unit=>unit.id===reference.objectId);
    }
  }else if(isTrainGearRef(reference)){kind='face-covering';if(stateOf(s)?.gearVersion===1)value=s.itemInstances?.[reference.objectId];}
  else if(reference.sourceMissionId===TRAIN_ID){kind=kitKinds[reference.objectId];if(kind)value=powder(s)?.kit?.[reference.objectId];}
  if(!value||value.id!==reference.objectId||value.kind!==kind||expectedKind!==null&&expectedKind!==kind)throw new TypeError('Missing or incompatible authoritative object reference');
  return value;
}
export function continuationPaperOwner(s){
  if(!usesRivalContinuation(s))return null;
  const c=rec(s).rival.continuation;if(c.initializedAt===null)return null;
  const a=rec(s).objects['route-diagram'],b=rec(s).objects['seizure-list'];
  return a&&b&&a.owner===b.owner?a.owner:null;
}
function originalFieldsAbsent(objects){
  if(!object(objects))return false;
  const tin=objects['cap-tin'],crate=objects['charge-crate'];
  return (!tin||!['primers','openedAt','openingEventId'].some(key=>Object.hasOwn(tin,key)))&&(!crate||!['issuedChargeIds','issuedCount','consumedChargeIds'].some(key=>Object.hasOwn(crate,key)))&&!chargeIds.some(id=>objects[id]?.powder!==undefined);
}
function legacyGuardAllowed(r){
  const ordered=r?.transactions?.[`${RIVAL_ID}:question:temporaryHold`]?.completed===true,present=Object.hasOwn(r?.captivity||{},'guardId');
  if(!present)return r?.rival?.questioningVersion!==1||!ordered;
  return r.captivity.guardId==='bastian'&&r.flags.bound===true&&r.flags.held===true&&(r.rival.questioningVersion!==1||ordered);
}
function modelReference(model,reference){
  const value=modelObject(model,reference),kind=isTrainGearRef(reference)?'face-covering':reference.sourceMissionId===TRAIN_ID?kitKinds[reference.objectId]:rivalKinds[reference.objectId]||'game-primer';
  if(!value||value.id!==reference.objectId||value.kind!==kind)throw new TypeError('Missing historical fixed object');return value;
}
function receiptShape(receipt,op,startedAt,finishedAt){
  if(!exactKeys(receipt,['startedAt','finishedAt','acceptedSeconds','actors','sources','destinations','cause'])||receipt.startedAt!==startedAt||receipt.finishedAt!==finishedAt||!Number.isFinite(receipt.acceptedSeconds)||receipt.acceptedSeconds<CUSTODY_WORK_SECONDS[op.kind]-1e-7||receipt.acceptedSeconds<0||receipt.acceptedSeconds>finishedAt-startedAt+1e-7||!same(receipt.cause,op.cause))return false;
  const destinations=op.to?[op.to.location]:[];
  return Array.isArray(receipt.actors)&&receipt.actors.length===op.actorIds.length&&receipt.actors.every((entry,i)=>exactKeys(entry,['id','point'])&&entry.id===op.actorIds[i]&&finitePoint(entry.point))&&Array.isArray(receipt.sources)&&receipt.sources.length===op.refs.length&&receipt.sources.every((entry,i)=>exactKeys(entry,['ref','point'])&&same(entry.ref,op.refs[i])&&finitePoint(entry.point))&&Array.isArray(receipt.destinations)&&receipt.destinations.length===destinations.length&&receipt.destinations.every((entry,i)=>exactKeys(entry,['location','point'])&&same(entry.location,destinations[i])&&finitePoint(entry.point));
}
function acceptedIntervals(intervals,start,finish,seconds){
  if(!Array.isArray(intervals)||!intervals.length)return false;
  let at=start,total=0;for(const interval of intervals){if(!exactKeys(interval,['start','finish'])||!Number.isFinite(interval.start)||Math.abs(interval.start-at)>1e-7||!Number.isFinite(interval.finish)||interval.finish<=interval.start||interval.finish-interval.start>.25+1e-7)return false;total+=interval.finish-interval.start;at=interval.finish;}
  return at===finish&&Math.abs(total-seconds)<=1e-7;
}
function eventPhysicalProof(p,event){
  const cause=p.physicalEvents?.find(physical=>physical.id===event.operation.cause.eventId);
  if(!cause)return false;
  if(CUSTODY_WORK_SECONDS[event.kind]>0){
    const completed=p.physicalEvents.filter(physical=>physical.kind==='work-completed'&&physical.data?.custodyEventId===event.id);
    return cause.kind==='work-started'&&exactKeys(cause.data,['operationKind','requestId'])&&cause.at===event.workReceipt.startedAt&&cause.data.operationKind===event.kind&&cause.data.requestId===event.requestId&&completed.length===1&&exactKeys(completed[0].data,['workId','custodyEventId','acceptedSeconds','intervals'])&&completed[0].at===event.at&&completed[0].data.workId===cause.id&&completed[0].data.acceptedSeconds===event.workReceipt.acceptedSeconds&&acceptedIntervals(completed[0].data.intervals,cause.at,event.at,event.workReceipt.acceptedSeconds);
  }
  const expected={'wire-pay-out':'wire-motion','damage-primer':'terminal-released','blast-charge':'charge-blast'}[event.kind];
  return cause.kind===expected&&cause.at===event.at&&cause.data?.custodyEventId===event.id&&event.workReceipt.acceptedSeconds===0&&event.workReceipt.startedAt===event.at&&(event.kind!=='wire-pay-out'||same(cause.data.motion,event.operation.options.motion))&&(event.kind!=='damage-primer'||same(cause.data.physicalReceipt,event.operation.options.physicalReceipt))&&(event.kind!=='blast-charge'||same(cause.data.chargeRef,ref(RIVAL_ID,event.operation.options.chargeId))&&cause.data.trigger===event.operation.options.trigger);
}
/** Only the original operation's inventory/guard view is projected. Its score,
 * heard exchanges, care, living bodies and weapons stay the actual records.
 * The projection is detached and is never a gameplay or export authority. */
export function rivalHistoricalValidationState(s){
  const c=stateOf(s);if(!usesRivalContinuation(s)||c?.initializedAt===null)return s;
  const r=rec(s),rival={...r.rival};delete rival.continuation;delete rival.continuationVersion;
  const captivity={...r.captivity};if(c.baseline.guardPresent)captivity.guardId=c.baseline.guardId;else delete captivity.guardId;
  const historical={...r,rival,captivity,objects:copy(c.baseline.objects)};
  return {...weaponLoanHistoricalState(s),version:4,campaign:{...s.campaign,missions:{...s.campaign.missions,[RIVAL_ID]:historical}}};
}
/** Root's train validator supplies these links to the powder owning validator;
 * neither side imports the other module or copies a current stock registry. */
/** Detached material at an actual ledger prefix. A physical inspection can
 * bind this revision without copying a second mutable resource authority.
 * Equal-time events have an order; a later event strictly before at means the
 * requested revision is stale for that time and cannot be used as evidence.
 */
export function validCustodyRevision(s,revision,at){
  const c=stateOf(s);
  return usesRivalContinuation(s)&&Array.isArray(c?.events)&&Number.isSafeInteger(revision)&&revision>=0&&revision<=c.events.length&&Number.isFinite(at)&&at>=0&&at<=s.elapsed&&!c.events.slice(0,revision).some(e=>!Number.isFinite(e?.at)||e.at>at)&&!c.events.slice(revision).some(e=>!Number.isFinite(e?.at)||e.at<at);
}
export function sourceForRevision(s,reference,revision,at){
  try{
    const c=stateOf(s);if(!validCustodyRevision(s,revision,at)||isOriginalWeaponRef(reference)||!referenceKnown(reference))return null;
    const model=c.baseline?{objects:copy(c.baseline.objects),kit:copy(c.baseline.kit),gear:{}}:{objects:copy(rec(s).objects),kit:copy(powder(s)?.kit||{}),gear:{}};
    for(const event of c.events.slice(0,revision))for(const effect of event.effects){const map=isTrainGearRef(effect.ref)?model.gear:effect.ref.sourceMissionId===RIVAL_ID?model.objects:effect.ref.sourceMissionId===TRAIN_ID?model.kit:null;if(!map)return null;if(effect.after===null)delete map[effect.ref.objectId];else map[effect.ref.objectId]=copy(effect.after);}
    const item=modelObject(model,reference);return item?copy(item):null;
  }catch{return null;}
}
export function custodyValidationLinks(s){return{requestFor:id=>inspectCustodyRequest(s,id),eventFor:id=>{const event=stateOf(s)?.events.find(event=>event.id===id);return event?copy(event):null;},sourceForRevision:(ref,revision,at)=>sourceForRevision(s,ref,revision,at),validRevision:(revision,at)=>validCustodyRevision(s,revision,at)};}
export function validateRivalContinuation(s){
  try{
    if(!usesRivalContinuation(s))return false;
    const c=stateOf(s),p=powder(s);
    if(!exactKeys(c,['schema','initializedAt','baseline','requestSerial','requests','events',...(Object.hasOwn(c,'gearVersion')?['gearVersion']:[])])||c.gearVersion!==undefined&&c.gearVersion!==1||c.schema!==1||!Number.isSafeInteger(c.requestSerial)||c.requestSerial<0||!object(c.requests)||!Array.isArray(c.events)||!validateTrainGear(s))return false;
    if(c.initializedAt===null)return c.baseline===null&&c.requestSerial===0&&Object.keys(c.requests).length===0&&c.events.length===0&&originalFieldsAbsent(rec(s).objects)&&legacyGuardAllowed(rec(s))&&(!p||object(p.kit)&&!Object.keys(p.kit).length&&Array.isArray(p.custodyEventRefs)&&!p.custodyEventRefs.length);
    const b=c.baseline;if(!rec(s).mission.completed||!Number.isFinite(c.initializedAt)||c.initializedAt<0||c.initializedAt>s.elapsed||!exactKeys(b,['at','objects','kit','guardPresent','guardId'])||b.at!==c.initializedAt||!object(b.kit)||Object.keys(b.kit).length||!originalFieldsAbsent(b.objects)||typeof b.guardPresent!=='boolean'||b.guardPresent&&b.guardId!=='bastian'||!b.guardPresent&&b.guardId!==null||!object(p)||!object(p.kit)||!Array.isArray(p.custodyEventRefs)||!Array.isArray(p.physicalEvents)||!Array.isArray(p.pending))return false;
    let model={objects:copy(b.objects),kit:{},gear:{},guardPresent:b.guardPresent,guardId:b.guardId},at=b.at;const requests=new Set(),causes=new Set();
    const requestNumber=id=>{const prefix=`${TRAIN_ID}:custody-request:`;if(typeof id!=='string'||!id.startsWith(prefix)||!/^[1-9]\d*$/.test(id.slice(prefix.length)))return null;const number=Number(id.slice(prefix.length));return Number.isSafeInteger(number)&&number>=1&&number<=c.requestSerial?number:null;};
    for(let index=0;index<c.events.length;index++){
      const e=c.events[index],op=normalizeOperation(e?.operation);
      if(!exactKeys(e,['id','seq','requestId','kind','at','operation','workReceipt','derivation','effects','guardChange',...(['lend-weapon','return-weapon'].includes(e?.kind)?['weaponChange']:[])])||e.id!==`${RIVAL_ID}:continued:${index+1}`||e.seq!==index+1||requestNumber(e.requestId)===null||requests.has(e.requestId)||!op||!same(op,e.operation)||e.kind!==op.kind||!Number.isFinite(e.at)||e.at<at||e.at>s.elapsed||!Number.isFinite(e.workReceipt?.startedAt)||e.workReceipt.startedAt<b.at||e.workReceipt.startedAt>e.at||!receiptShape(e.workReceipt,op,e.workReceipt.startedAt,e.at)||causes.has(op.cause.eventId)||!eventPhysicalProof(p,e))return false;
      for(const reference of op.refs)if(!isOriginalWeaponRef(reference))modelReference(model,reference);
      if(e.kind==='blast-charge'){
        const physical=e.operation.options.physicalReceipt,child=model.objects[op.options.chargeId],primerRef=child?.powder?.primerId?ref(RIVAL_ID,child.powder.primerId):null,fuseRef=child?.powder?.fuseRef||null;
        if(!exactKeys(physical,['schema','chargeRef','primerRef','fuseRef','location','origin','at','trigger','cause','custodyEventId'])||physical.schema!==1||!same(physical.chargeRef,ref(RIVAL_ID,op.options.chargeId))||!same(physical.primerRef,primerRef)||!same(physical.fuseRef,fuseRef)||physical.at!==e.at||physical.trigger!==op.options.trigger||!same(physical.cause,op.cause)||physical.custodyEventId!==null||!exactKeys(physical.origin,['x','y','z','regionId'])||!['x','y','z'].every(k=>Number.isFinite(physical.origin[k]))||physical.origin.regionId!==TRAIN_WORLD.id||!same(physical.location,child?.location)||!same(e.derivation,{...physical,custodyEventId:e.id}))return false;
      }else if(e.kind!=='cut-clamp'&&e.derivation!==null)return false;
      const next=deriveOperation(model,op,e.id,e.at,e.derivation),guardChange=same([model.guardPresent,model.guardId],[next.guardPresent,next.guardId])?null:{before:model.guardId,after:next.guardId};
      if(!same(e.effects,effectsBetween(model,next))||!same(e.guardChange,guardChange))return false;
      requests.add(e.requestId);causes.add(op.cause.eventId);at=e.at;model=next;
    }
    if(!same(currentModel(s),model)||!same(p.custodyEventRefs,c.events.map(event=>event.id)))return false;
    const locks=new Set();for(const [id,request]of Object.entries(c.requests)){
      const op=normalizeOperation(request?.operation);
      if(!exactKeys(request,['id','operation','startedAt','sourceBindings'])||request.id!==id||requestNumber(id)===null||requests.has(id)||!op||!same(op,request.operation)||causes.has(op.cause.eventId)||!Number.isFinite(request.startedAt)||request.startedAt<b.at||request.startedAt>s.elapsed||!Array.isArray(request.sourceBindings)||request.sourceBindings.length!==op.refs.length||request.sourceBindings.some((entry,i)=>!exactKeys(entry,['ref','value'])||!same(entry.ref,op.refs[i])||!same(entry.value,isOriginalWeaponRef(entry.ref)?resolveOriginalWeapon(s,entry.ref):modelReference(model,entry.ref))))return false;
      const work=p.pending.filter(work=>work.requestId===id),start=p.physicalEvents.find(event=>event.id===op.cause.eventId);
      if(work.length!==1||work[0].workId!==op.cause.eventId||work[0].kind!==op.kind||work[0].startedAt!==request.startedAt||start?.kind!=='work-started'||start.at!==request.startedAt||start.data?.requestId!==id||start.data?.operationKind!==op.kind)return false;
      for(const key of lockedKeys(op)){if(locks.has(key))return false;locks.add(key);}requests.add(id);causes.add(op.cause.eventId);
    }
    return validateRivalWeaponLoans(s,c.events);
  }catch{return false;}
}
export function legacyContinuationFieldsAbsent(s){
  const r=rec(s);if(!r)return true;
  if(!legacyGuardAllowed(r))return false;
  if(r.rival.continuationVersion!==undefined||r.rival.continuation!==undefined)return false;
  const tin=r.objects?.['cap-tin'],crate=r.objects?.['charge-crate'];
  if(tin&&['primers','openedAt','openingEventId'].some(key=>Object.hasOwn(tin,key)))return false;
  if(crate&&['issuedChargeIds','issuedCount','consumedChargeIds'].some(key=>Object.hasOwn(crate,key)))return false;
  return !chargeIds.some(id=>r.objects?.[id]?.powder!==undefined);
}
