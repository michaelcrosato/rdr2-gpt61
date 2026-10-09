/** Physical wounded-mare pursuit and recoverable passenger pressure.
 * Contract-v2 only. Earlier v4 records do not acquire invented events or loads.
 */
import {RIVAL_ID,RIVAL_WORLD as W} from '../content/campaign/bellwether-works.js';
import {blockedAt,clearLine} from './campaign-navigation.js';

export const RIVAL_TRANSPORT_BALANCE=Object.freeze({woundedMareHealth:65,unsafeSpeed:160,unsafeSeconds:1,weatherWarningSeconds:12,looseWarningQuality:.45,looseDropQuality:.15,checkSeconds:1,resecureSeconds:1.2,separationWarningSeconds:3,separationFailSeconds:20});
const rec=s=>s.campaign?.missions?.[RIVAL_ID];
export const usesRivalTransport=s=>rec(s)?.rival?.contractVersion===2&&rec(s).rival.transportVersion===1;
const modern=usesRivalTransport;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),point=a=>({x:a.x,y:a.y,z:a.z||0}),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),object=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
export function createRivalTransport(){return {schema:1,strapQuality:0,wear:0,loadedDistance:0,movingSeconds:0,exposure:0,motionSpeed:0,unsafeAge:0,separationAge:0,checkRemaining:0,resecureRemaining:0,checkCount:0,resecureCount:0,dropCount:0,reloadCount:0,lastCheckAt:null,lastDropAt:null,lastHorsePoint:null,weatherWarned:false,looseWarned:false,separationWarned:false,dropped:false,events:[],skein:{woundedAt:null,woundShotSerial:null,woundHealth:null,footAt:null,footReason:null}};}
const state=s=>modern(s)?rec(s).rival.transport:null;
export const rivalPassenger=s=>s.entities?.levi?.attachment?.type==='passenger'&&s.entities.levi.attachment.targetId===s.party?.mountId;
const active=s=>s.campaign?.activeMissionId===RIVAL_ID&&!s.dialog&&!s.failure;
function present(s,ctx,kind,actor,target,targetId='levi'){ctx.present(s,kind,point(target),targetId,{...point(actor),facing:actor.facing||0},actor.id,{sourceId:actor.id});}
function event(s,t,kind,extra={}){t.events.push({kind,at:s.elapsed,actorId:'levi',mountId:s.party.mountId,...extra});}
function stationary(s,t,world){const p=s.player,h=s.horse;return !p.mounted&&dist(p,h)<55&&Math.abs((p.z||0)-(h.z||0))<8&&t.motionSpeed<8&&(!h.following||dist(p,h)<=36)&&(!world||clearLine(world,p,h,1,false));}
export function canInitialPassengerStrap(s,world){const t=state(s);return !usesRivalTransport(s)||!!(t&&rivalPassenger(s)&&!s.player.carrying&&stationary(s,t,world));}
function freeGround(world,anchor,radius=9){
  for(const length of [30,42,54])for(const angle of [Math.PI,Math.PI/2,-Math.PI/2,0]){
    const q={x:anchor.x+Math.cos((anchor.facing||0)+angle)*length,y:anchor.y+Math.sin((anchor.facing||0)+angle)*length,z:anchor.z||0};
    if(!blockedAt(world,q.x,q.y,radius))return q;
  }
  return null;
}
export function registerSkeinWound(s,ctx,shotSerial){
  const t=state(s),r=rec(s),mare=s.entities.skein;if(!t||mare.hp<=0||mare.hp>RIVAL_TRANSPORT_BALANCE.woundedMareHealth||t.skein.woundedAt!==null)return;
  const impact=r.rival.shots.find(shot=>shot.serial===shotSerial)?.impact;
  if(!impact||impact.targetId!=='skein'||impact.kill)return;
  t.skein.woundedAt=s.elapsed;t.skein.woundShotSerial=shotSerial;t.skein.woundHealth=mare.hp;
  r.transactions[`${RIVAL_ID}:skein:wounded`]={completed:true};s.honor-=2;r.captivity.trust-=1;
  event(s,t,'skein-wounded',{horseId:'skein',health:mare.hp,shotSerial});
  ctx.notice(s,'Skein is badly wounded. Her living body and ownership remain; she cannot safely carry Levi through the forks.');
}
export function recordSkeinDeath(s){const t=state(s);if(!t||t.skein.footAt===null)return;t.skein.footReason='dead';if(!t.events.some(e=>e.kind==='skein-foot'&&e.reason==='dead'))event(s,t,'skein-foot',{horseId:'skein',reason:'dead',point:point(s.entities.levi)});}
export function needsSkeinFootPursuit(s){const t=state(s);return !!(t&&s.entities.levi.mounted&&(s.entities.skein.hp<=0||s.entities.skein.hp<=RIVAL_TRANSPORT_BALANCE.woundedMareHealth));}
export function recordSkeinFootPursuit(s,ctx){
  const t=state(s);if(!t)return;const reason=s.entities.skein.hp<=0?'dead':'wounded';
  t.skein.footAt??=s.elapsed;t.skein.footReason=reason;
  if(!t.events.some(e=>e.kind==='skein-foot'&&e.reason===reason))event(s,t,'skein-foot',{horseId:'skein',reason,point:point(s.entities.levi)});
  ctx.notice(s,reason==='wounded'?'Levi has stepped off the wounded Skein and is fleeing on foot. Catch and restrain him; Inez can lead this same surviving mare.':'Levi is fleeing on foot after Skein died. The mare remains where she fell; no replacement is created.');
}
export function transportLoaded(s){
  const t=state(s);if(!t)return;t.strapQuality=0;t.wear=0;t.unsafeAge=0;t.lastCheckAt=null;t.lastHorsePoint=point(s.horse);t.checkRemaining=0;t.resecureRemaining=0;
  if(t.dropped){t.reloadCount++;event(s,t,'reload');}else event(s,t,'load');t.dropped=false;
}
export function transportStrapped(s){const t=state(s);if(!t)return;t.strapQuality=1;t.wear=0;t.unsafeAge=0;t.looseWarned=false;t.lastHorsePoint=point(s.horse);event(s,t,'strap');}
export function transportUnloaded(s){const t=state(s);if(!t)return;t.lastHorsePoint=null;t.unsafeAge=0;t.checkRemaining=0;t.resecureRemaining=0;t.lastCheckAt=null;event(s,t,'unload');}
export function rivalTransportPace(s){
  const t=state(s);if(!t||!rivalPassenger(s)||!s.player.mounted)return 1;
  return (s.weather==='snow'?.94:.98)*(s.horse.stamina<25?.84:1)*(t.strapQuality<.35?.92:1);
}
export function canReturnWithPassenger(s){
  if(!modern(s))return true;const t=state(s),r=rec(s),levi=s.entities.levi,mare=s.entities.skein;
  return !!(t&&rivalPassenger(s)&&levi.hp>0&&levi.bound&&levi.attachment.strap&&t.strapQuality>RIVAL_TRANSPORT_BALANCE.looseDropQuality&&(!mare.hp||r.rival.skeinRecovered&&mare.leading===true&&mare.leaderId==='inez'&&dist(mare,s.player)<210));
}
function dropPassenger(s,ctx,world,reason){
  const t=state(s),r=rec(s),levi=s.entities.levi,anchor=rivalPassenger(s)?s.horse:s.player,q=freeGround(world,anchor);
  if(!q){ctx.notice(s,'There is no safe ground beside this obstacle. Stop and unload Levi by hand.');return false;}
  if(!ctx.setAttachment(s,'levi',null))return false;
  Object.assign(levi,q);levi.vx=0;levi.vy=0;levi.route=[];delete levi.routeTarget;delete levi.goal;
  r.captivity.state='bound';t.dropCount++;t.dropped=true;t.lastDropAt=s.elapsed;t.strapQuality=0;t.wear=0;t.unsafeAge=0;t.lastHorsePoint=null;t.lastCheckAt=null;t.checkRemaining=0;t.resecureRemaining=0;
  event(s,t,'drop',{reason,point:q,health:levi.hp});
  if(reason==='unsafe-passenger'){r.captivity.injury++;r.captivity.trust--;s.honor--;}
  present(s,ctx,'setdown',s.player,levi);
  ctx.notice(s,reason==='unsafe-passenger'?'The loose rear load slipped onto clear snow. Levi is the same living, bound person. Stop, dismount, lift him, load and strap him again.':'Levi is set down alive and bound. Stay close and lift him again before the weather or separation makes abandonment dangerous.');
  return true;
}
export function getRivalTransportInteractions(s,world){
  const t=state(s),r=rec(s),p=s.player,h=s.horse,levi=s.entities.levi,list=[];if(!t||!active(s)||r.mission.stage!==11)return list;
  const offer=(id,label,target,priority=-4)=>list.push({id,label,targetId:target.id,x:target.x,y:target.y,z:target.z||0,distance:dist(p,target),priority});
  if(rivalPassenger(s)&&stationary(s,t,world)&&!p.carrying){
    if(!t.checkRemaining&&!t.resecureRemaining)offer('transport:check','Check Levi’s breathing and Copper’s rear strap',h);
    if(t.lastCheckAt!==null&&s.elapsed-t.lastCheckAt<30&&!t.checkRemaining&&!t.resecureRemaining)offer('transport:resecure','Retie and resecure the checked passenger strap',h);
    offer('unload:levi','Lift Levi from the rear seat to rest or reload him',h,-3);
  }
  if(p.carrying==='levi'&&!p.mounted&&!blockedAt(world,p.x,p.y,11))offer('transport:set-down','Set the same bound Levi down on clear ground',p);
  return list;
}
export function interactRivalTransport(s,id,ctx,world){
  const t=state(s);if(!t||!getRivalTransportInteractions(s,world).some(a=>a.id===id))return false;
  if(id==='transport:check'){t.checkRemaining=RIVAL_TRANSPORT_BALANCE.checkSeconds;present(s,ctx,'care',s.player,s.entities.levi);ctx.notice(s,'Stay beside Copper while Mara checks the living passenger and the actual rear strap.');return true;}
  if(id==='transport:resecure'){t.resecureRemaining=RIVAL_TRANSPORT_BALANCE.resecureSeconds;present(s,ctx,'strap',s.player,s.entities.levi);ctx.notice(s,'Keep the load stopped while Mara ties the checked strap again.');return true;}
  if(id==='transport:set-down')return dropPassenger(s,ctx,world,'set-down');
  return false;
}
export function stepRivalTransport(s,dt,ctx,world){
  const t=state(s),r=rec(s);if(!t||r.mission.stage!==11)return;const h=s.horse,levi=s.entities.levi,passenger=rivalPassenger(s);
  if(passenger){
    const moved=t.lastHorsePoint?dist(h,t.lastHorsePoint):0,speed=moved/dt;t.lastHorsePoint=point(h);
    t.motionSpeed=speed;t.loadedDistance+=moved;if(moved>.01)t.movingSeconds+=dt;t.exposure+=dt*(s.weather==='snow'?1:.35);
    if(moved>.01){h.stamina=clamp(h.stamina-dt*(s.weather==='snow'?4.5:3.5)*(speed>RIVAL_TRANSPORT_BALANCE.unsafeSpeed?1.4:1),0,100);if(levi.attachment.strap){t.wear+=dt*((s.weather==='snow'?.0018:.0008)+(speed>RIVAL_TRANSPORT_BALANCE.unsafeSpeed?.016:0));t.strapQuality=clamp(1-t.wear,0,1);}}
    if(!t.weatherWarned&&t.movingSeconds>=RIVAL_TRANSPORT_BALANCE.weatherWarningSeconds){t.weatherWarned=true;ctx.notice(s,'Copper tires under the person and the weather. The burden slows her pace. Stop, dismount and check Levi’s breathing and the rear strap.');}
    if(!t.looseWarned&&levi.attachment.strap&&t.strapQuality<RIVAL_TRANSPORT_BALANCE.looseWarningQuality){t.looseWarned=true;ctx.notice(s,'The rear strap is fraying in the ride. Stop and check it, then resecure the same passenger before pressing on.');}
    const unsafe=s.player.mounted&&speed>RIVAL_TRANSPORT_BALANCE.unsafeSpeed&&(!levi.attachment.strap||t.strapQuality<=RIVAL_TRANSPORT_BALANCE.looseDropQuality);
    t.unsafeAge=unsafe?t.unsafeAge+dt:0;
    if(unsafe&&t.unsafeAge>=.25&&t.unsafeAge-dt<.25)ctx.notice(s,'The unsecure passenger is slipping. Stop immediately; do not ride on with a loose load.');
    if(t.unsafeAge>=RIVAL_TRANSPORT_BALANCE.unsafeSeconds){dropPassenger(s,ctx,world,'unsafe-passenger');return;}
    for(const key of ['checkRemaining','resecureRemaining'])if(t[key]>0){
      if(!stationary(s,t,world)){t[key]=0;ctx.notice(s,'The hands-on check was interrupted. Stop and stand beside Copper before working on the passenger.');continue;}
      t[key]=Math.max(0,t[key]-dt);if(t[key])continue;
      if(key==='checkRemaining'){t.checkCount++;t.lastCheckAt=s.elapsed;event(s,t,'check',{quality:t.strapQuality});ctx.notice(s,`Levi is breathing. The rear strap holds ${Math.round(t.strapQuality*100)} percent of its secure condition. Retie it here if loose.`);}
      else{levi.attachment.strap=true;r.flags.strapped=true;t.strapQuality=1;t.wear=0;t.unsafeAge=0;t.looseWarned=false;t.resecureCount++;t.lastCheckAt=null;event(s,t,'resecure');ctx.notice(s,'The same living passenger is secure again. No body, binding or supply was replaced.');}
    }
  }else{
    t.lastHorsePoint=null;t.motionSpeed=0;t.checkRemaining=0;t.resecureRemaining=0;t.unsafeAge=0;
    const apart=!levi.attachment&&dist(s.player,levi)>250;t.separationAge=apart?t.separationAge+dt:0;
    if(apart&&!t.separationWarned&&t.separationAge>=RIVAL_TRANSPORT_BALANCE.separationWarningSeconds){t.separationWarned=true;ctx.notice(s,'Levi is still bound on the road. Turn back and lift this same person before the exposed separation becomes abandonment.');}
    if(!apart)t.separationWarned=false;
    if(t.separationAge>RIVAL_TRANSPORT_BALANCE.separationFailSeconds)ctx.fail(s,'The living bound captive was abandoned in the weather. Recover the actual passenger through the checkpoint.');
  }
}
export function validateRivalTransport(s){
  const r=rec(s),t=r?.rival?.transport;if(!modern(s))return [undefined,2].includes(r.rival.contractVersion)&&r.rival.transportVersion===undefined&&t===undefined;
  if(!object(t)||t.schema!==1||Object.keys(t).length!==Object.keys(createRivalTransport()).length)return false;
  for(const key of ['strapQuality','wear','loadedDistance','movingSeconds','exposure','motionSpeed','unsafeAge','separationAge','checkRemaining','resecureRemaining'])if(!finite(t[key])||t[key]<0||t[key]>1e7)return false;
  if(t.strapQuality>1||t.checkRemaining>RIVAL_TRANSPORT_BALANCE.checkSeconds||t.resecureRemaining>RIVAL_TRANSPORT_BALANCE.resecureSeconds)return false;
  for(const key of ['checkCount','resecureCount','dropCount','reloadCount'])if(!Number.isInteger(t[key])||t[key]<0||t[key]>512)return false;
  for(const key of ['weatherWarned','looseWarned','separationWarned','dropped'])if(typeof t[key]!=='boolean')return false;
  for(const key of ['lastCheckAt','lastDropAt'])if(t[key]!==null&&(!finite(t[key])||t[key]<0||t[key]>s.elapsed))return false;
  if(t.lastHorsePoint!==null&&(!object(t.lastHorsePoint)||!finite(t.lastHorsePoint.x+t.lastHorsePoint.y+t.lastHorsePoint.z)))return false;
  const kinds=new Set(['load','reload','strap','unload','drop','check','resecure','skein-wounded','skein-foot']);
  if(!Array.isArray(t.events)||t.events.length>512||t.events.some(e=>!object(e)||!kinds.has(e.kind)||!finite(e.at)||e.at<0||e.at>s.elapsed||e.actorId!=='levi'||e.mountId!==s.party.mountId))return false;
  for(const [counter,kind] of [['checkCount','check'],['resecureCount','resecure'],['dropCount','drop'],['reloadCount','reload']])if(t[counter]!==t.events.filter(e=>e.kind===kind).length)return false;
  for(const e of t.events){if(e.kind==='drop'&&(!['set-down','unsafe-passenger'].includes(e.reason)||!object(e.point)||!finite(e.point.x+e.point.y+e.point.z)||blockedAt(W,e.point.x,e.point.y,9)||!finite(e.health)||e.health<=0||e.health>100))return false;if(e.kind==='check'&&(!finite(e.quality)||e.quality<0||e.quality>1))return false;}
  if(t.lastCheckAt!==null&&!t.events.some(e=>e.kind==='check'&&e.at===t.lastCheckAt))return false;
  if(t.dropped&&(rivalPassenger(s)||!r.flags.bound)||t.dropCount>0&&(t.lastDropAt===null||!t.events.some(e=>e.kind==='drop'&&e.at===t.lastDropAt)))return false;
  const q=t.skein;if(!object(q)||Object.keys(q).length!==5||![null,'wounded','dead'].includes(q.footReason))return false;
  if(q.woundedAt!==null){const shot=r.rival.shots.find(shot=>shot.serial===q.woundShotSerial);if(!finite(q.woundedAt)||q.woundedAt>s.elapsed||!finite(q.woundHealth)||q.woundHealth<=0||q.woundHealth>65||shot?.impact?.targetId!=='skein'||shot.impact.kill||!r.transactions[`${RIVAL_ID}:skein:wounded`]||!t.events.some(e=>e.kind==='skein-wounded'&&e.shotSerial===q.woundShotSerial))return false;}
  else if(q.woundShotSerial!==null||q.woundHealth!==null||r.transactions[`${RIVAL_ID}:skein:wounded`])return false;
  if(q.footAt===null&&q.footReason!==null)return false;
  if(q.footAt!==null&&(!finite(q.footAt)||q.footAt>s.elapsed||q.footReason===null||!t.events.some(e=>e.kind==='skein-foot'&&e.reason===q.footReason)))return false;
  if(q.footReason==='wounded'&&(q.woundedAt===null||s.entities.skein.hp<=0)||q.footReason==='dead'&&s.entities.skein.hp>0)return false;
  if(rivalPassenger(s)&&s.entities.levi.attachment.strap&&Math.abs(t.strapQuality-clamp(1-t.wear,0,1))>1e-6)return false;
  if(!r.flags.bound&&(t.events.some(e=>!e.kind.startsWith('skein-'))||t.dropCount||t.checkCount||t.loadedDistance))return false;
  return true;
}
