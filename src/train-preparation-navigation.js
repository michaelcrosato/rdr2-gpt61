/** Finite camp NPC navigation against the actual foreign occupied bodies.
 * This owns only a requested free NPC's navigation fields. Native hands,
 * work poses and held objects remain in their respective physical owners.
 */
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {capturePreparationBodyBounds} from './train-preparation-layout.js';
import {followActor} from './campaign-navigation.js';
const EPS=1e-7,copy=structuredClone,stepped=new WeakMap();
export const MAX_PREPARATION_NPC_SPEED=95;
const point=a=>({x:a.x,y:a.y,z:a.z||0}),finitePoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),inside=(p,r)=>p.x>r.x+EPS&&p.x<r.x+r.w-EPS&&p.y>r.y+EPS&&p.y<r.y+r.h-EPS;
function penetration(p,r){return inside(p,r)?Math.min(p.x-r.x,r.x+r.w-p.x,p.y-r.y,r.y+r.h-p.y):0;}
function segmentEnters(a,b,r){
  let lo=0,hi=1;
  for(const [k,min,max]of [['x',r.x+EPS,r.x+r.w-EPS],['y',r.y+EPS,r.y+r.h-EPS]]){
    const v=b[k]-a[k];if(Math.abs(v)<EPS){if(a[k]<=min||a[k]>=max)return false;continue;}
    let t0=(min-a[k])/v,t1=(max-a[k])/v;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>=hi)return false;
  }return hi>0&&lo<1;
}
function decreases(a,b,r){
  const initial=penetration(a,r);if(initial<=0||penetration(b,r)>=initial-EPS)return false;
  const edges=[{d:a.x-r.x,slope:b.x-a.x},{d:r.x+r.w-a.x,slope:a.x-b.x},{d:a.y-r.y,slope:b.y-a.y},{d:r.y+r.h-a.y,slope:a.y-b.y}];
  // The minimum of affine edge distances is concave. A strictly decreasing
  // active edge at the start proves decreasing penetration over this segment.
  return edges.some(e=>e.d<=initial+EPS&&e.slope< -EPS);
}
function within(p,w,r){return p.x>=r&&p.y>=r&&p.x<=w.width-r&&p.y<=w.height-r;}
function configRects(obstacles,radius){return obstacles.map((o,i)=>({id:i,x:o.x-radius,y:o.y-radius,w:o.w+2*radius,h:o.h+2*radius}));}
function legal(a,b,rects,initial){
  for(const r of rects){if(initial.has(r.id)){if(!decreases(a,b,r))return false;}else if(segmentEnters(a,b,r))return false;}return true;
}
function protectedActor(s,id,a){return id==='mara'||id===s.party?.playerId||id===s.campaign?.missions?.[RIVAL_ID]?.captivity?.guardId||!a||a.id!==id||a.category!=='npc'||a.hp<=0||a.dead||a.bound||a.toolHeld||a.mounted||a.attachment||a.carrying||a.weaponAction||a.reloadTimer>0;}
function obstaclesFor(s,id,world,rows){
  const own=rows.find(r=>r.id===id);if(!own||own.regionId!==s.region||own.rootId!==id)return null;
  const obstacles=world.obstacles.map(o=>({...o}));
  for(const body of rows){
    if(body.id===id||body.regionId!==own.regionId)continue;
    for(const [i,b]of body.volumes.entries()){
      if(b.max.z<=own.point.z+EPS||b.min.z>=own.point.z+own.height-EPS)continue;
      obstacles.push({id:`preparation-body:${body.id}:${i}`,kind:'occupied-body',x:b.min.x,y:b.min.y,z:b.min.z,w:b.max.x-b.min.x,h:b.max.y-b.min.y,height:b.max.z-b.min.z});
    }
  }return{own,world:{...world,obstacles}};
}
/** Return actual distance moved; refusal/wait returns0. A state/actor receives
 * at most one movement allowance at one accepted elapsed value. */
export function followPreparationActor(s,id,target,speed,dt,{worldFor}={}){
  const actor=s?.entities?.[id];if(protectedActor(s,id,actor)||s.dialog||s.failure||!finitePoint(target)||!Number.isFinite(speed)||speed<=0||speed>MAX_PREPARATION_NPC_SPEED||!Number.isFinite(dt)||dt<=0||dt>.1||!Number.isFinite(s.elapsed)||typeof worldFor!=='function'||Math.abs((actor.z||0)-target.z)>EPS)return 0;
  let calls=stepped.get(s);if(!calls){calls=new Map();stepped.set(s,calls);}if(calls.get(id)===s.elapsed)return 0;
  let data;
  try{
    const base=worldFor(s);if(!base||!Number.isFinite(base.width)||base.width<=0||!Number.isFinite(base.height)||base.height<=0||!Array.isArray(base.obstacles))return 0;
    const obstacles=copy(base.obstacles);if(obstacles.some(o=>!o||!['x','y','w','h'].every(k=>Number.isFinite(o[k]))||o.w<=0||o.h<=0||!Number.isFinite(o.z??0)||!Number.isFinite(o.height??35)||(o.height??35)<0))return 0;
    data=obstaclesFor(s,id,{...base,obstacles},capturePreparationBodyBounds(s));
  }catch{return 0;}
  if(!data)return 0;const {own,world}=data,radius=own.radius,before=point(actor),rects=configRects(world.obstacles,radius),initial=new Set(rects.filter(r=>inside(before,r)).map(r=>r.id));
  if(!within(before,world,radius))return 0;calls.set(id,s.elapsed);
  let candidate=null;
  if(initial.size){
    const d=distance(before,target),aim=d?Math.atan2(target.y-before.y,target.x-before.x):0,angles=[aim,...Array.from({length:16},(_,i)=>i*Math.PI/8)],step=Math.min(speed*dt,Math.max(d,.1));
    for(const angle of angles){const p={x:before.x+Math.cos(angle)*step,y:before.y+Math.sin(angle)*step,z:before.z};if(within(p,world,radius)&&legal(before,p,rects,initial)){candidate=p;break;}}
    // No shape/pose change is needed to waive an inherited overlap. A legal
    // bounded separation keeps facing and never enters a new foreign volume.
    if(!candidate){actor.vx=0;actor.vy=0;return 0;}
    actor.x=candidate.x;actor.y=candidate.y;actor.vx=(actor.x-before.x)/dt;actor.vy=(actor.y-before.y)/dt;actor.route=[];delete actor.routeTarget;return distance(before,actor);
  }
  const planned={...actor,route:[],routeTarget:undefined};followActor(world,planned,target,speed,dt,.05,radius);candidate=point(planned);
  const corner={x:candidate.x,y:before.y,z:before.z};
  if(!within(candidate,world,radius)||distance(before,candidate)>speed*dt+EPS||!legal(before,corner,rects,new Set())||!legal(corner,candidate,rects,new Set())){actor.vx=0;actor.vy=0;return 0;}
  for(const key of ['x','y','vx','vy','facing'])actor[key]=planned[key];actor.route=copy(planned.route||[]);if(planned.routeTarget)actor.routeTarget=copy(planned.routeTarget);else delete actor.routeTarget;
  return distance(before,actor);
}
