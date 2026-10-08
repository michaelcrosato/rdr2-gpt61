import { getCampaignPresentation } from './campaign.js';
import { createExpeditionHuman, drawExpeditionOutfit, EXPEDITION_CAST_IDS } from './expedition-cast.js';
import { createExpeditionAnimator, mixPoint, seatPose } from './expedition-animation.js';
import { jointScreen, contactHand, savePose, smooth, clamp01, solveLimb } from './western-animation.js';

const humanIds=new Set(['mara','inez',...EXPEDITION_CAST_IDS]);
const rows=v=>Array.isArray(v)?v:Object.values(v||{});
const hash=n=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
export const isRescuePresentation=s=>s.campaign?.activeMissionId==='snowbound-a-voice-under-ice';
export function expeditionResidence(body,all,fallback,seen=new Set()){
  if(!body||seen.has(body.id))return null;seen.add(body.id);
  if(body.attachment?.type==='rest')return body.attachment.regionId||fallback;
  if(body.attachment)return expeditionResidence(all[body.attachment.targetId],all,fallback,seen);
  return body.regionId||fallback;
}

export class ExpeditionHorseRig{
  constructor(E,id){this.E=E;this.id=id;this.phase=0;this.clock=0;this.speed=0;this.facing=0;this.fear=0;}
  update(dt,body,reduced=false){this.speed=Math.hypot(body.vx||0,body.vy||0);this.phase+=dt*this.speed*.052;if(!reduced)this.clock+=dt;this.facing=body.facing??this.facing;this.fear=clamp01((body.fear||0)/100);}
  sockets(x,y,s=1.16,passenger=false){
    const flip=Math.cos(this.facing)<0?-1:1,bob=Math.sin(this.phase*2)*Math.min(2,this.speed/70),q=(a,b)=>[x+a*s*flip,y+(b+bob)*s];
    return{flip,saddle:q(passenger?-18:1,passenger?-46:-44),pommel:q(10,-46),stirrupL:q(passenger?-24:-7,passenger?-29:-27),stirrupR:q(passenger?-11:8,passenger?-30:-28),reins:q(18,-48),neck:q(25,-49-this.fear*9),halter:q(36,-55-this.fear*9)};
  }
  draw(g,x,y,s=1.16,body={},state={}){
    const P=this.E.px,gray=this.id==='thimble',flip=Math.cos(this.facing)<0?-1:1,bob=Math.sin(this.phase*2)*Math.min(2,this.speed/70),q=(a,b)=>[x+a*s*flip,y+(b+bob)*s];
    const coat=gray?'#a5b4af':'#b39870',light=gray?'#cbd0bd':'#c7b18a',mane=gray?'#61777a':'#665b48',leg=gray?'#859b9a':'#9b876b';
    if(body.hp<=0||body.dead){
      // Lark remains an adult horse with a torn courier saddle, not an owned
      // mount or a generic health-zero actor pose.
      P.ell(g,...q(-3,-10),33*s,12*s,'#846f58');P.ell(g,...q(28,-5),15*s,6*s,'#a88b68');
      P.poly(g,[q(-22,-20),q(12,-24),q(25,-14),q(-20,-5)],'#9b7c5c');
      for(const [a,b]of [[-16,-2],[2,-1],[13,-5],[22,-7]])P.line(g,...q(a,b),...q(a+14,b+5),'#564f43',4*s);
      P.line(g,...q(28,-8),...q(41,-1),'#aa916e',6*s);P.poly(g,[q(-15,-25),q(10,-26),q(14,-13),q(-14,-12)],'#5d7772');
      P.rect(g,...q(-18,-17),16*s,12*s,'#a88e69');P.poly(g,[q(-13,-15),q(-7,-11),q(-12,-8)],'#ded3ae');P.line(g,...q(15,-15),...q(22,-17),'#89564e',3);
      P.line(g,...q(-32,-13),...q(-41,-6),mane,5*s);return;
    }
    for(let i=0;i<4;i++){const base=i<2?-17:16,stride=Math.sin(this.phase+i*Math.PI*.9)*(this.speed>3?9:this.fear*3),lift=Math.max(0,stride)*.65;
      P.line(g,...q(base+(i%2?3:-3),-25),...q(base+stride*.45,-13-lift),i%2?leg:gray?'#687e80':'#6d715f',4*s);
      P.line(g,...q(base+stride*.45,-13-lift),...q(base+stride,-lift),i%2?light:leg,3*s);P.line(g,...q(base+stride-3,-lift),...q(base+stride+3,-lift),'#354b48',3*s);}
    P.ell(g,...q(-3,-33),29*s,14*s,coat);P.ell(g,...q(-17,-36),15*s,10*s,light);
    if(gray)for(let i=0;i<8;i++)P.disc(g,...q(-23+hash(i+43)*42,-31-hash(i+71)*8),2*s,'#879e9c');
    const lift=this.fear*9;
    P.poly(g,[q(16,-29),q(18,-45-lift),q(25,-64-lift),q(36,-57-lift),q(30,-34)],coat);
    P.poly(g,[q(17,-37),q(20,-56-lift),q(26,-65-lift),q(30,-62-lift),q(24,-41)],mane);
    P.poly(g,[q(25,-62-lift),q(40,-58-lift),q(47,-49-lift),q(42,-44-lift),q(30,-49-lift)],light);
    P.ell(g,...q(44,-49-lift),5*s,4*s,gray?'#71898b':'#8b7b60');P.dot(g,...q(38,-54-lift),'#293f40');
    P.poly(g,[q(26,-61-lift),q(24+this.fear*4,-74-lift),q(32,-64-lift)],mane);P.poly(g,[q(35,-59-lift),q(36-this.fear*4,-71-lift),q(40,-60-lift)],coat);
    P.line(g,...q(-30,-33),...q(-36+Math.sin(this.clock)*3,-12),mane,5*s);
    P.poly(g,[q(-17,-43),q(12,-43),q(15,-29),q(-18,-29)],gray?'#6e808f':'#6b7d70');P.line(g,...q(-14,-42),...q(10,-42),'#bdb78f',2);
    P.ell(g,...q(1,-44),12*s,4*s,'#3a5250');P.ell(g,...q(-18,-45),8*s,3*s,'#68725b');
    for(const [a,b]of [[-7,-27],[8,-28]]){P.line(g,...q(a,-41),...q(a,b),'#79674b',2);P.ell(g,...q(a,b),4*s,2*s,'#adb7a4');}
    P.line(g,...q(32,-55-lift),...q(43,-51-lift),'#cec6a0',2);P.line(g,...q(37,-54-lift),...q(10,-45),'#c7b992',1);
    P.rect(g,...q(-24,-34),13*s,13*s,gray?'#819198':'#968768');P.line(g,...q(-23,-28),...q(-14,-28),'#c5b990',2);
    const coach=Object.values(state.weapons||{}).find(w=>w.kind==='coach-gun'&&w.location==='saddle'&&w.rackMountId===this.id);
    if(coach){P.line(g,...q(-18,-39),...q(14,-36),'#3a5253',4);P.line(g,...q(-18,-40),...q(14,-37),'#a5b4a8',1);P.line(g,...q(-21,-39),...q(-11,-38),'#9b7650',5);}
  }
}

export function createExpeditionActors(E,game){
  const P=E.px,humans=new Map(),horses=new Map(),positions=new Map(),animation=createExpeditionAnimator(E);let contacts=[],drawn=[],roots=[],stateRef=null;
  const human=id=>{if(!humans.has(id))humans.set(id,createExpeditionHuman(E,id));return humans.get(id);};
  const horse=id=>{if(!horses.has(id))horses.set(id,new ExpeditionHorseRig(E,id));return horses.get(id);};
  const entities=s=>s.entities||Object.fromEntries([s.player,s.horse,...rows(s.npcs),...rows(s.mounts),...rows(s.animals)].filter(Boolean).map(a=>[a.id||'mara',a]));
  const motion=(body,dt)=>{const before=positions.get(body.id),vx=before&&dt>0?(body.x-before.x)/dt:body.vx||0,vy=before&&dt>0?(body.y-before.y)/dt:body.vy||0;positions.set(body.id,{x:body.x,y:body.y});return{vx:Math.abs(vx)<600?vx:0,vy:Math.abs(vy)<600?vy:0};};
  function update(dt,state){
    if(stateRef!==state){positions.clear();stateRef=state;}
    animation.update(dt,state,getCampaignPresentation(state),game.reduceMotion);
    const all=entities(state);
    for(const body of Object.values(all)){
      if(expeditionResidence(body,all,state.region)!==state.region||body.hidden)continue;
      const m=motion(body,dt);
      if(body.kind==='horse'||body.category==='mount'){horse(body.id).update(dt,{...body,...m},game.reduceMotion);continue;}
      if(!humanIds.has(body.id))continue;
      const h=human(body.id),riding=body.mounted,carried=body.attachment?.type==='carried',patient=body.id==='silas';
      h.ready=!body.carrying&&!body.traversal&&(body.reloadTimer>0||body.holstered===false&&(state.aiming||body.shotTimer>0))||body.id==='inez'&&body.mounted&&body.shotTimer>0;
      h.rig.update(dt,{...body,...m,z:0,vx:riding||carried?0:m.vx,vy:riding||carried?0:m.vy,point:h.ready,
        pose:body.hp<=0?'die':patient&&!body.attachment?'down':body.traversal?.kind==='crouch'?'crouch':body.carrying?'guard':null,down:patient&&!body.attachment?1:0});
    }
  }
  function drawWeapon(g,h,root,r,state,body,signal=false){
    if(!h.armed||body.carrying||body.traversal)return;
    const rig=h.rig,cv=E.charView(r.view),weapon=body.id==='mara'?state.weapons?.[body.equippedWeaponId]:null,coach=!signal&&weapon?.kind==='coach-gun',hand=jointScreen(rig,cv,root,'handR'),hip=jointScreen(rig,cv,root,'hipR');
    if(!h.ready&&!signal){
      if(coach){const sh=jointScreen(rig,cv,root,'shL');P.line(g,sh[0]-5,sh[1]-8,hip[0]+8,hip[1]+7,'#3e5554',4);P.line(g,sh[0]-5,sh[1]-9,hip[0]+8,hip[1]+6,'#a8b9ae',1);P.line(g,hip[0]+3,hip[1],hip[0]+10,hip[1]+10,'#9b7752',5);}
      else{P.poly(g,[[hip[0]-3,hip[1]-2],[hip[0]+4,hip[1]-1],[hip[0]+3,hip[1]+8],[hip[0]-2,hip[1]+9]],'#70553d');P.line(g,hip[0]-2,hip[1]-4,hip[0]+2,hip[1]-3,'#49615b',3);}return;
    }
    const d=signal?[0,0,1]:rig.J.bladeDir,tip=jointScreen(rig,cv,root,rig.J.handR.map((n,i)=>n+d[i]*(coach?8:3.8))),dx=tip[0]-hand[0],dy=tip[1]-hand[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    P.line(g,...hand,hand[0]-dx*.32,hand[1]-dy*.32+3,'#8b6748',coach?5:3);
    P.line(g,...hand,...tip,'#344e51',coach?5:3);P.line(g,hand[0]+nx,hand[1]+ny,tip[0]+nx,tip[1]+ny,'#a4b7ae',1);
    if(coach){P.line(g,hand[0]-nx,hand[1]-ny,tip[0]-nx,tip[1]-ny,'#788f8c',1);P.dot(g,tip[0]+nx,tip[1]+ny,'#233b3e');P.dot(g,tip[0]-nx,tip[1]-ny,'#233b3e');}
    else P.disc(g,hand[0]+dx*.25,hand[1]+dy*.25,2,'#879e92');
    if(body.shotTimer>.24||signal&&animation.clip(body.id)?.age<.45){P.ddisc(g,...tip,11,'#e6bd7d',.15);P.poly(g,[[tip[0]-4,tip[1]],[tip[0],tip[1]-5],[tip[0]+6,tip[1]],[tip[0],tip[1]+4]],'#f1d79d');}
  }
  function draw(r,state){
    contacts=[];drawn=[];roots=[];const all=entities(state),cv=E.charView(r.view),used=new Set(),silas=all.silas;
    const project=(x,y,z)=>r.w(x,y,z||0),active=body=>body&&!body.hidden&&!body.departed&&expeditionResidence(body,all,state.region)===state.region;
    const prepared=(body,options={})=>{const h=human(body.id),root=r.w(body.x,body.y,body.z||0),a=animation.apply(body,h.rig,root,r.view,{project,reducedMotion:game.reduceMotion,exposed:state.region==='north-cutting',aiming:body.id==='mara'&&(state.aiming||body.shotTimer>0),weaponKind:body.id==='mara'?state.weapons?.[body.equippedWeaponId]?.kind:null,...options});contacts.push(...a.diagnostics);a.body=body;a.h=h;return a;};
    const finish=(g,a)=>{a.h.rig.draw(g,...a.root,r.view);drawExpeditionOutfit(E,g,a.root,a.h,r.view,a.body,state);drawWeapon(g,a.h,a.root,r,state,a.body,a.clip?.kind==='signal');drawn.push(a.body.id);roots.push({id:a.body.id,root:a.root.slice(),ground:project(a.body.x,a.body.y,a.body.z||0)});};
    const record=(id,side,target,hit,kind)=>{if(hit)contacts.push({actorId:id,side,target,hit,kind,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});};
    const c=animation.clip('silas')||[...humans.keys()].map(id=>animation.clip(id)).find(c=>c?.targetId==='silas'&&['lift','setdown','load','unload','handoff','deliver'].includes(c.kind));
    const u=c?clamp01(c.age/c.duration):1,attachment=silas?.attachment;
    let carrier=attachment?.type==='carried'?all[attachment.targetId]:null;
    if(c?.kind==='setdown')carrier=all[c.actorId];
    const nearestSource=()=>c?.sourceId?all[c.sourceId]:Object.values(all).filter(a=>a.id!=='silas'&&humanIds.has(a.id)).sort((a,b)=>Math.hypot(a.x-c.from.x,a.y-c.from.y)-Math.hypot(b.x-c.from.x,b.y-c.from.y))[0];
    const bodyFlat=(root)=>{const h=human('silas'),restore=savePose(h.rig);h.rig.downW=1;h.rig.facing=0;h.rig._cheat=0;h.rig.o.cheat=0;h.rig._pose();return{h,restore,root};};
    const blendSeat=(b,seatAt,sockets,amount,facing=0)=>{
      const rig=b.h.rig,flat=Object.fromEntries(Object.entries(rig.J).map(([key,p])=>[key,p.slice()])),flatRoot=b.root.slice();
      rig.downW=0;rig.facing=facing;rig._pose();const seatedRoot=seatPose(E,rig,cv,seatAt,sockets,1,true),seated=Object.fromEntries(Object.entries(rig.J).map(([key,p])=>[key,p.slice()]));
      for(const key of Object.keys(flat))rig.J[key]=mixPoint(flat[key],seated[key],amount);rig.facing=facing*amount;rig.downW=amount<.5?1:0;b.root=mixPoint(flatRoot,seatedRoot,amount);
    };
    const liftedRoot=(a,rig)=>{const sh=jointScreen(a.h.rig,cv,a.root,'shC'),hip=jointScreen(rig,cv,[0,0],'hipC');return[sh[0]+2-hip[0],sh[1]-3-hip[1]];};
    const grips=(a,b,weight=1,zone='both',blend=1)=>{const sh=jointScreen(b.h.rig,cv,b.root,'shC'),hip=jointScreen(b.h.rig,cv,b.root,'hipR'),knee=jointScreen(b.h.rig,cv,b.root,'kneeR');
      const normal=[[sh[0]+4,sh[1]+3],[hip[0]+8,hip[1]+3]],specific=zone==='upper'?[[sh[0]+4,sh[1]+3],[sh[0]*.75+hip[0]*.25+4,sh[1]*.75+hip[1]*.25+3]]:zone==='legs'?[[hip[0],hip[1]+3],[knee[0]-3,knee[1]+3]]:normal;
      const targets=['L','R'].map((side,i)=>[side,mixPoint(normal[i],specific[i],blend)]);
      if(zone!=='both'&&weight>.01){const center=targets.reduce((out,[,p])=>[out[0]+p[0]/2,out[1]+p[1]/2],[0,0]),staged=[center[0]+(zone==='upper'?-14:14),center[1]+44];a.root=mixPoint(a.root,staged,weight*blend);}
      for(let i=0;i<6;i++)for(const [side,target]of targets)a.hand(target,side,38,weight,true);
      for(const [side,target]of targets){const hit=a.hand(target,side,38,weight,false);if(weight>.995)record(a.body.id,side,target,hit,'adult-support');}};
    const flatDraw=(g,b)=>{b.h.rig.draw(g,...b.root,r.view);drawExpeditionOutfit(E,g,b.root,b.h,r.view,silas,state);drawn.push('silas');};
    if(carrier&&active(carrier)&&active(silas)){
      const partner=c&&['handoff','deliver'].includes(c.kind)?nearestSource():null,helper=carrier.id==='moss'&&active(all.vera)?all.vera:null;
      for(const body of [carrier,partner,helper,silas].filter(Boolean))used.add(body.id);
      if(r.visible(carrier.x,carrier.y,carrier.z||0,180,190,100))r.queue(carrier.x,carrier.y,carrier.z||0,g=>{
        const a=prepared(carrier),b=bodyFlat([0,0]),others=[];
        try{
          b.root=liftedRoot(a,b.h.rig);
          if(c?.kind==='lift')b.root=mixPoint(project(c.from.x,c.from.y,c.from.z||0),b.root,smooth(clamp01((u-.25)/.55)));
          else if(c?.kind==='unload'&&all.thimble){const mount=all.thimble,at=project(mount.x,mount.y,mount.z||0),sockets=horse('thimble').sockets(...at,1.16,true);blendSeat(b,at,sockets,1-smooth(clamp01((u-.18)/.68)),mount.facing||0);}
          else if(c?.kind==='setdown')b.root=mixPoint(b.root,project(c.target.x,c.target.y,c.target.z||0),smooth(clamp01((u-.25)/.6)));
          if(partner&&partner.id!==carrier.id){const source=prepared(partner);others.push(source);source.h.rig.facing=0;a.h.rig.facing=Math.PI;const receiving=liftedRoot(a,b.h.rig);b.root=mixPoint(liftedRoot(source,b.h.rig),receiving,smooth(clamp01((u-.15)/.65)));grips(source,b,1-smooth(clamp01((u-.55)/.4)),'upper',smooth(u/.25));}
          grips(a,b,c?.kind==='lift'?smooth(u/.3):c?.kind==='setdown'?1-smooth((u-.65)/.35):partner?smooth(clamp01((u-.1)/.3)):1,partner?'legs':'both',partner?1-smooth(clamp01((u-.6)/.4)):1);
          if(helper){const helperRig=prepared(helper);others.push(helperRig);const foot=jointScreen(b.h.rig,cv,b.root,'kneeR'),targets=['L','R'].map(side=>[side,[foot[0]+(side==='L'?-2:2),foot[1]+2]]);for(let k=0;k<6;k++)for(const [side,target]of targets)helperRig.hand(target,side,32,1);for(const [side,target]of targets){const hit=helperRig.hand(target,side,32,1,false);record(helper.id,side,target,hit,'leg-support');}}
          for(const source of others)finish(g,source);finish(g,a);flatDraw(g,b);
        }finally{a.restore();b.restore();for(const a of others)a.restore();}
      });
    }
    // A mount, its front driver and its one rear passenger form a depth group.
    for(const mount of Object.values(all).filter(a=>active(a)&&(a.kind==='horse'||a.category==='mount'))){
      if(used.has(mount.id))continue;used.add(mount.id);
      const driver=mount.id===state.horse?.id&&state.player.mounted?state.player:mount.id==='thimble'&&all.inez?.mounted?all.inez:null;
      const passenger=attachment?.type==='passenger'&&attachment.targetId===mount.id?silas:null;
      const loadClip=c?.kind==='load'&&passenger?c:null,unloadClip=c?.kind==='unload'&&mount.id==='thimble'?c:null;
      if(driver)used.add(driver.id);if(passenger)used.add(passenger.id);
      if(loadClip)used.add(loadClip.actorId);
      if(!r.visible(mount.x,mount.y,mount.z||0,160,200,100))continue;
      r.shadow(mount.x,mount.y,25,.2,'#566f75',mount.z||0);
      r.queue(mount.x,mount.y,mount.z||0,g=>{
        const at=project(mount.x,mount.y,mount.z||0),hr=horse(mount.id),front=hr.sockets(...at),back=hr.sockets(...at,1.16,true),actors=[],restores=[];
        hr.draw(g,...at,1.16,mount,state);drawn.push(mount.id);
        try{
          if(passenger){
            const h=human('silas'),restore=savePose(h.rig);restores.push(restore);h.rig.downW=0;h.rig.facing=mount.facing||0;h.rig.o.cheat=0;h.rig._cheat=0;h.rig._pose();
            let root=seatPose(E,h.rig,cv,at,back,1,true),patient={h,root};
            if(loadClip&&u<.92){const source=prepared(all[loadClip.actorId]);actors.push(source);h.rig.downW=1;h.rig.facing=0;h.rig._pose();patient.root=liftedRoot(source,h.rig);blendSeat(patient,at,back,smooth(clamp01((u-.2)/.7)),mount.facing||0);grips(source,patient,1-smooth(clamp01((u-.72)/.2)));}
            flatDraw(g,patient);
            if(!loadClip||u>=.92)for(const side of ['L','R'])record('silas','foot'+side,back['stirrup'+side],jointScreen(h.rig,cv,patient.root,'foot'+side),'passenger-seat');
            if(attachment.strap){const sh=jointScreen(h.rig,cv,patient.root,'shC'),hip=jointScreen(h.rig,cv,patient.root,'hipC');P.line(g,sh[0]-6,sh[1]+2,hip[0]+7,hip[1]+4,'#c7b58a',3);P.line(g,hip[0]-7,hip[1]+4,hip[0]+7,hip[1]+4,'#806d4e',3);P.rect(g,hip[0]+3,hip[1]+2,4,4,'#c8c4a5');}
          }
          if(driver&&!actors.some(a=>a.body.id===driver.id)){const dc=animation.clip(driver.id),strap=dc?.kind==='strap'?dc:null,seatWeight=strap?smooth(clamp01((strap.age/strap.duration-.7)/.3)):1;const a=prepared(driver,{mounted:true,sockets:front,seatWeight,passengerHip:back.saddle});actors.push(a);}
          for(const a of actors)finish(g,a);
        }finally{for(const a of actors)a.restore();for(const restore of restores)restore();}
      });
    }
    for(const body of Object.values(all)){
      if(!active(body)||!humanIds.has(body.id)||used.has(body.id)||body.attachment?.type==='carried'||body.attachment?.type==='passenger')continue;
      if(!r.visible(body.x,body.y,body.z||0,130,180,90))continue;
      used.add(body.id);r.shadow(body.x,body.y,9,.2,'#526a71',body.z||0);
      r.queue(body.x,body.y,body.z||0,g=>{
        const patientAt=silas&&project(silas.x,silas.y,silas.z||0),mount=state.horse,horseAt=mount&&project(mount.x,mount.y,mount.z||0),clip=animation.clip(body.id);
        let patientShoulder;if(patientAt){const rig=human('silas').rig,restore=savePose(rig);rig.downW=1;rig.facing=0;rig._pose();patientShoulder=jointScreen(rig,cv,patientAt,'shL');restore();}
        const seatMount=clip&&['mount','dismount','hitch'].includes(clip.kind)?all[clip.targetId]||mount:null,seatAt=seatMount&&project(seatMount.x,seatMount.y,seatMount.z||0);
        const a=prepared(body,{patientShoulder,sockets:seatAt&&horse(seatMount.id).sockets(...seatAt),horseNeck:horseAt&&horse(mount.id).sockets(...horseAt).neck});
        try{
          if(body.id==='silas'&&(!body.attachment||body.attachment.type==='rest')){a.h.rig.downW=1;a.h.rig.facing=0;a.h.rig._pose();}
          if(clip?.kind==='strap'&&all.thimble){const at=project(all.thimble.x,all.thimble.y,all.thimble.z||0),target=horse('thimble').sockets(...at,1.16,true).saddle;a.hand(target,'R',35,1);}
          finish(g,a);
          if(clip?.kind==='pickup'&&clip.age/clip.duration>.5){const at=jointScreen(a.h.rig,cv,a.root,'handR');P.rect(g,at[0]-9,at[1]-2,18,12,'#8b7457');P.line(g,at[0]-7,at[1]+2,at[0]+7,at[1]+2,'#c5b790',2);}
          if(body.id==='mara'&&body.lantern&&!body.carrying){const at=jointScreen(a.h.rig,cv,a.root,'handL');P.line(g,at[0],at[1],at[0],at[1]+5,'#a8a383',1);P.rect(g,at[0]-3,at[1]+4,7,9,'#d4b77f');P.line(g,at[0]-3,at[1]+4,at[0]+4,at[1]+4,'#415950',2);}
          if(!game.reduceMotion&&body.hp>0){const head=jointScreen(a.h.rig,cv,a.root,'head'),t=(animation.clock*.25+hash(body.id.length*19))%1;if(t<.35)P.blend(g,(.35-t)*.5,'normal',()=>P.ell(g,head[0]+5+t*20,head[1]+3-t*6,3+t*9,2+t*3,'#dce5d5'));}
        }finally{a.restore();}
      });
    }
  }
  return{update,draw,human,horse,animation,inspect:()=>({contacts:contacts.map(c=>({...c})),drawn:drawn.slice(),roots:roots.map(a=>({...a})),clips:Object.fromEntries(['mara','inez','silas','moss'].map(id=>[id,animation.clip(id)]))})};
}
