import assert from 'node:assert/strict';
import * as Journey from '../../src/campaign-journey.js';
import * as Powder from '../../src/train-powder.js';
import {createTrainCombat} from '../../src/train-combat.js';
import {originalWeaponRef,resolveOriginalWeapon} from '../../src/rival-weapon-loan.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {NORTH_CUTTING_WORLD} from '../../content/campaign/north-cutting.js';
import {createPowderFixture} from './train-powder-fixture.mjs';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),hand=a=>({...point(a),z:(a.z||0)+33}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

/** Component boundary ONLY. Caller supplies a genuinely earned, owning-codec
 * valid completed Rival with the actual prior engraved claim. This stages an
 * EMPTY Train powder/combat dispatch context; it earns no Train stage, arrival,
 * introduction, stock, health, score or outcome. The z33 fixture hands and
 * explicit NPC draw/holster input poses do not prove native IK or public input.
 * Movement approaches, timed custody, finite emission and reload are actual.
 */
export function createWeaponLoanFixture(source,weaponId){
  const valid=Journey.restoreCampaign(Journey.serializeCampaign(source));assert.ok(valid,'the supplied claimed campaign is a legal full graph before the component boundary');
  const other=weaponId==='mara-revolver'?'tern-carbine':'mara-revolver';
  Journey.campaignAction(valid,`equip:${other}`);Journey.campaignAction(valid,'holster');
  assert.equal(valid.entities.mara.equippedWeaponId,other);assert.equal(valid.entities.mara.holstered,true);
  const graph=JSON.parse(Journey.serializeCampaign(valid));graph.campaign.activeMissionId=TRAIN_ID;
  graph.campaign.missions[TRAIN_ID].train.powder=Powder.createTrainPowderRecord();graph.campaign.missions[TRAIN_ID].train.combat=createTrainCombat();
  const f=createPowderFixture({componentGraph:graph}),base={...f.ctx},rack=NORTH_CUTTING_WORLD.camp.chest;
  const sourceRef=originalWeaponRef(weaponId);assert.ok(sourceRef);
  function fixedContact(s,id){
    if(id==='station:community-rescue-chest')return{x:rack.x,y:rack.y,z:33};
    if(id==='actor:bastian:weapon-handoff')return hand(s.entities.bastian);
    return base.fixedContact(s,id);
  }
  function sourcePoint(s,ref){const weapon=resolveOriginalWeapon(s,ref);if(weapon.location!=='carried')throw new Error('Fixture only exposes actual carried guns');return hand(s.entities[weapon.owner]);}
  f.ctx.fixedContact=fixedContact;
  f.ctx.authorizeCustodyOp=(s,op)=>['lend-weapon','return-weapon'].includes(op.kind)?op.actorIds.every(id=>s.entities[id]?.hp>0&&!s.entities[id].mounted&&s.entities[id].holstered!==false):base.authorizeCustodyOp(s,op);
  f.ctx.custodySnapshot=(s,args)=>args.refs.some(ref=>ref.objectId===weaponId)?{actors:args.actorIds.map(id=>({id,point:point(s.entities[id])})),sources:args.refs.map(ref=>({ref,point:sourcePoint(s,ref)})),destinations:[]}:base.custodySnapshot(s,args);
  f.ctx.powderContactWindow=(s,op,interval)=>{
    if(!['lend-weapon','return-weapon'].includes(op.kind))return base.powderContactWindow(s,op,interval);
    const actors=op.actorIds.map(id=>({id,root:point(s.entities[id]),hand:hand(s.entities[id]),regionId:'snowbound',alive:s.entities[id].hp>0,mounted:!!s.entities[id].mounted,handUsable:!f.settings.lostHand,handFree:s.entities[id].holstered!==false}));
    const position=sourcePoint(s,op.refs[0]),holder=actors.find(actor=>actor.id===resolveOriginalWeapon(s,op.refs[0]).owner);
    return{...interval,sweptClear:!f.settings.blocked,actors,sources:[{ref:op.refs[0],point:position,regionId:'snowbound',actorId:holder.id,maxHandDistance:distance(holder.hand,position)}],destinations:[],fixedContacts:Powder.powderFixedContactRoles(op).map(role=>{const position=fixedContact(s,role.id),actor=actors.find(actor=>actor.id===role.actorId);return{...role,point:position,maxHandDistance:distance(actor.hand,position)};})};
  };
  f.approach('mara',rack);f.approach('bastian',rack);
  f.request=kind=>Powder.requestPowderCustodyWork(f.s,{kind,actorIds:['mara','bastian'],refs:[sourceRef],to:null,options:{weaponId}},f.ctx);
  return f;
}
