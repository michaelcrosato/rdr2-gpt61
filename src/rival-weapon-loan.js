/** One active later loan of an already owned gun. Current ammunition exists
 * only in s.weapons; historical receipts bind it to actual Train emissions. */
import {RIVAL_ID,RIVAL_CARBINE} from '../content/campaign/bellwether-works.js';
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
const OPENING='snowbound-the-last-warm-light',RESCUE='snowbound-a-voice-under-ice',ENGRAVED='bastian-engraved-revolver';
const sources=Object.freeze({'mara-revolver':OPENING,'coach-gun':RESCUE,[RIVAL_CARBINE.id]:RIVAL_ID});
const definitions=Object.freeze({'mara-revolver':['revolver',6,'revolver-round'],'coach-gun':['coach-gun',2,'coach-shell'],[RIVAL_CARBINE.id]:['carbine',7,'tern-cartridge']});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),copy=structuredClone;
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),rival=s=>s.campaign?.missions?.[RIVAL_ID];
const events=s=>rival(s)?.rival?.continuation?.events||[];
const emissions=s=>s.campaign?.missions?.[TRAIN_ID]?.train?.combat?.emissions;
export function originalWeaponRef(id){return sources[id]?{sourceMissionId:sources[id],objectId:id}:null;}
export function isOriginalWeaponRef(ref){const expected=originalWeaponRef(ref?.objectId);return !!expected&&keys(ref,['sourceMissionId','objectId'])&&same(ref,expected);}
export function resolveOriginalWeapon(s,ref){
  if(!isOriginalWeaponRef(ref))throw new TypeError('Only the finite original loanable registry guns are allowed');
  const weapon=s.weapons?.[ref.objectId],definition=definitions[ref.objectId];
  if(!weapon||weapon.id!==ref.objectId||weapon.kind!==definition[0]||weapon.capacity!==definition[1]||weapon.ammoType!==definition[2])throw new TypeError('The original gun is absent or incompatible');
  return weapon;
}
function ownership(w){return{owner:w.owner,location:w.location,rackPresent:Object.hasOwn(w,'rackMountId'),rackMountId:w.rackMountId??null};}
function borrower(b){return{weapon:b.weapon??null,equippedPresent:Object.hasOwn(b,'equippedWeaponId'),equippedWeaponId:b.equippedWeaponId??null,gunDisarmed:b.gunDisarmed,ammo:b.ammo,reserve:b.reserve};}
function descriptor(w){return{id:w.id,kind:w.kind,capacity:w.capacity,owner:'bastian',registryOwned:true};}
function setOwnership(w,value){w.owner=value.owner;w.location=value.location;if(value.rackPresent)w.rackMountId=value.rackMountId;else delete w.rackMountId;}
function setBorrower(b,value){b.weapon=copy(value.weapon);b.gunDisarmed=value.gunDisarmed;b.ammo=value.ammo;b.reserve=value.reserve;if(value.equippedPresent)b.equippedWeaponId=value.equippedWeaponId;else delete b.equippedWeaponId;}
function validStock(w){return Number.isInteger(w.ammo)&&w.ammo>=0&&w.ammo<=w.capacity&&Number.isInteger(w.reserve)&&w.reserve>=0&&w.reserve<=999;}
function loanEvents(s){return events(s).filter(event=>['lend-weapon','return-weapon'].includes(event.kind));}
export function activeRivalWeaponLoan(s,id){
  if(s?.version!==5)return null;const list=loanEvents(s),last=list.at(-1);
  return last?.kind==='lend-weapon'&&last.operation?.options?.weaponId===id?last:null;
}
export function prepareRivalWeaponLoan(s,op){
  if(!['lend-weapon','return-weapon'].includes(op.kind)||!same(op.actorIds,['mara','bastian'])||op.to!==null||!keys(op.options,['weaponId'])||op.refs.length!==1||!same(op.refs[0],originalWeaponRef(op.options.weaponId)))return null;
  const w=resolveOriginalWeapon(s,op.refs[0]),b=s.entities.bastian,m=s.entities.mara,shots=emissions(s),prior=loanEvents(s);
  const selected=s.weapons[m.equippedWeaponId];
  if(!rival(s).mission.completed||!s.campaign.missions[RESCUE]?.mission.completed||s.campaign.activeMissionId!==TRAIN_ID||!Array.isArray(shots)||!validStock(w)||w.loanMissionId!==null||m.equippedWeaponId===w.id||selected?.owner!=='mara'||selected.location!=='carried'||m.holstered!==true||b.hp<=0)return null;
  const before=ownership(w),beforeBorrower=borrower(b);let after,afterBorrower;
  if(op.kind==='lend-weapon'){
    if(prior.at(-1)?.kind==='lend-weapon'||w.owner!=='mara'||!['carried','saddle','chest'].includes(w.location)||s.weapons[ENGRAVED]?.owner!=='mara'||rival(s).rival.weaponCustody?.choice!=='claimed'||b.gunDisarmed!==true||b.weapon!=null||b.ammo!==0||b.reserve!==0)return null;
    after={owner:'bastian',location:'carried',rackPresent:false,rackMountId:null};afterBorrower={weapon:descriptor(w),equippedPresent:true,equippedWeaponId:w.id,gunDisarmed:false,ammo:0,reserve:0};
  }else{
    if(prior.at(-1)?.kind!=='lend-weapon'||prior.at(-1).operation.options.weaponId!==w.id||w.owner!=='bastian'||w.location!=='carried'||!same(b.weapon,descriptor(w))||b.equippedWeaponId!==w.id||b.gunDisarmed!==false||b.ammo!==0||b.reserve!==0)return null;
    after={owner:'mara',location:'carried',rackPresent:false,rackMountId:null};afterBorrower={weapon:null,equippedPresent:false,equippedWeaponId:null,gunDisarmed:true,ammo:0,reserve:0};
  }
  const change={weaponRef:copy(op.refs[0]),before,after,stock:{ammo:w.ammo,reserve:w.reserve,emissionIndex:shots.length},playerSelection:{weaponId:m.equippedWeaponId,holstered:true},beforeBorrower:copy(beforeBorrower),afterBorrower};
  let applied=false;
  return{change,
    apply(){if(applied||s.weapons[w.id]!==w||!same(ownership(w),before)||!same(borrower(b),beforeBorrower)||w.ammo!==change.stock.ammo||w.reserve!==change.stock.reserve||emissions(s)!==shots||shots.length!==change.stock.emissionIndex||m.equippedWeaponId===w.id||m.holstered!==true)throw new TypeError('Prepared weapon handoff is stale');setOwnership(w,after);setBorrower(b,afterBorrower);applied=true;},
    rollback(){setOwnership(w,before);setBorrower(b,beforeBorrower);applied=false;},
  };
}
function validOwnership(v){return keys(v,['owner','location','rackPresent','rackMountId'])&&['mara','bastian'].includes(v.owner)&&['carried','saddle','chest'].includes(v.location)&&typeof v.rackPresent==='boolean'&&(v.rackPresent?typeof v.rackMountId==='string':v.rackMountId===null);}
function validBorrower(v){return keys(v,['weapon','equippedPresent','equippedWeaponId','gunDisarmed','ammo','reserve'])&&typeof v.equippedPresent==='boolean'&&(v.equippedPresent?typeof v.equippedWeaponId==='string':v.equippedWeaponId===null)&&typeof v.gunDisarmed==='boolean'&&v.ammo===0&&v.reserve===0;}
export function validateRivalWeaponLoans(s,allEvents){
  try{
    const list=allEvents.filter(event=>['lend-weapon','return-weapon'].includes(event.kind));
    if(allEvents.some(event=>!['lend-weapon','return-weapon'].includes(event.kind)&&Object.hasOwn(event,'weaponChange')))return false;
    if(!list.length)return !Object.values(s.weapons).some(w=>Object.hasOwn(sources,w.id)&&w.owner==='bastian');
    const shots=emissions(s),b=s.entities.bastian,m=s.entities.mara;
    if(list[0].kind!=='lend-weapon'||!Array.isArray(shots)||!rival(s).mission.completed||rival(s).rival.weaponCustody?.choice!=='claimed'||s.weapons[ENGRAVED]?.owner!=='mara')return false;
    let previous=null;const lastByWeapon=new Map();for(let index=0;index<list.length;index++){
      const event=list[index];if(event.kind!==(index%2?'return-weapon':'lend-weapon'))return false;
      const op=event.operation,c=event.weaponChange,w=resolveOriginalWeapon(s,c?.weaponRef);
      if(!keys(c,['weaponRef','before','after','stock','playerSelection','beforeBorrower','afterBorrower'])||!same(op.actorIds,['mara','bastian'])||op.to!==null||!same(op.refs,[c.weaponRef])||op.options.weaponId!==w.id||!validOwnership(c.before)||!validOwnership(c.after)||!validBorrower(c.beforeBorrower)||!validBorrower(c.afterBorrower)||!keys(c.playerSelection,['weaponId','holstered'])||c.playerSelection.holstered!==true||c.playerSelection.weaponId===w.id||!s.weapons[c.playerSelection.weaponId]||!keys(c.stock,['ammo','reserve','emissionIndex'])||!validStock({...w,ammo:c.stock.ammo,reserve:c.stock.reserve})||!Number.isSafeInteger(c.stock.emissionIndex)||c.stock.emissionIndex<0||c.stock.emissionIndex>shots.length||shots.slice(0,c.stock.emissionIndex).some(shot=>shot.at>event.at)||shots.slice(c.stock.emissionIndex).some(shot=>shot.at<event.at))return false;
      if(event.kind==='lend-weapon'){
        if(c.before.owner!=='mara'||!same(c.after,{owner:'bastian',location:'carried',rackPresent:false,rackMountId:null})||c.beforeBorrower.weapon!==null||c.beforeBorrower.gunDisarmed!==true||!same(c.afterBorrower,{weapon:descriptor(w),equippedPresent:true,equippedWeaponId:w.id,gunDisarmed:false,ammo:0,reserve:0}))return false;
        const earlier=lastByWeapon.get(w.id);if(earlier){if(c.stock.emissionIndex<earlier.stock.emissionIndex)return false;const spent=shots.slice(earlier.stock.emissionIndex,c.stock.emissionIndex).filter(shot=>shot.weaponId===w.id);if(spent.some(shot=>shot.actorId!=='mara')||c.stock.ammo+c.stock.reserve!==earlier.stock.ammo+earlier.stock.reserve-spent.length)return false;}
      }else{
        if(!same(c.weaponRef,previous.weaponRef)||!same(c.before,previous.after)||!same(c.beforeBorrower,previous.afterBorrower)||!same(c.after,{owner:'mara',location:'carried',rackPresent:false,rackMountId:null})||!same(c.afterBorrower,{weapon:null,equippedPresent:false,equippedWeaponId:null,gunDisarmed:true,ammo:0,reserve:0})||c.stock.emissionIndex<previous.stock.emissionIndex)return false;
        const spent=shots.slice(previous.stock.emissionIndex,c.stock.emissionIndex).filter(shot=>shot.weaponId===w.id);if(spent.some(shot=>shot.actorId!=='bastian')||c.stock.ammo+c.stock.reserve!==previous.stock.ammo+previous.stock.reserve-spent.length)return false;
      }
      previous=c;lastByWeapon.set(w.id,c);
    }
    const last=list.at(-1),c=last.weaponChange,w=resolveOriginalWeapon(s,c.weaponRef),later=shots.slice(c.stock.emissionIndex).filter(shot=>shot.weaponId===w.id),expectedOwner=last.kind==='lend-weapon'?'bastian':'mara';
    if(w.owner!==expectedOwner||w.loanMissionId!==null||!validStock(w)||last.kind==='lend-weapon'&&(later.some(shot=>shot.actorId!==expectedOwner)||w.ammo+w.reserve!==c.stock.ammo+c.stock.reserve-later.length))return false;
    if(last.kind==='lend-weapon'&&(w.location!=='carried'||Object.hasOwn(w,'rackMountId')||m.equippedWeaponId===w.id||!same(borrower(b),c.afterBorrower)))return false;
    if(last.kind==='return-weapon'&&!same(borrower(b),c.afterBorrower))return false;
    return Object.values(s.weapons).filter(w=>Object.hasOwn(sources,w.id)&&w.owner==='bastian').length===(last.kind==='lend-weapon'?1:0);
  }catch{return false;}
}
export function weaponLoanHistoricalState(s){
  const first=loanEvents(s)[0];if(!first)return s;
  const b={...s.entities.bastian},weapons={...s.weapons};setBorrower(b,first.weaponChange.beforeBorrower);const seen=new Set();
  for(const event of loanEvents(s)){const c=event.weaponChange;if(seen.has(c.weaponRef.objectId))continue;seen.add(c.weaponRef.objectId);const w={...weapons[c.weaponRef.objectId]};setOwnership(w,c.before);weapons[w.id]=w;}
  return {...s,entities:{...s.entities,bastian:b},weapons};
}
