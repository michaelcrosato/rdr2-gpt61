/** Original train powder/circuit component. It neither makes the train mission
 * available nor creates possessions in a factory/migration. Resource custody
 * belongs to the owning continuation bridge; physical work belongs here. */
import {TRAIN_ID,TRAIN_CHARGE_REFERENCES} from '../content/campaign/brass-cutting.js';
import {TRAIN_TOOL_CASE,TRAIN_KIT_DEFINITIONS} from '../content/campaign/train-equipment.js';
import * as Custody from './rival-continuation.js';
import {inspectCustodyContactWindow,CUSTODY_CONTACT_RADIUS} from './custody-contact.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE} from './train-gear.js';
const {CUSTODY_WORK_SECONDS}=Custody;

export const POWDER_SCHEMA=1;
export const POWDER_SOURCE_MISSION='snowbound-the-names-they-took';
const original=id=>({sourceMissionId:POWDER_SOURCE_MISSION,objectId:id});
const tool=id=>({sourceMissionId:TRAIN_ID,objectId:id});
const chargeIds=TRAIN_CHARGE_REFERENCES.map(ref=>ref.objectId);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const sameRef=(value,expected)=>keys(value,['sourceMissionId','objectId'])&&value.sourceMissionId===expected.sourceMissionId&&value.objectId===expected.objectId;
const finite=value=>Number.isFinite(value);
const EPS=1e-7;
const point=value=>keys(value,['x','y','z'])&&['x','y','z'].every(key=>finite(value[key]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const samePoint=(a,b)=>point(a)&&point(b)&&distance(a,b)<=EPS;

export const POWDER_STEP_LIMIT=.25;
export const POWDER_CONTACT_RADIUS=CUSTODY_CONTACT_RADIUS;
export const POWDER_SAFE_INTERVAL=Custody.CUSTODY_RECOVERY_SECONDS;
export const PREPARATION_INSPECTION_SECONDS=Object.freeze({'child-seal':.6,'primer-tin':.8,'wire-and-tools':.8});
const inspectionKinds=Object.freeze({'child-seal':'inspect-child-seal','primer-tin':'inspect-primer-tin','wire-and-tools':'inspect-wire-and-tools'});
const workSeconds=kind=>CUSTODY_WORK_SECONDS[kind]??PREPARATION_INSPECTION_SECONDS[Object.keys(inspectionKinds).find(topic=>inspectionKinds[topic]===kind)];
const fuseDurations=Object.fromEntries(TRAIN_KIT_DEFINITIONS.filter(item=>item.kind==='game-fuse').map(item=>[item.id,item.fuseSeconds]));

/** A trace is evidence from the owning ground geometry, not a requested wire
 * quantity. Check its measured polyline too, so a clear flag/endpoint alone
 * cannot conserve an invented amount of reel stock. */
export function inspectPowderGroundTrace(trace,from,to){
  if(!point(from)||!point(to)||!keys(trace,['clear','groundPoints','length3d','hit'])||trace.clear!==true||trace.hit!==null||!finite(trace.length3d)||trace.length3d<=EPS||!Array.isArray(trace.groundPoints)||trace.groundPoints.length<2||trace.groundPoints.length>4096||!trace.groundPoints.every(point))return null;
  if(!samePoint(trace.groundPoints[0],from)||!samePoint(trace.groundPoints.at(-1),to))return null;
  let length=0;
  for(let i=1;i<trace.groundPoints.length;i++){
    const segment=distance(trace.groundPoints[i-1],trace.groundPoints[i]);
    if(segment<=EPS||segment>4+EPS)return null;
    length+=segment;
  }
  if(Math.abs(length-trace.length3d)>EPS*Math.max(1,length)||length+EPS<distance(from,to))return null;
  return{length,points:trace.groundPoints.map(p=>({...p}))};
}

/** This is a read-only pre-movement constraint. It cannot place an actor,
 * commit custody, infer possession or turn an endpoint into a completed wire. */
export function constrainPowderWireMotion(spool,from,to,trace){
  const measured=inspectPowderGroundTrace(trace,from,to);
  if(!measured||!validatePowderWireBalance(spool)||spool.onReel+EPS<measured.length)return{allowed:false,reason:measured?'reel-exhausted':'invalid-ground-trace'};
  return{allowed:true,length:measured.length,points:measured.points};
}

/** Called before the native mover. Once either clamp is awaiting work, the
 * reel cannot silently drag an endpoint or create free tail. These reasons
 * let the owning UI offer the actual fastening/cut action at that contact. */
export function constrainPowderActorMotion(s,actorId,from,to,trace){
  if(!point(from)||!point(to))return{allowed:false,reason:'invalid-motion'};
  const record=trainPowderRecord(s);
  if(!record||record.circuit.actorId!==actorId)return{allowed:true,length:0,points:[]};
  if(samePoint(from,to))return{allowed:true,length:0,points:[]};
  if(!samePoint(record.circuit.path.at(-1),from))return{allowed:false,reason:'wire-endpoint-mismatch'};
  if(record.circuit.terminals.charge.state!=='fastened')return{allowed:false,reason:'fasten-charge-required'};
  if(record.circuit.terminals.detonator.state==='fastened')return{allowed:false,reason:'cut-clamp-required'};
  return constrainPowderWireMotion(authoritative(s,record.refs.spool,'wire-spool'),from,to,trace);
}

export function validatePowderWireBalance(spool){
  if(!plain(spool)||spool.id!=='brass-wire-spool'||spool.kind!=='wire-spool'||spool.issuedLength!==420)return false;
  const fields=['onReel','deployedLength','cutoffLength','lostLength'];
  return fields.every(key=>finite(spool[key])&&spool[key]>=0&&spool[key]<=spool.issuedLength)&&Math.abs(fields.reduce((sum,key)=>sum+spool[key],0)-spool.issuedLength)<=EPS;
}

/** Accepted world time is supplied by the journey owner. A repeated Save,
 * redraw, paused menu or repeated timestamp cannot advance work/fuses twice. */
export function acceptedPowderStep(record,now,dt,{paused=false}={}){
  if(paused||!plain(record)||!finite(now)||now<0||!finite(dt)||dt<=0||dt>POWDER_STEP_LIMIT)return null;
  const start=now-dt;
  if(start<-EPS||record.lastAdvancedAt!==null&&(!finite(record.lastAdvancedAt)||Math.abs(record.lastAdvancedAt-start)>EPS))return null;
  return{start,finish:now,seconds:dt};
}

export function createPowderReferences(){return{
  charges:chargeIds.map(original),crate:original('charge-crate'),tin:original('cap-tin'),
  spool:tool('brass-wire-spool'),lead:tool('brass-circuit-lead'),detonator:tool('brass-detonator'),
  pliers:tool('brass-terminal-pliers'),fuses:[tool('brass-fuse-a'),tool('brass-fuse-b')],
};}

/** Fixed role, source and identity are all checked. A valid existing object ID
 * does not permit aliasing a crate as a tin or a future tool as an old charge. */
export function validatePowderReferences(refs){
  const expected=createPowderReferences();
  if(!keys(refs,Object.keys(expected))||!Array.isArray(refs.charges)||refs.charges.length!==4||!Array.isArray(refs.fuses)||refs.fuses.length!==2)return false;
  if(refs.charges.some((ref,index)=>!sameRef(ref,expected.charges[index]))||refs.fuses.some((ref,index)=>!sameRef(ref,expected.fuses[index])))return false;
  return ['crate','tin','spool','lead','detonator','pliers'].every(name=>sameRef(refs[name],expected[name]));
}

export function createTrainPowderRecord(){
  const refs=createPowderReferences();
  return {
    schema:POWDER_SCHEMA,refs,kit:{},lastAdvancedAt:null,workSerial:0,pending:[],
    circuit:{
      path:[],actorId:null,anchorRef:{...refs.charges[0]},
      terminals:{charge:{state:'open',eventId:null},detonator:{state:'open',eventId:null}},
      cutEventId:null,lastTest:null,breakEventId:null,strokes:[],
      recovery:{disconnectAt:null,safeAfter:null,removedPrimerEventId:null,recoveredChargeEventId:null},
    },
    fuses:[
      {chargeRef:{...refs.charges[1]},fuseRef:{...refs.fuses[0]},litEventId:null,litAt:null,dueAt:null,blastEventId:null},
      {chargeRef:{...refs.charges[2]},fuseRef:{...refs.fuses[1]},litEventId:null,litAt:null,dueAt:null,blastEventId:null},
    ],
    custodyEventRefs:[],physicalEvents:[],
  };
}

export function trainPowderRecord(s){return s?.campaign?.missions?.[TRAIN_ID]?.train?.powder||null;}

/** Root and hand positions have different jobs. Feet establish world/layer
 * continuity; the actual hand must reach each socket. A rendered hand at z33
 * is never mistaken for feet standing 33 units above the ground. Providers
 * must additionally prove the continuous swept interval, not just endpoints. */
export function inspectPowderContactWindow(window,expected){return inspectCustodyContactWindow(window,expected);}

export function validatePowderPendingWork(work,now){
  if(!keys(work,['workId','requestId','kind','startedAt','acceptedSeconds','intervals'])||typeof work.workId!=='string'||!/^powder-event-[1-9][0-9]*$/.test(work.workId)||typeof work.requestId!=='string'||!work.requestId||!finite(workSeconds(work.kind))||workSeconds(work.kind)<=0||!finite(work.startedAt)||work.startedAt<0||!finite(work.acceptedSeconds)||work.acceptedSeconds<0||!finite(now)||!Array.isArray(work.intervals)||work.intervals.length>4096)return false;
  let end=work.startedAt,sum=0;
  for(const interval of work.intervals){
    if(!keys(interval,['start','finish'])||!finite(interval.start)||!finite(interval.finish)||Math.abs(interval.start-end)>EPS||interval.finish<=interval.start||interval.finish-interval.start>POWDER_STEP_LIMIT+EPS||interval.finish>now+EPS)return false;
    sum+=interval.finish-interval.start;end=interval.finish;
  }
  return Math.abs(sum-work.acceptedSeconds)<=EPS&&work.startedAt<=now&&work.acceptedSeconds<workSeconds(work.kind)+POWDER_STEP_LIMIT+EPS;
}

const custodyKinds=new Set(['issue-kit','issue-mask','open-tin','move-object','unseal-charge','attach-primer','remove-primer','attach-fuse','light-fuse','cut-clamp','return-papers','establish-guard','guard-handover','lend-weapon','return-weapon']);
const physicalKinds=new Set(['begin-wire','fasten-terminal','disconnect-terminal','test-circuit','stroke-detonator']);
const copy=value=>structuredClone(value);
function capability(fn,...args){try{return typeof fn==='function'&&fn(...args)===true;}catch{return false;}}
function physicalEvent(s,kind,data){
  const record=trainPowderRecord(s);
  const event={id:`powder-event-${record.physicalEvents.length+1}`,kind,at:s.elapsed,data:copy(data)};
  record.physicalEvents.push(event);return event;
}
function workContact(s,operation,interval,ctx){
  if(typeof ctx?.powderContactWindow!=='function')return null;
  const fixedContacts=powderFixedContactRoles(operation).map(({id,actorId,regionId})=>({id,actorId,regionId,point:fixedPoint(s,id,ctx)}));
  if(fixedContacts.some(contact=>!contact.point))return null;
  const span={start:interval.start,finish:interval.finish},expected={...span,actorIds:operation.actorIds,refs:operation.refs,destinations:operation.to?[operation.to.location]:[],fixedContacts};
  try{return inspectPowderContactWindow(ctx.powderContactWindow(s,copy(operation),span),expected);}catch{return null;}
}
export function powderFixedContactRoles(op){
  if(op.kind==='issue-mask')return ['mara','ada'].map(actorId=>({id:TRAIN_MASK_SOURCE.id,actorId,regionId:TRAIN_MASK_SOURCE.regionId}));
  if(Object.values(inspectionKinds).includes(op.kind))return ['mara','ruth'].map(actorId=>({id:op.options.topic==='wire-and-tools'?TRAIN_TOOL_CASE.id:'quarry-charge-store',actorId,regionId:'snowbound'}));
  if(op.kind==='issue-kit')return ['mara','ruth'].map(actorId=>({id:TRAIN_TOOL_CASE.id,actorId,regionId:TRAIN_TOOL_CASE.regionId}));
  if(op.kind==='return-papers')return[{id:'actor:tomas:paper-handoff',actorId:'mara',regionId:'snowbound'}];
  if(['establish-guard','guard-handover'].includes(op.kind))return op.actorIds.map(actorId=>({id:'station:levi-holding',actorId,regionId:'snowbound'}));
  if(['lend-weapon','return-weapon'].includes(op.kind))return [...['mara','bastian'].map(actorId=>({id:'station:community-rescue-chest',actorId,regionId:'snowbound'})),{id:'actor:bastian:weapon-handoff',actorId:'mara',regionId:'snowbound'}];
  if(!physicalKinds.has(op.kind))return[];
  const id=op.kind==='begin-wire'||op.kind==='fasten-terminal'&&op.options.side==='charge'?'turnout-service-plate':'ridge-detonator';
  return[{id,actorId:op.actorIds[0],regionId:'brass-cutting'}];
}
function bridgeReady(){return ['beginCustodyRequest','inspectCustodyRequest','cancelCustodyRequest','commitCustody'].every(key=>typeof Custody[key]==='function');}
function conflictsWithPending(s,op){
  const record=trainPowderRecord(s);
  for(const work of record.pending){
    const event=record.physicalEvents.find(item=>item.id===work.workId),other=['circuit-work-started','preparation-inspection-started'].includes(event?.kind)?event.data.operation:Custody.inspectCustodyRequest?.(s,work.requestId)?.operation;
    if(!other||other.actorIds.some(id=>op.actorIds.includes(id))||other.refs.some(ref=>op.refs.some(candidate=>sameRef(ref,candidate))))return true;
  }
  return false;
}
function interruptConflictingWork(s,op){
  const record=trainPowderRecord(s);
  for(const work of [...record.pending]){
    const event=record.physicalEvents.find(item=>item.id===work.workId),other=['circuit-work-started','preparation-inspection-started'].includes(event?.kind)?event.data.operation:Custody.inspectCustodyRequest(s,work.requestId)?.operation;
    if(other&&(other.actorIds.some(id=>op.actorIds.includes(id))||other.refs.some(ref=>op.refs.some(candidate=>sameRef(ref,candidate)))))cancelPowderWork(s,work.workId,'interrupted');
  }
}
/** Hazards do not wait for a resource lock. Interrupt first, then allocate the
 * hazard cause. If its owner refuses/rolls back, restore the same work prefix;
 * continuation metadata restoration remains in the continuation owner. */
function interruptingHazard(s,op,apply){
  const record=trainPowderRecord(s),custody=Custody.prepareCustodyInterruption?.(s);
  if(!record||!custody||typeof custody.rollback!=='function')return false;
  const snapshot={pending:copy(record.pending),physicalEvents:copy(record.physicalEvents)};
  try{interruptConflictingWork(s,op);if(apply())return true;}catch{}
  try{custody.rollback();}finally{record.pending=snapshot.pending;record.physicalEvents=snapshot.physicalEvents;}
  return false;
}

function inspectionOperation(topic,reference,actorIds,resolve){
  if(!Object.hasOwn(inspectionKinds,topic)||JSON.stringify(actorIds)!==JSON.stringify(['mara','ruth']))return null;
  const refs=createPowderReferences();let selected;
  if(topic==='child-seal'){
    if(!chargeIds.some(id=>sameRef(reference,original(id))))return null;
    const child=resolve(reference);if(child?.kind!=='sealed-charge')return null;
    selected=[copy(reference)];
    if(child.location?.type==='crate'){if(child.location.targetId!=='charge-crate')return null;selected.push(refs.crate);}
  }else if(topic==='primer-tin'){
    if(!sameRef(reference,refs.tin))return null;selected=[refs.tin];
  }else{
    if(!sameRef(reference,refs.spool))return null;selected=[refs.spool,refs.lead,refs.detonator,refs.pliers,...refs.fuses];
  }
  return{kind:inspectionKinds[topic],actorIds:[...actorIds],refs:selected,to:null,options:{topic,ref:copy(reference)}};
}
function inspectionMeasurement(op,bindings){
  const item=ref=>bindings.find(binding=>sameRef(binding.ref,ref))?.value,topic=op.options.topic;
  if(bindings.some(binding=>!plain(binding.value)||typeof binding.value.owner!=='string'||!binding.value.owner||!plain(binding.value.location)))return null;
  if(topic==='child-seal'){
    const child=item(op.options.ref),p=child?.powder;
    if(!child||child.id!==op.options.ref.objectId||child.kind!=='sealed-charge'||typeof child.sealed!=='boolean'||p!==undefined&&(!plain(p)||p.schema!==1||![null,'wired','fused'].includes(p.mode)||p.primerId!==null&&!/^quarry-primer-[1-6]$/.test(p.primerId)||typeof p.spent!=='boolean'))return null;
    if(child.location.type==='crate'&&item(original('charge-crate'))?.kind!=='sealed-quarry-charges')return null;
    return{topic,chargeId:child.id,sealed:child.sealed,mode:p?.mode??null,primerId:p?.primerId??null,spent:p?.spent??false};
  }
  if(topic==='primer-tin'){
    const tin=item(op.options.ref),issuedIds=Array.from({length:6},(_,i)=>`quarry-primer-${i+1}`);
    if(tin?.id!=='cap-tin'||tin.kind!=='cap-tin'||typeof tin.openingEventId!=='string'||!Array.isArray(tin.primers)||tin.primers.length!==6||tin.primers.some((unit,index)=>unit.id!==issuedIds[index]||unit.kind!=='game-primer'||unit.sourceTinId!=='cap-tin'||unit.openingEventId!==tin.openingEventId||!['in-tin','attached','damaged','spent'].includes(unit.state)||!plain(unit.location)))return null;
    const usableIds=tin.primers.filter(unit=>unit.state==='in-tin'&&JSON.stringify(unit.location)===JSON.stringify({type:'tin',targetId:'cap-tin',compartment:'usable'})).map(unit=>unit.id);
    const unserviceableIds=tin.primers.filter(unit=>unit.state==='damaged'&&JSON.stringify(unit.location)===JSON.stringify({type:'tin',targetId:'cap-tin',compartment:'unserviceable'})).map(unit=>unit.id);
    return{topic,openingEventId:tin.openingEventId,issuedIds,usableIds,unserviceableIds,absentIds:issuedIds.filter(id=>!usableIds.includes(id)&&!unserviceableIds.includes(id))};
  }
  const kit=TRAIN_KIT_DEFINITIONS.map(definition=>item(tool(definition.id))),spool=kit[0],issueEventId=spool?.issueEventId;
  if(!validatePowderWireBalance(spool)||typeof issueEventId!=='string'||kit.some((value,index)=>value?.id!==TRAIN_KIT_DEFINITIONS[index].id||value.kind!==TRAIN_KIT_DEFINITIONS[index].kind||value.issueEventId!==issueEventId||value.sourceCaseId!==TRAIN_TOOL_CASE.id))return null;
  const fuses=kit.filter(value=>value.kind==='game-fuse');
  if(fuses.some(fuse=>!['intact','attached','burning','spent'].includes(fuse.state)||fuse.chargeId!==null&&!chargeIds.includes(fuse.chargeId)))return null;
  return{topic,issueEventId,spool:Object.fromEntries(['issuedLength','onReel','deployedLength','cutoffLength','lostLength'].map(key=>[key,spool[key]])),kit:kit.map(value=>({id:value.id,kind:value.kind})),fuses:fuses.map(value=>({id:value.id,state:value.state,chargeId:value.chargeId}))};
}
function validInspectionStart(start,sourceForRevision,eventFor){
  const data=start?.data,op=data?.operation;
  if(start?.kind!=='preparation-inspection-started'||!keys(data,['operation','sourceRevision','sourceBindings'])||!keys(op,['kind','actorIds','refs','to','options'])||!keys(op.options,['topic','ref'])||!Number.isSafeInteger(data.sourceRevision)||data.sourceRevision<0||!Array.isArray(data.sourceBindings)||data.sourceBindings.length!==op.refs?.length||typeof sourceForRevision!=='function')return false;
  const values=data.sourceBindings;
  if(values.some((entry,index)=>!keys(entry,['ref','value'])||!sameRef(entry.ref,op.refs[index])||JSON.stringify(entry.value)!==JSON.stringify(sourceForRevision(entry.ref,data.sourceRevision,start.at))))return false;
  const expected=inspectionOperation(op.options.topic,op.options.ref,op.actorIds,ref=>values.find(entry=>sameRef(entry.ref,ref))?.value);
  const measured=expected&&inspectionMeasurement(expected,values);
  if(!expected||JSON.stringify(expected)!==JSON.stringify(op)||!measured)return false;
  const materialId=measured.openingEventId||measured.issueEventId;
  if(materialId){const event=typeof eventFor==='function'&&eventFor(materialId);if(!event||event.seq>data.sourceRevision||event.at>start.at||event.kind!==(op.options.topic==='primer-tin'?'open-tin':'issue-kit'))return false;}
  return true;
}
function inspectionBindingsUnchanged(start,revision,at,{sourceForRevision,eventFor}){
  if(!Number.isSafeInteger(revision)||revision<start.data.sourceRevision||typeof sourceForRevision!=='function'||typeof eventFor!=='function')return false;
  const bindings=start.data.sourceBindings;
  if(bindings.some(entry=>JSON.stringify(entry.value)!==JSON.stringify(sourceForRevision(entry.ref,revision,at))))return false;
  // Moving a source away and back is not continuous inspection. Check each
  // intervening canonical effect without replaying unrelated whole models.
  for(let seq=start.data.sourceRevision+1;seq<=revision;seq++){
    const event=eventFor(`${POWDER_SOURCE_MISSION}:continued:${seq}`);
    if(!event||event.seq!==seq||event.at<start.at||event.at>at||!Array.isArray(event.effects))return false;
    for(const binding of bindings)for(const effect of event.effects)if(sameRef(effect.ref,binding.ref)&&JSON.stringify(effect.after)!==JSON.stringify(binding.value))return false;
  }
  return true;
}
function inspectionAccess(s,op,ctx){
  if(s.region!=='snowbound'||['worldFor','custodySnapshot','handUsable','handFree','authorizePreparationInspection'].some(key=>typeof ctx?.[key]!=='function')||!capability(ctx.authorizePreparationInspection,s,copy(op)))return false;
  try{if(!ctx.worldFor(s))return false;}catch{return false;}
  return op.actorIds.every(id=>{const actor=s.entities[id];return actor?.hp>0&&actor.regionId==='snowbound'&&!actor.mounted&&capability(ctx.handUsable,s,id,copy(op))&&capability(ctx.handFree,s,id,copy(op));});
}
function inspectionContact(s,op,interval,ctx){
  const contact=workContact(s,op,interval,ctx),snapshot=Custody.physicalSnapshot(s,{actorIds:op.actorIds,refs:op.refs,destinations:[]},ctx);
  return !!contact&&!!snapshot&&JSON.stringify(contact)===JSON.stringify(snapshot);
}
function inspectionLinks(s){return Custody.custodyValidationLinks(s);}
function inspectionRevision(s){const events=s.campaign?.missions?.[POWDER_SOURCE_MISSION]?.rival?.continuation?.events;return Array.isArray(events)?events.length:null;}

/** Timed observation of actual finite stock, never a no-op transfer, issue,
 * flag or caller-supplied measurement. The existing accepted runner owns time. */
export function requestPreparationInspection(s,spec,ctx){
  const record=trainPowderRecord(s);if(!record||!keys(spec,['topic','ref','actorIds'])||!finite(s.elapsed))return null;
  const op=inspectionOperation(spec.topic,spec.ref,spec.actorIds,ref=>authoritative(s,ref));
  if(!op||!inspectionAccess(s,op,ctx)||conflictsWithPending(s,op)||!inspectionContact(s,op,{start:s.elapsed,finish:s.elapsed},ctx))return null;
  const sourceRevision=inspectionRevision(s),sourceBindings=op.refs.map(ref=>({ref:copy(ref),value:copy(authoritative(s,ref))}));
  const start={kind:'preparation-inspection-started',at:s.elapsed,data:{operation:op,sourceRevision,sourceBindings}},links=inspectionLinks(s);
  if(!validInspectionStart(start,links.sourceForRevision,links.eventFor))return null;
  const event=physicalEvent(s,start.kind,start.data),requestId=`inspection:${event.id}`;record.workSerial++;
  record.pending.push({workId:event.id,requestId,kind:op.kind,startedAt:s.elapsed,acceptedSeconds:0,intervals:[]});
  if(record.lastAdvancedAt===null)record.lastAdvancedAt=s.elapsed;
  return{workId:event.id,requestId,requiredSeconds:workSeconds(op.kind)};
}

function inspectionRows(record,now,links){
  if(!record||!Array.isArray(record.physicalEvents)||!Array.isArray(record.pending)||!Array.isArray(record.custodyEventRefs))return null;
  const starts=new Map(),finished=new Set(),rows=[];
  for(const event of record.physicalEvents){
    if(event.kind==='preparation-inspection-started'){
      if(!validInspectionStart(event,links.sourceForRevision,links.eventFor)||starts.has(event.id))return null;starts.set(event.id,event);
    }else if(event.kind==='preparation-inspection-completed'){
      const data=event.data,start=starts.get(data?.workId);
      if(!keys(data,['workId','sourceRevision','acceptedSeconds','intervals','measurement'])||!start||finished.has(start.id)||event.at<start.at||!inspectionBindingsUnchanged(start,data.sourceRevision,event.at,links))return null;
      const op=start.data.operation,work={workId:start.id,requestId:`inspection:${start.id}`,kind:op.kind,startedAt:start.at,acceptedSeconds:data.acceptedSeconds,intervals:data.intervals};
      if(!validatePowderPendingWork(work,event.at)||work.acceptedSeconds+EPS<workSeconds(work.kind)||work.intervals.at(-1)?.finish!==event.at||JSON.stringify(data.measurement)!==JSON.stringify(inspectionMeasurement(op,start.data.sourceBindings)))return null;
      finished.add(start.id);rows.push({workId:start.id,topic:op.options.topic,ref:copy(op.options.ref),actorIds:[...op.actorIds],startedAt:start.at,finishedAt:event.at,sourceRevision:data.sourceRevision,measurement:copy(data.measurement)});
    }else if(event.kind==='work-cancelled'&&starts.has(event.data?.workId)){
      if(finished.has(event.data.workId))return null;finished.add(event.data.workId);
    }
  }
  for(const start of starts.values())if(!finished.has(start.id)){
    const work=record.pending.find(item=>item.workId===start.id);
    if(!work||work.requestId!==`inspection:${start.id}`||work.kind!==start.data.operation.kind||work.startedAt!==start.at||!validatePowderPendingWork(work,now)||!inspectionBindingsUnchanged(start,record.custodyEventRefs.length,now,links))return null;
  }
  return rows;
}

/** Historical evidence only; the preparation owner still checks current
 * resources, readiness, actual dialogue and the declared scene boundary. */
export function preparationInspectionEvidence(s,{since=0,at=s?.elapsed}={}){
  const record=trainPowderRecord(s);if(!record||!finite(since)||since<0||!finite(at)||at<since||at>s.elapsed)return null;
  try{const rows=inspectionRows(record,s.elapsed,inspectionLinks(s));return rows?.filter(row=>row.startedAt>=since&&row.finishedAt<=at)??null;}catch{return null;}
}

/** The caller selects an offered operation, never its timing/cause/count. The
 * bridge binds source revisions, authorizes the operation and owns every item
 * write. This module only records the performed physical work. */
export function requestPowderCustodyWork(s,operation,ctx){
  const record=trainPowderRecord(s);
  if(!record||!bridgeReady()||!keys(operation,['kind','actorIds','refs','to','options'])||!custodyKinds.has(operation.kind)||operation.kind==='move-object'&&!powderTransferAllowed(s,operation.refs?.[0])||!finite(s.elapsed)||!workContact(s,operation,{start:s.elapsed,finish:s.elapsed},ctx)||conflictsWithPending(s,operation))return null;
  const event=physicalEvent(s,'work-started',{operationKind:operation.kind,requestId:null});
  const cause={missionId:TRAIN_ID,eventId:event.id},op={...copy(operation),cause};
  let result;try{result=Custody.beginCustodyRequest(s,op,ctx);}catch{result=null;}
  if(!result||result.kind!==operation.kind||result.requiredSeconds!==CUSTODY_WORK_SECONDS[operation.kind]||result.requiredSeconds<=0){
    if(result?.requestId)Custody.cancelCustodyRequest(s,result.requestId);
    record.physicalEvents.pop();return null;
  }
  event.data.requestId=result.requestId;record.workSerial++;
  record.pending.push({workId:event.id,requestId:result.requestId,kind:operation.kind,startedAt:s.elapsed,acceptedSeconds:0,intervals:[]});
  if(record.lastAdvancedAt===null)record.lastAdvancedAt=s.elapsed;
  return{workId:event.id,requestId:result.requestId,requiredSeconds:result.requiredSeconds};
}

export function cancelPowderWork(s,workId,reason='interrupted'){
  const record=trainPowderRecord(s),work=record?.pending.find(item=>item.workId===workId);
  if(!work||!['interrupted','contact-lost','stale-request','commit-rejected'].includes(reason)||!bridgeReady())return false;
  Custody.cancelCustodyRequest(s,work.requestId);
  record.pending=record.pending.filter(item=>item!==work);
  physicalEvent(s,'work-cancelled',{workId,reason});return true;
}

/** The continuation owner calls this from its required cause hook. It checks
 * the exact request and accumulated accepted intervals; a menu flag or an
 * editable duration cannot be used as a work receipt. */
export function validatePowderCustodyCause(s,operation,receipt,requestId){
  const record=trainPowderRecord(s);
  const cause=operation?.cause;
  if(!record||!keys(cause,['missionId','eventId'])||cause.missionId!==TRAIN_ID)return false;
  const work=record.pending.find(item=>item.workId===cause.eventId),event=record.physicalEvents.find(item=>item.id===cause.eventId);
  if(event&&['wire-motion','terminal-released','charge-blast'].includes(event.kind)){
    const kind={'wire-motion':'wire-pay-out','terminal-released':'damage-primer','charge-blast':'blast-charge'}[event.kind];
    if(operation.kind!==kind||!requestId||JSON.stringify(Custody.inspectCustodyRequest(s,requestId)?.operation)!==JSON.stringify(operation))return false;
    if(kind==='wire-pay-out'&&JSON.stringify(operation.options.motion)!==JSON.stringify(event.data.motion))return false;
    if(kind==='damage-primer'&&(operation.options.chargeId!==chargeIds[0]||operation.options.primerId!==event.data.primerRef.objectId||JSON.stringify(operation.options.physicalReceipt)!==JSON.stringify(event.data.physicalReceipt)))return false;
    if(kind==='blast-charge'&&(operation.options.chargeId!==event.data.chargeRef.objectId||operation.options.trigger!==event.data.trigger))return false;
    return receipt?.startedAt===s.elapsed&&receipt.finishedAt===s.elapsed&&receipt.acceptedSeconds===0&&event.at===s.elapsed&&event.data.custodyEventId===null&&JSON.stringify(receipt.cause)===JSON.stringify(cause);
  }
  if(!work||requestId!==work.requestId||!event||event.kind!=='work-started'||event.data.operationKind!==work.kind||event.data.requestId!==work.requestId||event.at!==work.startedAt||JSON.stringify(Custody.inspectCustodyRequest(s,work.requestId)?.operation)!==JSON.stringify(operation)||!validatePowderPendingWork(work,s.elapsed)||work.acceptedSeconds+EPS<CUSTODY_WORK_SECONDS[work.kind])return false;
  return keys(receipt,['startedAt','finishedAt','acceptedSeconds','actors','sources','destinations','cause'])&&receipt.startedAt===work.startedAt&&receipt.finishedAt===s.elapsed&&Math.abs(receipt.acceptedSeconds-work.acceptedSeconds)<=EPS&&JSON.stringify(receipt.cause)===JSON.stringify(cause);
}

function applyPowderCustodyResult(s,work,result,operation){
  const record=trainPowderRecord(s);
  if(typeof result.eventId!=='string'||record.custodyEventRefs.filter(id=>id===result.eventId).length!==1)throw new TypeError('The custody owner must append its authoritative event exactly once');
  physicalEvent(s,'work-completed',{workId:work.workId,custodyEventId:result.eventId,acceptedSeconds:work.acceptedSeconds,intervals:copy(work.intervals)});
  if(work.kind==='light-fuse'){
    const chargeId=operation.options.chargeId;
    const fuse=record.fuses.find(item=>item.chargeRef.objectId===chargeId);
    if(!fuse||fuse.litEventId!==null)throw new TypeError('A fuse can start once for its original charge');
    fuse.litEventId=result.eventId;fuse.litAt=s.elapsed;fuse.dueAt=s.elapsed+record.kit[fuse.fuseRef.objectId].fuseSeconds;
  }else if(work.kind==='cut-clamp'){
    record.circuit.cutEventId=result.eventId;record.circuit.actorId=null;
  }else if(work.kind==='remove-primer'){
    record.circuit.recovery.removedPrimerEventId=result.eventId;
  }else if(work.kind==='move-object'&&operation.refs.some(ref=>sameRef(ref,record.refs.charges[0]))&&operation.to?.location?.type==='carried'&&operation.to.location.targetId==='ruth'&&record.circuit.recovery.removedPrimerEventId!==null){
    record.circuit.recovery.recoveredChargeEventId=result.eventId;
  }
}

/** Prepared before the bridge mutates stock; applied/rolled back inside its
 * guarded synchronous commit. This snapshot deliberately excludes kit and
 * custodyEventRefs, which have exactly one writer in the continuation owner. */
export function preparePowderCustodyEffects(s,operation,event){
  const record=trainPowderRecord(s),work=record?.pending.find(item=>item.workId===operation?.cause?.eventId);
  if(!record||typeof event?.id!=='string')return null;
  if(!work)return prepareImmediatePowderEffects(s,operation,event);
  if(work.kind!==operation.kind)return null;
  if(work.kind==='light-fuse'){
    const index=chargeIds.slice(1,3).indexOf(operation.options.chargeId),fuse=record.fuses[index];
    if(index<0||!fuse||!sameRef(fuse.chargeRef,record.refs.charges[index+1])||!sameRef(fuse.fuseRef,record.refs.fuses[index])||operation.options.fuseId!==fuse.fuseRef.objectId||record.kit[fuse.fuseRef.objectId]?.fuseSeconds!==fuseDurations[fuse.fuseRef.objectId]||fuse.litEventId!==null||fuse.litAt!==null||fuse.dueAt!==null||fuse.blastEventId!==null)return null;
  }
  if(work.kind==='cut-clamp'&&(record.circuit.cutEventId!==null||record.circuit.actorId===null))return null;
  const fields=['pending','fuses','circuit','physicalEvents'],snapshot=Object.fromEntries(fields.map(key=>[key,copy(record[key])]));
  return{
    apply(){applyPowderCustodyResult(s,work,{eventId:event.id,event},operation);record.pending=record.pending.filter(item=>item.workId!==work.workId);},
    rollback(){for(const key of fields)record[key]=copy(snapshot[key]);},
  };
}

function physicalEffectsContext(ctx){
  return{...ctx,prepareCustodyPhysicalEffects(s,op,event){
    const own=preparePowderCustodyEffects(s,op,event);if(!own)return null;
    const external=typeof ctx.prepareCustodyPhysicalEffects==='function'?ctx.prepareCustodyPhysicalEffects(s,op,event):null;
    if(typeof ctx.prepareCustodyPhysicalEffects==='function'&&(!external||typeof external.apply!=='function'||typeof external.rollback!=='function'))return null;
    return{
      apply(){own.apply();external?.apply();},
      rollback(){try{external?.rollback();}finally{own.rollback();}},
    };
  }};
}

export function stepPowderWork(s,dt,ctx,{paused=false}={}){
  const record=trainPowderRecord(s),interval=acceptedPowderStep(record,s?.elapsed,dt,{paused});
  if(!record||!interval||!bridgeReady())return{advanced:false,completed:[],cancelled:[]};
  const completed=[],cancelled=[];
  for(const work of [...record.pending]){
    // A controller may offer/create work after advancing this accepted clock.
    // Its first contact interval begins at birth, never before the request.
    if(work.startedAt>interval.start+EPS)continue;
    if(work.requestId===`inspection:${work.workId}`){
      const start=record.physicalEvents.find(event=>event.id===work.workId),op=start?.data?.operation,links=inspectionLinks(s),revision=inspectionRevision(s);
      if(!validatePowderPendingWork(work,s.elapsed)||!validInspectionStart(start,links.sourceForRevision,links.eventFor)||op.kind!==work.kind||start.at!==work.startedAt||!inspectionBindingsUnchanged(start,revision,s.elapsed,links)||!inspectionAccess(s,op,ctx)||!inspectionContact(s,op,interval,ctx)){
        cancelPowderWork(s,work.workId,'contact-lost');cancelled.push(work.workId);continue;
      }
      work.intervals.push({start:interval.start,finish:interval.finish});work.acceptedSeconds+=interval.seconds;
      if(work.acceptedSeconds+EPS>=workSeconds(work.kind)){
        physicalEvent(s,'preparation-inspection-completed',{workId:work.workId,sourceRevision:revision,acceptedSeconds:work.acceptedSeconds,intervals:copy(work.intervals),measurement:inspectionMeasurement(op,start.data.sourceBindings)});
        record.pending=record.pending.filter(item=>item!==work);completed.push(work.workId);
      }
      continue;
    }
    if(work.requestId===`physical:${work.workId}`){
      const event=record.physicalEvents.find(item=>item.id===work.workId),op=event?.data.operation;
      if(!validatePowderPendingWork(work,s.elapsed)||event?.kind!=='circuit-work-started'||op?.kind!==work.kind||!physicalPrecondition(s,op,ctx)||!workContact(s,op,interval,ctx)){
        record.pending=record.pending.filter(item=>item!==work);physicalEvent(s,'work-cancelled',{workId:work.workId,reason:'contact-lost'});cancelled.push(work.workId);continue;
      }
      work.intervals.push({start:interval.start,finish:interval.finish});work.acceptedSeconds+=interval.seconds;
      if(work.acceptedSeconds+EPS>=CUSTODY_WORK_SECONDS[work.kind]){
        const result=completePhysicalWork(s,op,work,ctx);
        record.pending=record.pending.filter(item=>item!==work);(result?completed:cancelled).push(work.workId);
      }
      continue;
    }
    const request=Custody.inspectCustodyRequest(s,work.requestId),operation=request?.operation;
    if(!validatePowderPendingWork(work,s.elapsed)||!operation||operation.kind!==work.kind||operation.cause?.eventId!==work.workId){cancelPowderWork(s,work.workId,'stale-request');cancelled.push(work.workId);continue;}
    const contact=workContact(s,operation,interval,ctx);
    if(!contact){cancelPowderWork(s,work.workId,'contact-lost');cancelled.push(work.workId);continue;}
    work.intervals.push({start:interval.start,finish:interval.finish});work.acceptedSeconds+=interval.seconds;
    if(work.acceptedSeconds+EPS<CUSTODY_WORK_SECONDS[work.kind])continue;
    const receipt={startedAt:work.startedAt,finishedAt:s.elapsed,acceptedSeconds:work.acceptedSeconds,...contact,cause:copy(operation.cause)};
    let result;try{result=Custody.commitCustody(s,{requestId:work.requestId,acceptedWorkReceipt:receipt},physicalEffectsContext(ctx));}catch{result=null;}
    if(!result){cancelPowderWork(s,work.workId,'commit-rejected');cancelled.push(work.workId);continue;}
    completed.push(work.workId);
  }
  record.lastAdvancedAt=s.elapsed;return{advanced:true,completed,cancelled};
}

const operation=(kind,actorIds,refs,options={},to=null)=>({kind,actorIds,refs,to,options});
export function requestKitOpening(s,ctx){if(!trainPowderRecord(s)||Object.keys(trainPowderRecord(s).kit).length)return null;return requestPowderCustodyWork(s,operation('issue-kit',['mara','ruth'],[]),ctx);}
export function requestMaskHandoff(s,ctx){if(!trainPowderRecord(s)||s.itemInstances?.[TRAIN_MASK_ID])return null;return requestPowderCustodyWork(s,operation('issue-mask',['mara','ada'],[]),ctx);}
export function requestTinOpening(s,ctx){const refs=createPowderReferences(),tin=authoritative(s,refs.tin,'cap-tin');if(!tin||tin.primers!==undefined||tin.openingEventId!==undefined)return null;return requestPowderCustodyWork(s,operation('open-tin',['ruth'],[refs.tin]),ctx);}
export function powderTransferAllowed(s,reference){
  const record=trainPowderRecord(s);if(!record)return false;
  if(sameRef(reference,record.refs.charges[0])&&record.circuit.path.length&&record.circuit.recovery.removedPrimerEventId===null)return false;
  if(sameRef(reference,record.refs.spool)&&record.circuit.path.length&&record.circuit.cutEventId===null)return false;
  if([record.refs.lead,record.refs.detonator].some(ref=>sameRef(reference,ref))&&record.circuit.terminals.detonator.state==='fastened'&&record.circuit.recovery.disconnectAt===null)return false;
  return true;
}
export function requestPowderTransfer(s,reference,actorIds,to,ctx,options={}){if(!powderTransferAllowed(s,reference))return null;return requestPowderCustodyWork(s,operation('move-object',actorIds,[copy(reference)],copy(options),copy(to)),ctx);}
export function requestChargeUnseal(s,chargeId,actorId,ctx){
  if(!chargeIds.slice(0,3).includes(chargeId))return null;
  if(authoritative(s,original(chargeId),'sealed-charge')?.sealed!==true)return null;
  return requestPowderCustodyWork(s,operation('unseal-charge',[actorId],[original(chargeId)],{chargeId}),ctx);
}
export function requestPrimerAttachment(s,chargeId,primerId,actorId,mode,ctx){
  if(!chargeIds.slice(0,3).includes(chargeId)||!/^quarry-primer-[1-6]$/.test(primerId)||mode!==(chargeId===chargeIds[0]?'wired':'fused'))return null;
  if(authoritative(s,original(primerId),'game-primer')?.state!=='in-tin')return null;
  const refs=createPowderReferences();return requestPowderCustodyWork(s,operation('attach-primer',[actorId],[refs.tin,original(chargeId),original(primerId)],{chargeId,primerId,mode}),ctx);
}
export function requestPrimerRemoval(s,chargeId,primerId,ctx){
  const recovery=trainPowderRecord(s)?.circuit.recovery;
  if(chargeId!==chargeIds[0]||!/^quarry-primer-[1-6]$/.test(primerId)||!recovery||recovery.safeAfter===null||s.elapsed+EPS<recovery.safeAfter)return null;
  const refs=createPowderReferences();return requestPowderCustodyWork(s,operation('remove-primer',['ruth'],[refs.tin,original(chargeId),original(primerId),refs.pliers],{chargeId,primerId}),ctx);
}
export function requestFuseAttachment(s,chargeId,actorId,ctx){
  const index=chargeIds.slice(1,3).indexOf(chargeId);if(index<0)return null;
  const refs=createPowderReferences(),fuseId=refs.fuses[index].objectId;
  return requestPowderCustodyWork(s,operation('attach-fuse',[actorId],[original(chargeId),refs.fuses[index]],{chargeId,fuseId}),ctx);
}
export function requestFuseLighting(s,chargeId,actorId,ctx){
  const record=trainPowderRecord(s),index=chargeIds.slice(1,3).indexOf(chargeId);if(!record||index<0||record.fuses[index].litEventId!==null)return null;
  // Before the first light, both real children must already occupy their own
  // prepared sockets. Later continuation preserves a first actual blast.
  if(record.fuses.every(fuse=>fuse.litEventId===null)&&!record.fuses.every((fuse,i)=>{
    const child=authoritative(s,fuse.chargeRef,'sealed-charge');
    return child?.location?.type==='car'&&child.location.carId==='morrow-custody-coach'&&child.location.contactId===`private-hinge-${i===0?'a':'b'}`&&child.powder?.mode==='fused'&&!child.powder.spent&&typeof child.powder.primerId==='string'&&/^quarry-primer-[1-6]$/.test(child.powder.primerId)&&sameRef(child.powder.fuseRef,fuse.fuseRef);
  }))return null;
  const refs=createPowderReferences();let charge;try{charge=Custody.resolveFixedRef(s,original(chargeId),'sealed-charge');}catch{return null;}
  if(!charge.powder?.primerId)return null;
  return requestPowderCustodyWork(s,operation('light-fuse',[actorId],[original(chargeId),original(charge.powder.primerId),refs.fuses[index]],{chargeId,fuseId:refs.fuses[index].objectId}),ctx);
}

function fixedPoint(s,id,ctx){
  if(typeof ctx?.fixedContact!=='function')return null;
  try{const value=ctx.fixedContact(s,id);return point(value)?value:null;}catch{return null;}
}
function objectPoint(s,reference,ctx){
  if(typeof ctx?.objectGroundPoint!=='function')return null;
  try{const value=ctx.objectGroundPoint(s,copy(reference));return point(value)?value:null;}catch{return null;}
}
function authoritative(s,reference,kind){try{return Custody.resolveFixedRef(s,reference,kind);}catch{return null;}}
function pathLength(path){let length=0;for(let i=1;i<path.length;i++)length+=distance(path[i-1],path[i]);return length;}

export function inspectPowderCircuit(s,ctx){
  const record=trainPowderRecord(s);if(!record)return{closed:false,current:0,reason:'missing-record'};
  const circuit=record.circuit,charge=authoritative(s,record.refs.charges[0],'sealed-charge'),spool=authoritative(s,record.refs.spool,'wire-spool');
  const primer=charge?.powder?.primerId&&authoritative(s,original(charge.powder.primerId),'game-primer');
  const start=fixedPoint(s,'turnout-service-plate',ctx),end=fixedPoint(s,'ridge-detonator',ctx);
  if(!start||!end||!Array.isArray(circuit.path)||circuit.path.length<2||!circuit.path.every(point)||circuit.path.some((p,i)=>i>0&&(distance(p,circuit.path[i-1])<=EPS||distance(p,circuit.path[i-1])>4+EPS))||!samePoint(circuit.path[0],start)||!samePoint(circuit.path.at(-1),end)||!validatePowderWireBalance(spool)||Math.abs(pathLength(circuit.path)-spool.deployedLength)>EPS)return{closed:false,current:0,reason:'incomplete-wire'};
  if(circuit.terminals.charge.state!=='fastened'||circuit.terminals.detonator.state!=='fastened'||circuit.breakEventId!==null)return{closed:false,current:0,reason:'open-terminal'};
  if(!authoritative(s,record.refs.lead,'circuit-lead')||!authoritative(s,record.refs.detonator,'game-detonator')||!samePoint(objectPoint(s,record.refs.charges[0],ctx),start)||!samePoint(objectPoint(s,record.refs.detonator,ctx),end))return{closed:false,current:0,reason:'moved-anchor'};
  if(!charge||charge.powder?.spent||charge.powder?.mode!=='wired'||!primer||primer.state!=='attached'||primer.chargeId!==charge.id)return{closed:false,current:0,reason:'unusable-primer'};
  return{closed:true,current:1,reason:'continuous'};
}

function physicalPrecondition(s,op,ctx){
  const record=trainPowderRecord(s);if(!record||!physicalKinds.has(op.kind)||!capability(ctx?.authorizePowderPhysicalOp,s,copy(op)))return false;
  const circuit=record.circuit,side=op.options.side,spool=authoritative(s,record.refs.spool,'wire-spool');
  const charge=authoritative(s,record.refs.charges[0],'sealed-charge');
  if(op.kind==='begin-wire'){
    const anchor=fixedPoint(s,'turnout-service-plate',ctx),actual=objectPoint(s,record.refs.spool,ctx);
    return circuit.actorId===null&&circuit.path.length===0&&validatePowderWireBalance(spool)&&spool.deployedLength===0&&spool.location?.type==='carried'&&spool.location.targetId===op.actorIds[0]&&charge?.powder?.mode==='wired'&&!charge.powder.spent&&samePoint(anchor,actual);
  }
  if(op.kind==='fasten-terminal'){
    const target=fixedPoint(s,side==='charge'?'turnout-service-plate':'ridge-detonator',ctx);
    return ['charge','detonator'].includes(side)&&circuit.actorId!==null&&circuit.cutEventId===null&&circuit.terminals[side].state==='open'&&circuit.path.length>0&&samePoint(side==='charge'?circuit.path[0]:circuit.path.at(-1),target);
  }
  if(op.kind==='test-circuit')return circuit.path.length>1&&circuit.terminals.detonator.state==='fastened';
  if(op.kind==='stroke-detonator')return circuit.path.length>1&&circuit.terminals.detonator.state==='fastened'&&inspectPowderCircuit(s,ctx).current===0; // A live wired blast requires its own authorized physical cause.
  return side==='detonator'&&['fastened','released'].includes(circuit.terminals.detonator.state)&&circuit.recovery.disconnectAt===null;
}

function requestPhysicalWork(s,op,ctx){
  const record=trainPowderRecord(s);
  if(!record||!finite(s.elapsed)||!physicalPrecondition(s,op,ctx)||!finite(CUSTODY_WORK_SECONDS[op.kind])||CUSTODY_WORK_SECONDS[op.kind]<=0||!workContact(s,op,{start:s.elapsed,finish:s.elapsed},ctx))return null;
  // The custody bridge owns resource locks. Physical-only work also excludes
  // actors/refs already doing other physical work; it never creates stock.
  if(conflictsWithPending(s,op))return null;
  const event=physicalEvent(s,'circuit-work-started',{operation:op});record.workSerial++;
  record.pending.push({workId:event.id,requestId:`physical:${event.id}`,kind:op.kind,startedAt:s.elapsed,acceptedSeconds:0,intervals:[]});
  if(record.lastAdvancedAt===null)record.lastAdvancedAt=s.elapsed;
  return{workId:event.id,requiredSeconds:CUSTODY_WORK_SECONDS[op.kind]};
}

function completePhysicalWork(s,op,work,ctx){
  const circuit=trainPowderRecord(s).circuit;let measurement=null;
  if(op.kind==='begin-wire'){
    circuit.actorId=op.actorIds[0];circuit.path=[copy(fixedPoint(s,'turnout-service-plate',ctx))];
  }else if(op.kind==='fasten-terminal'){
    circuit.terminals[op.options.side]={state:'fastened',eventId:work.workId};
  }else if(op.kind==='disconnect-terminal'){
    circuit.terminals.detonator={state:'open',eventId:work.workId};
    circuit.recovery.disconnectAt=s.elapsed;circuit.recovery.safeAfter=s.elapsed+POWDER_SAFE_INTERVAL;
  }else if(op.kind==='test-circuit'){
    const measured=inspectPowderCircuit(s,ctx);measurement={closed:measured.closed,current:measured.current};circuit.lastTest={eventId:work.workId,at:s.elapsed,...measurement};
  }else if(op.kind==='stroke-detonator'){
    const measured=inspectPowderCircuit(s,ctx);
    if(measured.current!==0){physicalEvent(s,'work-cancelled',{workId:work.workId,reason:'commit-rejected'});return false;}
    measurement={closed:false,current:0};circuit.strokes.push(work.workId);circuit.lastTest={eventId:work.workId,at:s.elapsed,...measurement};
  }
  physicalEvent(s,'circuit-work-completed',{workId:work.workId,acceptedSeconds:work.acceptedSeconds,intervals:copy(work.intervals),measurement});return true;
}

export function requestWireStart(s,actorId,ctx){
  if(actorId!=='mara')return null;
  const refs=createPowderReferences();return requestPhysicalWork(s,operation('begin-wire',[actorId],[refs.charges[0],refs.spool,refs.lead],{},null),ctx);
}
export function requestTerminalFastening(s,side,actorId,ctx){
  if(!['charge','detonator'].includes(side))return null;
  const refs=createPowderReferences(),sources=side==='charge'?[refs.charges[0],refs.spool,refs.lead]:[refs.detonator,refs.spool];
  return requestPhysicalWork(s,operation('fasten-terminal',[actorId],sources,{side},null),ctx);
}
export function requestCircuitTest(s,actorId,ctx){const refs=createPowderReferences();return requestPhysicalWork(s,operation('test-circuit',[actorId],[refs.detonator],{},null),ctx);}
export function requestDetonatorStroke(s,ctx){const refs=createPowderReferences();return requestPhysicalWork(s,operation('stroke-detonator',['ruth'],[refs.detonator],{},null),ctx);}
export function requestCircuitDisconnect(s,ctx){const refs=createPowderReferences();return requestPhysicalWork(s,operation('disconnect-terminal',['ruth'],[refs.detonator,refs.pliers],{side:'detonator'},null),ctx);}

function immediateCustody(s,kind,actorIds,refs,options,event,ctx){
  if(!bridgeReady()||typeof Custody.physicalSnapshot!=='function')return null;
  const cause={missionId:TRAIN_ID,eventId:event.id},op={...operation(kind,actorIds,refs,options),cause};
  let request;try{request=Custody.beginCustodyRequest(s,op,ctx);}catch{return null;}
  if(!request||request.requiredSeconds!==0){if(request)Custody.cancelCustodyRequest(s,request.requestId);return null;}
  let snapshot;try{snapshot=Custody.physicalSnapshot(s,{actorIds,refs,destinations:[]},ctx);}catch{snapshot=null;}
  if(!snapshot){Custody.cancelCustodyRequest(s,request.requestId);return null;}
  const receipt={startedAt:s.elapsed,finishedAt:s.elapsed,acceptedSeconds:0,...snapshot,cause};
  let result;try{result=Custody.commitCustody(s,{requestId:request.requestId,acceptedWorkReceipt:receipt},physicalEffectsContext(ctx));}catch{result=null;}
  if(!result)Custody.cancelCustodyRequest(s,request.requestId);
  return result;
}

function prepareImmediatePowderEffects(s,op,canonicalEvent){
  const record=trainPowderRecord(s),event=record.physicalEvents.find(item=>item.id===op.cause?.eventId);
  if(!event||event.at!==s.elapsed||event.data.custodyEventId!==null)return null;
  const circuit=record.circuit;
  if(op.kind==='wire-pay-out'){
    if(event.kind!=='wire-motion'||circuit.cutEventId!==null||circuit.actorId!==op.options.motion.actorId||!samePoint(circuit.path.at(-1),op.options.motion.from)||JSON.stringify(event.data.motion)!==JSON.stringify(op.options.motion))return null;
  }else if(op.kind==='damage-primer'){
    if(event.kind!=='terminal-released'||circuit.breakEventId!==null||circuit.terminals.charge.state!=='fastened')return null;
  }else if(op.kind==='blast-charge'){
    const index=record.fuses.findIndex(fuse=>fuse.chargeRef.objectId===op.options.chargeId);
    if(event.kind!=='charge-blast'||index>=0&&record.fuses[index].blastEventId!==null)return null;
  }else return null;
  const snapshot={circuit:copy(circuit),fuses:copy(record.fuses),physicalEvents:copy(record.physicalEvents)};
  return{
    apply(){
      if(record.custodyEventRefs.filter(id=>id===canonicalEvent.id).length!==1)throw new TypeError('Canonical physical result was not committed exactly once');
      event.data.custodyEventId=canonicalEvent.id;
      if(op.kind==='wire-pay-out')circuit.path.push(...copy(op.options.motion.trace.groundPoints.slice(1)));
      else if(op.kind==='damage-primer'){
        circuit.breakEventId=event.id;circuit.terminals.charge={state:'released',eventId:event.id};
      }else{
        const fuse=record.fuses.find(item=>item.chargeRef.objectId===op.options.chargeId);if(fuse)fuse.blastEventId=canonicalEvent.id;
        if(op.options.chargeId===chargeIds[0])circuit.terminals.charge={state:'destroyed',eventId:event.id};
      }
    },
    rollback(){record.circuit=copy(snapshot.circuit);record.fuses=copy(snapshot.fuses);record.physicalEvents=copy(snapshot.physicalEvents);},
  };
}

export function applyAcceptedPowderMotion(s,motion,ctx){
  const record=trainPowderRecord(s);
  if(!record||!keys(motion,['actorId','from','to','startedAt','finishedAt','trace'])||record.circuit.actorId!==motion.actorId||record.circuit.cutEventId!==null||record.circuit.terminals.charge.state!=='fastened'||record.circuit.terminals.detonator.state==='fastened'||!finite(motion.startedAt)||!finite(motion.finishedAt)||motion.finishedAt!==s.elapsed||motion.finishedAt<=motion.startedAt||motion.finishedAt-motion.startedAt>POWDER_STEP_LIMIT+EPS||!samePoint(record.circuit.path.at(-1),motion.from)||!samePoint(objectPoint(s,record.refs.spool,ctx),motion.to)||!capability(ctx?.validateAcceptedMotion,s,copy(motion)))return false;
  const spool=authoritative(s,record.refs.spool,'wire-spool'),constraint=constrainPowderWireMotion(spool,motion.from,motion.to,motion.trace);
  if(!constraint.allowed||spool.location?.type!=='carried'||spool.location.targetId!==motion.actorId||!samePoint(objectPoint(s,record.refs.charges[0],ctx),fixedPoint(s,'turnout-service-plate',ctx)))return false;
  // Proven actual movement changes the actor's physical task. Cancel its old
  // fastening/transfer first; it receives no simultaneous work-time credit.
  interruptConflictingWork(s,operation('wire-pay-out',[motion.actorId],[record.refs.spool],{motion:copy(motion)}));
  const event=physicalEvent(s,'wire-motion',{motion:copy(motion),custodyEventId:null});
  const result=immediateCustody(s,'wire-pay-out',[motion.actorId],[record.refs.spool],{motion:copy(motion)},event,ctx);
  if(!result){record.physicalEvents.pop();return false;}return true;
}

export function requestWireCutClamp(s,actorId,to,ctx){
  const record=trainPowderRecord(s),refs=createPowderReferences();
  if(!record||record.circuit.actorId!==actorId||record.circuit.cutEventId!==null)return null;
  const circuit=record.circuit,normal=inspectPowderCircuit(s,ctx).closed&&circuit.lastTest?.current===1,safelyOpen=circuit.terminals.detonator.state==='open'&&circuit.recovery.safeAfter!==null&&s.elapsed+EPS>=circuit.recovery.safeAfter&&samePoint(circuit.path.at(-1),fixedPoint(s,'ridge-detonator',ctx));
  if(!normal&&!safelyOpen)return null;
  return requestPowderCustodyWork(s,operation('cut-clamp',[actorId],[refs.spool,refs.lead,refs.pliers],{},copy(to)),ctx);
}

/** Only a real accepted train-motion/ground-strain provider can release the
 * authored damaged collar. Time, stage and proximity flags are insufficient. */
export function applyPowderTerminalStrain(s,ctx){
  const record=trainPowderRecord(s);
  if(!record||record.circuit.breakEventId!==null||record.circuit.terminals.charge.state!=='fastened'||typeof ctx?.terminalStrain!=='function'||typeof ctx?.validateTerminalStrain!=='function')return false;
  let strain;try{strain=ctx.terminalStrain(s);}catch{return false;}
  if(!keys(strain,['at','trainId','carId','terminalId','passingSpeed','groundDistance','strain'])||strain.at!==s.elapsed||strain.trainId!=='morrow-freight-consist'||typeof strain.carId!=='string'||strain.terminalId!=='turnout-split-collar'||!finite(strain.passingSpeed)||strain.passingSpeed<=0||!finite(strain.groundDistance)||strain.groundDistance<0||strain.groundDistance>180||!finite(strain.strain)||strain.strain<1||!capability(ctx.validateTerminalStrain,s,copy(strain)))return false;
  const charge=authoritative(s,record.refs.charges[0],'sealed-charge'),primerId=charge?.powder?.primerId;
  if(!primerId||charge.powder.spent)return false;
  const primer=authoritative(s,original(primerId),'game-primer');if(primer?.state!=='attached')return false;
  const refs=[record.refs.tin,record.refs.charges[0],original(primerId)];
  return interruptingHazard(s,{actorIds:[],refs},()=>{
    const event=physicalEvent(s,'terminal-released',{physicalReceipt:copy(strain),primerRef:original(primerId),custodyEventId:null});
    const result=immediateCustody(s,'damage-primer',[],refs,{chargeId:charge.id,primerId,physicalReceipt:copy(strain)},event,ctx);
    if(!result){record.physicalEvents.pop();return false;}return true;
  });
}

function blastCharge(s,chargeRef,trigger,ctx,projectileReceipt=null){
  const record=trainPowderRecord(s),charge=record&&authoritative(s,chargeRef,'sealed-charge');
  if(!charge||!charge.powder||charge.powder.spent||typeof ctx?.blastGeometry!=='function'||typeof ctx.prepareBlastEffects!=='function')return false;
  if(trigger==='projectile'&&!capability(ctx.validatePowderProjectileHit,s,copy(projectileReceipt),copy(chargeRef)))return false;
  const refs=[chargeRef,...(charge.powder.primerId?[original(charge.powder.primerId)]:[]),...(charge.powder.fuseRef?[copy(charge.powder.fuseRef)]:[])];
  return interruptingHazard(s,{actorIds:[],refs},()=>{
    const event=physicalEvent(s,'charge-blast',{chargeRef:copy(chargeRef),trigger,projectileReceipt:copy(projectileReceipt),custodyEventId:null});
    const cause={missionId:TRAIN_ID,eventId:event.id};let receipt;
    try{receipt=ctx.blastGeometry(s,{chargeRef:copy(chargeRef),trigger,cause});}catch{receipt=null;}
    if(!receipt||receipt.custodyEventId!==null||receipt.at!==s.elapsed||JSON.stringify(receipt.cause)!==JSON.stringify(cause)){record.physicalEvents.pop();return false;}
    const result=immediateCustody(s,'blast-charge',[],refs,{chargeId:charge.id,trigger,physicalReceipt:receipt},event,ctx);
    if(!result){record.physicalEvents.pop();return false;}return true;
  });
}

/** Deadline derives from the once-only light event; restore and menu redraws
 * neither restart the clock nor replenish its spent primer/fuse. The journey
 * owner calls after accepted steps only; paused worlds keep the same elapsed. */
export function advancePowderFuses(s,ctx,{paused=false}={}){
  const record=trainPowderRecord(s),blasted=[];
  if(!record||paused||record.lastAdvancedAt!==s.elapsed)return blasted;
  for(const fuse of record.fuses){
    if(fuse.litEventId!==null&&fuse.blastEventId===null&&finite(fuse.dueAt)&&s.elapsed+EPS>=fuse.dueAt&&blastCharge(s,fuse.chargeRef,'fuse',ctx))blasted.push(fuse.chargeRef.objectId);
  }
  return blasted;
}
export function applyPowderProjectileHit(s,chargeRef,hitReceipt,ctx){return blastCharge(s,chargeRef,'projectile',ctx,hitReceipt);}

/** Structural half of Save validation. The owning continuation must ALSO
 * validate kit/primer/charge custody and these referenced canonical events.
 * This never blesses a standalone caller-created inventory. */
export function validatePowderWorkHistory(record,now,{requestFor,eventFor,fixedContactFor,sourceForRevision}={}){
  const expected=createTrainPowderRecord();
  if(!keys(record,Object.keys(expected))||record.schema!==POWDER_SCHEMA||!validatePowderReferences(record.refs)||!plain(record.kit)||!finite(now)||now<0||record.lastAdvancedAt!==null&&(!finite(record.lastAdvancedAt)||record.lastAdvancedAt<0||record.lastAdvancedAt>now)||!Number.isSafeInteger(record.workSerial)||record.workSerial<0||!Array.isArray(record.pending)||!Array.isArray(record.physicalEvents)||!Array.isArray(record.custodyEventRefs)||record.physicalEvents.length>50000||new Set(record.custodyEventRefs).size!==record.custodyEventRefs.length)return false;
  const kitRefs=[record.refs.spool,record.refs.lead,record.refs.detonator,record.refs.pliers,...record.refs.fuses];
  const kitIds=Object.keys(record.kit);
  if(kitIds.length!==0&&kitIds.length!==kitRefs.length||kitIds.some(id=>!kitRefs.some(ref=>ref.objectId===id)))return false;
  if(kitIds.length&&(!record.custodyEventRefs.some(id=>typeof eventFor==='function'&&eventFor(id)?.kind==='issue-kit')||kitIds.some(id=>record.kit[id]?.id!==id||Object.hasOwn(record.kit[id],'ownerId'))))return false;
  const starts=new Map(),finishes=new Map();let at=0;
  for(let i=0;i<record.physicalEvents.length;i++){
    const event=record.physicalEvents[i];
    if(!keys(event,['id','kind','at','data'])||event.id!==`powder-event-${i+1}`||!finite(event.at)||event.at<at||event.at>now)return false;
    at=event.at;
    if(event.kind==='work-started'){
      if(!keys(event.data,['operationKind','requestId'])||!custodyKinds.has(event.data.operationKind)||typeof event.data.requestId!=='string'||!event.data.requestId)return false;
      starts.set(event.id,event);
    }else if(event.kind==='circuit-work-started'){
      if(!keys(event.data,['operation'])||!validPhysicalOperation(event.data.operation))return false;
      starts.set(event.id,event);
    }else if(event.kind==='preparation-inspection-started'){
      if(!validInspectionStart(event,sourceForRevision,eventFor))return false;
      starts.set(event.id,event);
    }else if(event.kind==='preparation-inspection-completed'){
      const start=starts.get(event.data?.workId);
      if(start?.kind!=='preparation-inspection-started'||finishes.has(start.id))return false;
      finishes.set(start.id,event);
    }else if(event.kind==='work-completed'){
      if(!keys(event.data,['workId','custodyEventId','acceptedSeconds','intervals'])||!starts.has(event.data.workId)||finishes.has(event.data.workId)||typeof event.data.custodyEventId!=='string'||typeof eventFor!=='function')return false;
      const canonical=eventFor(event.data.custodyEventId);
      const start=starts.get(event.data.workId),work={workId:start.id,requestId:start.data.requestId,kind:start.data.operationKind,startedAt:start.at,acceptedSeconds:event.data.acceptedSeconds,intervals:event.data.intervals};
      if(!canonical||canonical.kind!==work.kind||canonical.requestId!==work.requestId||canonical.operation?.cause?.eventId!==work.workId||canonical.workReceipt?.startedAt!==work.startedAt||canonical.workReceipt.finishedAt!==event.at||Math.abs(canonical.workReceipt.acceptedSeconds-work.acceptedSeconds)>EPS||!validatePowderPendingWork(work,event.at)||work.acceptedSeconds+EPS<CUSTODY_WORK_SECONDS[work.kind]||work.intervals.at(-1)?.finish!==event.at||!record.custodyEventRefs.includes(event.data.custodyEventId))return false;
      finishes.set(event.data.workId,event);
    }else if(event.kind==='circuit-work-completed'){
      const start=starts.get(event.data?.workId);
      if(!keys(event.data,['workId','acceptedSeconds','intervals','measurement'])||start?.kind!=='circuit-work-started'||finishes.has(event.data.workId))return false;
      const work={workId:start.id,requestId:`physical:${start.id}`,kind:start.data.operation.kind,startedAt:start.at,acceptedSeconds:event.data.acceptedSeconds,intervals:event.data.intervals};
      if(!validatePowderPendingWork(work,event.at)||work.acceptedSeconds+EPS<CUSTODY_WORK_SECONDS[work.kind]||work.intervals.at(-1)?.finish!==event.at)return false;
      if(['test-circuit','stroke-detonator'].includes(work.kind)){
        if(!keys(event.data.measurement,['closed','current'])||![0,1].includes(event.data.measurement.current)||event.data.measurement.closed!==(event.data.measurement.current===1)||work.kind==='stroke-detonator'&&event.data.measurement.current!==0)return false;
      }else if(event.data.measurement!==null)return false;
      finishes.set(start.id,event);
    }else if(event.kind==='work-cancelled'){
      if(!keys(event.data,['workId','reason'])||!starts.has(event.data.workId)||finishes.has(event.data.workId)||!['interrupted','contact-lost','stale-request','commit-rejected'].includes(event.data.reason))return false;
      finishes.set(event.data.workId,event);
    }else if(['wire-motion','terminal-released','charge-blast'].includes(event.kind)){
      if(!validImmediateEvent(event,eventFor)||!record.custodyEventRefs.includes(event.data.custodyEventId))return false;
    }else return false;
  }
  if(starts.size!==record.workSerial||new Set(record.pending.map(work=>work.workId)).size!==record.pending.length)return false;
  const pendingLocks=new Set();
  for(const work of record.pending){
    const start=starts.get(work.workId);
    let operation;
    if(!validatePowderPendingWork(work,now)||!start||finishes.has(work.workId)||start.at!==work.startedAt)return false;
    if(start.kind==='circuit-work-started'){
      if(work.requestId!==`physical:${start.id}`||work.kind!==start.data.operation.kind)return false;
      operation=start.data.operation;
    }else if(start.kind==='preparation-inspection-started'){
      if(work.requestId!==`inspection:${start.id}`||work.kind!==start.data.operation.kind)return false;
      operation=start.data.operation;
    }else{
      const request=typeof requestFor==='function'&&requestFor(work.requestId);
      if(start.data.requestId!==work.requestId||start.data.operationKind!==work.kind||!request||request.operation?.cause?.eventId!==work.workId||request.operation.kind!==work.kind)return false;
      operation=request.operation;
    }
    for(const lock of [...operation.actorIds.map(id=>`actor/${id}`),...operation.refs.map(ref=>`ref/${ref.sourceMissionId}/${ref.objectId}`)]){if(pendingLocks.has(lock))return false;pendingLocks.add(lock);}
  }
  if([...starts.keys()].some(id=>!finishes.has(id)&&!record.pending.some(work=>work.workId===id)))return false;
  return record.custodyEventRefs.every(id=>typeof id==='string'&&record.physicalEvents.filter(event=>['work-completed','wire-motion','terminal-released','charge-blast'].includes(event.kind)&&event.data.custodyEventId===id).length===1)&&inspectionRows(record,now,{sourceForRevision,eventFor})!==null&&validateCircuitHistory(record,now,eventFor,finishes,fixedContactFor)&&validateFuseHistory(record,now,eventFor);
}

function validPhysicalOperation(op){
  if(!keys(op,['kind','actorIds','refs','to','options'])||!physicalKinds.has(op.kind)||!Array.isArray(op.actorIds)||op.actorIds.length!==1||!['mara','ruth'].includes(op.actorIds[0])||!Array.isArray(op.refs)||op.to!==null)return false;
  const refs=createPowderReferences();let expected;
  if(op.kind==='fasten-terminal'){
    if(!keys(op.options,['side'])||!['charge','detonator'].includes(op.options.side))return false;
    expected=op.options.side==='charge'?[refs.charges[0],refs.spool,refs.lead]:[refs.detonator,refs.spool];
  }else if(op.kind==='disconnect-terminal'){
    if(!keys(op.options,['side'])||op.options.side!=='detonator'||op.actorIds[0]!=='ruth')return false;expected=[refs.detonator,refs.pliers];
  }else{
    if(!keys(op.options,[]))return false;
    if(op.kind==='begin-wire'){if(op.actorIds[0]!=='mara')return false;expected=[refs.charges[0],refs.spool,refs.lead];}
    else{if(op.kind==='stroke-detonator'&&op.actorIds[0]!=='ruth')return false;expected=[refs.detonator];}
  }
  return op.refs.length===expected.length&&op.refs.every((ref,index)=>sameRef(ref,expected[index]));
}
function validImmediateEvent(event,eventFor){
  const data=event.data;
  if(typeof eventFor!=='function'||typeof data?.custodyEventId!=='string')return false;
  const canonical=eventFor(data.custodyEventId),expectedKind={'wire-motion':'wire-pay-out','terminal-released':'damage-primer','charge-blast':'blast-charge'}[event.kind];
  if(!canonical||canonical.kind!==expectedKind)return false;
  if(event.kind==='wire-motion'){
    const motion=data.motion;
    return keys(data,['motion','custodyEventId'])&&keys(motion,['actorId','from','to','startedAt','finishedAt','trace'])&&motion.actorId==='mara'&&finite(motion.startedAt)&&motion.startedAt>=0&&motion.finishedAt===event.at&&motion.finishedAt>motion.startedAt&&motion.finishedAt-motion.startedAt<=POWDER_STEP_LIMIT+EPS&&inspectPowderGroundTrace(motion.trace,motion.from,motion.to)!==null;
  }
  if(event.kind==='terminal-released'){
    const strain=data.physicalReceipt;
    return keys(data,['physicalReceipt','primerRef','custodyEventId'])&&keys(strain,['at','trainId','carId','terminalId','passingSpeed','groundDistance','strain'])&&strain.at===event.at&&strain.trainId==='morrow-freight-consist'&&typeof strain.carId==='string'&&strain.terminalId==='turnout-split-collar'&&finite(strain.passingSpeed)&&strain.passingSpeed>0&&finite(strain.groundDistance)&&strain.groundDistance>=0&&strain.groundDistance<=180&&finite(strain.strain)&&strain.strain>=1&&keys(data.primerRef,['sourceMissionId','objectId'])&&data.primerRef.sourceMissionId===POWDER_SOURCE_MISSION&&/^quarry-primer-[1-6]$/.test(data.primerRef.objectId);
  }
  return keys(data,['chargeRef','trigger','projectileReceipt','custodyEventId'])&&chargeIds.some(id=>sameRef(data.chargeRef,original(id)))&&['fuse','projectile'].includes(data.trigger)&&(data.trigger==='fuse'?data.projectileReceipt===null:plain(data.projectileReceipt));
}

function validateCircuitHistory(record,now,eventFor,finishes,fixedContactFor){
  const circuit=record.circuit,expected=createTrainPowderRecord().circuit;
  if(!keys(circuit,Object.keys(expected))||!sameRef(circuit.anchorRef,record.refs.charges[0])||!Array.isArray(circuit.path)||circuit.path.length>10000||!circuit.path.every(point)||![null,'mara'].includes(circuit.actorId)||!keys(circuit.terminals,['charge','detonator'])||!Array.isArray(circuit.strokes)||new Set(circuit.strokes).size!==circuit.strokes.length)return false;
  for(let i=1;i<circuit.path.length;i++)if(distance(circuit.path[i-1],circuit.path[i])<=EPS||distance(circuit.path[i-1],circuit.path[i])>4+EPS)return false;
  const completedOperation=(id,kind,side=null)=>{
    const start=record.physicalEvents.find(event=>event.id===id),finish=finishes.get(id);
    return start?.kind==='circuit-work-started'&&start.data.operation.kind===kind&&finish?.kind==='circuit-work-completed'&&(side===null||start.data.operation.options.side===side);
  };
  for(const side of ['charge','detonator']){
    const terminal=circuit.terminals[side];
    if(!keys(terminal,['state','eventId'])||!['open','fastened','released','destroyed'].includes(terminal.state))return false;
    if(terminal.state==='fastened'&&!completedOperation(terminal.eventId,'fasten-terminal',side))return false;
    if(terminal.state==='released'&&(side!=='charge'||terminal.eventId!==circuit.breakEventId))return false;
    if(terminal.state==='destroyed'&&(side!=='charge'||record.physicalEvents.find(event=>event.id===terminal.eventId)?.data?.chargeRef?.objectId!==chargeIds[0]))return false;
    if(terminal.state==='open'&&terminal.eventId!==null&&!completedOperation(terminal.eventId,'disconnect-terminal',side))return false;
  }
  if(circuit.path.length>0){
    if(typeof fixedContactFor!=='function'||!samePoint(circuit.path[0],fixedContactFor('turnout-service-plate')))return false;
    const beginnings=record.physicalEvents.filter(event=>event.kind==='circuit-work-started'&&event.data.operation.kind==='begin-wire'&&finishes.has(event.id));
    if(beginnings.length!==1||!validatePowderWireBalance(record.kit[record.refs.spool.objectId])||Math.abs(pathLength(circuit.path)-record.kit[record.refs.spool.objectId].deployedLength)>EPS)return false;
    const motions=record.physicalEvents.filter(event=>event.kind==='wire-motion');
    let end=circuit.path[0];const derived=[copy(end)];
    for(const event of motions){if(!samePoint(end,event.data.motion.from))return false;derived.push(...event.data.motion.trace.groundPoints.slice(1));end=event.data.motion.to;}
    if(JSON.stringify(derived)!==JSON.stringify(circuit.path))return false;
    if(circuit.actorId===null&&circuit.cutEventId===null)return false;
  }
  if(circuit.cutEventId!==null&&(typeof eventFor!=='function'||eventFor(circuit.cutEventId)?.kind!=='cut-clamp'||circuit.actorId!==null))return false;
  if(circuit.breakEventId!==null&&record.physicalEvents.find(event=>event.id===circuit.breakEventId)?.kind!=='terminal-released')return false;
  if(circuit.lastTest!==null){
    const value=circuit.lastTest,start=record.physicalEvents.find(event=>event.id===value?.eventId),finish=finishes.get(value?.eventId);
    if(!keys(value,['eventId','at','closed','current'])||![0,1].includes(value.current)||value.closed!==(value.current===1)||start?.kind!=='circuit-work-started'||!['test-circuit','stroke-detonator'].includes(start.data.operation.kind)||finish?.at!==value.at||value.at>now)return false;
  }
  if(circuit.strokes.some(id=>!completedOperation(id,'stroke-detonator')))return false;
  const recovery=circuit.recovery;
  if(!keys(recovery,['disconnectAt','safeAfter','removedPrimerEventId','recoveredChargeEventId']))return false;
  if(recovery.disconnectAt===null){if(Object.values(recovery).some(value=>value!==null))return false;}
  else{
    if(!finite(recovery.disconnectAt)||recovery.disconnectAt>now||recovery.safeAfter!==recovery.disconnectAt+POWDER_SAFE_INTERVAL||!record.physicalEvents.some(event=>event.kind==='circuit-work-completed'&&event.at===recovery.disconnectAt&&completedOperation(event.data.workId,'disconnect-terminal')))return false;
    for(const [key,kind] of [['removedPrimerEventId','remove-primer'],['recoveredChargeEventId','move-object']])if(recovery[key]!==null&&(typeof eventFor!=='function'||eventFor(recovery[key])?.kind!==kind||eventFor(recovery[key]).at<recovery.safeAfter))return false;
    if(recovery.recoveredChargeEventId!==null&&recovery.removedPrimerEventId===null)return false;
  }
  const derived={actorId:null,terminals:{charge:{state:'open',eventId:null},detonator:{state:'open',eventId:null}},cutEventId:null,lastTest:null,breakEventId:null,strokes:[],recovery:{disconnectAt:null,safeAfter:null,removedPrimerEventId:null,recoveredChargeEventId:null}},route=[];
  for(const event of record.physicalEvents){
    if(event.kind==='circuit-work-completed'){
      const op=record.physicalEvents.find(start=>start.id===event.data.workId)?.data.operation;
      if(op.kind==='begin-wire'){if(derived.actorId!==null||route.length||typeof fixedContactFor!=='function')return false;derived.actorId=op.actorIds[0];route.push(copy(fixedContactFor('turnout-service-plate')));}
      else if(op.kind==='fasten-terminal'){
        if(derived.terminals[op.options.side].state!=='open'||derived.actorId===null||derived.cutEventId!==null||!route.length||op.options.side==='detonator'&&!samePoint(route.at(-1),fixedContactFor('ridge-detonator')))return false;
        derived.terminals[op.options.side]={state:'fastened',eventId:event.data.workId};
      }else if(op.kind==='disconnect-terminal'){
        if(derived.recovery.disconnectAt!==null||derived.terminals.detonator.state!=='fastened')return false;
        derived.terminals.detonator={state:'open',eventId:event.data.workId};derived.recovery.disconnectAt=event.at;derived.recovery.safeAfter=event.at+POWDER_SAFE_INTERVAL;
      }else{
        if(route.length<2||derived.terminals.detonator.state!=='fastened')return false;
        const expectedCurrent=derived.terminals.charge.state==='fastened'&&derived.breakEventId===null?1:0;
        if(event.data.measurement.current!==expectedCurrent)return false;
        derived.lastTest={eventId:event.data.workId,at:event.at,...event.data.measurement};if(op.kind==='stroke-detonator')derived.strokes.push(event.data.workId);
      }
    }else if(event.kind==='terminal-released'){
      if(derived.breakEventId!==null||derived.terminals.charge.state!=='fastened')return false;
      derived.breakEventId=event.id;derived.terminals.charge={state:'released',eventId:event.id};
    }else if(event.kind==='work-completed'){
      const canonical=eventFor(event.data.custodyEventId),op=canonical.operation;
      if(canonical.kind==='cut-clamp'){
        const normal=derived.lastTest?.current===1&&derived.terminals.charge.state==='fastened'&&derived.terminals.detonator.state==='fastened',safe=derived.terminals.detonator.state==='open'&&derived.recovery.safeAfter!==null&&event.at+EPS>=derived.recovery.safeAfter;
        if(derived.cutEventId!==null||derived.actorId===null||!samePoint(route.at(-1),fixedContactFor('ridge-detonator'))||!normal&&!safe)return false;
        derived.cutEventId=canonical.id;derived.actorId=null;
      }else if(canonical.kind==='remove-primer'){
        if(derived.recovery.safeAfter===null||event.at+EPS<derived.recovery.safeAfter)return false;derived.recovery.removedPrimerEventId=canonical.id;
      }else if(canonical.kind==='move-object'){
        const first=op.refs.some(ref=>sameRef(ref,record.refs.charges[0])),spool=op.refs.some(ref=>sameRef(ref,record.refs.spool)),liveTerminal=op.refs.some(ref=>[record.refs.lead,record.refs.detonator].some(terminal=>sameRef(ref,terminal)));
        if(first&&route.length&&derived.recovery.removedPrimerEventId===null||spool&&route.length&&derived.cutEventId===null||liveTerminal&&derived.terminals.detonator.state==='fastened'&&derived.recovery.disconnectAt===null)return false;
        if(first&&op.to?.location?.type==='carried'&&op.to.location.targetId==='ruth'&&derived.recovery.removedPrimerEventId!==null)derived.recovery.recoveredChargeEventId=canonical.id;
      }
    }else if(event.kind==='wire-motion'){
      if(derived.actorId!=='mara'||derived.cutEventId!==null||derived.terminals.charge.state!=='fastened'||derived.terminals.detonator.state==='fastened'||!samePoint(route.at(-1),event.data.motion.from))return false;
      route.push(...copy(event.data.motion.trace.groundPoints.slice(1)));
    }else if(event.kind==='charge-blast'&&event.data.chargeRef.objectId===chargeIds[0])derived.terminals.charge={state:'destroyed',eventId:event.id};
  }
  return JSON.stringify(route)===JSON.stringify(circuit.path)&&Object.keys(derived).every(key=>JSON.stringify(circuit[key])===JSON.stringify(derived[key]));
}

function validateFuseHistory(record,now,eventFor){
  if(!Array.isArray(record.fuses)||record.fuses.length!==2)return false;
  for(let i=0;i<2;i++){
    const fuse=record.fuses[i];
    if(!keys(fuse,['chargeRef','fuseRef','litEventId','litAt','dueAt','blastEventId'])||!sameRef(fuse.chargeRef,record.refs.charges[i+1])||!sameRef(fuse.fuseRef,record.refs.fuses[i]))return false;
    const blast=fuse.blastEventId!==null&&typeof eventFor==='function'?eventFor(fuse.blastEventId):null;
    if((fuse.litEventId!==null||fuse.blastEventId!==null)&&record.kit[fuse.fuseRef.objectId]?.fuseSeconds!==fuseDurations[fuse.fuseRef.objectId])return false;
    if(fuse.blastEventId!==null&&(!blast||blast.kind!=='blast-charge'||blast.operation?.options?.chargeId!==fuse.chargeRef.objectId))return false;
    if(fuse.litEventId===null){if(fuse.litAt!==null||fuse.dueAt!==null||fuse.blastEventId!==null&&blast.operation.options.trigger!=='projectile')return false;}
    else{
      const light=typeof eventFor==='function'?eventFor(fuse.litEventId):null;
      if(!light||light.kind!=='light-fuse'||light.at!==fuse.litAt||light.operation?.options?.chargeId!==fuse.chargeRef.objectId||light.operation.options.fuseId!==fuse.fuseRef.objectId||!finite(fuse.litAt)||fuse.litAt>now||fuse.dueAt!==fuse.litAt+fuseDurations[fuse.fuseRef.objectId])return false;
      if(blast?.operation.options.trigger==='fuse'&&blast.at+EPS<fuse.dueAt)return false;
    }
  }
  return true;
}
