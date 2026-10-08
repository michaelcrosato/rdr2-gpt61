import { WILLOW_RUN_WORLD as WORLD, HUNT_ID, huntBowHeading } from '../content/campaign/willow-run.js';
import { getCampaignPresentation } from './campaign.js';
import { WillowAnimalRig, createWillowHuman, drawWillowOutfit, poseWillowBow, fitWillowBowShoulder, drawWillowBow, HUNT_HUMAN_IDS } from './willow-run-rigs.js';
import { createHuntAnimator, prepareHuntHuman } from './willow-run-animation.js';
import { jointScreen, solveLimb, clamp01, smooth } from './western-animation.js';
import { lowerTorso, mixPoint } from './expedition-animation.js';

const rows=v=>Array.isArray(v)?v:Object.values(v||{}),carcassKinds=new Set(['lift','load','unload','deliver','setdown']);
export const isHuntPresentation=s=>s.campaign?.activeMissionId===HUNT_ID;
export const willowEntities=s=>s.entities||Object.fromEntries([s.player,s.horse,...rows(s.npcs),...rows(s.mounts),...rows(s.animals)].filter(Boolean).map(a=>[a.id||'mara',a]));
export function willowResidence(body,all,fallback,seen=new Set()){
  if(!body||seen.has(body.id))return null;seen.add(body.id);
  const a=body.attachment;if(a?.type==='rest')return a.regionId||(['hunt-bench-mara','hunt-bench-juno'].includes(a.targetId)?'snowbound':fallback);
  return a?willowResidence(all[a.targetId],all,fallback,seen):body.regionId||fallback;
}
export function ownsWillowActor(s,body){
  if(!body)return false;
  return ['orla','juno','hob','bracken'].includes(body.id)||body.kind==='deer'||body.kind==='bear'||isHuntPresentation(s)&&(body.id==='mara'||body.id===s.horse?.id);
}
export function createWillowActors(E,game){
  const P=E.px,humans=new Map(),animals=new Map(),positions=new Map(),anim=createHuntAnimator();let stateRef,contacts=[],drawn=[],roots=[];
  const human=id=>{if(!humans.has(id))humans.set(id,createWillowHuman(E,id));return humans.get(id);};
  const animal=body=>{if(!animals.has(body.id))animals.set(body.id,new WillowAnimalRig(E,body.id,body.kind||'horse'));return animals.get(body.id);};
  const active=(body,s,all)=>body&&!body.hidden&&!body.departed&&willowResidence(body,all,s.region)===s.region;
  const motion=(body,dt)=>{const before=positions.get(body.id),vx=before&&dt>0?(body.x-before.x)/dt:body.vx||0,vy=before&&dt>0?(body.y-before.y)/dt:body.vy||0;positions.set(body.id,{x:body.x,y:body.y});return{vx:Math.abs(vx)<650?vx:0,vy:Math.abs(vy)<650?vy:0};};
  function update(dt,s){
    if(s!==stateRef){stateRef=s;positions.clear();}
    anim.update(dt,s,getCampaignPresentation(s),game.reduceMotion);const all=willowEntities(s);
    for(const body of Object.values(all)){
      if(!active(body,s,all)||!ownsWillowActor(s,body))continue;const m=motion(body,dt);
      if(body.kind==='horse'||body.kind==='deer'||body.kind==='bear'||body.category==='mount'){animal({...body,kind:body.kind||'horse'}).update(dt,{...body,...m},game.reduceMotion);continue;}
      if(!HUNT_HUMAN_IDS.has(body.id))continue;
      const h=human(body.id);h.rig.update(dt,{...body,...m,z:0,vx:body.mounted?0:m.vx,vy:body.mounted?0:m.vy,point:false,pose:body.hp<=0?'die':body.crouch?'crouch':body.carrying?'guard':null});
    }
  }
  function draw(r,s){
    contacts=[];drawn=[];roots=[];const all=willowEntities(s),cv=E.charView(r.view),used=new Set(),project=(x,y,z=0)=>r.w(x,y,z),processing=rows(s.processing).filter(p=>p?.kind==='skin');
    const live=body=>active(body,s,all)&&ownsWillowActor(s,body),dead=body=>body?.kind==='deer'&&(body.dead||body.hp<=0)&&!body.processed&&body.hunt?.life!=='processed';
    const bodies=Object.values(all).filter(b=>live(b)&&dead(b));
    const prep=(body,extra={})=>{const h=human(body.id),baseFacing=h.rig.facing,bow=s.weapons?.[body.equippedWeaponId]?.kind==='bow',release=anim.clip(body.id)?.kind==='release-bow';if(body.id==='mara'&&bow&&(s.aiming||s.bow?.drawing||release))h.rig.facing=release?body.facing||0:huntBowHeading(body,s.bow);const a=prepareHuntHuman(E,body,h.rig,project(body.x,body.y,body.z||0),r.view,{clip:anim.clip(body.id),project,...extra}),restore=a.restore;a.restore=()=>{restore();h.rig.facing=baseFacing;};a.h=h;return a;};
    const pelt=(g,at,quality=3)=>{P.poly(g,[[at[0]-11,at[1]-3],[at[0]+9,at[1]-4],[at[0]+13,at[1]+5],[at[0]+7,at[1]+16],[at[0]-1,at[1]+13],[at[0]-9,at[1]+17],[at[0]-14,at[1]+5]],quality>1?'#bfa16e':'#9d885f');P.line(g,at[0]-7,at[1]+2,at[0]+7,at[1]+1,'#d6bc8b',2);P.line(g,at[0]-8,at[1]+7,at[0]+5,at[1]+7,'#a38c60',1);};
    const finish=(g,a,options={})=>{
      const body=a.body,rig=a.h.rig,clip=anim.clip(body.id),gearBow=clip?.targetId==='juno-ash-bow'&&(['store-bow','give-bow'].includes(clip.kind)||clip.kind==='equip'&&all[clip.sourceId]?.kind==='horse');let bow;
      if(body.id==='mara'&&!body.carrying&&!options.carrying&&s.weapons?.[body.equippedWeaponId]?.kind==='bow'){
        const drawing=!!s.bow?.drawing,release=clip?.kind==='release-bow',nocking=clip?.kind==='nock-arrow',held=drawing||s.aiming||release||nocking;
        if(held){
          const aim=s.bow?.aim||{x:body.x+100,y:body.y,z:32},height=(body.z||0)+(body.mounted?48:body.crouch?22:32),pitch=Math.atan2((aim.z??height)-height,Math.max(1,Math.hypot(aim.x-body.x,aim.y-body.y)));
          const heading=release?body.facing||0:huntBowHeading(body,s.bow);rig.facing=heading;
          const source=project(body.x+Math.cos(heading)*14,body.y+Math.sin(heading)*14,height),grip=fitWillowBowShoulder(E,rig,r.view,a.root,source);
          bow=poseWillowBow(E,rig,release?Math.max(0,1-(anim.clip('mara').age/.32)*4):s.bow?.charge||0,pitch,s.bow?.sway||0,grip);
          if(nocking){const u=clamp01(clip.age/clip.duration),J=rig.J,from=[J.shL[0]-2,J.shL[1]+3,J.shL[2]+4],target=from.map((n,i)=>n+(bow.nock[i]-n)*smooth(clamp01((u-.15)/.85)));solveLimb(E,rig,'R',target);}
          const hit=jointScreen(rig,cv,a.root,bow.grip);contacts.push({actorId:body.id,kind:'arrow-release-origin',side:'L',target:source,hit,error:Math.hypot(hit[0]-source[0],hit[1]-source[1])});
        }
      }
      rig.draw(g,...a.root,r.view);drawWillowOutfit(E,g,a.root,a.h,r.view,body,s);
      if(bow){const nocking=clip?.kind==='nock-arrow',u=nocking?clamp01(clip.age/clip.duration):1;drawWillowBow(E,g,r,rig,a.root,bow,{arrow:nocking?u>.98:clip?.kind!=='release-bow'||clip.age<.04});if(nocking&&u<=.98){const hand=jointScreen(rig,cv,a.root,'handR'),end=jointScreen(rig,cv,a.root,[rig.J.handR[0]+10,rig.J.handR[1],rig.J.handR[2]]);P.line(g,...hand,...end,'#d3c098',1);P.line(g,hand[0],hand[1]-2,hand[0]+2,hand[1]+1,'#c1cbaf',2);}for(const side of['L','R']){if(nocking&&side==='R'&&u<.999)continue;const target=jointScreen(rig,cv,a.root,bow[side==='L'?'grip':'nock']),hit=jointScreen(rig,cv,a.root,'hand'+side);contacts.push({actorId:body.id,kind:'bow-'+(side==='L'?'grip':'nock'),side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}}
      else if(body.id==='mara'&&!options.carrying&&!body.carrying&&!gearBow){
        const weapon=s.weapons?.[body.equippedWeaponId],sh=jointScreen(rig,cv,a.root,'shL'),hip=jointScreen(rig,cv,a.root,'hipR');
        if(weapon?.kind==='bow'){const at=p=>jointScreen(rig,cv,a.root,p),a0=at([rig.J.shL[0]-1,rig.J.shL[1],rig.J.shL[2]+5]),a1=at([rig.J.hipR[0]-1,rig.J.hipR[1],rig.J.hipR[2]-5]);P.line(g,...a0,...a1,'#826843',3);P.line(g,a0[0]+3,a0[1],a1[0]+3,a1[1],'#cfb987',1);}
        else if(weapon&&body.holstered===false&&(s.aiming||body.shotTimer>0)){const hand=jointScreen(rig,cv,a.root,'handR'),tip=jointScreen(rig,cv,a.root,[rig.J.handR[0]+(weapon.kind==='coach-gun'?10:4),rig.J.handR[1],rig.J.handR[2]]);P.line(g,...hand,...tip,'#4c5f57',weapon.kind==='coach-gun'?5:3);P.line(g,hand[0],hand[1]-1,tip[0],tip[1]-1,'#b2b6a1',1);P.line(g,hand[0]-2,hand[1],hand[0]-3,hand[1]+4,'#8d6845',3);}
        else{P.rect(g,hip[0]-3,hip[1],6,10,'#795d40');P.line(g,hip[0]-2,hip[1]-2,hip[0]+2,hip[1]-1,'#9dada0',2);}
      }
      if(gearBow&&(clip.kind!=='give-bow'||clip.age/clip.duration<.78)){const grip=rig.J[clip.kind==='give-bow'?'handL':'handR'],shape={grip,nock:grip,top:[grip[0]+2,grip[1],grip[2]+10.5],bottom:[grip[0]+2,grip[1],grip[2]-10.5],tip:grip};drawWillowBow(E,g,r,rig,a.root,shape,{arrow:false});}
      if(body.id==='mara'){
        const sh=jointScreen(rig,cv,a.root,'shL'),hip=jointScreen(rig,cv,a.root,'hipR'),bowOwned=s.weapons?.['juno-ash-bow']?.owner==='mara';
        if(bowOwned){P.line(g,sh[0]-4,sh[1]+4,hip[0]-8,hip[1]+7,'#6d583f',6);for(let i=0;i<Math.min(4,(s.weapons['juno-ash-bow'].ammo||0)+(s.weapons['juno-ash-bow'].reserve||0));i++){P.line(g,sh[0]-7+i*2,sh[1]-9,sh[0]-7+i*2,sh[1]+10,'#c4b085',1);P.line(g,sh[0]-9+i*2,sh[1]-8,sh[0]-7+i*2,sh[1]-5,'#d1d0b0',2);}}
        const c=clip,carriedHide=Object.values(s.itemInstances||{}).find(i=>i.kind==='deer-hide'&&i.location?.type==='carried'&&i.location.targetId===body.id),placingHide=['hang-hide','store-hide'].includes(c?.kind)&&c.age/c.duration<.72?s.itemInstances?.[c.targetId]:null,h=carriedHide||placingHide;
        if(h&&!options.carrying){let at=jointScreen(rig,cv,a.root,bow?'hipL':'handL');if(c?.kind==='lift-hide'&&c.from)at=mixPoint(project(c.from.x,c.from.y,c.from.z||24),at,smooth(clamp01(c.age/c.duration/.6)));if(placingHide&&c.target){const destination=c.kind==='store-hide'&&all[c.target.id||h.location?.targetId]?animal(all[h.location.targetId]).world(all[h.location.targetId],[-24,-10,33]):[c.target.x,c.target.y,(c.target.z||0)+46];at=mixPoint(at,project(...destination),smooth(clamp01(c.age/c.duration/.72)));}pelt(g,at,h.quality);}
      }
      drawn.push(body.id);roots.push({id:body.id,root:a.root.slice(),ground:project(body.x,body.y,body.z||0)});contacts.push(...a.diagnostics);
    };
    const embedded=(g,body,ar,skin)=>{for(const arrow of s.bow?.arrows||[]){if(arrow.phase!=='embedded'||arrow.targetId!==body.id)continue;const joint=arrow.targetZone==='vital'?'chest':['head','neck'].includes(arrow.targetZone)?arrow.targetZone:'body',p=ar.J[joint],co=Math.cos(body.facing||0),si=Math.sin(body.facing||0),speed=Math.hypot(arrow.vx||0,arrow.vy||0,arrow.vz||0)||1,dx=((arrow.vx||9)*co+(arrow.vy||0)*si)/speed,dy=(-(arrow.vx||9)*si+(arrow.vy||0)*co)/speed,dz=(arrow.vz||0)/speed,at=skin.at(p),tail=skin.at([p[0]-dx*13,p[1]-dy*13,p[2]-dz*13+2]);P.line(g,...tail,...at,'#dbc49a',1);P.line(g,tail[0]-2,tail[1],tail[0]+2,tail[1]+1,'#cad5b6',2);}};
    const carcass=(g,body,origin,screenOffset=[0,0],progress=0)=>{const ar=animal(body),c=anim.clip(body.id),posed=c?.kind==='animal-collapse'?{...body,presentationFall:clamp01(c.age/c.duration)}:body;ar.pose(posed);const skin=ar.draw(g,r,body,{origin,screenOffset,skinProgress:progress});embedded(g,body,ar,skin);drawn.push(body.id);roots.push({id:body.id,root:project(origin.x,origin.y,origin.z||0).map((n,i)=>n+screenOffset[i]),ground:project(body.x,body.y,body.z||0)});return skin;};
    const support=(a,points,w=1)=>{if(a.body.id==='juno'){a.hand(points[0],'L',35,w,true,'healthy-left-shoulder');const J=a.h.rig.J;solveLimb(E,a.h.rig,'R',[J.hipC[0]+1,J.hipC[1]+3,J.hipC[2]+4]);}else a.pair(points[0],points[1],35,w);};
    const carriedPlacement=a=>{const sh=jointScreen(a.h.rig,cv,a.root,a.body.id==='juno'?'shL':'shC');return[sh[0]+(a.body.id==='juno'?-5:3),sh[1]-3];};
    // Every dead animal enters exactly one render group. Its attachment is its
    // sole location; clips interpolate that body's presentation, never a copy.
    for(const body of bodies){
      const c=anim.clip(body.id),attachment=body.attachment,carrier=attachment?.type==='carried'?all[attachment.targetId]:c&&['deliver','load','setdown'].includes(c.kind)?all[c.actorId]:null;
      if(!carrier||!live(carrier)||attachment?.type==='large-load'&&c?.kind!=='load')continue;
      if(!r.visible(carrier.x,carrier.y,carrier.z||0,230,200,140))continue;
      used.add(carrier.id);used.add(body.id);
      r.queue(carrier.x,carrier.y,carrier.z||0,g=>{
        const a=prep(carrier),origin={x:carrier.x,y:carrier.y,z:carrier.z||0},u=c?clamp01(c.age/c.duration):1;
        let facing=carrier.facing||0;if(c&&['load','deliver','setdown'].includes(c.kind)){const destination=c.kind==='load'?(all[attachment?.targetId]?.facing||0):0,difference=Math.atan2(Math.sin(destination-facing),Math.cos(destination-facing));facing+=difference*smooth(clamp01((u-.2)/.65));}
        const drawBody={...body,facing},ar=animal(drawBody);ar.pose(drawBody);const center=project(...ar.world(drawBody,'body',origin));
        let at=carriedPlacement(a);
        if(c?.kind==='lift'&&c.from){const from=project(c.from.x,c.from.y,(c.from.z||0)+7);at=mixPoint(from,at,smooth(clamp01((u-.18)/.65)));lowerTorso(E,a.h.rig,3*(1-smooth(u)),2*(1-smooth(u)));}
        if(c?.kind==='unload'&&all[c.sourceId]){const mount=all[c.sourceId],p=project(...animal(mount).world(mount,[-22,0,47]));at=mixPoint(p,at,smooth(clamp01((u-.15)/.7)));}
        if(c&&['load','deliver','setdown'].includes(c.kind)&&c.target){const mount=all[attachment?.targetId||c.sourceId||c.targetId],end=c.kind==='load'&&mount?.kind==='horse'?project(...animal(mount).world(mount,[-22,0,47])):project(c.target.x,c.target.y,(c.target.z||0)+7);at=mixPoint(at,end,smooth(clamp01((u-.2)/.65)));}
        const offset=at.map((n,i)=>n-center[i]),point=p=>{const q=project(...ar.world(drawBody,p,origin));return q.map((n,i)=>n+offset[i]);};
        const grips=[point([-8,-4,8]),point([8,-4,8])];support(a,grips,c&&['load','deliver','setdown'].includes(c.kind)?1-smooth(clamp01((u-.72)/.2)):c?.kind==='lift'?smooth(clamp01(u/.3)):1);
        try{finish(g,a,{carrying:true});carcass(g,drawBody,origin,offset);if(c?.kind==='load'){P.line(g,...point([-20,-5,10]),...point([-20,5,10]),'#c4ac79',2);P.line(g,...point([8,-5,10]),...point([8,5,10]),'#c4ac79',2);}}finally{a.restore();}
      });
    }
    for(const mount of Object.values(all).filter(b=>live(b)&&(b.kind==='horse'||b.category==='mount'))){
      if(used.has(mount.id))continue;used.add(mount.id);const cargo=bodies.find(b=>b.attachment?.type==='large-load'&&b.attachment.targetId===mount.id&&!used.has(b.id));
      const driver=Object.values(all).find(b=>live(b)&&HUNT_HUMAN_IDS.has(b.id)&&b.mounted&&(b.mountId===mount.id||b.id==='mara'&&s.horse?.id===mount.id||b.id==='juno'&&mount.id==='bracken'));
      if(driver&&!used.has(driver.id))used.add(driver.id);if(cargo)used.add(cargo.id);
      if(!r.visible(mount.x,mount.y,mount.z||0,220,220,130))continue;r.shadow(mount.x,mount.y,28,.22,'#475952',mount.z||0);
      r.queue(mount.x,mount.y,mount.z||0,g=>{
        const hr=animal(mount);hr.pose(mount);hr.draw(g,r,mount);drawn.push(mount.id);const sockets=hr.sockets(r,mount);
        const gear=anim.clip('mara'),gift=anim.clip('juno'),stored=Object.values(s.weapons||{}).find(w=>w.kind==='bow'&&w.location==='saddle'&&w.rackMountId===mount.id);if(stored&&!(gear?.kind==='store-bow'&&gear.targetId===stored.id)&&!(gift?.kind==='give-bow'&&gift.targetId===stored.id&&gift.age/gift.duration<.78)){const a=project(...hr.world(mount,[-20,-8,35])),b=project(...hr.world(mount,[12,-8,38]));P.line(g,...a,...b,'#8f7044',3);P.line(g,a[0],a[1]+3,b[0],b[1]+3,'#c6b185',1);}
        if(cargo){const origin={x:mount.x,y:mount.y,z:(mount.z||0)+40},body={...cargo,facing:mount.facing||0};const skin=carcass(g,body,origin);for(const f of[-18,10])P.line(g,...skin.at([f,-7,8]),...skin.at([f,7,8]),'#d0b781',3);}
        const placing=anim.clip('mara'),hides=Object.entries(s.itemInstances||{}).filter(([id,i])=>i.kind==='deer-hide'&&i.location?.type==='saddle'&&i.location.targetId===mount.id&&!(placing?.kind==='store-hide'&&placing.targetId===id&&placing.age/placing.duration<.72));for(let i=0;i<hides.length;i++){const at=project(...hr.world(mount,[-24,-10,33-i*3]));P.line(g,at[0]-10,at[1],at[0]+10,at[1],'#aa8d60',8);P.line(g,at[0]-5,at[1]-3,at[0]-5,at[1]+3,'#d4ba87',2);}
        if(driver&&!drawn.includes(driver.id)){const a=prep(driver,{mounted:true,sockets});try{finish(g,a);}finally{a.restore();}}
      });
    }
    for(const body of Object.values(all)){
      if(!live(body)||used.has(body.id)||body.processed||body.hunt?.life==='processed')continue;
      if(body.kind==='deer'||body.kind==='bear'){
        used.add(body.id);if(!r.visible(body.x,body.y,body.z||0,150,160,90))continue;r.shadow(body.x,body.y,body.kind==='bear'?29:21,.18,'#44584d',body.attachment?.type==='rest'?0:body.z||0);
        r.queue(body.x,body.y,body.z||0,g=>{const p=processing.find(p=>p.targetId===body.id);if(dead(body))carcass(g,body.attachment?.type==='rest'?{...body,facing:0}:body,body,[0,0],p?.progress||0);else{const ar=animal(body);ar.pose(body);const skin=ar.draw(g,r,body);embedded(g,body,ar,skin);drawn.push(body.id);}});continue;
      }
      if(!HUNT_HUMAN_IDS.has(body.id)||body.attachment)continue;used.add(body.id);if(!r.visible(body.x,body.y,body.z||0,180,220,110))continue;r.shadow(body.x,body.y,10,.18,'#4c594a',body.z||0);
      r.queue(body.x,body.y,body.z||0,g=>{
        const c=anim.clip(body.id),seatMount=c&&['mount','dismount','hitch'].includes(c.kind)?all[c.targetId]:null,propMount=c&&['equip','give-bow'].includes(c.kind)?all[c.sourceId]?.kind==='horse'?all[c.sourceId]:null:c&&['store-bow','store-hide'].includes(c.kind)?s.horse:null,a=prep(body,{sockets:seatMount&&animal(seatMount).sockets(r,seatMount),propPoint:propMount&&project(...animal(propMount).world(propMount,[-18,-8,38]))}),p=processing.find(p=>p.actorId===body.id&&p.phase!=='approach'),patient=p&&all[p.targetId];
        try{
          if(p&&patient){
            a.preserveFeet=true;
            const progress=clamp01(p.progress),drawBody={...patient,facing:0},ar=animal(drawBody);ar.pose(drawBody);const cutForward=-12+progress*33,knife=project(...ar.world(drawBody,[cutForward,-6,9])),lift=project(...ar.world(drawBody,[cutForward-4,-6,12]));
            lowerTorso(E,a.h.rig,1.5,2);a.pair(lift,knife,33,1,'skinning-contact');
            // A short steel edge stays at the actual contact rather than being
            // a sword-shaped built-in gun accessory.
            finish(g,a);P.line(g,...knife,knife[0]+5,knife[1]-2,'#c3c4a9',2);P.line(g,knife[0]-3,knife[1]+1,knife[0],knife[1],'#826244',3);
            const h=project(...ar.world(drawBody,[cutForward-8,-6,15]));P.poly(g,[[lift[0]-5,lift[1]+1],[lift[0]+5,lift[1]+1],[h[0]+6,h[1]+8],[h[0]-8,h[1]+8]],'#b29465');
          }else{
            const first=s.processing?.player,guide=WORLD.camp.workpoints.guide,cookAt=WORLD.camp.workpoints.cook,guiding=body.id==='orla'&&!s.processing?.orla&&first?.phase==='working'&&first.age<1.2&&Math.hypot(body.x-guide.x,body.y-guide.y)<10;
            if(guiding){const target=project(137,1251,36);a.preserveFeet=true;lowerTorso(E,a.h.rig,1,1);a.hand(target,'L',36,1,true,'skinning-guide');}
            const cook=s.processing?.cook;let spoon;if(body.id==='orla'&&cook&&Math.hypot(body.x-cookAt.x,body.y-cookAt.y)<10){const phase=cook.progress*Math.PI*5,stir=project(85+Math.cos(phase)*3,1320+Math.sin(phase)*3,30);a.preserveFeet=true;lowerTorso(E,a.h.rig,1,1.5);a.hand(stir,'R',30,1,true,'cook-stir');spoon=stir;}
            const hide=Object.values(s.itemInstances||{}).find(i=>i.kind==='deer-hide'&&i.location?.type==='carried'&&i.location.targetId===body.id);if(hide&&body.id==='mara'&&!s.bow?.drawing&&!s.aiming&&!body.carrying){const J=a.h.rig.J;solveLimb(E,a.h.rig,'L',[J.shL[0]+1,J.shL[1],J.shL[2]-4]);}
            if(body.id==='mara'&&s.weapons?.[body.equippedWeaponId]?.kind!=='bow'&&body.holstered===false&&(s.aiming||body.shotTimer>0)){const J=a.h.rig.J;solveLimb(E,a.h.rig,'R',[J.shC[0]+8,J.shR[1],J.shC[2]]);solveLimb(E,a.h.rig,'L',[J.shC[0]+5,J.shL[1],J.shC[2]-1]);}
            finish(g,a);
            if(spoon){P.line(g,spoon[0]-1,spoon[1]-3,spoon[0]+2,spoon[1]+7,'#b79b6b',2);P.ell(g,spoon[0]+2,spoon[1]+7,2,3,'#89794f');}
          }
        }finally{a.restore();}
      });
    }
    for(const arrow of s.bow?.arrows||[]){
      if(['recovered','spent','broken','embedded'].includes(arrow.phase)||arrow.regionId&&arrow.regionId!==s.region||!r.visible(arrow.x,arrow.y,arrow.z||0,40,40,20))continue;
      r.queue(arrow.x,arrow.y,arrow.z||0,g=>{const at=project(arrow.x,arrow.y,arrow.z||0),v=Math.hypot(arrow.vx||0,arrow.vy||0,arrow.vz||0)||1,tail=project(arrow.x-(arrow.vx||7)/v*11,arrow.y-(arrow.vy||0)/v*11,(arrow.z||0)-(arrow.vz||0)/v*11);P.line(g,...tail,...at,'#dbc49a',1);P.disc(g,...at,1,'#546b5f');P.line(g,tail[0]-2,tail[1],tail[0]+2,tail[1]+1,'#cad5b6',2);});
    }
  }
  return{update,draw,human,animal,animation:anim,inspect:()=>({contacts:contacts.map(c=>({...c})),drawn:drawn.slice(),roots:roots.map(r=>({...r})),clips:anim.inspect()})};
}
