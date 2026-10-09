/** First train scene: actual new arrivals and separate bedside exchanges.
 * The parent mission owns availability and the world clock. No prior patient,
 * family, weapon or pantry state is reset by this scene.
 */
import {TRAIN_ID,TRAIN_NEW_CAST} from '../content/campaign/brass-cutting.js';
import {blockedAt,followActor,clearLine} from './campaign-navigation.js';
const RESCUE='snowbound-a-voice-under-ice',HUNT='snowbound-a-quiet-table',RIVAL='snowbound-the-names-they-took';
const copy=v=>structuredClone(v),pos=a=>({x:a.x,y:a.y,z:a.z||0}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),near=(a,b,r=75)=>a&&b&&a.hp>0&&Math.abs((a.z||0)-(b.z||0))<8&&dist(a,b)<=r;
const state=s=>s.campaign?.missions?.[TRAIN_ID]?.train?.prelude;
function regionOf(s,a,seen=new Set()){if(!a||seen.has(a.id))return null;seen.add(a.id);return !a.attachment?a.regionId:a.attachment.type==='rest'?a.attachment.regionId:regionOf(s,s.entities[a.attachment.targetId],seen);}
export const TRAIN_PRELUDE_ENTRY=Object.freeze({abel:Object.freeze({x:255,y:1380,z:0}),nell:Object.freeze({x:1050,y:1380,z:0}),rivet:Object.freeze({x:1050,y:1380,z:0})});
const entry=TRAIN_PRELUDE_ENTRY;
export const TRAIN_WATCH_BOTTLE_REST={x:397,y:1292,z:4};
export function createTrainPrelude(){return{schema:1,startedAt:null,lastStepAt:null,arrivals:{},knownNames:[],completed:[],acknowledged:[],exchange:null,bottle:null,bottleWork:null,patientAtStart:null};}
export function beginTrainPrelude(s,ctx){
  const p=state(s),r=s.campaign?.missions?.[TRAIN_ID];
  if(!p||p.startedAt!==null||s.dialog||s.failure||!Number.isFinite(s.elapsed)||s.campaign.activeMissionId!==TRAIN_ID||r.status!=='active'||r.mission.stage!==0||s.region!=='snowbound'||![RESCUE,HUNT,RIVAL].every(id=>s.campaign.missions[id]?.mission.completed))return false;
  const world=ctx.worldFor(s),patient=s.entities.silas;
  if(!world||!patient||patient.hp<=0||['abel','nell','rivet'].some(id=>s.entities[id]||blockedAt(world,entry[id].x,entry[id].y,id==='rivet'?13:9)))return false;
  const added=[];
  try{
    for(const id of ['abel','rivet','nell']){
      const spec=TRAIN_NEW_CAST.find(a=>a.id===id),actor=ctx.addEntity(s,{...copy(spec),...entry[id]},'snowbound',id==='rivet'?'mount':'npc');
      if(!actor||actor.id!==id)throw new Error('A train arrival could not enter the registry');added.push(id);
    }
  }catch{
    for(const id of added){delete s.entities[id];for(const region of Object.values(s.regions))region.residentIds=region.residentIds.filter(value=>value!==id);}return false;
  }
  const nell=s.entities.nell;nell.mounted=true;nell.mountId='rivet';s.entities.rivet.hitched=false;
  p.startedAt=s.elapsed;p.lastStepAt=s.elapsed;
  for(const id of ['abel','nell'])p.arrivals[id]={at:s.elapsed,from:copy(entry[id]),arrivedAt:null};
  const rescue=s.campaign.missions[RESCUE];
  p.patientAtStart={at:s.elapsed,hp:patient.hp,injured:!!patient.injured,scars:!!patient.scars,healingHours:rescue.rescue.silas.healingHours,attachment:copy(patient.attachment??null),dressingTransactionIds:Object.keys(rescue.transactions).filter(id=>/^snowbound-a-voice-under-ice:care:dressing-[1-6]$/.test(id)).sort(),dressingCooldown:rescue.timers.helper};
  p.bottle={id:'abel-watch-bottle',kind:'watch-bottle',owner:'abel',location:{type:'carried',targetId:'abel',hand:'R'},closed:true};
  s.entities.abel.toolHeld=p.bottle.id;s.entities.abel.toolHand='R';
  ctx.notice(s,'A visitor approaches the shelter. A rider and her mare arrive along the south road.');return true;
}
function linesFor(s,kind){
  if(kind==='bedside')return[
    ['abel','Abel Sedge. Elin allowed me a chair; I promised to be more use than the clock.'],
    ['abel','I count the breaths because the clock keeps counting whether I listen or not.'],
    ['mara','And the bottle?'],
    ['abel','A shorter way through a long watch. I should have read the label before I offered it.'],
    ['elin','Then put it down and stay useful. He needs company as well as clean cloth.'],
  ];
  if(kind==='silas')return[['silas','I keep hearing your signal in the stone. Even here.'],['mara',s.entities.silas.injured?'Hear it sitting down. I did not bring you off that ledge to watch you invent another one.':'Then let the strength catch up with the shoulder. The scars have already done their travelling.']];
  if(kind==='family')return[
    ['fin',s.entities.fin.scarfDelivered?'I left the scarf’s end outside the blanket. You can find it without looking.':'The scarf is still where I left it. I can bring it when you want.'],
    ['silas','I know which hands stayed when mine would not hold.'],
    ['elin',s.entities.silas.coatRepaired?'The patch is holding. That does not make the old tear a reason to collect another.':'The coat still needs cloth. A promise will not cover that tear.'],
  ];
  if(kind==='nell')return[['nell','Nell Sarto. Rivet brought me over the thaw road; the roof tools are mine.'],['mara','Tomas says you know the company’s cars.'],['nell','I made them safer to stand in. I would like a say in what they carry.']];
  return null;
}
export function trainPreludeLineVariants(kind){
  const unique=new Map();for(const injured of [false,true])for(const coatRepaired of [false,true])for(const scarfDelivered of [false,true]){
    const lines=linesFor({entities:{silas:{injured,coatRepaired},fin:{scarfDelivered}}},kind);if(lines)unique.set(JSON.stringify(lines),lines);
  }return [...unique.values()].map(copy);
}
function speakerName(s,id){
  const p=state(s);if(['abel','nell'].includes(id)&&!p.knownNames.includes(id))return id==='abel'?'A visitor at the shelter':'A rider from the south road';return s.entities[id]?.name||'Mara Vale';
}
function canHear(s,line,kind=state(s)?.exchange?.kind){const actor=s.entities[line[0]],anchor=s.entities[kind==='nell'?'nell':'silas'];return actor?.hp>0&&regionOf(s,actor)==='snowbound'&&near(anchor,s.entities.mara,85)&&(line[0]==='mara'||near(actor,s.entities.mara));}
function showLine(s,ctx){
  const x=state(s).exchange,line=x?.lines[x.cursor];if(!line||!canHear(s,line))return false;
  ctx.talk(s,'train-prelude-'+x.kind,speakerName(s,line[0]),line[1],[['train-speech-next','Continue the exchange.'],['train-speech-pause','Pause and return.']]);return true;
}
export function getTrainPreludeInteractions(s){
  const p=state(s),list=[];if(!p||p.startedAt===null||s.dialog||s.failure||s.region!=='snowbound')return list;
  const offer=(id,label,target)=>{if(near(target,s.entities.mara))list.push({id,label,target:pos(target),distance:dist(target,s.entities.mara),priority:-3});};
  if(p.exchange){const line=p.exchange.lines[p.exchange.cursor];if(line)offer('train:resume-prelude','Resume the bedside exchange',s.entities[line[0]]);return list;}
  if(p.arrivals.abel.arrivedAt!==null&&!p.completed.includes('bedside'))offer('train:bedside','Speak with the visitor at Silas’s bedside',s.entities.abel);
  if(!p.completed.includes('silas'))offer('train:silas','Hear Silas’s account of the rescue',s.entities.silas);
  if(!p.completed.includes('family'))offer('train:family','Visit Elin and Fin together',s.entities.fin);
  if(p.arrivals.nell.arrivedAt!==null&&!p.completed.includes('nell'))offer('train:nell','Greet rider',s.entities.nell);
  return list;
}
export function interactTrainPrelude(s,id,ctx){
  if(!getTrainPreludeInteractions(s).some(action=>action.id===id))return false;
  const p=state(s);if(id==='train:resume-prelude')return showLine(s,ctx);
  const kind=id.slice(6),lines=linesFor(s,kind);if(!lines||!lines.every(line=>canHear(s,line,kind)))return false;
  p.exchange={kind,startedAt:s.elapsed,cursor:0,lines:copy(lines)};return showLine(s,ctx);
}
export function chooseTrainPrelude(s,choice,ctx){
  const p=state(s),x=p?.exchange;
  if(!x||s.dialog?.id!=='train-prelude-'+x.kind||!s.dialog.choices.some(c=>c.id===choice))return false;
  if(choice==='train-speech-pause'){s.dialog=null;return true;}
  if(choice!=='train-speech-next')return false;
  const line=x.lines[x.cursor],actor=s.entities[line[0]];if(!canHear(s,line))return false;
  p.acknowledged.push({kind:x.kind,index:x.cursor,speakerId:line[0],text:line[1],at:s.elapsed,actorPosition:pos(actor),playerPosition:pos(s.entities.mara)});
  if(['abel','nell'].includes(line[0])&&!p.knownNames.includes(line[0])){p.knownNames.push(line[0]);s.companions??={};s.companions[line[0]]??={trust:0,requests:0};}
  x.cursor++;s.dialog=null;
  if(x.cursor<x.lines.length){showLine(s,ctx);return true;}
  p.completed.push(x.kind);
  if(x.kind==='bedside')p.bottleWork={startedAt:s.elapsed,acceptedSeconds:0,finishedAt:null,intervals:[]};
  p.exchange=null;return true;
}
export function stepTrainPrelude(s,dt,ctx){
  const p=state(s);if(!p||p.startedAt===null||s.campaign.activeMissionId!==TRAIN_ID||s.dialog||s.failure||s.region!=='snowbound'||!Number.isFinite(dt)||dt<=0||dt>.1)return false;
  const delta=s.elapsed-p.lastStepAt;if(delta<=0||delta>.1+1e-7||Math.abs(delta-dt)>1e-7)return false;p.lastStepAt=s.elapsed;
  const world=ctx.worldFor(s),patient=s.entities.silas,abel=s.entities.abel,nell=s.entities.nell,rivet=s.entities.rivet;
  if(!world||!patient||patient.hp<=0||!abel||!nell||!rivet)return false;
  const bottlePending=p.bottleWork&&p.bottleWork.finishedAt===null;
  const abelGoal=bottlePending?{x:382,y:1287,z:0}:{x:patient.x+22,y:patient.y-12,z:patient.z||0};
  followActor(world,abel,abelGoal,70,dt,bottlePending?1:3,9);
  if(p.arrivals.abel.arrivedAt===null&&near(abel,patient,45))p.arrivals.abel.arrivedAt=s.elapsed;
  const riderGoal={x:680,y:1340,z:0};followActor(world,rivet,riderGoal,100,dt,4,13);Object.assign(nell,pos(rivet),{facing:rivet.facing});
  if(p.arrivals.nell.arrivedAt===null&&dist(rivet,riderGoal)<8)p.arrivals.nell.arrivedAt=s.elapsed;
  const fin=s.entities.fin;if(fin?.goal){followActor(world,fin,fin.goal,65,dt,5,9);if(dist(fin,fin.goal)<8)delete fin.goal;}
  if(bottlePending&&near(abel,TRAIN_WATCH_BOTTLE_REST,38)&&typeof ctx.clinicBottleContact==='function'){
    abel.pose='kneel';abel.facing=0;
    let proof;try{proof=ctx.clinicBottleContact(s,{actorId:'abel',objectId:p.bottle.id,hand:'R',target:copy(TRAIN_WATCH_BOTTLE_REST),start:s.elapsed-delta,finish:s.elapsed});}catch{proof=null;}
    const validPoint=a=>a&&['x','y','z'].every(k=>Number.isFinite(a[k]));
    if(proof?.reachable===true&&proof.sweptClear===true&&proof.handUsable===true&&proof.objectId===p.bottle.id&&proof.actorId==='abel'&&proof.start===s.elapsed-delta&&proof.finish===s.elapsed&&validPoint(proof.actorPosition)&&validPoint(proof.handPoint)&&Math.hypot(...['x','y','z'].map(k=>proof.actorPosition[k]-abel[k]))<1e-7&&Math.hypot(...['x','y','z'].map(k=>proof.handPoint[k]-TRAIN_WATCH_BOTTLE_REST[k]))<1e-5){
      p.bottleWork.acceptedSeconds+=delta;p.bottleWork.intervals.push({start:proof.start,finish:proof.finish,actorPosition:copy(proof.actorPosition),handPoint:copy(proof.handPoint),target:copy(TRAIN_WATCH_BOTTLE_REST),objectId:p.bottle.id,reachable:true,sweptClear:true,handUsable:true});
    }else{p.bottleWork.acceptedSeconds=0;p.bottleWork.intervals=[];}
    if(p.bottleWork.acceptedSeconds+1e-7>=1.1){p.bottle.location={type:'ground',point:copy(TRAIN_WATCH_BOTTLE_REST),regionId:'snowbound'};p.bottleWork.finishedAt=s.elapsed;delete abel.toolHeld;delete abel.toolHand;delete abel.pose;ctx.present(s,'train-set-down-bottle',TRAIN_WATCH_BOTTLE_REST,p.bottle.id,pos(abel),'abel',{sourceId:p.bottle.id});}
  }else if(bottlePending){p.bottleWork.acceptedSeconds=0;p.bottleWork.intervals=[];}
  return true;
}
export function trainClinicComplete(s){const p=state(s);return !!p&&Array.isArray(p.completed)&&['bedside','silas','family'].every(id=>p.completed.includes(id))&&Number.isFinite(p.bottleWork?.finishedAt)&&p.bottle?.location.type==='ground';}
