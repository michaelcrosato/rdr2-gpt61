import { getCampaignPresentation } from './campaign.js';
import { RIVAL_WORLD as WORLD } from '../content/campaign/bellwether-works.js';
import { createRivalHuman, drawRivalOutfit, RivalMountRig, RIVAL_HUMAN_IDS, RIVAL_MOUNT_IDS, boundRivalPose, poseRivalCarbine, drawRivalCarbine } from './rival-rigs.js';
import { createRivalAnimator, prepareRivalHuman, fitRivalSeatFeet } from './rival-animation.js';
import { jointScreen, clamp01, smooth, solveLimb } from './western-animation.js';
import { lowerTorso, mixPoint, seatPose } from './expedition-animation.js';

const rows=v=>Array.isArray(v)?v:Object.values(v||{}),newHumans=new Set(['ruth','bastian','emmett','levi','calder']),newMounts=new Set(['plover','cinder','button','skein','grout']);
const carryKinds=new Set(['lift','load','unload','setdown','handoff','holding-transfer']);
const record=s=>s.campaign?.missions?.['snowbound-the-names-they-took']||{};
export const isRivalPresentation=s=>s.campaign?.activeMissionId==='snowbound-the-names-they-took';
export const rivalEntities=s=>s.entities||Object.fromEntries([s.player,s.horse,...rows(s.npcs),...rows(s.mounts),...rows(s.enemies)].filter(Boolean).map(a=>[a.id||'mara',a]));
export function rivalResidence(body,all,fallback,seen=new Set()){
  if(!body||seen.has(body.id))return null;seen.add(body.id);const a=body.attachment;
  if(a&&['rest','holding','held'].includes(a.type))return a.regionId||body.regionId||'snowbound';
  if(a){const owner=all[a.targetId];return owner?rivalResidence(owner,all,fallback,seen):a.regionId||body.regionId||fallback;}
  return body.regionId||fallback;
}
export function ownsRivalActor(s,body){
  if(!body)return false;
  return newHumans.has(body.id)||newMounts.has(body.id)||isRivalPresentation(s)&&(RIVAL_HUMAN_IDS.has(body.id)||RIVAL_MOUNT_IDS.has(body.id)||body.id===s.horse?.id||body.faction==='claimants'||body.id?.startsWith('bellwether-'));
}
export function createRivalActors(E,game){
  const P=E.px,humans=new Map(),mounts=new Map(),positions=new Map(),animation=createRivalAnimator();let stateRef,drawn=[],roots=[],contacts=[];
  const human=body=>{const id=typeof body==='string'?body:body.id;if(!humans.has(id))humans.set(id,createRivalHuman(E,id,typeof body==='string'?{}:body));return humans.get(id);};
  const mount=body=>{const id=typeof body==='string'?body:body.id;if(!mounts.has(id))mounts.set(id,new RivalMountRig(E,id));return mounts.get(id);};
  const isMount=body=>body.kind==='horse'||body.category==='mount'||newMounts.has(body.id)||RIVAL_MOUNT_IDS.has(body.id);
  const active=(body,s,all)=>body&&!body.hidden&&!body.departed&&rivalResidence(body,all,s.region)===s.region&&ownsRivalActor(s,body);
  function update(dt,s){
    if(stateRef!==s){stateRef=s;positions.clear();}animation.update(dt,s,getCampaignPresentation(s),game.reduceMotion);const all=rivalEntities(s);
    for(const body of Object.values(all)){
      if(!active(body,s,all))continue;const before=positions.get(body.id),vx=before&&dt>0?(body.x-before.x)/dt:body.vx||0,vy=before&&dt>0?(body.y-before.y)/dt:body.vy||0,m={vx:Math.abs(vx)<700?vx:0,vy:Math.abs(vy)<700?vy:0};positions.set(body.id,{x:body.x,y:body.y});
      if(isMount(body)){mount(body).update(dt,{...body,...m},game.reduceMotion);continue;}
      human(body).rig.update(dt,{...body,...m,z:0,vx:body.mounted?0:m.vx,vy:body.mounted?0:m.vy,point:false,pose:body.hp<=0?'die':body.crouch?'crouch':body.bound||body.restrained||body.surrendered||body.carrying?'guard':null});
    }
  }
  function draw(r,s){
    const story=record(s),all=rivalEntities(s),used=new Set(),cv=E.charView(r.view),project=(x,y,z=0)=>r.w(x,y,z),live=b=>active(b,s,all),rope=s.rope||s.lariat||s.rival?.lariat||story.rope||{},scope=s.scope||s.sightglass||story.scope||{},objects=s.rivalObjects||story.objects||{};drawn=[];roots=[];contacts=[];
    const boundBody=a=>{const body=a.body;if(body.id==='levi'&&(body.bound||body.restrained)){const resting=body.attachment&&['rest','holding','held'].includes(body.attachment.type);if(resting)lowerTorso(E,a.h.rig,5.5,0);boundRivalPose(E,a.h.rig,{prone:!body.attachment});}};
    const prep=(body,extra={})=>{const h=human(body),clip=animation.clip(body.id),target=clip?.targetId&&all[clip.targetId],physical=clip&&rows(s.region==='snowbound'?WORLD.camp.props:WORLD.props).find(p=>p.id===clip.targetId),site=clip&&({magazine:WORLD.searchSites.chargeCrate,'cap-wagon':WORLD.searchSites.capTin,weighhouse:WORLD.searchSites.plans})[clip.targetId];let propPoint;
      if(clip&&['give-lariat','give-sightglass','give-engraved','give-cartridges','receive-cartridges','give-cap','receive-cap','receive-plans','pass-charge','give-plans'].includes(clip.kind)&&clip.target){const height=clip.target.z>=(body.z||0)+20?clip.target.z:(clip.target.z||0)+32;propPoint=project(clip.target.x,clip.target.y,height);}
      else if(clip&&['inspect-charge','repack-charge','deposit'].includes(clip.kind)&&(physical||site)){const p=physical||site;propPoint=project(p.x,p.y,p.z||24);}
      else if(clip?.kind==='equip'&&clip.targetId&&s.weapons?.[clip.targetId]&&!extra.propPoint)propPoint=project(body.x,body.y,(body.z||0)+32);
      let bodySocket=target&&project(target.x,target.y,(target.z||0)+(target.mounted?64:target.bound?12:31));
      if(target&&!isMount(target)&&clip.actorId===body.id&&['loot','search-surrendered','bind','care','strike','intervene','disarm','grapple'].includes(clip.kind)){
        const partner=human(target),pose=prepareRivalHuman(E,target,partner.rig,project(target.x,target.y,target.z||0),r.view,{clip:animation.clip(target.id),project});pose.h=partner;boundBody(pose);bodySocket=jointScreen(partner.rig,cv,pose.root,clip.kind==='bind'?'handR':clip.kind==='loot'?'hipC':'shC');pose.restore();
      }
      const a=prepareRivalHuman(E,body,h.rig,project(body.x,body.y,body.z||0),r.view,{clip,project,propPoint,cover:body.coverId||s.cover,aiming:body.id==='mara'?s.aiming:body.aiming,sightglass:body.id==='mara'&&(scope.active||scope.raised),lariat:body.id==='mara'&&['taut','caught','throwing','flying'].includes(rope.phase),bodySocket,...extra});a.h=h;return a;};
    const crateShape=(g,center)=>{P.poly(g,[[center[0]-14,center[1]-8],[center[0]+14,center[1]-8],[center[0]+14,center[1]+8],[center[0]-14,center[1]+8]],'#8a7756');for(const dx of[-9,9])P.line(g,center[0]+dx,center[1]-8,center[0]+dx,center[1]+8,'#c1af83',2);P.rect(g,center[0]-5,center[1]-3,10,6,'#476960');};
    const crateContact=a=>{
      const c=animation.clip(a.body.id),crate=objects['charge-crate'],held=crate?.location?.type==='carried'&&crate.location.targetId===a.body.id,loading=c?.kind==='load-crate'&&c.age/c.duration<.95;
      if(!held&&!loading)return null;const sh=jointScreen(a.h.rig,cv,a.root,'shC');let center=[sh[0]+3,sh[1]+17];
      if(c?.kind==='carry-crate'&&c.from)center=mixPoint(project(c.from.x,c.from.y,(c.from.z||WORLD.searchSites.chargeCrate.z)+12),center,smooth(clamp01((c.age/c.duration-.18)/.65)));
      if(c?.kind==='unload-crate'&&all[c.sourceId]){const horse=all[c.sourceId],start=project(...mount(horse).world(horse,[-22,-10,37]));center=mixPoint(start,center,smooth(clamp01((c.age/c.duration-.15)/.7)));}
      if(loading&&all[crate?.location?.targetId]){const horse=all[crate.location.targetId],end=project(...mount(horse).world(horse,[-22,-10,37]));center=mixPoint(center,end,smooth(clamp01((c.age/c.duration-.15)/.7)));}
      a.pair([center[0]-12,center[1]],[center[0]+12,center[1]],31,1,'sealed-crate-grips');return center;
    };
    const finish=(g,a,{carrying=false,bound=false}={})=>{
      const body=a.body,h=a.h,rig=h.rig,clip=animation.clip(body.id),weapon=s.weapons?.[body.equippedWeaponId]||body.weapon,alertEnemy=body.category==='enemy'&&body.active&&!body.surrendered,held=body.hp>0&&(body.holstered===false||alertEnemy)&&(body.id==='mara'?s.aiming||body.shotTimer>0||body.reloadTimer>0:alertEnemy||body.aiming||body.shotTimer>0||body.reloadTimer>0||['combat','cover','shooting'].includes(body.ai?.phase));let carbine;
      if(!carrying&&!bound&&!body.bound&&!body.restrained&&held&&weapon&&weapon.kind!=='bow'){
        const height=(body.z||0)+(body.mounted?64:29),f=body.facing||0,source=project(body.x+Math.cos(f)*16,body.y+Math.sin(f)*16,height);
        carbine=poseRivalCarbine(E,rig,r.view,a.root,source,{kind:['sidearm','revolver'].includes(weapon.kind)?'sidearm':'carbine',reload:body.reloadTimer>0?Math.min(1,body.reloadTimer):0,cycle:weapon.kind==='carbine'&&clip?.kind==='lever-cycle'?clamp01(clip.age/clip.duration):0,recoil:body.shotTimer||0});
        const hit=jointScreen(rig,cv,a.root,carbine.tip);contacts.push({actorId:body.id,kind:'physical-muzzle',side:'tip',target:source,hit,error:Math.hypot(hit[0]-source[0],hit[1]-source[1])});
        for(const side of['L','R']){const target=jointScreen(rig,cv,a.root,carbine[side==='L'?'leftContact':'rightContact']),hit=jointScreen(rig,cv,a.root,'hand'+side);contacts.push({actorId:body.id,kind:side==='R'&&clip?.kind==='lever-cycle'?'lever-contact':'firearm-grip',side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}
      }
      rig.draw(g,...a.root,r.view);drawRivalOutfit(E,g,a.root,h,r.view,clip?.kind==='bind'&&clip.targetId===body.id?{...body,binding:true}:body,s);if(carbine)drawRivalCarbine(E,g,rig,a.root,r.view,carbine);
      if(!carrying&&!carbine){
        const hip=jointScreen(rig,cv,a.root,'hipR'),sh=jointScreen(rig,cv,a.root,'shL');
        if(weapon&&weapon.kind!=='bow'&&body.id!=='levi'){P.rect(g,hip[0]-2,hip[1]-1,5,9,'#745c43');P.line(g,hip[0]-2,hip[1]-2,hip[0]+2,hip[1]-2,'#aeb79e',2);}
        if(weapon?.kind==='carbine'||weapon?.kind==='repeater'||weapon?.kind==='coach-gun'){P.line(g,sh[0]-3,sh[1]+1,hip[0]-8,hip[1]+10,'#8d704b',4);P.line(g,sh[0]-4,sh[1]-9,sh[0]-3,sh[1]+1,'#768d80',2);}
      }
      if(body.id==='mara'&&(scope.active||scope.raised||clip?.kind==='sightglass')){
        const hand=jointScreen(rig,cv,a.root,'handR'),left=jointScreen(rig,cv,a.root,'handL');P.line(g,...hand,...left,'#b3a77d',5);P.line(g,hand[0],hand[1]-1,left[0],left[1]-1,'#dbc89d',1);P.disc(g,...left,3,'#304e54');
      }
      if(body.id==='mara'&&!carrying){const hand=jointScreen(rig,cv,a.root,'handR'),gift=animation.clip('inez'),receiving=gift?.kind==='give-lariat'&&gift.age/gift.duration<.84;if(clip?.kind==='lariat-throw'){const u=clamp01(clip.age/clip.duration);P.ell(g,hand[0]+8*Math.sin(u*Math.PI*2),hand[1]-8,9*(1-u)+3,3,'#c6ad7c');}else if(!receiving&&(s.weapons?.['working-lariat']?.owner==='mara'||s.tools?.lariat)){const hip=jointScreen(rig,cv,a.root,'hipL');for(let i=0;i<3;i++){g.beginPath();g.ellipse(hip[0]-5,hip[1]+5,6+i,4+i,0,0,Math.PI*2);g.strokeStyle='#bfa476';g.lineWidth=1;g.stroke();}g._c=null;}}
      if(['give-carbine','give-lariat','give-sightglass','give-cartridges','give-cap','pass-charge','give-plans','card-tear'].includes(clip?.kind)&&clip.age/clip.duration<.84){const at=jointScreen(rig,cv,a.root,clip.kind==='give-plans'?'handL':'handR');if(clip.kind==='give-carbine'){P.line(g,at[0]-12,at[1]+3,at[0]+14,at[1]-3,'#8c6847',4);P.line(g,at[0]+5,at[1]-2,at[0]+19,at[1]-5,'#acb9a4',2);}else if(clip.kind==='give-lariat'){g.beginPath();g.ellipse(at[0],at[1]+5,7,5,0,0,Math.PI*2);g.strokeStyle='#c7ae7c';g.lineWidth=2;g.stroke();g._c=null;}else if(clip.kind==='give-sightglass'){P.line(g,at[0]-6,at[1],at[0]+6,at[1],'#c2b27f',4);}else if(clip.kind==='give-cartridges'){P.rect(g,at[0]-6,at[1]-3,12,7,'#baa276');for(let n=0;n<3;n++)P.line(g,at[0]-4+n*4,at[1]-1,at[0]-4+n*4,at[1]+2,'#e2c17f',1);}else if(clip.kind==='give-cap'){P.rect(g,at[0]-5,at[1]-3,10,7,'#ac7650');P.line(g,at[0]-5,at[1]-3,at[0]+5,at[1]-3,'#dfb883',2);}else if(clip.kind==='pass-charge'){P.rect(g,at[0]-4,at[1]-1,8,6,'#8d7654');P.line(g,at[0]-3,at[1],at[0]+3,at[1],'#c7b180',1);}else{P.rect(g,at[0]-6,at[1]-4,12,9,'#d1c19a');P.line(g,at[0]-3,at[1]-2,at[0]+4,at[1]-2,'#7c6b51',1);}}
      drawn.push(body.id);roots.push({id:body.id,root:a.root.slice(),ground:project(body.x,body.y,body.z||0),handR:jointScreen(rig,cv,a.root,'handR'),handL:jointScreen(rig,cv,a.root,'handL')});contacts.push(...a.diagnostics);
    };
    // Captive manipulation and its carrier share one depth group. The single
    // authoritative body is interpolated through a lift or load, never cloned.
    for(const captive of Object.values(all).filter(b=>live(b)&&!isMount(b)&&b.id==='levi')){
      const c=animation.clip(captive.id),attachment=captive.attachment,carrier=attachment?.type==='carried'?all[attachment.targetId]:c&&carryKinds.has(c.kind)&&c.kind!=='unload'?all[c.actorId]:null;
      if(!carrier||!live(carrier)||attachment&&['passenger','rear-passenger'].includes(attachment.type)&&!carryKinds.has(c?.kind))continue;used.add(carrier.id);used.add(captive.id);
      if(c?.kind==='handoff'&&all[c.actorId]&&all[c.actorId]!==carrier)used.add(c.actorId);
      if(!r.visible(carrier.x,carrier.y,carrier.z||0,240,230,160))continue;
      r.queue(carrier.x,carrier.y,carrier.z||0,g=>{
        const a=prep(carrier),h=human(captive),restore=(()=>{const b=prep(captive);return b;})(),u=c?clamp01(c.age/c.duration):1;
        try{
          const upright=Object.fromEntries(Object.entries(h.rig.J).map(([key,p])=>[key,p.slice()]));boundRivalPose(E,h.rig,{prone:true,carried:true});const prone=Object.fromEntries(Object.entries(h.rig.J).map(([key,p])=>[key,p.slice()])),seatedMount=c?.kind==='load'?all[attachment?.targetId]:c?.kind==='unload'?all[c.sourceId]:null;
          if(seatedMount&&isMount(seatedMount)){
            h.rig.J=upright;const sockets=mount(seatedMount).sockets(r,seatedMount),rear={...sockets,saddle:sockets.rear,stirrupL:sockets.rearStirrupL,stirrupR:sockets.rearStirrupR},seat=seatPose(E,h.rig,cv,project(seatedMount.x,seatedMount.y,seatedMount.z||0),rear,1,true);fitRivalSeatFeet(E,h.rig,cv,seat,rear);boundRivalPose(E,h.rig);const blend=c.kind==='load'?smooth(clamp01((u-.45)/.48)):1-smooth(clamp01((u-.16)/.68));for(const[key,p]of Object.entries(prone))h.rig.J[key]=mixPoint(p,h.rig.J[key],blend);
          }
          const center=jointScreen(h.rig,cv,[0,0],'hipC'),shoulder=jointScreen(a.h.rig,cv,a.root,'shC');let placement=[shoulder[0],shoulder[1]-3];
          if(c?.kind==='lift'&&c.from)placement=mixPoint(project(c.from.x,c.from.y,(c.from.z||0)+9),placement,smooth(clamp01((u-.16)/.68)));
          if(c?.kind==='unload'&&all[c.sourceId]){const horse=all[c.sourceId];placement=mixPoint(mount(horse).sockets(r,horse).rear,placement,smooth(clamp01((u-.16)/.68)));}
          if(c&&['load','setdown','holding-transfer'].includes(c.kind)&&c.target){const horse=all[c.targetId]&&isMount(all[c.targetId])?all[c.targetId]:all[attachment?.targetId],destination=c.kind==='load'&&horse&&isMount(horse)?mount(horse).sockets(r,horse).rear:project(c.target.x,c.target.y,(c.target.z||0)+10);placement=mixPoint(placement,destination,smooth(clamp01((u-.2)/.65)));}
          let giver;if(c?.kind==='handoff'&&all[c.actorId]&&all[c.actorId]!==carrier){const source=all[c.actorId];used.add(source.id);giver=prep(source);const from=jointScreen(giver.h.rig,cv,giver.root,'shC');placement=mixPoint([from[0],from[1]-3],placement,smooth(u));}
          restore.root=placement.map((n,i)=>n-center[i]);const left=jointScreen(h.rig,cv,restore.root,'hipL'),right=jointScreen(h.rig,cv,restore.root,'shR'),weight=c&&['load','setdown','handoff','holding-transfer'].includes(c.kind)?1-smooth(clamp01((u-.75)/.2)):c?.kind==='lift'?smooth(clamp01(u/.25)):1;
          lowerTorso(E,a.h.rig,Math.sin(u*Math.PI)*2,1);a.pair(left,right,35,giver?smooth(u):weight,'bound-human-support');if(giver){giver.pair(left,right,35,1-smooth(u),'bound-human-handoff');finish(g,giver,{carrying:true});giver.restore();}finish(g,a,{carrying:true});finish(g,restore,{carrying:true,bound:true});
        }finally{a.restore();restore.restore();}
      });
    }
    for(const horse of Object.values(all).filter(b=>live(b)&&isMount(b))){
      if(used.has(horse.id))continue;used.add(horse.id);const driver=Object.values(all).find(b=>live(b)&&!isMount(b)&&b.mounted&&(b.mountId===horse.id||b.id==='mara'&&s.horse?.id===horse.id||b.id==='tomas'&&horse.id==='tomas-mount'||b.id==='inez'&&horse.id==='thimble'));
      const passenger=Object.values(all).find(b=>live(b)&&b.attachment&&['passenger','rear-passenger'].includes(b.attachment.type)&&b.attachment.targetId===horse.id&&!used.has(b.id));if(driver)used.add(driver.id);if(passenger)used.add(passenger.id);
      if(!r.visible(horse.x,horse.y,horse.z||0,230,220,140))continue;r.shadow(horse.x,horse.y,27,.21,'#314d50',horse.z||0);
      r.queue(horse.x,horse.y,horse.z||0,g=>{
        const hr=mount(horse);hr.pose(horse);hr.draw(g,r,horse);drawn.push(horse.id);roots.push({id:horse.id,root:project(horse.x,horse.y,horse.z||0),ground:project(horse.x,horse.y,horse.z||0)});const sockets=hr.sockets(r,horse);
        const a=driver&&prep(driver,{mounted:true,sockets,passengerHip:sockets.rear});let passengerPose;
        try{
          if(passenger){passengerPose=prep(passenger);const rig=passengerPose.h.rig,rear={...sockets,saddle:sockets.rear,stirrupL:sockets.rearStirrupL,stirrupR:sockets.rearStirrupR};passengerPose.root=seatPose(E,rig,cv,passengerPose.root,rear,1,true);fitRivalSeatFeet(E,rig,cv,passengerPose.root,rear);boundRivalPose(E,rig);finish(g,passengerPose,{bound:true});for(const side of['L','R']){const target=rear['stirrup'+side],hit=jointScreen(rig,cv,passengerPose.root,'foot'+side);contacts.push({actorId:passenger.id,kind:'bound-passenger-seat',side:'foot'+side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}if(passenger.attachment.strap||passenger.attachment.strapped){const sh=jointScreen(rig,cv,passengerPose.root,'shC'),hip=jointScreen(rig,cv,passengerPose.root,'hipC');P.line(g,sh[0]-5,sh[1]+1,hip[0]+6,hip[1]+4,'#c9b284',3);P.line(g,hip[0]-6,hip[1]+4,hip[0]+6,hip[1]+4,'#7f6b4c',3);P.rect(g,hip[0]+3,hip[1]+2,4,4,'#c9c3a1');}}
          if(a){const crate=crateContact(a);finish(g,a,{carrying:!!crate});if(crate)crateShape(g,crate);}
          const cargo=objects['charge-crate'],loading=animation.clip(cargo?.owner||'ruth');if(cargo?.location?.type==='saddle'&&cargo.location.targetId===horse.id&&!(loading?.kind==='load-crate'&&loading.age/loading.duration<.95)){const at=project(...hr.world(horse,[-22,-10,37]));crateShape(g,at);P.line(g,at[0]-12,at[1]-6,at[0]+13,at[1]+6,'#d3bb89',2);}
          const rack=Object.values(s.weapons||{}).find(w=>(w.location==='saddle'||w.location?.type==='saddle')&&(w.rackMountId===horse.id||w.location?.targetId===horse.id)&&['carbine','repeater','coach-gun'].includes(w.kind)),gift=animation.clip('tomas'),beingPlaced=gift?.kind==='give-carbine'&&gift.targetId===rack?.id&&gift.age/gift.duration<.84;if(rack&&!beingPlaced){const start=project(...hr.world(horse,[-25,-10,35])),end=project(...hr.world(horse,[9,-10,37]));P.line(g,...start,...end,'#8b6847',4);P.line(g,end[0],end[1],end[0]+8,end[1]-2,'#adc0aa',2);}
        }finally{if(a)a.restore();if(passengerPose)passengerPose.restore();}
      });
    }
    for(const body of Object.values(all)){
      if(!live(body)||used.has(body.id)||isMount(body)||body.attachment&&['carried','passenger','rear-passenger'].includes(body.attachment.type))continue;used.add(body.id);
      if(!r.visible(body.x,body.y,body.z||0,200,240,130))continue;r.shadow(body.x,body.y,body.bound?17:10,.16,'#43564c',body.z||0);
      r.queue(body.x,body.y,body.z||0,g=>{
        const c=animation.clip(body.id);let horse=null;if(c&&['mount','dismount','hitch','equip','give-carbine'].includes(c.kind))horse=all[c.targetId]?.kind==='horse'?all[c.targetId]:all[c.sourceId]?.kind==='horse'?all[c.sourceId]:null;
        const a=prep(body,horse?{sockets:mount(horse).sockets(r,horse),propPoint:project(...mount(horse).world(horse,[-18,-8,38]))}:{});
        try{
          boundBody(a);
          const crate=crateContact(a);
          if(crate){finish(g,a,{carrying:true});crateShape(g,crate);}
          else finish(g,a,{bound:body.id==='levi'&&body.bound});
        }finally{a.restore();}
      });
    }
    const target=all[rope.targetId],tip=rope.projectile||rope.tip||rope.head||rope.end||(Number.isFinite(rope.x)?rope:null),taut=['taut','caught','attached'].includes(rope.phase);
    if(taut&&target||tip&&['throwing','flying','missed','returning'].includes(rope.phase)){
      const player=all[rope.actorId||'mara']||s.player,end=taut&&target?project(target.x,target.y,(target.z||0)+(target.mounted?64:25)):project(tip.x,tip.y,tip.z||25);
      r.queue(player.x,player.y,player.z||0,g=>{const hand=roots.find(q=>q.id===player.id)?.handR||project(player.x,player.y,(player.z||0)+(player.mounted?65:33)),points=rows(rope.path).map(p=>project(p.x,p.y,p.z||25));const chain=[hand,...points,end],tension=rope.tension||0;for(let i=1;i<chain.length;i++){const a=chain[i-1],b=chain[i],sag=taut?Math.max(0,8-tension*8):10;g.beginPath();g.moveTo(...a);g.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2+sag,...b);g.strokeStyle=taut&&tension>.75?'#e0b98a':'#c1a87a';g.lineWidth=2;g.stroke();}g._c=null;if(taut)P.ell(g,...end,7,4,'#c5ad7e');});
    }
    const dropped=[...Object.values(s.weapons||{}).filter(w=>w.location==='dropped'),story.rival?.weaponCustody?.guardWeapon].filter(Boolean);
    for(const gun of dropped){const at=gun.dropPoint;if(!at||at.regionId!==s.region||!r.visible(at.x,at.y,at.z||0,50,50,30))continue;r.queue(at.x,at.y,at.z||0,g=>{const p=project(at.x,at.y,(at.z||0)+3),sidearm=gun.kind==='revolver';P.line(g,p[0]-4,p[1]+2,p[0]+(sidearm?7:15),p[1]-2,'#a7bba9',sidearm?3:4);P.line(g,p[0]-6,p[1]+4,p[0]-3,p[1]+2,'#8d6946',3);if(gun.id==='bastian-engraved-revolver')P.line(g,p[0]-2,p[1],p[0]+4,p[1]-2,'#e0cba1',1);});}
  }
  return{update,draw,human,mount,animation,inspect:()=>({contacts:contacts.map(c=>({...c})),drawn:drawn.slice(),roots:roots.map(p=>({...p})),clips:animation.inspect()})};
}
