/** What the Line Carries. This initial schema scaffold is unavailable.
 * Native rail components do not authorize mission progress or new possessions.
 * The complete twenty-scene controller will replace the unavailable dispatch.
 */
import {TRAIN_ID,TRAIN_SOURCE_REQUIREMENT,TRAIN_STAGES,TRAIN_NEW_CAST,TRAIN_MOVING_CREW,TRAIN_LINE_GUARDS} from '../content/campaign/brass-cutting.js';
import {createTrainRuntimeSections,validateTrainRuntime} from './train-runtime-schema.js';
import {beginTrainPrelude,stepTrainPrelude,getTrainPreludeInteractions,interactTrainPrelude,chooseTrainPrelude,trainClinicComplete,TRAIN_PRELUDE_ENTRY} from './train-prelude.js';
import {createClinicBottleContactProvider} from './train-camp-motion.js';
import {createTrainCampWorkProvider} from './train-camp-work.js';
import * as Briefing from './train-briefing.js';
import * as Preparation from './train-preparation.js';
import {TRAIN_GEAR_DEFINITIONS,validateTrainGear} from './train-gear.js';
import {createTrainPreparationWorkProvider,PREPARATION_PROOF_OWNERS} from './train-preparation-work.js';
import {stepPreparationCampSetup} from './train-preparation-layout.js';
import {createPreparationMaskProvider} from './train-preparation-mask.js';
import {getPreparationStableInteractions,beginPreparationStable,stepPreparationStable} from './train-preparation-stable.js';
import {beginPreparationCopperRecovery,stepPreparationCopperRecovery} from './train-preparation-copper-recovery.js';
import {getTrainStableCareInteractions,beginTrainStableCare,stepTrainStableCare} from './train-stable-care.js';
import {advancePreparationGroundMotion} from './train-preparation-ground-motion.js';
export {worldForTrainCamp} from './train-camp-work.js';
import {blockedAt,moveActor} from './campaign-navigation.js';
import * as CampNavigation from './train-preparation-navigation.js';
import {getTrainCampHorseInteractions,interactTrainCampHorse} from './train-camp-horse-actions.js';
import {requestTrainReload,stepTrainReload} from './train-combat.js';
import * as Rescue from './rescue-mission.js';
import * as Rival from './rival-mission.js';
import * as Powder from './train-powder.js';
export {TRAIN_ID,TRAIN_SOURCE_REQUIREMENT};
export const TRAIN_PLAYABLE=false;
// Conservative feet-height serialization bound, including inherited upward
// ramp velocity. Actual support/airborne validity remains a physical check.
export const TRAIN_MAX_BODY_Z=256;
export const TRAIN_ITEMS=Object.fromEntries(TRAIN_GEAR_DEFINITIONS.map(item=>[item.id,{name:item.name,description:'Ada’s one oilcloth windwrap. Actual ownership, wearing and storage remain in its item instance.'}]));
export const TRAIN_WEAPON_DEFINITIONS={};
export const TRAIN_ENTITY_SPECS=[
  ...TRAIN_NEW_CAST.map(actor=>({...actor,category:actor.kind==='horse'?'mount':'npc'})),
  ...[...TRAIN_MOVING_CREW,...TRAIN_LINE_GUARDS].map(actor=>({...actor,kind:'person',category:'enemy',hp:100,protected:false,faction:'morrow-crew'})),
];
export const TRAIN_ENTITY_IDS=TRAIN_ENTITY_SPECS.map(actor=>actor.id);

export function createTrainRecord(){return{
  status:'locked',sourceRequirementId:TRAIN_SOURCE_REQUIREMENT,retryCount:0,checkpointId:null,
  mission:{id:TRAIN_ID,name:'What the Line Carries',stage:0,stageCount:20,completed:false,rewardPaid:false,objective:TRAIN_STAGES[0]},
  flags:{},timers:{},performance:{},choices:{},transactions:{},train:{schema:1,powder:null,consist:null},
};}
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function exact(value,shape){
  if(!object(shape))return value===shape;
  return object(value)&&Object.keys(value).length===Object.keys(shape).length&&Object.keys(shape).every(key=>Object.hasOwn(value,key)&&exact(value[key],shape[key]));
}
export function validateTrainRecord(s){
  const r=s?.campaign?.missions?.[TRAIN_ID];
  if(r?.train?.runtimeVersion!==undefined)return validateTrainRuntime(s,{preparation:PREPARATION_PROOF_OWNERS})&&validateTrainGear(s);
  if(!object(r)||!['locked','unstarted'].includes(r.status)||s.campaign.activeMissionId===TRAIN_ID)return false;
  const expected=createTrainRecord();expected.status=r.status;
  if(!exact(r,expected)||TRAIN_ENTITY_IDS.some(id=>Object.hasOwn(s.entities||{},id)))return false;
  return !Object.values(s.entities||{}).some(actor=>actor.support!=null);
}
export function validateTrainEntitySupport(s,actor){return actor?.support==null;}
export function ensureTrainCast(s){return s;}
const clinicProviders=new WeakMap(),campProviders=new WeakMap(),preparationProviders=new WeakMap(),maskProviders=new WeakMap(),active=s=>s.campaign?.activeMissionId===TRAIN_ID,record=s=>s.campaign.missions[TRAIN_ID],position=a=>({x:a.x,y:a.y,z:a.z||0});
const near=(a,b,r)=>a&&b&&Math.abs((a.z||0)-(b.z||0))<8&&Math.hypot(a.x-b.x,a.y-b.y)<=r;
function clinicContext(s,ctx){
  if(typeof ctx.clinicBottleContact==='function')return ctx;
  if(!clinicProviders.has(s))clinicProviders.set(s,createClinicBottleContactProvider(globalThis.My3D2dge,ctx.worldFor));
  return{...ctx,clinicBottleContact:clinicProviders.get(s)};
}
function campContext(s,ctx,dt=0){
  if(!campProviders.has(s))campProviders.set(s,createTrainCampWorkProvider(globalThis.My3D2dge,ctx.worldFor));
  const base={...ctx,...campProviders.get(s)};
  if(!preparationProviders.has(s))preparationProviders.set(s,createTrainPreparationWorkProvider(globalThis.My3D2dge,ctx.worldFor));
  const prepared=preparationProviders.get(s).context(s,base,dt);
  if(!maskProviders.has(s))maskProviders.set(s,createPreparationMaskProvider(globalThis.My3D2dge,ctx.worldFor));
  return maskProviders.get(s).context(s,prepared,dt);
}
/** Native first-scene entry. Public availability remains false until the whole
 * twenty-scene operation exists. This has ordinary prerequisites/proximity,
 * records its real mission entry and creates no preset loadout or past beats.
 */
export function beginTrainClinic(s,ctx){
  const r=s.campaign?.missions?.[TRAIN_ID],p=s.entities?.mara,patient=s.entities?.silas;
  if(!r||r.status!=='unstarted'||s.region!=='snowbound'||s.dialog||s.failure||!s.mission.completed||!p||p.hp<=0||p.mounted||p.carrying||!patient||patient.hp<=0||!near(p,patient,65)||!['snowbound-a-quiet-table','snowbound-the-names-they-took'].every(id=>s.campaign.missions[id]?.mission.completed)||typeof ctx.startTrainClinic!=='function')return false;
  const world=ctx.worldFor(s);if(!world||['abel','nell','rivet'].some(id=>s.entities[id]||blockedAt(world,TRAIN_PRELUDE_ENTRY[id].x,TRAIN_PRELUDE_ENTRY[id].y,id==='rivet'?13:9)))return false;
  if(!ctx.startTrainClinic(s))return false;
  Object.assign(r,createTrainRuntimeSections(s));
  if(!beginTrainPrelude(s,ctx))throw new Error('Preflighted clinic arrivals could not enter the campaign');
  ctx.checkpoint(s,'train-clinic-entry','The shelter visit begins; the train operation has not been accepted');return true;
}
export function getTrainInteractions(s,ctx){
  if(!active(s)||record(s).train.runtimeVersion!==1||s.dialog||s.failure)return [];
  const workContext=campContext(s,ctx),horse=getTrainCampHorseInteractions(s,ctx);if(s.player.mounted)return horse;
  return[...horse,...getPreparationStableInteractions(s,ctx),...getTrainStableCareInteractions(s,ctx),...getTrainPreludeInteractions(s),...Briefing.getTrainBriefingInteractions(s),...Preparation.getTrainPreparationInteractions(s,workContext),...Rescue.getRescueInteractions(s,ctx).map(a=>({...a,priority:(a.priority||0)+10})),...Rival.getRivalInteractions(s,ctx).map(a=>({...a,priority:(a.priority||0)+10}))];
}
export function interactTrain(s,id,ctx){
  if(!getTrainInteractions(s,ctx).some(a=>a.id===id))return s;
  if(interactTrainCampHorse(s,id,ctx)){campContext(s,ctx);return s;}
  if(id.startsWith('train:stable-care:')){const kind=id.slice('train:stable-care:'.length);if(beginTrainStableCare(s,kind,ctx))ctx.notice(s,kind==='tack'?'Inez will check Skein’s saddle strap. Give her room.':'Inez will examine Skein’s coat by hand. Give her room.');return s;}
  if(id==='train:stable-lead-skein'){if(beginPreparationStable(s,ctx))ctx.notice(s,'Inez will take Skein’s rein and lead her clear. Leave their route open; tack, water and care still need their own work.');return s;}
  if(id.startsWith('train:prepare-')){Preparation.interactTrainPreparation(s,id,campContext(s,ctx));return s;}
  if(id.startsWith('train:brief-')){Briefing.interactTrainBriefing(s,id,campContext(s,ctx));return s;}
  if(id.startsWith('train:')){interactTrainPrelude(s,id,ctx);return s;}
  if(Rescue.getRescueInteractions(s,ctx).some(a=>a.id===id)){
    const patient=s.entities.silas,rescue=s.campaign.missions[Rescue.RESCUE_ID],before={hp:patient.hp,hours:rescue.rescue.silas.healingHours,bandages:s.inventory.bandages||0,medicine:s.camp.medicine,keys:Object.keys(rescue.transactions),actorPosition:position(s.player),patientPosition:position(patient)};
    Rescue.interactRescue(s,id,ctx);
    if(id==='care:silas'){
      const transactionId=Object.keys(rescue.transactions).find(key=>!before.keys.includes(key)&&/^snowbound-a-voice-under-ice:care:dressing-[1-6]$/.test(key));
      if(transactionId){const personal=(s.inventory.bandages||0)===before.bandages-1,resource=personal?{store:'inventory',item:'bandages',before:before.bandages,after:s.inventory.bandages||0}:{store:'camp',item:'medicine',before:before.medicine,after:s.camp.medicine};record(s).train.chronicle.clinicalActions.push({transactionId,at:s.elapsed,actorId:'mara',patientId:'silas',beforeHP:before.hp,beforeHours:before.hours,afterHP:patient.hp,afterHours:rescue.rescue.silas.healingHours,resource,actorPosition:before.actorPosition,patientPosition:before.patientPosition});}
    }
  }else if(Rival.getRivalInteractions(s,ctx).some(a=>a.id===id))Rival.interactRival(s,id,ctx);
  return s;
}
export function chooseTrain(s,id,ctx){
  if(s.dialog?.id?.startsWith('train-prelude-'))chooseTrainPrelude(s,id,ctx);
  else if(s.dialog?.id?.startsWith('train-briefing-'))Briefing.chooseTrainBriefing(s,id,campContext(s,ctx));
  else if(s.dialog?.id?.startsWith('train-prepare-'))Preparation.chooseTrainPreparation(s,id,campContext(s,ctx));
  else if(s.dialog?.id?.startsWith('rescue'))Rescue.chooseRescue(s,id,ctx);
  else if(s.dialog?.id?.startsWith('rival-'))Rival.chooseRival(s,id,ctx);
  return s;
}
export function stepTrain(s,dt,input={},ctx){
  const r=record(s);if(!active(s)||r.train.runtimeVersion!==1||s.dialog||s.failure||!Number.isFinite(dt)||dt<=0)return s;dt=Math.min(dt,.1);
  const stationary=s.region==='snowbound'?Object.values(s.entities).filter(a=>a.category==='npc'&&a.regionId==='snowbound'&&a.hp>0&&!a.dead&&(a.z||0)===0&&a.onGround!==false&&!a.airborne&&!a.attachment&&!a.mounted&&!a.support).map(a=>({body:a,point:position(a)})):[];
  if(s.region==='snowbound')campContext(s,ctx).prepareCampWork(s);
  s.elapsed+=dt;s.time+=dt/80;if(s.time>=24){s.time-=24;s.day++;}r.timers.elapsed+=dt;
  s.notices=s.notices.map(n=>({...n,time:n.time-dt})).filter(n=>n.time>0);
  const p=s.player,world=ctx.worldFor(s);let mx=Math.max(-1,Math.min(1,Number(input.mx)||0)),my=Math.max(-1,Math.min(1,Number(input.my)||0)),length=Math.hypot(mx,my);if(length>1){mx/=length;my/=length;}
  if(input.crouch!==undefined||p.mounted)p.crouch=!p.mounted&&!!input.crouch;
  const horse=p.mounted?s.entities[p.mountId||s.party?.mountId]:null,sprint=!!input.sprint&&!p.carrying&&(p.mounted?horse?.stamina:p.stamina)>1,speed=p.mounted?(sprint?195:125):p.carrying?50:p.crouch?60:sprint?160:105,before=position(p);
  if(p.mounted){if(typeof CampNavigation.stepPreparationMounted==='function')CampNavigation.stepPreparationMounted(s,dt,{mx,my},speed,{worldFor:ctx.worldFor});}
  else moveActor(world,p,mx*speed*dt,my*speed*dt,9);
  p.vx=(p.x-before.x)/dt;p.vy=(p.y-before.y)/dt;if(!p.mounted&&Math.hypot(p.vx,p.vy)>1)p.facing=Math.atan2(my,mx);
  const moved=Math.hypot(p.x-before.x,p.y-before.y);s.stats.distance+=moved;p.stamina=Math.max(0,Math.min(100,p.stamina+(sprint&&!p.mounted?-8:5)*dt));
  if(horse&&Number.isFinite(horse.stamina))horse.stamina=Math.max(0,Math.min(100,horse.stamina+(sprint&&moved>0?-10:4)*dt));
  p.shotTimer=Math.max(0,(p.shotTimer||0)-dt);stepTrainReload(s,'mara',dt);
  stepTrainPrelude(s,dt,clinicContext(s,ctx));
  if(r.train.briefingVersion===1)Briefing.stepTrainBriefing(s,dt,campContext(s,ctx));
  if(r.train.preparationVersion===1){
    stepPreparationCampSetup(s,dt,ctx);
    if(!p.mounted){beginPreparationCopperRecovery(s,ctx);const handled=stepPreparationCopperRecovery(s,dt,ctx);if(!handled&&typeof CampNavigation.followPreparationOwnedMount==='function')CampNavigation.followPreparationOwnedMount(s,dt,{worldFor:ctx.worldFor});}
    stepPreparationStable(s,dt,ctx);stepTrainStableCare(s,dt,ctx);Preparation.stepTrainPreparation(s,dt,campContext(s,ctx,dt));
  }
  if(r.mission.stage===0&&trainClinicComplete(s)){r.mission.stage=1;r.mission.objective=TRAIN_STAGES[1];r.train.chronicle.stageEvents.push({fromStage:0,toStage:1,at:s.elapsed,cause:'clinic-complete'});ctx.checkpoint(s,'train-clinic-complete','Separate bedside exchanges and the actual bottle setdown completed');}
  // Earlier routes can leave a terminal velocity in an inherited Save. An
  // accepted frame with unchanged free feet is stopped, regardless of that
  // old route. Moving/attached bodies retain their own controller's velocity.
  for(const {body,point}of stationary)if(s.entities[body.id]===body&&!body.attachment&&!body.mounted&&!body.support&&body.x===point.x&&body.y===point.y&&(body.z||0)===point.z){body.vx=0;body.vy=0;}
  if(r.train.preparation?.groundMotion&&!advancePreparationGroundMotion(s))throw new TypeError('Accepted native preparation ground motion could not advance');
  return s;
}
export function advanceTrainWorldWork(s,dt,ctx){if(!record(s)?.train?.powder||!Number.isFinite(dt)||dt<=0)return false;const workContext=s.region==='snowbound'?campContext(s,ctx):ctx;Powder.stepPowderWork(s,dt,workContext,{paused:false});Powder.advancePowderFuses(s,workContext,{paused:false});return true;}
export function finishTrainAcceptedFrame(s,ctx){if(active(s)&&record(s).train?.preparationVersion===1)Preparation.finalizeTrainPreparation(s,campContext(s,ctx));return s;}
export function shootTrain(s){return s;}
export function reloadTrain(s){requestTrainReload(s,'mara');return s;}
export function useTrainItem(s,id,ctx){
  if(!active(s)||s.dialog||s.failure||!Number.isInteger(s.inventory[id])||s.inventory[id]<1||s.player.hp<=0)return s;
  const p=s.player,r=record(s),healing=()=>{if(!r.mission.completed){r.performance.healingUses++;r.performance.noHealingItems=false;}};
  if(id==='tonic'){s.inventory[id]--;p.hp=Math.min(100,p.hp+55);healing();}
  else if(id==='coffee'){s.inventory[id]--;p.focus=Math.min(100,p.focus+50);}
  else if(id==='bandages'&&p.hp<100){s.inventory[id]--;p.hp=Math.min(100,p.hp+35);healing();ctx.present(s,'bandage',position(p),id,position(p),'mara',{sourceId:id});}
  else if(['meat','cookedMeat','broth','tableBroth'].includes(id)){s.inventory[id]--;p.hp=Math.min(100,p.hp+20);p.stamina=Math.min(100,p.stamina+25);healing();}
  else if(id==='oats'&&s.horse?.hp>0&&near(p,s.horse,80)){s.inventory[id]--;s.horse.stamina=100;s.horse.bond=Math.min(4,s.horse.bond+.05);}
  return s;
}
export function actionTrain(s,id,ctx){
  if(!active(s)||s.dialog||s.failure)return s;const p=s.player,w=s.weapons[p.equippedWeaponId];
  if(id==='holster'){p.holstered=true;p.armed=false;ctx.present(s,'holster',position(p),p.equippedWeaponId,position(p),'mara',{sourceId:p.equippedWeaponId});}
  else if(id.startsWith('equip:')){
    const selected=s.weapons[id.slice(6)],rack=selected?.location==='saddle'?s.entities[selected.rackMountId]:null;
    if(selected?.owner==='mara'&&(selected.location==='carried'||selected.location==='saddle'&&rack&&near(p,rack,58))&&!p.carrying&&!p.weaponAction&&!p.toolHeld){p.equippedWeaponId=selected.id;selected.location='carried';delete selected.rackMountId;p.reloadTimer=0;delete p.reloadWeaponId;p.holstered=false;p.armed=true;ctx.present(s,'equip',position(p),selected.id,{...position(p),facing:p.facing||0},'mara',{sourceId:selected.id});}
  }
  else if(id==='draw'&&w?.owner==='mara'&&w.location==='carried'&&!p.carrying&&!p.weaponAction){p.holstered=false;p.armed=true;ctx.present(s,'draw',position(p),w.id,position(p),'mara',{sourceId:w.id});}
  else if(id==='crouch'&&!p.mounted)p.crouch=true;else if(id==='stand')p.crouch=false;
  else if(id==='reload')requestTrainReload(s,'mara');else interactTrain(s,id==='mount'?'train:mount-copper':id==='dismount'?'train:dismount-copper':id,ctx);return s;
}
export function whistleTrain(s,ctx){
 const p=s.player,h=s.entities?.[s.party?.mountId];
 if(!active(s)||s.region!=='snowbound'||s.dialog||s.failure||p.mounted||h?.id!=='copper'||!h.owned||h.hp<=0||h.dead||h.hidden||h.departed||h.regionId!==s.region)return s;
 h.hitched=false;h.following=true;beginPreparationCopperRecovery(s,ctx);ctx?.notice?.(s,'Copper heard your call. Leave a clear path.');return s;
}
export function cancelTrainTransient(s){return s;}
