/** Scene three. Preparation is declared by an actual call after the heard
 * agreement. All material facts remain in the original custody authorities;
 * native owners must prove loading, duty, clothing and departure separately.
 */
import {TRAIN_ID,TRAIN_STAGES} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {NORTH_CUTTING_WORLD} from '../content/campaign/north-cutting.js';
import {SNOWBOUND_WORLD} from '../content/campaign/snowbound.js';
import {TRAIN_TOOL_CASE,TRAIN_KIT_IDS} from '../content/campaign/train-equipment.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,isTrainGearRef} from './train-gear.js';
import {TRAIN_BRIEFING_TABLE} from '../content/campaign/train-camp.js';
import * as Powder from './train-powder.js';
import {inspectCustodyRequest,resolveFixedRef} from './rival-continuation.js';
import {originalWeaponRef,activeRivalWeaponLoan} from './rival-weapon-loan.js';
import {resolveTrainWeapon} from './train-combat.js';

const copy=structuredClone,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),point=a=>({x:a.x,y:a.y,z:a.z||0});
const validPoint=p=>keys(p,['x','y','z'])&&['x','y','z'].every(k=>finite(p[k]))&&p.x>=0&&p.x<=SNOWBOUND_WORLD.width&&p.y>=0&&p.y<=SNOWBOUND_WORLD.height&&p.z>=0&&p.z<=160;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),near=(a,b,r)=>a&&b&&Math.abs((a.z||0)-(b.z||0))<8&&distance(a,b)<=r;
const record=s=>s.campaign?.missions?.[TRAIN_ID],state=s=>record(s)?.train?.preparation,rival=s=>s.campaign?.missions?.[RIVAL_ID];
const original=objectId=>({sourceMissionId:RIVAL_ID,objectId}),kitRef=objectId=>({sourceMissionId:TRAIN_ID,objectId});
const childIds=Object.freeze(Array.from({length:4},(_,i)=>`quarry-sealed-charge-${i+1}`));
const mandatory=Object.freeze(['store','capsWire','holding','stable','loadout','readiness']);
const line=(lineId,speakerId,text)=>({lineId,speakerId,text});
export const TRAIN_PREPARATION_LINES=Object.freeze({
  store:[line('prepare-four-ruth','ruth','Four numbered bundles, and each number keeps its own job. The first belongs at the turnout plate; the second and third are reserved for separate hinges. The fourth stays wrapped.'),line('prepare-four-mara','mara','Then show me all four together. A number on a list cannot tell me where its bundle went.'),line('prepare-four-ruth-separate','ruth','And the caps belong to their own tin. Neither a full crate nor an empty wrapper tells us how many usable caps remain.')],
  capsWire:[line('prepare-caps-ruth','ruth','Read the tin by the units that are actually here: usable, attached, damaged or spent. Opening it twice does not make a second supply.'),line('prepare-wire-mara','mara','The reel, lead, handle, pliers and the two hinge fuses each need a place on Plover. The wire stays on the reel until somebody carries it over real ground.'),line('prepare-wire-ruth','ruth','One prepared bundle travels apart from the wrapped reserves, and the tin has its own pouch. Do not hide a live attachment by putting the first back inside the crate.')],
  holding:[line('prepare-holding-mara','mara','Bastian does not leave Levi with the name of a replacement. I want the people taking the watch here before he goes.'),line('prepare-holding-inez','inez','I take the doorway while Hob takes the next watch from me. We change hands beside the same bench; none of that changes what Levi has eaten or said.'),line('prepare-holding-hob','hob','I will answer for the watch I actually take. His bowl still comes from Orla’s account, not from a useful answer.')],
  stable:[line('prepare-stable-ruth','ruth','Plover goes with me. The animals staying here still need their own tack, water and care; leaving a saddle behind is not the same as leaving somebody to check it.'),line('prepare-stable-inez','inez','Once Hob holds the doorway, I can take the stable work here. I cannot be useful in two rooms by calling both of them watched.'),line('prepare-stable-mara','mara','Then we finish both handovers and look at the animals that are actually here. We do not feed a name or repair an empty stall.')],
  loadout:[line('prepare-gun-mara','mara','Use the guns and rounds we have. The plan does not put a full magazine into an empty hand.'),line('prepare-gun-bastian','bastian','If you kept my engraved gun, a loan is a loan. Choose what stays in your own hand before you pass something else to me.'),line('prepare-gun-mara-return','mara','The same gun comes back with the rounds that remain. We will not call a different weapon its return.')],
  readiness:[line('prepare-ready-ruth','ruth','You agreed to prepare. Saying ready now sends me out on Plover with the load we actually checked.'),line('prepare-ready-mara','mara','Let me review the watch, the loads and the weapons once more. Waiting keeps them where our hands left them; it does not start the road without us.')],
  review:[line('prepare-review-ruth','ruth','First at the turnout, two reserved for the hinges, fourth still wrapped. The tin and tools travel separately, and every transfer keeps the original number.'),line('prepare-review-mara','mara','Camp remains part of this plan. A guarded bench and a living mount are work we have to keep doing.')],
  workers:[line('prepare-workers-mara','mara','A clerk keeping a door shut may be protecting a wage book. We still need room for that person to come out.'),line('prepare-workers-della','della','Keep that distinction when the door is iron and the answer is slow. Company property and a worker’s life are separate things.')],
  whyLater:[line('prepare-later-mara','mara','Preparing the road has not answered every objection to taking it. Could these originals still reach a later hearing?'),line('prepare-later-tomas','tomas','A later hearing needs the papers and people able to identify them. That is why we are doing this work; it is not permission to pretend the danger has disappeared.')],
});
const completed=(p,kind)=>p.completed.some(e=>e.kind===kind);
const active=s=>s.version===5&&s.campaign?.activeMissionId===TRAIN_ID&&record(s)?.train?.runtimeVersion===1&&[2,3].includes(record(s).mission.stage)&&s.region==='snowbound';
function regionOf(s,a,seen=new Set()){if(!a||seen.has(a.id))return null;seen.add(a.id);return !a.attachment?a.regionId:a.attachment.type==='rest'?a.attachment.regionId:regionOf(s,s.entities[a.attachment.targetId],seen);}
const alive=(s,id)=>s.entities?.[id]?.hp>0&&regionOf(s,s.entities[id])==='snowbound'&&!s.entities[id].departed;
function held(s){const a=s.entities?.levi;return alive(s,'levi')&&a.bound&&a.attachment?.type==='rest'&&a.attachment.targetId===RIVAL_WORLD.camp.holding.id;}
function callAllowed(s){return active(s)&&record(s).mission.stage===2&&record(s).train.chronicle.acceptedAt!==null&&!record(s).train.powder.pending.length&&!Object.keys(rival(s).rival.continuation.requests).length&&!s.dialog&&!s.failure&&alive(s,'mara')&&alive(s,'ruth')&&!s.entities.mara.mounted&&!s.entities.mara.carrying&&near(s.entities.mara,s.entities.ruth,75);}
export const usesTrainPreparation=s=>record(s)?.train?.preparationVersion===1;
export function createTrainPreparation(s){
  if(!callAllowed(s))throw new TypeError('Preparation requires an actual nearby call after acceptance');
  return{schema:1,startedAt:s.elapsed,calledAt:s.elapsed,callPosition:point(s.entities.mara),calledRuthPosition:point(s.entities.ruth),lastStepAt:s.elapsed,campSetup:{schema:1,sites:{}},exchangeSerial:0,heard:[],completed:[],exchange:null,work:null,decision:null,decisions:[],stableDuty:null,maskChoice:null,departure:null,completedAt:null};
}

/** Reconstruct only material/guard facts at a recorded time. Current bodies,
 * rounds and earlier stories are never replaced by this detached view. */
export function preparationMaterialAt(s,at=s.elapsed){
  const c=rival(s)?.rival?.continuation;if(!c||!finite(at)||at<0||at>s.elapsed)return null;
  const initial=c.baseline||{objects:rival(s).objects,kit:record(s)?.train?.powder?.kit||{},guardPresent:Object.hasOwn(rival(s).captivity,'guardId'),guardId:rival(s).captivity.guardId??null};
  const result={objects:copy(initial.objects),kit:copy(initial.kit),gear:{},guardId:initial.guardPresent?initial.guardId:null,eventIds:[]};
  for(const e of c.events){if(e.at>at)break;result.eventIds.push(e.id);for(const effect of e.effects){const map=isTrainGearRef(effect.ref)?result.gear:effect.ref.sourceMissionId===RIVAL_ID?result.objects:effect.ref.sourceMissionId===TRAIN_ID?result.kit:null;if(map){if(effect.after===null)delete map[effect.ref.objectId];else map[effect.ref.objectId]=copy(effect.after);}}if(e.guardChange)result.guardId=e.guardChange.after;}
  return result;
}
export function preparationMaterialEvidence(s,at=s.elapsed){
  const model=preparationMaterialAt(s,at);if(!model)return null;
  const first=model.objects[childIds[0]],tin=model.objects['cap-tin'],units=tin?.primers||[],spool=model.kit['brass-wire-spool'];
  return{at,childRefs:childIds.map(original),crateRef:original('charge-crate'),tinRef:original('cap-tin'),kitRefs:TRAIN_KIT_IDS.map(kitRef),eventIds:model.eventIds,guardId:model.guardId,firstPrimerId:first?.powder?.primerId??null,primerStates:units.map(unit=>({id:unit.id,state:unit.state})),wire:spool?{issuedLength:spool.issuedLength,onReel:spool.onReel,deployedLength:spool.deployedLength,cutoffLength:spool.cutoffLength,lostLength:spool.lostLength}:null};
}
function inspectionEvidence(s,at=s.elapsed){
  if(typeof Powder.preparationInspectionEvidence!=='function')return null;
  try{return Powder.preparationInspectionEvidence(s,{since:state(s).startedAt,at});}catch{return null;}
}
function inspectionCoverage(rows){
  if(!Array.isArray(rows))return false;
  return childIds.every(id=>rows.some(row=>row.topic==='child-seal'&&same(row.ref,original(id))))&&rows.some(row=>row.topic==='primer-tin')&&rows.some(row=>row.topic==='wire-and-tools');
}
function inspectedChildren(rows){return Array.isArray(rows)&&childIds.every(id=>rows.some(row=>row.topic==='child-seal'&&same(row.ref,original(id))));}
function heardBy(p,kind,at){return p.completed.some(e=>e.kind===kind&&e.at<=at);}
function hearingAllowed(s,kind,at,completedHistory=state(s).completed){
  const p=state(s),finished=kind=>completedHistory.some(e=>e.kind===kind&&e.at<=at);if(kind==='store')return true;if(!finished('store'))return false;
  const model=preparationMaterialAt(s,at);
  if(kind==='capsWire')return inspectionCoverage(inspectionEvidence(s,at))&&!!model.objects['cap-tin']?.openingEventId&&TRAIN_KIT_IDS.every(id=>model.kit[id]);
  if(kind==='stable')return model.guardId==='hob'&&rival(s).rival.continuation.events.some(e=>e.kind==='guard-handover'&&e.at>=p.startedAt&&e.at<=at&&e.operation.options.fromActorId==='inez'&&e.operation.options.toActorId==='hob');
  if(kind==='loadout')return model.guardId!=='bastian';
  if(kind==='readiness')return mandatory.filter(k=>k!=='readiness').every(k=>finished(k));
  return true;
}
function proofAccepted(owners,key,s,value,at){try{return value!==null&&typeof owners?.[key]==='function'&&owners[key](s,value,at)===true;}catch{return false;}}
function speakAnchor(kind){return ['holding'].includes(kind)?RIVAL_WORLD.camp.holding:['loadout'].includes(kind)?NORTH_CUTTING_WORLD.camp.chest:['workers','whyLater'].includes(kind)?TRAIN_BRIEFING_TABLE:RIVAL_WORLD.camp.charges;}
function canSpeak(s,kind){
  if(!active(s)||!usesTrainPreparation(s)||record(s).mission.stage!==2)return false;
  const lines=TRAIN_PREPARATION_LINES[kind],p=s.entities.mara,anchor=speakAnchor(kind);if(!lines||!hearingAllowed(s,kind,s.elapsed)||!near(p,anchor,80))return false;
  if(kind==='holding'&&!held(s))return false;
  return [...new Set(lines.map(item=>item.speakerId))].every(id=>alive(s,id)&&near(s.entities[id],p,80)&&near(s.entities[id],anchor,85));
}
function canCallExchange(s,kind){const lines=TRAIN_PREPARATION_LINES[kind];return active(s)&&record(s).mission.stage===2&&!!lines&&hearingAllowed(s,kind,s.elapsed)&&(kind!=='holding'||held(s))&&lines.every(item=>alive(s,item.speakerId))&&near(s.entities.mara,speakAnchor(kind),80);}
function show(s,ctx){const x=state(s)?.exchange,item=x&&TRAIN_PREPARATION_LINES[x.kind]?.[x.cursor];if(!item||!canSpeak(s,x.kind))return false;ctx.talk(s,`train-prepare-${x.kind}`,s.entities[item.speakerId].name,item.text,[['train-prepare-next','Continue the exchange.'],['train-prepare-pause','Pause and return.']]);return true;}
function startExchange(s,kind,ctx){const p=state(s);if(p.exchange||!canCallExchange(s,kind))return false;p.exchange={id:`train-prepare-exchange-${++p.exchangeSerial}`,kind,startedAt:s.elapsed,cursor:0,awaitingSpeakers:!canSpeak(s,kind)};if(!p.exchange.awaitingSpeakers)return show(s,ctx);ctx.notice(s,'The exchange is requested. Its speakers must reach this place before any part is heard.');return true;}
function offer(s,id,label,target,radius=75){return near(s.entities.mara,target,radius)?{id,label,targetId:target.id||id,x:target.x,y:target.y,z:target.z||0,distance:distance(s.entities.mara,target),priority:-5}:null;}

export function trainPreparationReadiness(s,ctx={},at=s.elapsed){
  const p=state(s),model=preparationMaterialAt(s,at),blockers=[],inspections=p?inspectionEvidence(s,at):null,owners=ctx.preparationProofOwners;
  if(!active(s)||record(s).mission.stage!==2&&!ctx.historical||!p||!finite(at)||at<p.startedAt||at>s.elapsed)return{ready:false,blockers:['Ask Ruth to begin the actual preparation.'],evidence:null};
  for(const kind of mandatory)if(!heardBy(p,kind,at))blockers.push(`Finish the ${kind==='capsWire'?'caps and wire':kind} exchange.`);
  if(!inspectionCoverage(inspections))blockers.push('Inspect each original bundle and the actual tin and wire kit.');
  if(!model||childIds.some(id=>!model.objects[id]||model.objects[id].powder?.spent))blockers.push('Account for all four unspent original bundles.');
  const first=model?.objects[childIds[0]],tin=model?.objects['cap-tin'],crate=model?.objects['charge-crate'];
  if(!first||first.sealed!==false||first.powder?.mode!=='wired'||!first.powder.primerId||!tin?.primers?.some(unit=>unit.id===first.powder.primerId&&unit.state==='attached'&&unit.chargeId===first.id))blockers.push('Prepare only the first bundle with one actual wired primer.');
  if(childIds.slice(1).some(id=>model?.objects[id]?.sealed!==true||model.objects[id].powder?.primerId||model.objects[id].powder?.fuseRef))blockers.push('Keep the second, third and fourth bundles wrapped and unprimed.');
  if(!tin?.openingEventId||tin.primers?.length!==6)blockers.push('Open or recount Ruth’s original separate tin.');
  if(!model||TRAIN_KIT_IDS.some(id=>!model.kit[id])||!Powder.validatePowderWireBalance(model.kit['brass-wire-spool'])||model.kit['brass-wire-spool']?.deployedLength!==0||model.kit['brass-wire-spool']?.onReel!==model.kit['brass-wire-spool']?.issuedLength)blockers.push('Count the issued kit with its unlaid wire still on the reel.');
  const cargoIds=['charge-crate','cap-tin',childIds[0]],saddle=o=>o?.owner==='ruth'&&same(o.location,{type:'saddle',targetId:'plover'});
  if(!crate||!same(crate.chargeIds,childIds.slice(1))||!cargoIds.every(id=>saddle(model?.objects[id]))||!TRAIN_KIT_IDS.every(id=>saddle(model?.kit[id])))blockers.push('Load the same crate, separated first bundle, tin and finite tools on Plover.');
  const handovers=rival(s).rival.continuation.events.filter(e=>e.at>=p.startedAt&&e.at<=at&&e.kind==='guard-handover'),firstWatch=handovers.find(e=>e.operation.options.fromActorId==='bastian'&&e.operation.options.toActorId==='inez'),secondWatch=handovers.find(e=>e.operation.options.fromActorId==='inez'&&e.operation.options.toActorId==='hob'&&firstWatch&&e.seq>firstWatch.seq);
  if(!held(s)||model?.guardId!=='hob'||!firstWatch||!secondWatch)blockers.push('Complete the actual Bastian, Inez and Hob holding handovers.');
  if(!proofAccepted(owners,'stable',s,p.stableDuty,at)||!proofAccepted(owners,'stableComplete',s,p.stableDuty,at))blockers.push('Let Inez actually finish the stable work after Hob takes the watch.');
  if(!proofAccepted(owners,'mask',s,p.maskChoice,at))blockers.push('Choose an actually owned face covering through its lawful equipment work.');
  const mask=model?.gear?.[TRAIN_MASK_ID];if(p.maskChoice?.choice==='bring'&&mask?.owner!=='mara'||p.maskChoice?.choice==='uncovered'&&mask?.location.type==='worn')blockers.push('Make the face-covering choice agree with the actual equipment now.');
  const owned=resolveTrainWeapon(s,'bastian');if(!owned||owned.stock.ammo+owned.stock.reserve<=0)blockers.push('Give Bastian an actual lawful firearm with remaining rounds.');
  let cargo=null;try{if(typeof ctx.preparationCargoEvidence==='function')cargo=ctx.preparationCargoEvidence(s);}catch{}
  if(!proofAccepted(owners,'cargo',s,cargo,at))blockers.push('Finish the native saddle capacity and secured-load check.');
  const events=record(s).train.powder.physicalEvents,pending=events.some(e=>['work-started','preparation-inspection-started'].includes(e.kind)&&e.at<=at&&!events.some(done=>['work-completed','work-cancelled','preparation-inspection-completed'].includes(done.kind)&&done.data?.workId===e.id&&done.at<=at));
  if(pending||!ctx.historical&&p.work)blockers.push('Finish or explicitly interrupt the current physical work.');
  return{ready:blockers.length===0,blockers,evidence:{at,material:preparationMaterialEvidence(s,at),inspections:copy(inspections),holdingEventIds:[firstWatch?.id,secondWatch?.id].filter(Boolean),cargo:copy(cargo),stable:copy(p.stableDuty),mask:copy(p.maskChoice)}};
}

export function getTrainPreparationInteractions(s){
  if(!active(s)||record(s).mission.stage!==2||s.dialog||s.failure)return [];
  if(!usesTrainPreparation(s))return callAllowed(s)?[offer(s,'train:prepare-call','Ask Ruth to begin the actual preparation',s.entities.ruth)].filter(Boolean):[];
  const p=state(s),list=[];if(p.departure)return [];
  if(p.exchange)return[offer(s,'train:prepare-resume','Resume the unfinished preparation exchange',speakAnchor(p.exchange.kind),80)].filter(Boolean);
  for(const kind of ['store','capsWire','holding','stable','loadout','readiness','review','workers','whyLater'])if(canCallExchange(s,kind))list.push(offer(s,`train:prepare-talk:${kind}`,({store:'Hear the four separate charge assignments',capsWire:'Discuss the separate tin, wire and tools',holding:'Confirm the actual holding watch',stable:'Arrange the stable duty after the watch changes',loadout:'Discuss the actual guns and remaining rounds',readiness:'Review readiness before Ruth departs',review:'Review the conserved load',workers:'Keep the workers distinct from company property',whyLater:'Revisit the possibility of a later hearing'})[kind],speakAnchor(kind),80));
  if(!p.work&&completed(p,'store')){
    for(const id of childIds)list.push(offer(s,`train:prepare-inspect:${id}`,`Inspect original bundle ${childIds.indexOf(id)+1}`,RIVAL_WORLD.camp.charges,75));
    const tin=rival(s).objects['cap-tin'],kit=record(s).train.powder.kit;
    if(tin&&tin.openingEventId===undefined&&tin.primers===undefined)list.push(offer(s,'train:prepare-open-tin','Ask Ruth to open her original cap tin',RIVAL_WORLD.camp.charges));
    if(tin?.openingEventId&&Array.isArray(tin.primers))list.push(offer(s,'train:prepare-inspect-tin','Count the actual separate primer units',RIVAL_WORLD.camp.charges));
    if(Object.keys(kit).length===0)list.push(offer(s,'train:prepare-issue-kit','Open Ruth’s actual wiring case with her',TRAIN_TOOL_CASE));
    if(TRAIN_KIT_IDS.every(id=>kit[id]))list.push(offer(s,'train:prepare-inspect-kit','Count the actual wire and separate tools',TRAIN_TOOL_CASE));
    const child=rival(s).objects[childIds[0]];
    if(child?.location.type==='crate'&&inspectedChildren(inspectionEvidence(s)))list.push(offer(s,'train:prepare-take-first','Take only the first original bundle out of the crate',RIVAL_WORLD.camp.charges));
    if(child?.sealed===true&&inspectedChildren(inspectionEvidence(s)))list.push(offer(s,'train:prepare-unseal-first','Ask Ruth to unseal only the assigned first bundle',s.entities.ruth));
    if(child?.sealed===false&&!child.powder?.primerId&&completed(p,'capsWire'))for(const unit of rival(s).objects['cap-tin']?.primers||[])if(unit.state==='in-tin')list.push(offer(s,`train:prepare-prime:${unit.id}`,`Attach ${unit.id} to the first bundle`,s.entities.ruth));
    for(const ref of [original('charge-crate'),original('cap-tin'),original(childIds[0]),...TRAIN_KIT_IDS.map(kitRef)]){let item;try{item=resolveFixedRef(s,ref);}catch{continue;}if(!same(item.location,{type:'saddle',targetId:'plover'}))list.push(offer(s,`train:prepare-load:${ref.objectId}`,`Load ${item.name||item.id} on the actual Plover`,s.entities.plover));}
    const guard=rival(s).captivity.guardId;if(held(s)&&['bastian','inez'].includes(guard))list.push(offer(s,`train:prepare-watch:${guard==='bastian'?'inez':'hob'}`,`Hand the actual holding watch to ${guard==='bastian'?'Inez':'Hob'}`,RIVAL_WORLD.camp.holding,65));
    if(rival(s).captivity.guardId!=='bastian')for(const id of ['mara-revolver','coach-gun','tern-carbine']){const ref=originalWeaponRef(id),w=s.weapons[id];if(w?.owner==='mara'&&s.entities.mara.equippedWeaponId!==id)list.push(offer(s,`train:prepare-lend:${id}`,`Offer Bastian the same ${w.name||id} as a temporary loan`,NORTH_CUTTING_WORLD.camp.chest));else if(activeRivalWeaponLoan(s,id))list.push(offer(s,`train:prepare-return:${id}`,`Take back the same ${w.name||id} with its remaining rounds`,NORTH_CUTTING_WORLD.camp.chest));}
    const mask=s.itemInstances[TRAIN_MASK_ID];
    if(!mask)list.push(offer(s,'train:prepare-mask-issue','Ask Ada to hand over her one oilcloth windwrap',{...TRAIN_MASK_SOURCE,z:0}));
    else{
      const target=mask.location.type==='saddle'?s.entities.copper:s.entities.mara;
      if(mask.location.type==='worn')list.push(offer(s,'train:prepare-mask-remove','Remove the same windwrap from your face',target));
      else list.push(offer(s,'train:prepare-mask-wear','Wear the same owned windwrap',target));
      list.push(offer(s,'train:prepare-mask-bring','Choose to bring the actual owned windwrap',target));
    }
    if(mask?.location.type!=='worn')list.push(offer(s,'train:prepare-mask-uncovered','Choose to leave your face uncovered for now',s.entities.mara));
  }else if(p.work)list.push(offer(s,'train:prepare-cancel-work','Interrupt the current preparation work',s.entities.mara));
  if(completed(p,'readiness'))list.push(offer(s,'train:prepare-decision','Decide whether Ruth should leave with the checked load',s.entities.ruth));
  return list.filter(Boolean);
}
const workArgs={inspectChild:['objectId'],inspectTin:[],inspectKit:[],openTin:[],issueKit:[],takeFirst:[],unsealFirst:[],primeFirst:['primerId'],load:['ref'],watch:['fromActorId','toActorId'],lend:['weaponId'],return:['weaponId'],issueMask:[],wearMask:[],removeMask:[]};
function validWork(w,p,now){return keys(w,['kind','args','requestedAt','workId','requestId'])&&Object.hasOwn(workArgs,w.kind)&&keys(w.args,workArgs[w.kind])&&finite(w.requestedAt)&&w.requestedAt>=p.startedAt&&w.requestedAt<=now&&(w.workId===null?w.requestId===null:typeof w.workId==='string'&&typeof w.requestId==='string')&&(w.kind!=='inspectChild'||childIds.includes(w.args.objectId))&&(w.kind!=='primeFirst'||/^quarry-primer-[1-6]$/.test(w.args.primerId))&&(w.kind!=='load'||[...childIds.slice(0,1),'charge-crate','cap-tin',...TRAIN_KIT_IDS].some(id=>same(w.args.ref,TRAIN_KIT_IDS.includes(id)?kitRef(id):original(id))))&&(w.kind!=='watch'||w.args.fromActorId==='bastian'&&w.args.toActorId==='inez'||w.kind==='watch'&&w.args.fromActorId==='inez'&&w.args.toActorId==='hob')&&(!['lend','return'].includes(w.kind)||originalWeaponRef(w.args.weaponId)!==null);}
function workOperation(w){
  const base=(kind,actorIds,refs,options={},to=null)=>({kind,actorIds,refs,to,options});
  if(w.kind==='openTin')return base('open-tin',['ruth'],[original('cap-tin')]);if(w.kind==='issueKit')return base('issue-kit',['mara','ruth'],[]);
  if(w.kind==='issueMask')return base('issue-mask',['mara','ada'],[]);
  if(['wearMask','removeMask'].includes(w.kind))return base('move-object',['mara'],[kitRef(TRAIN_MASK_ID)],{},{owner:'mara',location:w.kind==='wearMask'?{type:'worn',targetId:'mara',slot:'face'}:{type:'carried',targetId:'mara'}});
  if(w.kind==='takeFirst')return base('move-object',['ruth'],[original(childIds[0])],{},{owner:'ruth',location:{type:'carried',targetId:'ruth'}});
  if(w.kind==='unsealFirst')return base('unseal-charge',['ruth'],[original(childIds[0])],{chargeId:childIds[0]});
  if(w.kind==='primeFirst')return base('attach-primer',['ruth'],[original('cap-tin'),original(childIds[0]),original(w.args.primerId)],{chargeId:childIds[0],primerId:w.args.primerId,mode:'wired'});
  if(w.kind==='load')return base('move-object',['ruth'],[w.args.ref],{},{owner:'ruth',location:{type:'saddle',targetId:'plover'}});
  if(w.kind==='watch')return base('guard-handover',['mara',w.args.fromActorId,w.args.toActorId],[],copy(w.args));
  if(['lend','return'].includes(w.kind))return base(w.kind==='lend'?'lend-weapon':'return-weapon',['mara','bastian'],[originalWeaponRef(w.args.weaponId)],copy(w.args));
  return null;
}
function requestWork(s,w,ctx){
  if(w.kind==='inspectChild'||w.kind==='inspectTin'||w.kind==='inspectKit')return typeof Powder.requestPreparationInspection==='function'?Powder.requestPreparationInspection(s,{topic:w.kind==='inspectChild'?'child-seal':w.kind==='inspectTin'?'primer-tin':'wire-and-tools',ref:w.kind==='inspectChild'?original(w.args.objectId):w.kind==='inspectTin'?original('cap-tin'):kitRef('brass-wire-spool'),actorIds:['mara','ruth']},ctx):null;
  if(w.kind==='openTin')return Powder.requestTinOpening(s,ctx);if(w.kind==='issueKit')return Powder.requestKitOpening(s,ctx);
  if(w.kind==='issueMask')return typeof Powder.requestMaskHandoff==='function'?Powder.requestMaskHandoff(s,ctx):null;
  if(['wearMask','removeMask'].includes(w.kind)){const op=workOperation(w);return Powder.requestPowderTransfer(s,op.refs[0],op.actorIds,op.to,ctx);}
  if(w.kind==='takeFirst')return Powder.requestPowderTransfer(s,original(childIds[0]),['ruth'],{owner:'ruth',location:{type:'carried',targetId:'ruth'}},ctx);
  if(w.kind==='unsealFirst')return Powder.requestChargeUnseal(s,childIds[0],'ruth',ctx);
  if(w.kind==='primeFirst')return Powder.requestPrimerAttachment(s,childIds[0],w.args.primerId,'ruth','wired',ctx);
  if(w.kind==='load')return Powder.requestPowderTransfer(s,w.args.ref,['ruth'],{owner:'ruth',location:{type:'saddle',targetId:'plover'}},ctx);
  if(w.kind==='watch')return Powder.requestPowderCustodyWork(s,{kind:'guard-handover',actorIds:['mara',w.args.fromActorId,w.args.toActorId],refs:[],to:null,options:copy(w.args)},ctx);
  return Powder.requestPowderCustodyWork(s,{kind:w.kind==='lend'?'lend-weapon':'return-weapon',actorIds:['mara','bastian'],refs:[originalWeaponRef(w.args.weaponId)],to:null,options:copy(w.args)},ctx);
}
function settleWork(s){const p=state(s),w=p?.work;if(!w?.workId)return false;const done=record(s).train.powder.physicalEvents.some(e=>['work-completed','work-cancelled','preparation-inspection-completed'].includes(e.kind)&&e.data?.workId===w.workId);if(done)p.work=null;return done;}
function decisionText(status){return status.ready?'The checked load, watch and equipment are ready. Shall I leave on Plover?':`The preparation is still open. ${status.blockers.join(' ')}`;}
function decisionChoices(status){return[...(status.ready?[{id:'train-prepare-ready',label:'Send Ruth ahead with the checked load.'}]:[]),{id:'train-prepare-wait',label:'Keep camp open and wait.'},{id:'train-prepare-review',label:'Review the actual preparation.'}];}
function decision(s,ctx){const status=trainPreparationReadiness(s,ctx);state(s).decision={at:s.elapsed,blockers:copy(status.blockers),evidence:copy(status.evidence)};ctx.talk(s,'train-prepare-decision','Ruth Arlow',decisionText(status),decisionChoices(status).map(c=>[c.id,c.label]));return true;}
export function interactTrainPreparation(s,id,ctx){
  if(!getTrainPreparationInteractions(s).some(a=>a.id===id))return false;
  if(id==='train:prepare-call'){if(record(s).train.preparationVersion!==undefined||record(s).train.preparation!==undefined)return false;const p=createTrainPreparation(s);record(s).train.preparationVersion=1;record(s).train.preparation=p;ctx.notice(s,'Ruth has heard the call. The original supplies and holding watch still need their actual work.');return true;}
  const p=state(s);if(id==='train:prepare-resume'){if(canSpeak(s,p.exchange.kind)){p.exchange.awaitingSpeakers=false;return show(s,ctx);}p.exchange.awaitingSpeakers=true;ctx.notice(s,'The unfinished exchange still needs its actual speakers here.');return true;}if(id.startsWith('train:prepare-talk:'))return startExchange(s,id.slice('train:prepare-talk:'.length),ctx);if(id==='train:prepare-decision')return decision(s,ctx);
  if(['train:prepare-mask-bring','train:prepare-mask-uncovered'].includes(id)){
    let proof;try{proof=typeof ctx.preparationMaskEvidence==='function'?ctx.preparationMaskEvidence(s,{choice:id==='train:prepare-mask-bring'?'bring':'uncovered'}):null;}catch{proof=null;}
    if(!acceptPreparationNativeProof(s,'mask',proof,ctx)){ctx.notice(s,'The choice needs your actual present equipment and a clear owned face-covering state.');return false;}
    ctx.notice(s,id==='train:prepare-mask-bring'?'You chose to bring the same owned windwrap.':'You chose to keep your face uncovered for now.');return true;
  }
  if(id==='train:prepare-cancel-work'){if(p.work?.workId)Powder.cancelPowderWork(s,p.work.workId);p.work=null;ctx.notice(s,'The unfinished work is interrupted. Earlier committed transfers remain where they were completed.');return true;}
  let kind,args={};if(id.startsWith('train:prepare-inspect:')){kind='inspectChild';args={objectId:id.slice('train:prepare-inspect:'.length)};}else if(id.startsWith('train:prepare-prime:')){kind='primeFirst';args={primerId:id.slice('train:prepare-prime:'.length)};}else if(id.startsWith('train:prepare-load:')){kind='load';const objectId=id.slice('train:prepare-load:'.length);args={ref:TRAIN_KIT_IDS.includes(objectId)?kitRef(objectId):original(objectId)};}else if(id.startsWith('train:prepare-watch:')){kind='watch';args={fromActorId:rival(s).captivity.guardId,toActorId:id.slice('train:prepare-watch:'.length)};}else if(id.startsWith('train:prepare-lend:')||id.startsWith('train:prepare-return:')){kind=id.includes(':prepare-lend:')?'lend':'return';args={weaponId:id.split(':').at(-1)};}else kind=({'train:prepare-inspect-tin':'inspectTin','train:prepare-inspect-kit':'inspectKit','train:prepare-open-tin':'openTin','train:prepare-issue-kit':'issueKit','train:prepare-take-first':'takeFirst','train:prepare-unseal-first':'unsealFirst','train:prepare-mask-issue':'issueMask','train:prepare-mask-wear':'wearMask','train:prepare-mask-remove':'removeMask'})[id];
  if(!kind)return false;p.work={kind,args,requestedAt:s.elapsed,workId:null,requestId:null};ctx.notice(s,'The work has been requested. The required people and actual objects must reach their clear working contacts before it can begin.');return true;
}
export function chooseTrainPreparation(s,id,ctx){
  const p=state(s);if(!p||!s.dialog?.choices.some(choice=>choice.id===id))return false;
  if(s.dialog.id==='train-prepare-decision'){
    if(id==='train-prepare-wait'){p.decisions.push({id:'wait',at:s.elapsed,playerPosition:point(s.entities.mara),evidence:null});p.decision=null;s.dialog=null;return true;}
    if(id==='train-prepare-review'){p.decisions.push({id:'review',at:s.elapsed,playerPosition:point(s.entities.mara),evidence:null});p.decision=null;s.dialog=null;return startExchange(s,'review',ctx);}
    if(id!=='train-prepare-ready')return false;const status=trainPreparationReadiness(s,ctx);if(!status.ready||typeof ctx.prepareRuthDeparture!=='function')return false;
    let tx;try{tx=ctx.prepareRuthDeparture(s,copy(status.evidence));}catch{return false;}if(!object(tx)||typeof tx.apply!=='function'||typeof tx.rollback!=='function'||tx.apply.constructor.name==='AsyncFunction'||tx.rollback.constructor.name==='AsyncFunction'||!object(tx.state))return false;
    const old=copy(p.decisions);try{p.decisions.push({id:'ready',at:s.elapsed,playerPosition:point(s.entities.mara),evidence:copy(status.evidence)});p.departure=copy(tx.state);const value=tx.apply();if(value?.then||!proofAccepted(ctx.preparationProofOwners,'departure',s,p.departure,s.elapsed))throw new TypeError('Native departure did not accept its exact ready state');p.decision=null;s.dialog=null;return true;}catch{try{tx.rollback();}finally{p.decisions=old;p.departure=null;}return false;}
  }
  const x=p.exchange;if(!x||s.dialog.id!==`train-prepare-${x.kind}`||!canSpeak(s,x.kind))return false;
  if(id==='train-prepare-pause'){s.dialog=null;return true;}if(id!=='train-prepare-next')return false;
  const item=TRAIN_PREPARATION_LINES[x.kind][x.cursor];p.heard.push({exchangeId:x.id,kind:x.kind,index:x.cursor,...copy(item),at:s.elapsed,actorPosition:point(s.entities[item.speakerId]),playerPosition:point(s.entities.mara),materialEventIds:preparationMaterialAt(s).eventIds});x.cursor++;s.dialog=null;
  if(x.cursor<TRAIN_PREPARATION_LINES[x.kind].length)return show(s,ctx);
  p.completed.push({exchangeId:x.id,kind:x.kind,at:s.elapsed});const readiness=x.kind==='readiness';p.exchange=null;if(readiness)decision(s,ctx);return true;
}
export function stepTrainPreparation(s,dt,ctx){
  const p=state(s);if(!active(s)||!p||s.dialog||s.failure||!finite(dt)||dt<=0||dt>.1||p.lastStepAt>=s.elapsed-1e-7||p.lastStepAt>s.elapsed-dt+1e-7)return false;p.lastStepAt=s.elapsed;
  if(p.departure){if(typeof ctx.stepRuthDeparture==='function')ctx.stepRuthDeparture(s,dt);return true;}
  if(p.exchange?.awaitingSpeakers){if(typeof ctx.preparePreparationExchange==='function')ctx.preparePreparationExchange(s,p.exchange.kind,dt);if(canSpeak(s,p.exchange.kind)){p.exchange.awaitingSpeakers=false;show(s,ctx);}return true;}
  const w=p.work;if(!w)return true;
  if(w.workId){settleWork(s);return true;}
  if(typeof ctx.preparePreparationWork!=='function'||ctx.preparePreparationWork(s,copy(w))!==true)return true;
  const result=requestWork(s,w,ctx);if(result){w.workId=result.workId;w.requestId=result.requestId;}return true;
}
export function finalizeTrainPreparation(s,ctx){
  const p=state(s),owners=ctx?.preparationProofOwners;if(!active(s)||!p)return false;settleWork(s);if(record(s).mission.stage!==2||!p.departure||p.completedAt!==null||typeof owners?.departureCompletedAt!=='function'||!proofAccepted(owners,'departure',s,p.departure,s.elapsed))return false;
  const at=owners.departureCompletedAt(s,p.departure);if(at!==s.elapsed)return false;p.completedAt=at;record(s).mission.stage=3;record(s).mission.objective=TRAIN_STAGES[3];record(s).train.chronicle.stageEvents.push({fromStage:2,toStage:3,at,cause:'preparation-departure'});ctx.checkpoint(s,'train-kiln-prepared','The original load, actual camp duties and Ruth’s departure are complete');return true;
}
/** A native owner supplies its fixed typed evidence only after the actual
 * verb. No missing hook, arbitrary boolean or migration invokes this setter.
 */
export function acceptPreparationNativeProof(s,kind,evidence,ctx){
  const p=state(s),field={stable:'stableDuty',mask:'maskChoice'}[kind];if(!active(s)||record(s).mission.stage!==2||!p||!field||p.departure||!proofAccepted(ctx?.preparationProofOwners,kind,s,evidence,s.elapsed))return false;
  p[field]=copy(evidence);return true;
}
export function preparationOperationAllowed(s,op,at=s.elapsed){
  const p=state(s);if(!p||!finite(at)||at<p.startedAt||!heardBy(p,'store',at))return false;
  if(op.kind==='unseal-charge')return op.options?.chargeId===childIds[0]&&inspectedChildren(inspectionEvidence(s,at));
  if(op.kind==='attach-primer')return op.options?.chargeId===childIds[0]&&op.options.mode==='wired'&&heardBy(p,'capsWire',at);
  if(['attach-fuse','light-fuse','remove-primer','wire-pay-out','cut-clamp','damage-primer','blast-charge'].includes(op.kind))return false;
  return ['issue-kit','open-tin','move-object','guard-handover','establish-guard','lend-weapon','return-weapon','issue-mask'].includes(op.kind);
}

export function validateTrainPreparation(s,proofOwners={}){
  try{
    const r=record(s),t=r.train,p=state(s),now=s.elapsed;
    if(t.preparationVersion===undefined)return p===undefined&&r.mission.stage<=2&&!s.dialog?.id?.startsWith('train-prepare-');
    if(t.preparationVersion!==1||!keys(p,['schema','startedAt','calledAt','callPosition','calledRuthPosition','lastStepAt',...(Object.hasOwn(p,'campSetup')?['campSetup']:[]),'exchangeSerial','heard','completed','exchange','work','decision','decisions','stableDuty','maskChoice','departure','completedAt'])||p.schema!==1||r.mission.stage<2||!finite(p.startedAt)||p.startedAt<t.chronicle.acceptedAt||p.startedAt>now||p.calledAt!==p.startedAt||!validPoint(p.callPosition)||!validPoint(p.calledRuthPosition)||!near(p.callPosition,p.calledRuthPosition,75)||!finite(p.lastStepAt)||p.lastStepAt<p.startedAt||p.lastStepAt>now||!Number.isSafeInteger(p.exchangeSerial)||p.exchangeSerial<0||!Array.isArray(p.heard)||!Array.isArray(p.completed)||!Array.isArray(p.decisions))return false;
    if(p.campSetup!=null){const empty=keys(p.campSetup,['schema','sites'])&&p.campSetup.schema===1&&keys(p.campSetup.sites,[]);if(typeof proofOwners.layout==='function'){if(!proofAccepted(proofOwners,'layout',s,p.campSetup,now))return false;}else if(!empty)return false;}
    const groups=new Map(),finished=[];let at=p.startedAt;
    for(const e of p.heard){const lines=TRAIN_PREPARATION_LINES[e.kind],item=lines?.[e.index];if(!keys(e,['exchangeId','kind','index','lineId','speakerId','text','at','actorPosition','playerPosition','materialEventIds'])||!item||!same({lineId:e.lineId,speakerId:e.speakerId,text:e.text},item)||!finite(e.at)||e.at<at||e.at>now||!validPoint(e.actorPosition)||!validPoint(e.playerPosition)||!near(e.playerPosition,speakAnchor(e.kind),80)||!near(e.actorPosition,e.playerPosition,80)||!near(e.actorPosition,speakAnchor(e.kind),85)||e.speakerId==='mara'&&!same(e.actorPosition,e.playerPosition)||!same(e.materialEventIds,preparationMaterialAt(s,e.at).eventIds)||!hearingAllowed(s,e.kind,e.at,finished))return false;
      if(!groups.has(e.exchangeId)){const prior=[...groups.values()].at(-1);if(prior&&prior.length!==TRAIN_PREPARATION_LINES[prior[0].kind].length)return false;groups.set(e.exchangeId,[]);}const group=groups.get(e.exchangeId);if(e.exchangeId!==`train-prepare-exchange-${groups.size}`||e.index!==group.length||group.length&&group[0].kind!==e.kind)return false;group.push(e);at=e.at;if(group.length===lines.length)finished.push({exchangeId:e.exchangeId,kind:e.kind,at:e.at});
    }
    if(!same(p.completed,finished))return false;
    // A material-only component receipt is not a native camp-work proof. New
    // work must additionally join its real deployed site through the fixed
    // owning validator supplied by Train main. Older phase-two work which
    // began before this actual declaration retains its original acceptance.
    const inPreparationEpoch=at=>at>=p.startedAt&&(p.completedAt===null||at<p.completedAt);
    for(const event of rival(s).rival.continuation.events)if(inPreparationEpoch(event.workReceipt.startedAt)&&(!preparationOperationAllowed(s,event.operation,event.workReceipt.startedAt)||!proofAccepted(proofOwners,'work',s,event.operation,event.workReceipt.startedAt)))return false;
    for(const request of Object.values(rival(s).rival.continuation.requests))if(inPreparationEpoch(request.startedAt)&&(!preparationOperationAllowed(s,request.operation,request.startedAt)||!proofAccepted(proofOwners,'work',s,request.operation,request.startedAt)))return false;
    for(const event of t.powder.physicalEvents)if(event.kind==='preparation-inspection-started'&&inPreparationEpoch(event.at)&&!proofAccepted(proofOwners,'work',s,event.data.operation,event.at))return false;
    if(p.exchange!==null){const x=p.exchange,group=groups.get(x.id)||[],lines=TRAIN_PREPARATION_LINES[x.kind];if(!keys(x,['id','kind','startedAt','cursor',...(Object.hasOwn(x,'awaitingSpeakers')?['awaitingSpeakers']:[])])||Object.hasOwn(x,'awaitingSpeakers')&&typeof x.awaitingSpeakers!=='boolean'||x.awaitingSpeakers&&(x.cursor!==0&&group.length===0||s.dialog?.id===`train-prepare-${x.kind}`)||!lines||!finite(x.startedAt)||x.startedAt<p.startedAt||x.startedAt>now||x.id!==`train-prepare-exchange-${p.exchangeSerial}`||x.cursor!==group.length||x.cursor>=lines.length||groups.size+(group.length?0:1)!==p.exchangeSerial||group.some(e=>e.at<x.startedAt))return false;}else if(groups.size!==p.exchangeSerial||[...groups.values()].some(group=>group.length!==TRAIN_PREPARATION_LINES[group[0].kind].length))return false;
    if(p.work!==null){
      const w=p.work;if(!validWork(w,p,now))return false;
      if(w.workId!==null){
        const start=t.powder.physicalEvents.find(e=>e.id===w.workId);if(!start||start.at<w.requestedAt)return false;
        if(w.requestId.startsWith('inspection:')){
          const topic={inspectChild:'child-seal',inspectTin:'primer-tin',inspectKit:'wire-and-tools'}[w.kind],ref=w.kind==='inspectChild'?original(w.args.objectId):w.kind==='inspectTin'?original('cap-tin'):kitRef('brass-wire-spool');
          if(!topic||start.kind!=='preparation-inspection-started'||w.requestId!==`inspection:${start.id}`||start.data.operation.options.topic!==topic||!same(start.data.operation.options.ref,ref)||!same(start.data.operation.actorIds,['mara','ruth']))return false;
        }else{
          const expected=workOperation(w),request=inspectCustodyRequest(s,w.requestId)||rival(s).rival.continuation.events.find(e=>e.requestId===w.requestId),cancelled=t.powder.physicalEvents.some(e=>e.kind==='work-cancelled'&&e.data?.workId===w.workId);
          if(!expected||start.kind!=='work-started'||start.data.operationKind!==expected.kind||start.data.requestId!==w.requestId||!request&&!cancelled)return false;
          if(request){const {cause,...op}=request.operation;if(!same(op,expected)||cause.eventId!==w.workId)return false;}
        }
      }
    }
    for(const [field,key]of [['stableDuty','stable'],['maskChoice','mask']])if(p[field]!==null&&!proofAccepted(proofOwners,key,s,p[field],now))return false;
    let ready=null,last=p.startedAt;for(const d of p.decisions){
      if(!keys(d,['id','at','playerPosition','evidence'])||!['wait','review','ready'].includes(d.id)||!finite(d.at)||d.at<last||d.at>now||!validPoint(d.playerPosition)||!finished.some(e=>e.kind==='readiness'&&e.at<=d.at))return false;
      if(d.id!=='ready'){if(d.evidence!==null)return false;}
      else{
        if(ready!==null||!keys(d.evidence,['at','material','inspections','holdingEventIds','cargo','stable','mask']))return false;
        const status=trainPreparationReadiness(s,{historical:true,preparationProofOwners:proofOwners,preparationCargoEvidence:()=>d.evidence.cargo},d.at);
        if(!status.ready||!same(status.evidence,d.evidence))return false;ready=d.at;
      }
      last=d.at;
    }
    if(p.departure===null){if(ready!==null||p.completedAt!==null||r.mission.stage!==2)return false;}else{if(ready===null||!proofAccepted(proofOwners,'departure',s,p.departure,now))return false;if(p.completedAt!==null&&(typeof proofOwners.departureCompletedAt!=='function'||proofOwners.departureCompletedAt(s,p.departure)!==p.completedAt||p.completedAt<ready||p.completedAt>now||r.mission.stage!==3)||p.completedAt===null&&r.mission.stage!==2)return false;}
    if(p.decision!==null){if(!keys(p.decision,['at','blockers','evidence'])||p.decision.at!==now||!Array.isArray(p.decision.blockers)||!p.decision.blockers.every(text=>typeof text==='string')||s.dialog?.id!=='train-prepare-decision')return false;const status=trainPreparationReadiness(s,{preparationProofOwners:proofOwners,preparationCargoEvidence:()=>p.decision.evidence?.cargo??null});if(!same(p.decision.blockers,status.blockers)||!same(p.decision.evidence,status.evidence)||!completed(p,'readiness')||p.exchange!==null||s.dialog.speaker!=='Ruth Arlow'||s.dialog.text!==decisionText(status)||!same(s.dialog.choices,decisionChoices(status)))return false;}
    if(s.dialog?.id?.startsWith('train-prepare-')){if(s.dialog.id==='train-prepare-decision')return p.decision!==null;const x=p.exchange,item=x&&TRAIN_PREPARATION_LINES[x.kind][x.cursor];return !!item&&p.decision===null&&canSpeak(s,x.kind)&&s.dialog.id===`train-prepare-${x.kind}`&&s.dialog.speaker===s.entities[item.speakerId].name&&s.dialog.text===item.text&&same(s.dialog.choices,[{id:'train-prepare-next',label:'Continue the exchange.'},{id:'train-prepare-pause',label:'Pause and return.'}]);}
    return true;
  }catch{return false;}
}
