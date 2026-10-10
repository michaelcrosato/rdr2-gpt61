/** Detached native idle -> grip -> idle hand motion. Progress is supplied by
 * an owning controller; this primitive grants no elapsed work, world clearance
 * or material custody. Decreasing the same progress reverses the same motion.
 */
import {createTrainHuman,prepareTrainPose,rigWorldPoint,worldToRig} from './rigs.js';
import {applyNativeGroundLocomotion,validateNativeGroundLocomotion} from './locomotion-state.js';
import {savePose} from '../western-animation.js';
import {createHeldBox} from '../train-held-volume.js';
import {makeFrame} from '../rail-foundation/rigid-frame.js';

const axes=['x','y','z'],object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const finitePoint=p=>exact(p,axes)&&axes.every(k=>Number.isFinite(p[k]));
const P=(x=0,y=0,z=0)=>({x,y,z}),root=a=>P(a.x,a.y,a.z??0),array=p=>[p.x,p.y,p.z];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const n=length(a);if(!Number.isFinite(n)||n<=1e-12)throw new TypeError('Nondegenerate native direction required');return mul(a,1/n);};
function idleBody(a,side){return object(a)&&typeof a.id==='string'&&a.id.length>0&&finitePoint(root(a))&&Number.isFinite(a.facing)&&Number.isFinite(a.hp)&&a.hp>0&&!a.dead&&!a.hidden&&!a.departed&&!a.bound&&!a.restrained&&!a.surrendered&&!a.mounted&&!a.attachment&&!a.support&&!a.carrying&&!a.toolHeld&&!a.weaponAction&&Number.isFinite(a.reloadTimer??0)&&(a.reloadTimer??0)===0&&a.holstered!==false&&(a.vx??0)===0&&(a.vy??0)===0&&[undefined,null,'stand','crouch'].includes(a.pose)&&!(a.handInjury&&a.injured!==false&&!a.handInjury.recovered&&a.handInjury.side===(side==='R'?'right':'left'));}
function settled(m,body){const c=m.poseWeights?.crouch??0;return m.speedWeight===0&&m.squash===0&&m.squashVelocity===0&&m.facing===body.facing&&(c===0||c===1)&&c===(body.crouch||body.pose==='crouch'?1:0)&&(m.poseWeights===null||Object.entries(m.poseWeights).every(([k,v])=>k==='crouch'?v===c:v===0));}
function projected(v,n){const q=sub(v,mul(n,dot(v,n)));if(length(q)<=1e-4+128*Number.EPSILON*(1+length(v)))throw new TypeError('Native fallback pole cannot define a reach');return unit(q);}
// Minimal rotation transports the actual idle bend along the moving hand
// direction. Rolling that transported bend into the final authored bend keeps
// the pole perpendicular and finite, instead of snapping to a new elbow plane.
function transport(v,a,b){const k=cross(a,b),den=1+dot(a,b);if(den<=1e-8)throw new TypeError('Antipodal native hand path required another route');return projected(add(add(v,cross(k,v)),mul(cross(k,cross(k,v)),1/den)),b);}
function armBox(id,a,b,r){const d=P(...axes.map(k=>b[k]-a[k])),n=Math.hypot(d.x,d.y,d.z);return createHeldBox({id,frame:makeFrame(P(...axes.map(k=>(a[k]+b[k])/2)),d,Math.abs(d.z/n)>.95?P(0,1,0):P(0,0,1)),halfExtents:P(n/2+r,r,r)});}

/** `motion` is one exact ordinary native locomotion capture. `root` and
 * `clock` in the result bind its detached pose to the supplied body and record;
 * the caller must establish the actual accepted-frame ownership separately.
 * This returns instantaneous geometry, not a continuous collision certificate.
 */
export function buildNativeHandReach(E,body,args){
 let restore=null;
 try{
  if(!E?.Humanoid||typeof E.ik3!=='function'||!exact(args,['motion','target','elbowHint','progress',...(Object.hasOwn(args??{},'side')?['side']:[])]))return null;
  const {motion,target,elbowHint,progress,side='R'}=args;
  if(!['R','L'].includes(side)||!idleBody(body,side)||!finitePoint(target)||!Number.isFinite(progress)||progress<0||progress>1||!Array.isArray(elbowHint)||elbowHint.length!==3||!elbowHint.every(Number.isFinite)||!Number.isFinite(length(elbowHint)))return null;
  const human=createTrainHuman(E,structuredClone(body)),rig=human.rig;
  if(!validateNativeGroundLocomotion(motion,rig)||!settled(motion,body))return null;
  applyNativeGroundLocomotion(rig,motion);
  const sourceJ=rig.J,restorePose=savePose(rig),sourceCheat=rig.o.cheat;let pose=null,restored=false;
  restore=()=>{if(restored)return;restored=true;pose?.restore();restorePose();rig.J=sourceJ;rig.o.cheat=sourceCheat;};
  const origin=root(body),idleHand=rigWorldPoint(rig,origin,'hand'+side),shoulder=rig.J['sh'+side],idleLocal=rig.J['hand'+side],targetLocal=worldToRig(rig,origin,target),a=sub(idleLocal,shoulder),b=sub(targetLocal,shoulder),segment=sub(b,a),den=dot(segment,segment),closest=den?Math.max(0,Math.min(1,-dot(a,segment)/den)):0,minDistance=length(add(a,mul(segment,closest))),maxDistance=Math.max(length(a),length(b)),upper=rig.o.armUpper,lower=rig.o.armLower;
  const numerical=128*Number.EPSILON*Math.max(1,upper,lower,...Object.values(origin).map(Math.abs),...Object.values(target).map(Math.abs));
  if(minDistance<=Math.max(.01,Math.abs(upper-lower))+numerical||maxDistance>=upper+lower-.01-numerical){restore();return null;}
  const n0=unit(a),n1=unit(b),idleBend=projected(sub(rig.J['elbow'+side],shoulder),n0),finalBend=projected(elbowHint,n1),endTransport=transport(idleBend,n0,n1),roll=Math.atan2(dot(n1,cross(endTransport,finalBend)),dot(endTransport,finalBend)),weight=progress*progress*(3-2*progress);
  const requestedHand=progress===0?{...idleHand}:progress===1?{...target}:P(...axes.map(k=>idleHand[k]+(target[k]-idleHand[k])*weight));
  let hint=null,contacts=[];
  if(progress>0){const handLocal=worldToRig(rig,origin,requestedHand),n=unit(sub(handLocal,shoulder)),carried=transport(idleBend,n0,n),bend=unit(add(mul(carried,Math.cos(roll*weight)),mul(cross(n,carried),Math.sin(roll*weight))));hint=progress===1?[...elbowHint]:bend;projected(hint,n);contacts=[{side,kind:progress===1?'native-hand-grip':'native-hand-reach',target:requestedHand,elbowHint:hint}];}
  pose=prepareTrainPose(E,human,body,null,{contacts,freeHands:true});
  if(pose.diagnostics.some(d=>!d.reachable||d.blocked||d.error>1e-5)){restore();return null;}
  const joints=['sh','elbow','hand'].map(k=>rigWorldPoint(rig,pose.root,k+side)),nativeRadius=Math.max(2,rig.o.limbW)*rig.o.size;
  if(!joints.every(finitePoint)||Math.hypot(...axes.map(k=>joints[2][k]-requestedHand[k]))>1e-8){restore();return null;}
  const parts=Object.freeze([armBox('hand-reach-upper-'+side,joints[0],joints[1],nativeRadius),armBox('hand-reach-lower-'+side,joints[1],joints[2],nativeRadius)]);
  return{human,root:pose.root,clock:motion.clock,actorId:body.id,side,progress,weight,idleHand,target:{...target},requestedHand,hand:joints[2],joints,contacts:structuredClone(contacts),diagnostics:structuredClone(pose.diagnostics),gripContact:progress===1,nativeRadius,parts,handSpeedPerProgressBound:1.5*Math.hypot(...axes.map(k=>target[k]-idleHand[k])),intervalCertified:false,restore};
 }catch{restore?.();return null;}
}
