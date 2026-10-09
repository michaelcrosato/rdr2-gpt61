/** Strict first-scene runtime declaration. Bare earlier v5 train scaffolds
 * retain their separate exact empty format; they gain no inferred arrivals,
 * heard lines, materials, accepted plan or physical work.
 */
import {TRAIN_ID,TRAIN_SOURCE_REQUIREMENT,TRAIN_NEW_CAST,TRAIN_MOVING_CREW,TRAIN_LINE_GUARDS} from '../content/campaign/brass-cutting.js';
import {SNOWBOUND_WORLD} from '../content/campaign/snowbound.js';
import {createTrainPowderRecord,validatePowderWorkHistory} from './train-powder.js';
import {createTrainPrelude,TRAIN_PRELUDE_ENTRY,TRAIN_WATCH_BOTTLE_REST,trainPreludeLineVariants,trainClinicComplete} from './train-prelude.js';
import {createTrainCombat} from './train-combat.js';
import {createTrainBlastState} from './train-blast.js';
import {custodyValidationLinks} from './rival-continuation.js';
import {validateTrainBriefing} from './train-briefing.js';
import {usesTrainPreparation,validateTrainPreparation} from './train-preparation.js';
import {TRAIN_BRIEFING_PAPER_CONTACTS} from '../content/campaign/train-camp.js';
const RESCUE='snowbound-a-voice-under-ice',HUNT='snowbound-a-quiet-table',RIVAL='snowbound-the-names-they-took';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=structuredClone;
const point=p=>keys(p,['x','y','z'])&&['x','y','z'].every(k=>finite(p[k]))&&p.x>=0&&p.x<=SNOWBOUND_WORLD.width&&p.y>=0&&p.y<=SNOWBOUND_WORLD.height&&p.z>=0&&p.z<=160;
const near=(a,b,r)=>point(a)&&point(b)&&Math.abs(a.z-b.z)<8&&Math.hypot(a.x-b.x,a.y-b.y)<=r;
const position=a=>({x:a.x,y:a.y,z:a.z||0});
const begun=(at,start,now)=>finite(at)&&at>=start&&at<=now;
const kinds=['bedside','silas','family','nell'];

export function createTrainRuntime(s){
  if(!finite(s?.elapsed)||s.elapsed<0)throw new TypeError('An actual campaign clock is required');
  return{schema:1,runtimeVersion:1,powder:createTrainPowderRecord(),consist:null,prelude:createTrainPrelude(),combat:createTrainCombat(),blasts:createTrainBlastState(),chronicle:{schema:1,enteredAt:s.elapsed,acceptedAt:null,stageEvents:[],clinicalActions:[]}};
}
export function createTrainRuntimeSections(s){return{
  flags:{},timers:{elapsed:0},performance:{shots:0,hits:0,headshots:0,kills:0,healingUses:0,noHealingItems:true,eligible:true},choices:{operation:null},transactions:{},train:createTrainRuntime(s),
};}
function regionOf(s,a,seen=new Set()){if(!a||seen.has(a.id))return null;seen.add(a.id);return !a.attachment?a.regionId:a.attachment.type==='rest'?a.attachment.regionId:regionOf(s,s.entities[a.attachment.targetId],seen);}

export function validateTrainPreludeState(s){
  try{
    const t=s.campaign.missions[TRAIN_ID].train,p=t.prelude,now=s.elapsed,start=t.chronicle.enteredAt;
    if(!keys(p,Object.keys(createTrainPrelude()))||p.schema!==1||p.startedAt!==start||!begun(p.lastStepAt,start,now)||!keys(p.arrivals,['abel','nell'])||!Array.isArray(p.knownNames)||!Array.isArray(p.completed)||!Array.isArray(p.acknowledged)||new Set(p.completed).size!==p.completed.length||p.completed.some(id=>!kinds.includes(id)))return false;
    for(const id of ['abel','nell']){
      const a=p.arrivals[id];if(!keys(a,['at','from','arrivedAt'])||a.at!==start||!same(a.from,TRAIN_PRELUDE_ENTRY[id])||a.arrivedAt!==null&&!begun(a.arrivedAt,start,now))return false;
    }
    for(const id of ['abel','nell','rivet'])if(!s.entities[id]||s.entities[id].hp<=0||regionOf(s,s.entities[id])!=='snowbound')return false;
    if([...TRAIN_NEW_CAST,...TRAIN_MOVING_CREW,...TRAIN_LINE_GUARDS].some(actor=>!['abel','nell','rivet'].includes(actor.id)&&s.entities[actor.id]))return false;
    if(s.entities.nell.mounted!==true||s.entities.nell.mountId!=='rivet'||s.entities.rivet.ownerId!=='nell'||s.entities.rivet.owned!==true)return false;
    const initial=p.patientAtStart,patient=s.entities.silas;
    if(!keys(initial,['at','hp','injured','scars','healingHours','attachment','dressingTransactionIds','dressingCooldown'])||initial.at!==start||!finite(initial.hp)||initial.hp<=0||initial.hp>100||typeof initial.injured!=='boolean'||typeof initial.scars!=='boolean'||!finite(initial.healingHours)||initial.healingHours<0||initial.healingHours>36||!finite(initial.dressingCooldown)||initial.dressingCooldown<0||initial.dressingCooldown>480||!same(initial.attachment,patient.attachment??null)||!!patient.scars!==initial.scars||!validateClinicalHistory(s,initial,t.chronicle))return false;
    const heard=new Map(kinds.map(kind=>[kind,[]])),completed=[],known=[];let at=start,lastKind=null;
    for(const e of p.acknowledged){
      if(!keys(e,['kind','index','speakerId','text','at','actorPosition','playerPosition'])||!kinds.includes(e.kind)||!begun(e.at,at,now)||!point(e.actorPosition)||!point(e.playerPosition))return false;
      const seen=heard.get(e.kind),variants=trainPreludeLineVariants(e.kind);
      if(e.index!==seen.length||completed.includes(e.kind)||lastKind!==null&&lastKind!==e.kind&&!completed.includes(lastKind)||!variants.some(lines=>lines[e.index]?.[0]===e.speakerId&&lines[e.index]?.[1]===e.text&&seen.every(old=>lines[old.index][0]===old.speakerId&&lines[old.index][1]===old.text)))return false;
      const anchor=e.kind==='nell'?(seen[0]?.actorPosition||e.actorPosition):position(patient);
      if(!near(e.playerPosition,anchor,85)||(e.speakerId==='mara'?!same(e.actorPosition,e.playerPosition):!near(e.actorPosition,e.playerPosition,75)))return false;
      if(['abel','nell'].includes(e.speakerId)&&(!begun(p.arrivals[e.speakerId].arrivedAt,start,e.at)))return false;
      if(['abel','nell'].includes(e.speakerId)&&!known.includes(e.speakerId))known.push(e.speakerId);
      seen.push(e);if(seen.length===variants[0].length)completed.push(e.kind);at=e.at;lastKind=e.kind;
    }
    if(!same(p.completed,completed)||!same(p.knownNames,known))return false;
    for(const id of ['abel','nell'])if(known.includes(id)?!same(s.companions[id],{trust:0,requests:0}):Object.hasOwn(s.companions,id))return false;
    const unfinished=kinds.filter(kind=>heard.get(kind).length&&!completed.includes(kind));
    if(p.exchange===null){if(unfinished.length)return false;}
    else{
      const x=p.exchange,seen=heard.get(x.kind),variants=trainPreludeLineVariants(x.kind);
      if(!keys(x,['kind','startedAt','cursor','lines'])||!kinds.includes(x.kind)||completed.includes(x.kind)||!begun(x.startedAt,start,now)||seen?.some(e=>e.at<x.startedAt)||x.cursor!==seen?.length||!variants.some(lines=>same(lines,x.lines))||seen.some(e=>x.lines[e.index][0]!==e.speakerId||x.lines[e.index][1]!==e.text)||x.cursor>=x.lines.length||unfinished.some(kind=>kind!==x.kind))return false;
      if(s.dialog?.id?.startsWith('train-prelude-')){
        const [id,text]=x.lines[x.cursor],who=['abel','nell'].includes(id)&&!known.includes(id)?id==='abel'?'A visitor at the shelter':'A rider from the south road':s.entities[id]?.name||'Mara Vale';
        if(s.dialog.id!==`train-prelude-${x.kind}`||s.dialog.speaker!==who||s.dialog.text!==text||!same(s.dialog.choices,[{id:'train-speech-next',label:'Continue the exchange.'},{id:'train-speech-pause',label:'Pause and return.'}]))return false;
      }
    }
    if(s.dialog?.id?.startsWith('train-prelude-')&&p.exchange===null)return false;
    const bottle=p.bottle,work=p.bottleWork;
    if(!keys(bottle,['id','kind','owner','location','closed'])||bottle.id!=='abel-watch-bottle'||bottle.kind!=='watch-bottle'||bottle.owner!=='abel'||bottle.closed!==true)return false;
    if(!completed.includes('bedside'))return work===null&&same(bottle.location,{type:'carried',targetId:'abel',hand:'R'})&&s.entities.abel.toolHeld===bottle.id&&s.entities.abel.toolHand==='R';
    if(!object(work)||work.startedAt!==heard.get('bedside').at(-1).at||!finite(work.acceptedSeconds)||work.acceptedSeconds<0||work.acceptedSeconds>1.2+1e-7||work.finishedAt!==null&&!begun(work.finishedAt,work.startedAt+1.1-1e-7,now))return false;
    // The owner records the continuous native contact intervals below. Missing
    // contact receipts never turn a timer or a floor location into earned work.
    if(!validateBottleWork(work,bottle,p,s))return false;
    return true;
  }catch{return false;}
}
function validateBottleWork(work,bottle,p,s){
  if(!keys(work,['startedAt','acceptedSeconds','finishedAt','intervals'])||!Array.isArray(work.intervals))return false;
  let at=null,seconds=0;for(const interval of work.intervals){
    if(!keys(interval,['start','finish','actorPosition','handPoint','target','objectId','reachable','sweptClear','handUsable'])||!begun(interval.start,work.startedAt,s.elapsed)||!begun(interval.finish,interval.start,s.elapsed)||interval.finish<=interval.start||interval.finish-interval.start>.1+1e-7||at!==null&&Math.abs(interval.start-at)>1e-7||interval.objectId!==bottle.id||interval.reachable!==true||interval.sweptClear!==true||interval.handUsable!==true||!point(interval.actorPosition)||!near(interval.actorPosition,TRAIN_WATCH_BOTTLE_REST,38)||!same(interval.target,TRAIN_WATCH_BOTTLE_REST)||!point(interval.handPoint)||Math.hypot(...['x','y','z'].map(k=>interval.handPoint[k]-interval.target[k]))>1e-5)return false;
    seconds+=interval.finish-interval.start;at=interval.finish;
  }
  if(Math.abs(seconds-work.acceptedSeconds)>1e-7||at!==null&&at>p.lastStepAt+1e-7)return false;
  const abel=s.entities.abel;
  if(work.finishedAt===null)return work.acceptedSeconds<1.1+1e-7&&same(bottle.location,{type:'carried',targetId:'abel',hand:'R'})&&abel.toolHeld===bottle.id&&abel.toolHand==='R';
  return work.acceptedSeconds>=1.1-1e-7&&at===work.finishedAt&&same(bottle.location,{type:'ground',point:TRAIN_WATCH_BOTTLE_REST,regionId:'snowbound'})&&!Object.hasOwn(abel,'toolHeld')&&!Object.hasOwn(abel,'toolHand');
}
function validateClinicalHistory(s,initial,chronicle){
  const actions=chronicle.clinicalActions,transactions=s.campaign.missions[RESCUE].transactions,ids=initial.dressingTransactionIds;
  const validId=id=>typeof id==='string'&&new RegExp(`^${RESCUE}:care:dressing-[1-6]$`).test(id);
  if(!Array.isArray(actions)||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!validId(id)))return false;
  const seen=new Set(ids);let hp=initial.hp,hours=initial.healingHours,at=initial.at,injured=initial.injured,cooldown=initial.dressingCooldown;
  const passive=until=>{const delta=until-at;if(!finite(delta)||delta<0)return false;const accepted=Math.min(delta,hours*80);hp=Math.min(100,hp+accepted/160);hours=Math.max(0,hours-delta/80);cooldown=Math.max(0,cooldown-delta);if(hours===0&&delta>0)injured=false;at=until;return true;};
  for(const e of actions){
    if(!keys(e,['transactionId','at','actorId','patientId','beforeHP','beforeHours','afterHP','afterHours','resource','actorPosition','patientPosition'])||!validId(e.transactionId)||seen.has(e.transactionId)||e.actorId!=='mara'||e.patientId!=='silas'||!begun(e.at,at,s.elapsed)||!passive(e.at)||cooldown>1e-6||!near(e.actorPosition,e.patientPosition,65)||!near(e.patientPosition,position(s.entities.silas),1)||!['beforeHP','beforeHours','afterHP','afterHours'].every(k=>finite(e[k]))||Math.abs(e.beforeHP-hp)>1e-6||Math.abs(e.beforeHours-hours)>1e-6||hours<=0)return false;
    const next=Array.from({length:6},(_,i)=>`${RESCUE}:care:dressing-${i+1}`).find(id=>!seen.has(id));if(e.transactionId!==next)return false;
    const resource=e.resource;if(!keys(resource,['store','item','before','after'])||!(resource.store==='inventory'&&resource.item==='bandages'||resource.store==='camp'&&resource.item==='medicine')||!Number.isFinite(resource.before)||resource.before<1||resource.after!==resource.before-1)return false;
    hp=Math.min(100,hp+8);hours=Math.max(0,hours-2);cooldown=480;if(hours===0)injured=false;
    if(Math.abs(e.afterHP-hp)>1e-6||Math.abs(e.afterHours-hours)>1e-6||!same(transactions[e.transactionId],{amount:1,completed:true}))return false;seen.add(e.transactionId);
  }
  const actual=Object.keys(transactions).filter(validId);if(actual.length!==seen.size||actual.some(id=>!seen.has(id))||[...seen].some(id=>!same(transactions[id],{amount:1,completed:true}))||!passive(s.elapsed))return false;
  return Math.abs(s.entities.silas.hp-hp)<=1e-6&&Math.abs(s.campaign.missions[RESCUE].rescue.silas.healingHours-hours)<=1e-6&&Math.abs(s.campaign.missions[RESCUE].timers.helper-cooldown)<=1e-6&&!!s.entities.silas.injured===injured;
}
export function validateTrainRuntime(s,{preparation:preparationProofOwners={}}={}){
  try{
    const r=s.campaign?.missions?.[TRAIN_ID],t=r?.train,m=r?.mission;
    if(s.version!==5||s.campaign.activeMissionId!==TRAIN_ID||s.region!=='snowbound'||r.status!=='active'||r.sourceRequirementId!==TRAIN_SOURCE_REQUIREMENT||![RESCUE,HUNT,RIVAL].every(id=>s.campaign.missions[id]?.mission.completed)||!m||m.id!==TRAIN_ID||m.name!=='What the Line Carries'||m.stageCount!==20||![0,1,2,3].includes(m.stage)||m.completed!==false||m.rewardPaid!==false||typeof m.objective!=='string'||!m.objective.length||m.objective.length>2000)return false;
    const briefing=t.briefingVersion!==undefined||t.briefing!==undefined;
    const preparation=t.preparationVersion!==undefined||t.preparation!==undefined;
    if(!keys(t,['schema','runtimeVersion','powder','consist','prelude','combat','blasts','chronicle',...(briefing?['briefingVersion','briefing']:[]),...(preparation?['preparationVersion','preparation']:[])])||t.schema!==1||t.runtimeVersion!==1||t.consist!==null||!keys(t.chronicle,['schema','enteredAt','acceptedAt','stageEvents','clinicalActions'])||t.chronicle.schema!==1||!begun(t.chronicle.enteredAt,0,s.elapsed)||!Array.isArray(t.chronicle.stageEvents)||m.stage<2&&t.chronicle.acceptedAt!==null||m.stage>=2&&!begun(t.chronicle.acceptedAt,t.chronicle.enteredAt,s.elapsed)||m.stage===0&&briefing||m.stage<2&&preparation)return false;
    if(!keys(r.flags,[])||!keys(r.timers,['elapsed'])||!finite(r.timers.elapsed)||r.timers.elapsed<0||r.timers.elapsed>s.elapsed-t.chronicle.enteredAt+1e-6||!keys(r.choices,['operation'])||r.choices.operation!==(m.stage>=2?'accepted':null)||!keys(r.transactions,[]))return false;
    const perf=r.performance;if(!keys(perf,['shots','hits','headshots','kills','healingUses','noHealingItems','eligible'])||['shots','hits','headshots','kills'].some(key=>perf[key]!==0)||!Number.isSafeInteger(perf.healingUses)||perf.healingUses<0||perf.noHealingItems!==(perf.healingUses===0)||typeof perf.eligible!=='boolean')return false;
    if(!same(t.combat,createTrainCombat())||!same(t.blasts,createTrainBlastState())||!validatePowderWorkHistory(t.powder,s.elapsed,custodyValidationLinks(s))||!validateEarlyCustody(s,briefing)||!validateTrainBriefing(s)||!validateTrainPreparation(s,preparationProofOwners))return false;
    if(!validateTrainPreludeState(s)||s.dialog?.id?.startsWith('train-')&&!s.dialog.id.startsWith('train-prelude-')&&!s.dialog.id.startsWith('train-briefing-')&&!s.dialog.id.startsWith('train-prepare-'))return false;
    if(m.stage===0)return t.chronicle.stageEvents.length===0;
    const e=t.chronicle.stageEvents[0];if(!keys(e,['fromStage','toStage','at','cause'])||e.fromStage!==0||e.toStage!==1||e.cause!=='clinic-complete'||!begun(e.at,t.chronicle.enteredAt,s.elapsed)||!trainClinicComplete(s)||e.at<t.prelude.bottleWork.finishedAt||t.prelude.acknowledged.filter(e=>['bedside','silas','family'].includes(e.kind)).some(line=>line.at>e.at))return false;
    if(m.stage===1)return t.chronicle.stageEvents.length===1;
    const accepted=t.chronicle.stageEvents[1];if(!briefing||!keys(accepted,['fromStage','toStage','at','cause'])||accepted.fromStage!==1||accepted.toStage!==2||accepted.cause!=='briefing-accepted'||accepted.at!==t.chronicle.acceptedAt||accepted.at!==t.briefing.acceptedAt||accepted.at<e.at)return false;
    if(m.stage===2)return t.chronicle.stageEvents.length===2;
    const prepared=t.chronicle.stageEvents[2];return usesTrainPreparation(s)&&t.chronicle.stageEvents.length===3&&keys(prepared,['fromStage','toStage','at','cause'])&&prepared.fromStage===2&&prepared.toStage===3&&prepared.cause==='preparation-departure'&&prepared.at===t.preparation.completedAt&&prepared.at>=accepted.at;
  }catch{return false;}
}
function validateEarlyCustody(s,briefing){
  const r=s.campaign.missions[TRAIN_ID],p=r.train.powder,c=s.campaign.missions[RIVAL].rival.continuation;
  if(!briefing)return p.physicalEvents.length===0&&p.custodyEventRefs.length===0&&Object.keys(p.kit).length===0&&p.pending.length===0;
  const beforeAccept=(op,at)=>{
    if(at<r.train.briefing.startedAt)return false;
    if(op.kind==='return-papers')return same(op.refs,[{sourceMissionId:RIVAL,objectId:'route-diagram'},{sourceMissionId:RIVAL,objectId:'seizure-list'}])&&same(op.actorIds,['mara','tomas']);
    if(op.kind==='establish-guard')return c.baseline?.guardPresent===false&&same(op.actorIds,['mara','bastian'])&&op.options.toActorId==='bastian';
    if(op.kind!=='move-object'||r.train.briefing.setup.finishedAt===null||at<r.train.briefing.setup.finishedAt||op.refs.length!==1||op.refs[0].sourceMissionId!==RIVAL||!Object.hasOwn(TRAIN_BRIEFING_PAPER_CONTACTS,op.refs[0].objectId)||!same(op.actorIds,['tomas']))return false;
    return same(op.to,{owner:'tomas',location:{type:'station',targetId:TRAIN_BRIEFING_PAPER_CONTACTS[op.refs[0].objectId].id,regionId:'snowbound'}});
  };
  const allowed=(op,at)=>{
    if(r.mission.stage<2||at<r.train.chronicle.acceptedAt)return beforeAccept(op,at);
    if(!['issue-kit','open-tin','move-object','unseal-charge','attach-primer','return-papers','establish-guard','guard-handover','lend-weapon','return-weapon','issue-mask'].includes(op.kind))return false;
    if(['unseal-charge','attach-primer'].includes(op.kind)&&(op.options.chargeId!=='quarry-sealed-charge-1'||op.kind==='attach-primer'&&op.options.mode!=='wired'))return false;
    return op.to===null||['carried','saddle','crate','worn'].includes(op.to.location.type)||op.to.location.type==='station'&&op.to.location.regionId==='snowbound';
  };
  if(c.events.some(e=>!allowed(e.operation,e.workReceipt.startedAt))||Object.values(c.requests).some(request=>!allowed(request.operation,request.startedAt)))return false;
  const actualPreparation=usesTrainPreparation(s)&&r.mission.stage>=2;
  return p.pending.every(work=>!work.requestId.startsWith('physical:')&&(!work.requestId.startsWith('inspection:')||actualPreparation&&work.startedAt>=r.train.preparation.startedAt))&&p.physicalEvents.every(event=>!event.kind.startsWith('circuit-')&&!['wire-motion','terminal-released','charge-blast'].includes(event.kind)&&(!event.kind.startsWith('preparation-inspection-')||actualPreparation&&event.at>=r.train.preparation.startedAt));
}
