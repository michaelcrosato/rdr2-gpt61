/** Native fitting of Ada's one owned windwrap. Geometry never issues or
 * transfers the garment; accepted custody work remains its only writer. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {sourceForRevision} from './rival-continuation.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SHAPE,TRAIN_MASK_FIT_V2} from '../content/campaign/train-gear-data.js';
import {physicalProjection,rigWorldPoint,createTrainMount,prepareTrainMountedPose} from './train-native/rigs.js';
import {createTrainCampWorkProvider} from './train-camp-work.js';
import {capturePreparationBodyBounds} from './train-preparation-layout.js';
import * as PreparationLayout from './train-preparation-layout.js';
import {sweptPreparationBodyBounds} from './train-preparation-work.js';
import {inspectCustodyRequest,CUSTODY_WORK_SECONDS} from './rival-continuation.js';
import {validateTrainGearInstance} from './train-gear.js';
import {blockedAt} from './campaign-navigation.js';

const copy=structuredClone,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>plain(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const ref=()=>({sourceMissionId:TRAIN_ID,objectId:TRAIN_MASK_ID});
const location=worn=>worn?{type:'worn',targetId:'mara',slot:'face'}:{type:'carried',targetId:'mara'};
const volume=h=>8*h.x*h.y*h.z;
const lerp=(a,b,t)=>a+(b-a)*t;

export function preparationMaskOperationMode(op){
  if(!plain(op)||Object.keys(op).some(k=>!['kind','actorIds','refs','options','to','cause'].includes(k))||op.kind!=='move-object'||!same(op.actorIds,['mara'])||!same(op.refs,[ref()])||!(keys(op.options,[])||keys(op.options,['maskFitVersion'])&&op.options.maskFitVersion===2)||!keys(op.to,['owner','location'])||op.to.owner!=='mara')return null;
  if(same(op.to.location,location(true)))return'wear';
  if(same(op.to.location,location(false)))return'remove';
  return null;
}

export function validatePreparationMaskWork(s,op,startedAt){
  try{
    const p=s.campaign.missions[TRAIN_ID].train.preparation,mode=preparationMaskOperationMode(op),events=s.campaign.missions[RIVAL_ID].rival.continuation.events;
    if(!mode||!p||!Number.isFinite(startedAt)||startedAt<p.startedAt||startedAt>s.elapsed||!p.completed.some(e=>e.kind==='store'&&e.at<=startedAt))return false;
    const revision=events.filter(e=>e.at<=startedAt).length,item=sourceForRevision(s,ref(),revision,startedAt),issue=events.find(e=>e.id===item?.issueEventId);
    return !!item&&item.id===TRAIN_MASK_ID&&item.kind==='face-covering'&&item.owner==='mara'&&item.issuedAt<=startedAt&&issue?.kind==='issue-mask'&&issue.at<=startedAt&&same(item.location,location(mode==='remove'));
  }catch{return false;}
}

export function preparationWornMaskFitVersion(s){
 const events=s.campaign?.missions?.[RIVAL_ID]?.rival?.continuation?.events||[];
 for(let i=events.length-1;i>=0;i--){const e=events[i],op=e.operation;if(e.kind==='move-object'&&same(op?.refs,[ref()])&&same(op.to?.location,location(true)))return op.options?.maskFitVersion===2?2:1;}
 return 1;
}
const fitVersionFor=op=>op?.options?.maskFitVersion===2?2:1;

/** Unfolding changes the finite folded envelope into the fitted envelope.
 * Its volume is conserved at every intermediate phase, not only endpoints. */
export function preparationMaskHalfExtents(unfolded,fitVersion=1){
  if(!Number.isFinite(unfolded)||unfolded<0||unfolded>1)throw new TypeError('A finite mask fold phase in [0,1] is required');
  if(![1,2].includes(fitVersion))throw new TypeError('A known finite mask fit profile is required');
  const a=TRAIN_MASK_SHAPE.folded,b=fitVersion===2?TRAIN_MASK_FIT_V2.halfExtents:TRAIN_MASK_SHAPE.worn,x=lerp(a.x,b.x,unfolded),z=lerp(a.z,b.z,unfolded),y=volume(a)/(8*x*z);
  return{x,y,z};
}

/** All sockets come from the current actual physics human. Head and chest
 * geometry is independent of its hand fit and of the rendering camera. */
export function preparationMaskGeometry(E,entry,mode,progress,{root:physicalRoot=null,fitVersion=1}={}){
  if(!entry?.human?.rig||!entry.body||!['wear','remove'].includes(mode)||!Number.isFinite(progress)||progress<0||progress>1)throw new TypeError('An actual native actor and finite mask work phase are required');
  return physicalProjection(E,()=>{
    const body=entry.body,rig=entry.human.rig,root=physicalRoot||{x:body.x,y:body.y,z:body.z||0};if(!keys(root,['x','y','z'])||!['x','y','z'].every(k=>Number.isFinite(root[k])))throw new TypeError('An actual finite physics pose root is required');
    const facing=body.facing||0,forward={x:Math.cos(facing),y:Math.sin(facing),z:0},right={x:-Math.sin(facing),y:Math.cos(facing),z:0};
    const head=rigWorldPoint(rig,root,'head'),chest=rigWorldPoint(rig,root,'shC');
    const radius=rig.o.headR*rig.o.size,offset=(p,front,z)=>({x:p.x+forward.x*front,y:p.y+forward.y*front,z:p.z+z}),face=fitVersion===2?offset(head,radius*TRAIN_MASK_FIT_V2.forwardHeadRadius,radius*TRAIN_MASK_FIT_V2.verticalHeadRadius):offset(head,radius+.15,-4),pocket=offset(chest,4,-4),unfolded=mode==='wear'?progress:1-progress,halfExtents=preparationMaskHalfExtents(unfolded,fitVersion);
    const center={x:lerp(pocket.x,face.x,unfolded),y:lerp(pocket.y,face.y,unfolded),z:lerp(pocket.z,face.z,unfolded)},hand={x:center.x+right.x*(halfExtents.x+2.6),y:center.y+right.y*(halfExtents.x+2.6),z:center.z};
    return{itemRef:ref(),fitVersion,mode,progress,unfolded,center,halfExtents,axes:{x:right,y:{x:-forward.x,y:-forward.y,z:0},z:{x:0,y:0,z:1}},hand,face,pocket,volume:volume(halfExtents),color:TRAIN_MASK_SHAPE.color,seam:TRAIN_MASK_SHAPE.seam};
  });
}

export function ownedPreparationMask(s){const item=s.itemInstances?.[TRAIN_MASK_ID];return item?.owner==='mara'&&validateTrainGearInstance(s,item)?copy(item):null;}

const livePoses=new WeakMap(),wornPoses=new WeakMap(),stamp=a=>JSON.stringify([a.x,a.y,a.z,a.vx,a.vy,a.facing,a.pose,a.crouch,a.hp,a.holstered,a.mounted,a.attachment,a.carrying,a.toolHeld,a.weaponAction,a.handInjury,a.injured,a.reloadTimer,a.reloadWeaponId]);
const mountStamp=a=>JSON.stringify([a.id,a.x,a.y,a.z,a.vx,a.vy,a.facing,a.hp,a.dead,a.hidden,a.departed,a.regionId,a.fear]);
function currentMaskMount(s,a){
 if(!a?.mounted)return null;
 const h=s.entities?.[a.mountId||s.party?.mountId];
 return h&&h!==a&&h.hp>0&&!h.dead&&!h.hidden&&!h.departed&&(h.kind==='horse'||h.category==='mount')&&['mount','animal'].includes(h.category)&&h.regionId===a.regionId&&['x','y'].every(k=>Number.isFinite(h[k])&&Math.abs(h[k]-a[k])<1e-7)&&Math.abs((h.z||0)-(a.z||0))<1e-7?h:null;
}
const record=s=>s.campaign?.missions?.[TRAIN_ID]?.train;
const active=s=>s.campaign?.activeMissionId===TRAIN_ID&&s.region==='snowbound'&&s.mission.stage===2&&record(s)?.preparationVersion===1;
const point=a=>({x:a.x,y:a.y,z:a.z||0});
function pendingMask(s){for(const work of record(s)?.powder?.pending||[]){const op=inspectCustodyRequest(s,work.requestId)?.operation;if(preparationMaskOperationMode(op))return{work,op};}return null;}
export function getPreparationMaskPose(s){const p=livePoses.get(s),a=s.entities?.mara,w=pendingMask(s);return p&&a&&p.body===a&&p.at===s.elapsed&&p.stamp===stamp(a)&&w?.work.workId===p.workId? p:null;}
export function getPreparationWornMaskPose(s){const p=wornPoses.get(s),a=s.entities?.mara,item=ownedPreparationMask(s);return p&&a&&p.body===a&&p.at===s.elapsed&&p.stamp===stamp(a)&&item?.location.type==='worn'&&(!a.mounted||p.mountBody===currentMaskMount(s,a)&&p.mountRig&&p.mountStamp===mountStamp(p.mountBody))?p:null;}

function foreignBoxes(s){const geometryVersion=record(s)?.preparation?.work?.bodyGeometryVersion??2,out=[];for(const r of capturePreparationBodyBounds(s,{geometryVersion}))if(r.id!=='mara'&&r.regionId==='snowbound'){
 const radius=Math.max(...r.volumes.flatMap(v=>[v.min.x,v.max.x].flatMap(x=>[v.min.y,v.max.y].map(y=>Math.hypot(x-r.point.x,y-r.point.y))))),meta={bodyId:r.id,rootPoint:{...r.point},bodyFacing:r.pose.facing,bodyPose:JSON.stringify([r.pose,r.binding,r.radius,r.height]),bodyRadiusXY:radius,bodyMinZ:Math.min(...r.volumes.map(v=>v.min.z)),bodyMaxZ:Math.max(...r.volumes.map(v=>v.max.z))};
 for(const[i,v]of r.volumes.entries())out.push({id:`${r.id}:${i}`,...meta,x:v.min.x,y:v.min.y,z:v.min.z,w:v.max.x-v.min.x,h:v.max.y-v.min.y,height:v.max.z-v.min.z});
 }return out;}
function segmentBox(a,b,box,radius){let lo=0,hi=1;for(const[k,min,max]of [['x',box.x-radius,box.x+box.w+radius],['y',box.y-radius,box.y+box.h+radius],['z',(box.z||0)-radius,(box.z||0)+(box.height||35)+radius]]){const d=b[k]-a[k];if(Math.abs(d)<1e-10){if(a[k]<min||a[k]>max)return false;continue;}let x=(min-a[k])/d,y=(max-a[k])/d;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}return true;}
function settledStance(entry){const pose=entry.body.pose||(entry.body.crouch?'crouch':null),weights=entry.human.rig.poseW;return !weights||Math.abs((weights.crouch||0)-(pose==='crouch'?1:0))<1e-8;}

export function createPreparationMaskProvider(E,worldFor){
 const before=new WeakMap(),windows=new WeakMap(),mounts=new WeakMap();
 function mountedPose(s,entry){
  const horse=currentMaskMount(s,entry.body);if(!horse)return null;
  let map=mounts.get(s);if(!map){map=new Map();mounts.set(s,map);}let cached=map.get(horse.id);
  if(!cached||cached.body!==horse){cached={body:horse,rig:createTrainMount(E,horse),at:null,stamp:null};map.set(horse.id,cached);}
  const key=mountStamp(horse);if(cached.at!==s.elapsed||cached.stamp!==key){const dt=cached.at===null?0:Math.max(0,Math.min(.1,s.elapsed-cached.at));cached.rig.clock=s.elapsed-dt;cached.rig.update(dt,horse);cached.at=s.elapsed;cached.stamp=key;}
  return physicalProjection(E,()=>{const pose=prepareTrainMountedPose(E,entry.human,entry.body,horse,cached.rig,{freeHands:entry.body.holstered!==false||!entry.body.equippedWeaponId});try{return{mountBody:horse,mountRig:cached.rig,mountStamp:key,mountedRoot:copy(pose.root),mountedContacts:copy(pose.diagnostics),geometry:preparationMaskGeometry(E,entry,'wear',1,{root:pose.root,fitVersion:preparationWornMaskFitVersion(s)})};}finally{pose.restore();}});
 }
 function physicalWorld(s){const base=worldFor(s),now=foreignBoxes(s),old=before.get(s),oldIds=new Set(old?.boxes.map(b=>b.bodyId)),ids=new Set(now.map(b=>b.bodyId));return{...base,bodySampleAt:old?.at,motionProven:!!old&&[...oldIds].every(id=>ids.has(id))&&[...ids].every(id=>oldIds.has(id)),obstacles:[...base.obstacles,...sweptPreparationBodyBounds(old?.boxes,now)]};}
 const kernel=createTrainCampWorkProvider(E,physicalWorld);
 function geometry(s,op,span){const mode=preparationMaskOperationMode(op),pending=pendingMask(s),seconds=pending&&same(pending.op,op)?pending.work.acceptedSeconds:0,delta=span.finish-span.start,progress=Math.min(1,(seconds+delta)/CUSTODY_WORK_SECONDS['move-object']),entry=kernel.prepareNativeActor(s,'mara');return preparationMaskGeometry(E,entry,mode,progress,{fitVersion:fitVersionFor(op)});}
 function contact(s,op,span){
  if(!active(s)||!preparationMaskOperationMode(op)||!Number.isFinite(span.start)||!Number.isFinite(span.finish)||span.finish!==s.elapsed||span.finish<span.start||span.finish-span.start>.1+1e-7)return null;
  const g=geometry(s,op,span),entry=kernel.prepareNativeActor(s,'mara',g.hand,{elbowHint:[0,0,1]}),a=entry.body,world=physicalWorld(s),key=JSON.stringify(op),old=windows.get(s),zero=span.start===span.finish;
  // The folding envelope is monotone in each local half-extent. Its full
  // circumsphere therefore encloses every intermediate fold and body yaw.
  const materialRadius=Math.hypot(6,2,4),from=zero?g.center:old?.at===span.start&&old.key===key?old.geometry.center:null;
  const clear=!!from&&world.obstacles.every(o=>!segmentBox(from,g.center,o,materialRadius));
  const sweptClear=settledStance(entry)&&!blockedAt(world,a.x,a.y,9)&&clear&&(zero||world.motionProven&&world.bodySampleAt===span.start)&&kernel.inspectNativeInterval(s,key,span.start,span.finish,[entry]);
  windows.set(s,{at:span.finish,key,geometry:copy(g)});
  const current=pendingMask(s);livePoses.set(s,{...entry,at:s.elapsed,stamp:stamp(a),workId:current?.work.workId??null,geometry:copy(g),operationKind:'move-object'});
  return{...span,sweptClear,actors:[{id:'mara',root:point(a),hand:{...entry.joints[2]},regionId:'snowbound',alive:a.hp>0&&!a.hidden&&!a.departed,mounted:!!a.mounted,handUsable:entry.usable,handFree:kernel.handFree(s,'mara')}],sources:[{ref:ref(),point:{...g.center},regionId:'snowbound',actorId:'mara',maxHandDistance:22}],destinations:[{location:copy(op.to.location),point:copy(op.to.location.type==='worn'?g.face:g.pocket),regionId:'snowbound',actorId:'mara',maxHandDistance:22}],fixedContacts:[]};
 }
 function endpoint(s,worn){const e=kernel.prepareNativeActor(s,'mara'),pending=pendingMask(s),fitVersion=pending?fitVersionFor(pending.op):record(s)?.preparation?.work?.maskFitVersion??preparationWornMaskFitVersion(s),g=preparationMaskGeometry(E,e,'wear',worn?1:0,{fitVersion});return copy(worn?g.face:g.pocket);}
 return{context(s,base,dt=0){
  if(active(s)){
   const pending=pendingMask(s);if(pending&&!windows.has(s))contact(s,pending.op,{start:s.elapsed,finish:s.elapsed});
   const item=ownedPreparationMask(s),a=s.entities.mara;
   if(item?.location.type==='worn'&&a.hp>0&&!a.hidden&&!a.departed){const e=kernel.prepareNativeActor(s,'mara'),mounted=a.mounted?mountedPose(s,e):null;if(a.mounted&&!mounted)wornPoses.delete(s);else wornPoses.set(s,{...e,at:s.elapsed,stamp:stamp(a),...(mounted||{geometry:preparationMaskGeometry(E,e,'wear',1,{fitVersion:preparationWornMaskFitVersion(s)})})});}else wornPoses.delete(s);
  }
  return{...base,
  preparePreparationWork(s,w){if(!['wearMask','removeMask'].includes(w.kind))return base.preparePreparationWork(s,w);const a=s.entities.mara;if(!active(s)||!Number.isFinite(dt)||dt<=0||dt>.1||!ownedPreparationMask(s)||!kernel.handFree(s,'mara')||!kernel.handUsable(s,'mara')||a.hidden||a.departed)return false;if(w.workId===null&&w.bodyGeometryVersion===undefined&&PreparationLayout.DEFAULT_PREPARATION_BODY_GEOMETRY_VERSION===3){w.bodyGeometryVersion=3;record(s).preparation.work.bodyGeometryVersion=3;}const e=kernel.prepareNativeActor(s,'mara');return e.human.rig.spW===0&&settledStance(e);},
  prepareCampWork(s){base.prepareCampWork(s);if(!active(s))return;const p=pendingMask(s),kind=record(s).preparation?.work?.kind;if(!p&&!['wearMask','removeMask'].includes(kind))return;if(p)contact(s,p.op,{start:s.elapsed,finish:s.elapsed});before.set(s,{at:s.elapsed,boxes:foreignBoxes(s)});},
  authorizeCustodyOp:(s,op)=>preparationMaskOperationMode(op)?active(s)&&validatePreparationMaskWork(s,op,s.elapsed):base.authorizeCustodyOp(s,op),
  powderContactWindow:(s,op,span)=>preparationMaskOperationMode(op)?contact(s,op,span):base.powderContactWindow(s,op,span),
  canContain:(s,item,to)=>item?.id===TRAIN_MASK_ID?item.owner==='mara'&&to.owner==='mara'&&(same(to.location,location(true))||same(to.location,location(false))):base.canContain(s,item,to),
  pointForLocation:(s,l)=>l.targetId==='mara'&&(l.type==='worn'||l.type==='carried'&&(pendingMask(s)||record(s)?.preparation?.work?.kind==='removeMask'))?endpoint(s,l.type==='worn'):base.pointForLocation(s,l),
  custodySnapshot(s,args){if(args.refs.length!==1||!same(args.refs[0],ref()))return base.custodySnapshot(s,args);const p=pendingMask(s),op=p?.op||{kind:'move-object',actorIds:['mara'],refs:[ref()],options:record(s)?.preparation?.work?.maskFitVersion===2?{maskFitVersion:2}:{},to:{owner:'mara',location:args.destinations[0]}},g=geometry(s,op,{start:s.elapsed,finish:s.elapsed});return{actors:[{id:'mara',point:point(s.entities.mara)}],sources:[{ref:ref(),point:copy(g.center)}],destinations:args.destinations.map(l=>({location:copy(l),point:copy(l.type==='worn'?g.face:g.pocket)}))};},
 };}};
}
