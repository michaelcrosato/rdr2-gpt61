/** One detached, ordinary native Human update from a lossless motion record.
 * The caller owns body movement, elapsed time, collision and record adoption.
 * This component changes none of those facts and does not reconstruct history
 * from velocity. In particular, retained sideways/braking/crouch blends survive.
 */
import {createTrainHuman} from './rigs.js';
import {applyNativeGroundLocomotion,captureNativeGroundLocomotion,validateNativeGroundLocomotion} from './locomotion-state.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const finite=Number.isFinite;
const inactive=v=>v===undefined||v===null||v===false||v===0;
const advanced=['dead','hidden','departed','bound','restrained','surrendered','mounted','attachment','support','carrying','toolHeld','weaponAction','attack','dash','dashing','hurt','air','airborne','jumping','climb','climbing','point','aim','aiming','down','run'];

// Read plain data once. Accessors and custom prototypes cannot hide changes
// between validation and the actual native update, or execute during capture.
function snapshot(value,seen=new Set()){
 if(value===null||typeof value!=='object'){
  if(['function','symbol','bigint'].includes(typeof value))throw new TypeError('Plain native step data required');
  return value;
 }
 if(seen.has(value))throw new TypeError('Acyclic native step data required');
 const proto=Object.getPrototypeOf(value);
 if(proto!==(Array.isArray(value)?Array.prototype:Object.prototype)&&proto!==null)throw new TypeError('Plain native step data required');
 seen.add(value);
 const descriptors=Object.getOwnPropertyDescriptors(value),copy=Array.isArray(value)?[]:{};
 if(Reflect.ownKeys(descriptors).some(k=>descriptors[k].enumerable&&(typeof k!=='string'||('get'in descriptors[k])||('set'in descriptors[k]))))throw new TypeError('Native step accessors are not motion data');
 for(const [key,d]of Object.entries(descriptors)){
  // Canonical bodies expose nonenumerable ammo/traversal adapters. They are
  // not native pose inputs and must neither execute nor enter the snapshot.
  if(!d.enumerable)continue;
  Object.defineProperty(copy,key,{value:snapshot(d.value,seen),enumerable:true,writable:true,configurable:true});
 }
 if(Array.isArray(value)&&(copy.length!==descriptors.length.value||Array.from({length:copy.length},(_,i)=>i).some(i=>!Object.hasOwn(copy,i))))throw new TypeError('Dense native step arrays required');
 seen.delete(value);return copy;
}

function ordinaryBody(body){
 if(!object(body)||typeof body.id!=='string'||!body.id.length||!['x','y','z','facing','vx','vy','hp'].every(k=>finite(body[k]))||body.hp<=0||!finite(Math.hypot(body.vx,body.vy)))return false;
 if(body.category!==undefined&&!['player','npc','enemy'].includes(body.category)||body.kind!==undefined&&body.kind!==null&&!['human','person'].includes(body.kind))return false;
 if(advanced.some(k=>!inactive(body[k]))||body.vz!==undefined&&body.vz!==0||body.onGround!==undefined&&body.onGround!==true||body.grounded!==undefined&&body.grounded!==true||body.onGround!==true&&body.z!==0)return false;
 if(body.crouch!==undefined&&typeof body.crouch!=='boolean'||![undefined,null,'stand','crouch'].includes(body.pose)||![undefined,null,'stand'].includes(body.stance))return false;
 if(body.reloadTimer!==undefined&&body.reloadTimer!==0)return false;
 return true;
}

/** Pure domain predicate for movement owners. This does not create/update a
 * Human, prove actor identity or establish ground/collision authority. */
export function isOrdinaryNativeGroundBody(value){
 try{return ordinaryBody(snapshot(value));}catch{return false;}
}

/** Predict exactly ONE Humanoid.update(dt, prospectiveBody), with the native
 * factory/profile selected by body.id. `human` is a new private Human holder;
 * its world root is the supplied prospective root. `toRecord` is deeply frozen.
 * No record/body is adopted and no world clock, inventory or actor is changed.
 * This is a component prediction, not evidence of accepted physical movement.
 * Throws before returning any result if the domain or native result is invalid.
 */
export function predictNativeGroundStep(E,body,fromRecord,dt){
 if(!E||typeof E.Humanoid!=='function'||!finite(dt)||dt<=0||dt>.1)throw new TypeError('Native Human and finite step in (0,.1] required');
 const prospective=snapshot(body),from=snapshot(fromRecord);
 if(!ordinaryBody(prospective)||!validateNativeGroundLocomotion(from))throw new TypeError('Ordinary free grounded body and native motion record required');
 const endClock=from.clock+dt;
 if(!finite(endClock)||endClock<=from.clock)throw new TypeError('Native step clock must advance at the supplied precision');
 const human=createTrainHuman(E,prospective),rig=human.rig;
 applyNativeGroundLocomotion(rig,from);
 // Match the existing native camp adapter: a named ordinary pose takes
 // precedence, otherwise the desired crouch boolean selects its real blend.
 rig.update(dt,{...prospective,pose:prospective.pose||(prospective.crouch?'crouch':null)});
 const toRecord=captureNativeGroundLocomotion(rig);
 if(toRecord.clock!==endClock||!['x','y','z'].every(k=>rig[k]===prospective[k]))throw new TypeError('Finite exact native step result required');
 return{toRecord,human};
}
