/** Accepted native ground motion. A record owns only an ordinary Human's
 * joint history; body movement, elapsed time and material work remain with
 * their existing authorities. Missing legacy records are never synthesized
 * by a getter. Suspended domains require a new actual native capture.
 */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {createTrainHuman} from './train-native/rigs.js';
import {captureNativeGroundLocomotion,applyNativeGroundLocomotion,validateNativeGroundLocomotion} from './train-native/locomotion-state.js';
import {isOrdinaryNativeGroundBody,predictNativeGroundStep} from './train-native/ground-motion-step.js';

const copy=structuredClone,finite=Number.isFinite;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,fields)=>object(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const preparation=s=>s.campaign?.missions?.[TRAIN_ID]?.train?.preparation;
const state=s=>preparation(s)?.groundMotion;
const binding=a=>({x:a.x,y:a.y,z:a.z,vx:a.vx,vy:a.vy,facing:a.facing,crouch:a.crouch===true,pose:a.pose||null});
const validBinding=b=>keys(b,['x','y','z','vx','vy','facing','crouch','pose'])&&['x','y','z','vx','vy','facing'].every(k=>finite(b[k]))&&typeof b.crouch==='boolean'&&[null,'stand','crouch'].includes(b.pose);
const sameRoot=(a,b)=>['x','y','z'].every(k=>a[k]===b[k]);
const previews=new WeakMap();
const ACTOR_IDS=Object.freeze(['mara','ruth']);
const previewKey=(row,body,at)=>JSON.stringify([row.at,row.motion,binding(body),at]);
function supportedSuspension(body,id){
 if(!object(body)||body.id!==id||!['x','y','z','facing','vx','vy','hp'].every(k=>finite(body[k]))||body.hp<0||body.category!==undefined&&!['player','npc','enemy'].includes(body.category)||body.kind!=null&&!['human','person'].includes(body.kind))return false;
 if(body.crouch!==undefined&&typeof body.crouch!=='boolean'||body.onGround!==undefined&&typeof body.onGround!=='boolean'||body.grounded!==undefined&&typeof body.grounded!=='boolean'||body.vz!==undefined&&!finite(body.vz)||body.reloadTimer!==undefined&&(!finite(body.reloadTimer)||body.reloadTimer<0))return false;
 const poses=[null,undefined,'stand','crouch','down','kneel','guard','die','wave','cheer','cast','hips','block'];
 if(!poses.includes(body.pose)||![undefined,null,'stand','guard','ready'].includes(body.stance))return false;
 const flags=['dead','hidden','departed','bound','restrained','surrendered','mounted','air','airborne','jumping','aiming','dash','dashing','hurt','climb','climbing','point','down','run'];
 if(flags.some(k=>body[k]!=null&&typeof body[k]!=='boolean'&&(!['down','run'].includes(k)||!finite(body[k])||body[k]<0)))return false;
 if(body.aim!==undefined&&!finite(body.aim)||['carrying','toolHeld'].some(k=>body[k]!=null&&body[k]!==false&&(typeof body[k]!=='string'||!body[k])))return false;
 for(const key of['attachment','support','weaponAction','attack'])if(body[key]!=null&&body[key]!==false&&body[key]!==0&&(!object(body[key])||!Object.keys(body[key]).length))return false;
 return body.hp===0||flags.some(k=>body[k]===true||finite(body[k])&&body[k]>0)||!!body.attachment||!!body.support||!!body.carrying||!!body.toolHeld||!!body.weaponAction||!!body.attack||(body.reloadTimer||0)>0||(body.vz||0)!==0||body.onGround===false||body.grounded===false||(body.aim||0)!==0||!['stand','crouch',null,undefined].includes(body.pose)||['guard','ready'].includes(body.stance);
}

function valid(s,value,E,now,{current=true}={}){
 try{
  const p=preparation(s);
  if(!p||!keys(value,['schema','startedAt','at','actorIds','actors'])||value.schema!==1||!finite(now)||!finite(value.startedAt)||value.startedAt<p.startedAt||value.startedAt>value.at||!finite(value.at)||value.at>now||current&&value.at!==now||!object(value.actors)||!same(value.actorIds,ACTOR_IDS)||!same(ACTOR_IDS,Object.keys(value.actors).sort()))return false;
  return Object.entries(value.actors).every(([id,row])=>{
   const body=s.entities?.[id];
   if(!body||body.id!==id||!keys(row,['at','body','motion','suspendedAt','suspendedBody'])||!finite(row.at)||row.at<value.startedAt||row.at>value.at||!validBinding(row.body)||!validateNativeGroundLocomotion(row.motion)||row.motion.facing!==row.body.facing)return false;
   if(row.suspendedAt!==null&&(!finite(row.suspendedAt)||row.suspendedAt<=row.at||row.suspendedAt>value.at)||row.suspendedAt===null&&row.at!==value.at)return false;
   if(row.suspendedAt===null?row.suspendedBody!==null:!supportedSuspension(row.suspendedBody,id))return false;
   if(!validateNativeGroundLocomotion(row.motion,createTrainHuman(E,body).rig))return false;
   // Desired inputs may change without a world step. They do not snap the
   // saved native blends. An active same-clock root cannot silently move.
   return !current||row.suspendedAt!==null||!isOrdinaryNativeGroundBody(body)||sameRoot(row.body,body);
  });
 }catch{return false;}
}

export function validatePreparationGroundMotion(s,value,at=s.elapsed){return valid(s,value,globalThis.My3D2dge,at);}

function capturedRow(s,E,{body,human}){
 if(s.entities?.[body?.id]!==body||!isOrdinaryNativeGroundBody(body)||!human?.rig||!sameRoot(human.rig,body)||human.rig.facing!==body.facing)throw new TypeError('Actual matching ordinary native body capture required');
 const motion=captureNativeGroundLocomotion(human.rig);
 if(!validateNativeGroundLocomotion(motion,createTrainHuman(E,body).rig))throw new TypeError('Actual actor profile required');
 return{at:s.elapsed,body:binding(body),motion:copy(motion),suspendedAt:null,suspendedBody:null};
}

/** Called explicitly by an owning action, never by rendering or Save reads.
 * All captures validate before the optional campaign field is attached. */
export function beginPreparationGroundMotion(s,E,sources){
 const p=preparation(s);
 if(!p||Object.hasOwn(p,'groundMotion')||!Array.isArray(sources)||!sources.length||new Set(sources.map(v=>v.body?.id)).size!==sources.length)throw new TypeError('A new preparation motion owner and distinct actual captures are required');
 const actors=Object.fromEntries(sources.map(source=>[source.body?.id,capturedRow(s,E,source)]));
 const value={schema:1,startedAt:s.elapsed,at:s.elapsed,actorIds:Object.keys(actors).sort(),actors};
 if(!valid(s,value,E,s.elapsed))throw new TypeError('Finite bound native captures required');
 p.groundMotion=value;return value;
}

/** An excluded actor keeps its last actual history. Returning from riding,
 * carrying, manipulation or falling needs the domain owner's actual rig. */
export function resumePreparationGroundMotion(s,E,source){
 const value=state(s),row=value?.actors?.[source.body?.id];
 if(!value||!row||row.suspendedAt===null||!valid(s,value,E,s.elapsed))throw new TypeError('A current suspended native actor is required');
 const next=capturedRow(s,E,source);value.actors[source.body.id]=next;return next;
}

/** Preview derives from the immutable predecessor, including repeated calls
 * after controllers change prospective inputs in the same accepted frame. */
export function preparationGroundMotionHuman(s,id,E=globalThis.My3D2dge){
 const value=state(s),row=value?.actors?.[id],body=s.entities?.[id];
 if(!row||row.suspendedAt!==null||!isOrdinaryNativeGroundBody(body)||!valid(s,value,E,s.elapsed,{current:false}))return null;
 const span=s.elapsed-row.at,tolerance=64*Number.EPSILON*Math.max(1,Math.abs(s.elapsed));
 if(span<0||span>.1+tolerance||span===0&&!sameRoot(row.body,body))return null;
 const key=previewKey(row,body,s.elapsed);let cache=previews.get(s);if(!cache){cache=new Map();previews.set(s,cache);}const prior=cache.get(id);
 if(prior?.key===key&&prior.body===body&&sameRoot(prior.human.rig,body)){try{if(same(captureNativeGroundLocomotion(prior.human.rig),prior.motion))return prior;}catch{}}
 try{
  let human,motion;
  if(span>0){const next=predictNativeGroundStep(E,body,row.motion,Math.min(.1,span));human=next.human;motion=next.toRecord;}
  else{
   human=createTrainHuman(E,body);motion=copy(row.motion);motion.facing=body.facing;
   applyNativeGroundLocomotion(human.rig,motion);Object.assign(human.rig,{x:body.x,y:body.y,z:body.z});motion=captureNativeGroundLocomotion(human.rig);
  }
  const result=Object.freeze({key,human,motion,body,at:s.elapsed});cache.set(id,result);return result;
 }catch{return null;}
}

/** Commit once after all body controllers, before material work consumes its
 * finish pose. Invalid predictions leave every actor's stored record intact. */
export function advancePreparationGroundMotion(s,E=globalThis.My3D2dge){
 const value=state(s);if(!value)return false;
 if(!valid(s,value,E,s.elapsed,{current:false})||s.elapsed<=value.at)return false;
 const span=s.elapsed-value.at,tolerance=64*Number.EPSILON*Math.max(1,Math.abs(s.elapsed));if(span>.1+tolerance)return false;
 const actors={},accepted=new Map();
 for(const [id,row]of Object.entries(value.actors)){
  if(row.suspendedAt!==null){actors[id]=copy(row);continue;}
  if(!isOrdinaryNativeGroundBody(s.entities[id])){actors[id]={...copy(row),suspendedAt:s.elapsed,suspendedBody:copy(s.entities[id])};continue;}
  const next=preparationGroundMotionHuman(s,id,E);if(!next)return false;
  actors[id]={at:s.elapsed,body:binding(s.entities[id]),motion:copy(next.motion),suspendedAt:null,suspendedBody:null};
  accepted.set(id,next);
 }
 const next={...value,at:s.elapsed,actors};if(!valid(s,next,E,s.elapsed))return false;
 preparation(s).groundMotion=next;
 // Promote the already predicted native holder. Physics and presentation
 // must not create/update a second Human for this same accepted pose.
 for(const [id,entry]of accepted)previews.get(s).set(id,Object.freeze({...entry,key:previewKey(actors[id],s.entities[id],s.elapsed)}));
 return true;
}
