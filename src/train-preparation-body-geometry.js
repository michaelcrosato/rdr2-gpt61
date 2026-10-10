/** Native occupied-body compounds for camp queries. These immutable parts
 * refine empty space inside an envelope; no owning foot size, actor, limb,
 * possession, health or world position is changed by this module. */
import {createTrainHuman,createTrainMount,prepareTrainPose,prepareTrainMountedPose,physicalProjection,rigWorldPoint} from './train-native/rigs.js';
import {boundRivalPose} from './rival-rigs.js';
import {lowerTorso} from './expedition-animation.js';
import {createHeldBox,compileHeldSolidSet,heldBoxContacts} from './train-held-volume.js';
import {makeFrame,worldPoint,localPoint,sub,length} from './rail-foundation/rigid-frame.js';
import {capturePreparationBodyBounds,validatePreparationBodyBounds} from './train-preparation-layout.js';
import {applyNativeGroundLocomotion} from './train-native/locomotion-state.js';

// Supported component version; Layout's live capture default stays separate.
export const PREPARATION_BODY_GEOMETRY_VERSION=4;
const EPS=1e-7,axes=['x','y','z'],P=(x=0,y=0,z=0)=>({x,y,z});
const faces=Object.freeze([[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(Object.freeze));
const mid=(a,b)=>P(...axes.map(k=>(a[k]+b[k])/2));
const finite=p=>p&&axes.every(k=>Number.isFinite(p[k]));
const cache=new Map();
const nativeArrays=new WeakSet(),nativeSets=new WeakMap();
function box(id,center,half,yaw=0){return createHeldBox({id,frame:makeFrame(center,P(Math.cos(yaw),Math.sin(yaw))),halfExtents:half});}
function capsuleBox(id,a,b,r){const delta=sub(b,a),n=length(delta);return n<EPS?box(id,a,P(r,r,r)):createHeldBox({id,frame:makeFrame(mid(a,b),delta,Math.abs(delta.z/n)>.95?P(0,1,0):P(0,0,1)),halfExtents:P(n/2+r,r,r)});}
function around(id,points,r,frame){const local=points.map(p=>localPoint(frame,p)),min=k=>Math.min(...local.map(p=>p[k]))-r,max=k=>Math.max(...local.map(p=>p[k]))+r;return createHeldBox({id,frame:{...frame,origin:worldPoint(frame,P(...axes.map(k=>(min(k)+max(k))/2)))},halfExtents:P(...axes.map(k=>Math.max(1e-6,(max(k)-min(k))/2)))});}
function boundsBox(id,b){if(!finite(b?.min)||!finite(b?.max)||axes.some(k=>b.max[k]<=b.min[k]))throw new TypeError('Invalid conservative body envelope');return box(id,mid(b.min,b.max),P(...axes.map(k=>(b.max[k]-b.min[k])/2)));}
function model(row){const attached=row.binding.type!=='free';return{id:row.id,kind:row.kind,category:row.category,...row.point,hp:row.hp,dead:row.dead,rig:row.pose.rig||undefined,facing:row.pose.facing,vx:attached?0:row.pose.vx,vy:attached?0:row.pose.vy,crouch:row.pose.crouch,pose:row.pose.pose,fear:row.pose.fear??0,bound:row.pose.bound??false,restrained:row.pose.restrained??false,surrendered:row.pose.surrendered??false};}
/** World-space counterparts of Humanoid._drawHD's central torso cap, side
 * plate and coat planes (engine1525–1553). The old v2 isotropic shoulder box is
 * retained below for historical receipts. Two native units of pose margin
 * remain independent of the actual .62/.72 torso thickness and coat vertices.
 * This derives finite pieces; it never changes bones, feet, size or the rig. */
export function preparationNativeTorsoParts(rig,root,{moving=false}={}){
  const o=rig?.o,J=rig?.J;if(!finite(root)||!o||!J||!['size','torsoW','hipHalf'].every(k=>Number.isFinite(o[k])&&o[k]>0)||!Number.isFinite(rig.sq)||!['hipC','hipL','hipR','shC','shL','shR'].every(k=>Array.isArray(J[k])&&J[k].length===3&&J[k].every(Number.isFinite)))throw new TypeError('Actual finite native torso joints/profile required');
  const size=o.size*Math.max(Math.abs(1-rig.sq*.4),Math.abs(1+rig.sq)),margin=2*size,frame=makeFrame(root,P(Math.cos(rig.facing),Math.sin(rig.facing))),dA=(rig.downW||0)*Math.PI/2*.96,c=Math.cos(dA),s=Math.sin(dA),at=(q,df=0,dr=0,dz=0)=>rigWorldPoint(rig,root,[q[0]+df*c-dz*s,q[1]+dr,q[2]+df*s+dz*c]),mix=(a,b)=>P(...axes.map(k=>(a[k]+b[k])/2));
  const shL=at(J.shL,0,-.4),shR=at(J.shR,0,.4),hL=at(J.hipL,0,-.25,.5),hR=at(J.hipR,0,.25,.5),wL=mix(at(J.hipL,0,-.2),shL),wR=mix(at(J.hipR,0,.2),shR);
  const result=[around('torso',[at(J.hipC,0,0,.8),at(J.shC,0,0,-.4)],o.torsoW*.72*size+margin,frame),around('torso-plate',[shL,shR,wR,hR,hL,wL],margin,frame)];
  const outfit=o.outfit,hz=Math.max(J.hipL[2],J.hipR[2])+.9;
  if(['coat','tunic','robe'].includes(outfit)){
    const len=outfit==='robe'?hz-.6:outfit==='coat'?hz*.62:hz*.42,fl=outfit==='robe'?1.55:1.3,dep=o.torsoW*.7,tails=outfit==='coat'?(moving?[-1.2,-3.4]:[-1.2]):[0],lat=[],sag=[];
    for(const tail of tails){lat.push(...[[J.hipC[0],-o.hipHalf*1.25,hz],[J.hipC[0],o.hipHalf*1.25,hz],[J.hipC[0]+tail*.5,o.hipHalf*1.25*fl,hz-len],[J.hipC[0]+tail*.5,-o.hipHalf*1.25*fl,hz-len]].map(q=>at(q)));sag.push(...[[J.hipC[0]+dep,0,hz],[J.hipC[0]+(outfit==='coat'?dep*.3:dep*fl),0,hz-len*(outfit==='coat'?.45:1)],[J.hipC[0]-dep*fl+tail,0,hz-len],[J.hipC[0]-dep,0,hz]].map(q=>at(q)));}
    result.push(around('coat-side',lat,margin,frame),around('coat-depth',sag,margin,frame));
  }
  return Object.freeze(result);
}
/** Analytical locomotion enclosure for Humanoid._pose (engine1367–1444).
 * Domain: every phase/time, sp=min(1,spW) in[0,1], the complete unit disk of
 * blended local mv, declared pose weights in[0,1], and native squash[-.3,.3].
 * Attack/lunge/dash/hurt/climb/air/cape simulation is a different motion owner;
 * unsupported profiles/states refuse instead of receiving a locomotion proof.
 * Attainable IK knees/elbows stay within their first bone length; engine441
 * does not clamp too-short targets, so unproved/custom short targets use the
 * actual x=(L1²-L2²+d²)/(2d), d≥.01 bound instead. Reached endpoints stay
 * between anchor and target. Every existing capsule BOX corner is at most
 * sqrt(3)*radius beyond its segment; joints alone are insufficient.
 * These pieces grant no actor movement, arrival or work/Save acceptance. */
export function preparationNativeLocomotionParts(rig,root,{fullArmReach=false}={}){
  const o=rig?.o,pw=rig?.poseW??{guard:0,kneel:0},mvLimit=1+64*Number.EPSILON;if(!(rig instanceof globalThis.My3D2dge.Humanoid)||!finite(root)||!o||typeof fullArmReach!=='boolean'||!['t','phase','facing'].every(k=>Number.isFinite(rig[k]))||!['size','legUpper','legLower','hipZ','hipHalf','footSpread','torso','shoulderHalf','headR','armUpper','armLower','limbW','torsoW','stride','speedRef'].every(k=>Number.isFinite(o[k])&&o[k]>0)||!['neck','lift','swing'].every(k=>Number.isFinite(o[k])&&o[k]>=0)||!['lean','hunch'].every(k=>Number.isFinite(o[k]))||o.cape||!['coat','tunic','robe','shirt'].includes(o.outfit)||!['guard','kneel'].every(k=>Number.isFinite(pw[k]))||!Object.entries(pw).every(([k,v])=>['cheer','cast','guard','kneel','crouch','wave','hips','block'].includes(k)&&Number.isFinite(v)&&v>=0&&v<=1)||!Number.isFinite(rig.spW)||rig.spW<0||rig.spW>1.25||!Array.isArray(rig.mv)||rig.mv.length!==2||!rig.mv.every(Number.isFinite)||Math.hypot(...rig.mv)>mvLimit||!Number.isFinite(rig.sq)||Math.abs(rig.sq)>.3||!Number.isFinite(rig.downW??0)||(rig.downW??0)<0||(rig.downW??0)>1||['dashW','hurtW','atkW','airW','pointW','climbW','armW','lunge','hop','crouchA','atkLean','twist','spin','_cheat','stW','rdW','dieT'].some(k=>!Number.isFinite(rig[k]??0)||(rig[k]??0)!==0))throw new TypeError('Finite supported native locomotion profile/state required');
  const cr=Math.max(pw.crouch||0,rig.downW>0?.85:0),kn=pw.kneel||0,guard=pw.guard||0,legMin=Math.abs(o.legUpper-o.legLower),armMin=Math.abs(o.armUpper-o.armLower),arm=o.armUpper+o.armLower;
  function jointReach(a,b,minimum){const max=a+b-.01,d=Math.max(.01,Math.min(minimum,max)),delta=a*a-b*b;if(![max,d,delta].every(Number.isFinite)||max<=.01)throw new RangeError('Unresolved native IK dimensions');if(minimum>=.01&&minimum>=Math.abs(a-b)&&max>=Math.abs(a-b))return a;const x=q=>Math.abs((delta+q*q)/(2*q)),bound=Math.max(x(d),x(max),a)+a;if(!Number.isFinite(bound))throw new RangeError('Unresolved short-target native IK');return bound;}
  // bob∈[-.8,.5], breath*.3∈[-.3,.3], hipXY∈±(.4,.3).
  const hipLo=o.hipZ-1.1-kn*o.hipZ*.42-guard*.9-cr*o.hipZ*.32,hipHi=o.hipZ+.8,hipX=.4*mvLimit,hipY=o.hipHalf+.3*mvLimit,legReach=jointReach(o.legUpper,o.legLower,Math.max(0,hipLo-o.lift));
  const footX=Math.max(o.stride*mvLimit,.8,kn*4.2,guard*2.8,cr*1.6,hipX+legMin),footY=Math.max(o.footSpread+o.stride*mvLimit,2.2,2.6,o.footSpread+.7,hipY+legMin);
  const corner=Math.sqrt(3)*Math.max(2,o.limbW),scaleXY=1.12*o.size,scaleZ=1.3*o.size,pad=corner*1.3*o.size;
  // Positive lower Z uses the SMALL squash scale; negative lower Z uses
  // the LARGE one. Multiplying every endpoint by1.3 can narrow tall bodies.
  const lowerZ=v=>Math.min(.7*v,1.3*v)*o.size,upperZ=v=>Math.max(.7*v,1.3*v)*o.size;
  const make=(id,x,y,lo,hi)=>box(id,worldPoint(makeFrame(root,P(Math.cos(rig.facing),Math.sin(rig.facing))),P(0,0,(lo+hi)/2)),P(x,y,(hi-lo)/2),rig.facing);
  const lower={x:Math.max(hipX+legReach,footX+1.9)*scaleXY+pad,y:Math.max(hipY+legReach,footY)*scaleXY+pad,lo:lowerZ(Math.min(0,hipLo-legReach))-pad,hi:upperZ(Math.max(o.lift+.3,hipHi+legReach))+pad};
  // sin²(leanF)+cos²(leanF)+sin²(leanR)≥1; this bounds each
  // normalized horizontal torso component without sampling lean angles.
  const sinF=Math.min(1,Math.abs(Math.sin(o.lean))+.16*mvLimit+cr*.22),shCX=hipX+o.torso*sinF,shCY=.3*mvLimit+o.torso*Math.sin(.1*mvLimit),shY=shCY+o.shoulderHalf;
  const leanMax=Math.abs(o.lean)+.16*mvLimit+cr*.22,dirZ=leanMax<Math.PI/2?Math.cos(leanMax)/Math.sqrt(1+Math.sin(.1*mvLimit)**2):-1,shLo=hipLo+o.torso*dirZ,shHi=hipHi+o.torso;
  const gestures=fullArmReach||['cheer','cast','guard','wave','hips','block'].some(k=>(pw[k]||0)>0),armReach=jointReach(o.armUpper,o.armLower,gestures?0:Math.max(0,arm*.86-1.2)),reach=gestures?Math.max(arm,armReach):Math.max(armReach,armMin,Math.min(arm,o.swing*mvLimit+.9),Math.min(arm,.5+o.swing*mvLimit+Math.abs(o.hunch)*3));
  const head=o.neck+o.headR,headPad=(o.headR+2)*1.3*o.size;
  const upper={x:Math.max((shCX+reach)*scaleXY+pad,(shCX+head)*scaleXY+headPad),y:Math.max((shY+reach)*scaleXY+pad,(shCY+head)*scaleXY+headPad),lo:lowerZ(Math.min(shLo-(gestures?reach:Math.max(armReach,arm*.86,armMin)),shLo-head))-Math.max(pad,headPad),hi:upperZ(Math.max(shHi+(gestures?reach:Math.max(armReach,armMin,1.2)),shHi+head))+Math.max(pad,headPad)};
  // Clothing is a third band: all coat tails[-3.4,-1.2], torso cap
  // radii/plate offsets, and every tunic/robe skirt vertex remain occupied.
  const clothPad=2*1.3*o.size,corePad=(o.torsoW*.72+2)*1.3*o.size,cloth={x:Math.max(Math.max(shCX,hipX)*scaleXY+corePad,(hipX+o.torsoW*.7*1.55+3.4)*scaleXY+clothPad,(shCX+1.1)*scaleXY+clothPad),y:Math.max(shCY*scaleXY+corePad,(shY+.4)*scaleXY+clothPad,o.hipHalf*1.25*1.55*scaleXY+clothPad),lo:Math.min(lowerZ(Math.min(hipLo,shLo))-corePad,lowerZ(Math.min(.6,(hipLo+.9)*.38,hipLo+.5,shLo-.8))-clothPad),hi:Math.max(upperZ(Math.max(hipHi,shHi))+corePad,upperZ(Math.max(hipHi+.9,shHi+.4))+clothPad)};
  const ranges=[lower,upper,cloth];if(ranges.some(r=>!['x','y','lo','hi'].every(k=>Number.isFinite(r[k]))||r.x<=0||r.y<=0||r.hi<=r.lo))throw new RangeError('Unresolved native locomotion enclosure');
  if(rig.downW>0){
    // The engine rotates every joint and each draw offset before translating
    // by dw*(hipZ+torso)/2 in X and dw*1.4 in Z. A full circumscribed radius
    // covers the entire down transition, not just its endpoint rectangle.
    const radius=Math.max(...ranges.map(r=>Math.hypot(r.x,r.y,Math.max(Math.abs(r.lo),Math.abs(r.hi)))))*1.3/.7+2*(o.torsoW+o.hipHalf+o.hipZ+o.torso+o.headR+o.neck+o.stride+o.lift)*scaleZ,shift=(o.hipZ+o.torso)*.5*scaleXY,lift=1.4*scaleZ;
    if(![radius,shift,lift].every(Number.isFinite))throw new RangeError('Unresolved native down gait');return Object.freeze([make('locomotion-down',radius+shift,radius,-radius,radius+lift)]);
  }
  return Object.freeze([make('locomotion-lower',lower.x,lower.y,lower.lo,lower.hi),make('locomotion-upper',upper.x,upper.y,upper.lo,upper.hi),make('locomotion-cloth',cloth.x,cloth.y,cloth.lo,cloth.hi)]);
}
function horseParts(E,row){
  const body=model(row),mount=createTrainMount(E,body);mount.update(0,body);const parts=[],at=q=>P(...mount.world(body,q)),J=mount.J;
  const cap=(id,a,b,r)=>parts.push(capsuleBox(id,at(a),at(b),r));
  const ell=(id,q,rx,wy,rz)=>{const origin=at(q),units=[at([q[0]+1,q[1],q[2]]),at([q[0],q[1]+1,q[2]]),at([q[0],q[1],q[2]+1])],scales=units.map(p=>length(sub(p,origin)));parts.push(createHeldBox({id,frame:makeFrame(origin,sub(units[0],origin)),halfExtents:P(rx*scales[0],wy*scales[1],rz*scales[2])}));};
  // The original owning navigation footprint stays14 (or larger). This core
  // prism is retained in addition to every native torso/head/limb part.
  parts.push(box('root-foot',P(body.x,body.y,body.z+Math.max(90,row.height)/2),P(row.radius,row.radius,Math.max(90,row.height)/2)));
  for(let i=0;i<4;i++){cap(`upper-leg-${i}`,J[`hip${i}`],J[`knee${i}`],2);cap(`lower-leg-${i}`,J[`knee${i}`],J[`foot${i}`],1.5);ell(`hoof-${i}`,J[`foot${i}`],3,2,2);}
  ell('torso',J.body,28,10.64,15);ell('rump',J.rump,14,5.32,13);cap('chest',J.body,J.chest,8.5);cap('neck',J.chest,J.neck,5.5);cap('jaw',J.neck,J.head,5);ell('head',J.head,11,4.18,7);cap('tail',J.rump,J.tail,2.5);ell('nose',[J.head[0]+10,0,J.head[2]-2],3,3,3);
  for(const side of[-1,1])cap(`ear-${side}`,J.head,[J.head[0]-4,side*4,J.head[2]+(body.dead?2:11)],2);
  if(!body.dead){cap('mane',[18,0,35],[27,0,54+mount.fear*9],2.5);cap('tail-hair',[-25,0,37],[-38,0,15],2.5);}
  if(Math.hypot(body.vx,body.vy)>EPS){
    // The full native walking stride and folded-knee reach remain occupied
    // even though a consumer has not retained an animator's private phase.
    for(const x of[-22,18])parts.push(box(`gait-${x}`,worldPoint(makeFrame(row.point,P(Math.cos(body.facing),Math.sin(body.facing))),P(x,0,23)),P(19,14,24),body.facing));
  }
  return parts;
}
function humanParts(E,row,rows,{at=0,contact=null,locomotion=null}={}){
  const body=model(row),human=createTrainHuman(E,body),rig=human.rig,o=rig.o;
  if(!['size','limbW','torsoW','headR','stride','footSpread','armUpper','armLower'].every(k=>Number.isFinite(o[k])&&o[k]>0))throw new TypeError('Invalid native profile');
  if(row.geometryVersion===4&&body.id==='levi'&&(body.bound||body.restrained)&&row.binding.type!=='rest'&&Math.hypot(body.vx,body.vy)>EPS)throw new TypeError('Moving bound prone pose needs its separate native motion owner');
  // Deterministic source pose. Idle breath/sway is enclosed by the same
  // two-native-unit padding used by legacy camp bounds. No camera yaw is used.
  rig.t=0;rig.phase=0;rig.facing=body.facing;rig._cheat=0;rig.o.cheat=0;rig.downW=row.pose.down||row.binding.type==='rest'&&row.binding.targetId==='silas-bed'?1:0;
  rig.poseW={cheer:0,cast:0,guard:body.bound||body.restrained||body.surrendered?1:0,kneel:0,crouch:body.crouch||body.pose==='crouch'?1:0,wave:0,hips:0,block:0};if(Object.hasOwn(rig.poseW,body.pose))rig.poseW[body.pose]=1;rig._pose();
  if(body.id==='levi'&&(body.bound||body.restrained)){if(row.binding.type==='rest')lowerTorso(E,rig,5.5,0);boundRivalPose(E,rig,{prone:row.binding.type!=='rest'});}
  if(locomotion){if(locomotion.facing!==body.facing)throw new TypeError('Native locomotion facing must match the declared body');applyNativeGroundLocomotion(rig,locomotion);}
  const parent=rows.find(r=>r.id===row.binding.targetId),mounted=['mounted','passenger'].includes(row.binding.type);let pose;
  if(mounted&&parent&&(parent.kind==='horse'||parent.category==='mount')){const mare=model(parent),mount=createTrainMount(E,mare);mount.update(0,mare);pose=prepareTrainMountedPose(E,human,{...body,...parent.point},mare,mount,{freeHands:true});}
  else pose=prepareTrainPose(E,human,body,null,{contacts:contact?[{side:contact.side||'R',target:contact.target,kind:contact.kind||'native-body-contact',elbowHint:contact.elbowHint||null}]:[],freeHands:true});
  try{
    const parts=[],atJoint=k=>rigWorldPoint(rig,pose.root,k),frame=makeFrame(pose.root,P(Math.cos(rig.facing),Math.sin(rig.facing))),size=o.size;
    parts.push(box('root-foot',P(row.point.x,row.point.y,row.point.z+row.height/2),P(row.radius,row.radius,row.height/2)));
    for(const side of['L','R'])for(const [a,b]of[['hip','knee'],['knee','foot'],['sh','elbow'],['elbow','hand']])parts.push(capsuleBox(`${a}-${b}-${side}`,atJoint(a+side),atJoint(b+side),Math.max(2,o.limbW)*size));
    // v2 is an exact decoder, including its old isotropic over-padding. New v3
    // separates actual core/plate/coat pieces instead of changing old receipts.
    if(row.geometryVersion===2)parts.push(around('torso',['hipL','hipR','shL','shR'].map(atJoint),(o.torsoW+2)*size,frame));
    else parts.push(...preparationNativeTorsoParts(rig,pose.root,{moving:Math.hypot(body.vx,body.vy)>EPS}));
    parts.push(box('head',atJoint('head'),P(...Array(3).fill((o.headR+2)*size)),rig.facing));
    if(Math.hypot(body.vx,body.vy)>EPS||locomotion){parts.push(box('stride',P(row.point.x,row.point.y,row.point.z+Math.max(row.height,66)/2),P(Math.max(row.radius,(o.stride+4)*size),Math.max(row.radius,(o.footSpread+4)*size),Math.max(row.height,66)/2),body.facing));if(row.geometryVersion===4)parts.push(...preparationNativeLocomotionParts(rig,pose.root,{fullArmReach:!!contact||row.pose.extended}));}
    if(row.pose.extended&&!contact)parts.push(around('unknown-manipulation',['shL','shR'].map(atJoint),(o.armUpper+o.armLower+3)*size,frame));
    return parts;
  }finally{pose.restore();}
}
/** Callers validate the typed historical row graph first. No current actor
 * replaces a historical pose. Unmodelled/dead animals keep conservative stored
 * envelopes rather than becoming empty or silently smaller. Explicit v4 can
 * receive a profile/facing-matched native locomotion record, retaining braking
 * gait even when body velocity is zero. This pure option does not bind that
 * record to an actor/time or upgrade Layout/Save acceptance; its live movement
 * owner must supply those separate authorities before integration. */
export function preparationNativeBodyParts(row,rows,options={}){
  const E=globalThis.My3D2dge;if(!E?.Humanoid||!row||![2,3,4].includes(row.geometryVersion)||!finite(row.point)||!row.pose||!['facing','vx','vy','fear'].every(k=>Number.isFinite(row.pose[k]))||row.pose.fear<0||row.pose.fear>100||!['bound','restrained','surrendered'].every(k=>typeof row.pose[k]==='boolean')||!Number.isFinite(row.radius)||row.radius<(row.kind==='horse'||row.category==='mount'?14:9)||!Number.isFinite(row.height)||row.height<=0||!Array.isArray(rows))throw new TypeError('Typed v2/v3/v4 native body rows are required');
  if(options.contact!=null&&(!finite(options.contact.target)||options.contact.side!==undefined&&!['L','R'].includes(options.contact.side)||options.contact.elbowHint!=null&&(!Array.isArray(options.contact.elbowHint)||options.contact.elbowHint.length!==3||!options.contact.elbowHint.every(Number.isFinite))))throw new TypeError('Finite native contact required');
  let locomotion=null;if(Object.hasOwn(options,'locomotion')){if(row.geometryVersion!==4||row.binding.type!=='free'||row.kind==='horse'||['mount','animal'].includes(row.category)||row.hp<=0||row.dead||options.contact!=null||row.pose.extended||row.pose.bound||row.pose.restrained||row.pose.surrendered||row.pose.down||![null,'stand','crouch'].includes(row.pose.pose))throw new TypeError('Native locomotion records require an ordinary free v4 Human');locomotion=structuredClone(options.locomotion);if(!locomotion)throw new TypeError('Actual native locomotion record required');}
  const parent=rows.find(r=>r.id===row.binding.targetId),key=JSON.stringify([row.geometryVersion,row.id,row.kind,row.category,row.hp,row.dead,row.point,row.radius,row.height,row.pose,row.binding,parent&&[parent.kind,parent.category,parent.hp,parent.point,parent.pose],options.contact||null,row.hp<=0||row.dead||row.category==='animal'||['carried','large-load','passenger'].includes(row.binding.type)?row.volumes:null,...(locomotion?[locomotion]:[])]);
  if(cache.has(key))return cache.get(key);
  const result=physicalProjection(E,()=>{
    if(row.hp<=0||row.dead||row.category==='animal'||['carried','large-load','passenger'].includes(row.binding.type)){if(!Array.isArray(row.volumes)||!row.volumes.length)throw new TypeError('Conservative attached/dead envelope is required');return row.volumes.map((b,i)=>boundsBox(`conservative-${i}`,b));}
    return row.kind==='horse'||row.category==='mount'?horseParts(E,row):humanParts(E,row,rows,{...options,locomotion});
  });
  Object.freeze(result);nativeArrays.add(result);if(cache.size>=1024)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function preparationPartBounds(part){if(!part?.vertices?.length||!part.vertices.every(finite))throw new TypeError('Finite native part required');return{min:P(...axes.map(k=>Math.min(...part.vertices.map(p=>p[k])))),max:P(...axes.map(k=>Math.max(...part.vertices.map(p=>p[k]))))};}
export function preparationPartSolid(part,bodyId){return{id:part.id,ownerId:bodyId,vertices:part.vertices,faces};}
export function preparationNativeBodyContacts(a,b){if(!Array.isArray(a)||!Array.isArray(b)||!b.length)throw new TypeError('Complete compounds required');let set=nativeArrays.has(b)?nativeSets.get(b):null;if(!set){set=compileHeldSolidSet(b.map(p=>preparationPartSolid(p,'foreign-body')),{id:'native-body-pair'});if(nativeArrays.has(b))nativeSets.set(b,set);}return a.flatMap(part=>heldBoxContacts(part,set).filter(hit=>hit.interiorOverlap).map(hit=>({...hit,partId:part.id})));}

/** Whole-compound in-place yaw against a mandatory immutable fixed-solid set.
 * Every limb/part centre follows its orbit about the BODY ROOT. Interpolating
 * each part's two centres linearly would miss the space crossed by the orbit.
 * The world-vertical owning foot prism stays fixed through body yaw.
 * Caller owns the actual dt/turn budget and moving-foreign-body preflight. */
export function sweepPreparationNativeYaw(row,rows,toFacing,fixedSet,{spatialTolerance=1e-5,maxIntervals=8192}={}){
  return sweepOwnedCompound(preparationNativeBodyParts(row,rows).map(box=>({box,fixedAxes:box.id==='root-foot'})),row.point,row.pose.facing,toFacing,fixedSet,{spatialTolerance,maxIntervals});
}
/** Pure current-registry compound query. Owning rows are captured internally;
 * callers cannot freeze arbitrary rotating heads/limbs with a fixed-ID option,
 * pass editable boxes, omit a carried passenger or repair a stale rider root.
 * The controller still owns elapsed/turn budget and the binding commit. */
export function sweepPreparationCompoundYaw(s,rootId,toFacing,fixedSet,options={}){
  if(typeof rootId!=='string'||!rootId||!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['spatialTolerance','maxIntervals'].includes(k)))throw new TypeError('Actual root and bounded compound query options required');
  const rows=capturePreparationBodyBounds(s),root=rows.find(r=>r.id===rootId),actor=s.entities?.[rootId];
  if(!root||root.binding.type!=='free'||root.rootId!==rootId||!(root.kind==='horse'||root.category==='mount')||actor?.mounted||!finite(root.point))throw new TypeError('A free registered mount root is required');
  const entries=[];
  for(const row of rows.filter(r=>r.rootId===rootId)){
    if(row.binding.type==='mounted'&&['x','y','z'].some(k=>Math.abs(row.sourcePoint[k]-row.point[k])>EPS))throw new TypeError('Mounted actor and actual mount must already share their canonical root');
    const conservative=row.hp<=0||row.dead||row.category==='animal'||['carried','large-load','passenger'].includes(row.binding.type);
    for(const native of preparationNativeBodyParts(row,rows)){
      // This is a new owning brand from the SAME exact frame/extents/vertices.
      // Opaque attachment envelopes remain world-aligned as their owner model
      // defines them; native torso/head/bones follow their genuine root orbit.
      const box=createHeldBox({id:row.id+':'+native.id,frame:native.frame,halfExtents:native.halfExtents});
      entries.push({box,fixedAxes:native.id==='root-foot'||conservative});
    }
  }
  return sweepOwnedCompound(entries,root.point,root.pose.facing,toFacing,fixedSet,options,'fixed-solids-compound-root-orbital-yaw');
}
/** Prospective geometry only. A validated historical free Mara/Copper pair is
 * projected to one future canonical mount root, retaining its exact native
 * geometry version. This grants no movement, binding, arrival or Save fact. */
export function sweepPreparationMountedParkingYaw(s,rows,target,toFacing,fixedSet){
  if(!validatePreparationBodyBounds(s,rows)||!finite(target)||target.z!==0)throw new TypeError('Validated historical bodies and finite ground parking required');
  const projected=structuredClone(rows),root=projected.find(r=>r.id==='copper'),rider=projected.find(r=>r.id==='mara');
  if(!root||!rider||root.binding.type!=='free'||rider.binding.type!=='free'||root.regionId!=='snowbound'||rider.regionId!=='snowbound'||root.hp<=0||root.dead||rider.hp<=0||rider.dead||root.kind!=='horse'||rider.category!=='player'||projected.some(r=>r.id!=='copper'&&r.rootId==='copper'))throw new TypeError('One free historical named rider and mount required');
  root.point={...target};root.sourcePoint={...target};root.pose={...root.pose,vx:0,vy:0};
  rider.point={...target};rider.sourcePoint={...target};rider.rootId='copper';rider.binding={type:'mounted',targetId:'copper'};rider.height=Math.max(90,rider.shape.height??0);rider.pose={...rider.pose,facing:root.pose.facing,vx:0,vy:0,crouch:false,pose:rider.pose.pose==='crouch'?'stand':rider.pose.pose};
  const entries=[root,rider].flatMap(row=>preparationNativeBodyParts(row,projected).map(native=>({box:createHeldBox({id:row.id+':'+native.id,frame:native.frame,halfExtents:native.halfExtents}),fixedAxes:native.id==='root-foot'})));
  return sweepOwnedCompound(entries,target,root.pose.facing,toFacing,fixedSet,{},'prospective-historical-mounted-parking-yaw');
}
function sweepOwnedCompound(entries,root,fromFacing,toFacing,fixedSet,{spatialTolerance=1e-5,maxIntervals=8192}={},scope='fixed-solids-root-orbital-yaw'){
  if(!finite(root)||!Number.isFinite(fromFacing)||!Number.isFinite(toFacing)||!Number.isFinite(spatialTolerance)||spatialTolerance<=0||!Number.isInteger(maxIntervals)||maxIntervals<1)throw new TypeError('Finite bounded native yaw required');
  const angle=toFacing-fromFacing;if(Math.abs(angle)>Math.PI+EPS)throw new RangeError('Unwrap a bounded turn before querying native yaw');
  const parts=entries.map(e=>e.box);
  // This call also rejects copied/forged/unbranded solid sets before any clear.
  if(!parts.length)throw new TypeError('A complete native compound is required');heldBoxContacts(parts[0],fixedSet);
  const radii=parts.map((p,i)=>entries[i].fixedAxes?Math.hypot(p.frame.origin.x-root.x,p.frame.origin.y-root.y):Math.max(...p.vertices.map(v=>Math.hypot(v.x-root.x,v.y-root.y))));
  const rotate=(v,a)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a),z:v.z});
  function sample(part,u,i){if(angle===0||entries[i].fixedAxes&&radii[i]===0)return part;const a=angle*u,origin=rotate(sub(part.frame.origin,root),a),fixed=entries[i].fixedAxes;return createHeldBox({id:part.id,frame:{origin:P(root.x+origin.x,root.y+origin.y,root.z+origin.z),x:fixed?part.frame.x:rotate(part.frame.x,a),y:fixed?part.frame.y:rotate(part.frame.y,a),z:fixed?part.frame.z:rotate(part.frame.z,a)},halfExtents:part.halfExtents});}
  let intervals=0;
  function visit(lo,hi,depth){
    if(++intervals>maxIntervals)return{clear:false,status:'unresolved',reason:'subdivision-limit',interval:[lo,hi],intervals};
    const mid=(lo+hi)/2,halfAngle=Math.abs(angle)*(hi-lo)/2;
    let possible=null;
    for(let i=0;i<parts.length;i++){
      const part=sample(parts[i],mid,i),bound=2*radii[i]*Math.sin(halfAngle/2),inflated=bound===0?part:createHeldBox({id:part.id,frame:part.frame,halfExtents:P(...axes.map(k=>part.halfExtents[k]+bound))}),hits=heldBoxContacts(inflated,fixedSet);
      if(hits.length){possible={part,hits,bound};break;}
    }
    if(!possible)return null;
    if(possible.bound<=spatialTolerance||depth>=60||mid===lo||mid===hi){const exact=heldBoxContacts(possible.part,fixedSet);return{clear:false,status:exact.length?'contact':'unresolved',partId:possible.part.id,solidId:(exact[0]||possible.hits[0]).solidId,ownerId:(exact[0]||possible.hits[0]).ownerId,interval:[lo,hi],spatialBound:possible.bound,intervals};}
    return visit(lo,mid,depth+1)||visit(mid,hi,depth+1);
  }
  return visit(0,1,0)||{clear:true,status:'clear',scope,intervals};
}
