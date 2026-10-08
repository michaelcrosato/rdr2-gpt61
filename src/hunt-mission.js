/** A Quiet Table: physical tracking, wildlife, bow, loads and communal processing.
 * The journey owns graph, typed attachments, items, codec, checkpoints and replay.
 */
import { WILLOW_RUN_WORLD as WORLD, HUNT_CAST, HUNT_ANIMALS, HUNT_STAGES, HUNT_ITEMS, HUNT_BOW, HUNT_DIALOGUE, huntAnimalHitZones, huntBowHeading, huntBowGiftStance } from '../content/campaign/willow-run.js';
import { SNOWBOUND_WORLD } from '../content/campaign/snowbound.js';
import { NORTH_CUTTING_WORLD } from '../content/campaign/north-cutting.js';
export { WILLOW_RUN_WORLD, WILLOW_WORLD, HUNT_ITEMS } from '../content/campaign/willow-run.js';
export const HUNT_ID = 'snowbound-a-quiet-table';
export const HUNT_ENTITY_IDS = [...HUNT_CAST.map(a => a.id), ...HUNT_ANIMALS.map(a => a.id)];
export const HUNT_PREY_IDS = ['willow-creek-doe', 'willow-cedar-buck'];
const RESCUE_ID = 'snowbound-a-voice-under-ice';
const HIDE_IDS = ['hunt-hide-doe', 'hunt-hide-buck'];
const clone = v => JSON.parse(JSON.stringify(v));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const z = a => a?.z || 0;
const point = a => ({x:a.x,y:a.y,z:z(a)});
const floorPoint = a => ({...a,z:a?.groundZ || 0});
const near = (a,b,radius=55) => !!a && !!b && Math.abs(z(a)-z(b))<6 && dist(a,b)<=radius;
const rec = s => s.campaign.missions[HUNT_ID];
const active = s => s.campaign.activeMissionId===HUNT_ID;
const body = (s,ctx,id) => ctx.entity(s,id);
const onFoot = s => !s.player.mounted && !s.player.carrying;
const prop = id => WORLD.props.find(p=>p.id===id);
const habitat = deer => WORLD.habitats.find(h=>h.animalId===deer.id);
const ins = (p,r,extra=0) => p.x>r.x-extra && p.x<r.x+r.w+extra && p.y>r.y-extra && p.y<r.y+r.h+extra;
const defaults = {
  orlaMet:false,mossHeard:false,veraHeard:false,junoMet:false,mapConfirmed:false,rationGranted:false,
  bowGranted:false,bowInspected:false,bowEquipped:false,equipmentCheckpoint:false,enteredWillow:false,
  windLearned:false,mountsParked:false,hitchPending:false,trackingTaught:false,trailConfirmed:false,
  doeDead:false,fordInspected:false,rubInspected:false,buckDead:false,doeInspected:false,buckInspected:false,
  junoLoading:false,bothLoaded:false,bearSeen:false,bearAimed:false,bearFired:false,bearDetour:false,
  junoBelonging:false,campReturned:false,kitchenHitched:false,deliveredPlayer:false,deliveredJuno:false,
  hobSpoke:false,hobLeft:false,junoResting:false,knifeSecured:false,skinLesson:false,playerSkinned:false,
  orlaSkinned:false,hideHung:false,accountRead:false,hideChosen:false,cooked:false,completedNarrative:false,
  tomasOrderDiscussed:false,rationUsed:false,ciderUsed:false,
};
export function createHuntRecord() {
  return {
    status:'locked',sourceRequirementId:'campaign-the-aftermath-of-genesis',retryCount:0,checkpointId:null,
    mission:{id:HUNT_ID,name:'A Quiet Table',stage:0,stageCount:11,completed:false,rewardPaid:false,objective:HUNT_STAGES[0]},
    flags:{...defaults,trailIndex:0,searchIndex:0,secondIndex:0,returnIndex:0,detourIndex:0,junoLoadIndex:0,deliveryIndex:0,hobRouteIndex:0},
    timers:{abandonment:0,rest:0,noise:0,bowReminder:0,bear:0,junoHand:0},
    performance:{arrowsReleased:0,arrowMisses:0,arrowHits:0,gunShots:0,deerKilled:0,oneArrowEach:false,noSpook:false,secondCleanKill:false,eligible:true},
    transactions:{},choices:{hide:null,order:null,bear:null},
    hunt:{playerCarcassId:HUNT_PREY_IDS[0],companionCarcassId:HUNT_PREY_IDS[1],fieldKnifeId:null,junoTrust:0,junoCarryDistance:0,rivalAtReturn:false,skills:{tracking:false,fieldSkinning:false}},
    tracks:{inspected:{'split-hoof':false,'cropped-stems':false,'false-fork':false,'ford-hoof':false,'cedar-rub':false},
      samples:Object.fromEntries(WORLD.habitats.filter(h=>HUNT_PREY_IDS.includes(h.animalId)).map(h=>[h.animalId,h.initialTracks.map((p,n)=>({...p,z:0,id:`${h.animalId}:initial-${n}`,kind:'hoof',age:0}))])),
      lastConfirmed:null,overlay:false,overlayTimer:0,wrongFork:0,noise:[],sampleSerial:0},
    bow:{weaponId:HUNT_BOW.id,drawing:false,age:0,charge:0,sway:0,aim:{x:0,y:0,z:23},serial:0,arrows:[],canceled:0,fatigueWarned:false},
    processing:{player:null,orla:null,cook:null},
  };
}
function emit(s,ctx,kind,target,targetId,from=s.player,actorId='mara',sourceId=from?.id||actorId) {
  ctx.present(s,kind,target,targetId,{...point(from),facing:from.facing||0},actorId,{sourceId});
}
function tx(s,id,amount,apply) {
  const r=rec(s),key=`${HUNT_ID}:${id}`;
  if(r.transactions[key]) return false;
  if(apply()===false) return false;
  r.transactions[key]={amount,completed:true}; return true;
}
function consume(s,id,n=1) {if((s.inventory[id]||0)<n)return false;s.inventory[id]-=n;return true;}
function item(s,ctx,id) {return ctx.itemInstance(s,id);}
function pantry(s) {return s.camp.pantry ||= {rawVenison:0,tableBroth:0,kitchenStarterFuel:0,warmCider:0};}
function knife(s) {return Object.values(s.itemInstances||{}).find(i=>i.kind==='field-knife'&&i.owner==='mara');}
function cargo(s,mountId) {return Object.values(s.entities).find(a=>a.attachment?.type==='large-load'&&a.attachment.targetId===mountId);}
function usable(deer) {return !!deer&&deer.hp===0&&deer.dead===true&&!deer.processed&&deer.hunt?.life==='dead'&&deer.hunt.carcassCondition>0;}
function objective(s) {
  const r=rec(s),f=r.flags;
  r.mission.objective=r.mission.completed?'The table has fresh food. Juno’s bow is yours; patients still need care. The rival investigation has its own unfinished work.':r.mission.stage===0&&!f.mossHeard?'Speak with Moss about the failed hunt.':r.mission.stage===0&&!f.veraHeard?'Hear Vera’s separate account, then find Juno.':HUNT_STAGES[r.mission.stage];
}
function advance(s,ctx,stage,id=null,label='') {
  const r=rec(s);if(stage<=r.mission.stage)return;
  r.mission.stage=stage;objective(s);if(id)ctx.checkpoint(s,id,label);
}
export function ensureHuntCast(s,ctx) {
  const r=rec(s);if(!r||r.status==='locked')return s;
  for(const a of HUNT_CAST) {const copy={vx:0,vy:0,facing:0,...clone(a)};delete copy.largeLoad;ctx.addEntity(s,copy,a.regionId,a.id==='bracken'?'mount':'npc');}
  for(const a of HUNT_ANIMALS) {
    const deer=a.kind==='deer';
    const copy={vx:0,vy:0,...clone(a),dead:false,hunt:deer?{life:'alive',quality:a.quality,alert:0,spookedEver:false,arrowImpacts:0,gunImpacts:0,cleanKill:false,deathMethod:null,woundTimer:0,bleedTimer:0,habitatIndex:0,routineIndex:habitat(a).routine.reduce((best,p,i,points)=>dist(a,p)<dist(a,points[best])?i:best,0),relocations:0,pose:a.phase,poseTimer:0,carcassCondition:100,meatYield:6,lastTrack:point(a)}:null};
    if(deer){delete copy.quality;delete copy.alert;}
    ctx.addEntity(s,copy,a.regionId,'animal');
  }
  return s;
}
function offer(list,s,id,label,target,radius=55,priority=2,targetId=target?.id||id) {
  if(!target||!near(s.player,floorPoint(target),radius))return;
  list.push({id,label,targetId,...point(target),distance:dist(s.player,target),priority});
}
function weaponReachable(s,w) {return w&&(w.location==='carried'||w.location==='saddle'&&near(s.player,s.entities[w.rackMountId],58));}
function ready(s) {return active(s)&&!s.failure&&!s.dialog&&!rec(s).processing.player;}
function ownedHide(s,ctx) {return item(s,ctx,HIDE_IDS[HUNT_PREY_IDS.indexOf(rec(s).hunt.playerCarcassId)]);}
export function getHuntInteractions(s,ctx) {
  const r=rec(s),list=[];if(!r||r.status==='locked'||s.failure||s.dialog)return list;
  ensureHuntCast(s,ctx);
  const f=r.flags,p=s.player,j=body(s,ctx,'juno'),bracken=body(s,ctx,'bracken'),orla=body(s,ctx,'orla');
  if(!active(s)) {
    if(s.region==='snowbound'&&r.status==='unstarted'&&s.campaign.missions[RESCUE_ID]?.mission.completed) {
      offer(list,s,'talk:orla','Speak with Orla about fresh food',orla,70,-2);
      if(f.orlaMet&&!f.mossHeard)offer(list,s,'talk:moss-hunt','Hear Moss’s failed-hunt account',body(s,ctx,'moss'),70,-3);
      if(f.orlaMet&&!f.veraHeard)offer(list,s,'talk:vera-hunt','Hear Vera’s different account',body(s,ctx,'vera'),70,-3);
      if(f.mossHeard&&f.veraHeard)offer(list,s,'talk:juno','Ask Juno about the sheltered route',j,70,-3);
    }
    return list.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
  }
  if(r.mission.completed) {
    if(s.region==='snowbound') {
      for(const [id,label]of[['orla','Ask about the shared table'],['juno','Speak with Juno about staying'],['hob','Ask Hob about the kitchen'],['della','Read the hide and food account']])offer(list,s,`hunt-aftermath:${id}`,label,body(s,ctx,id),65,2);
      const hide=ownedHide(s,ctx);if(hide?.owner==='mara'&&hide.location.type==='drying-rack')offer(list,s,'take:retained-hide','Take your retained hide from the rack',WORLD.camp.hideRack,48,-2);
      if(hide?.owner==='mara'&&hide.location.type==='carried'&&near(p,s.horse,55))offer(list,s,'store:retained-hide','Store your retained hide on Copper',s.horse,55,1);
    }
  } else {
    const stage=r.mission.stage;
    if(stage===0){
      for(const [id,label,target]of[['talk:orla','Hear Orla’s food plan again',orla],['talk:moss-hunt','Hear Moss’s failed-hunt account',body(s,ctx,'moss')],['talk:vera-hunt','Hear Vera’s different account',body(s,ctx,'vera')],['talk:juno','Discuss the sheltered route with Juno',j]])offer(list,s,id,label,target,70,1);
      offer(list,s,'accept:hunt','Confirm the sheltered route at the flour map',WORLD.camp.flourMap,55,-2);
    }
    if(stage===1&&s.region==='snowbound') {
      if(f.bowGranted&&s.weapons[HUNT_BOW.id]?.location==='saddle'&&!f.bowInspected)offer(list,s,'rack:inspect-bow','Inspect Juno’s bow and twenty-two arrows',s.horse,58,-2);
      else if(f.bowGranted&&f.bowInspected&&!f.bowEquipped)offer(list,s,'equip:ash-bow','Retrieve and equip Juno’s ash bow',s.horse,58,-2);
      if(f.bowEquipped&&p.mounted&&j.mounted&&near(j,p,140))offer(list,s,'depart:willow','Take the Willow branch with Juno',WORLD.travelGate,65,-2);
      offer(list,s,'ask:bow-again','Ask Juno to wait while you prepare',j,70,6);
    }
    if(stage===2&&s.region===WORLD.id) {
      if(f.trailIndex>=WORLD.trail.length&&!f.windLearned)offer(list,s,'lesson:wind','Learn the breeze at the sheltered bank',WORLD.shelter,70,-2);
      if(f.windLearned&&!f.mountsParked&&!p.mounted)offer(list,s,'hitch:bank','Park Copper and Bracken before tracking',WORLD.hitch,65,-2);
      if(!p.mounted)offer(list,s,'rest:bank','Rest under the sheltered bank',WORLD.shelter,75,4);
    }
    if(stage===3&&onFoot(s)) {
      for(const id of ['split-hoof','cropped-stems'])if(!r.tracks.inspected[id])offer(list,s,`inspect:${id}`,id==='split-hoof'?'Inspect the split hoof in fresh mud':'Inspect the cropped willow stems',prop(id),42,-2);
      offer(list,s,'inspect:false-fork','Check the old frozen fork',prop('false-fork'),42,2);
      if(r.tracks.inspected['split-hoof']&&r.tracks.inspected['cropped-stems'])offer(list,s,'confirm:reed-trail','Follow the fresh sign toward the reed pool',WORLD.searchRoute.at(-1),65,-2);
    }
    if(stage>=3&&stage<=5&&onFoot(s)) {
      offer(list,s,'read-signs',r.tracks.overlay?'Let the sign overlay fade':'Read signs along the current wildlife trail',p,1,8);
      const bow=s.weapons[HUNT_BOW.id];if(bow?.location==='saddle')offer(list,s,'rack:retrieve-bow','Retrieve the stored bow; Juno is waiting',s.horse,58,-3);
      if(stage===5)for(const [id,label]of[['ford-hoof','Read the hoofprints beyond the shallow crossing'],['cedar-rub','Inspect the cedar rubbing']])if(!r.tracks.inspected[id])offer(list,s,`inspect:${id}`,label,prop(id),45,-2);
      const prey=body(s,ctx,HUNT_PREY_IDS[stage===5?1:0]);
      if(prey.hunt.life==='wounded'&&near(p,prey,28))offer(list,s,`finish:${prey.id}`,'Finish the wounded deer humanely',prey,28,-3);
      for(const a of r.bow.arrows)if(a.phase==='ground'&&a.regionId===s.region)offer(list,s,`recover:${a.id}`,'Recover the fallen field arrow',a,30,-3);
    }
    if(stage===6&&onFoot(s)) {
      for(const id of HUNT_PREY_IDS) {
        const d=body(s,ctx,id),which=id===HUNT_PREY_IDS[0]?'doe':'buck';
        if(usable(d)&&!d.attachment) {
          if(!f[`${which}Inspected`])offer(list,s,`inspect:${which}-body`,`Inspect the ${which}’s body and shot quality`,d,42,-2);
          else offer(list,s,`carry:${id}`,`Lift the ${which} onto your shoulder`,d,38,-2);
          if(r.bow.arrows.some(a=>a.phase==='embedded'&&a.targetId===id))offer(list,s,`recover:body:${id}`,'Recover the reachable arrow from the carcass',d,38,-3);
        }
      }
      if(!f.junoLoading&&usable(body(s,ctx,r.hunt.companionCarcassId)))offer(list,s,'juno:load-bracken','Ask Juno to carry her separate load',j,75,1);
    }
    if(stage===6&&p.carrying&&HUNT_PREY_IDS.includes(p.carrying))offer(list,s,'load:copper','Secure this carcass on Copper’s rear slot',s.horse,55,-2);
    if(stage===7) {
      if(f.bearSeen&&!f.junoBelonging&&f.bearDetour)offer(list,s,'talk:juno-return','Talk with Juno on the sheltered hillside',j,80,-2);
      if(f.junoBelonging)offer(list,s,'talk:juno-topics','Ask Juno about losses, the road and the mounts',j,80,2);
      if(f.junoBelonging&&p.mounted)offer(list,s,'return:kitchen','Return to Orla’s drying shed',WORLD.entry,65,-2);
    }
    if(stage===8&&s.region==='snowbound') {
      if(!f.kitchenHitched)offer(list,s,'hitch:kitchen','Hitch the loaded mounts beside the kitchen',WORLD.camp.hitch,75,-2);
      if(f.kitchenHitched&&!p.mounted&&!f.deliveredPlayer&&!p.carrying)offer(list,s,'unload:copper','Lift Copper’s carcass from the rear slot',s.horse,48,-2);
      if(p.carrying===r.hunt.playerCarcassId)offer(list,s,'deliver:bench-mara','Place your deer on Orla’s first bench',WORLD.camp.benchMara,55,-2);
      if(f.deliveredPlayer&&!f.hobSpoke)offer(list,s,'talk:hob','Hear Hob claim credit for the route',body(s,ctx,'hob'),65,-2);
      if(f.deliveredPlayer&&!f.ciderUsed)offer(list,s,'drink:cider','Accept Orla’s optional warm cider',orla,65,3);
      if(f.deliveredJuno)offer(list,s,'rest:juno-hand','Let Juno rest her wrapped hand',j,65,3);
    }
    if(stage===9&&onFoot(s)) {
      if(!f.knifeSecured)offer(list,s,'take:field-knife','Take the available field skinning knife',WORLD.camp.knife,45,-2);
      else if(!f.playerSkinned&&!r.processing.player)offer(list,s,'skin:bench-mara','Skin your deer with Orla’s help',WORLD.camp.benchMara,55,-2);
    }
    if(stage===10&&onFoot(s)) {
      const hide=ownedHide(s,ctx);
      if(!f.hideHung&&hide?.location.type==='bench')offer(list,s,'take:hide','Lift your finished hide from the bench',WORLD.camp.benchMara,50,-2);
      if(!f.hideHung&&hide?.location.type==='carried')offer(list,s,'hang:hide','Hang the hide on the drying rack',WORLD.camp.hideRack,48,-2);
      if(f.hideHung&&!f.hideChosen)offer(list,s,'talk:della-yields','Read Della’s exact yield and ownership account',body(s,ctx,'della'),70,-2);
      if(f.hideChosen&&!f.cooked&&!r.processing.cook)offer(list,s,'cook:broth','Begin broth from the counted venison',WORLD.camp.stove,50,-2);
      if(f.cooked)offer(list,s,'finish:hunt','Share the meal and close the hunt’s account',orla,70,-2);
      if(!f.tomasOrderDiscussed)offer(list,s,'talk:tomas-order','Ask Tomas which work remains',body(s,ctx,'tomas'),70,3);
    }
  }
  if(!r.processing.player&&!p.carrying) {
    if(p.mounted)offer(list,s,'dismount','Dismount Copper',s.horse,40,5);
    else if(!r.flags.mountsParked||r.mission.stage>=6||r.mission.completed)offer(list,s,'mount','Mount Copper',s.horse,58,5);
  }
  return list.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
}
function say(s,ctx,id,entry,choices=[['leave','Continue.']]) {ctx.talk(s,id,entry.speaker,entry.text,choices);}
function summon(s,ctx,id,target) {const a=body(s,ctx,id);if(!a)return;a.goal=point(target);a.route=[];delete a.routeTarget;}
function giftKitchen(s) {
  tx(s,'grant:quiet-ration',1,()=>{s.inventory.quietRation=(s.inventory.quietRation||0)+1;});
  tx(s,'grant:kitchen-fuel',1,()=>{pantry(s).kitchenStarterFuel++;});
  tx(s,'grant:kitchen-cider',1,()=>{pantry(s).warmCider++;});
  rec(s).flags.rationGranted=true;
}
function giftBow(s,ctx) {
  const r=rec(s);
  tx(s,'grant:ash-bow',1,()=>{if(s.weapons[HUNT_BOW.id])return false;s.weapons[HUNT_BOW.id]={...HUNT_BOW,capacity:1,ammo:0,reserve:0,ammoType:'arrow',loanMissionId:null,location:'saddle',rackMountId:s.horse.id};});
  tx(s,'grant:field-arrows',22,()=>{const w=s.weapons[HUNT_BOW.id];if(!w)return false;w.ammo=1;w.reserve=21;});
  r.flags.bowGranted=true;r.timers.junoHand=1.25;emit(s,ctx,'give-bow',s.horse,HUNT_BOW.id,body(s,ctx,'juno'),'juno',s.horse.id);
  ctx.notice(s,'Juno has brought the ash bow and twenty-two separate arrows to Copper’s rack.');
}
function floorBody(s,ctx,actor) {return actor.attachment?floorPoint(actor.attachment.type==='rest'?WORLD.camp.props.find(p=>p.id===actor.attachment.targetId):body(s,ctx,actor.attachment.targetId)):floorPoint(actor);}
function liftCarcass(s,ctx,id,carrierId,kind='lift') {
  const d=body(s,ctx,id),carrier=body(s,ctx,carrierId);if(!usable(d)||!carrier||carrier.mounted||carrier.carrying||!near(carrier,floorBody(s,ctx,d),60))return false;
  const sourceId=d.attachment?.targetId||d.id,from=point(d);
  if(!ctx.setAttachment(s,id,{type:'carried',targetId:carrierId}))return false;
  emit(s,ctx,kind,carrier,id,from,carrierId,sourceId);return true;
}
function attachLoad(s,ctx,id,mountId,carrierId) {
  const d=body(s,ctx,id),m=body(s,ctx,mountId),a=body(s,ctx,carrierId);
  if(!usable(d)||d.attachment?.type!=='carried'||d.attachment.targetId!==carrierId||cargo(s,mountId)||!near(a,m,60))return false;
  const from=point(a);if(!ctx.setAttachment(s,id,{type:'large-load',targetId:mountId,slot:'rear'}))return false;
  tx(s,`load:${mountId}:${id}`,1,()=>{});emit(s,ctx,'load',m,id,from,carrierId,carrierId);return true;
}
function deliverCarcass(s,ctx,id,carrierId,bench) {
  const d=body(s,ctx,id),a=body(s,ctx,carrierId);if(!usable(d)||d.attachment?.type!=='carried'||d.attachment.targetId!==carrierId||!near(a,floorPoint(bench),60))return false;
  const from=point(a);if(!ctx.setAttachment(s,id,{type:'rest',targetId:bench.id,regionId:'snowbound'}))return false;
  tx(s,`deliver:${bench.id}:${id}`,1,()=>{});emit(s,ctx,'deliver',bench,id,from,carrierId,carrierId);return true;
}
function equipBow(s,ctx) {
  const r=rec(s),w=s.weapons[HUNT_BOW.id];if(!weaponReachable(s,w)||s.player.carrying)return false;
  w.location='carried';delete w.rackMountId;s.player.equippedWeaponId=w.id;s.player.holstered=false;s.player.armed=true;s.player.reloadTimer=0;delete s.player.reloadWeaponId;
  r.flags.bowEquipped=true;emit(s,ctx,'equip',s.horse,w.id,s.player,'mara',s.horse.id);return true;
}
function recoverArrow(s,ctx,a) {
  if(!a||!['ground','embedded'].includes(a.phase)||s.player.carrying)return false;
  const target=a.phase==='embedded'?body(s,ctx,a.targetId):a;
  if(!near(s.player,floorPoint(target),38)||a.phase==='embedded'&&!usable(target))return false;
  return tx(s,`recover:${a.id}`,1,()=>{a.phase='recovered';s.weapons[HUNT_BOW.id].reserve++;emit(s,ctx,'pickup-arrow',target,a.id);});
}
export function interactHunt(s,requestedId=null,ctx) {
  const offered=getHuntInteractions(s,ctx),hit=requestedId?offered.find(o=>o.id===requestedId):offered[0];
  if(!hit){ctx.notice(s,'Move closer to the actual task and finish its preceding work.');return s;}
  cancelHuntDraw(s,ctx);
  const id=hit.id,r=rec(s),f=r.flags,j=body(s,ctx,'juno'),bracken=body(s,ctx,'bracken');
  if(id==='talk:orla') {f.orlaMet=true;say(s,ctx,'hunt-orla',HUNT_DIALOGUE.orlaOpening,[['ask-pantry','Read the actual pantry stock.'],['ask-hunters','I will hear both accounts.'],['leave','Give me a moment.']]);}
  else if(id==='talk:moss-hunt') {f.mossHeard=true;say(s,ctx,'hunt-moss',HUNT_DIALOGUE.mossAccount);}
  else if(id==='talk:vera-hunt') {f.veraHeard=true;say(s,ctx,'hunt-vera',HUNT_DIALOGUE.veraAccount);}
  else if(id==='talk:juno') {f.junoMet=true;say(s,ctx,'hunt-juno-invitation',HUNT_DIALOGUE.junoInvitation,[['accept-hunt','Meet me at Orla’s flour map.'],['leave','I need a moment first.']]);}
  else if(id==='accept:hunt') {
    if(!f.mossHeard||!f.veraHeard||!f.junoMet||!near(j,floorPoint(WORLD.camp.flourMap),70)){ctx.notice(s,'Juno is coming through the kitchen doorway. Confirm the route with her at the map.');return s;}
    f.mapConfirmed=true;ctx.checkpoint(s,'accepted-table','Expedition agreed before any gift');giftKitchen(s);
    summon(s,ctx,'juno',huntBowGiftStance(s.horse));advance(s,ctx,1);ctx.log(s,'Orla’s pantry stayed intact. Moss and Vera gave separate accounts; Juno and Mara chose the sheltered route.');
  } else if(id==='rack:inspect-bow') {f.bowInspected=true;say(s,ctx,'hunt-bow-gift',HUNT_DIALOGUE.bowGift);}
  else if(id==='equip:ash-bow'||id==='rack:retrieve-bow') {if(equipBow(s,ctx)&&!f.equipmentCheckpoint){f.equipmentCheckpoint=true;ctx.checkpoint(s,'equipment-secured','Owned bow retrieved from Copper’s actual rack');}ctx.notice(s,'Hold to draw, aim at the animal’s actual body, release to loose; cancel leaves the arrow unspent.');}
  else if(id==='depart:willow') {
    if(!j.mounted||!s.player.mounted||!near(j,s.player,140)||!s.weapons[HUNT_BOW.id])return s;
    if(ctx.transition(s,WORLD.id,['mara',s.horse.id,'juno','bracken'],{mara:point(WORLD.entry),[s.horse.id]:point(WORLD.entry),juno:{x:WORLD.entry.x+45,y:WORLD.entry.y+30,z:0},bracken:{x:WORLD.entry.x+45,y:WORLD.entry.y+30,z:0}})){f.enteredWillow=true;advance(s,ctx,2);}
  } else if(id==='lesson:wind') {f.windLearned=true;emit(s,ctx,'wind-lesson',prop('wind-ribbon'),'wind-ribbon',j,'juno');say(s,ctx,'hunt-wind',HUNT_DIALOGUE.windLesson);}
  else if(id==='hitch:bank') {
    if(j.mounted&&!safeDismount(s,ctx,j,bracken))return s;
    s.horse.following=false;f.hitchPending=true;summon(s,ctx,s.horse.id,WORLD.mountParking.copper);summon(s,ctx,'bracken',WORLD.mountParking.bracken);j.crouch=true;
  } else if(id==='rest:bank') {r.timers.rest=3.5;emit(s,ctx,'rest',s.player,'bank-rest');ctx.notice(s,'The bank shelters your hands and the mounts.');}
  else if(id.startsWith('inspect:')&&id.endsWith('-body')) {const which=id.includes('doe')?'doe':'buck',d=body(s,ctx,HUNT_PREY_IDS[which==='doe'?0:1]);f[`${which}Inspected`]=true;ctx.notice(s,`${d.name}: ${d.hunt.quality}/3 hide; ${d.hunt.cleanKill?'immediate vital death':d.hunt.deathMethod==='bleedout'?'died from the wound':'other lethal outcome'}. The carcass is still whole.`);emit(s,ctx,'inspect-body',d,d.id);}
  else if(id.startsWith('inspect:')) {
    const clue=id.slice(8);r.tracks.inspected[clue]=true;const target=prop(clue);
    r.tracks.lastConfirmed={id:clue,animalId:target.animalId||null,...point(target)};
    if(clue==='false-fork'){r.tracks.wrongFork++;say(s,ctx,'hunt-wrong-fork',HUNT_DIALOGUE.wrongFork);}
    else {if(clue==='ford-hoof')f.fordInspected=true;if(clue==='cedar-rub')f.rubInspected=true;ctx.notice(s,clue==='ford-hoof'?'The water broke the footprints; fresh mud on the far bank continues toward cedar.':'This sign belongs to the animal’s actual route.');emit(s,ctx,'inspect-sign',target,clue);}
  } else if(id==='confirm:reed-trail') {if(!r.tracks.inspected['split-hoof']||!r.tracks.inspected['cropped-stems'])return s;f.trailConfirmed=true;f.trackingTaught=true;r.hunt.skills.tracking=true;advance(s,ctx,4,'reed-trail-confirmed','Fresh physical sign followed to the reed pool');ctx.notice(s,'Juno: “Stay in the screen, let the breeze miss the bank, and take time to draw.”');}
  else if(id==='read-signs') {r.tracks.overlay=!r.tracks.overlay;r.tracks.overlayTimer=r.tracks.overlay?10:0;emit(s,ctx,'read-signs',s.player,'tracks');}
  else if(id.startsWith('finish:')&&HUNT_PREY_IDS.includes(id.slice(7)))humaneFinish(s,ctx,id.slice(7));
  else if(id.startsWith('recover:body:')){const a=r.bow.arrows.find(a=>a.phase==='embedded'&&a.targetId===id.slice(13));recoverArrow(s,ctx,a);}
  else if(id.startsWith('recover:'))recoverArrow(s,ctx,r.bow.arrows.find(a=>a.id===id.slice(8)));
  else if(id.startsWith('carry:')) {
    const preyId=id.slice(6);if(!f.junoLoading&&!cargo(s,s.horse.id)){r.hunt.playerCarcassId=preyId;r.hunt.companionCarcassId=HUNT_PREY_IDS.find(i=>i!==preyId);}
    if(preyId===r.hunt.playerCarcassId)liftCarcass(s,ctx,preyId,'mara');
  } else if(id==='load:copper')attachLoad(s,ctx,s.player.carrying,s.horse.id,'mara');
  else if(id==='juno:load-bracken') {f.junoLoading=true;summon(s,ctx,'juno',floorBody(s,ctx,body(s,ctx,r.hunt.companionCarcassId)));say(s,ctx,'hunt-load-lesson',HUNT_DIALOGUE.loadLesson);}
  else if(id==='talk:juno-return') {
    const rival=ctx.rivalAftermath?.(s)||null;r.hunt.rivalAtReturn=!!ctx.requirementComplete?.(s,'campaign-old-friends');r.choices.order=r.hunt.rivalAtReturn?'rival-first':'hunt-first';
    const operation=rival?` ${rival.operationName||'The freight-office operation'} and ${rival.captiveId&&rival.captiveId!=='pavel'?body(s,ctx,rival.captiveId)?.name||'its separately recorded captive':'its actual promises'} still need a fair account.`:' The freight office remains separate unfinished work; Pavel’s station fate stays where it belongs.';
    f.junoBelonging=true;r.hunt.junoTrust++;say(s,ctx,'hunt-return-belonging',{...HUNT_DIALOGUE.returnBelonging,text:HUNT_DIALOGUE.returnBelonging.text+operation},[['ask-losses','Talk about the people lost on the escape.'],['ask-road','Ask about moving camp when the road clears.'],['ask-mounts','Ask about Copper, Bracken and trusting the organizer.'],['leave','Keep both loads together on the road.']]);ctx.checkpoint(s,'safe-hillside','Loaded party beyond the bear gorge');
  } else if(id==='talk:juno-topics') {
    say(s,ctx,'hunt-return-belonging',HUNT_DIALOGUE.returnBelonging,[['ask-losses','Talk about the people lost on the escape.'],['ask-road','Ask about moving camp when the road clears.'],['ask-mounts','Ask about Copper, Bracken and trusting the organizer.'],['leave','Keep both loads together on the road.']]);
  } else if(id==='return:kitchen') {
    if(!s.player.mounted||!near(j,s.player,160)||!f.junoBelonging||!cargo(s,s.horse.id)||!cargo(s,'bracken'))return s;
    if(ctx.transition(s,'snowbound',['mara',s.horse.id,'juno','bracken',r.hunt.playerCarcassId,r.hunt.companionCarcassId],{mara:point(WORLD.camp.gate),[s.horse.id]:point(WORLD.camp.gate),juno:{x:765,y:790,z:0},bracken:{x:765,y:790,z:0}})){f.campReturned=true;advance(s,ctx,8);}
  } else if(id==='hitch:kitchen') {
    if(s.player.mounted&&!safeDismount(s,ctx,s.player,s.horse))return s;
    if(j.mounted&&!safeDismount(s,ctx,j,bracken))return s;
    f.hitchPending=true;s.horse.following=false;summon(s,ctx,s.horse.id,WORLD.camp.mountParking.copper);summon(s,ctx,'bracken',WORLD.camp.mountParking.bracken);
  } else if(id==='unload:copper') {
    const d=cargo(s,s.horse.id);if(d&&d.id===r.hunt.playerCarcassId&&liftCarcass(s,ctx,d.id,'mara','unload'))tx(s,`unload:copper:${d.id}`,1,()=>{});
  } else if(id==='deliver:bench-mara') {if(deliverCarcass(s,ctx,r.hunt.playerCarcassId,'mara',WORLD.camp.benchMara)){f.deliveredPlayer=true;summon(s,ctx,'orla',{x:175,y:1265,z:0});}}
  else if(id==='talk:hob') {f.hobSpoke=true;r.flags.hobRouteIndex=0;say(s,ctx,'hunt-hob',HUNT_DIALOGUE.hobBanter);}
  else if(id==='drink:cider')useHuntItem(s,'warmCider',ctx);
  else if(id==='rest:juno-hand') {summon(s,ctx,'juno',WORLD.camp.handRest);ctx.notice(s,'Juno rests the fingers she could not use on the bow or knife.');}
  else if(id==='take:field-knife') {
    let k=knife(s);if(!k){tx(s,'grant:field-knife',1,()=>{k=ctx.addItemInstance(s,{id:'field-knife',kind:'field-knife',sourceEntityId:'kitchen-knife',quality:1,owner:'mara',location:{type:'carried',targetId:'mara'}});return !!k;});}
    if(k){r.hunt.fieldKnifeId=k.id;f.knifeSecured=true;emit(s,ctx,'take-knife',WORLD.camp.knife,k.id);}
  } else if(id==='skin:bench-mara') {if(beginSkin(s,ctx,'mara',r.hunt.playerCarcassId,WORLD.camp.benchMara)){f.skinLesson=true;ctx.notice(s,HUNT_DIALOGUE.skinLesson.text);}}
  else if(id==='take:hide') {const h=ownedHide(s,ctx);if(h&&ctx.moveItemInstance(s,h.id,{type:'carried',targetId:'mara'}))emit(s,ctx,'lift-hide',s.player,h.id,WORLD.camp.benchMara,'mara',WORLD.camp.benchMara.id);}
  else if(id==='hang:hide') {const h=ownedHide(s,ctx);if(h&&h.location.type==='carried'&&ctx.moveItemInstance(s,h.id,{type:'drying-rack',targetId:WORLD.camp.hideRack.id,regionId:'snowbound'})){tx(s,`hang:${h.id}`,1,()=>{});f.hideHung=true;emit(s,ctx,'hang-hide',WORLD.camp.hideRack,h.id);}}
  else if(id==='talk:della-yields') {f.accountRead=true;const stock=pantry(s);say(s,ctx,'hunt-yield-account',{...HUNT_DIALOGUE.account,text:`${HUNT_DIALOGUE.account.text} This hunt produced twelve venison portions; the pantry currently holds ${stock.rawVenison} raw portions and ${stock.tableBroth} cooked broth portions.`},[['retain-hide','Keep my hide for later trade.'],['donate-hide','Give my hide to the community.'],['leave','Read the account again before choosing.']]);}
  else if(id==='cook:broth') {if(pantry(s).rawVenison<2||pantry(s).kitchenStarterFuel<1){ctx.notice(s,'Orla needs two counted raw portions and one kitchen split; no old kindling will be invented.');return s;}r.processing.cook={kind:'cook',actorId:'orla',targetId:WORLD.camp.stove.id,age:0,duration:5,progress:0};summon(s,ctx,'orla',WORLD.camp.workpoints.cook);}
  else if(id==='finish:hunt')completeHunt(s,ctx);
  else if(id==='talk:tomas-order') {f.tomasOrderDiscussed=true;const done=ctx.requirementComplete?.(s,'campaign-old-friends');say(s,ctx,'hunt-tomas-order',done?HUNT_DIALOGUE.rivalAfter:HUNT_DIALOGUE.rivalBefore);}
  else if(id==='ask:bow-again')say(s,ctx,'hunt-bow-reminder',{speaker:'Juno Mercier',text:'I can wait at the hitch. The bow stays on Copper’s actual rack until you retrieve it; no one is leaving without both mounts.'});
  else if(id==='mount')safeMount(s,ctx,s.player,s.horse);
  else if(id==='dismount')safeDismount(s,ctx,s.player,s.horse);
  else if(id==='take:retained-hide') {const h=ownedHide(s,ctx);if(h?.owner==='mara'&&ctx.moveItemInstance(s,h.id,{type:'carried',targetId:'mara'}))emit(s,ctx,'lift-hide',s.player,h.id,WORLD.camp.hideRack,'mara',WORLD.camp.hideRack.id);}
  else if(id==='store:retained-hide') {const h=ownedHide(s,ctx);if(h?.owner==='mara'&&ctx.moveItemInstance(s,h.id,{type:'saddle',targetId:s.horse.id}))emit(s,ctx,'store-hide',s.horse,h.id,s.player,'mara','mara');}
  else if(id.startsWith('hunt-aftermath:')) {const a=body(s,ctx,id.slice(15));say(s,ctx,`hunt-aftermath-${a.id}`,{speaker:a.name,text:a.id==='juno'?'My hand is still healing. My voice belongs at this table, and the bow is yours.':a.id==='orla'?`The food account is real: ${pantry(s).rawVenison} raw venison and ${pantry(s).tableBroth} fresh broth portions. We kept the preserved supplies.`:a.id==='hob'?'The boots are repaired. I am still avoiding that broom.':'A hide owned by the community cannot also be sold from Mara’s satchel. Retained ownership remains written on its own instance.'});}
  objective(s);return s;
}
export function chooseHunt(s,id,ctx) {
  const d=s.dialog,r=rec(s);if(!d||!d.choices.some(c=>c.id===id))return s;
  if(id==='leave'){s.dialog=null;return s;}
  if(id==='ask-pantry') {const p=pantry(s);say(s,ctx,'hunt-pantry',{speaker:'Orla Venn',text:`The existing store has ${s.camp.food} food portions, ${s.camp.medicine} medicine and ${s.camp.materials} repair materials. It currently includes ${p.rawVenison} fresh venison and ${p.tableBroth} fresh broth. This expedition will add food; it will not erase the earlier supply work.`});}
  else if(id==='ask-hunters') {s.dialog=null;ctx.notice(s,'Moss and Vera are both at the kiln. Hear each before asking Juno for the route.');}
  else if(['ask-losses','ask-road','ask-mounts'].includes(id)&&d.id==='hunt-return-belonging'){
    const topic=id.slice(4),entry=HUNT_DIALOGUE[topic==='losses'?'returnLosses':topic==='road'?'returnRoad':'returnMounts'];
    say(s,ctx,`hunt-return-${topic}`,entry||{speaker:'Juno Mercier',text:topic==='losses'?'The dead cannot take a place at this table. Silas and Gideon still need care; our food must reach them.':topic==='road'?'A cleared road will let us move camp. This hunt does not finish the separate freight-office work.':'Copper and Bracken carried one body each. Trust in an organizer must include the people and animals doing the work.'});
  }
  else if(id==='accept-hunt'&&d.id==='hunt-juno-invitation') {
    if(!r.flags.orlaMet||!r.flags.mossHeard||!r.flags.veraHeard||!r.flags.junoMet)return s;
    s.dialog=null;if(!active(s)&&!ctx.startMission(s,HUNT_ID))return s;
    summon(s,ctx,'juno',{x:210,y:1298,z:0});ctx.checkpoint(s,'kitchen-route-prelude','Expedition prelude; no equipment or food granted');ctx.notice(s,'Meet Juno at the flour map through the drying shed’s east doorway. Gifts wait until the route is confirmed.');
  } else if(['retain-hide','donate-hide'].includes(id)&&d.id==='hunt-yield-account') {
    const h=ownedHide(s,ctx);if(!h||h.location.type!=='drying-rack'||!near(s.player,body(s,ctx,'della'),75))return s;
    const choice=id==='donate-hide'?'donate':'retain';
    tx(s,`ownership:${h.id}`,1,()=>{h.owner=choice==='donate'?'community':'mara';r.choices.hide=choice;r.flags.hideChosen=true;if(choice==='donate'){s.camp.morale=clamp(s.camp.morale+3,0,100);s.honor++;}});
    s.dialog=null;ctx.notice(s,choice==='donate'?'Your hide is a community contribution. No trade money has been awarded.':'Your hide remains yours on the drying rack; trade has not happened.');
  }
  objective(s);return s;
}
function geometry(s){return s.region===WORLD.id?WORLD:{...SNOWBOUND_WORLD,obstacles:[...SNOWBOUND_WORLD.obstacles,...NORTH_CUTTING_WORLD.camp.obstacles,...WORLD.camp.obstacles]};}
function blocked(s,x,y,radius=9){const w=geometry(s);return x<radius||y<radius||x>w.width-radius||y>w.height-radius||w.obstacles.some(o=>ins({x,y},o,radius));}
function move(s,a,dx,dy,radius=9){const old=point(a);if(!blocked(s,a.x+dx,a.y,radius))a.x+=dx;if(!blocked(s,a.x,a.y+dy,radius))a.y+=dy;return dist(old,a);}
function lineClear(s,a,b,radius=7,projectile=false){
  const w=geometry(s),n=Math.max(1,Math.ceil(dist(a,b)/5));
  for(let k=1;k<n;k++){const u=k/n,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u},height=z(a)+(z(b)-z(a))*u;
    if(w.obstacles.some(o=>ins(p,o,projectile?1:radius)&&(!projectile||!o.impassable&&height<=(o.z||0)+(o.height||35))))return false;
  }return true;
}
const navigationGrids=new Map();
function path(s,a,target,radius){
  const w=geometry(s),unit=20,cols=Math.ceil(w.width/unit),rows=Math.ceil(w.height/unit),key=`${s.region}:${radius}`;
  let grid=navigationGrids.get(key);if(!grid){grid=Array.from({length:cols*rows},(_,i)=>!blocked(s,i%cols*unit+10,Math.floor(i/cols)*unit+10,radius));navigationGrids.set(key,grid);}
  const cell=p=>clamp(Math.floor(p.y/unit),0,rows-1)*cols+clamp(Math.floor(p.x/unit),0,cols-1);
  const closest=n=>{if(grid[n])return n;let found=null,dd=Infinity;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=n%cols+dx,y=Math.floor(n/cols)+dy,id=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&grid[id]&&dx*dx+dy*dy<dd){found=id;dd=dx*dx+dy*dy;}}return found;};
  const start=closest(cell(a)),end=closest(cell(target));if(start===null||end===null)return [];
  const prev=new Int32Array(cols*rows).fill(-1),queue=[start];prev[start]=start;
  for(let at=0;at<queue.length&&prev[end]<0;at++){const n=queue[at];for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=n%cols+dx,y=Math.floor(n/cols)+dy,id=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||!grid[id]||prev[id]>=0)continue;prev[id]=n;queue.push(id);}}
  if(prev[end]<0)return [];const result=[point(target)];for(let n=end;n!==start;n=prev[n])result.push({x:n%cols*unit+10,y:Math.floor(n/cols)*unit+10,z:0});return result.reverse();
}
function follow(s,a,target,speed,dt,stop=20,radius=9){
  if(!a||dist(a,target)<=stop){if(a){a.vx=0;a.vy=0;}return 0;}
  if(!a.routeTarget||dist(a.routeTarget,target)>35||!a.route?.length){a.routeTarget=point(target);a.route=lineClear(s,a,target,radius)?[point(target)]:path(s,a,target,radius);}
  while(a.route?.length&&dist(a,a.route[0])<8)a.route.shift();const goal=a.route?.[0]||target,d=dist(a,goal),step=Math.min(speed*dt,d),old=point(a);
  move(s,a,d?(goal.x-a.x)/d*step:0,d?(goal.y-a.y)/d*step:0,radius);a.vx=(a.x-old.x)/dt;a.vy=(a.y-old.y)/dt;if(Math.hypot(a.vx,a.vy)>1)a.facing=Math.atan2(a.vy,a.vx);return dist(old,a);
}
function safeDismount(s,ctx,a,horse){
  if(!a.mounted)return true;const from={...point(a),z:z(horse)+23,facing:a.facing},heading=horse.facing||0;
  for(const radius of[26,34,42])for(const angle of[Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4]){const target={x:horse.x+Math.cos(heading+angle)*radius,y:horse.y+Math.sin(heading+angle)*radius,z:0};if(blocked(s,target.x,target.y,9))continue;a.mounted=false;Object.assign(a,target);emit(s,ctx,'dismount',target,horse.id,from,a.id);return true;}
  ctx.notice(s,'Move the mount clear of the wall before dismounting.');return false;
}
function safeMount(s,ctx,a,horse){
  if(a.mounted||a.carrying||horse.hp<=0||!near(a,horse,60)||blocked(s,horse.x,horse.y,13))return false;
  const from={...point(a),facing:a.facing};a.mounted=true;Object.assign(a,point(horse));a.facing=horse.facing;horse.hitched=false;horse.following=false;delete horse.goal;emit(s,ctx,'mount',{...point(horse),z:z(horse)+23},horse.id,from,a.id);return true;
}
function terrain(s,p){if(s.region!==WORLD.id)return {noise:1,speed:1};return WORLD.terrainZones.find(t=>ins(p,t))||{noise:1,speed:1};}
function water(p){return WORLD.fords.some(f=>ins(p,f))||WORLD.pools.some(f=>((p.x-f.x)/f.rx)**2+((p.y-f.y)/f.ry)**2<1);}
export function getHuntHitZones(s,actorOrId){const a=typeof actorOrId==='string'?s.entities[actorOrId]:actorOrId;return a?huntAnimalHitZones(a):[];}
function recordNoise(s,p,strength){const r=rec(s);r.tracks.noise.push({...point(p),strength,age:0});r.tracks.noise=r.tracks.noise.slice(-20);}
function bearShotReport(s,x,y,ctx){
  const r=rec(s),bear=s.entities['willow-gorge-bear'];
  if(s.region!==WORLD.id||r.mission.stage!==7||!r.flags.bearSeen||r.flags.bearFired||!bear||bear.dead||Math.hypot(x-bear.x,y-bear.y)>70)return;
  r.flags.bearFired=true;r.choices.bear='warning-fired';r.timers.bear=0;bear.phase='retreat';bear.bearRetreatIndex ||= 0;
  s.horse.fear=clamp((s.horse.fear||0)+25,0,100);s.entities.bracken.fear=clamp((s.entities.bracken.fear||0)+30,0,100);
  ctx.notice(s,WORLD.bearEncounter.warningFire);emit(s,ctx,'bear-warning-shot',bear,bear.id,s.player);
}
function bowReady(s){const p=s.player,w=s.weapons[p.equippedWeaponId];return active(s)&&!s.failure&&!s.dialog&&!p.carrying&&!rec(s).processing.player&&!p.holstered&&!(p.reloadTimer>0)&&w?.kind==='bow'&&w.location==='carried'&&w.ammo>0;}
function setAim(r,x,y,aim={}){if(!Number.isFinite(x)||!Number.isFinite(y))return false;r.bow.aim={x:clamp(x,0,WORLD.width),y:clamp(y,0,WORLD.height),z:Number.isFinite(aim.z)?clamp(aim.z,0,60):23};return true;}
export function beginHuntDraw(s,x,y,ctx,aim={}){
  if(!bowReady(s)||!setAim(rec(s),x,y,aim))return s;const b=rec(s).bow;if(b.drawing)return s;
  b.drawing=true;b.age=0;b.charge=0;b.sway=0;b.fatigueWarned=false;emit(s,ctx,'draw-bow',b.aim,b.weaponId);return s;
}
export function cancelHuntDraw(s,ctx){const b=rec(s)?.bow;if(!b?.drawing)return s;b.drawing=false;b.age=0;b.charge=0;b.sway=0;b.fatigueWarned=false;b.canceled++;emit(s,ctx,'cancel-bow',s.player,b.weaponId);return s;}
export function releaseHuntDraw(s,x,y,ctx,aim={}){
  const r=rec(s),b=r.bow,p=s.player,w=s.weapons[b.weaponId];if(!b.drawing)return s;
  if(!bowReady(s)||!setAim(r,x,y,aim)||b.age<.12){cancelHuntDraw(s,ctx);return s;}
  const charge=b.charge,age=b.age,sway=b.sway,target=point(b.aim),origin={x:p.x,y:p.y,z:z(p)+(p.mounted?48:p.crouch?22:32)},heading=huntBowHeading(p,b);
  const speed=240+charge*260,distance=Math.max(20,dist(origin,target)),flight=distance/speed;
  w.ammo--;b.serial++;const arrow={id:`hunt-arrow-${b.serial}`,serial:b.serial,weaponId:b.weaponId,phase:'flying',x:origin.x+Math.cos(heading)*14,y:origin.y+Math.sin(heading)*14,z:origin.z,vx:Math.cos(heading)*speed,vy:Math.sin(heading)*speed,vz:(target.z-origin.z)/flight+45*flight,age:0,ttl:2.7,traveled:0,charge,targetId:null,targetZone:null};
  arrow.regionId=s.region;b.arrows.push(arrow);b.drawing=false;b.age=0;b.charge=0;b.sway=0;b.fatigueWarned=false;r.performance.arrowsReleased++;s.stats.shots++;p.shotTimer=.4;p.facing=heading;
  if(w.reserve>0){p.reloadTimer=.35;p.reloadWeaponId=w.id;}
  recordNoise(s,p,.15);bearShotReport(s,target.x,target.y,ctx);emit(s,ctx,'release-bow',target,arrow.id,origin);return s;
}
export function shootHunt(s,x,y,ctx,aim={}){
  const p=s.player,w=s.weapons[p.equippedWeaponId],r=rec(s);if(w?.kind==='bow')return beginHuntDraw(s,x,y,ctx,aim);
  if(!ready(s)||p.carrying||p.holstered||p.reloadTimer>0||p.shotTimer>0||!w||w.location!=='carried'||!Number.isFinite(x)||!Number.isFinite(y))return s;
  if(!w.ammo){ctx.notice(s,'The selected gun is empty; its own rounds remain separate from arrows.');return s;}
  w.ammo--;p.shotTimer=w.kind==='coach-gun'?.6:.33;p.facing=Math.atan2(y-p.y,x-p.x);s.stats.shots++;r.performance.gunShots++;
  const height=z(p)+(p.mounted?40:28),distance=Math.max(20,Math.hypot(x-p.x,y-p.y)),vz=(Number.isFinite(aim.z)?clamp(aim.z,0,60):23)-height;
  const volley={killedIds:[]},offsets=w.kind==='coach-gun'?[-.05,-.025,0,.025,.05]:[0];
  for(const offset of offsets)s.bullets.push({x:p.x+Math.cos(p.facing)*17,y:p.y+Math.sin(p.facing)*17,z:height,vx:Math.cos(p.facing+offset)*680,vy:Math.sin(p.facing+offset)*680,vz:vz/distance*680,damage:w.kind==='coach-gun'?34:42,ttl:w.kind==='coach-gun'?.7:1.3,faction:'player',weaponKind:w.kind,volley,traveled:0,triggerId:r.performance.gunShots});
  recordNoise(s,p,1);bearShotReport(s,x,y,ctx);if(r.mission.stage>=4&&r.mission.stage<=5)ctx.notice(s,'Juno: “That report carries. Follow the new sign if it moves; a gun cannot earn the bow’s one-arrow record.”');
  emit(s,ctx,'shoot',{x,y,z:Number.isFinite(aim.z)?aim.z:23},w.id);return s;
}
export function reloadHunt(s,ctx){
  const p=s.player,w=s.weapons[p.equippedWeaponId];if(s.failure||s.dialog||p.carrying||rec(s).processing.player||!w||w.location!=='carried'||p.reloadTimer>0||w.ammo>=w.capacity||w.reserve<=0)return s;
  cancelHuntDraw(s,ctx);p.reloadTimer=w.kind==='bow'?.35:w.kind==='coach-gun'?1.8:1.3;p.reloadWeaponId=w.id;emit(s,ctx,w.kind==='bow'?'nock-arrow':'reload',p,w.id);return s;
}

// Authoritative wildlife and projectile decisions. Drawing changes neither a target
// nor its quality; only the released trajectory can create an impact.
function segmentZone(a,b,q){
  const c=Math.cos(q.facing||0),sn=Math.sin(q.facing||0),local=p=>{const dx=p.x-q.x,dy=p.y-q.y;return [(dx*c+dy*sn)/q.rx,(-dx*sn+dy*c)/q.ry,(z(p)-q.z)/(q.height/2)];};
  const p=local(a),end=local(b),d=end.map((v,i)=>v-p[i]),A=d.reduce((v,x)=>v+x*x,0),B=2*d.reduce((v,x,i)=>v+x*p[i],0),C=p.reduce((v,x)=>v+x*x,0)-1;
  if(C<=0)return 0;if(!A)return null;const discriminant=B*B-4*A*C;if(discriminant<0)return null;const t=(-B-Math.sqrt(discriminant))/(2*A);return t>=0&&t<=1?t:null;
}
function residence(s,actor,seen=new Set()){
  if(!actor||seen.has(actor.id))return null;seen.add(actor.id);
  if(!actor.attachment)return actor.regionId;
  if(actor.attachment.type==='rest')return actor.attachment.regionId;
  return residence(s,s.entities[actor.attachment.targetId],seen);
}
function collision(s,a,b,shooterId='mara',penetrate=false){
  let best=null;
  const n=Math.max(1,Math.ceil(dist(a,b)/3));
  for(let k=1;k<=n;k++){const t=k/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:z(a)+(z(b)-z(a))*t};if(geometry(s).obstacles.some(o=>!o.impassable&&ins(p,o,1)&&p.z<=(o.z||0)+(o.height||35))){best={t,cover:true,point:p};break;}}
  for(const actor of Object.values(s.entities)){
    if(actor.id===shooterId||residence(s,actor)!==s.region||actor.processed||actor.id===s.horse.id&&s.player.mounted)continue;
    if(actor.hp<=0&&actor.kind!=='deer')continue;
    const animal=['deer','bear'].includes(actor.kind),zones=animal?getHuntHitZones(s,actor):[{id:'body',x:actor.x,y:actor.y,z:z(actor)+(actor.kind==='horse'?20:23),rx:actor.kind==='horse'?23:10,ry:actor.kind==='horse'?13:10,height:actor.kind==='horse'?32:42,facing:actor.facing||0}];
    let hit=null;
    for(const q of zones){const t=segmentZone(a,b,q);if(t!==null&&(!hit||t<hit.t))hit={t,actor,zone:q.id};}
    if(hit&&animal&&actor.kind==='deer'&&penetrate){
      const length=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y,z(b)-z(a))),u=hit.t,extended={x:a.x+(b.x-a.x)*(u+48/length),y:a.y+(b.y-a.y)*(u+48/length),z:z(a)+(z(b)-z(a))*(u+48/length)};
      const vital=zones.filter(q=>['vital','neck','head'].includes(q.id)).map(q=>({q,t:segmentZone(a,extended,q)})).filter(v=>v.t!==null).sort((x,y)=>x.t-y.t)[0];
      if(vital&&lineClear(s,a,extended,0,true))hit.zone=vital.q.id;
    }
    if(hit&&(!best||hit.t<best.t))best=hit;
  }
  return best;
}
function failHunt(s,ctx,reason){
  cancelHuntDraw(s,ctx);
  for(const id of HUNT_PREY_IDS){
    const d=s.entities[id],attachment=d?.attachment;if(!attachment||!['carried','large-load'].includes(attachment.type))continue;
    const carrier=s.entities[attachment.targetId];if(!carrier||carrier.hp>0)continue;
    const from=point(d),target=floorPoint(carrier);
    if(ctx.setAttachment(s,id,null)){Object.assign(d,point(target));emit(s,ctx,'setdown',target,id,from,attachment.type==='carried'?carrier.id:carrier.ownerId==='juno'?'juno':'mara',carrier.id);}
  }
  ctx.fail(s,reason);
}
function updateConditions(s){
  const r=rec(s),prey=HUNT_PREY_IDS.map(id=>s.entities[id]);
  r.performance.oneArrowEach=prey.every(d=>d?.dead&&d.hunt.deathMethod==='arrow'&&d.hunt.arrowImpacts===1&&d.hunt.gunImpacts===0);
  r.performance.noSpook=prey.every(d=>d?.dead&&d.hunt&&!d.hunt.spookedEver);
  r.performance.secondCleanKill=!!prey[1]?.hunt.cleanKill;
  r.performance.eligible=r.retryCount===0;
}
function die(s,ctx,d,method,clean=false){
  const h=d.hunt;if(d.dead)return;d.hp=0;d.dead=true;d.phase='dead';d.vx=0;d.vy=0;delete d.goal;d.route=[];
  Object.assign(h,{life:'dead',deathMethod:method,cleanKill:clean,bleedTimer:0,woundTimer:0,pose:'dead'});
  rec(s).flags[d.id===HUNT_PREY_IDS[0]?'doeDead':'buckDead']=true;rec(s).performance.deerKilled++;s.stats.kills++;
  emit(s,ctx,'animal-collapse',d,d.id,d,d.id);ctx.notice(s,`${d.name} is down. The physical carcass and its shot history remain in the field.`);updateConditions(s);
}
function impact(s,ctx,d,projectile,zone,method){
  if(d.kind==='bear'){
    if(d.dead)return;
    const alreadyReported=rec(s).flags.bearFired;
    d.hp=Math.max(0,d.hp-(projectile.damage||45));rec(s).flags.bearFired=true;rec(s).choices.bear='warning-fired';rec(s).timers.bear=0;d.bearRetreatIndex ||= 0;
    if(d.hp===0){d.dead=true;d.phase='dead';d.vx=0;d.vy=0;s.stats.kills++;s.honor-=4;emit(s,ctx,'animal-collapse',d,d.id,d,d.id);ctx.notice(s,'The bear died across the closed gorge bank. There is no trophy or food recovery route; Juno asks why an animal with a way out was pursued.');}
    else{d.phase='retreat';if(!alreadyReported)ctx.notice(s,WORLD.bearEncounter.warningFire);}return;
  }
  if(d.kind!=='deer'){
    d.hp=Math.max(0,d.hp-(projectile.damage||50));failHunt(s,ctx,`${d.name||'A companion'} was struck by Mara’s weapon. Both mounts and the people must return safely.`);return;
  }
  const h=d.hunt;
  if(d.dead){h.carcassCondition=Math.max(0,h.carcassCondition-35);h.quality=Math.max(1,h.quality-1);if(!h.carcassCondition){h.life='ruined';failHunt(s,ctx,'A required carcass was destroyed. It can no longer reach the communal kitchen.');}return;}
  if(method==='arrow')h.arrowImpacts++;else h.gunImpacts++;
  const vital=['vital','neck','head'].includes(zone),charge=projectile.charge??1,damage=method==='arrow'?(vital?150:48)*charge:(projectile.damage||42)*(vital?3:1);
  const prior=h.life;d.hp=Math.max(0,d.hp-damage);s.stats.hostileHits++;if(method==='arrow')rec(s).performance.arrowHits++;
  h.quality=Math.max(1,h.quality-(method==='gun'?1:!vital||h.arrowImpacts>1?1:0));
  if(d.hp===0){die(s,ctx,d,method,vital&&prior==='alive'&&method==='arrow'&&charge>=.85&&h.arrowImpacts===1);return;}
  h.life='wounded';h.cleanKill=false;h.woundTimer=0;h.bleedTimer=42;d.phase='wounded';h.pose='head-up';h.alert=100;
  h.habitatIndex=Math.min(h.relocations,habitat(d).relocations.length-1);h.relocations=Math.min(3,h.relocations+1);d.goal=point(habitat(d).relocations[h.habitatIndex]);
  ctx.notice(s,HUNT_DIALOGUE.woundRecovery.text);updateConditions(s);
}
function arrowsStep(s,dt,ctx){
  const r=rec(s);
  for(const a of r.bow.arrows){
    if(a.phase==='embedded'){const d=s.entities[a.targetId];if(d){a.x=d.x;a.y=d.y;a.z=z(d)+19;}continue;}
    if(a.phase!=='flying'||a.regionId!==s.region)continue;
    const from=point(a),next={x:a.x+a.vx*dt,y:a.y+a.vy*dt,z:a.z+a.vz*dt-45*dt*dt},hit=collision(s,from,next,'mara',a.charge>=.75);
    a.age+=dt;a.ttl=Math.max(0,a.ttl-dt);a.vz-=90*dt;a.traveled+=dist(from,next);
    if(hit){const t=hit.t;Object.assign(a,{x:from.x+(next.x-from.x)*t,y:from.y+(next.y-from.y)*t,z:z(from)+(z(next)-z(from))*t});
      if(hit.cover){a.phase='broken';a.targetId=null;r.performance.arrowMisses++;}
      else {a.targetId=hit.actor.id;a.targetZone=hit.zone;a.phase=hit.actor.kind==='deer'?'embedded':'spent';impact(s,ctx,hit.actor,a,hit.zone,'arrow');}
      continue;
    }
    Object.assign(a,next);
    const bounds=geometry(s),outside=a.x<0||a.x>bounds.width||a.y<0||a.y>bounds.height;
    if(a.z<=0||a.ttl<=0||outside){a.z=0;a.phase=outside||s.region===WORLD.id&&water(a)?'spent':'ground';a.x=clamp(a.x,0,bounds.width);a.y=clamp(a.y,0,bounds.height);r.performance.arrowMisses++;}
  }
}
function bulletsStep(s,dt,ctx){
  for(const a of s.bullets){
    if(a.faction!=='player')continue;
    const from=point(a),next={x:a.x+a.vx*dt,y:a.y+a.vy*dt,z:z(a)+(a.vz||0)*dt},hit=collision(s,from,next,'mara',true);a.ttl-=dt;
    if(hit){a.ttl=0;if(hit.actor){if(!(hit.actor.dead&&a.volley.killedIds.includes(hit.actor.id)))impact(s,ctx,hit.actor,a,hit.zone,'gun');if(hit.actor.dead&&!a.volley.killedIds.includes(hit.actor.id))a.volley.killedIds.push(hit.actor.id);}}
    else Object.assign(a,next);
  }
  s.bullets=s.bullets.filter(a=>a.ttl>0);
}
function addTrack(s,d,kind){const r=rec(s),h=d.hunt;if(dist(d,h.lastTrack)<21)return;h.lastTrack=point(d);const samples=r.tracks.samples[d.id];samples.push({...point(d),id:`${d.id}:sample-${++r.tracks.sampleSerial}`,kind,age:0});if(samples.length>120)samples.splice(0,samples.length-120);}
function wildlifeStep(s,dt,ctx){
  if(s.region!==WORLD.id)return;
  const r=rec(s),p=s.player;
  for(const id of HUNT_PREY_IDS){
    const d=s.entities[id],h=d.hunt;if(d.dead||d.processed||h.life==='escaped')continue;
    h.poseTimer+=dt;
    if(h.life==='wounded'){
      h.woundTimer+=dt;h.bleedTimer=Math.max(0,h.bleedTimer-dt);if(d.goal){follow(s,d,d.goal,34,dt,5,7);addTrack(s,d,'blood');}
      if(!h.bleedTimer){s.honor-=2;h.quality=Math.max(1,h.quality-1);die(s,ctx,d,'bleedout');ctx.notice(s,'The wound was followed too slowly. The deer died from blood loss; the honor cost and poor hide stay in the record.');}continue;
    }
    if(h.life==='escaping'){
      const route=habitat(d).escapeRoute,target=route[h.habitatIndex];if(target){follow(s,d,target,135,dt,4,7);addTrack(s,d,'hoof');if(near(d,target,6)){h.habitatIndex++;d.route=[];}}
      if(h.habitatIndex>=route.length||!ins(d,habitat(d).recoverableBounds)){h.life='escaped';failHunt(s,ctx,`${d.name} escaped beyond the recoverable cutting. The kitchen still needs two real carcasses.`);}continue;
    }
    if(d.goal){follow(s,d,d.goal,105,dt,4,7);addTrack(s,d,'hoof');if(near(d,d.goal,8)){delete d.goal;h.alert=30;h.poseTimer=0;}continue;}
    h.pose=['drink','browse','head-up'][Math.floor(h.poseTimer/8)%3];d.phase=h.pose;
    if(h.pose==='head-up'&&h.alert<45){
      const routine=habitat(d).routine,target=routine[(h.routineIndex+1)%routine.length];
      follow(s,d,target,8,dt,3,7);addTrack(s,d,'hoof');
      if(near(d,target,5)){h.routineIndex=(h.routineIndex+1)%routine.length;h.poseTimer=Math.ceil(h.poseTimer/24)*24;d.route=[];}
    }else{d.vx=0;d.vy=0;}
    // Animals are real occupants before the lesson, but attention is taught before
    // the required hunt begins. Distance, cover, breeze and noise all matter.
    if(r.mission.stage<4||id===HUNT_PREY_IDS[1]&&r.mission.stage<5)continue;
    const distance=dist(p,d),cover=WORLD.coverZones.find(q=>ins(p,q)),concealment=cover?.concealment||0;
    const visibility=(p.crouch?.2:1)*(1-concealment),speed=Math.hypot(p.vx||0,p.vy||0);
    const sights=distance<145&&lineClear(s,p,d,0,true)?visibility*(1-distance/180):0;
    const sound=r.tracks.noise.reduce((maximum,n)=>Math.max(maximum,n.strength*(1-dist(n,d)/300)*(1-n.age/5)),0);
    const wind=WORLD.wind,dx=d.x-p.x,dy=d.y-p.y,down=(dx*wind.x+dy*wind.y)/Math.max(1,distance),scent=distance<200&&down>.7?.45*(1-(cover?.scentShelter||0)):0;
    const foot=distance<95&&speed>5?(p.mounted?1:p.crouch?.04:.22)*terrain(s,p).noise:0;
    h.alert=clamp(h.alert+(sights+sound+scent+foot>.38?(sights+sound+scent+foot)*35:-12)*dt,0,100);
    if(h.alert>=100){h.spookedEver=true;h.pose='head-up';h.poseTimer=0;
      if(h.relocations<3){h.habitatIndex=h.relocations++;d.goal=point(habitat(d).relocations[h.habitatIndex]);ctx.notice(s,`${d.name} moved to another feeding patch. Its new hoofprints show the actual route; the hunt is recoverable.`);}
      else{h.life='escaping';h.habitatIndex=0;ctx.notice(s,`${d.name} is leaving the cutting. Persistent pursuit now risks losing it.`);}updateConditions(s);
    }
  }
}
function humaneFinish(s,ctx,id){
  const d=s.entities[id],r=rec(s),w=s.weapons[s.player.equippedWeaponId];if(d?.hunt?.life!=='wounded'||!near(s.player,d,28)||s.player.mounted)return false;
  const blade=knife(s);if(!blade&&(!w||w.ammo<=0||w.location!=='carried')){ctx.notice(s,'A humane finish needs your real field knife or one actual round. Recover an arrow or select a loaded gun.');return false;}
  if(!blade){w.ammo--;s.stats.shots++;if(w.kind==='bow'){r.bow.serial++;r.performance.arrowsReleased++;r.bow.arrows.push({id:`hunt-arrow-${r.bow.serial}`,serial:r.bow.serial,weaponId:HUNT_BOW.id,phase:'embedded',...point(d),vx:0,vy:0,vz:0,age:0,ttl:0,traveled:dist(s.player,d),charge:1,targetId:d.id,targetZone:'neck',regionId:s.region});d.hunt.arrowImpacts++;r.performance.arrowHits++;}else{r.performance.gunShots++;d.hunt.gunImpacts++;}}
  if(!blade&&w.kind==='bow'&&w.reserve>0){s.player.reloadTimer=.35;s.player.reloadWeaponId=w.id;}
  d.hunt.quality=Math.max(1,d.hunt.quality-1);emit(s,ctx,'humane-finish',d,d.id);die(s,ctx,d,'humane-finish',false);ctx.notice(s,'The suffering ended promptly. A finishing action does not become a one-arrow clean kill.');return true;
}

function beginSkin(s,ctx,actorId,deerId,bench){
  const r=rec(s),d=s.entities[deerId],a=s.entities[actorId];
  if(!usable(d)||d.attachment?.type!=='rest'||d.attachment.targetId!==bench.id||!near(a,floorPoint(bench),60)||actorId==='mara'&&!r.flags.knifeSecured)return false;
  const slot=actorId==='mara'?'player':'orla';if(r.processing[slot])return false;
  r.processing[slot]={kind:'skin',actorId,targetId:deerId,benchId:bench.id,phase:'approach',age:0,duration:actorId==='mara'?6.4:7,progress:0};
  if(actorId==='mara')summon(s,ctx,'orla',WORLD.camp.workpoints.guide);return true;
}
function finishSkin(s,ctx,p){
  const r=rec(s),d=s.entities[p.targetId],id=HIDE_IDS[HUNT_PREY_IDS.indexOf(d.id)],isPlayer=d.id===r.hunt.playerCarcassId;
  if(!usable(d))return;
  tx(s,`yield:${d.id}`,d.hunt.meatYield,()=>{
    pantry(s).rawVenison+=d.hunt.meatYield;s.camp.food+=d.hunt.meatYield;
    ctx.addItemInstance(s,{id,kind:'deer-hide',sourceEntityId:d.id,quality:d.hunt.quality,owner:isPlayer?'mara':'community',location:{type:isPlayer?'bench':'drying-rack',targetId:isPlayer?WORLD.camp.benchMara.id:WORLD.camp.hideRack.id,regionId:'snowbound'}});
    d.processed=true;d.hunt.life='processed';d.phase='processed';
    for(const a of r.bow.arrows)if(a.targetId===d.id&&a.phase==='embedded')a.phase='broken';
    emit(s,ctx,'skin-finish',p.actorId==='mara'?WORLD.camp.benchMara:WORLD.camp.benchJuno,d.id,s.entities[p.actorId],p.actorId);
  });
  r.flags[isPlayer?'playerSkinned':'orlaSkinned']=true;r.hunt.skills.fieldSkinning=true;
}
function processingStep(s,dt,ctx){
  const r=rec(s),f=r.flags,orla=s.entities.orla;
  for(const slot of ['player','orla']){
    const p=r.processing[slot];if(!p)continue;const bench=slot==='player'?WORLD.camp.benchMara:WORLD.camp.benchJuno,a=s.entities[p.actorId];
    const workpoint=WORLD.camp.workpoints[slot==='player'?'mara':'orla'];
    if(p.phase==='approach'){
      const movement=follow(s,a,workpoint,58,dt,2);if(slot==='player')s.stats.distance+=movement;
      if(!near(a,workpoint,3))continue;p.phase='working';a.facing=-Math.PI/2;emit(s,ctx,'skin-start',bench,p.targetId,a,p.actorId);
    }
    p.age=Math.min(p.duration,p.age+dt);p.progress=p.age/p.duration;
    if(slot==='player'&&p.age>=1.2&&!r.processing.orla&&!f.orlaSkinned){summon(s,ctx,'orla',WORLD.camp.workpoints.orla);}
    if(p.age>=p.duration){finishSkin(s,ctx,p);r.processing[slot]=null;}
  }
  if(f.skinLesson&&(f.playerSkinned||(r.processing.player?.age||0)>=1.2)&&!f.orlaSkinned&&!r.processing.orla&&near(orla,floorPoint(WORLD.camp.benchJuno),60))beginSkin(s,ctx,'orla',r.hunt.companionCarcassId,WORLD.camp.benchJuno);
  if(f.playerSkinned&&f.orlaSkinned&&r.mission.stage===9)advance(s,ctx,10,'both-bodies-processed','Two independent bodies yielded meat and hides once');
  const cook=r.processing.cook;
  if(cook&&near(orla,WORLD.camp.workpoints.cook,4)){
    if(cook.age===0)emit(s,ctx,'cook-start',WORLD.camp.stove,WORLD.camp.stove.id,orla,'orla');
    cook.age=Math.min(cook.duration,cook.age+dt);cook.progress=cook.age/cook.duration;
    if(cook.age>=cook.duration){
      if(tx(s,'cook:table-broth',2,()=>{const p=pantry(s);if(p.rawVenison<2||p.kitchenStarterFuel<1)return false;p.rawVenison-=2;p.kitchenStarterFuel--;p.tableBroth+=2;return true;})){f.cooked=true;emit(s,ctx,'cook-finish',WORLD.camp.stove,WORLD.camp.stove.id,orla,'orla');ctx.notice(s,'Two venison portions became two fresh broth portions using one recorded kitchen split.');}
      r.processing.cook=null;
    }
  }
}
function junoStep(s,dt,ctx){
  const r=rec(s),f=r.flags,j=s.entities.juno,b=s.entities.bracken,p=s.player;
  if(r.mission.stage===0){if(j.goal){follow(s,j,j.goal,78,dt,3);if(near(j,j.goal,8))delete j.goal;}return;}
  if(r.mission.stage===1&&!f.bowGranted){
    const stance=huntBowGiftStance(s.horse);
    if(!j.goal||dist(j.goal,stance)>3)summon(s,ctx,'juno',stance);
    follow(s,j,j.goal,78,dt,1);
    if(near(j,stance,1.1)){j.facing=stance.facing;delete j.goal;giftBow(s,ctx);summon(s,ctx,'juno',{x:b.x+25,y:b.y,z:0});}return;
  }
  if(r.mission.stage===1&&r.timers.junoHand>0){j.vx=0;j.vy=0;return;}
  if(r.mission.stage===1&&!j.mounted){
    if(j.goal){follow(s,j,j.goal,78,dt,3);if(near(j,j.goal,8))delete j.goal;}
    if(near(j,b,42))safeMount(s,ctx,j,b);return;
  }
  if(j.mounted){
    delete b.goal;
    if(p.mounted){follow(s,b,{x:p.x+38,y:p.y+30,z:0},Math.max(170,Math.hypot(p.vx||0,p.vy||0)+25),dt,44,13);}
    else follow(s,b,{x:p.x+40,y:p.y+25,z:0},155,dt,68,13);
    Object.assign(j,point(b));j.vx=b.vx;j.vy=b.vy;j.facing=b.facing;return;
  }
  if(r.mission.stage===6&&f.junoLoading&&!cargo(s,'bracken')){
    const d=s.entities[r.hunt.companionCarcassId];
    if(!j.carrying){follow(s,j,floorBody(s,ctx,d),76,dt,25,9);if(near(j,floorBody(s,ctx,d),38)){if(liftCarcass(s,ctx,d.id,'juno')){delete j.goal;summon(s,ctx,'bracken',{x:d.x-86,y:d.y+35,z:0});}}}
    else{r.hunt.junoCarryDistance+=follow(s,j,b,43,dt,38,11);if(near(j,b,55)){attachLoad(s,ctx,d.id,'bracken','juno');delete b.goal;}}
    return;
  }
  if(r.mission.stage===8&&f.kitchenHitched&&!f.deliveredJuno){
    const d=s.entities[r.hunt.companionCarcassId];
    if(!j.carrying&&d.attachment?.type==='large-load'){
      follow(s,j,b,76,dt,28);if(near(j,b,45)&&liftCarcass(s,ctx,d.id,'juno','unload'))tx(s,`unload:bracken:${d.id}`,1,()=>{});
    }else if(j.carrying===d.id){
      const target=WORLD.camp.junoDeliveryRoute[f.deliveryIndex];
      if(target){r.hunt.junoCarryDistance+=follow(s,j,target,43,dt,3,11);if(near(j,target,7)){f.deliveryIndex++;j.route=[];}}
      else if(deliverCarcass(s,ctx,d.id,'juno',WORLD.camp.benchJuno)){f.deliveredJuno=true;summon(s,ctx,'juno',WORLD.camp.handRest);}
    }return;
  }
  if(j.goal){follow(s,j,j.goal,76,dt,3,j.carrying?11:9);if(near(j,j.goal,8)){delete j.goal;if(f.deliveredJuno&&near(j,WORLD.camp.handRest,12)){f.junoResting=true;emit(s,ctx,'rest-hand',j,j.id,j,'juno');}}return;}
  if(r.mission.stage>=2&&r.mission.stage<=5&&!f.hitchPending)follow(s,j,{x:p.x-45,y:p.y+30,z:0},p.crouch?65:105,dt,55);
  if(r.mission.stage===7&&!j.mounted&&near(j,b,55))safeMount(s,ctx,j,b);
}
function campStep(s,dt,ctx){
  if(s.region!=='snowbound')return;const r=rec(s),f=r.flags;
  if(f.hobSpoke&&!f.hobLeft){const h=s.entities.hob,target=WORLD.camp.hobDepartureRoute[f.hobRouteIndex];if(target){follow(s,h,target,78,dt,3);if(near(h,target,7)){f.hobRouteIndex++;h.route=[];}}else{f.hobLeft=true;emit(s,ctx,'leave-kitchen',h,h.id,h,'hob');}}
  const orla=s.entities.orla;if(orla.goal){follow(s,orla,orla.goal,65,dt,3);if(near(orla,orla.goal,3.1))delete orla.goal;}
  if(r.mission.stage===8&&f.deliveredPlayer&&f.deliveredJuno&&f.hobLeft&&f.junoResting)advance(s,ctx,9,'both-bodies-delivered','Separate physical deliveries; Hob left and Juno rested');
}
function bearStep(s,dt,ctx,input){
  const r=rec(s),f=r.flags,bear=s.entities['willow-gorge-bear'];if(s.region!==WORLD.id||r.mission.stage!==7)return;
  if(!f.bearSeen&&ins(s.player,WORLD.bearEncounter.trigger)&&near(s.entities.bracken,s.player,190)){
    f.bearSeen=true;r.timers.bear=0;s.horse.fear=70;s.entities.bracken.fear=85;r.choices.bear='detour';bear.phase='watch';emit(s,ctx,'bear-reveal',bear,bear.id,bear,bear.id);ctx.notice(s,'Juno points across the rock channel: “A bear. Keep the loads this side; use the hillside.”');
  }
  if(!f.bearSeen)return;
  r.timers.bear+=dt;
  const aim=r.bow.drawing?r.bow.aim:Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)?{x:input.aimX,y:input.aimY}:null;
  if(!f.bearAimed&&aim&&dist(aim,bear)<60&&!s.player.holstered){f.bearAimed=true;ctx.notice(s,WORLD.bearEncounter.warningAim);}
  if(!bear.dead&&(bear.phase==='retreat'||r.timers.bear>4)){bear.phase='retreat';const route=habitat(bear).retreatRoute,target=route[bear.bearRetreatIndex||0];if(target){follow(s,bear,target,155,dt,3,16);if(near(bear,target,8)){bear.bearRetreatIndex=(bear.bearRetreatIndex||0)+1;bear.route=[];}}else bear.phase='withdrawn';}
  const target=WORLD.bearEncounter.detour[f.detourIndex];if(target&&near(s.player,target,85)&&near(s.entities.bracken,s.player,170)){f.detourIndex++;}
  if(f.detourIndex>=WORLD.bearEncounter.detour.length)f.bearDetour=true;
}
function completeHunt(s,ctx){
  const r=rec(s),f=r.flags;if(r.mission.completed||r.mission.stage!==10||!f.hideChosen||!f.cooked||!f.playerSkinned||!f.orlaSkinned)return false;
  tx(s,'complete:shared-table',1,()=>{s.camp.morale=clamp(s.camp.morale+6,0,100);s.honor+=2;r.hunt.junoTrust++;f.completedNarrative=true;});
  updateConditions(s);ctx.complete(s,['tracking','field-skinning','companion-hunt']);objective(s);
  ctx.checkpoint(s,'shared-table','Food cooked, hides owned and whole carcasses processed');
  say(s,ctx,'hunt-completed',{...HUNT_DIALOGUE.completion,text:HUNT_DIALOGUE.completion.text+' The freight-office investigation still needs its own completed record; the next heist is not available yet.'});return true;
}
export function stepHunt(s,dt,input={},ctx){
  const r=rec(s);if(!active(s)||!r||!Number.isFinite(dt))return s;dt=clamp(dt,0,.1);if(!dt)return s;ensureHuntCast(s,ctx);
  s.notices=s.notices.map(n=>({...n,time:n.time-dt})).filter(n=>n.time>0);
  if(s.failure||s.dialog)return s;
  s.elapsed+=dt;s.time+=dt/80;if(s.time>=24){s.time-=24;s.day++;}
  const p=s.player,f=r.flags,j=s.entities.juno,b=s.entities.bracken;
  for(const key of ['rest','noise','bowReminder','junoHand'])r.timers[key]=Math.max(0,r.timers[key]-dt);
  p.shotTimer=Math.max(0,(p.shotTimer||0)-dt);p.blockTimer=Math.max(0,(p.blockTimer||0)-dt);
  if(p.reloadTimer>0){p.reloadTimer=Math.max(0,p.reloadTimer-dt);if(!p.reloadTimer){const w=s.weapons[p.reloadWeaponId||p.equippedWeaponId];if(w){const n=Math.min(w.capacity-w.ammo,w.reserve);w.ammo+=n;w.reserve-=n;}delete p.reloadWeaponId;}}
  if(input.cancelDraw||input.drawHeld===false)cancelHuntDraw(s,ctx);
  if(r.bow.drawing){
    if(!bowReady(s)){cancelHuntDraw(s,ctx);}else{if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY))setAim(r,input.aimX,input.aimY,{z:input.aimZ});r.bow.age+=dt;r.bow.charge=clamp(r.bow.age/1.4,0,1);r.bow.sway=r.bow.age>2.8?Math.min(.12,(r.bow.age-2.8)*.022):.002*(1-r.bow.charge);p.stamina=Math.max(0,p.stamina-dt*(r.bow.age>2.8?7:2));if(r.bow.age>2.8&&!r.bow.fatigueWarned){r.bow.fatigueWarned=true;ctx.notice(s,'The held string is tiring Mara’s hand. Lower it without spending an arrow, or release through the real moving sight.');}if(p.stamina===0)cancelHuntDraw(s,ctx);}
  }
  if(!r.processing.player&&!r.timers.rest){
    let mx=clamp(Number(input.mx)||0,-1,1),my=clamp(Number(input.my)||0,-1,1),len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
    if(input.crouch!==undefined)p.crouch=!!input.crouch&&!p.mounted;
    const sprint=!!input.sprint&&!p.carrying&&!r.bow.drawing&&(p.mounted?s.horse.stamina:p.stamina)>1;
    const actor=p.mounted?s.horse:p,ground=terrain(s,actor),speed=(p.mounted?sprint?225:155:p.carrying?52:p.crouch?62:sprint?160:105)*ground.speed*(r.bow.drawing?.45:1)*(s.region===WORLD.id&&water(actor)?.78:1);
    const before=point(actor),movement=move(s,actor,mx*speed*dt,my*speed*dt,p.mounted?13:p.carrying?11:9);
    actor.vx=(actor.x-before.x)/dt;actor.vy=(actor.y-before.y)/dt;if(movement>.01)actor.facing=Math.atan2(my,mx);s.stats.distance+=movement;
    if(p.mounted){Object.assign(p,point(actor));p.vx=actor.vx;p.vy=actor.vy;p.facing=actor.facing;s.horse.stamina=clamp(s.horse.stamina+(movement>0&&sprint?-7:4)*dt,0,100);}
    else p.stamina=clamp(p.stamina+(movement>0&&(sprint||p.carrying)?p.carrying?-1.5:-9:r.bow.drawing?0:5)*dt,0,100);
    if(movement>.1&&s.region===WORLD.id&&r.mission.stage>=3&&r.mission.stage<=5)recordNoise(s,p,(p.mounted?1:p.crouch?.04:sprint?.5:.13)*ground.noise);
  }else{p.vx=0;p.vy=0;if(r.timers.rest)p.stamina=Math.min(100,p.stamina+20*dt);}
  p.focusActive=!!input.focus&&p.focus>0&&!p.carrying;p.focus=clamp(p.focus+(p.focusActive?-12:6)*dt,0,100);
  junoStep(s,dt,ctx);
  if(s.horse.following&&!p.mounted&&!s.horse.hitched)follow(s,s.horse,p,155,dt,38,13);
  for(const m of [s.horse,b])if(m.goal&&!m.mounted){follow(s,m,m.goal,145,dt,3,13);if(near(m,m.goal,7)){delete m.goal;if(f.hitchPending)m.hitched=true;}}
  if(f.hitchPending){const parking=r.mission.stage===8?WORLD.camp.mountParking:WORLD.mountParking;if(near(s.horse,parking.copper,12)&&near(b,parking.bracken,12)){
    f.hitchPending=false;s.horse.hitched=true;b.hitched=true;
    if(r.mission.stage===8){f.kitchenHitched=true;summon(s,ctx,'juno',point(b));}else{f.mountsParked=true;advance(s,ctx,3,'mounts-at-bank','Both living mounts parked before tracking');say(s,ctx,'hunt-sign-lesson',HUNT_DIALOGUE.signLesson);}
  }}
  for(const m of [s.horse,b])m.fear=Math.max(0,(m.fear||0)-dt*(r.flags.bearDetour?6:2));
  for(const n of r.tracks.noise)n.age+=dt;r.tracks.noise=r.tracks.noise.filter(n=>n.age<5);for(const samples of Object.values(r.tracks.samples))for(const sample of samples)sample.age+=dt;
  if(r.tracks.overlay){r.tracks.overlayTimer=Math.max(0,r.tracks.overlayTimer-dt);if(!r.tracks.overlayTimer)r.tracks.overlay=false;}
  arrowsStep(s,dt,ctx);bulletsStep(s,dt,ctx);wildlifeStep(s,dt,ctx);bearStep(s,dt,ctx,input);campStep(s,dt,ctx);processingStep(s,dt,ctx);
  if(r.mission.stage===2){const node=WORLD.trail[f.trailIndex];if(node&&near(p,node,90)&&near(j,p,170))f.trailIndex++;}
  if(r.mission.stage===4&&f.doeDead)advance(s,ctx,5,'first-deer-dead','First actual carcass remains at its death point');
  if(r.mission.stage===5&&f.buckDead&&f.fordInspected&&f.rubInspected)advance(s,ctx,6,'second-deer-dead','Separate second animal and crossing sign recorded');
  if(r.mission.stage===6&&cargo(s,s.horse.id)&&cargo(s,'bracken')){f.bothLoaded=true;advance(s,ctx,7,'both-carcasses-loaded','Exclusive large loads physically secured');}
  const apart=r.mission.stage>=2&&r.mission.stage<=7&&dist(p,j)>420;
  r.timers.abandonment=apart?r.timers.abandonment+dt:0;if(r.timers.abandonment>30)failHunt(s,ctx,'Juno and her mount were abandoned beyond the cutting. The food expedition must return together.');
  if([p,j,s.horse,b].some(a=>a.hp<=0))failHunt(s,ctx,'Mara, Juno and both required mounts must survive the food expedition.');
  updateConditions(s);objective(s);return s;
}

export function useHuntItem(s,id,ctx){
  if(s.failure||s.dialog||rec(s).processing.player)return s;const r=rec(s),p=s.player;
  if(['quietRation','quiet-ration','eat:quiet-ration'].includes(id)){
    if(tx(s,'use:quiet-ration',1,()=>consume(s,'quietRation'))){r.flags.rationUsed=true;p.stamina=Math.min(100,p.stamina+70);p.hp=Math.min(100,p.hp+8);emit(s,ctx,'eat',p,'quietRation');}else ctx.notice(s,'The one gifted ration has already been used or moved to Copper’s pack.');return s;
  }
  if(id==='warmCider'){
    if(s.region==='snowbound'&&near(p,s.entities.orla,70)&&tx(s,'use:kitchen-cider',1,()=>{if(pantry(s).warmCider<1)return false;pantry(s).warmCider--;return true;})){r.flags.ciderUsed=true;p.stamina=Math.min(100,p.stamina+30);p.hp=Math.min(100,p.hp+5);emit(s,ctx,'drink',p,'warmCider');ctx.notice(s,HUNT_DIALOGUE.cider.text);}return s;
  }
  if(id==='tableBroth'){
    if(pantry(s).tableBroth>0&&(p.hp<100||p.stamina<100)){const serving=r.transactions[`${HUNT_ID}:use:table-broth-1`]?2:1;tx(s,`use:table-broth-${serving}`,1,()=>{if(pantry(s).tableBroth<1)return false;pantry(s).tableBroth--;s.camp.food=Math.max(0,s.camp.food-1);p.stamina=100;p.hp=Math.min(100,p.hp+15);emit(s,ctx,'eat',p,id);});}return s;
  }
  if(!(s.inventory[id]>0))return s;
  if(id==='tonic'&&p.hp<100){consume(s,id);p.hp=Math.min(100,p.hp+55);}
  else if(id==='coffee'&&p.focus<100){consume(s,id);p.focus=Math.min(100,p.focus+50);}
  else if(id==='bandages'&&p.hp<100){consume(s,id);p.hp=Math.min(100,p.hp+35);}
  else if(id==='broth'&&(p.stamina<100||p.hp<100)){consume(s,id);p.stamina=100;p.hp=Math.min(100,p.hp+15);}
  else if(id==='oats'&&near(p,s.horse,80)){consume(s,id);s.horse.stamina=100;s.horse.bond=Math.min(4,(s.horse.bond||1)+.2);}
  else return s;emit(s,ctx,id==='bandages'?'bandage':'eat',p,id);return s;
}
export function whistleHunt(s,ctx){
  if(s.failure||s.dialog||s.player.mounted||rec(s).processing.player)return s;
  const stage=rec(s).mission.stage;
  if(stage>=3&&stage<=5){ctx.notice(s,'The mounts stay sheltered while you track. Return to Copper’s rack if you stored the bow.');return s;}
  s.horse.hitched=false;s.horse.following=true;delete s.horse.goal;emit(s,ctx,'whistle',s.horse,s.horse.id);return s;
}
export function actionHunt(s,id,ctx){
  if(!active(s)||s.failure||s.dialog)return s;const r=rec(s),p=s.player;
  if(id==='cancel-draw'||id==='cancel-bow'){cancelHuntDraw(s,ctx);return s;}
  if(r.processing.player)return s;
  if(id==='holster'){cancelHuntDraw(s,ctx);p.holstered=true;p.armed=false;emit(s,ctx,'holster',p,p.equippedWeaponId);}
  else if(id==='draw'){const w=s.weapons[p.equippedWeaponId];if(w?.location==='carried'&&!p.carrying){p.holstered=false;p.armed=true;emit(s,ctx,'draw',p,w.id);}}
  else if(id.startsWith('equip:')&&id!=='equip:ash-bow'){
    const request=id.slice(6),w=s.weapons[request]||Object.values(s.weapons).find(w=>w.kind===request);
    if(!weaponReachable(s,w)||p.carrying)return s;
    if(w.kind==='bow'){
      if(!r.flags.bowInspected){ctx.notice(s,'Inspect Juno’s bow at Copper’s rack before equipping it for the first time.');return s;}
      cancelHuntDraw(s,ctx);
      if(equipBow(s,ctx)&&!r.flags.equipmentCheckpoint){r.flags.equipmentCheckpoint=true;ctx.checkpoint(s,'equipment-secured','Owned bow retrieved from Copper’s actual rack');}
      return s;
    }
    cancelHuntDraw(s,ctx);w.location='carried';delete w.rackMountId;p.equippedWeaponId=w.id;p.holstered=false;p.armed=true;p.reloadTimer=0;delete p.reloadWeaponId;
    emit(s,ctx,'equip',p,w.id);
  }else if(id==='rack:store-bow'){
    const w=s.weapons[HUNT_BOW.id];if(w?.location==='carried'&&near(p,s.horse,58)&&!p.carrying){cancelHuntDraw(s,ctx);w.location='saddle';w.rackMountId=s.horse.id;p.holstered=true;p.armed=false;emit(s,ctx,'store-bow',s.horse,w.id);}
  }else if(id==='crouch')p.crouch=true;
  else if(id==='stand')p.crouch=false;
  else if(id==='block'&&!p.mounted&&!p.carrying){if(!(p.blockTimer>.25))emit(s,ctx,'block',p,p.id);p.blockTimer=.8;}
  else if(id.startsWith('take-hide:')||id.startsWith('store-hide:')){
    const take=id.startsWith('take-hide:'),h=item(s,ctx,id.slice(take?10:11));if(!h||h.kind!=='deer-hide'||h.owner!=='mara')return s;
    if(take&&h.location.type==='saddle'&&h.location.targetId===s.horse.id&&near(p,s.horse,58)){if(ctx.moveItemInstance(s,h.id,{type:'carried',targetId:'mara'}))emit(s,ctx,'lift-hide',p,h.id,s.horse,'mara',s.horse.id);}
    else if(take&&h.location.type==='drying-rack'&&s.region==='snowbound'&&near(p,WORLD.camp.hideRack,48)){if(ctx.moveItemInstance(s,h.id,{type:'carried',targetId:'mara'}))emit(s,ctx,'lift-hide',p,h.id,WORLD.camp.hideRack,'mara',WORLD.camp.hideRack.id);}
    else if(!take&&h.location.type==='carried'&&near(p,s.horse,58)){if(ctx.moveItemInstance(s,h.id,{type:'saddle',targetId:s.horse.id}))emit(s,ctx,'store-hide',s.horse,h.id,p,'mara','mara');}
  }else{const offered=getHuntInteractions(s,ctx).find(a=>a.id===id||id==='carry'&&a.id.startsWith('carry:'));if(offered)interactHunt(s,offered.id,ctx);}
  return s;
}
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const integer=(v,lo=0,hi=100000)=>Number.isInteger(v)&&v>=lo&&v<=hi;
function validPoint(p){return object(p)&&finite(p.x)&&finite(p.y)&&finite(p.z)&&p.x>=0&&p.x<=2400&&p.y>=0&&p.y<=1900&&p.z>=0&&p.z<=160;}
function validHuntDialog(s,r){
  const d=s.dialog;if(!d)return true;
  if(d.id==='mission-failed'&&active(s)){
    const expected=['retry','restart',...(s.replayCanonical?['finish-replay']:[])];
    return !!s.failure&&d.speaker==='A Quiet Table · Checkpoint'&&Array.isArray(d.choices)&&d.choices.length===expected.length&&d.choices.every((c,i)=>c.id===expected[i]);
  }
  if(typeof d.id!=='string')return false;
  if(!d.id.startsWith('hunt'))return !active(s)||d.id.startsWith('rescue');
  if(!object(d)||!Array.isArray(d.choices)||d.choices.length>5)return false;
  const f=r.flags,stage=r.mission.stage,scenes={
    'hunt-orla':[f.orlaMet,['ask-pantry','ask-hunters','leave']],
    'hunt-pantry':[f.orlaMet,['leave']],
    'hunt-moss':[f.mossHeard,['leave']],
    'hunt-vera':[f.veraHeard,['leave']],
    'hunt-juno-invitation':[f.junoMet&&f.mossHeard&&f.veraHeard,['accept-hunt','leave']],
    'hunt-bow-gift':[active(s)&&stage===1&&f.bowGranted&&f.bowInspected,['leave']],
    'hunt-wind':[active(s)&&stage===2&&f.windLearned,['leave']],
    'hunt-sign-lesson':[active(s)&&stage===3&&f.mountsParked,['leave']],
    'hunt-wrong-fork':[active(s)&&stage>=3&&stage<=5&&r.tracks.inspected['false-fork'],['leave']],
    'hunt-load-lesson':[active(s)&&stage===6&&f.junoLoading,['leave']],
    'hunt-return-belonging':[active(s)&&stage===7&&f.junoBelonging,['ask-losses','ask-road','ask-mounts','leave']],
    'hunt-return-losses':[active(s)&&stage===7&&f.junoBelonging,['leave']],
    'hunt-return-road':[active(s)&&stage===7&&f.junoBelonging,['leave']],
    'hunt-return-mounts':[active(s)&&stage===7&&f.junoBelonging,['leave']],
    'hunt-hob':[active(s)&&stage===8&&f.hobSpoke,['leave']],
    'hunt-yield-account':[active(s)&&stage===10&&f.accountRead&&f.hideHung,['retain-hide','donate-hide','leave']],
    'hunt-tomas-order':[active(s)&&stage===10&&f.tomasOrderDiscussed,['leave']],
    'hunt-bow-reminder':[active(s)&&stage===1,['leave']],
    'hunt-completed':[active(s)&&r.mission.completed,['leave']],
  };
  if(d.id.startsWith('hunt-aftermath-')){const actorId=d.id.slice(15);if(!r.mission.completed||!['orla','juno','hob','della'].includes(actorId))return false;return d.speaker===(HUNT_CAST.find(a=>a.id===actorId)?.name||'Della Wren')&&d.choices.length===1&&d.choices[0].id==='leave';}
  const expectedSpeaker=['hunt-orla','hunt-pantry','hunt-completed'].includes(d.id)?'Orla Venn':d.id==='hunt-moss'?'Moss Laird':d.id==='hunt-vera'?'Vera Holl':d.id==='hunt-hob'?'Hob Jarrow':d.id==='hunt-yield-account'?'Della Wren':d.id==='hunt-tomas-order'?'Tomas Reed':'Juno Mercier';
  if(d.speaker!==expectedSpeaker)return false;
  const entry=scenes[d.id];if(!entry||!entry[0]||d.choices.length!==entry[1].length||d.choices.some((c,i)=>!object(c)||c.id!==entry[1][i]||typeof c.label!=='string'))return false;
  if(!active(s)&&!['hunt-orla','hunt-pantry','hunt-moss','hunt-vera','hunt-juno-invitation'].includes(d.id))return false;
  if(stage!==0&&['hunt-orla','hunt-pantry','hunt-moss','hunt-vera','hunt-juno-invitation'].includes(d.id))return false;
  return true;
}
export function validateHuntRecord(s){
  const r=s?.campaign?.missions?.[HUNT_ID];if(!object(r))return false;
  const template=createHuntRecord(),m=r.mission,f=r.flags;
  if(!object(m)||m.id!==HUNT_ID||m.stageCount!==11||!integer(m.stage,0,10)||m.name!=='A Quiet Table'||typeof m.objective!=='string'||m.objective.length>1500||typeof m.completed!=='boolean'||typeof m.rewardPaid!=='boolean'||!['locked','unstarted','active','completed'].includes(r.status)||r.sourceRequirementId!==template.sourceRequirementId||!integer(r.retryCount)||r.checkpointId!==null&&typeof r.checkpointId!=='string')return false;
  if(m.completed!==(r.status==='completed')||m.completed!==m.rewardPaid||r.status==='active'&&!active(s)||active(s)&&!['active','completed'].includes(r.status))return false;
  if((r.status==='unstarted'||r.status==='active'||r.status==='completed')&&!s.campaign.missions[RESCUE_ID]?.mission.completed)return false;
  for(const section of ['flags','timers','performance']){
    if(!object(r[section]))return false;
    for(const [key,value]of Object.entries(template[section])){const actual=r[section][key];if(typeof value==='boolean'?typeof actual!=='boolean':!finite(actual)||actual<0||actual>100000)return false;if(section==='flags'&&typeof value==='number'&&!integer(actual))return false;}
    if(Object.keys(r[section]).some(key=>!(key in template[section])))return false;
  }
  const limits={trailIndex:WORLD.trail.length,searchIndex:WORLD.searchRoute.length,secondIndex:WORLD.secondRoute.length,returnIndex:WORLD.returnRoute.length,detourIndex:WORLD.bearEncounter.detour.length,junoLoadIndex:20,deliveryIndex:WORLD.camp.junoDeliveryRoute.length,hobRouteIndex:WORLD.camp.hobDepartureRoute.length};
  if(Object.entries(limits).some(([k,v])=>f[k]>v)||!object(r.choices)||![null,'retain','donate'].includes(r.choices.hide)||![null,'hunt-first','rival-first'].includes(r.choices.order)||![null,'detour','warning-fired'].includes(r.choices.bear))return false;
  if(!object(r.hunt)||!HUNT_PREY_IDS.includes(r.hunt.playerCarcassId)||r.hunt.companionCarcassId!==HUNT_PREY_IDS.find(id=>id!==r.hunt.playerCarcassId)||r.hunt.fieldKnifeId!==null&&typeof r.hunt.fieldKnifeId!=='string'||!integer(r.hunt.junoTrust,0,20)||!finite(r.hunt.junoCarryDistance)||r.hunt.junoCarryDistance<0||typeof r.hunt.rivalAtReturn!=='boolean'||!object(r.hunt.skills)||typeof r.hunt.skills.tracking!=='boolean'||typeof r.hunt.skills.fieldSkinning!=='boolean')return false;
  const t=r.tracks,b=r.bow;
  if(!object(t)||!object(t.inspected)||Object.entries(template.tracks.inspected).some(([id])=>typeof t.inspected[id]!=='boolean')||Object.keys(t.inspected).length!==5||!object(t.samples)||Object.keys(t.samples).length!==2||typeof t.overlay!=='boolean'||!finite(t.overlayTimer)||t.overlayTimer<0||t.overlayTimer>10||!integer(t.wrongFork)||!integer(t.sampleSerial)||!Array.isArray(t.noise)||t.noise.length>20||t.noise.some(n=>!validPoint(n)||!finite(n.strength)||n.strength<0||n.strength>2||!finite(n.age)||n.age<0||n.age>5)||t.lastConfirmed!==null&&(!validPoint(t.lastConfirmed)||typeof t.lastConfirmed.id!=='string'))return false;
  for(const id of HUNT_PREY_IDS)if(!Array.isArray(t.samples[id])||t.samples[id].length>120||t.samples[id].some(p=>!validPoint(p)||typeof p.id!=='string'||!['hoof','blood'].includes(p.kind)||!finite(p.age)||p.age<0)||new Set(t.samples[id].map(p=>p.id)).size!==t.samples[id].length)return false;
  if(!object(b)||b.weaponId!==HUNT_BOW.id||typeof b.drawing!=='boolean'||typeof b.fatigueWarned!=='boolean'||!finite(b.age)||b.age<0||b.age>1000||!finite(b.charge)||b.charge<0||b.charge>1||!finite(b.sway)||b.sway<0||b.sway>.12||!validPoint(b.aim)||b.aim.z>60||!integer(b.serial,0,100000)||!integer(b.canceled)||!Array.isArray(b.arrows)||b.arrows.length!==b.serial||r.performance.arrowsReleased!==b.serial||r.performance.arrowHits>b.serial||r.performance.arrowMisses>b.serial)return false;
  if(b.drawing&&(s.player.equippedWeaponId!==HUNT_BOW.id||s.player.holstered||s.player.mounted&&s.player.carrying||s.player.carrying||s.dialog||s.failure||Math.abs(b.charge-clamp(b.age/1.4,0,1))>1e-6))return false;
  if(!b.drawing&&(b.age!==0||b.charge!==0||b.sway!==0))return false;
  for(let i=0;i<b.arrows.length;i++){const a=b.arrows[i];if(!object(a)||a.id!==`hunt-arrow-${i+1}`||a.serial!==i+1||a.weaponId!==HUNT_BOW.id||!['flying','embedded','ground','broken','spent','recovered'].includes(a.phase)||!validPoint(a)||!['snowbound','willow-run'].includes(a.regionId)||!['vx','vy','vz','age','ttl','traveled','charge'].every(k=>finite(a[k]))||a.age<0||a.age>1000||a.ttl<0||a.ttl>2.7||a.traveled<0||a.charge<0||a.charge>1||a.targetId!==null&&!s.entities[a.targetId]||a.targetZone!==null&&!['body','vital','neck','head'].includes(a.targetZone))return false;if(a.phase==='embedded'&&!HUNT_PREY_IDS.includes(a.targetId))return false;}
  const w=s.weapons?.[HUNT_BOW.id],grant=r.transactions?.[`${HUNT_ID}:grant:ash-bow`],arrows=r.transactions?.[`${HUNT_ID}:grant:field-arrows`];
  if(f.bowGranted!==!!grant||f.bowGranted!==!!arrows||f.bowGranted&&(!w||w.kind!=='bow'||w.owner!=='mara'||w.loanMissionId!==null||w.ammoType!=='arrow'||w.capacity!==1||w.ammo+w.reserve!==22-b.serial+b.arrows.filter(a=>a.phase==='recovered').length)||!f.bowGranted&&w)return false;
  if(f.bowGranted&&w.condition!==1||f.bowInspected&&!f.bowGranted||f.bowEquipped&&!f.bowInspected)return false;
  if(!object(r.transactions))return false;
  const legal=new Map([['grant:quiet-ration',1],['grant:kitchen-fuel',1],['grant:kitchen-cider',1],['grant:ash-bow',1],['grant:field-arrows',22],['grant:field-knife',1],['use:quiet-ration',1],['use:kitchen-cider',1],['use:table-broth-1',1],['use:table-broth-2',1],['cook:table-broth',2],['complete:shared-table',1]]);
  for(const id of HUNT_PREY_IDS){legal.set(`yield:${id}`,6);for(const mount of['copper','bracken']){legal.set(`load:${mount}:${id}`,1);legal.set(`unload:${mount}:${id}`,1);}for(const bench of['hunt-bench-mara','hunt-bench-juno'])legal.set(`deliver:${bench}:${id}`,1);}
  for(const id of HIDE_IDS){legal.set(`hang:${id}`,1);legal.set(`ownership:${id}`,1);}for(const a of b.arrows)legal.set(`recover:${a.id}`,1);
  for(const [key,value]of Object.entries(r.transactions)){const short=key.slice(HUNT_ID.length+1);if(!key.startsWith(`${HUNT_ID}:`)||!legal.has(short)||!object(value)||value.completed!==true||value.amount!==legal.get(short)||Object.keys(value).some(k=>!['amount','completed'].includes(k)))return false;}
  if(r.transactions[`${HUNT_ID}:use:table-broth-2`]&&!r.transactions[`${HUNT_ID}:use:table-broth-1`])return false;
  if(f.rationGranted!==!!r.transactions[`${HUNT_ID}:grant:quiet-ration`]||f.rationUsed!==!!r.transactions[`${HUNT_ID}:use:quiet-ration`]||f.ciderUsed!==!!r.transactions[`${HUNT_ID}:use:kitchen-cider`])return false;
  const ration=(s.inventory.quietRation||0)+Object.values(s.entities).filter(a=>a.kind==='horse').reduce((n,a)=>n+(a.pack?.quietRation||0),0);if(ration!==(f.rationGranted&&!f.rationUsed?1:0))return false;
  // These items have typed authoritative owners. A second satchel/pack counter
  // would fabricate arrows, a bow, hides, a knife or communal kitchen stock.
  for(const id of ['arrow','ashBow','fieldKnife','deerHide','rawVenison','tableBroth','kitchenStarterFuel','warmCider'])if((s.inventory[id]||0)>0||Object.values(s.entities).some(a=>(a.pack?.[id]||0)>0))return false;
  if(s.camp.pantry){const p=s.camp.pantry;if(!object(p)||Object.keys(p).length!==4||!['rawVenison','tableBroth','kitchenStarterFuel','warmCider'].every(k=>integer(p[k],0,100000)))return false;
    const yields=HUNT_PREY_IDS.reduce((n,id)=>n+(r.transactions[`${HUNT_ID}:yield:${id}`]?6:0),0),cooked=!!r.transactions[`${HUNT_ID}:cook:table-broth`];
    if(p.rawVenison!==yields-(cooked?2:0)||p.tableBroth!==(cooked?2:0)-[1,2].filter(n=>r.transactions[`${HUNT_ID}:use:table-broth-${n}`]).length||p.kitchenStarterFuel!==(r.transactions[`${HUNT_ID}:grant:kitchen-fuel`]?1:0)-(cooked?1:0)||p.warmCider!==(r.transactions[`${HUNT_ID}:grant:kitchen-cider`]?1:0)-(f.ciderUsed?1:0))return false;
  }else if(f.rationGranted)return false;
  if(!object(r.processing)||Object.keys(r.processing).length!==3)return false;
  for(const slot of['player','orla','cook']){const p=r.processing[slot];if(p===null)continue;if(!object(p)||p.actorId!==(slot==='player'?'mara':'orla')||p.kind!==(slot==='cook'?'cook':'skin')||p.targetId!==(slot==='cook'?WORLD.camp.stove.id:slot==='player'?r.hunt.playerCarcassId:r.hunt.companionCarcassId)||p.duration!==(slot==='cook'?5:slot==='player'?6.4:7)||!finite(p.age)||p.age<0||p.age>p.duration||!finite(p.progress)||Math.abs(p.progress-p.age/p.duration)>1e-7||m.stage!==(slot==='cook'?10:9))return false;if(slot!=='cook'&&(p.benchId!==(slot==='player'?WORLD.camp.benchMara.id:WORLD.camp.benchJuno.id)||!['approach','working'].includes(p.phase)||p.phase==='approach'&&(p.age!==0||p.progress!==0)))return false;
    const workpoint=WORLD.camp.workpoints[slot==='player'?'mara':slot==='cook'?'cook':'orla'];
    if((p.phase==='working'||slot==='cook'&&p.age>0)&&!near(s.entities[p.actorId],workpoint,4))return false;
  }
  if(r.status==='locked')return m.stage===0&&!Object.keys(r.transactions).length&&Object.values(defaults).every((_,i)=>f[Object.keys(defaults)[i]]===false)&&validHuntDialog(s,r);
  for(const id of HUNT_ENTITY_IDS)if(!s.entities[id])return false;
  for(const id of HUNT_PREY_IDS){const d=s.entities[id],h=d.hunt;if(d.kind!=='deer'||'quality'in d||'alert'in d||!object(h)||!['alive','wounded','escaping','escaped','dead','processed','ruined'].includes(h.life)||!integer(h.quality,1,3)||!finite(h.alert)||h.alert<0||h.alert>100||typeof h.spookedEver!=='boolean'||typeof h.cleanKill!=='boolean'||!integer(h.arrowImpacts)||!integer(h.gunImpacts)||![null,'arrow','gun','bleedout','humane-finish'].includes(h.deathMethod)||!['woundTimer','bleedTimer','poseTimer','carcassCondition'].every(k=>finite(h[k])&&h[k]>=0)||h.carcassCondition>100||h.meatYield!==6||!integer(h.habitatIndex,0,20)||!integer(h.routineIndex,0,20)||!integer(h.relocations,0,3)||!['drink','browse','head-up','dead'].includes(h.pose)||!validPoint(h.lastTrack))return false;
    if(d.dead!==(d.hp===0)||d.processed!==(h.life==='processed')||['dead','processed','ruined'].includes(h.life)!==d.dead||h.cleanKill&&(h.deathMethod!=='arrow'||h.arrowImpacts!==1||h.gunImpacts!==0))return false;
    if(f[id===HUNT_PREY_IDS[0]?'doeDead':'buckDead']!==d.dead)return false;
    const yieldTx=!!r.transactions[`${HUNT_ID}:yield:${id}`];if(d.processed!==yieldTx)return false;
    if(yieldTx){const hide=s.itemInstances?.[HIDE_IDS[HUNT_PREY_IDS.indexOf(id)]],owner=id===r.hunt.playerCarcassId&&r.choices.hide!=='donate'?'mara':'community';if(!hide||hide.sourceEntityId!==id||hide.quality!==h.quality||hide.owner!==owner)return false;}
  }
  const prey=HUNT_PREY_IDS.map(id=>s.entities[id]);
  if(r.performance.eligible!==(r.retryCount===0))return false;
  if(r.performance.deerKilled!==prey.filter(d=>d.dead).length||r.performance.arrowHits!==prey.reduce((n,d)=>n+d.hunt.arrowImpacts,0)||r.performance.oneArrowEach!==prey.every(d=>d.dead&&d.hunt.deathMethod==='arrow'&&d.hunt.arrowImpacts===1&&d.hunt.gunImpacts===0)||r.performance.noSpook!==prey.every(d=>d.dead&&!d.hunt.spookedEver)||r.performance.secondCleanKill!==prey[1].hunt.cleanKill)return false;
  if(f.knifeSecured&&(!r.hunt.fieldKnifeId||s.itemInstances?.[r.hunt.fieldKnifeId]?.kind!=='field-knife'))return false;
  const gates=[[1,f.mapConfirmed&&f.rationGranted],[2,f.bowGranted&&f.bowInspected&&f.bowEquipped&&f.enteredWillow],[3,f.mountsParked&&f.windLearned],[4,f.trailConfirmed&&f.trackingTaught],[5,f.doeDead],[6,f.buckDead&&f.fordInspected&&f.rubInspected],[7,f.bothLoaded],[8,f.bearSeen&&f.bearDetour&&f.junoBelonging&&f.campReturned],[9,f.deliveredPlayer&&f.deliveredJuno&&f.hobLeft&&f.junoResting],[10,f.playerSkinned&&f.orlaSkinned]];
  if(gates.some(([stage,gate])=>m.stage>=stage&&!gate)||m.completed&&(!f.hideChosen||!f.cooked||!f.completedNarrative))return false;
  if(f.hideChosen!==(r.choices.hide!==null)||f.hideChosen&&!r.transactions[`${HUNT_ID}:ownership:${ownedHide(s,{itemInstance:(_,id)=>s.itemInstances[id]})?.id}`]||f.cooked!==!!r.transactions[`${HUNT_ID}:cook:table-broth`])return false;
  return validHuntDialog(s,r);
}
