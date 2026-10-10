/** Lossless native joint-motion state for an ordinary, grounded Human.
 * This component neither advances a world clock nor owns a body or a Save.
 * A future movement owner must bind the record to its actor and accepted time.
 * In particular, velocity alone cannot recover the engine's retained mv/spW.
 */
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,fields)=>object(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const finite=Number.isFinite;
const positive=['size','legUpper','legLower','hipZ','hipHalf','footSpread','torso','shoulderHalf','neck','headR','armUpper','armLower','limbW','torsoW','stride','lift','swing','speedRef'];
const profileFields=[...positive,'lean','hunch','weapon'];
const poseFields=['cheer','cast','guard','kneel','crouch','wave','hips','block'];
const fields=['schema','profile','clock','phase','speedWeight','movement','facing','squash','squashVelocity','poseWeights'];
const excluded=['dashW','hurtW','atkW','airW','pointW','twist','spin','atkLean','armW','lunge','hop','crouchA','climbW','downW','stW','rdW','dieT','_cheat'];
const zero=v=>v===undefined||v===0;
const finiteJoints=rig=>object(rig.J)&&typeof rig._w==='function'&&Object.keys(rig.J).length>0&&Object.values(rig.J).every(p=>Array.isArray(p)&&p.length===3&&p.every(finite)&&rig._w(p).every(finite));

function profile(rig){
 if(!rig?.o||typeof rig._pose!=='function'||typeof rig.update!=='function')throw new TypeError('Actual native Human required');
 const value=Object.fromEntries(profileFields.map(k=>[k,rig.o[k]]));
 if(!validProfile(value))throw new TypeError('Finite positive native locomotion dimensions required');
 return value;
}
function validProfile(v){return exact(v,profileFields)&&positive.every(k=>finite(v[k])&&v[k]>0)&&['lean','hunch'].every(k=>finite(v[k]))&&[null,'sword','gun','staff'].includes(v.weapon);}
function validPoses(v){return v===null||object(v)&&Object.keys(v).every(k=>poseFields.includes(k)&&finite(v[k])&&v[k]>=0&&v[k]<=1&&(k==='crouch'||v[k]===0));}
function ordinary(rig){
 return excluded.every(k=>zero(rig[k]))&&(!rig._from||rig._windK===1)&&validPoses(rig.poseW??null)&&!rig.o.cape;
}
function posedCandidate(rig,value){
 const candidate=Object.assign(Object.create(Object.getPrototypeOf(rig)),rig,{J:{},t:value.clock,phase:value.phase,spW:value.speedWeight,mv:[...value.movement],facing:value.facing,sq:value.squash,sqV:value.squashVelocity});
 if(value.poseWeights===null)delete candidate.poseW;else candidate.poseW={...value.poseWeights};
 rig._pose.call(candidate);return candidate;
}

export function validateNativeGroundLocomotion(value,rig=null){
 try{
  if(!exact(value,fields)||value.schema!==1||!validProfile(value.profile)||!['clock','phase','speedWeight','facing','squash','squashVelocity'].every(k=>finite(value[k]))||value.clock<0||value.speedWeight<0||value.speedWeight>1.25||Math.abs(value.squash)>.3||!Array.isArray(value.movement)||value.movement.length!==2||!value.movement.every(finite)||Math.hypot(...value.movement)>1+64*Number.EPSILON||!validPoses(value.poseWeights))return false;
  if(rig){const actual=profile(rig);if(!profileFields.every(k=>actual[k]===value.profile[k])||!ordinary(rig)||!finiteJoints(posedCandidate(rig,value)))return false;}
  return true;
 }catch{return false;}
}

export function captureNativeGroundLocomotion(rig){
 const dimensions=profile(rig);
 if(!ordinary(rig)||!finiteJoints(rig))throw new TypeError('Ordinary finite grounded locomotion excludes attacks, manipulation, falling and cape physics');
 const value={schema:1,profile:dimensions,clock:rig.t,phase:rig.phase,speedWeight:rig.spW,movement:[...rig.mv],facing:rig.facing,squash:rig.sq,squashVelocity:rig.sqV,poseWeights:rig.poseW?{...rig.poseW}:null};
 if(!validateNativeGroundLocomotion(value))throw new TypeError('Invalid native locomotion state');
 const posed=posedCandidate(rig,value);
 if(Object.keys(posed.J).length!==Object.keys(rig.J).length||!Object.keys(posed.J).every(k=>rig.J[k]?.every((n,i)=>Object.is(n,posed.J[k][i]))))throw new TypeError('A manually fitted native pose needs its own motion owner');
 Object.freeze(value.profile);Object.freeze(value.movement);if(value.poseWeights)Object.freeze(value.poseWeights);return Object.freeze(value);
}

/** Re-pose the same native dimensions without calling update or touching its
 * world root. Validation finishes before any native state is changed. */
export function applyNativeGroundLocomotion(rig,value){
 const snapshot=structuredClone(value);
 if(!validateNativeGroundLocomotion(snapshot,rig))throw new TypeError('Matching ordinary finite native locomotion record required');
 const posed=posedCandidate(rig,snapshot);
 for(const key of ['t','phase','spW','mv','facing','sq','sqV','J'])rig[key]=posed[key];
 if(snapshot.poseWeights===null)delete rig.poseW;else rig.poseW=posed.poseW;
 return rig;
}
