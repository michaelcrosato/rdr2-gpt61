/** A stationary native idle shoulder reaching one fixed world target.
 * This is a detached geometric enclosure, not work/time/collision authority.
 * Only private Humans are re-posed; supplied bodies and motion records remain
 * untouched. The owning caller must still test every resulting arm volume.
 */
import {createTrainHuman,prepareTrainPose,rigWorldPoint} from './rigs.js';
import {applyNativeGroundLocomotion,validateNativeGroundLocomotion} from './locomotion-state.js';
import {createHeldBox} from '../train-held-volume.js';
import {makeFrame} from '../rail-foundation/rigid-frame.js';

const axes=['x','y','z'],object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const finitePoint=p=>exact(p,axes)&&axes.every(k=>Number.isFinite(p[k]));
const P=(x=0,y=0,z=0)=>({x,y,z}),sub=(a,b)=>P(...axes.map(k=>a[k]-b[k]));
const dot=(a,b)=>axes.reduce((n,k)=>n+a[k]*b[k],0),length=p=>Math.hypot(p.x,p.y,p.z);
const equal=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.hasOwn(b,i)&&equal(v,b[i]))||object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
const root=a=>P(a.x,a.y,a.z??0);
const cross=(a,b)=>P(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
function idleBody(a){return object(a)&&typeof a.id==='string'&&a.id.length>0&&finitePoint(root(a))&&Number.isFinite(a.facing)&&Number.isFinite(a.hp)&&a.hp>0&&!a.dead&&!a.hidden&&!a.departed&&!a.bound&&!a.restrained&&!a.surrendered&&!a.mounted&&!a.attachment&&!a.support&&!a.carrying&&!a.toolHeld&&!a.weaponAction&&!(a.reloadTimer>0)&&a.holstered!==false&&Number.isFinite(a.vx??0)&&Number.isFinite(a.vy??0)&&(a.vx??0)===0&&(a.vy??0)===0&&[undefined,null,'stand','crouch'].includes(a.pose);}
function settled(record){const p=record.poseWeights,c=p?.crouch??0;return record.speedWeight===0&&record.squash===0&&record.squashVelocity===0&&(c===0||c===1)&&(p===null||Object.entries(p).every(([k,v])=>k==='crouch'?v===c:v===0));}
function armEnclosures(id,a,b,da,db,r,roundoff){
 const d=sub(b,a),n=length(d),change=da+db;if(!Number.isFinite(n)||n<=change||n<=0)return null;
 const direction=P(...axes.map(k=>d[k]/n)),dn=change===0?0:2*change/(n-change),z=Math.abs(direction.z),seeds=z-dn<=.95&&z+dn>=.95?['Y','Z']:[z>.95?'Y':'Z'],parts=[];
 for(const seed of seeds){const up=seed==='Y'?P(0,1,0):P(0,0,1),hmin=length(cross(up,direction))-dn;if(!Number.isFinite(hmin)||hmin<=0)return null;
  // For normalized u and y=normalize(up cross u), |du|<=dn,
  // |dy|<=2dn/hmin, and |dz|<=|du|+|dy|. Endpoint balls
  // also bound centre translation and any segment-length variation.
  const dy=2*dn/hmin,dz=dn+dy,padding=change===0?0:change+(n/2+r)*dn+r*(dy+dz)+roundoff,center=P(...axes.map(k=>(a[k]+b[k])/2));
  parts.push(createHeldBox({id:id+':'+seed,frame:makeFrame(center,d,up),halfExtents:P(n/2+r+padding,r+padding,r+padding)}));
 }
 return parts;
}

/** `from` and `to` are lossless captureNativeGroundLocomotion records.
 * The native fixed target stays exactly still. We enclose every interior
 * shoulder/elbow pose rather than interpolating two sampled joint arrays.
 */
export function inspectNativeIdleHandInterval(E,body,args){
 try{
  if(!E?.Humanoid||typeof E.ik3!=='function'||!idleBody(body)||!exact(args,['from','to','target','elbowHint',...(Object.hasOwn(args??{},'side')?['side']:[])]))return null;
  const {from,to,target,elbowHint,side='R'}=args;
  if(!['R','L'].includes(side)||!finitePoint(target)||!Array.isArray(elbowHint)||elbowHint.length!==3||!elbowHint.every(Number.isFinite)||!Number.isFinite(Math.hypot(...elbowHint)))return null;
  const human=createTrainHuman(E,structuredClone(body)),rig=human.rig;
  if(!validateNativeGroundLocomotion(from,rig)||!validateNativeGroundLocomotion(to,rig)||!settled(from)||!settled(to)||from.facing!==body.facing||to.facing!==body.facing||!Object.keys(from).every(k=>k==='clock'||equal(from[k],to[k])))return null;
  const crouch=from.poseWeights?.crouch??0;if(crouch!==(body.crouch||body.pose==='crouch'?1:0))return null;
  const span=to.clock-from.clock,clockRoundoff=16*Number.EPSILON*(1+Math.max(Math.abs(from.clock),Math.abs(to.clock)));
  if(!Number.isFinite(span)||span<0||span>.1+Math.min(1e-10,clockRoundoff))return null;
  const clock=from.clock+span/2;if(!Number.isFinite(clock))return null;
  applyNativeGroundLocomotion(rig,{...structuredClone(from),clock});
  const pose=prepareTrainPose(E,human,body,null,{contacts:[{side,kind:'stationary-native-idle-hand',target,elbowHint}],freeHands:true});
  let joints;
  try{const d=pose.diagnostics[0];if(!d?.reachable||d.blocked||d.error>1e-5)return null;joints=['sh','elbow','hand'].map(k=>rigWorldPoint(rig,pose.root,k+side));}finally{pose.restore();}
  if(!joints.every(finitePoint))return null;
  const size=rig.o.size,L1=rig.o.armUpper*size,L2=rig.o.armLower*size,radius=Math.sqrt(3)*Math.max(2,rig.o.limbW)*size;
  // _pose: sway=.3sin(1.15t), breathe=.3sin(2.3t). All other
  // shoulder offsets are constant for these settled records. The small
  // explicit padding encloses clock/product and world-coordinate roundoff.
  const scale=Math.max(1,...axes.flatMap(k=>[Math.abs(root(body)[k]),Math.abs(target[k])]),L1,L2),roundoff=64*Number.EPSILON*scale;
  const shoulderBound=span===0?0:size*Math.hypot(.3*1.15,.3*2.3)*(span/2+clockRoundoff)+roundoff;
  // Inspect the requested target, not a possibly clamped native hand hit.
  // Even a sub-tolerance endpoint clamp invalidates a fixed-hand proof.
  const v=sub(target,joints[0]),d=length(v),lo=d-shoulderBound,hi=d+shoulderBound,reachMaximum=(rig.o.armUpper+rig.o.armLower-.01)*size;
  if(![size,L1,L2,radius,shoulderBound,d,lo,hi].every(Number.isFinite)||lo<=Math.max(.01*size,Math.abs(L1-L2))+roundoff||hi>=reachMaximum-roundoff)return null;
  const n=P(...axes.map(k=>v[k]/d)),angle=body.facing,c=Math.cos(angle),s=Math.sin(angle),pole=P(elbowHint[0]*c-elbowHint[1]*s,elbowHint[0]*s+elbowHint[1]*c,elbowHint[2]),poleLength=length(pole);
  const dn=2*shoulderBound/lo,q=sub(pole,P(...axes.map(k=>n[k]*dot(pole,n)))),dq=2*poleLength*dn,qmin=length(q)-dq;
  // The supplied ik3 changes branch below this exact native pole threshold.
  // A ball touching that branch cannot receive a guessed bend enclosure.
  if(!Number.isFinite(qmin)||qmin<=1e-4+128*Number.EPSILON*(1+poleLength))return null;
  const C=L1*L1-L2*L2,dx=(.5+Math.abs(C)/(2*lo*lo))*shoulderBound,xat=r=>(C+r*r)/(2*r),xmax=Math.max(Math.abs(xat(lo)),Math.abs(xat(hi))),ymin=Math.sqrt(L1*L1-xmax*xmax);
  if(!Number.isFinite(ymin)||ymin<=0)return null;
  const dy=xmax/ymin*dx,db=2*dq/qmin,elbowBound=shoulderBound+dx+xmax*dn+dy+L1*db;
  if(![elbowBound,radius].every(Number.isFinite)||elbowBound<0)return null;
  const nativeRadius=Math.max(2,rig.o.limbW)*size,upper=armEnclosures('idle-upper-'+side,joints[0],joints[1],shoulderBound,elbowBound,nativeRadius,roundoff),lower=armEnclosures('idle-lower-'+side,joints[1],joints[2],elbowBound,0,nativeRadius,roundoff);
  if(!upper||!lower)return null;
  // The oriented native boxes retain radius r; both actual frame-reference
  // branches are enclosed if an interval can cross |direction.z|=.95.
  // sqrt(3)*r is a valid diagnostic capsule radius, not an axis-aligned cube
  // that the caller must use instead of these much tighter branded parts.
  return{joints,shoulderBound,elbowBound,handBound:0,radius,parts:Object.freeze([...upper,...lower])};
 }catch{return null;}
}
