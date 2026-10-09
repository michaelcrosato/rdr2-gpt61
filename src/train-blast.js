/** Original game blast rules. Geometry providers are mandatory; this is not a
 * pressure/fluid simulation. Seven physical body exposure points determine
 * shielding, using the same current cover as the world. No inventory writer.
 */
import {TRAIN_ID,TRAIN_WORLD} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {resolveFixedRef} from './rival-continuation.js';
import {TRAIN_KIT_DEFINITIONS} from '../content/campaign/train-equipment.js';
const EPS=1e-7,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const copy=v=>structuredClone(v),point=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
const fixed=(id,sourceMissionId=RIVAL_ID)=>({sourceMissionId,objectId:id});
const same=(a,b)=>Object.is(a,b)||object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]))||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));
const record=s=>s.campaign?.missions?.[TRAIN_ID];
export const TRAIN_BLAST_RULES=Object.freeze({radius:120,maxDamage:100,minDamage:5,doorHitRadius:24,doorHitsRequired:2});
export function createTrainBlastState(){return{schema:1,events:[]};}
export function privateTrainDoorBreached(s){
  const events=record(s)?.train?.blasts?.events;
  return Array.isArray(events)&&new Set(events.filter(e=>e.doorHit).map(e=>e.chargeRef.objectId)).size>=TRAIN_BLAST_RULES.doorHitsRequired;
}
function entityRegion(s,actor,visited=new Set()){
  if(!actor||visited.has(actor.id))return null;visited.add(actor.id);
  if(!actor.attachment)return actor.regionId;
  return actor.attachment.type==='rest'?actor.attachment.regionId:entityRegion(s,s.entities[actor.attachment.targetId],visited);
}
function bodySamples(actor,root){
  const r=actor.r??(actor.kind==='horse'?14:9),height=actor.height??(actor.kind==='horse'?46:53),base=root.z+(actor.mounted?23:0);
  if(!Number.isFinite(r)||r<=0||!Number.isFinite(height)||height<=0)return null;
  return{radius:r,height,base,points:[
    {x:root.x,y:root.y,z:base+height*.15},{x:root.x,y:root.y,z:base+height*.5},{x:root.x,y:root.y,z:base+height*.9},
    {x:root.x-r*.8,y:root.y,z:base+height*.5},{x:root.x+r*.8,y:root.y,z:base+height*.5},
    {x:root.x,y:root.y-r*.8,z:base+height*.5},{x:root.x,y:root.y+r*.8,z:base+height*.5},
  ]};
}
/** Bind only to a complete world adapter. Unit callers must label limited
 * geometry fixtures; the mission binds compiled terrain plus current cars.
 * chargePoint/doorPoint/actorPoint derive actual contacts; inputs supply none.
 */
export function createTrainBlastOwner({worldFor,raycast,actorPoint,chargePoint,doorPoint,validateProjectileHit}={}){
  if(![worldFor,raycast,actorPoint,chargePoint,doorPoint].every(fn=>typeof fn==='function'))throw new TypeError('Complete blast world/contact providers are required');
  function geometryReceipt(s,args,world){
    try{
      if(!keys(args,['chargeRef','trigger','cause'])||!['fuse','projectile'].includes(args.trigger)||!keys(args.cause,['missionId','eventId'])||args.cause.missionId!==TRAIN_ID||typeof args.cause.eventId!=='string'||s.campaign?.activeMissionId!==TRAIN_ID||!Number.isFinite(s.elapsed))return null;
      const r=record(s),powder=r?.train?.powder,charge=resolveFixedRef(s,args.chargeRef,'sealed-charge');
      if(!powder||charge.sealed!==false||!charge.powder||charge.powder.spent)return null;
      const event=powder.physicalEvents.find(e=>e.id===args.cause.eventId);
      if(!event||event.kind!=='charge-blast'||event.at!==s.elapsed||!same(event.data.chargeRef,args.chargeRef)||event.data.trigger!==args.trigger||event.data.custodyEventId!==null)return null;
      if(!world||world.regionId!==TRAIN_WORLD.id)return null;
      const origin=chargePoint(s,charge,world);if(!keys(origin,['x','y','z','regionId'])||!point(origin)||origin.regionId!==world.regionId)return null;
      const primerRef=charge.powder.primerId?fixed(charge.powder.primerId):null,fuseRef=charge.powder.fuseRef?copy(charge.powder.fuseRef):null;
      if(primerRef)resolveFixedRef(s,primerRef,'game-primer');
      if(fuseRef)resolveFixedRef(s,fuseRef,'game-fuse');
      if(args.trigger==='fuse'){
        const fuse=powder.fuses.find(f=>same(f.chargeRef,args.chargeRef)&&same(f.fuseRef,fuseRef));
        const authored=TRAIN_KIT_DEFINITIONS.find(item=>item.id===fuseRef?.objectId&&item.kind==='game-fuse');
        if(!primerRef||!fuseRef||!fuse||!authored||typeof fuse.litEventId!=='string'||fuse.blastEventId!==null||!Number.isFinite(fuse.litAt)||!Number.isFinite(fuse.dueAt)||Math.abs(fuse.dueAt-fuse.litAt-authored.fuseSeconds)>EPS||s.elapsed+EPS<fuse.dueAt)return null;
      }else if(typeof validateProjectileHit!=='function'||validateProjectileHit(s,event.data.projectileReceipt,args.chargeRef,world)!==true)return null;
      return{schema:1,chargeRef:copy(args.chargeRef),primerRef,fuseRef,location:copy(charge.location),origin:copy(origin),at:s.elapsed,trigger:args.trigger,cause:copy(args.cause),custodyEventId:null};
    }catch{return null;}
  }
  function blastGeometry(s,args){try{return geometryReceipt(s,args,worldFor(s));}catch{return null;}}
  function prepareBlastEffects(s,receipt){
    const fields=['schema','chargeRef','primerRef','fuseRef','location','origin','at','trigger','cause','custodyEventId'];
    if(!keys(receipt,fields)||receipt.schema!==1||typeof receipt.custodyEventId!=='string'||!receipt.custodyEventId)throw new TypeError('A prospective canonical blast event is required');
    const world=worldFor(s),fresh=geometryReceipt(s,{chargeRef:receipt.chargeRef,trigger:receipt.trigger,cause:receipt.cause},world);
    if(!fresh||!same({...receipt,custodyEventId:null},fresh))throw new TypeError('Blast contacts, cause or custody changed');
    const r=record(s),state=r.train.blasts;
    if(!keys(state,['schema','events'])||state.schema!==1||!Array.isArray(state.events)||state.events.some(e=>e.custodyEventId===receipt.custodyEventId||same(e.chargeRef,receipt.chargeRef)))throw new TypeError('Invalid or repeated physical blast state');
    const origin=fresh.origin,damages=[],consistAtPrepare=r.train.consist;
    if(!world||world.regionId!==origin.regionId)throw new TypeError('Blast world is unavailable');
    const sceneStamp=()=>JSON.stringify(Object.values(s.entities).map(a=>({id:a.id,hp:a.hp,dead:a.dead,x:a.x,y:a.y,z:a.z,regionId:a.regionId,attachment:a.attachment,support:a.support,mounted:a.mounted,crouch:a.crouch,hidden:a.hidden,departed:a.departed,escaped:a.escaped,invulnerable:a.invulnerable,r:a.r,height:a.height})));
    const preparedSceneStamp=sceneStamp();
    for(const actor of Object.values(s.entities)){
      if(!actor||!Number.isFinite(actor.hp)||actor.hp<=0||actor.hidden||actor.departed||actor.escaped||entityRegion(s,actor)!==origin.regionId)continue;
      const root=actorPoint(actor,world);if(!point(root))throw new TypeError('Actual blast actor contact is unavailable');
      const samples=bodySamples(actor,root);if(!samples)throw new TypeError('Invalid blast body volume');
      const horizontal=Math.max(0,Math.hypot(origin.x-root.x,origin.y-root.y)-samples.radius),vertical=Math.max(samples.base-origin.z,origin.z-samples.base-samples.height,0),distance=Math.hypot(horizontal,vertical);
      if(distance>=TRAIN_BLAST_RULES.radius)continue;
      const exposed=samples.points.find(target=>raycast(world,origin,target,{fraction:1,mode:'projectile'})===null);
      if(!exposed||actor.invulnerable>0)continue;
      const damage=Math.max(TRAIN_BLAST_RULES.minDamage,Math.ceil(TRAIN_BLAST_RULES.maxDamage*(1-distance/TRAIN_BLAST_RULES.radius)));
      damages.push({actor,actorId:actor.id,beforeHp:actor.hp,afterHp:Math.max(0,actor.hp-damage),hadDead:Object.hasOwn(actor,'dead'),beforeDead:actor.dead,exposed:copy(exposed)});
    }
    const door=doorPoint(s,world,origin);let doorHit=false;
    if(keys(door,['present','point'])&&door.present===true&&point(door.point)){
      const doorRay=raycast(world,origin,door.point,{fraction:1,mode:'projectile'});
      doorHit=Math.hypot(door.point.x-origin.x,door.point.y-origin.y,door.point.z-origin.z)<=TRAIN_BLAST_RULES.doorHitRadius&&doorRay?.volumeId==='private-iron-door'&&doorRay.carId==='morrow-custody-coach';
    }else if(!keys(door,['present'])||door.present!==false)throw new TypeError('Actual blast door presence/contact is unavailable');
    const event={custodyEventId:receipt.custodyEventId,chargeRef:copy(receipt.chargeRef),origin:copy(origin),at:s.elapsed,trigger:receipt.trigger,doorHit,
      damages:damages.map(({actorId,beforeHp,afterHp,exposed})=>({actorId,beforeHp,afterHp,exposed}))};
    const oldLength=state.events.length;let applied=false;
    function rollback(){if(!applied)return;for(const d of damages){d.actor.hp=d.beforeHp;if(d.hadDead)d.actor.dead=d.beforeDead;else delete d.actor.dead;}state.events.length=oldLength;applied=false;}
    function apply(){
      if(applied||s.campaign.activeMissionId!==TRAIN_ID||s.elapsed!==receipt.at||r.train.consist!==consistAtPrepare||sceneStamp()!==preparedSceneStamp||r.train.blasts!==state||state.events.length!==oldLength||damages.some(d=>s.entities[d.actorId]!==d.actor||d.actor.hp!==d.beforeHp||Object.hasOwn(d.actor,'dead')!==d.hadDead||d.actor.dead!==d.beforeDead))throw new Error('Prepared blast effects are stale');
      applied=true;
      try{for(const d of damages){d.actor.hp=d.afterHp;if(d.afterHp===0)d.actor.dead=true;}state.events.push(copy(event));}catch(error){rollback();throw error;}
    }
    return{apply,rollback};
  }
  return{blastGeometry,prepareBlastEffects};
}
