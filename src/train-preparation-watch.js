/** Actual watch relief. Custody owns the current keeper and accepted transfer;
 * this module supplies finite native context and queries that same history. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_WATCH_LOCAL as LOCAL,TRAIN_WATCH_ROTATIONS,TRAIN_WATCH_HOLDING_RANGE} from '../content/campaign/train-watch-data.js';
import {validateRivalContinuation} from './rival-continuation.js';
import {capturePreparationBodyBounds} from './train-preparation-layout.js';
import {preparationNativeBodyParts,preparationPartSolid,preparationNativeBodyContacts} from './train-preparation-body-geometry.js';
import {createTrainCampWorkProvider} from './train-camp-work.js';
import {createHeldBox,compileHeldSolidSet,heldBoxContacts} from './train-held-volume.js';
import {makeFrame} from './rail-foundation/rigid-frame.js';
import {blockedAt,clearLine} from './campaign-navigation.js';
const copy=structuredClone,object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(v,n)=>object(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),point=a=>({x:a.x,y:a.y,z:a.z||0}),finitePoint=p=>keys(p,['x','y','z'])&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const near=(a,b,r)=>Math.abs(a.z-b.z)<8&&Math.hypot(a.x-b.x,a.y-b.y)<=r;
const prep=s=>s.campaign?.missions?.[TRAIN_ID]?.train?.preparation,rival=s=>s.campaign?.missions?.[RIVAL_ID];
function held(s){const l=s.entities?.levi;return l?.hp>0&&l.bound&&l.attachment?.type==='rest'&&l.attachment.targetId===RIVAL_WORLD.camp.holding.id&&l.attachment.regionId==='snowbound';}
function guardAt(s,at){const c=rival(s).rival.continuation;let id=c.baseline?(c.baseline.guardPresent?c.baseline.guardId:null):rival(s).captivity.guardId;for(const e of c.events){if(e.at>at)break;if(e.guardChange)id=e.guardChange.after;}return id;}
export function isPreparationWatchOperation(op){return op?.kind==='guard-handover'&&same(op.refs,[])&&op.to===null&&keys(op.options,['fromActorId','toActorId'])&&(['bastian','inez'].includes(op.options.fromActorId))&&op.options.toActorId===(op.options.fromActorId==='bastian'?'inez':'hob')&&same(op.actorIds,['mara',op.options.fromActorId,op.options.toActorId]);}
function transformed(anchor,p,rotation){const a=rotation*Math.PI/2,c=Math.cos(a),n=Math.sin(a);return{x:anchor.x+p.x*c-p.y*n,y:anchor.y+p.x*n+p.y*c,z:anchor.z+p.z};}
export function preparationWatchFixture(anchor,rotation,fromActorId,toActorId){
  if(!finitePoint(anchor)||!TRAIN_WATCH_ROTATIONS.includes(rotation))return null;
  const roles=[['mara','mara'],[fromActorId,'outgoing'],[toActorId,'incoming']];
  return{rotation,anchor:copy(anchor),station:transformed(anchor,LOCAL.station,rotation),actors:Object.fromEntries(roles.map(([id,role])=>[id,{pose:{...transformed(anchor,LOCAL[role].foot,rotation),facing:LOCAL[role].facing+rotation*Math.PI/2,pose:'stand'},target:transformed(anchor,LOCAL[role].hand,rotation)}]))};
}
function foreignWorld(s,world,ids){const excluded=new Set(ids),volumes=capturePreparationBodyBounds(s).filter(r=>r.regionId==='snowbound'&&!excluded.has(r.id)).flatMap(r=>r.volumes.map((v,i)=>({id:`watch-body:${r.id}:${i}`,x:v.min.x,y:v.min.y,z:v.min.z,w:v.max.x-v.min.x,h:v.max.y-v.min.y,height:v.max.z-v.min.z})));return{...world,obstacles:[...world.obstacles,...volumes]};}
function fits(s,fixture,world){
  if(!fixture||!near(fixture.anchor,RIVAL_WORLD.camp.holding,TRAIN_WATCH_HOLDING_RANGE))return false;
  const w=foreignWorld(s,world,Object.keys(fixture.actors));if(!Object.values(fixture.actors).every(({pose})=>!blockedAt(w,pose.x,pose.y,9)&&clearLine(world,{...pose,z:33},fixture.station,2.5)))return false;
  // A proposal is detached geometry only. It neither places a participant nor
  // earns a step, heard exchange, material event or watch receipt.
  const shadow={...s,entities:{...s.entities}};for(const [id,role]of Object.entries(fixture.actors))shadow.entities[id]={...s.entities[id],...role.pose,vx:0,vy:0,holstered:true,aiming:false};
  const rows=capturePreparationBodyBounds(shadow),participants=Object.keys(fixture.actors),projected=new Map(),native=createTrainCampWorkProvider(globalThis.My3D2dge,()=>world);
  for(const id of participants){const role=fixture.actors[id],hand=native.prepareNativeActor(shadow,id,role.target);if(!hand.reachable||!hand.usable)return false;projected.set(id,preparationNativeBodyParts(rows.find(r=>r.id===id),rows,{contact:{side:'R',target:role.target}}));}
  const solids=world.obstacles.filter(o=>(o.height??35)>0).map((o,i)=>preparationPartSolid(createHeldBox({id:'watch-solid:'+i,frame:makeFrame({x:o.x+o.w/2,y:o.y+o.h/2,z:(o.z||0)+(o.height??35)/2},{x:1,y:0,z:0}),halfExtents:{x:o.w/2,y:o.h/2,z:(o.height??35)/2}}),'world'));
  const set=solids.length?compileHeldSolidSet(solids,{id:'watch-proposed-world'}):null;
  for(const id of participants){const own=projected.get(id);if(set&&own.some(p=>heldBoxContacts(p,set).some(h=>h.interiorOverlap)))return false;for(const body of rows){if(body.id===id||body.regionId!=='snowbound')continue;const other=projected.get(body.id)||preparationNativeBodyParts(body,rows);if(preparationNativeBodyContacts(own,other).length)return false;}}
  return true;
}
export function selectPreparationWatchFixture(s,op,world,{remember=false}={}){
  if(!isPreparationWatchOperation(op)||!held(s)||!world||!prep(s)?.completed.some(e=>e.kind==='holding'&&e.at<=s.elapsed)||guardAt(s,s.elapsed)!==op.options.fromActorId)return null;
  const w=prep(s)?.work,anchor=point(s.entities[op.options.fromActorId]),saved=w?.kind==='watch'?w.watchFixture:null;
  if(saved){if(!keys(saved,['rotation','anchor','at'])||!same(saved.anchor,anchor)||!Number.isFinite(saved.at)||saved.at<w.requestedAt||saved.at>s.elapsed)return null;return preparationWatchFixture(saved.anchor,saved.rotation,op.options.fromActorId,op.options.toActorId);}
  for(const rotation of TRAIN_WATCH_ROTATIONS){const fixture=preparationWatchFixture(anchor,rotation,op.options.fromActorId,op.options.toActorId);if(fits(s,fixture,world)){if(remember&&w?.kind==='watch')w.watchFixture={rotation,anchor:copy(anchor),at:s.elapsed};return fixture;}}
  return null;
}
export function preparationWatchContact(s){const w=prep(s)?.work,f=w?.kind==='watch'&&w.watchFixture;if(!f)return null;return preparationWatchFixture(f.anchor,f.rotation,w.args.fromActorId,w.args.toActorId)?.station||null;}
function operationActors(s,op){const c=rival(s).rival.continuation,event=c.events.find(e=>same(e.operation,op));if(event)return event.workReceipt.actors;return op.actorIds.map(id=>({id,point:point(s.entities[id])}));}
export function validatePreparationWatchWork(s,op,startedAt){
  try{
    const p=prep(s);if(!p||!held(s)||!isPreparationWatchOperation(op)||!Number.isFinite(startedAt)||startedAt<p.startedAt||startedAt>s.elapsed||!p.completed.some(e=>e.kind==='holding'&&e.at<=startedAt)||guardAt(s,startedAt)!==op.options.fromActorId)return false;
    const actors=operationActors(s,op);if(!actors||actors.length!==3||actors.some((a,i)=>a.id!==op.actorIds[i]||!finitePoint(a.point)))return false;
    const anchor=actors[1].point;if(!near(anchor,RIVAL_WORLD.camp.holding,TRAIN_WATCH_HOLDING_RANGE))return false;
    return TRAIN_WATCH_ROTATIONS.some(rotation=>{const f=preparationWatchFixture(anchor,rotation,op.options.fromActorId,op.options.toActorId);return actors.every(a=>near(a.point,f.actors[a.id].pose,a.id==='mara'?3:.1));});
  }catch{return false;}
}
export function preparationWatchPrefix(s,at=s.elapsed){
  try{
    const p=prep(s);if(!p||!held(s)||!Number.isFinite(at)||at<p.startedAt||at>s.elapsed||!validateRivalContinuation(s))return null;
    const events=rival(s).rival.continuation.events.filter(e=>e.kind==='guard-handover'&&e.workReceipt.startedAt>=p.startedAt&&e.at<=at),first=events.find(e=>e.operation.options.fromActorId==='bastian'&&e.operation.options.toActorId==='inez'&&validatePreparationWatchWork(s,e.operation,e.workReceipt.startedAt)),second=events.find(e=>first&&e.seq>first.seq&&e.operation.options.fromActorId==='inez'&&e.operation.options.toActorId==='hob'&&validatePreparationWatchWork(s,e.operation,e.workReceipt.startedAt));
    return first&&second&&guardAt(s,at)==='hob'?{bastianToInezEventId:first.id,inezToHobEventId:second.id,completedAt:second.at,holdingAnchorId:RIVAL_WORLD.camp.holding.id,guardId:'hob'}:null;
  }catch{return null;}
}
