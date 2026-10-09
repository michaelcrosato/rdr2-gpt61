/** Finite weapon emission for the train operation. Registry guns and private
 * NPC guns keep their original stock authority. This component grants nothing,
 * resolves no impact and advances no scene; the physical projectile step owns
 * those effects.
 */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {recordCustodyShot} from './rival-weapon-custody.js';
const finite=Number.isFinite,point=a=>({x:a.x,y:a.y,z:a.z||0});
const validPoint=a=>a&&['x','y','z'].every(k=>finite(a[k]));
const validStock=(weapon,stock)=>weapon&&typeof weapon.id==='string'&&weapon.id.length>0&&weapon.capacity===({revolver:6,carbine:7,'coach-gun':2})[weapon.kind]&&Number.isInteger(stock.ammo)&&stock.ammo>=0&&stock.ammo<=weapon.capacity&&Number.isInteger(stock.reserve)&&stock.reserve>=0&&stock.reserve<=999;
export function createTrainCombat(){return{schema:1,nextShot:1,emissions:[],impacts:[]};}
export function resolveTrainWeapon(s,actorId){
  const actor=s.entities?.[actorId];if(!actor)return null;
  if(actorId==='mara'||actor.weapon?.registryOwned){
    const weapon=s.weapons?.[actor.equippedWeaponId];
    if(!weapon||weapon.owner!==actorId||weapon.location!=='carried')return null;
    return{weapon,stock:weapon};
  }
  const weapon=actor.weapon;
  if(!weapon||weapon.owner!==actorId||actor.gunDisarmed)return null;
  return{weapon,stock:actor};
}
export function emitTrainShot(s,actorId,target,{faction}={}){
  const r=s.campaign?.missions?.[TRAIN_ID],combat=r?.train?.combat,actor=s.entities?.[actorId],owned=resolveTrainWeapon(s,actorId);
  if(s.campaign?.activeMissionId!==TRAIN_ID||s.dialog||s.failure||!combat||!actor||!validPoint(actor)||actor.hp<=0||actor.hidden||actor.departed||actor.carrying||actor.attachment||actor.holstered!==false||actor.reloadTimer>0||actor.shotTimer>0||!owned||!validPoint(target))return false;
  const {weapon,stock}=owned;
  if(!validStock(weapon,stock)||stock.ammo<1)return false;
  const muzzle={x:actor.x,y:actor.y,z:(actor.z||0)+(actor.mounted?64:actor.crouch?21:29)},delta={x:target.x-muzzle.x,y:target.y-muzzle.y,z:target.z-muzzle.z},length=Math.hypot(delta.x,delta.y,delta.z);
  if(!validPoint(muzzle)||!finite(length)||length<1e-7||!['vx','vy','vz'].every(k=>actor[k]===undefined||finite(actor[k])))return false;
  const actualFaction=actorId==='mara'?'player':faction;
  if(!['player','ally','enemy'].includes(actualFaction)||actorId!=='mara'&&actualFaction==='player')return false;
  const actualDamage=actualFaction==='enemy'?8:actualFaction==='ally'?22:weapon.kind==='coach-gun'?64:45;
  const speed=720,range=weapon.range??(weapon.kind==='coach-gun'?420:weapon.kind==='revolver'?650:720);
  if(!finite(range)||range<=0)return false;
  const unit={x:delta.x/length,y:delta.y/length,z:delta.z/length},serial=combat.nextShot;
  if(!Number.isInteger(serial)||serial<1||!finite(s.elapsed)||!Array.isArray(s.bullets)||!Array.isArray(combat.emissions))return false;
  if(actorId==='mara'&&(!Number.isInteger(r.performance?.shots)||r.performance.shots<0||!Number.isInteger(s.stats?.shots)||s.stats.shots<0))return false;
  const bullet={id:`${TRAIN_ID}:shot:${serial}`,shooterId:actorId,weaponId:weapon.id,weaponKind:weapon.kind,faction:actualFaction,
    x:muzzle.x+unit.x*13,y:muzzle.y+unit.y*13,z:muzzle.z+unit.z*13,
    vx:unit.x*speed+(actor.vx||0),vy:unit.y*speed+(actor.vy||0),vz:unit.z*speed+(actor.vz||0),ttl:range/speed,age:0,damage:actualDamage,shotSerial:serial};
  const receipt={serial,actorId,weaponId:weapon.id,at:s.elapsed,from:point(actor),muzzle,target:{...target},inheritedVelocity:{x:actor.vx||0,y:actor.vy||0,z:actor.vz||0},ammoBefore:stock.ammo,ammoAfter:stock.ammo-1};
  stock.ammo--;combat.nextShot++;combat.emissions.push(receipt);s.bullets.push(bullet);
  actor.shotTimer=weapon.kind==='carbine'?.28:weapon.kind==='coach-gun'?.7:.4;actor.facing=Math.atan2(delta.y,delta.x);actor.aiming=true;
  recordCustodyShot(s,actorId,weapon.id);
  if(actorId==='mara'){r.performance.shots=(r.performance.shots||0)+1;s.stats.shots++;}
  return bullet;
}
export function requestTrainReload(s,actorId){
  const actor=s.entities?.[actorId],owned=resolveTrainWeapon(s,actorId);
  if(s.campaign?.activeMissionId!==TRAIN_ID||s.dialog||s.failure||!actor||actor.hp<=0||actor.carrying||actor.attachment||actor.reloadTimer>0||!owned)return false;
  const {weapon,stock}=owned;
  if(!validStock(weapon,stock)||stock.ammo>=weapon.capacity||stock.reserve<1)return false;
  actor.reloadTimer=weapon.kind==='carbine'?2.4:weapon.kind==='coach-gun'?1.8:1.3;actor.reloadWeaponId=weapon.id;return true;
}
export function stepTrainReload(s,actorId,dt){
  if(s.campaign?.activeMissionId!==TRAIN_ID||s.dialog||s.failure||!finite(dt)||dt<=0||dt>.1)return false;
  const actor=s.entities?.[actorId];if(!actor||actor.reloadTimer<=0)return false;
  const owned=resolveTrainWeapon(s,actorId);
  if(actor.hp<=0||actor.carrying||actor.attachment||!owned||!validStock(owned.weapon,owned.stock)||owned.weapon.id!==actor.reloadWeaponId){actor.reloadTimer=0;delete actor.reloadWeaponId;return false;}
  actor.reloadTimer=Math.max(0,actor.reloadTimer-dt);if(actor.reloadTimer>0)return false;
  const {weapon,stock}=owned,count=Math.min(weapon.capacity-stock.ammo,stock.reserve);
  if(!Number.isInteger(count)||count<=0){delete actor.reloadWeaponId;return false;}
  stock.ammo+=count;stock.reserve-=count;delete actor.reloadWeaponId;return true;
}
