/** A persisted physical lead/check prefix. The same Inez and Skein navigate,
 * take a finite rein and move through the actual old camp. This never completes
 * the separate tack, water and care obligations. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {SNOWBOUND_WORLD} from '../content/campaign/snowbound.js';
import {NORTH_CUTTING_WORLD} from '../content/campaign/north-cutting.js';
import {WILLOW_RUN_WORLD} from '../content/campaign/willow-run.js';
import {TRAIN_BRIEFING_TABLE_SOLID} from '../content/campaign/train-camp.js';
import {TRAIN_PREPARATION_SOLIDS,TRAIN_CRATE_SOLIDS,TRAIN_CHILD_CONTACTS,TRAIN_TIN_CENTER,TRAIN_TIN_SHAPE,TRAIN_KIT_SLOTS} from '../content/campaign/train-preparation-camp.js';
import {TRAIN_CHARGE_HALF_EXTENTS} from '../content/campaign/train-equipment.js';
import {TRAIN_MASK_BASKET_SOLIDS} from '../content/campaign/train-gear-data.js';
import {TRAIN_STABLE_LEAD as LEAD} from '../content/campaign/train-stable-data.js';
import {TRAIN_WATCH_HOLDING_RANGE} from '../content/campaign/train-watch-data.js';
import {capturePreparationBodyBounds,validatePreparationBodyBounds} from './train-preparation-layout.js';
import {preparationWatchPrefix} from './train-preparation-watch.js';
import {followPreparationActor} from './train-preparation-navigation.js';
import {preparationNativeBodyParts,preparationPartBounds,sweepPreparationNativeYaw} from './train-preparation-body-geometry.js';
import {createTrainHuman,createTrainMount,prepareTrainPose,physicalProjection,rigWorldPoint} from './train-native/rigs.js';
import {createHeldBox,translateHeldBox,compileHeldBoxSet,heldBoxContacts,createHeldBoxMotion,sweepHeldBox} from './train-held-volume.js';
import {makeFrame,localPoint,worldPoint,sub,dot,length} from './rail-foundation/rigid-frame.js';

const EPS=1e-7,copy=structuredClone,axes=['x','y','z'],P=(x=0,y=0,z=0)=>({x,y,z});
const liveDuties=new WeakMap(),navigationShadows=new WeakMap(),worldParts=new Map(),singleSets=new WeakMap();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(v,n)=>object(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const finite=p=>keys(p,axes)&&axes.every(k=>Number.isFinite(p[k])),point=a=>P(a.x,a.y,a.z??0),distance=(a,b)=>Math.hypot(...axes.map(k=>a[k]-b[k]));
const train=s=>s.campaign?.missions?.[TRAIN_ID]?.train,prep=s=>train(s)?.preparation,duty=s=>prep(s)?.stableDuty,angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const active=s=>s.version===5&&s.region==='snowbound'&&s.campaign?.activeMissionId===TRAIN_ID&&s.campaign.missions[TRAIN_ID].mission.stage===2&&train(s)?.preparationVersion===1;
const frame=a=>({point:point(a),facing:a.facing??0,vx:a.vx??0,vy:a.vy??0});
const validFrame=f=>keys(f,['point','facing','vx','vy'])&&finite(f.point)&&['facing','vx','vy'].every(k=>Number.isFinite(f[k]));
const withFrame=(a,f)=>({...a,...f.point,facing:f.facing,vx:f.vx,vy:f.vy});
const body=rows=>rows.find(r=>r.id==='skein'),leader=rows=>rows.find(r=>r.id==='inez');
const free=a=>a?.hp>0&&!a.dead&&!a.bound&&!a.restrained&&!a.mounted&&!a.attachment&&!a.carrying&&!a.toolHeld&&!a.weaponAction&&!(a.reloadTimer>0);
const handFree=a=>free(a)&&!a.crouch&&[null,undefined,'stand'].includes(a.pose)&&a.holstered===true&&!(a.handInjury&&a.injured!==false&&!a.handInjury.recovered&&a.handInjury.side==='right');
const rowFrame=r=>({point:r.point,facing:r.pose.facing,vx:r.pose.vx,vy:r.pose.vy});
const rowModel=r=>({id:r.id,kind:r.kind,category:r.category,...r.point,hp:r.hp,dead:r.dead,rig:r.pose.rig||undefined,facing:r.pose.facing,vx:r.pose.vx,vy:r.pose.vy,fear:r.pose.fear,bound:r.pose.bound,restrained:r.pose.restrained,surrendered:r.pose.surrendered,crouch:r.pose.crouch,pose:r.pose.pose,holstered:true});
function box(id,p,h){return createHeldBox({id,frame:makeFrame(p,P(1,0,0)),halfExtents:h});}
function obstacle(o){const h=o.height??35;if(!object(o)||typeof o.id!=='string'||!['x','y','w','h'].every(k=>Number.isFinite(o[k]))||o.w<=0||o.h<=0||!Number.isFinite(o.z??0)||!Number.isFinite(h)||h<0)throw new TypeError('Actual finite camp solid required');return{id:o.id,x:o.x,y:o.y,z:o.z??0,w:o.w,h:o.h,height:h};}
function rectBox(o){return box(o.id,P(o.x+o.w/2,o.y+o.h/2,o.z+o.height/2),P(o.w/2,o.h/2,o.height/2));}
function oneSet(ref){let owners=singleSets.get(ref.box);if(!owners){owners=new Map();singleSets.set(ref.box,owners);}if(!owners.has(ref.ownerId))owners.set(ref.ownerId,compileHeldBoxSet([ref],{id:'stable-fixed-pair'}));return owners.get(ref.ownerId);}
function cap(id,a,b,r){const d=sub(b,a),n=length(d);return n<EPS?box(id,a,P(r,r,r)):createHeldBox({id,frame:makeFrame(P(...axes.map(k=>(a[k]+b[k])/2)),d,Math.abs(d.z/n)>.95?P(0,1,0):P(0,0,1)),halfExtents:P(n/2+r,r,r)});}
function siteAt(s,id,at){return prep(s)?.campSetup?.sites?.[id]?.introducedAt<=at;}
/** Canonical old-world solids, including finite contents of occupied sources.
 * Material source envelopes deliberately remain conservative for this lead;
 * their removal never creates an unproved access corridor. */
export function preparationStableWorldGeometry(s,at=s.elapsed){
  if(!Number.isFinite(at)||at<0||at>s.elapsed)throw new TypeError('Finite historical camp time required');
  const out=[...SNOWBOUND_WORLD.obstacles,...NORTH_CUTTING_WORLD.camp.obstacles,...WILLOW_RUN_WORLD.camp.obstacles,...RIVAL_WORLD.camp.obstacles,...(train(s)?.briefing?.setup.finishedAt!=null&&train(s).briefing.setup.finishedAt<=at?[TRAIN_BRIEFING_TABLE_SOLID]:[]),...TRAIN_PREPARATION_SOLIDS.filter(o=>siteAt(s,o.id,at))].map(obstacle);
  const cargo=(id,c,h)=>obstacle({id,x:c.x-h.x,y:c.y-h.y,z:c.z-h.z,w:h.x*2,h:h.y*2,height:h.z*2});
  if(siteAt(s,'quarry-charge-worktop',at))out.push(...TRAIN_CRATE_SOLIDS.map(obstacle),...Object.entries(TRAIN_CHILD_CONTACTS).map(([id,v])=>cargo(id,v.center,TRAIN_CHARGE_HALF_EXTENTS)),cargo('cap-tin',TRAIN_TIN_CENTER,TRAIN_TIN_SHAPE));
  if(siteAt(s,'ruth-wiring-case-stand',at))out.push(...Object.entries(TRAIN_KIT_SLOTS).map(([id,v])=>cargo(id,v.center,v.halfExtents)));
  if(siteAt(s,'ada-mending-worktop',at))out.push(...TRAIN_MASK_BASKET_SOLIDS.map(obstacle));
  return out;
}
function actualWorld(s,ctx){const w=ctx?.worldFor?.(s);if(!w||w.id!=='snowbound'||w.width!==SNOWBOUND_WORLD.width||w.height!==SNOWBOUND_WORLD.height||!Array.isArray(w.obstacles))throw new TypeError('Actual old-world collision provider required');const expected=preparationStableWorldGeometry(s),base=expected.slice(0,[...SNOWBOUND_WORLD.obstacles,...NORTH_CUTTING_WORLD.camp.obstacles,...WILLOW_RUN_WORLD.camp.obstacles,...RIVAL_WORLD.camp.obstacles].length+(train(s)?.briefing?.setup.finishedAt!=null?1:0)+TRAIN_PREPARATION_SOLIDS.filter(o=>siteAt(s,o.id,s.elapsed)).length);if(!same(w.obstacles.map(obstacle),base))throw new TypeError('Missing or substituted camp collision solids');return expected;}
function linked(m,local=LEAD.leaderLocal,facingOffset=LEAD.leaderFacingOffset){const p=worldPoint(makeFrame(m.point,P(Math.cos(m.facing),Math.sin(m.facing))),local);return{point:p,facing:m.facing+facingOffset,vx:0,vy:0};}
export function preparationStableApproach(s){const m=s.entities?.skein;return m?linked(frame(m)):null;}
/** The same deterministic native pose is available to presentation consumers.
 * No camera transform, inventory flag or assigned contact substitutes for it. */
export function preparePreparationStablePose(E,human,inez,mare,progress=1){
  if(!Number.isFinite(progress)||progress<0||progress>1)throw new TypeError('Finite grip phase required');
  return physicalProjection(E,()=>{const rig=human.rig;rig.t=0;rig.phase=0;rig.facing=inez.facing??0;rig._cheat=0;rig.o.cheat=0;rig.downW=0;rig.poseW={cheer:0,cast:0,guard:0,kneel:0,crouch:0,wave:0,hips:0,block:0};rig._pose();const mount=createTrainMount(E,mare);mount.update(0,mare);const q=mount.world(mare,[LEAD.reinLocal.x,LEAD.reinLocal.y,LEAD.reinLocal.z]),reinEnd=P(...q),start=rigWorldPoint(rig,inez,'handR'),target=P(...axes.map(k=>start[k]+(reinEnd[k]-start[k])*progress)),pose=prepareTrainPose(E,human,inez,null,{contacts:[{side:'R',kind:'stable-rein',target,elbowHint:[0,0,1]}],freeHands:handFree(inez)});return{...pose,reinEnd,halter:P(...mount.world(mare,[LEAD.halterLocal.x,LEAD.halterLocal.y,LEAD.halterLocal.z+mount.fear*9]))};});
}
export function inspectPreparationStableGrip(s,inez,mare){
  const E=globalThis.My3D2dge;if(!E?.Humanoid||!handFree(inez)||!free(mare))return null;
  const human=createTrainHuman(E,inez),pose=preparePreparationStablePose(E,human,inez,mare);
  try{const d=pose.diagnostics[0];if(!d?.reachable||d.error>1e-5)return null;return{hand:rigWorldPoint(human.rig,pose.root,'handR'),reinEnd:pose.reinEnd,halter:pose.halter,arm:['shR','elbowR','handR'].map(k=>rigWorldPoint(human.rig,pose.root,k))};}finally{pose.restore();}
}
function gripRows(rows){const i=leader(rows),m=body(rows),hit=inspectPreparationStableGrip(null,rowModel(i),rowModel(m));if(!hit)throw new TypeError('Actual healthy right-hand rein contact required');return hit;}
function parts(rows,id,{moving=false,grip=false}={}){const r=rows.find(a=>a.id===id);if(!r)throw new TypeError('Missing registered participant');const pose=moving?{...r.pose,vx:1,vy:0}:r.pose;return preparationNativeBodyParts({...r,pose},rows,grip?{contact:{side:'R',target:gripRows(rows).reinEnd,elbowHint:[0,0,1]}}:{});}
function boundsTouch(a,b){return axes.every(k=>a.min[k]<=b.max[k]+EPS&&a.max[k]>=b.min[k]-EPS);}
function otherSolids(before,after,geometry){
  if(before.length!==after.length||before.some((r,i)=>r.id!==after[i].id))throw new TypeError('An unchanged registered body set is required');
  const key=JSON.stringify(geometry);let solids=worldParts.get(key);if(!solids){solids=Object.freeze(geometry.filter(o=>o.height>0).map(o=>Object.freeze({box:rectBox(o),ownerId:'world'})));if(worldParts.size>=32)worldParts.delete(worldParts.keys().next().value);worldParts.set(key,solids);}const out=[...solids];
  for(let n=0;n<before.length;n++){const a=before[n],b=after[n];if(['inez','skein'].includes(a.id))continue;if(a.regionId!==b.regionId)throw new TypeError('Moving between regions requires a fresh sample');if(a.regionId!=='snowbound')continue;
    if(same(a,b)){out.push(...preparationNativeBodyParts(a,before).map(p=>({box:p,ownerId:a.id})));continue;}
    // Other-body turns/pose changes use a complete circumscribed enclosure;
    // unchanged-pose translation uses the union of each finite endpoint part.
    const turn=!same({...a.pose,vx:0,vy:0},{...b.pose,vx:0,vy:0})||!same(a.binding,b.binding),radius=Math.max(...[a,b].flatMap(r=>r.volumes.flatMap(v=>[v.min.x,v.max.x].flatMap(x=>[v.min.y,v.max.y].map(y=>Math.hypot(x-r.point.x,y-r.point.y))))));
    if(turn){const lo=P(Math.min(a.point.x,b.point.x)-radius,Math.min(a.point.y,b.point.y)-radius,Math.min(...[a,b].flatMap(r=>r.volumes.map(v=>v.min.z)))),hi=P(Math.max(a.point.x,b.point.x)+radius,Math.max(a.point.y,b.point.y)+radius,Math.max(...[a,b].flatMap(r=>r.volumes.map(v=>v.max.z))));out.push({box:box('moving-body',P(...axes.map(k=>(lo[k]+hi[k])/2)),P(...axes.map(k=>(hi[k]-lo[k])/2))),ownerId:a.id});}
    else{if(a.volumes.length!==b.volumes.length)throw new TypeError('Changed native shape needs a fresh sample');for(let j=0;j<a.volumes.length;j++){const lo=P(...axes.map(k=>Math.min(a.volumes[j].min[k],b.volumes[j].min[k]))),hi=P(...axes.map(k=>Math.max(a.volumes[j].max[k],b.volumes[j].max[k])));out.push({box:box('moving-part:'+j,P(...axes.map(k=>(lo[k]+hi[k])/2)),P(...axes.map(k=>Math.max(1e-6,(hi[k]-lo[k])/2)))),ownerId:a.id});}}
  }
  return out;
}
function withinWorld(part){return part.vertices.every(p=>p.x>=0&&p.y>=0&&p.x<=SNOWBOUND_WORLD.width&&p.y<=SNOWBOUND_WORLD.height);}
function initialDeparture(part,fixed,delta,from,to){if(!['tail','tail-hair','gait--22'].includes(part.id)||fixed.ownerId!=='world'||fixed.box.id!==LEAD.initialDepartureSolidId||Math.abs(to.facing-from.facing)>EPS||delta.x>=-EPS||Math.abs(delta.y)>EPS||from.point.x>LEAD.source.x+EPS||from.point.x<LEAD.west.x-EPS||Math.abs(from.point.y-LEAD.source.y)>EPS)return false;const set=oneSet(fixed),hits=heldBoxContacts(part,set);return hits.length===1&&hits[0].interiorOverlap&&dot(delta,hits[0].axis)>EPS&&heldBoxContacts(translateHeldBox(part,delta),set).every(h=>h.penetration<hits[0].penetration-EPS);}
function translationClear(own,fixed,delta,{departure=null}={}){const departures=[];for(const part of own){const end=translateHeldBox(part,delta);if(!withinWorld(part)||!withinWorld(end))return null;const swept={min:P(...axes.map(k=>Math.min(...part.vertices.map(p=>p[k]),...end.vertices.map(p=>p[k])))),max:P(...axes.map(k=>Math.max(...part.vertices.map(p=>p[k]),...end.vertices.map(p=>p[k]))))};let motion;for(const other of fixed){if(!boundsTouch(swept,preparationPartBounds(other.box)))continue;if(departure&&initialDeparture(part,other,delta,departure.from,departure.to)){departures.push({partId:part.id,solidId:other.box.id});continue;}motion??=createHeldBoxMotion(part,end);if(!sweepHeldBox(motion,oneSet(other),{contactMode:'interior'}).clear)return null;}}return departures;}
function combined(rows,moving){const hit=gripRows(rows),out=[...parts(rows,'skein',{moving}).map(box=>({id:'skein',box})),...parts(rows,'inez',{moving,grip:true}).map(box=>({id:'inez',box})),{id:'rein',box:cap('stable-rein',hit.hand,hit.halter,LEAD.reinRadius)}];return out;}
function pairClear(rows,moving){const mare=parts(rows,'skein',{moving}),set=compileHeldBoxSet(mare.map(box=>({box,ownerId:'skein'})),{id:'own-mare'});return parts(rows,'inez',{moving,grip:true}).every(part=>!heldBoxContacts(part,set).some(h=>h.interiorOverlap));}
function unchangedOwnPose(before,after){for(const id of['inez','skein']){const a=before.find(r=>r.id===id),b=after.find(r=>r.id===id),strip=r=>({...r,point:null,sourcePoint:null,volumes:null,pose:{...r.pose,facing:0,vx:0,vy:0}});if(!a||!b||!same(strip(a),strip(b)))return false;}return true;}
function orbitalClear(rows,to,own,fixed){
  const from=rowFrame(body(rows)),change=to.facing-from.facing,root=from.point,rot=(v,a)=>P(v.x*Math.cos(a)-v.y*Math.sin(a),v.x*Math.sin(a)+v.y*Math.cos(a),v.z),radii=own.map(({box:b})=>b.id==='root-foot'?Math.hypot(b.frame.origin.x-root.x,b.frame.origin.y-root.y):Math.max(...b.vertices.map(v=>Math.hypot(v.x-root.x,v.y-root.y)))),radius=Math.max(...own.flatMap(v=>v.box.vertices.map(p=>Math.hypot(p.x-root.x,p.y-root.y)))),zMin=Math.min(...own.flatMap(v=>v.box.vertices.map(p=>p.z))),zMax=Math.max(...own.flatMap(v=>v.box.vertices.map(p=>p.z))),broad={min:P(root.x-radius,root.y-radius,zMin),max:P(root.x+radius,root.y+radius,zMax)},near=fixed.filter(ref=>boundsTouch(broad,preparationPartBounds(ref.box))),set=near.length?compileHeldBoxSet(near,{id:'stable-orbital-world'}):null;
  // In the co-rotating frame, all native pieces are rigid except the owning
  // world-aligned foot prisms. A circumscribed horizontal square encloses every
  // relative yaw of each FULL foot. If these enlarged feet clear too, own-pair
  // separation is certified for the whole turn without repeated SAT work.
  const enclosedOwn=own.filter(v=>v.id!=='rein').map(v=>v.box.id!=='root-foot'?v:{...v,box:createHeldBox({id:v.box.id,frame:v.box.frame,halfExtents:P(Math.hypot(v.box.halfExtents.x,v.box.halfExtents.y),Math.hypot(v.box.halfExtents.x,v.box.halfExtents.y),v.box.halfExtents.z)})}),mareEnvelope=compileHeldBoxSet(enclosedOwn.filter(v=>v.id==='skein').map(({box})=>({box,ownerId:'skein'})),{id:'stable-own-foot-yaw-envelope'}),ownPairCertified=enclosedOwn.filter(v=>v.id==='inez').every(v=>!heldBoxContacts(v.box,mareEnvelope).length);let intervals=0;
  function at({id,box:b},u){const a=change*u,p=rot(sub(b.frame.origin,root),a),foot=b.id==='root-foot';return createHeldBox({id:b.id,frame:{origin:P(root.x+p.x,root.y+p.y,root.z+p.z),x:foot?b.frame.x:rot(b.frame.x,a),y:foot?b.frame.y:rot(b.frame.y,a),z:foot?b.frame.z:rot(b.frame.z,a)},halfExtents:b.halfExtents});}
  function visit(lo,hi,depth){if(++intervals>8192)return false;const mid=(lo+hi)/2;let possible=false;const enclosed=[];for(let j=0;j<own.length;j++){const current=at(own[j],mid),bound=2*radii[j]*Math.sin(Math.abs(change)*(hi-lo)/4),enclosure=createHeldBox({id:current.id,frame:current.frame,halfExtents:P(...axes.map(k=>current.halfExtents[k]+bound))});enclosed.push({id:own[j].id,box:enclosure});if(!withinWorld(enclosure))possible=true;if(set&&heldBoxContacts(enclosure,set).length)possible=true;}
    // The two owning world-foot boxes keep their world axes while their roots
    // orbit. Therefore own-pair clearance also needs the complete interval;
    // rigid endpoint checks alone are insufficient here.
    if(!ownPairCertified){const mare=compileHeldBoxSet(enclosed.filter(p=>p.id==='skein').map(({box})=>({box,ownerId:'skein'})),{id:'stable-orbital-own-pair'});if(enclosed.filter(p=>p.id==='inez').some(({box})=>heldBoxContacts(box,mare).length))possible=true;}
    if(!possible)return true;if(depth>=60||Math.abs(change)*(hi-lo)<1e-8)return false;return visit(lo,mid,depth+1)&&visit(mid,hi,depth+1);}
  return visit(0,1,0)?{intervals}:null;
}
/** Detached continuous component query. A clear result does not earn watch,
 * elapsed, a stable record, body movement or case activation. */
export function inspectPreparationStableMotion(s,{before,after,geometry,mode}){
  try{
    if(!['approach','grip','west','turn','south'].includes(mode)||!validatePreparationBodyBounds(s,before)||!validatePreparationBodyBounds(s,after)||![2,3].includes(before[0]?.geometryVersion)||before.some(r=>r.geometryVersion!==before[0].geometryVersion)||after.some(r=>r.geometryVersion!==before[0].geometryVersion)||!unchangedOwnPose(before,after)||!Array.isArray(geometry)||!geometry.length||!same(geometry,geometry.map(obstacle)))return null;
    const fixed=otherSolids(before,after,geometry),a=rowFrame(leader(before)),b=rowFrame(leader(after)),m=rowFrame(body(before)),n=rowFrame(body(after));
    if(mode==='approach'){
      if(!same(m,n)||a.point.z!==0||b.point.z!==0)return null;const delta=sub(b.point,a.point),turn=angle(b.facing-a.facing);if(length(delta)>EPS&&Math.abs(turn)>EPS)return null;
      const own=parts(before,'inez',{moving:length(delta)>EPS}),mare=parts(before,'skein'),obstacles=[...fixed,...mare.map(box=>({box,ownerId:'skein'}))];
      if(Math.abs(turn)>EPS){const set=compileHeldBoxSet(obstacles,{id:'stable-approach-turn'}),result=sweepPreparationNativeYaw(leader(before),before,b.facing,set);return result.clear?{mode,departures:[],intervals:result.intervals}:null;}
      const departures=translationClear(own,obstacles,delta);return departures?{mode,departures,intervals:0}:null;
    }
    if(mode==='grip'){
      if(!same(a,b)||!same(m,n)||!pairClear(before,false))return null;
      const hit=gripRows(before),human=createTrainHuman(globalThis.My3D2dge,rowModel(leader(before))),rig=human.rig,pose=preparePreparationStablePose(globalThis.My3D2dge,human,rowModel(leader(before)),rowModel(body(before)),0);
      let start;try{start=rigWorldPoint(rig,pose.root,'handR');}finally{pose.restore();}
      // Every elbow lies within one unchanged upper-arm length of its shoulder.
      // Every lower bone joins that ball to the linearly travelling hand. The
      // convex enclosure covers ALL IK bend branches, not sampled elbows.
      const upper=rig.o.armUpper*rig.o.size*Math.max(Math.abs(1-rig.sq*.4),Math.abs(1+rig.sq)),pad=Math.sqrt(3)*Math.max(2,rig.o.limbW)*rig.o.size,
        lo=P(...axes.map(k=>Math.min(hit.arm[0][k]-upper,start[k],hit.reinEnd[k])-pad)),hi=P(...axes.map(k=>Math.max(hit.arm[0][k]+upper,start[k],hit.reinEnd[k])+pad)),gesture=box('whole-grip-arm',P(...axes.map(k=>(lo[k]+hi[k])/2)),P(...axes.map(k=>(hi[k]-lo[k])/2))),obstacles=[...fixed,...parts(before,'skein').map(box=>({box,ownerId:'skein'}))],set=compileHeldBoxSet(obstacles,{id:'stable-grip-world'});
      if(!withinWorld(gesture)||heldBoxContacts(gesture,set).length)return null;
      // Taking the rein does not move the already parked mare. Its old tail
      // contact is retained as an unresolved overlap; only a later strictly
      // decreasing westward translation can remove it. No other contact is
      // ignored, and turning still requires a fully clear compound.
      const moving=combined(before,false).filter(v=>v.id!=='skein').map(v=>v.box);return translationClear(moving,fixed,P())?{mode,departures:[],intervals:0}:null;
    }
    if(!pairClear(before,true)||!pairClear(after,true))return null;
    const own=combined(before,true);if(mode==='turn'){const change=n.facing-m.facing,c=Math.cos(change),sn=Math.sin(change),relative=sub(a.point,m.point),expected=P(m.point.x+relative.x*c-relative.y*sn,m.point.y+relative.x*sn+relative.y*c,a.point.z);if(Math.abs(change)>Math.PI||distance(m.point,n.point)>EPS||distance(expected,b.point)>EPS||Math.abs(b.facing-a.facing-change)>EPS)return null;const result=orbitalClear(before,n,own,fixed);return result?{mode,departures:[],intervals:result.intervals}:null;}
    if(Math.abs(n.facing-m.facing)>EPS||Math.abs(b.facing-a.facing)>EPS)return null;const delta=sub(n.point,m.point);if(distance(sub(b.point,a.point),delta)>EPS)return null;let departures=[];for(const part of own){const result=translationClear([part.box],fixed,delta,part.id==='skein'&&mode==='west'?{departure:{from:m,to:n}}:{});if(!result)return null;departures.push(...result);}return{mode,departures,intervals:0};
  }catch{return null;}
}
function changes(a,b){return b.filter((r,i)=>!same(r,a[i])).map(r=>copy(r));}
function applyRows(rows,changed){if(!Array.isArray(changed)||new Set(changed.map(r=>r.id)).size!==changed.length)throw new TypeError('Unique body deltas required');const byId=new Map(rows.map(r=>[r.id,r]));for(const r of changed){if(!byId.has(r.id))throw new TypeError('A duty cannot introduce a body');byId.set(r.id,r);}return rows.map(r=>byId.get(r.id));}
function finalRows(record){let rows=record.initial.bodyBounds;for(const step of record.steps)rows=applyRows(rows,step.bodyChanges);return rows;}
function caseFree(rows){const site=TRAIN_PREPARATION_SOLIDS.find(v=>v.id==='ruth-wiring-case-stand'),r=body(rows);return r?.regionId==='snowbound'&&r.volumes.every(v=>!boundsTouch(v,{min:P(site.x,site.y,site.z),max:P(site.x+site.w,site.y+site.h,site.z+site.height)}));}
function currentGuard(s){return s.campaign?.missions?.[RIVAL_ID]?.captivity?.guardId;}
function holdingGuardHere(s){const h=s.entities?.hob,l=s.entities?.levi;return currentGuard(s)==='hob'&&h?.hp>0&&!h.dead&&!h.bound&&!h.mounted&&!h.attachment&&h.regionId==='snowbound'&&l?.hp>0&&l.bound&&l.attachment?.type==='rest'&&l.attachment.targetId===RIVAL_WORLD.camp.holding.id&&l.attachment.regionId==='snowbound'&&Math.abs(h.z||0)<8&&distance(point(h),point(RIVAL_WORLD.camp.holding))<=TRAIN_WATCH_HOLDING_RANGE;}
function leadFrames(old,dt){const m=copy(old.mare),a=copy(old.inez);if(old.phase==='west'){m.point.x=Math.max(LEAD.west.x,m.point.x-LEAD.leadSpeed*dt);}else if(old.phase==='turn'){const d=angle(LEAD.turnFacing-m.facing);m.facing+=Math.sign(d)*Math.min(Math.abs(d),LEAD.turnSpeed*dt);}else if(old.phase==='south')m.point.y=Math.min(LEAD.settle.y,m.point.y+LEAD.leadSpeed*dt);const next=linked(m,old.local,old.facingOffset);m.vx=(m.point.x-old.mare.point.x)/dt;m.vy=(m.point.y-old.mare.point.y)/dt;next.vx=(next.point.x-a.point.x)/dt;next.vy=(next.point.y-a.point.y)/dt;return{inez:next,mare:m};}
function nextPhase(phase,m){return phase==='west'&&m.point.x===LEAD.west.x?'turn':phase==='turn'&&Math.abs(angle(m.facing-LEAD.turnFacing))<EPS?'south':phase==='south'&&m.point.y===LEAD.settle.y?'awaiting-stable-work':phase;}
function stableEntry(s,ctx){
  const p=prep(s),i=s.entities?.inez,m=s.entities?.skein,player=s.entities?.mara;
  if(!active(s)||!p||p.stableDuty!==null||p.work||p.exchange||s.dialog||s.failure||!holdingGuardHere(s)||!p.completed.some(e=>e.kind==='stable'&&e.at<=s.elapsed)||!handFree(i)||!free(m)||m.ownerId!=='levi'||m.owned!==true||m.leading||m.leaderId||distance(point(m),LEAD.source)>EPS||!handFree(player)||distance(point(player),point(i))>80)return null;
  const watch=preparationWatchPrefix(s);if(!watch)return null;
  actualWorld(s,ctx);const rows=capturePreparationBodyBounds(s);if(body(rows)?.binding.type!=='free'||body(rows).regionId!=='snowbound'||leader(rows)?.binding.type!=='free'||leader(rows).regionId!=='snowbound')return null;
  return{watch,rows};
}
export function getPreparationStableInteractions(s,ctx){
  try{if(!stableEntry(s,ctx))return[];const target=s.entities.inez;return[{id:'train:stable-lead-skein',label:'Ask Inez to lead Skein clear of the wiring case',x:target.x,y:target.y,z:target.z||0,distance:distance(point(s.entities.mara),point(target)),priority:1}];}catch{return[];}
}
export function beginPreparationStable(s,ctx){
  try{const entry=stableEntry(s,ctx);if(!entry)return false;const p=prep(s),m=s.entities.skein;p.stableDuty={schema:2,startedAt:s.elapsed,lastAdvancedAt:s.elapsed,watch:copy(entry.watch),phase:'approach',gripSeconds:0,local:null,facingOffset:null,initial:{bodyBounds:entry.rows,mountOwnerId:m.ownerId,mountOwned:m.owned??null},steps:[],leadFinishedAt:null,final:null};rememberDuty(s,p.stableDuty,entry.rows);return true;}catch{return false;}
}
function ownFrames(rows){return{inez:copy(rowFrame(leader(rows))),mare:copy(rowFrame(body(rows)))};}
function rememberDuty(s,r,rows){liveDuties.set(r,{state:s,inez:s.entities.inez,mare:s.entities.skein,at:r.lastAdvancedAt,phase:r.phase,count:r.steps.length,tail:r.steps.at(-1),gripSeconds:r.gripSeconds,startedAt:r.startedAt,finishedAt:r.leadFinishedAt,final:r.final,frames:ownFrames(rows),bodyStamp:stamp(s),rows:copy(rows)});}
function leaseMatches(s,r,live){return live.state===s&&live.inez===s.entities.inez&&live.mare===s.entities.skein&&live.at===r.lastAdvancedAt&&live.phase===r.phase&&live.count===r.steps.length&&live.tail===r.steps.at(-1)&&live.gripSeconds===r.gripSeconds&&live.startedAt===r.startedAt&&live.finishedAt===r.leadFinishedAt&&live.final===r.final;}
function stamp(s){return JSON.stringify(['inez','skein'].map(id=>{const a=s.entities[id];return[frame(a),...['kind','category','rig','r','radius','footRadius','height','fear','bound','restrained','surrendered','pose','crouch','hp','dead','owned','ownerId','leading','leaderId','attachment','support','toolHeld','weaponAction','reloadTimer','holstered','mounted','carrying'].map(k=>a[k])];}));}
function leadBinding(s,r){const m=s.entities.skein,leading=['west','turn','south'].includes(r.phase);return m.owned===true&&(leading?m.leading===true&&m.leaderId==='inez':!m.leading&&!m.leaderId);}
export function stepPreparationStable(s,dt,ctx){
  const r=duty(s);if(!active(s)||!r||r.schema!==2||r.phase==='awaiting-stable-work'||s.dialog||s.failure||!Number.isFinite(dt)||dt<=0||dt>.1||!Number.isFinite(s.elapsed)||s.elapsed<=r.lastAdvancedAt)return false;
  try{
    let lease=liveDuties.get(r);if(!lease){if(!validatePreparationStable(s,r))return false;rememberDuty(s,r,finalRows(r));lease=liveDuties.get(r);}if(!leaseMatches(s,r,lease)||!leadBinding(s,r))return false;
    const geometry=actualWorld(s,ctx),old=lease.rows,live=capturePreparationBodyBounds(s,{geometryVersion:old[0].geometryVersion}),before=ownFrames(old),current=ownFrames(live);if(!same(before,current))return false;
    const start=r.lastAdvancedAt,beforeStamp=stamp(s),wait=()=>{r.steps.push({start,finish:s.elapsed,fromPhase:r.phase,toPhase:r.phase,gripSeconds:r.gripSeconds,local:copy(r.local),facingOffset:r.facingOffset,bodyChanges:changes(old,live),geometry,motion:{mode:'wait'}});r.lastAdvancedAt=s.elapsed;rememberDuty(s,r,live);return false;};
    if(s.elapsed-start>dt+EPS||prep(s).work||prep(s).exchange||!holdingGuardHere(s)||!handFree(s.entities.inez)||!free(s.entities.skein)||s.entities.skein.ownerId!=='levi')return wait();
    const actualDt=s.elapsed-start;let phase=r.phase,next=copy(before),gripSeconds=r.gripSeconds,local=r.local,facingOffset=r.facingOffset;
    if(phase==='approach'){
      const target=linked(before.mare);let shadow=navigationShadows.get(s);if(!shadow){shadow={...s};navigationShadows.set(s,shadow);}Object.assign(shadow,s,{entities:{...s.entities,inez:copy(s.entities.inez)}});followPreparationActor(shadow,'inez',{...target.point,facing:target.facing},LEAD.approachSpeed,actualDt,{worldFor:()=>ctx.worldFor(s)});next.inez=frame(shadow.entities.inez);if(distance(next.inez.point,target.point)<=.051&&Math.abs(angle(next.inez.facing-target.facing))<=1e-6&&next.inez.vx===0&&next.inez.vy===0)phase='grip';
    }else if(phase==='grip'){
      next.inez.vx=next.inez.vy=next.mare.vx=next.mare.vy=0;gripSeconds=Math.min(LEAD.gripSeconds,gripSeconds+actualDt);if(gripSeconds>=LEAD.gripSeconds-EPS){gripSeconds=LEAD.gripSeconds;local=localPoint(makeFrame(next.mare.point,P(Math.cos(next.mare.facing),Math.sin(next.mare.facing))),next.inez.point);facingOffset=next.inez.facing-next.mare.facing;phase='west';}
    }else{next=leadFrames({...before,phase,local,facingOffset},actualDt);phase=nextPhase(phase,next.mare);}
    const shadow={...s,entities:{...s.entities,inez:withFrame(s.entities.inez,next.inez),skein:withFrame(s.entities.skein,next.mare)}},after=capturePreparationBodyBounds(shadow,{geometryVersion:old[0].geometryVersion}),motion=inspectPreparationStableMotion(s,{before:old,after,geometry,mode:r.phase});if(!motion){if(beforeStamp!==stamp(s))throw new Error('Refused lead mutated a body');return wait();}
    const step={start,finish:s.elapsed,fromPhase:r.phase,toPhase:phase,gripSeconds,local:copy(local),facingOffset,bodyChanges:changes(old,after),geometry,motion};
    for(const [id,f]of[['inez',next.inez],['skein',next.mare]]){Object.assign(s.entities[id],f.point,{facing:f.facing,vx:f.vx,vy:f.vy});s.entities[id].route=[];delete s.entities[id].routeTarget;}
    if(['west','turn','south'].includes(phase)){s.entities.skein.leading=true;s.entities.skein.leaderId='inez';}if(phase==='awaiting-stable-work'){s.entities.skein.leading=false;delete s.entities.skein.leaderId;s.entities.inez.vx=s.entities.inez.vy=s.entities.skein.vx=s.entities.skein.vy=0;const settled=capturePreparationBodyBounds(s,{geometryVersion:old[0].geometryVersion});step.bodyChanges=changes(old,settled);r.leadFinishedAt=s.elapsed;r.final={at:s.elapsed,bodyBounds:settled};}
    r.steps.push(step);Object.assign(r,{lastAdvancedAt:s.elapsed,phase,gripSeconds,local:copy(local),facingOffset});rememberDuty(s,r,phase==='awaiting-stable-work'?r.final.bodyBounds:after);return true;
  }catch{return false;}
}
export function validatePreparationStable(s,value,at=s.elapsed){
  try{
    const r=copy(value),p=prep(s);if(!p||!Number.isFinite(at)||at<0||at>s.elapsed||!keys(r,['schema','startedAt','lastAdvancedAt','watch','phase','gripSeconds','local','facingOffset','initial','steps','leadFinishedAt','final'])||r.schema!==2||!Number.isFinite(r.startedAt)||r.startedAt<p.startedAt||r.startedAt>at||!Number.isFinite(r.lastAdvancedAt)||r.lastAdvancedAt<r.startedAt||r.lastAdvancedAt>at||!same(r.watch,preparationWatchPrefix(s,r.startedAt))||!p.completed.some(e=>e.kind==='stable'&&e.at<=r.startedAt)||!keys(r.initial,['bodyBounds','mountOwnerId','mountOwned'])||r.initial.mountOwnerId!=='levi'||r.initial.mountOwned!==true||!validatePreparationBodyBounds(s,r.initial.bodyBounds)||![2,3].includes(r.initial.bodyBounds[0]?.geometryVersion)||!Array.isArray(r.steps))return false;
    let rows=r.initial.bodyBounds,phase='approach',gripSeconds=0,local=null,facingOffset=null,last=r.startedAt;if(distance(body(rows).point,LEAD.source)>EPS||body(rows).binding.type!=='free'||leader(rows).binding.type!=='free')return false;
    for(const step of r.steps){if(!keys(step,['start','finish','fromPhase','toPhase','gripSeconds','local','facingOffset','bodyChanges','geometry','motion'])||step.start!==last||!Number.isFinite(step.finish)||step.finish<=last||step.finish>at||step.fromPhase!==phase||!same(step.geometry,preparationStableWorldGeometry(s,step.finish)))return false;const after=applyRows(rows,step.bodyChanges);if(!validatePreparationBodyBounds(s,after))return false;const a=ownFrames(rows),b=ownFrames(after),dt=step.finish-step.start;let expectedPhase=phase;
      if(same(step.motion,{mode:'wait'})){if(!same(a,b)||step.toPhase!==phase||step.gripSeconds!==gripSeconds||!same(step.local,local)||step.facingOffset!==facingOffset)return false;rows=after;last=step.finish;continue;}
      if(dt>.1+EPS)return false;
      if(phase==='approach'){if(!same(a.mare,b.mare)||distance(a.inez.point,b.inez.point)>LEAD.approachSpeed*dt+EPS||Math.abs(angle(b.inez.facing-a.inez.facing))>2.4*dt+EPS||Math.abs(b.inez.vx-(b.inez.point.x-a.inez.point.x)/dt)>EPS||Math.abs(b.inez.vy-(b.inez.point.y-a.inez.point.y)/dt)>EPS)return false;const target=linked(a.mare);if(step.toPhase==='grip'){if(distance(b.inez.point,target.point)>.051||Math.abs(angle(b.inez.facing-target.facing))>1e-6||b.inez.vx!==0||b.inez.vy!==0)return false;expectedPhase='grip';}}
      else if(phase==='grip'){if(!same(a,b))return false;gripSeconds=Math.min(LEAD.gripSeconds,gripSeconds+dt);if(gripSeconds>=LEAD.gripSeconds-EPS){gripSeconds=LEAD.gripSeconds;local=localPoint(makeFrame(a.mare.point,P(Math.cos(a.mare.facing),Math.sin(a.mare.facing))),a.inez.point);facingOffset=a.inez.facing-a.mare.facing;expectedPhase='west';}}
      else if(['west','turn','south'].includes(phase)){const expected=leadFrames({...a,phase,local,facingOffset},dt);expectedPhase=nextPhase(phase,expected.mare);if(expectedPhase==='awaiting-stable-work'){expected.inez.vx=expected.inez.vy=expected.mare.vx=expected.mare.vy=0;}if(!same(expected,b))return false;}else return false;
      const motion=inspectPreparationStableMotion(s,{before:rows,after,geometry:step.geometry,mode:phase});if(!motion||!same(motion,step.motion)||step.toPhase!==expectedPhase||step.gripSeconds!==gripSeconds||!same(step.local,local)||step.facingOffset!==facingOffset)return false;rows=after;phase=expectedPhase;last=step.finish;
    }
    if(r.phase!==phase||r.lastAdvancedAt!==last||r.gripSeconds!==gripSeconds||!same(r.local,local)||r.facingOffset!==facingOffset)return false;
    if(phase==='awaiting-stable-work')return r.leadFinishedAt===last&&keys(r.final,['at','bodyBounds'])&&r.final.at===last&&same(r.final.bodyBounds,rows)&&caseFree(rows);
    // Later injury, death, a newly occupied hand or ownership transfer may stop
    // future work. Those changes never erase an already earned duty prefix.
    return r.leadFinishedAt===null&&r.final===null&&same(ownFrames(capturePreparationBodyBounds(s,{geometryVersion:rows[0].geometryVersion})),ownFrames(rows));
  }catch{return false;}
}
/** Tack, water and care have not been performed by the lead/check prefix. */
export function completePreparationStable(){return false;}
export function preparationCaseCleared(s,value,at=s.elapsed,{deep=true}={}){
  if(!Number.isFinite(at)||at<0||at>s.elapsed||value?.phase!=='awaiting-stable-work'||!Number.isFinite(value.leadFinishedAt)||value.leadFinishedAt>=at)return false;
  const cached=liveDuties.get(value);if(!deep&&cached&&leaseMatches(s,value,cached))return caseFree(cached.rows);
  if(!validatePreparationStable(s,value)||!caseFree(value.final.bodyBounds))return false;
  if(!cached)rememberDuty(s,value,finalRows(value));return !cached||leaseMatches(s,value,cached);
}
/** A live presentation/navigation lease derives from actual accepted work.
 * Restored records receive the complete replay audit once, then each consumer
 * checks the same live bodies and accepted tail instead of replaying SAT work. */
export function currentPreparationStableLead(s){
  try{const r=duty(s);if(!active(s)||r?.schema!==2||r.phase==='awaiting-stable-work'||!handFree(s.entities.inez)||!free(s.entities.skein)||s.entities.skein.ownerId!=='levi'||!leadBinding(s,r)||!holdingGuardHere(s))return null;
    let live=liveDuties.get(r);if(!live){if(!validatePreparationStable(s,r))return null;rememberDuty(s,r,finalRows(r));live=liveDuties.get(r);}
    if(!leaseMatches(s,r,live)||live.bodyStamp!==stamp(s)||!same(live.frames,{inez:frame(s.entities.inez),mare:frame(s.entities.skein)}))return null;
    return{duty:r,phase:r.phase,inez:s.entities.inez,mare:s.entities.skein,gripProgress:r.phase==='approach'?0:r.phase==='grip'?r.gripSeconds/LEAD.gripSeconds:1};
  }catch{return null;}
}
export function ownsPreparationStableActor(s,id){return ['inez','skein'].includes(id)&&!!currentPreparationStableLead(s);}
