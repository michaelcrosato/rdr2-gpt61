/** Counted supply handoff and recoverable carbine rack custody. */
import {RIVAL_ID,RIVAL_CARBINE} from '../content/campaign/bellwether-works.js';
import {followActor} from './campaign-navigation.js';
const rec=s=>s.campaign.missions[RIVAL_ID],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=a=>({x:a.x,y:a.y,z:a.z||0});
const near=(a,b,r=22)=>a&&b&&distance(a,b)<=r&&Math.abs((a.z||0)-(b.z||0))<8;
export const EQUIPMENT_TRANSACTION_KEY='grant:spare-cartridges';
export const CARBINE_INSPECTION_TEXT='Seven rounds loaded. Ruth has forty-two spare cartridges for this gun; a coach shell or an arrow will not fit. Check the action, then take it from Copper’s rack. Bring your sidearm too.';
export const createEquipmentWork=()=>({schema:1,pending:false,contact:0,issued:0,receipt:null});
export const equipmentContract=s=>rec(s).rival.equipment!==undefined;
export const ammunitionReady=s=>!equipmentContract(s)||rec(s).rival.equipment.issued===42;
export const carriedCarbine=s=>s.weapons[RIVAL_CARBINE.id]?.location==='carried';
export const initialCarbineReserve=s=>equipmentContract(s)?0:42;
export const issuedCarbineRounds=s=>7+(equipmentContract(s)?rec(s).rival.equipment.issued:42);
export function requestCartridges(s,ctx){
  const r=rec(s),e=r.rival.equipment;
  if(!e||e.issued||r.mission.stage!==1||s.player.mounted||s.player.carrying||!r.flags.carbineGranted)return false;
  e.pending=true;e.contact=0;ctx.notice(s,'Ruth is bringing forty-two spare cartridges. Wait beside her for the handoff.');return true;
}
export function stepEquipmentWork(s,dt,ctx){
  const r=rec(s),e=r.rival.equipment;if(!e||!e.pending||e.issued||r.mission.stage!==1)return;
  const p=s.player,ruth=s.entities.ruth;if(p.mounted||p.carrying||ruth.mounted){e.contact=0;return;}
  if(!near(p,ruth)){
    e.contact=0;followActor(ctx.worldFor(s),ruth,{x:p.x+12,y:p.y+7,z:p.z||0},76,dt,3);return;
  }
  if(e.contact===0){
    const meeting={x:(p.x+ruth.x)/2,y:(p.y+ruth.y)/2,z:(p.z||0)+32};
    p.holstered=true;p.armed=false;ruth.holstered=true;ruth.aiming=false;
    ctx.present(s,'give-cartridges',meeting,'mara',point(ruth),'ruth',{sourceId:'ruth'});
    ctx.present(s,'receive-cartridges',meeting,'ruth',point(p),'mara',{sourceId:'mara'});
  }
  e.contact+=dt;if(e.contact+1e-9<1.1)return;
  const key=`${RIVAL_ID}:${EQUIPMENT_TRANSACTION_KEY}`;
  if(r.transactions[key])return;
  const weapon=s.weapons[RIVAL_CARBINE.id];if(!weapon)return;
  weapon.reserve+=42;e.issued=42;e.pending=false;
  e.receipt={at:s.elapsed,contact:e.contact,giver:point(ruth),receiver:point(p),count:42};
  r.transactions[key]={completed:true};ruth.actionTimer=1.1;
  ctx.notice(s,'Ruth: “Forty-two spare cartridges. Seven in the Tern. Count what you spend, and bring the gun back to the rack when you need your hands.”');
}
export function storeCarbine(s,ctx){
  const r=rec(s),p=s.player,w=s.weapons[RIVAL_CARBINE.id];
  if(!w||w.location!=='carried'||!r.flags.carbineInspected||p.mounted||p.carrying||p.weaponAction||!near(p,s.horse,58))return false;
  w.location='saddle';w.rackMountId=s.horse.id;
  if(p.equippedWeaponId===w.id){p.equippedWeaponId='mara-revolver';p.holstered=true;p.armed=false;p.reloadTimer=0;delete p.reloadWeaponId;}
  ctx.present(s,'store-weapon',point(s.horse),w.id,point(p),'mara',{sourceId:'mara'});
  ctx.notice(s,'The Tern is on Copper’s rack. Retrieve it before the expedition leaves; your other weapons are still yours.');return true;
}
export function validateEquipmentWork(s){
  const r=rec(s),e=r.rival.equipment;
  if(e===undefined)return !r.transactions[`${RIVAL_ID}:${EQUIPMENT_TRANSACTION_KEY}`];
  if(!e||e.schema!==1||Object.keys(e).length!==5||typeof e.pending!=='boolean'||!Number.isFinite(e.contact)||e.contact<0||e.contact>1.201||![0,42].includes(e.issued))return false;
  const granted=!!r.transactions[`${RIVAL_ID}:${EQUIPMENT_TRANSACTION_KEY}`];
  if(granted!==(e.issued===42)||e.pending&&(e.issued!==0||r.mission.stage!==1)||r.mission.stage>=2&&e.issued!==42)return false;
  if(!e.issued)return e.receipt===null;
  const receipt=e.receipt;
  if(!receipt||!Number.isFinite(receipt.at)||receipt.at<0||receipt.at>s.elapsed||receipt.count!==42||!Number.isFinite(receipt.contact)||receipt.contact<1.1-1e-9||receipt.contact>1.201||!['giver','receiver'].every(key=>receipt[key]&&['x','y','z'].every(axis=>Number.isFinite(receipt[key][axis])))||!near(receipt.giver,receipt.receiver))return false;
  return r.flags.carbineGranted&&e.pending===false;
}
