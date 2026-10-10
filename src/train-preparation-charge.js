/** Native extraction of the SAME first quarry child. Discrete custody remains
 * in Rival.objects; the accepted Powder work clock derives this finite pose. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_CHARGE_HALF_EXTENTS} from '../content/campaign/train-equipment.js';
import * as Camp from '../content/campaign/train-preparation-camp.js';
import {inspectCustodyRequest,sourceForRevision,validateRivalContinuation,CUSTODY_WORK_SECONDS} from './rival-continuation.js';
import {preparationInspectionEvidence} from './train-powder.js';
import {preparedCampSite,capturePreparationBodyBounds,validatePreparationBodyBounds} from './train-preparation-layout.js';
import {followPreparationActor} from './train-preparation-navigation.js';
import {createTrainCampWorkProvider} from './train-camp-work.js';
import {sweptPreparationBodyBounds} from './train-preparation-work.js';
import {createTrainHuman,physicalProjection,prepareTrainPose,rigWorldPoint} from './train-native/rigs.js';
import {createHeldBox,createHeldBoxMotion,compileHeldBoxSet,sweepHeldBox,heldBoxContacts} from './train-held-volume.js';
import {makeFrame,worldPoint,sub,dot,cross,length} from './rail-foundation/rigid-frame.js';
import {preparationNativeBodyParts} from './train-preparation-body-geometry.js';
import {preparationStableWorldGeometry} from './train-preparation-stable.js';
import {savePose} from './western-animation.js';
import {SNOWBOUND_WORLD} from '../content/campaign/snowbound.js';
import {NORTH_CUTTING_WORLD} from '../content/campaign/north-cutting.js';
import {WILLOW_RUN_WORLD} from '../content/campaign/willow-run.js';
import {TRAIN_BRIEFING_TABLE_SOLID} from '../content/campaign/train-camp.js';

export const PREPARATION_CHARGE_ID='quarry-sealed-charge-1';
export const PREPARATION_CHARGE_APPROACH=Object.freeze({...Camp.TRAIN_TIN_APPROACH,x:743,y:1246,facing:-.5});
export const PREPARATION_CHARGE_HELD_CENTER=Object.freeze({...Camp.TRAIN_FIRST_HELD_CENTER,y:Camp.TRAIN_FIRST_HELD_CENTER.y+1.25});
const copy=structuredClone,EPS=1e-7,axes=['x','y','z'],ref=()=>({sourceMissionId:RIVAL_ID,objectId:PREPARATION_CHARGE_ID}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(v,ns)=>object(v)&&Object.keys(v).length===ns.length&&ns.every(n=>Object.hasOwn(v,n));
const point=a=>({x:a.x,y:a.y,z:a.z??0}),distance=(a,b)=>Math.hypot(...axes.map(k=>a[k]-b[k])),finite=p=>p&&axes.every(k=>Number.isFinite(p[k])),lerp=(a,b,u)=>a+(b-a)*u;
const record=s=>s.campaign?.missions?.[TRAIN_ID]?.train,prep=s=>record(s)?.preparation,active=s=>s?.version===5&&s.campaign?.activeMissionId===TRAIN_ID&&s.region==='snowbound'&&s.campaign.missions[TRAIN_ID]?.mission.stage===2&&record(s)?.preparationVersion===1;
const stamp=a=>JSON.stringify([a.x,a.y,a.z,a.vx,a.vy,a.facing,a.pose,a.crouch,a.hp,a.holstered,a.mounted,a.attachment,a.carrying,a.toolHeld,a.weaponAction,a.handInjury,a.injured,a.reloadTimer,a.reloadWeaponId]);
const frame=(center,angle)=>({origin:center,x:{x:1,y:0,z:0},y:{x:0,y:Math.cos(angle),z:Math.sin(angle)},z:{x:0,y:-Math.sin(angle),z:Math.cos(angle)}});
const palm=p=>({...p,z:p.z+3});

export function preparationChargeOperationMode(op){return object(op)&&keys(op,['kind','actorIds','refs','to','options',...(Object.hasOwn(op,'cause')?['cause']:[])])&&(!Object.hasOwn(op,'cause')||keys(op.cause,['missionId','eventId'])&&op.cause.missionId===TRAIN_ID&&/^powder-event-[1-9]\d*$/.test(op.cause.eventId))&&op.kind==='move-object'&&same(op.actorIds,['ruth'])&&same(op.refs,[ref()])&&keys(op.options,['chargeLiftVersion'])&&op.options.chargeLiftVersion===1&&same(op.to,{owner:'ruth',location:{type:'carried',targetId:'ruth'}})?'take':null;}
function sourceAt(s,reference,at){const events=s.campaign.missions[RIVAL_ID].rival.continuation.events;return sourceForRevision(s,reference,events.filter(e=>e.at<=at).length,at);}
export function validatePreparationChargeWork(s,op,startedAt){
 try{const p=prep(s);if(!p||!preparationChargeOperationMode(op)||!Number.isFinite(startedAt)||startedAt<p.startedAt||startedAt>s.elapsed||!preparedCampSite(s,'quarry-charge-worktop',startedAt)||!p.completed.some(e=>e.kind==='store'&&e.at<=startedAt))return false;
  const child=sourceAt(s,ref(),startedAt),crate=sourceAt(s,{sourceMissionId:RIVAL_ID,objectId:'charge-crate'},startedAt),tin=sourceAt(s,{sourceMissionId:RIVAL_ID,objectId:'cap-tin'},startedAt),rows=preparationInspectionEvidence(s,{since:p.startedAt,at:startedAt}),childIds=[1,2,3,4].map(n=>`quarry-sealed-charge-${n}`),stored={type:'station',targetId:'quarry-charge-store',regionId:'snowbound'};
  if(!child||child.id!==PREPARATION_CHARGE_ID||child.kind!=='sealed-charge'||child.owner!=='ruth'||child.sealed!==true||child.powder?.spent||child.powder?.primerId||child.powder?.fuseRef||!same(child.location,{type:'crate',targetId:'charge-crate'})||crate?.owner!=='ruth'||crate.count!==4||!same(crate.location,stored)||!same(crate.chargeIds,childIds)||tin?.owner!=='ruth'||!same(tin.location,stored)||!Array.isArray(rows)||!childIds.every(id=>rows.some(r=>r.topic==='child-seal'&&same(r.ref,{sourceMissionId:RIVAL_ID,objectId:id}))))return false;
  for(const id of childIds.slice(1)){const other=sourceAt(s,{sourceMissionId:RIVAL_ID,objectId:id},startedAt);if(other?.id!==id||other.kind!=='sealed-charge'||other.owner!=='ruth'||other.sealed!==true||other.powder?.spent||other.powder?.primerId||other.powder?.fuseRef||!same(other.location,{type:'crate',targetId:'charge-crate'}))return false;}
  const event=s.campaign.missions[RIVAL_ID].rival.continuation.events.find(e=>same(e.operation,op)),actor=event?.workReceipt.actors.find(a=>a.id==='ruth')?.point;
  if(!event)return true;const receipt=event.workReceipt;
  return !!actor&&keys(receipt,['startedAt','finishedAt','acceptedSeconds','actors','sources','destinations','cause'])&&receipt.startedAt===startedAt&&receipt.finishedAt===event.at&&Number.isFinite(receipt.acceptedSeconds)&&receipt.acceptedSeconds+EPS>=CUSTODY_WORK_SECONDS['move-object']&&receipt.acceptedSeconds<=receipt.finishedAt-receipt.startedAt+EPS&&same(receipt.cause,op.cause)&&same(receipt.actors,[{id:'ruth',point:actor}])&&distance(actor,PREPARATION_CHARGE_APPROACH)<=.051&&same(receipt.sources,[{ref:ref(),point:copy(PREPARATION_CHARGE_HELD_CENTER)}])&&same(receipt.destinations,[{location:{type:'carried',targetId:'ruth'},point:copy(PREPARATION_CHARGE_HELD_CENTER)}]);
 }catch{return false;}
}

/** Piecewise rigid geometry, including a final real two-hand support interval.
 * The grip's native fingertip is three world units below its palm socket. */
export function preparationChargeLiftGeometry(progress){
 if(!Number.isFinite(progress)||progress<0||progress>1)throw new TypeError('Finite first-child lift phase required');
 const a=Camp.TRAIN_CHILD_CONTACTS[PREPARATION_CHARGE_ID].center,b=PREPARATION_CHARGE_HELD_CENTER;let center={...a},angle=0,gripY=-3;
 if(progress<=.12)center.z=lerp(a.z,39.25,progress/.12);
 else if(progress<=.4){const u=(progress-.12)/.28;center.z=39.25;angle=u*Math.PI/2;gripY=lerp(-3,3,u);}
 else if(progress<=.6){angle=Math.PI/2;gripY=3;center.z=lerp(39.25,43.25,(progress-.4)/.2);}
 else if(progress<=.78){const u=(progress-.6)/.18;angle=Math.PI/2;gripY=3;center={x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u),z:43.25};}
 else{angle=Math.PI/2;gripY=3;center={...b,z:progress<.9?lerp(43.25,b.z,(progress-.78)/.12):b.z};}
 const f=frame(center,angle),rightFinger=worldPoint(f,{x:0,y:gripY,z:6}),held=frame({...b},Math.PI/2),leftFinger=worldPoint(held,{x:-2,y:-3,z:6});
 return{itemRef:ref(),progress,center,frame:f,halfExtents:copy(TRAIN_CHARGE_HALF_EXTENTS),right:palm(rightFinger),left:palm(leftFinger),rightFinger,leftFinger,handoff:progress>=.9};
}
const carriedLeases=new WeakMap();
function carryEvent(s){const item=s.campaign?.missions?.[RIVAL_ID]?.objects?.[PREPARATION_CHARGE_ID];if(item?.owner!=='ruth'||!same(item.location,{type:'carried',targetId:'ruth'})||item.powder?.spent)return null;const events=s.campaign.missions[RIVAL_ID].rival.continuation.events;if(!Array.isArray(events))return null;const l=carriedLeases.get(s);if(l?.item===item&&l.itemStamp===JSON.stringify(item)&&l.events===events&&l.count===events.length&&l.tail===events.at(-1)&&l.eventStamp===JSON.stringify(l.event))return l.event;for(let i=events.length-1;i>=0;i--){const e=events[i];if(e?.kind==='move-object'&&Array.isArray(e.operation?.refs)&&e.operation.refs.some(r=>same(r,ref()))){if(!preparationChargeOperationMode(e.operation)||!e.workReceipt||!validatePreparationChargeWork(s,e.operation,e.workReceipt.startedAt)||!validateRivalContinuation(s))return null;carriedLeases.set(s,{item,itemStamp:JSON.stringify(item),events,count:events.length,tail:events.at(-1),event:e,eventStamp:JSON.stringify(e)});return e;}}return null;}
function bodyRelative(p,body){const root=PREPARATION_CHARGE_APPROACH,angle=(body.facing||0)-root.facing,x=p.x-root.x,y=p.y-root.y;return{x:body.x+x*Math.cos(angle)-y*Math.sin(angle),y:body.y+x*Math.sin(angle)+y*Math.cos(angle),z:(body.z||0)+p.z};}
export function preparationChargeCarryGeometry(a){
 if(a?.id!=='ruth'||!finite(point(a))||!Number.isFinite(a.facing))throw new TypeError('Finite actual Ruth root and yaw required');const end=preparationChargeLiftGeometry(1),angle=a.facing-PREPARATION_CHARGE_APPROACH.facing,c=Math.cos(angle),n=Math.sin(angle),rotate=v=>({x:v.x*c-v.y*n,y:v.x*n+v.y*c,z:v.z}),f={origin:bodyRelative(end.center,a),x:rotate(end.frame.x),y:rotate(end.frame.y),z:rotate(end.frame.z)};
 return{...end,center:f.origin,frame:f,left:bodyRelative(end.left,a),right:bodyRelative(end.right,a),leftFinger:bodyRelative(end.leftFinger,a),rightFinger:bodyRelative(end.rightFinger,a),carried:true};
}
export function preparationCarriedChargeGeometry(s){const a=s.entities?.ruth;return active(s)&&carryEvent(s)&&a?.hp>0&&!a.mounted&&!a.attachment&&!a.dead&&!a.hidden&&!a.departed?preparationChargeCarryGeometry(a):null;}

const armIds=new Set(['sh-elbow-L','elbow-hand-L','sh-elbow-R','elbow-hand-R']),P=(x=0,y=0,z=0)=>({x,y,z}),pole=P(0,0,1);
const free=a=>a?.id==='ruth'&&finite(point(a))&&Number.isFinite(a.facing)&&a.hp>0&&!a.dead&&!a.hidden&&!a.departed&&!a.bound&&!a.restrained&&!a.surrendered&&!a.mounted&&!a.attachment&&!a.support&&!a.carrying&&!a.toolHeld&&!a.weaponAction&&!(a.reloadTimer>0)&&a.holstered===true&&!a.crouch&&[null,undefined,'stand'].includes(a.pose)&&!(a.handInjury&&a.injured!==false&&!a.handInjury.recovered&&['left','right'].includes(a.handInjury.side));
const stationed=a=>free(a)&&distance(point(a),PREPARATION_CHARGE_APPROACH)<=.051&&Math.abs(Math.atan2(Math.sin(a.facing-PREPARATION_CHARGE_APPROACH.facing),Math.cos(a.facing-PREPARATION_CHARGE_APPROACH.facing)))<=EPS&&Math.hypot(a.vx||0,a.vy||0)<=.01;
/** Same original Human, with a deterministic stationary source pose. The
 * borrowed animator is restored completely; this advances no physics clock. */
export function preparePreparationChargePose(E,human,body,g,{right=true}={}){return physicalProjection(E,()=>{
 if(!human?.rig||!free(body)||g&&!finite(g.left)||g&&!finite(g.right))throw new TypeError('Free actual Ruth and finite native lift contacts required');
 const rig=human.rig,restorePose=savePose(rig),fields=['t','phase','spW','dashW','hurtW','atkW','airW','sq','pointW','twist','atkLean','kicking','mv','theta','poseW'].map(key=>({key,had:Object.hasOwn(rig,key),value:copy(rig[key])}));
 rig.t=rig.phase=rig.spW=rig.dashW=rig.hurtW=rig.atkW=rig.airW=rig.sq=rig.pointW=rig.spin=rig.twist=rig.atkLean=0;rig.kicking=false;rig.mv=[1,0];rig.theta=1.2;rig.facing=body.facing;rig._cheat=rig.o.cheat=rig.downW=0;rig.poseW={cheer:0,cast:0,guard:0,kneel:0,crouch:0,wave:0,hips:0,block:0};rig._pose();
 const contacts=g?[...(right?[{side:'R',target:g.right,elbowHint:[0,0,1]}]:[]),{side:'L',target:g.left,elbowHint:[0,0,1]}]:[],pose=prepareTrainPose(E,human,body,null,{contacts,freeHands:true});
 return{...pose,contacts,restore(){pose.restore();restorePose();for(const f of fields){if(f.had)rig[f.key]=f.value;else delete rig[f.key];}}};
});}
function poseAt(body,g,human=createTrainHuman(globalThis.My3D2dge,body)){const pose=preparePreparationChargePose(globalThis.My3D2dge,human,body,g);try{
 if(pose.diagnostics.some(d=>!d.reachable||d.blocked||d.error>1e-5))return null;
 return{entries:['R','L'].map(side=>({side,joints:['sh','elbow','hand'].map(k=>rigWorldPoint(human.rig,pose.root,k+side))})),upper:human.rig.o.armUpper*human.rig.o.size,lower:human.rig.o.armLower*human.rig.o.size,radius:Math.max(2,human.rig.o.limbW)*human.rig.o.size,size:human.rig.o.size};
 }finally{pose.restore();}}
/** Detached kinematics only; never creates custody, work or accepted time. */
export function inspectPreparationChargeContact(body,progress){try{return free(body)?poseAt(body,preparationChargeLiftGeometry(progress)):null;}catch{return null;}}
export function preparationChargeWorldGeometry(s,at=s.elapsed){return preparationStableWorldGeometry(s,at).filter(o=>o.id!==PREPARATION_CHARGE_ID);}
const boxFor=(id,b)=>createHeldBox({id,frame:makeFrame(P(...axes.map(k=>(b.min[k]+b.max[k])/2)),P(1,0,0)),halfExtents:P(...axes.map(k=>(b.max[k]-b.min[k])/2))});
function armBox(id,a,b,r){const d=sub(b,a),n=length(d);return createHeldBox({id,frame:makeFrame(P(...axes.map(k=>(a[k]+b[k])/2)),d,Math.abs(d.z/n)>.95?P(0,1,0):pole),halfExtents:P(n/2+r,r,r)});}
function armEnclosures(part,a,b,da,db,r){const n=length(sub(b,a)),change=da+db;if(!change)return[part];const dn=change/Math.max(EPS,n-EPS),direction=P(...axes.map(k=>(b[k]-a[k])/n)),z=Math.abs(direction.z),seeds=z-dn<=.95&&z+dn>=.95?[P(0,1,0),pole]:[z>.95?P(0,1,0):pole],out=[];for(const up of seeds){const hmin=length(cross(up,direction))-dn;if(hmin<=1e-5)return null;const dy=dn/hmin,dz=dn+dy,padding=change/2+2*EPS+(n/2+r)*dn+r*(dy+dz);out.push(createHeldBox({id:part.id,frame:part.frame,halfExtents:P(...axes.map(k=>part.halfExtents[k]+padding))}));}return out;}
// Bound the supplied native ik3 for every target in this finite ball, including
// the curved rotating grip. A midpoint sample alone cannot certify an elbow.
function elbowBound(p,joints,delta){const v=sub(joints[2],joints[0]),d=length(v),lo=d-delta,hi=d+delta;if(lo<=.02||hi>p.upper+p.lower-.01*p.size+1e-8)return null;const n=P(...axes.map(k=>v[k]/d)),dn=delta/lo,proj=sub(pole,P(...axes.map(k=>n[k]*dot(pole,n)))),hmin=length(proj)-dn;if(hmin<=1e-4+EPS)return null;const c=p.upper*p.upper-p.lower*p.lower,xd=.5+Math.abs(c)/(2*lo*lo),dx=xd*delta,xmax=Math.max(Math.abs((c+lo*lo)/(2*lo)),Math.abs((c+hi*hi)/(2*hi))),ymin=Math.sqrt(Math.max(0,p.upper*p.upper-xmax*xmax));if(ymin<=1e-5)return null;return dx+xmax*dn+xmax/ymin*dx+p.upper*dn/hmin;}
const phases=[0,.12,.4,.6,.78,.9,1];
function rightSpeed(a,b){const mid=(a+b)/2;if(mid<.12)return 7.25/.12;if(mid<.4)return 6/.28+Math.hypot(3,6)*Math.PI/(2*.28);if(mid<.6)return 4/.2;if(mid<.78)return Math.hypot(9,4.75)/.18;if(mid<.9)return 4.25/.12;return 0;}
function geometryRefs(geometry){return geometry.filter(o=>(o.height??35)>0).map(o=>({box:boxFor(o.id,{min:P(o.x,o.y,o.z??0),max:P(o.x+o.w,o.y+o.h,(o.z??0)+(o.height??35))}),ownerId:'world'}));}
function liftWindow(s,{fromProgress,toProgress,bodyBounds,geometry},extra=[]){
 try{if(!Number.isFinite(fromProgress)||!Number.isFinite(toProgress)||fromProgress<0||toProgress>1||toProgress<fromProgress||!validatePreparationBodyBounds(s,bodyBounds)||!same(geometry,preparationChargeWorldGeometry(s)))return null;const row=bodyBounds.find(r=>r.id==='ruth'),body=s.entities?.ruth;if(!free(body)||!row||row.geometryVersion!==3||!same(row.point,point(body))||row.pose.facing!==body.facing)return null;const human=createTrainHuman(globalThis.My3D2dge,body),refs=geometryRefs([...geometry,...extra]);for(const r of bodyBounds)if(r.id!=='ruth'&&r.regionId==='snowbound')refs.push(...preparationNativeBodyParts(r,bodyBounds).map(box=>({box,ownerId:r.id})));const set=compileHeldBoxSet(refs,{id:'first-child-complete-physical-world'}),fixed=preparationNativeBodyParts(row,bodyBounds).filter(part=>!armIds.has(part.id)),own=compileHeldBoxSet(fixed.map(box=>({box,ownerId:'ruth'})),{id:'first-child-own-body'}),clear=(part,target=set)=>part.vertices.every(p=>p.x>=0&&p.y>=0&&p.x<=SNOWBOUND_WORLD.width&&p.y<=SNOWBOUND_WORLD.height)&&!heldBoxContacts(part,target).some(h=>h.interiorOverlap);if(!fixed.every(part=>clear(part)))return null;let intervals=0;
 function visit(a,b,depth){if(++intervals>8192)return false;const mid=(a+b)/2,g=preparationChargeLiftGeometry(mid),p=poseAt(body,g,human);if(!p)return false;const delta=rightSpeed(a,b)*(b-a)/2,all=[];for(const e of p.entries){const d=e.side==='R'?delta:0,bound=elbowBound(p,e.joints,d);if(bound===null){if(depth>=30)return false;return visit(a,mid,depth+1)&&visit(mid,b,depth+1);}const upper=armBox('sh-elbow-'+e.side,e.joints[0],e.joints[1],p.radius),lower=armBox('elbow-hand-'+e.side,e.joints[1],e.joints[2],p.radius),u=armEnclosures(upper,e.joints[0],e.joints[1],0,bound,p.radius),l=armEnclosures(lower,e.joints[1],e.joints[2],bound,d,p.radius);if(!u||!l){if(depth>=30)return false;return visit(a,mid,depth+1)&&visit(mid,b,depth+1);}all.push(...u,...l);}if(!all.every(part=>clear(part))){if(depth>=30||b-a<1e-10)return false;return visit(a,mid,depth+1)&&visit(mid,b,depth+1);}return true;}
 const cuts=[fromProgress,...phases.filter(p=>p>fromProgress&&p<toProgress),toProgress];for(let i=1;i<cuts.length;i++){const a=preparationChargeLiftGeometry(cuts[i-1]),b=preparationChargeLiftGeometry(cuts[i]),motion=createHeldBoxMotion(createHeldBox({id:PREPARATION_CHARGE_ID,frame:a.frame,halfExtents:a.halfExtents}),createHeldBox({id:PREPARATION_CHARGE_ID,frame:b.frame,halfExtents:b.halfExtents}));if(!sweepHeldBox(motion,set,{contactMode:'interior'}).clear||!sweepHeldBox(motion,own,{contactMode:'interior'}).clear||!visit(cuts[i-1],cuts[i],0))return null;}
 return{itemRef:ref(),fromProgress,toProgress,intervals,handoff:toProgress>=.9,limbRadius:Math.max(2,human.rig.o.limbW)*human.rig.o.size};
 }catch{return null;}
}
export function inspectPreparationChargeLiftWindow(s,args){return keys(args,['fromProgress','toProgress','bodyBounds','geometry'])?liftWindow(s,args):null;}
function pending(s){try{const list=record(s)?.powder?.pending;if(!Array.isArray(list))return null;for(const work of list){const op=inspectCustodyRequest(s,work.requestId)?.operation;if(preparationChargeOperationMode(op))return{work,op};}}catch{}return null;}
const poses=new WeakMap();
export function getPreparationChargePose(s,id='ruth'){const e=poses.get(s),a=s.entities?.[id],work=pending(s),carried=carryEvent(s);return e&&id==='ruth'&&free(a)&&e.body===a&&e.at===s.elapsed&&e.liveStamp===stamp(a)&&(work?.work.workId===e.workId&&Math.abs(e.geometry.progress-work.work.acceptedSeconds/CUSTODY_WORK_SECONDS['move-object'])<EPS||carried&&e.geometry.carried)?e:null;}
function foreign(s){const out=[];for(const row of capturePreparationBodyBounds(s,{geometryVersion:3}))if(row.id!=='ruth'&&row.regionId==='snowbound'){const radius=Math.max(...row.volumes.flatMap(v=>[v.min.x,v.max.x].flatMap(x=>[v.min.y,v.max.y].map(y=>Math.hypot(x-row.point.x,y-row.point.y))))),meta={bodyId:row.id,rootPoint:copy(row.point),bodyFacing:row.pose.facing,bodyPose:JSON.stringify([row.pose,row.binding,row.radius,row.height]),bodyRadiusXY:radius,bodyMinZ:Math.min(...row.volumes.map(v=>v.min.z)),bodyMaxZ:Math.max(...row.volumes.map(v=>v.max.z))};for(const[i,v]of row.volumes.entries())out.push({id:row.id+':'+i,...meta,x:v.min.x,y:v.min.y,z:v.min.z,w:v.max.x-v.min.x,h:v.max.y-v.min.y,height:v.max.z-v.min.z});}return out;}
function material(s){const objects=s.campaign.missions[RIVAL_ID].objects,out=[...Camp.TRAIN_CRATE_SOLIDS],add=(id,c,h)=>out.push({id,x:c.x-h.x,y:c.y-h.y,z:c.z-h.z,w:h.x*2,h:h.y*2,height:h.z*2});for(const[id,slot]of Object.entries(Camp.TRAIN_CHILD_CONTACTS))if(id!==PREPARATION_CHARGE_ID&&objects[id].location.type==='crate')add(id,slot.center,TRAIN_CHARGE_HALF_EXTENTS);if(objects['cap-tin'].location.type==='station')add('cap-tin',Camp.TRAIN_TIN_CENTER,Camp.TRAIN_TIN_SHAPE);return out;}

export function createPreparationChargeProvider(E,worldFor){
 if(!E?.Humanoid||typeof worldFor!=='function')throw new TypeError('Actual native Human and camp world provider required');
 const before=new WeakMap(),windows=new WeakMap();
 function physicalWorld(s){const base=worldFor(s),normalize=o=>({id:o.id,x:o.x,y:o.y,z:o.z??0,w:o.w,h:o.h,height:o.height??35}),expected=[...SNOWBOUND_WORLD.obstacles,...NORTH_CUTTING_WORLD.camp.obstacles,...WILLOW_RUN_WORLD.camp.obstacles,...RIVAL_WORLD.camp.obstacles,...(record(s)?.briefing?.setup?.finishedAt!=null?[TRAIN_BRIEFING_TABLE_SOLID]:[]),...Camp.TRAIN_PREPARATION_SOLIDS.filter(o=>prep(s)?.campSetup?.sites?.[o.id]?.introducedAt<=s.elapsed)].map(normalize);if(!base||base.id!=='snowbound'||base.width!==SNOWBOUND_WORLD.width||base.height!==SNOWBOUND_WORLD.height||!Array.isArray(base.obstacles)||!same(base.obstacles.map(normalize),expected))throw new TypeError('Complete actual camp world required');const current=foreign(s),old=before.get(s),oldIds=new Set(old?.boxes.map(b=>b.bodyId)),ids=new Set(current.map(b=>b.bodyId)),sweptForeign=sweptPreparationBodyBounds(old?.boxes,current);return{...base,bodySampleAt:old?.at,motionProven:!!old&&[...oldIds].every(id=>ids.has(id))&&[...ids].every(id=>oldIds.has(id)),sweptForeign,obstacles:[...base.obstacles,...material(s),...sweptForeign]};}
 const kernel=createTrainCampWorkProvider(E,physicalWorld);
 function fit(s,g,right=true){const base=kernel.prepareNativeActor(s,'ruth');return physicalProjection(E,()=>{const pose=preparePreparationChargePose(E,base.human,base.body,g,{right});try{const entries=pose.contacts.map(c=>({...base,joints:['sh','elbow','hand'].map(k=>rigWorldPoint(base.human.rig,pose.root,k+c.side)),reachable:pose.diagnostics.find(d=>d.side===c.side)?.reachable===true,usable:pose.diagnostics.find(d=>d.side===c.side)?.blocked==null}));return{...base,entries,handContacts:copy(pose.contacts),joints:entries[0].joints,reachable:entries.every(e=>e.reachable),usable:entries.every(e=>e.usable)};}finally{pose.restore();}});}
 function geometry(s,span){const p=pending(s),seconds=p?.work.acceptedSeconds||0;return preparationChargeLiftGeometry(Math.min(1,(seconds+span.finish-span.start)/CUSTODY_WORK_SECONDS['move-object']));}
 function contact(s,op,span){
  if(!active(s)||!preparationChargeOperationMode(op)||!stationed(s.entities?.ruth)||!span||!finite({x:span.start,y:span.finish,z:0})||span.finish!==s.elapsed||span.finish<span.start||span.finish-span.start>.1+EPS)return null;
  const g=geometry(s,span),e=fit(s,g),world=physicalWorld(s),key=JSON.stringify(op),old=windows.get(s),zero=span.start===span.finish,from=zero?g:old?.at===span.start&&old.key===key?old.geometry:null;
  const proof=from&&liftWindow(s,{fromProgress:from.progress,toProgress:g.progress,bodyBounds:capturePreparationBodyBounds(s,{geometryVersion:3}),geometry:preparationChargeWorldGeometry(s)},world.sweptForeign),sweptClear=!!proof&&(zero||world.motionProven&&world.bodySampleAt===span.start)&&e.human.rig.spW===0;
  windows.set(s,{at:span.finish,key,geometry:copy(g)});const w=pending(s);poses.set(s,{...e,at:s.elapsed,liveStamp:stamp(e.body),workId:w?.work.workId??null,operationKind:'move-object',geometry:copy(g)});
  return{...span,sweptClear,actors:[{id:'ruth',root:point(e.body),hand:copy(e.entries[0].joints[2]),regionId:'snowbound',alive:e.body.hp>0&&!e.body.dead,mounted:!!e.body.mounted,handUsable:e.usable,handFree:kernel.handFree(s,'ruth')}],sources:[{ref:ref(),point:copy(g.center),regionId:'snowbound',actorId:'ruth',maxHandDistance:22}],destinations:[{location:{type:'carried',targetId:'ruth'},point:copy(PREPARATION_CHARGE_HELD_CENTER),regionId:'snowbound',actorId:'ruth',maxHandDistance:22}],fixedContacts:[]};
 }
 function held(s){const g=preparationCarriedChargeGeometry(s);if(!g)return null;const e=fit(s,g,false);poses.set(s,{...e,at:s.elapsed,liveStamp:stamp(e.body),workId:null,operationKind:'carried-first-charge',geometry:copy(g)});return g;}
 return{context(s,base,dt=0){const p=pending(s);if(p&&!windows.has(s))contact(s,p.op,{start:s.elapsed,finish:s.elapsed});else if(carryEvent(s))held(s);return{...base,
  preparePreparationWork(s,w){if(w.kind!=='takeFirst')return base.preparePreparationWork(s,w);if(!active(s)||!Number.isFinite(dt)||dt<=0||dt>.1||!preparedCampSite(s,'quarry-charge-worktop')||!free(s.entities?.ruth))return false;if(w.workId===null&&w.chargeLiftVersion===undefined){w.chargeLiftVersion=1;prep(s).work.chargeLiftVersion=1;}if(w.workId===null&&w.bodyGeometryVersion===undefined){w.bodyGeometryVersion=3;prep(s).work.bodyGeometryVersion=3;}followPreparationActor(s,'ruth',PREPARATION_CHARGE_APPROACH,65,dt,{worldFor});const a=s.entities.ruth;if(distance(point(a),PREPARATION_CHARGE_APPROACH)>.051||Math.abs(Math.atan2(Math.sin(a.facing-PREPARATION_CHARGE_APPROACH.facing),Math.cos(a.facing-PREPARATION_CHARGE_APPROACH.facing)))>EPS||Math.hypot(a.vx||0,a.vy||0)>.01||!kernel.handFree(s,'ruth'))return false;const e=fit(s,preparationChargeLiftGeometry(0));return e.reachable&&e.usable&&e.human.rig.spW===0;},
  prepareCampWork(s){base.prepareCampWork(s);if(!active(s))return;const current=pending(s);if(current)contact(s,current.op,{start:s.elapsed,finish:s.elapsed});if(current||prep(s)?.work?.kind==='takeFirst'||carryEvent(s))before.set(s,{at:s.elapsed,boxes:foreign(s)});if(carryEvent(s))held(s);},
  authorizeCustodyOp:(s,op)=>preparationChargeOperationMode(op)?active(s)&&stationed(s.entities?.ruth)&&validatePreparationChargeWork(s,op,s.elapsed)&&prep(s)?.work?.kind==='takeFirst':base.authorizeCustodyOp(s,op),
  powderContactWindow:(s,op,span)=>preparationChargeOperationMode(op)?contact(s,op,span):base.powderContactWindow(s,op,span),
  canContain:(s,item,to)=>item?.id===PREPARATION_CHARGE_ID&&same(to,{owner:'ruth',location:{type:'carried',targetId:'ruth'}})?item.owner==='ruth'&&item.location.type==='crate'&&item.location.targetId==='charge-crate'&&item.sealed===true&&!item.powder?.primerId:base.canContain(s,item,to),
  pointForLocation:(s,l)=>same(l,{type:'carried',targetId:'ruth'})&&(pending(s)||prep(s)?.work?.kind==='takeFirst')?copy(PREPARATION_CHARGE_HELD_CENTER):base.pointForLocation(s,l),
  custodySnapshot(s,args){if(args.refs.length!==1||!same(args.refs[0],ref())||!same(args.destinations,[{type:'carried',targetId:'ruth'}]))return base.custodySnapshot(s,args);const g=geometry(s,{start:s.elapsed,finish:s.elapsed});return{actors:args.actorIds.map(id=>({id,point:point(s.entities[id])})),sources:[{ref:ref(),point:copy(g.center)}],destinations:[{location:{type:'carried',targetId:'ruth'},point:copy(PREPARATION_CHARGE_HELD_CENTER)}]};},
 };}};
}
