/** Scene two. A declaration follows an actual call, never a restore. Original
 * papers and the current keeper remain in the owning custody registry. */
import {TRAIN_ID,TRAIN_STAGES} from '../content/campaign/brass-cutting.js';
import {TRAIN_DIALOGUE_DRAFT} from '../content/campaign/brass-dialogue.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_BRIEFING_TABLE as TABLE,TRAIN_BRIEFING_TABLE_SOLID as SOLID,TRAIN_BRIEFING_APPROACHES as APPROACHES,TRAIN_BRIEFING_SETUP_APPROACHES as SETUP,TRAIN_BRIEFING_PAPER_CONTACTS as CONTACTS,TRAIN_BRIEFING_LAYOUT_APPROACHES as WORK} from '../content/campaign/train-camp.js';
import {followActor} from './campaign-navigation.js';
import * as Powder from './train-powder.js';
import {resolveFixedRef,inspectCustodyRequest} from './rival-continuation.js';
const copy=structuredClone,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),point=a=>({x:a.x,y:a.y,z:a.z||0});
const finitePoint=p=>keys(p,['x','y','z'])&&['x','y','z'].every(k=>finite(p[k]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),near=(a,b,r)=>a&&b&&Math.abs((a.z||0)-(b.z||0))<8&&distance(a,b)<=r;
const record=s=>s.campaign?.missions?.[TRAIN_ID],state=s=>record(s)?.train?.briefing,rival=s=>s.campaign.missions[RIVAL_ID];
const original=id=>({sourceMissionId:RIVAL_ID,objectId:id}),paperIds=['route-diagram','seizure-list'];
const mandatory=['invitation','employer','cash','readiness'];
const draft=id=>TRAIN_DIALOGUE_DRAFT.find(item=>item.id===id).speech.map(line=>({lineId:line.id,speakerId:line.speakerId,text:line.text}));
const line=(lineId,speakerId,text)=>({lineId,speakerId,text});
export const TRAIN_BRIEFING_LINES=Object.freeze({
  invitation:[...draft('train-invitation'),line('brief-originals','della','Two originals on this table. The route tells us where the coach can go; the seizure list tells us which houses Calder has counted twice.'),line('brief-creek-spur','tomas','This creek spur was surveyed for wagons. The full engine stays on the main line. Ruth’s signal should make them brake where we can reach the coach; the drawing does not promise that they will.'),line('brief-no-sale','tomas','Recovering the deeds and selling a company certificate are different work. We have not done either by agreeing to speak.')],
  employer:[line('brief-octavia','della','Octavia Morrow. Freight, peat fuel, bonded storage, and timber concessions. Her companies charge at each door the same goods must pass.'),...draft('employer-identity'),line('brief-no-owner-aboard','tomas','Her account coach is travelling without her. Taking her portrait for a person would be an expensive mistake.'),line('brief-workers-employed','della','The people aboard work for those companies. Their wages do not make every worker the author of this seizure.')],
  whyLater:[...draft('question-the-plan'),line('brief-later-hearing','della','A hearing needs the original payment sheets and someone who can identify them. A copied total arriving at the coast first will have more money behind it than our complaint.')],
  workers:[line('brief-worker-question','mara','What happens when a clerk keeps the door shut because the wage book says to keep it shut?'),line('brief-worker-answer','della','Then we have a person and a closed door. Neither is permission to call a wage a death sentence.'),line('brief-worker-order','tomas','We make room for them to come out. Their answers and what we actually do will belong in the account, separately.')],
  cash:[...draft('bastian-s-cash-demand'),line('brief-cash-mara','mara','Cash for the road is a need. It is not proof that everything behind that door is ours.'),line('brief-cash-ruth','ruth','And these are four old seals, not four new chances. If we take them out of my store, every one gets a destination and an ending.'),line('brief-cash-bastian','bastian','I can keep this doorway while you count. Do not turn counting into another way of never choosing.')],
  readiness:[...draft('readiness-pause'),line('brief-readiness-della','della','This is agreement to prepare. The powder, mounts, holding watch and actual guns still need their own hands.'),line('brief-readiness-mara','mara','Then keep the decision separate from the work. I want to know what leaves camp before anybody calls us ready.')],
  review:[line('brief-review-tomas','tomas','The intended signal stop comes first. A place on a moving roof is an alternative we have to reach, not a promise the railway has made us.'),line('brief-review-della','della','We seek the deeds, keep company paper separate from spendable cash, and return the unspent things we borrow. Levi remains guarded until a living person actually takes the watch.'),line('brief-review-mara','mara','A plan names the work. It does not perform it.')],
  decline:[line('brief-decline-mara','mara','Keep the papers here. I am not agreeing to leave the people in camp for this road yet.'),line('brief-decline-della','della','Then nothing leaves on the strength of this conversation. Come back when the objection has an answer; we will not call silence consent.')],
});
const completed=(b,kind)=>b.completed.some(entry=>entry.kind===kind);
function paperSnapshot(s){return Object.fromEntries(paperIds.map(id=>{const p=resolveFixedRef(s,original(id),'document');return[id,{owner:p.owner,location:copy(p.location)}];}));}
export function createTrainBriefing(s){return{schema:1,startedAt:s.elapsed,lastStepAt:s.elapsed,calledAt:s.elapsed,initialPaperState:paperSnapshot(s),setup:{startedAt:null,acceptedSeconds:0,finishedAt:null,intervals:[]},exchangeSerial:0,heard:[],completed:[],exchange:null,paperWork:null,decisions:[],acceptedAt:null};}
export const usesTrainBriefing=s=>record(s)?.train?.briefingVersion===1;
const active=s=>s.campaign?.activeMissionId===TRAIN_ID&&record(s)?.train?.runtimeVersion===1&&[1,2].includes(record(s).mission.stage)&&s.region==='snowbound';
function held(s){const a=s.entities.levi;return a?.hp>0&&a.bound&&a.attachment?.type==='rest'&&a.attachment.targetId===RIVAL_WORLD.camp.holding.id;}
function tableReady(s){const b=state(s);return b?.setup.finishedAt!==null&&b?.setup.finishedAt!==undefined;}
function originalsAt(s,at){
  const c=rival(s).rival.continuation;
  if(c.initializedAt===null||c.initializedAt>at)return paperSnapshot(s);
  const result=Object.fromEntries(paperIds.map(id=>[id,{owner:c.baseline.objects[id].owner,location:copy(c.baseline.objects[id].location)}]));
  for(const event of c.events)if(event.at<=at)for(const effect of event.effects)if(effect.ref.sourceMissionId===RIVAL_ID&&paperIds.includes(effect.ref.objectId)&&effect.after)result[effect.ref.objectId]={owner:effect.after.owner,location:copy(effect.after.location)};
  return result;
}
export function briefingPaperEvidence(s,at=s.elapsed){
  const b=state(s);if(!b)return null;
  const events=rival(s).rival.continuation.events.filter(event=>event.at>=b.startedAt&&event.at<=at),papers=originalsAt(s,at),ids=[];
  if(paperIds.every(id=>b.initialPaperState[id].owner==='mara')){
    const returned=events.find(event=>event.kind==='return-papers');if(!returned)return null;ids.push(returned.id);
  }else if(!paperIds.every(id=>b.initialPaperState[id].owner==='tomas'))return null;
  for(const id of paperIds){
    const location={type:'station',targetId:CONTACTS[id].id,regionId:'snowbound'},placed=events.filter(event=>event.kind==='move-object'&&same(event.operation.refs[0],original(id))&&event.operation.to?.owner==='tomas'&&same(event.operation.to.location,location)).at(-1);
    if(!placed||papers[id].owner!=='tomas'||!same(papers[id].location,location))return null;ids.push(placed.id);
  }
  return ids;
}
function guardAt(s,at){const c=rival(s).rival.continuation;let guard=c.initializedAt===null||c.initializedAt>at?rival(s).captivity.guardId:c.baseline.guardPresent?c.baseline.guardId:null;for(const e of c.events)if(e.at<=at&&e.guardChange)guard=e.guardChange.after;return guard??null;}
function tableSpeakers(s){return ['tomas','della'].every(id=>s.entities[id]?.hp>0&&s.entities[id].regionId==='snowbound'&&near(s.entities[id],APPROACHES[id],8)&&near(s.entities[id],s.entities.mara,80))&&near(s.entities.mara,TABLE,85);}
function cashSpeakers(s){return held(s)&&rival(s).captivity.guardId==='bastian'&&['bastian','ruth'].every(id=>s.entities[id]?.hp>0&&s.entities[id].regionId==='snowbound'&&near(s.entities[id],RIVAL_WORLD.camp.holding,65)&&near(s.entities[id],s.entities.mara,75))&&near(s.entities.mara,RIVAL_WORLD.camp.holding,65);}
function canSpeak(s,kind){return kind==='cash'?cashSpeakers(s):tableReady(s)&&!!briefingPaperEvidence(s)&&tableSpeakers(s);}
export function trainBriefingReady(s){const b=state(s);return active(s)&&record(s).mission.stage===1&&b&&b.acceptedAt===null&&mandatory.every(kind=>completed(b,kind))&&!!briefingPaperEvidence(s)&&tableSpeakers(s)&&held(s)&&rival(s).captivity.guardId==='bastian';}
function show(s,ctx){const b=state(s),x=b.exchange,item=x&&TRAIN_BRIEFING_LINES[x.kind]?.[x.cursor];if(!item||!canSpeak(s,x.kind))return false;ctx.talk(s,`train-briefing-${x.kind}`,s.entities[item.speakerId].name,item.text,[['train-brief-next','Continue the exchange.'],['train-brief-pause','Pause and return.']]);return true;}
function decision(s,ctx){if(!trainBriefingReady(s))return false;ctx.talk(s,'train-briefing-decision','Tomas Reed','The originals are here and the work has been named. Are you agreeing to prepare the operation?',[['train-brief-accept','Agree to prepare the operation.'],['train-brief-wait','Keep the decision open.'],['train-brief-review','Review the intended work.'],['train-brief-decline','Decline for now.'],['train-brief-why-later','Ask why a later hearing is not enough.'],['train-brief-workers','Challenge violence against employed workers.']]);return true;}
function startExchange(s,kind,ctx){const b=state(s);if(b.exchange||!canSpeak(s,kind))return false;b.exchange={id:`train-briefing-exchange-${++b.exchangeSerial}`,kind,startedAt:s.elapsed,cursor:0,awaitingSpeakers:false};return show(s,ctx);}
function offer(s,id,label,target,radius=75){const p=s.entities.mara;return near(p,target,radius)?{id,label,targetId:target.id||id,x:target.x,y:target.y,z:target.z||0,distance:distance(p,target),priority:-4}:null;}
export function getTrainBriefingInteractions(s){
  if(!active(s)||record(s).mission.stage!==1||s.dialog||s.failure)return [];
  if(!usesTrainBriefing(s))return[offer(s,'train:brief-call','Call Tomas and Della to the stove room',APPROACHES.mara,65)].filter(Boolean);
  const b=state(s),list=[];if(b.exchange)return canSpeak(s,b.exchange.kind)?[offer(s,'train:brief-resume','Resume the unfinished briefing',b.exchange.kind==='cash'?RIVAL_WORLD.camp.holding:APPROACHES.mara,75)].filter(Boolean):[];
  if(!tableReady(s))return [];
  const papers=paperSnapshot(s);
  if(paperIds.every(id=>papers[id].owner==='mara'))list.push(offer(s,'train:brief-return-papers','Return both borrowed originals to Tomas',s.entities.tomas,50));
  if(!b.paperWork||b.paperWork.requestId&&rival(s).rival.continuation.events.some(e=>e.requestId===b.paperWork.requestId))for(const id of paperIds)if(papers[id].owner==='tomas'&&papers[id].location.type==='carried'&&distance(s.entities.mara,WORK[id])>=22)list.push(offer(s,`train:brief-layout:${id}`,`Ask Tomas to lay out the original ${id==='route-diagram'?'route diagram':'seizure list'}`,APPROACHES.mara,80));
  if(canSpeak(s,'invitation')){
    if(!completed(b,'invitation'))list.push(offer(s,'train:brief-invitation','Hear what the recovered originals mean',APPROACHES.mara));
    else{
      if(!completed(b,'employer'))list.push(offer(s,'train:brief-employer','Ask Della to name Morrow’s industrial reach',APPROACHES.mara));
      list.push(offer(s,'train:brief-why-later','Ask why the deeds cannot wait for a later hearing',APPROACHES.mara),offer(s,'train:brief-workers','Challenge the danger to employed workers',APPROACHES.mara),offer(s,'train:brief-review','Review the intended work',APPROACHES.mara),offer(s,'train:brief-decline','Decline the operation for now',APPROACHES.mara));
      if(completed(b,'employer')&&completed(b,'cash'))list.push(offer(s,'train:brief-readiness','Return to the explicit readiness decision',APPROACHES.mara));
    }
  }
  if(completed(b,'invitation')&&!completed(b,'cash')&&held(s)){
    if(rival(s).captivity.guardId===undefined)list.push(offer(s,'train:brief-establish-guard','Establish Bastian’s present holding watch',RIVAL_WORLD.camp.holding,45));
    else if(rival(s).captivity.guardId==='bastian')list.push(offer(s,'train:brief-cash','Hear Bastian and Ruth beside the actual holding watch',RIVAL_WORLD.camp.holding,65));
  }
  return list.filter(Boolean);
}
export function interactTrainBriefing(s,id,ctx){
  if(!getTrainBriefingInteractions(s).some(action=>action.id===id))return false;
  if(id==='train:brief-call'){
    if(record(s).train.briefingVersion!==undefined||record(s).train.briefing!==undefined)return false;
    record(s).train.briefingVersion=1;record(s).train.briefing=createTrainBriefing(s);for(const who of ['tomas','della']){s.entities[who].holstered=true;s.entities[who].aiming=false;}ctx.notice(s,'Tomas and Della are coming to open the table. Bastian keeps the holding doorway. No equipment has been issued.');return true;
  }
  const b=state(s);
  if(id==='train:brief-resume')return show(s,ctx);
  if(id==='train:brief-return-papers'){const result=Powder.requestPowderCustodyWork(s,{kind:'return-papers',actorIds:['mara','tomas'],refs:paperIds.map(original),to:null,options:{}},ctx);if(!result)ctx.notice(s,'Come beside the north side of Tomas’s end of the table, face him and free your hands before returning the originals.');return !!result;}
  if(id==='train:brief-establish-guard')return !!Powder.requestPowderCustodyWork(s,{kind:'establish-guard',actorIds:['mara','bastian'],refs:[],to:null,options:{toActorId:'bastian'}},ctx);
  if(id.startsWith('train:brief-layout:')){const objectId=id.slice('train:brief-layout:'.length);b.paperWork={objectId,requestedAt:s.elapsed,requestId:null};return true;}
  if(id==='train:brief-cash'){
    if(!cashSpeakers(s)){b.exchange={id:`train-briefing-exchange-${++b.exchangeSerial}`,kind:'cash',startedAt:s.elapsed,cursor:0,awaitingSpeakers:true};ctx.notice(s,'Ruth is coming to the tack room. Bastian stays beside Levi.');return true;}
    return startExchange(s,'cash',ctx);
  }
  const kind={'train:brief-invitation':'invitation','train:brief-employer':'employer','train:brief-why-later':'whyLater','train:brief-workers':'workers','train:brief-review':'review','train:brief-decline':'decline','train:brief-readiness':'readiness'}[id];
  if(kind==='readiness'&&completed(b,'readiness'))return decision(s,ctx);return kind?startExchange(s,kind,ctx):false;
}
export function chooseTrainBriefing(s,id,ctx){
  const b=state(s);if(!b||!s.dialog?.choices.some(choice=>choice.id===id))return false;
  if(s.dialog.id==='train-briefing-decision'){
    if(!trainBriefingReady(s))return false;
    if(id==='train-brief-accept'){
      const paperEventIds=briefingPaperEvidence(s);b.decisions.push({id:'accept',at:s.elapsed,playerPosition:point(s.entities.mara),paperEventIds});b.acceptedAt=s.elapsed;record(s).train.chronicle.acceptedAt=s.elapsed;record(s).choices.operation='accepted';record(s).mission.stage=2;record(s).mission.objective=TRAIN_STAGES[2];record(s).train.chronicle.stageEvents.push({fromStage:1,toStage:2,at:s.elapsed,cause:'briefing-accepted'});s.dialog=null;ctx.checkpoint(s,'train-operation-accepted','The heard plan is accepted; actual preparation remains');return true;
    }
    s.dialog=null;if(id==='train-brief-wait'){b.decisions.push({id:'wait',at:s.elapsed,playerPosition:point(s.entities.mara),paperEventIds:[]});return true;}
    return startExchange(s,{'train-brief-review':'review','train-brief-decline':'decline','train-brief-why-later':'whyLater','train-brief-workers':'workers'}[id],ctx);
  }
  const x=b.exchange;if(!x||s.dialog.id!==`train-briefing-${x.kind}`||!canSpeak(s,x.kind))return false;
  if(id==='train-brief-pause'){s.dialog=null;return true;}if(id!=='train-brief-next')return false;
  const item=TRAIN_BRIEFING_LINES[x.kind][x.cursor];b.heard.push({exchangeId:x.id,kind:x.kind,index:x.cursor,...copy(item),at:s.elapsed,actorPosition:point(s.entities[item.speakerId]),playerPosition:point(s.entities.mara),paperEventIds:x.kind==='cash'?[]:briefingPaperEvidence(s),guardId:x.kind==='cash'?'bastian':null});x.cursor++;s.dialog=null;
  if(x.cursor<TRAIN_BRIEFING_LINES[x.kind].length){show(s,ctx);return true;}
  b.completed.push({exchangeId:x.id,kind:x.kind,at:s.elapsed});if(x.kind==='decline')b.decisions.push({id:'decline',at:s.elapsed,playerPosition:point(s.entities.mara),paperEventIds:[]});const readiness=x.kind==='readiness';b.exchange=null;if(readiness)decision(s,ctx);return true;
}
function tableWindow(s,ctx,start,finish){
  if(typeof ctx.briefingTableWindow!=='function')return null;
  let w;try{w=ctx.briefingTableWindow(s,{start,finish,actorIds:['tomas','della'],tableId:TABLE.id});}catch{return null;}
  return validTableWindow(w,start,finish,s)?copy(w):null;
}
function validTableWindow(w,start,finish,s=null){
  if(!keys(w,['start','finish','tableId','sweptClear','futureSolidClear','occupants','actors'])||w.start!==start||w.finish!==finish||w.tableId!==TABLE.id||w.sweptClear!==true||w.futureSolidClear!==true||!Array.isArray(w.occupants)||w.occupants.length||!Array.isArray(w.actors)||w.actors.length!==2)return false;
  return w.actors.every((a,i)=>{const id=['tomas','della'][i],target={x:id==='tomas'?SOLID.x+SOLID.w:SOLID.x,y:TABLE.y,z:TABLE.height};return keys(a,['id','root','hand','target','reachable','handUsable','handFree'])&&a.id===id&&finitePoint(a.root)&&a.root.z===0&&finitePoint(a.hand)&&same(a.target,target)&&a.reachable===true&&a.handUsable===true&&a.handFree===true&&near(a.root,APPROACHES[id],8)&&Math.hypot(...['x','y','z'].map(k=>a.hand[k]-SETUP[id].target[k]))<=1e-5&&(!s||Math.hypot(...['x','y','z'].map(k=>a.root[k]-(s.entities[id][k]||0)))<=1e-7);});
}
export function stepTrainBriefing(s,dt,ctx){
  const b=state(s);if(!active(s)||!b||s.dialog||s.failure||!finite(dt)||dt<=0||dt>.1||Math.abs(s.elapsed-b.lastStepAt-dt)>1e-7)return false;
  const start=b.lastStepAt;b.lastStepAt=s.elapsed;if(b.acceptedAt!==null)return true;
  const world=ctx.worldFor(s);if(!world)return false;
  if(!tableReady(s)){
    for(const id of ['tomas','della']){followActor(world,s.entities[id],SETUP[id],70,dt,3,9);if(near(s.entities[id],SETUP[id],8)){s.entities[id].facing=SETUP[id].facing;s.entities[id].pose=SETUP[id].pose;}}
    const w=tableWindow(s,ctx,start,s.elapsed);if(w){if(b.setup.startedAt===null)b.setup.startedAt=start;b.setup.intervals.push(w);b.setup.acceptedSeconds+=dt;if(b.setup.acceptedSeconds+1e-7>=TABLE.setupSeconds)b.setup.finishedAt=s.elapsed;}
    else{b.setup.startedAt=null;b.setup.acceptedSeconds=0;b.setup.intervals=[];}return true;
  }
  if(b.paperWork){
    const job=b.paperWork,event=job.requestId&&rival(s).rival.continuation.events.find(e=>e.requestId===job.requestId);
    if(event){b.paperWork=null;}
    else if(job.requestId&&!inspectCustodyRequest(s,job.requestId))job.requestId=null;
    if(b.paperWork&&!job.requestId){const target=WORK[job.objectId],actor=s.entities.tomas;followActor(world,actor,target,65,dt,2,9);if(near(actor,target,3)&&distance(s.entities.mara,actor)>=22){actor.facing=target.facing;actor.pose=target.pose;const result=Powder.requestPowderCustodyWork(s,{kind:'move-object',actorIds:['tomas'],refs:[original(job.objectId)],to:{owner:'tomas',location:{type:'station',targetId:CONTACTS[job.objectId].id,regionId:'snowbound'}},options:{}},ctx);if(result)job.requestId=result.requestId;}return true;}
  }
  if(!b.paperWork){delete s.entities.tomas.pose;followActor(world,s.entities.tomas,APPROACHES.tomas,65,dt,3,9);if(near(s.entities.tomas,APPROACHES.tomas,8))s.entities.tomas.facing=Math.PI;}
  delete s.entities.della.pose;followActor(world,s.entities.della,APPROACHES.della,65,dt,3,9);if(near(s.entities.della,APPROACHES.della,8))s.entities.della.facing=0;
  if(b.exchange?.kind==='cash'){followActor(world,s.entities.ruth,{x:RIVAL_WORLD.camp.holding.x-22,y:RIVAL_WORLD.camp.holding.y-25,z:0},70,dt,3,9);if(b.exchange.awaitingSpeakers&&canSpeak(s,'cash')){b.exchange.awaitingSpeakers=false;show(s,ctx);}}
  return true;
}
export function validateTrainBriefing(s){
  try{
    const r=record(s),t=r.train,b=state(s),now=s.elapsed;
    if(t.briefingVersion===undefined)return b===undefined&&!s.dialog?.id?.startsWith('train-briefing-');
    if(t.briefingVersion!==1||!keys(b,['schema','startedAt','lastStepAt','calledAt','initialPaperState','setup','exchangeSerial','heard','completed','exchange','paperWork','decisions','acceptedAt'])||b.schema!==1||!finite(t.chronicle.stageEvents[0]?.at)||!finite(b.startedAt)||b.startedAt<t.chronicle.stageEvents[0].at||b.startedAt>now||b.calledAt!==b.startedAt||!finite(b.lastStepAt)||b.lastStepAt<b.startedAt||b.lastStepAt>now||!Number.isSafeInteger(b.exchangeSerial)||b.exchangeSerial<0||!Array.isArray(b.heard)||!Array.isArray(b.completed)||!Array.isArray(b.decisions))return false;
    if(!keys(b.initialPaperState,paperIds)||paperIds.some(id=>{const p=b.initialPaperState[id];return !keys(p,['owner','location'])||!['mara','tomas'].includes(p.owner)||!same(p.location,{type:'carried',targetId:p.owner});})||b.initialPaperState[paperIds[0]].owner!==b.initialPaperState[paperIds[1]].owner)return false;
    const c=rival(s).rival.continuation,initial=c.initializedAt!==null&&c.initializedAt>=b.startedAt?Object.fromEntries(paperIds.map(id=>[id,{owner:c.baseline.objects[id].owner,location:copy(c.baseline.objects[id].location)}])):originalsAt(s,b.startedAt);
    if(!same(initial,b.initialPaperState))return false;
    const setup=b.setup;if(!keys(setup,['startedAt','acceptedSeconds','finishedAt','intervals'])||!finite(setup.acceptedSeconds)||setup.acceptedSeconds<0||setup.acceptedSeconds>TABLE.setupSeconds+.1+1e-7||!Array.isArray(setup.intervals))return false;
    let end=null,total=0;for(const w of setup.intervals){if(!finite(w.start)||!finite(w.finish)||w.start<b.startedAt||w.finish>now||w.finish<=w.start||w.finish-w.start>.1+1e-7||end!==null&&Math.abs(w.start-end)>1e-7||!validTableWindow(w,w.start,w.finish))return false;total+=w.finish-w.start;end=w.finish;}
    if(Math.abs(total-setup.acceptedSeconds)>1e-7||setup.startedAt!==(setup.intervals[0]?.start??null)||end!==null&&end>b.lastStepAt)return false;
    if(setup.finishedAt===null){if(setup.acceptedSeconds>=TABLE.setupSeconds+1e-7||b.heard.length||b.completed.length||b.paperWork!==null||b.acceptedAt!==null)return false;}
    else if(!finite(setup.finishedAt)||setup.finishedAt!==end||total<TABLE.setupSeconds-1e-7)return false;
    const groups=new Map(),finished=[],completedAt=new Map();let at=b.startedAt;
    for(const e of b.heard){
      const lines=TRAIN_BRIEFING_LINES[e.kind],item=lines?.[e.index];
      if(!keys(e,['exchangeId','kind','index','lineId','speakerId','text','at','actorPosition','playerPosition','paperEventIds','guardId'])||!lines||!item||!same({lineId:e.lineId,speakerId:e.speakerId,text:e.text},item)||!finite(e.at)||e.at<at||e.at>now||!finitePoint(e.actorPosition)||!finitePoint(e.playerPosition)||!Array.isArray(e.paperEventIds))return false;
      if(!groups.has(e.exchangeId)){const previous=[...groups.values()].at(-1);if(previous&&previous.length!==TRAIN_BRIEFING_LINES[previous[0].kind].length)return false;groups.set(e.exchangeId,[]);}
      const group=groups.get(e.exchangeId);if(e.index!==group.length||group.length&&group[0].kind!==e.kind||e.exchangeId!==`train-briefing-exchange-${groups.size}`)return false;
      if(e.kind!=='invitation'&&!completedAt.has('invitation')||e.kind==='readiness'&&!['invitation','employer','cash'].every(kind=>completedAt.has(kind)))return false;
      if(e.kind==='cash'){
        if(e.guardId!=='bastian'||guardAt(s,e.at)!=='bastian'||e.paperEventIds.length||!near(e.playerPosition,RIVAL_WORLD.camp.holding,65)||!near(e.actorPosition,e.playerPosition,75)||e.speakerId!=='mara'&&!near(e.actorPosition,RIVAL_WORLD.camp.holding,65))return false;
      }else{
        if(e.guardId!==null||setup.finishedAt===null||e.at<setup.finishedAt||!same(e.paperEventIds,briefingPaperEvidence(s,e.at))||!near(e.playerPosition,TABLE,85)||!near(e.actorPosition,e.playerPosition,80)||['tomas','della'].includes(e.speakerId)&&!near(e.actorPosition,APPROACHES[e.speakerId],8))return false;
      }
      if(e.speakerId==='mara'&&!same(e.actorPosition,e.playerPosition))return false;
      group.push(e);at=e.at;if(group.length===lines.length){finished.push({exchangeId:e.exchangeId,kind:e.kind,at:e.at});if(!completedAt.has(e.kind))completedAt.set(e.kind,e.at);}
    }
    if(!same(b.completed,finished))return false;
    if(b.exchange!==null){const x=b.exchange,lines=TRAIN_BRIEFING_LINES[x.kind],group=groups.get(x.id)||[];
      if(!keys(x,['id','kind','startedAt','cursor','awaitingSpeakers'])||!lines||typeof x.awaitingSpeakers!=='boolean'||x.awaitingSpeakers&&(x.kind!=='cash'||x.cursor!==0||s.dialog?.id==='train-briefing-cash')||!finite(x.startedAt)||x.startedAt<b.startedAt||x.startedAt>now||x.cursor!==group.length||x.cursor>=lines.length||group.some(e=>e.at<x.startedAt)||x.id!==`train-briefing-exchange-${b.exchangeSerial}`||groups.size+(group.length?0:1)!==b.exchangeSerial)return false;
      if(x.kind!=='invitation'&&!completedAt.has('invitation')||x.kind==='cash'&&guardAt(s,x.startedAt)!=='bastian'||x.kind!=='cash'&&(setup.finishedAt===null||x.startedAt<setup.finishedAt||!briefingPaperEvidence(s,x.startedAt)))return false;
    }else if(groups.size!==b.exchangeSerial||[...groups.values()].some(group=>group.length!==TRAIN_BRIEFING_LINES[group[0].kind].length))return false;
    if(b.paperWork!==null){const w=b.paperWork;if(!keys(w,['objectId','requestedAt','requestId'])||!paperIds.includes(w.objectId)||!finite(w.requestedAt)||w.requestedAt<b.startedAt||w.requestedAt>now||setup.finishedAt===null||w.requestedAt<setup.finishedAt)return false;
      if(w.requestId!==null){const request=inspectCustodyRequest(s,w.requestId),event=c.events.find(e=>e.requestId===w.requestId),op=request?.operation||event?.operation;if(!op||op.kind!=='move-object'||!same(op.refs,[original(w.objectId)])||!same(op.to,{owner:'tomas',location:{type:'station',targetId:CONTACTS[w.objectId].id,regionId:'snowbound'}}))return false;}
    }
    let last=b.startedAt,accept=null,declines=0;for(const d of b.decisions){
      if(!keys(d,['id','at','playerPosition','paperEventIds'])||!['wait','decline','accept'].includes(d.id)||!finite(d.at)||d.at<last||d.at>now||!finitePoint(d.playerPosition)||!near(d.playerPosition,TABLE,85)||!Array.isArray(d.paperEventIds))return false;
      if(d.id==='decline'){declines++;if(d.paperEventIds.length||!finished.some(e=>e.kind==='decline'&&e.at===d.at))return false;}
      else{if(!mandatory.every(kind=>completedAt.has(kind)&&completedAt.get(kind)<=d.at))return false;if(d.id==='wait'){if(d.paperEventIds.length)return false;}else{if(accept!==null||!same(d.paperEventIds,briefingPaperEvidence(s,d.at))||guardAt(s,d.at)!=='bastian')return false;accept=d.at;}}
      last=d.at;
    }
    if(declines!==finished.filter(e=>e.kind==='decline').length||b.acceptedAt!==accept||accept!==null&&b.decisions.at(-1)?.id!=='accept'||accept===null&&(r.mission.stage!==1||t.chronicle.acceptedAt!==null||r.choices.operation!==null)||accept!==null&&(r.mission.stage<2||t.chronicle.acceptedAt!==accept||r.choices.operation!=='accepted'))return false;
    if(s.dialog?.id?.startsWith('train-briefing-')){
      if(s.dialog.id==='train-briefing-decision')return b.exchange===null&&trainBriefingReady(s)&&s.dialog.speaker==='Tomas Reed'&&s.dialog.text==='The originals are here and the work has been named. Are you agreeing to prepare the operation?'&&same(s.dialog.choices,[{id:'train-brief-accept',label:'Agree to prepare the operation.'},{id:'train-brief-wait',label:'Keep the decision open.'},{id:'train-brief-review',label:'Review the intended work.'},{id:'train-brief-decline',label:'Decline for now.'},{id:'train-brief-why-later',label:'Ask why a later hearing is not enough.'},{id:'train-brief-workers',label:'Challenge violence against employed workers.'}]);
      const x=b.exchange,item=x&&TRAIN_BRIEFING_LINES[x.kind][x.cursor];return !!item&&canSpeak(s,x.kind)&&s.dialog.id===`train-briefing-${x.kind}`&&s.dialog.speaker===s.entities[item.speakerId].name&&s.dialog.text===item.text&&same(s.dialog.choices,[{id:'train-brief-next',label:'Continue the exchange.'},{id:'train-brief-pause',label:'Pause and return.'}]);
    }
    return true;
  }catch{return false;}
}
