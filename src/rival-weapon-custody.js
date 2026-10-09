/** Physical disarm, theft and recovery for one original engraved revolver.
 * This module never fires a gun, resolves a life or awards mission progress.
 * The ordinary combat loop remains responsible for damage and registry ammo.
 */
import { RIVAL_ID, RIVAL_ENCOUNTER_WEAPON } from '../content/campaign/bellwether-works.js';
import { clearLine, followActor } from './campaign-navigation.js';

export const ENGRAVED_REVOLVER_ID=RIVAL_ENCOUNTER_WEAPON.id;
export const WEAPON_THIEF_ID='bellwether-revolver-thief';
export const WEAPON_CUSTODY_TRANSACTIONS=Object.freeze(['disarm-guard','steal','thief-pickup','collect','return','claim']);
const DONOR='bastian',GUN=ENGRAVED_REVOLVER_ID,THIEF=WEAPON_THIEF_ID;
const phases=new Set(['armed','disarming','pursuing','grappling','dropped','thief-held','player-held','returned','ended']);
const clone=v=>JSON.parse(JSON.stringify(v)),object=v=>v&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const rec=s=>s.campaign?.missions?.[RIVAL_ID],custody=s=>rec(s)?.rival?.weaponCustody;
const person=(s,id)=>s.entities?.[id],alive=a=>a&&a.hp>0&&!a.hidden&&!a.departed&&!a.escaped&&!a.surrendered;
const pos=(a,s)=>({x:a.x,y:a.y,z:a.z||0,regionId:a.regionId||s.region});
const near=(a,b,range)=>a&&b&&Math.abs((a.z||0)-(b.z||0))<8&&Math.hypot(a.x-b.x,a.y-b.y)<=range;
const sameRegion=(s,a,b)=>a&&b&&(a.regionId||s.region)===(b.regionId||s.region);
const active=s=>s.campaign?.activeMissionId===RIVAL_ID&&!s.dialog&&!s.failure;
const battle=s=>active(s)&&[5,7].includes(rec(s)?.mission?.stage)&&s.region==='bellwether-works';
const txkey=key=>`${RIVAL_ID}:weapon:${key}`;
const worldOf=(s,ctx)=>ctx?.worldFor?.(s);
const clearContact=(world,a,b)=>!!world&&clearLine(world,{...a,z:(a.z||0)+25},{...b,z:(b.z||0)+25},2,false);
const emit=(s,ctx,kind,target,targetId,actorId,sourceId=actorId)=>ctx?.present?.(s,kind,target,targetId,pos(person(s,actorId)||s.player,s),actorId,{sourceId});
const notice=(s,ctx,text)=>ctx?.notice?.(s,text);
function transaction(s,c,key,actorId){
  const r=rec(s),id=txkey(key);if(r.transactions[id])return false;
  r.transactions[id]={completed:true,actorId,at:s.elapsed};c.events.push({kind:key,actorId,at:s.elapsed});return true;
}
function clearAction(a){if(a){delete a.weaponAction;delete a.weaponActionTargetId;}}
function initialize(s){
  const r=rec(s);if(!r?.rival)return null;
  if(!r.rival.weaponCustody)r.rival.weaponCustody={schema:1,weaponId:GUN,thiefId:THIEF,donorId:DONOR,phase:'armed',initializedAt:s.elapsed,actionStartedAt:null,actionAge:0,disarmedAt:null,createdAt:null,theftAt:null,capturedRounds:null,npcShots:0,externalShots:0,origin:null,choice:null,guardWeapon:null,dropCount:0,events:[]};
  // Unstarted interim v4 custody contains no gun or ammunition history. It can
  // acquire only empty counters; an older created gun cannot invent its past.
  const c=r.rival.weaponCustody;if(c.createdAt===null){c.capturedRounds??=null;c.npcShots??=0;c.externalShots??=0;}
  return r.rival.weaponCustody;
}
function counts(a){
  const w=a?.weapon,ammo=a?.ammo??w?.ammo,reserve=a?.reserve??w?.reserve;
  return w&&Number.isInteger(ammo)&&ammo>=0&&ammo<=w.capacity&&Number.isInteger(reserve)&&reserve>=0&&reserve<=999?{ammo,reserve}:null;
}
function privateGun(a,id=GUN){return a?.weapon?.id===id&&a.weapon.owner===a.id&&!a.weapon.registryOwned&&counts(a);}
function removePrivate(a){a.weapon=null;a.ammo=0;a.reserve=0;a.gunDisarmed=true;a.aiming=false;a.holstered=true;a.shotTimer=0;a.reloadTimer=0;delete a.reloadWeaponId;delete a.equippedWeaponId;}
function normalizedPrivate(a,s){
  const n=counts(a);if(!n)return null;const w=a.weapon;
  return{id:w.id,name:w.name||'Claimant carbine',kind:w.kind,capacity:w.capacity,ammoType:w.ammoType||'tern-cartridge',...n,condition:finite(w.condition)?w.condition:1,owner:a.id,location:'dropped',dropPoint:pos(a,s)};
}
function registerDonorGun(s,c,ctx,origin){
  const donor=person(s,DONOR),n=privateGun(donor);if(!n||s.weapons[GUN])return false;
  const condition=finite(donor.weapon.condition)?donor.weapon.condition:1;
  s.weapons[GUN]={...RIVAL_ENCOUNTER_WEAPON,id:GUN,kind:'revolver',capacity:6,ammoType:'engraved-round',...n,condition,owner:DONOR,loanMissionId:null,location:'dropped',dropPoint:pos(donor,s)};
  removePrivate(donor);clearAction(donor);if(c.createdAt===null){c.createdAt=s.elapsed;c.origin=origin;c.capturedRounds=n.ammo+n.reserve;}c.phase='dropped';c.actionStartedAt=null;c.actionAge=0;
  emit(s,ctx,'weapon-drop',s.weapons[GUN].dropPoint,GUN,DONOR);
  return true;
}
function equipRegistry(a,w){
  // Ammo lives only in the registry while this descriptor refers to it. Core
  // combat must use s.weapons[a.equippedWeaponId], not these zero placeholders.
  a.weapon={id:w.id,kind:w.kind,capacity:w.capacity,owner:a.id,registryOwned:true};a.equippedWeaponId=w.id;a.ammo=0;a.reserve=0;a.gunDisarmed=false;a.holstered=false;a.aiming=true;a.reloadTimer=0;
}
function fallbackPlayerWeapon(s){
  if(s.player.equippedWeaponId!==GUN)return;
  const fallback=s.weapons['mara-revolver']||Object.values(s.weapons).find(w=>w.id!==GUN&&w.owner==='mara'&&w.location==='carried');
  if(fallback)s.player.equippedWeaponId=fallback.id;s.player.holstered=true;s.player.shotTimer=0;s.player.reloadTimer=0;delete s.player.reloadWeaponId;
  const f=rec(s)?.focus;if(f){f.active=false;f.marks=[];f.queue=[];f.clock=0;}s.player.focusActive=false;
}
function relationship(s,c,choice){
  s.companions??={};s.companions[DONOR]??={trust:0,requests:0};const a=s.companions[DONOR],delta=choice==='returned'?2:-2;
  a.trust+=delta;a.weaponDisposition={weaponId:GUN,choice,trustDelta:delta,at:s.elapsed};s.honor=(s.honor||0)+(choice==='returned'?1:-1);c.choice=choice;
}

export function recordCustodyShot(s,actorId,weaponId,count=1){
  const c=custody(s);if(weaponId!==GUN||!c||c.createdAt===null||!Number.isInteger(count)||count<=0||count>6)return false;
  const gun=s.weapons?.[GUN],owned=gun?gun.owner===actorId&&gun.location==='carried':actorId===DONOR&&!!privateGun(person(s,DONOR));if(!owned)return false;
  if(actorId==='mara'){
    // Rival player shots already have individual physical-projectile receipts.
    if(s.campaign.activeMissionId===RIVAL_ID)return false;c.externalShots=(c.externalShots||0)+count;
  }else c.npcShots=(c.npcShots||0)+count;
  return true;
}

export function getWeaponInteractions(s){
  if(!active(s))return[];const r=rec(s),c=custody(s),p=s.player,thief=person(s,THIEF),donor=person(s,DONOR),gun=s.weapons?.[GUN],list=[];
  const offer=(id,label,a,priority=-2)=>list.push({id,label,targetId:a.id||GUN,x:a.x,y:a.y,z:a.z||0,distance:Math.hypot(p.x-a.x,p.y-a.y),priority});
  if(battle(s)&&alive(thief)&&alive(donor)&&privateGun(donor)&&!p.mounted&&!p.carrying&&p.stamina>=8&&near(p,thief,28)&&sameRegion(s,p,thief)&&(!c||c.phase==='armed')&&thief.weapon&&!thief.gunDisarmed)offer('weapon:disarm-grappler','Knock the yard grappler’s carbine away',thief,-4);
  if(gun?.location==='dropped'&&gun.dropPoint?.regionId===s.region&&!p.mounted&&!p.carrying&&near(p,gun.dropPoint,35))offer('weapon:collect-engraved','Recover Bastian’s actual engraved revolver',gun.dropPoint,-4);
  if(gun?.owner==='mara'&&gun.location==='carried'&&c&&!c.choice){
    if(alive(donor)&&sameRegion(s,p,donor)&&near(p,donor,45)&&!p.mounted&&!p.carrying)offer('weapon:return-engraved','Return the recovered revolver to Bastian',donor,-3);
    offer('weapon:keep-engraved','Keep the disputed engraved revolver',p,5);
  }
  return list;
}

export function interactWeaponCustody(s,id,ctx){
  if(!getWeaponInteractions(s).some(a=>a.id===id))return false;
  const c=initialize(s),p=s.player,thief=person(s,THIEF),donor=person(s,DONOR),world=worldOf(s,ctx);
  if(id==='weapon:disarm-grappler'){
    if(!clearContact(world,p,thief))return false;c.phase='disarming';c.actionStartedAt=s.elapsed;c.actionAge=0;p.weaponAction='disarming';p.weaponActionTargetId=THIEF;thief.weaponAction='being-disarmed';thief.weaponActionTargetId='mara';
    emit(s,ctx,'disarm',thief,THIEF,'mara');notice(s,ctx,'Stay beside the guard while Mara knocks his actual carbine clear. He can still be hurt.');return true;
  }
  const gun=s.weapons[GUN];
  if(id==='weapon:collect-engraved'){
    if(!clearContact(world,p,gun.dropPoint))return false;const drop=clone(gun.dropPoint);gun.owner='mara';gun.location='carried';delete gun.dropPoint;c.phase='player-held';
    if(!rec(s).transactions[txkey('collect')])transaction(s,c,'collect','mara');emit(s,ctx,'pickup-weapon',drop,GUN,'mara',GUN);notice(s,ctx,'One recovered revolver, with the rounds it actually held. Bastian’s claim remains unsettled.');return true;
  }
  if(id==='weapon:return-engraved'){
    if(!clearContact(world,p,donor)||donor.weapon?.id===GUN)return false;
    const restored={id:GUN,name:gun.name,kind:'revolver',capacity:6,ammoType:gun.ammoType,condition:gun.condition,owner:DONOR};
    fallbackPlayerWeapon(s);donor.weapon=restored;donor.ammo=gun.ammo;donor.reserve=gun.reserve;donor.gunDisarmed=false;donor.holstered=true;donor.aiming=false;delete donor.equippedWeaponId;delete s.weapons[GUN];
    c.phase='returned';relationship(s,c,'returned');transaction(s,c,'return','mara');emit(s,ctx,'give-engraved',donor,GUN,'mara');notice(s,ctx,'Bastian receives the same revolver and its remaining ammunition. The return is recorded once.');return true;
  }
  if(id==='weapon:keep-engraved'){
    relationship(s,c,'claimed');transaction(s,c,'claim','mara');notice(s,ctx,'Mara keeps the recovered revolver. Bastian disputes the claim; its cost to trust and honor is recorded once.');return true;
  }
  return false;
}

export function advanceWeaponCustody(s,dt,ctx,world=worldOf(s,ctx)){
  if(!active(s)||!finite(dt)||dt<=0)return s;dt=Math.min(dt,.1);
  let c=custody(s);const thief=person(s,THIEF),donor=person(s,DONOR),p=s.player;
  if(!c){if(!battle(s)||!alive(thief)||!alive(donor)||!privateGun(donor))return s;c=initialize(s);}
  const gun=s.weapons?.[GUN];
  if(c.phase==='armed'&&!alive(thief)){c.phase='ended';clearAction(thief);return s;}
  if(gun?.location==='carried'&&gun.owner===THIEF&&!alive(thief)){dropOwnedWeapon(s,THIEF,ctx);return s;}
  if(c.phase==='disarming'){
    if(!battle(s)||!alive(thief)||!alive(p)||p.mounted||p.carrying||!near(p,thief,28)||!clearContact(world,p,thief)){c.phase='armed';c.actionStartedAt=null;c.actionAge=0;clearAction(p);clearAction(thief);return s;}
    c.actionAge+=dt;if(c.actionAge+1e-9<.6)return s;
    const displaced=normalizedPrivate(thief,s);if(!displaced){c.phase='armed';c.actionStartedAt=null;c.actionAge=0;clearAction(p);clearAction(thief);return s;}
    c.guardWeapon=displaced;removePrivate(thief);clearAction(p);p.stamina=Math.max(0,p.stamina-8);c.disarmedAt=s.elapsed;transaction(s,c,'disarm-guard','mara');c.phase='pursuing';c.actionStartedAt=null;c.actionAge=0;
  }
  if(c.phase==='armed'&&(thief?.gunDisarmed||thief&&!thief.weapon))c.phase='pursuing';
  if(['pursuing','grappling'].includes(c.phase)){
    if(!battle(s)||!alive(thief)||!alive(donor)||!privateGun(donor)){c.phase='ended';c.actionStartedAt=null;c.actionAge=0;clearAction(thief);clearAction(donor);return s;}
    thief.weaponActionTargetId=DONOR;
    if(c.phase==='pursuing'){
      thief.weaponAction='pursuing-donor';if(world)followActor(world,thief,donor,90,dt,22,9);
      if(!thief.mounted&&!donor.mounted&&near(thief,donor,28)&&sameRegion(s,thief,donor)&&clearContact(world,thief,donor)){c.phase='grappling';c.actionStartedAt=s.elapsed;c.actionAge=0;thief.weaponAction='grappling';donor.weaponAction='grappled';donor.weaponActionTargetId=THIEF;emit(s,ctx,'grapple',donor,DONOR,THIEF);}
      return s;
    }
    if(thief.mounted||donor.mounted||!near(thief,donor,28)||!sameRegion(s,thief,donor)||!clearContact(world,thief,donor)){c.phase='pursuing';c.actionStartedAt=null;c.actionAge=0;clearAction(donor);return s;}
    c.actionAge+=dt;if(c.actionAge+1e-9<.9)return s;
    if(registerDonorGun(s,c,ctx,'grapple')){c.theftAt=s.elapsed;transaction(s,c,'steal',THIEF);clearAction(thief);notice(s,ctx,'The disarmed guard has grappled Bastian and displaced his engraved revolver. The dropped gun is a real, contested object.');}return s;
  }
  if(c.phase==='dropped'&&gun?.location==='dropped'&&alive(thief)&&battle(s)&&gun.dropPoint.regionId===(thief.regionId||s.region)){
    thief.weaponAction='recovering-revolver';thief.weaponActionTargetId=GUN;if(world)followActor(world,thief,gun.dropPoint,86,dt,12,9);
    if(near(thief,gun.dropPoint,18)&&clearContact(world,thief,gun.dropPoint)){const drop=clone(gun.dropPoint);gun.owner=THIEF;gun.location='carried';delete gun.dropPoint;equipRegistry(thief,gun);clearAction(thief);c.phase='thief-held';if(!rec(s).transactions[txkey('thief-pickup')])transaction(s,c,'thief-pickup',THIEF);emit(s,ctx,'pickup-weapon',drop,GUN,THIEF,GUN);}return s;
  }
  return s;
}

export function dropOwnedWeapon(s,id,ctx){
  let c=custody(s),gun=s.weapons?.[GUN];const owner=id===GUN?gun?.owner||(privateGun(person(s,DONOR))?DONOR:null):id;
  if(!gun&&owner===DONOR&&person(s,DONOR)?.hp<=0&&privateGun(person(s,DONOR))){c=initialize(s);const previous=c.createdAt!==null;if(!registerDonorGun(s,c,ctx,'donor-death'))return false;if(previous){c.dropCount++;c.events.push({kind:'owner-drop',actorId:DONOR,at:s.elapsed});}return true;}
  if(!c||!gun||gun.owner!==owner||gun.location==='dropped')return false;const a=person(s,owner);if(!a)return false;
  if(owner==='mara')fallbackPlayerWeapon(s);else{if(a.equippedWeaponId===GUN)delete a.equippedWeaponId;if(a.weapon?.id===GUN)a.weapon=null;a.ammo=0;a.reserve=0;a.gunDisarmed=true;a.aiming=false;a.holstered=true;clearAction(a);}
  gun.location='dropped';gun.dropPoint=pos(a,s);c.phase='dropped';c.dropCount++;c.events.push({kind:'owner-drop',actorId:owner,at:s.elapsed});emit(s,ctx,'weapon-drop',gun.dropPoint,GUN,owner);return true;
}

export function validateWeaponCustody(s){
  const r=rec(s),c=custody(s),gun=s.weapons?.[GUN],donor=person(s,DONOR),thief=person(s,THIEF);
  if(person(s,'mara')?.equippedWeaponId===GUN&&(!gun||gun.owner!=='mara'||gun.location!=='carried'))return false;
  if(!r)return !gun;if(c==null)return !gun;
  if(!object(c)||c.schema!==1||c.weaponId!==GUN||c.thiefId!==THIEF||c.donorId!==DONOR||!phases.has(c.phase)||!finite(c.initializedAt)||c.initializedAt<0||c.initializedAt>s.elapsed||!finite(c.actionAge)||c.actionAge<0||c.actionAge>1.001||!Number.isInteger(c.dropCount)||c.dropCount<0||c.dropCount>32||!Array.isArray(c.events)||c.events.length>40||![null,'grapple','donor-death'].includes(c.origin)||![null,'returned','claimed'].includes(c.choice))return false;
  for(const key of['actionStartedAt','disarmedAt','createdAt','theftAt'])if(c[key]!==null&&(!finite(c[key])||c[key]<c.initializedAt||c[key]>s.elapsed))return false;
  if(['disarming','grappling'].includes(c.phase)!==(c.actionStartedAt!==null)||c.phase==='disarming'&&c.actionAge>.601||c.phase==='grappling'&&c.actionAge>.901)return false;
  if(c.events.some((e,i)=>!object(e)||!finite(e.at)||e.at<c.initializedAt||e.at>s.elapsed||i&&e.at<c.events[i-1].at||!['mara',DONOR,THIEF].includes(e.actorId)||!WEAPON_CUSTODY_TRANSACTIONS.includes(e.kind)&&e.kind!=='owner-drop'))return false;
  if(c.dropCount!==c.events.filter(e=>e.kind==='owner-drop').length||!!r.transactions[txkey('disarm-guard')]!==(c.disarmedAt!==null)||!!r.transactions[txkey('steal')]!==(c.theftAt!==null)||c.origin==='donor-death'&&donor?.hp>0)return false;
  if(c.guardWeapon){const w=c.guardWeapon;if(!object(w)||w.owner!==THIEF||w.location!=='dropped'||!object(w.dropPoint)||!['x','y','z'].every(k=>finite(w.dropPoint[k]))||!Number.isInteger(w.ammo)||w.ammo<0||w.ammo>w.capacity||!Number.isInteger(w.reserve)||w.reserve<0||w.reserve>999||!finite(w.condition)||w.condition<0||w.condition>1||!rec(s).transactions[txkey('disarm-guard')])return false;}
  const privateDonor=!!privateGun(donor),references=Object.values(s.entities||{}).filter(a=>a.weapon?.id===GUN&&!a.weapon.registryOwned);
  if(references.length>1||gun&&references.length)return false;
  if(c.createdAt===null){if(gun||c.origin||c.theftAt!==null||!privateDonor||c.choice||c.capturedRounds!=null||(c.npcShots||0)!==0||(c.externalShots||0)!==0||['dropped','thief-held','player-held','returned'].includes(c.phase))return false;}
  else if(c.origin==='grapple'&&(c.theftAt===null||c.theftAt!==c.createdAt||!r.transactions[txkey('steal')])||c.origin===null)return false;
  if(c.createdAt!==null){
    if(!Number.isInteger(c.capturedRounds)||c.capturedRounds<0||c.capturedRounds>1005||!Number.isInteger(c.npcShots)||c.npcShots<0||!Number.isInteger(c.externalShots)||c.externalShots<0)return false;
    const playerShots=(r.rival.shots||[]).filter(shot=>shot.weaponId===GUN).length,current=gun?gun.ammo+gun.reserve:privateDonor?donor.ammo+donor.reserve:NaN;
    if(current!==c.capturedRounds-c.npcShots-c.externalShots-playerShots)return false;
  }
  if(gun){
    if(gun.id!==GUN||gun.kind!=='revolver'||gun.capacity!==6||gun.ammoType!=='engraved-round'||gun.loanMissionId!==null||!['mara',DONOR,THIEF].includes(gun.owner)||!['carried','saddle','chest','dropped'].includes(gun.location)||!Number.isInteger(gun.ammo)||gun.ammo<0||gun.ammo>6||!Number.isInteger(gun.reserve)||gun.reserve<0||gun.reserve>999||!finite(gun.condition)||gun.condition<0||gun.condition>1||!donor?.gunDisarmed)return false;
    if(gun.location==='dropped'){if(c.phase!=='dropped'||!object(gun.dropPoint)||!['x','y','z'].every(k=>finite(gun.dropPoint[k]))||typeof gun.dropPoint.regionId!=='string'||!s.regions?.[gun.dropPoint.regionId])return false;}
    else if(gun.dropPoint)return false;
    if(gun.owner===DONOR&&gun.location!=='dropped'||gun.owner===THIEF&&!['dropped','carried'].includes(gun.location))return false;
    if(gun.owner===THIEF&&gun.location!=='dropped'&&(c.phase!=='thief-held'||thief?.equippedWeaponId!==GUN||thief?.weapon?.id!==GUN||!thief.weapon.registryOwned||thief.ammo!==0||thief.reserve!==0))return false;
    if(gun.owner==='mara'&&gun.location!=='dropped'&&c.phase!=='player-held')return false;
    if(gun.owner==='mara'&&!r.transactions[txkey('collect')]||gun.owner===THIEF&&gun.location==='carried'&&!r.transactions[txkey('thief-pickup')])return false;
  }else if(c.createdAt!==null&&(c.phase!=='returned'||c.choice!=='returned'||!privateDonor))return false;
  if(c.choice){const key=c.choice==='returned'?'return':'claim',entry=r.transactions[txkey(key)],effect=s.companions?.[DONOR]?.weaponDisposition;if(!entry||entry.actorId!=='mara'||effect?.weaponId!==GUN||effect.choice!==c.choice||effect.trustDelta!==(c.choice==='returned'?2:-2)||effect.at!==entry.at||r.transactions[txkey(key==='return'?'claim':'return')])return false;}
  for(const key of WEAPON_CUSTODY_TRANSACTIONS){const entries=c.events.filter(e=>e.kind===key),t=r.transactions[txkey(key)];if(entries.length>1||!!t!==(entries.length===1)||t&&(!object(t)||t.completed!==true||t.at!==entries[0].at||t.actorId!==entries[0].actorId))return false;}
  return true;
}
