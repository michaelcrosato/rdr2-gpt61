import assert from 'node:assert/strict';
import {emitTrainShot} from '../../src/train-combat.js';
import {createTrainBlastOwner} from '../../src/train-blast.js';
import {segmentBox,localPoint,worldPoint} from '../../src/rail-foundation/rigid-frame.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {TRAIN_CHARGE_HALF_EXTENTS as half} from '../../content/campaign/train-equipment.js';
import * as Powder from '../../src/train-powder.js';
import * as Custody from '../../src/rival-continuation.js';
const P=a=>({x:a.x,y:a.y,z:a.z||0}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/** EXPLICIT PROJECTILE FIXTURE, not production impact dispatch/public play.
 * The real train emitter spends the actual owning registry round. Each bounded
 * flight segment races native cover, existing living body boxes and the finite
 * actual prepared charge OBB. Only a real earliest charge intersection creates
 * the receipt. This fixture does not implement ordinary body-hit damage,
 * terrain triangles, moving-target sweep, native held-bundle poses or mission
 * outcomes. Root owns the production projectile binder and full-world proof.
 */
export function bindPowderProjectileFixture({s,ctx,tick,world,blastProviders,boxFor}){
 const combat=s.campaign.missions[TRAIN_ID].train.combat;
 assert.ok(combat&&Array.isArray(combat.impacts));
 function validate(_s,receipt,reference){const saved=combat.impacts.find(hit=>hit.kind==='charge'&&hit.bulletId===receipt?.bulletId);return !!saved&&saved.custodyEventId===null&&same(saved,receipt)&&saved.at===s.elapsed&&same(saved.chargeRef,reference)&&combat.emissions.some(e=>e.serial===saved.shotSerial&&e.weaponId===saved.weaponId);}
 const nativeBlast=createTrainBlastOwner({...blastProviders,validateProjectileHit:validate});
 Object.assign(ctx,nativeBlast,{validatePowderProjectileHit:validate});
 const external=ctx.prepareCustodyPhysicalEffects;
 ctx.prepareCustodyPhysicalEffects=(_s,op,event)=>{
  const other=external(_s,op,event);
  if(op.kind!=='blast-charge'||op.options.trigger!=='projectile')return other;
  const hit=combat.impacts.find(hit=>hit.kind==='charge'&&same(hit,op.options.physicalReceipt? s.campaign.missions[TRAIN_ID].train.powder.physicalEvents.find(e=>e.id===op.cause.eventId).data.projectileReceipt:null));
  if(!hit||hit.custodyEventId!==null)return null;const prior=hit.custodyEventId;
  return{apply(){other.apply();hit.custodyEventId=event.id;},rollback(){hit.custodyEventId=prior;other.rollback();}};
 };
 function nearest(from,to,bullet){
  const w=world(),cover=blastProviders.raycast(w,from,to,{fraction:1,mode:'projectile'});let best=cover?{kind:'cover',u:cover.rayU,volumeId:cover.volumeId}:null;
  for(const actor of Object.values(s.entities)){
   if(actor.id===bullet.shooterId||actor.hp<=0||actor.hidden||actor.departed||actor.escaped||actor.regionId!==w.regionId)continue;
   const root=blastProviders.actorPoint(actor,w),radius=actor.r??9,height=actor.height??53,u=segmentBox(from,to,{min:{x:root.x-radius,y:root.y-radius,z:root.z},max:{x:root.x+radius,y:root.y+radius,z:root.z+height}});
   if(u!==null&&(!best||u<best.u))best={kind:'body',u,actorId:actor.id};
  }
  for(const reference of Powder.createPowderReferences().charges){
   const charge=Custody.resolveFixedRef(s,reference,'sealed-charge');
   if(charge.sealed!==false||charge.powder?.spent||!charge.powder?.primerId)continue;
   const box=boxFor(charge,w);if(!box)continue;
   const a=box.frame?localPoint(box.frame,from):from,b=box.frame?localPoint(box.frame,to):to,c=box.center,u=segmentBox(a,b,{min:{x:c.x-half.x,y:c.y-half.y,z:c.z-half.z},max:{x:c.x+half.x,y:c.y+half.y,z:c.z+half.z}});
   if(u!==null&&(!best||u<best.u))best={kind:'charge',u,chargeRef:reference};
  }
  return best;
 }
 function shoot(target){const before=s.weapons[s.entities.mara.equippedWeaponId].ammo,bullet=emitTrainShot(s,'mara',target);assert.ok(bullet,'Actual owned loaded emitter must fire');assert.equal(s.weapons[bullet.weaponId].ammo,before-1);return bullet;}
 function fly(bullet){
  for(let i=0;i<200&&bullet.ttl>0;i++){
   const dt=Math.min(.025,bullet.ttl),from=P(bullet),to={x:from.x+bullet.vx*dt,y:from.y+bullet.vy*dt,z:from.z+bullet.vz*dt};tick({},dt);
   const hit=nearest(from,to,bullet);bullet.age+=dt;bullet.ttl-=dt;
   if(hit){
    const receipt={kind:hit.kind,bulletId:bullet.id,shotSerial:bullet.shotSerial,weaponId:bullet.weaponId,at:s.elapsed,from,to,point:{x:from.x+(to.x-from.x)*hit.u,y:from.y+(to.y-from.y)*hit.u,z:from.z+(to.z-from.z)*hit.u},rayU:hit.u,...(hit.kind==='charge'?{chargeRef:hit.chargeRef,custodyEventId:null}:hit.kind==='body'?{actorId:hit.actorId}:{volumeId:hit.volumeId})};
    combat.impacts.push(receipt);s.bullets=s.bullets.filter(b=>b.id!==bullet.id);
    return{receipt,blasted:hit.kind==='charge'?Powder.applyPowderProjectileHit(s,hit.chargeRef,structuredClone(receipt),ctx):false};
   }
   Object.assign(bullet,to);
  }
  s.bullets=s.bullets.filter(b=>b.id!==bullet.id);return{receipt:null,blasted:false};
 }
 return{shoot,fly,validate};
}
