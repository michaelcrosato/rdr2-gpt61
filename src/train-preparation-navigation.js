/** Finite camp NPC navigation against the actual foreign occupied bodies.
 * This owns only a requested free NPC's navigation fields. Native hands,
 * work poses and held objects remain in their respective physical owners.
 */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {capturePreparationBodyBounds} from './train-preparation-layout.js';
import {blockedAt} from './campaign-navigation.js';
import {preparationNativeBodyParts,preparationPartBounds,sweepPreparationNativeYaw,sweepPreparationCompoundYaw} from './train-preparation-body-geometry.js';
import {createHeldBox,translateHeldBox,createHeldBoxMotion,compileHeldBoxSet,heldBoxContacts,sweepHeldBox} from './train-held-volume.js';
import {preparationWatchFixture} from './train-preparation-watch.js';
import {nativeTranslationPenetrationNonIncreasing,nativeTranslationPenetrationDecreases,nativeHerdTranslationDepthDecreases,nativeHerdTranslationPotential} from './train-preparation-contact-resolution.js';
import {makeFrame} from './rail-foundation/rigid-frame.js';
import {ownsPreparationCopperRecoveryActor} from './train-preparation-copper-recovery.js';
const EPS=1e-7,copy=structuredClone,stepped=new WeakMap(),routes=new WeakMap(),turns=new WeakMap(),solidCache=new Map(),approaches=new WeakMap(),recoveryWaits=new WeakMap(),corridors=new WeakMap(),corridorGrids=new Map();
const OWNED_MOUNT=Symbol('owned-Copper-follow');
export const MAX_PREPARATION_NPC_SPEED=95;
/** Shared accepted-frame reservation for fixed movement owners. This grants
 * no movement or collision exception; every owner still proves its own step. */
export function claimPreparationMovementFrame(s,id){
 if(!s||!Number.isFinite(s.elapsed)||typeof id!=='string'||s.entities?.[id]?.id!==id)return false;let calls=stepped.get(s);if(!calls){calls=new Map();stepped.set(s,calls);}if(calls.get(id)===s.elapsed)return false;calls.set(id,s.elapsed);return true;
}
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
function protectedActor(s,id,a,guardTurn=false){return id==='mara'||id===s.party?.playerId||!guardTurn&&id===s.campaign?.missions?.[RIVAL_ID]?.captivity?.guardId||!a||a.id!==id||a.category!=='npc'||a.hp<=0||a.dead||a.bound||a.toolHeld||a.mounted||a.attachment||a.carrying||a.weaponAction||a.reloadTimer>0;}
function intersectsBounds(a,b,r,h){return a.x+r>b.min.x+EPS&&a.x-r<b.max.x-EPS&&a.y+r>b.min.y+EPS&&a.y-r<b.max.y-EPS&&a.z+h>b.min.z+EPS&&a.z<b.max.z-EPS;}
function translatePart(part,delta){return delta.x===0&&delta.y===0&&delta.z===0?part:translateHeldBox(part,delta);}
function overallBounds(boxes){return{min:Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...boxes.map(b=>b.min[k]))])),max:Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(...boxes.map(b=>b.max[k]))]))};}
function worldSolids(obstacles){const key=JSON.stringify(obstacles);if(solidCache.has(key))return solidCache.get(key);const out=[];for(const [i,o]of obstacles.entries()){const height=o.height??35;if(height===0)continue;const box=createHeldBox({id:'solid:'+i,frame:makeFrame({x:o.x+o.w/2,y:o.y+o.h/2,z:(o.z||0)+height/2},{x:1,y:0,z:0}),halfExtents:{x:o.w/2,y:o.h/2,z:height/2}}),body={id:'world-solid:'+i,volumes:[preparationPartBounds(box)]},set=compileHeldBoxSet([{box,ownerId:body.id}],{id:body.id});out.push({body,set,parts:[box],bounds:body.volumes[0]});}if(solidCache.size>=32)solidCache.delete(solidCache.keys().next().value);solidCache.set(key,out);return out;}
function obstaclesFor(s,id,world,rows,compound=false,restPotential=false){
 const own=rows.find(r=>r.id===id);if(!own||own.regionId!==s.region||own.rootId!==id)return null;
 const members=compound?rows.filter(row=>row.rootId===id):[own],walkingRows=compound?rows.map(row=>row.rootId===id?{...row,pose:{...row.pose,vx:1,vy:0}}:row):rows,combined=(source,all)=>source.flatMap(row=>preparationNativeBodyParts(row,all).map(part=>createHeldBox({id:row.id+':'+part.id,frame:part.frame,halfExtents:part.halfExtents}))),parts=compound?combined(members,rows):preparationNativeBodyParts(restPotential?{...own,pose:{...own.pose,vx:0,vy:0}}:own,rows),walkingRow={...own,pose:{...own.pose,vx:1,vy:0}},movingParts=compound?combined(walkingRows.filter(row=>row.rootId===id),walkingRows):preparationNativeBodyParts(walkingRow,rows),movingBounds=movingParts.map(preparationPartBounds),actualBounds=parts.map(preparationPartBounds),actualAABB=overallBounds(actualBounds),movingAABB=overallBounds(movingBounds),bodies=[];
 for(const body of rows){if(body.id===id||compound&&body.rootId===id||body.regionId!==own.regionId)continue;const item={body,set:null,initial:false,bounds:overallBounds(body.volumes)};if(boundsIntersect(actualAABB,item.bounds))item.initial=parts.some(part=>heldBoxContacts(part,nativeSet(item,rows)).some(hit=>hit.interiorOverlap));bodies.push(item);}
 for(const template of worldSolids(world.obstacles))bodies.push({...template,solid:true,initial:boundsIntersect(actualAABB,template.bounds)&&parts.some(part=>heldBoxContacts(part,template.set).some(hit=>hit.interiorOverlap))});
 return{own,bodies,rows,parts,movingParts,movingAABB,world,base:world};
}
function boundsIntersect(a,b){return ['x','y','z'].every(k=>a.max[k]>b.min[k]+EPS&&a.min[k]<b.max[k]-EPS);}
function nativeSet(item,rows){if(!item.set){const parts=preparationNativeBodyParts(item.body,rows);item.parts=parts;item.set=compileHeldBoxSet(parts.map(box=>({box,ownerId:item.body.id})),{id:'navigation:'+item.body.id});}return item.set;}
function nativeLegal(a,b,data){const {own,bodies,rows,movingParts,movingAABB}=data,offset={x:a.x-own.point.x,y:a.y-own.point.y,z:0},delta={x:b.x-own.point.x,y:b.y-own.point.y,z:0},swept={min:{x:movingAABB.min.x+Math.min(offset.x,delta.x),y:movingAABB.min.y+Math.min(offset.y,delta.y),z:movingAABB.min.z},max:{x:movingAABB.max.x+Math.max(offset.x,delta.x),y:movingAABB.max.y+Math.max(offset.y,delta.y),z:movingAABB.max.z}};
 if(swept.min.x<0||swept.min.y<0||swept.max.x>data.world.width||swept.max.y>data.world.height)return false;
 const inheritedHerd=data.ownedRecovery?bodies.filter(item=>item.initial&&!item.solid):[],movement={x:b.x-a.x,y:b.y-a.y,z:0};if(inheritedHerd.length){for(const item of inheritedHerd)nativeSet(item,rows);const groups=inheritedHerd.map(item=>item.parts);if(!nativeHerdTranslationDepthDecreases(data.parts.map(p=>translatePart(p,offset)),groups,movement))return false;}
 let motions=null;return bodies.every(item=>{if(!boundsIntersect(swept,item.bounds))return true;if(item.initial){if(data.ownedRecovery&&!item.solid)return true;nativeSet(item,rows);return nativeTranslationPenetrationDecreases(data.parts.map(p=>translatePart(p,offset)),item.parts,movement)&&nativeTranslationPenetrationNonIncreasing(movingParts.map(p=>translatePart(p,offset)),item.parts,movement);}const set=nativeSet(item,rows);motions??=movingParts.map(part=>createHeldBoxMotion(translatePart(part,offset),translatePart(part,delta)));return motions.every(motion=>sweepHeldBox(motion,set,{contactMode:'interior'}).clear);});
}
function ownedFollowTarget(s,data){const caller=point(s.entities.mara),before=data.own.point,bearing=Math.atan2(before.y-caller.y,before.x-caller.x),stop=82,rects=configRects(data.world.obstacles,data.own.radius);for(let i=0;i<32;i++){const offset=Math.ceil(i/2)*Math.PI/16*(i%2?1:-1),angle=bearing+offset,p={x:caller.x+Math.cos(angle)*stop,y:caller.y+Math.sin(angle)*stop,z:before.z,facing:angle+Math.PI},future=prospectiveFacingData(data,p,p.facing);future.ownedRecovery=false;if(within(p,data.world,data.own.radius)&&legal(p,p,rects,new Set())&&nativeLegal(p,p,future))return p;}return null;}
/** Static foot-space route proposals retain a long doorway detour while the
 * bounded native search checks its next waypoint against ALL current bodies.
 * Neither this cache nor a proposed cell authorizes movement. */
function worldCorridor(world,before,target,radius,rects){
 const size=20,cols=Math.ceil(world.width/size),height=Math.ceil(world.height/size),count=cols*height;if(!Number.isSafeInteger(count)||count<=0||count>1000000)return[];
 const key=JSON.stringify([world.width,world.height,world.obstacles,radius]);let grid=corridorGrids.get(key);if(!grid){grid=new Uint8Array(count);for(let n=0;n<count;n++)grid[n]=!blockedAt(world,n%cols*size+size/2,Math.floor(n/cols)*size+size/2,radius);if(corridorGrids.size>=8)corridorGrids.delete(corridorGrids.keys().next().value);corridorGrids.set(key,grid);}
 const at=n=>({x:n%cols*size+size/2,y:Math.floor(n/cols)*size+size/2,z:before.z}),closest=p=>{const cx=Math.floor(p.x/size),cy=Math.floor(p.y/size);let best=null,distance=Infinity;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy,n=y*cols+x;if(x<0||x>=cols||y<0||y>=height||!grid[n])continue;const q=at(n),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance&&legal(p,q,rects,new Set())){best=n;distance=d;}}return best;};
 const start=closest(before),end=closest(target);if(start===null||end===null)return[];const previous=new Int32Array(count).fill(-1),queue=new Int32Array(count);let head=0,tail=1;queue[0]=start;previous[start]=start;
 while(head<tail&&previous[end]<0){const n=queue[head++],a=at(n);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=n%cols+dx,y=Math.floor(n/cols)+dy,next=y*cols+x;if(x<0||x>=cols||y<0||y>=height||!grid[next]||previous[next]>=0||!legal(a,at(next),rects,new Set()))continue;previous[next]=n;queue[tail++]=next;}}
 if(previous[end]<0)return[];const points=[copy(target)];for(let n=end;n!==start;n=previous[n])points.push(at(n));points.push(at(start));return points.reverse();
}
function corridorTarget(s,id,before,target,data,rects,safe){
 if(distance(before,target)<=60||safe(before,target))return target;
 const r=data.own.radius,bodyEnvelopes=data.bodies.filter(item=>!item.solid).map(item=>({id:'corridor-body:'+item.body.id,x:item.bounds.min.x,y:item.bounds.min.y,w:item.bounds.max.x-item.bounds.min.x,h:item.bounds.max.y-item.bounds.min.y})).filter(o=>!inside(before,{x:o.x-r,y:o.y-r,w:o.w+2*r,h:o.h+2*r})),guideWorld={...data.world,obstacles:[...data.world.obstacles,...bodyEnvelopes]};
 // A coarse envelope containing the starting root may contain empty native
 // space. It is omitted ONLY from proposals; actual native checks retain it.
 let byId=corridors.get(s);if(!byId){byId=new Map();corridors.set(s,byId);}const key=JSON.stringify([target,guideWorld.width,guideWorld.height,guideWorld.obstacles,r]);let saved=byId.get(id);if(!saved||saved.key!==key){saved={key,points:worldCorridor(guideWorld,before,target,r,configRects(guideWorld.obstacles,r))};byId.set(id,saved);}
 while(saved.points.length&&distance(before,saved.points[0])<20)saved.points.shift();const next=saved.points[0];if(!next)return target;
 const candidates=[next];for(const amount of[2.5,5,7.5,10,12.5,15])for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])candidates.push({x:next.x+dx*amount,y:next.y+dy*amount,z:next.z});return candidates.find(p=>within(p,data.world,data.own.radius)&&legal(p,p,rects,new Set())&&safe(p,p))||target;
}
function nativeRoute(s,id,before,target,data,rects){
 const {own,bodies,rows,world}=data,r=own.radius,size=5,cols=Math.ceil(world.width/size),height=Math.ceil(world.height/size),cell=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size),point=n=>({x:n%cols*size+size/2,y:Math.floor(n/cols)*size+size/2,z:before.z});
 const safe=(a,b)=>{const corner={x:b.x,y:a.y,z:a.z};return within(b,world,r)&&legal(a,b,rects,new Set())&&legal(a,corner,rects,new Set())&&legal(corner,b,rects,new Set())&&nativeLegal(a,b,data)&&nativeLegal(a,corner,data)&&nativeLegal(corner,b,data);};
 target=corridorTarget(s,id,before,target,data,rects,safe);
 const key=JSON.stringify({target,facing:own.pose.facing,obstacles:world.obstacles});let cache=routes.get(s);if(!cache){cache=new Map();routes.set(s,cache);}let entry=cache.get(id);
 if(entry?.key===key){while(entry.points.length&&distance(before,entry.points[0])<.06)entry.points.shift();if(entry.points.length&&safe(before,entry.points[0]))return entry.points[0];}
 // The caller checked the declared arrival pose. A remote destination can
 // need a later turn; retain only actual current-pose-safe waypoints here.
 if(safe(before,target)){cache.set(id,{key,points:[copy(target)]});return target;}
 const available=new Map(),edges=new Map(),valid=n=>{if(n<0||n>=cols*height)return false;if(!available.has(n)){const p=point(n);available.set(n,!blockedAt(world,p.x,p.y,r)&&safe(p,p));}return available.get(n);},edge=(a,b)=>{const k=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(k))edges.set(k,safe(point(a),point(b)));return edges.get(k);};
 const seed=cell(before),candidates=[];for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=seed%cols+dx,y=Math.floor(seed/cols)+dy,n=y*cols+x;if(x>=0&&x<cols&&y>=0&&y<height&&valid(n)&&safe(before,point(n)))candidates.push(n);}candidates.sort((a,b)=>distance(before,point(a))-distance(before,point(b)));
 if(!candidates.length)return null;const start=candidates[0],previous=new Map([[start,null]]),costs=new Map([[start,0]]),closed=new Set(),open=[],heuristic=n=>Math.abs(point(n).x-target.x)+Math.abs(point(n).y-target.y),less=(a,b)=>a.f<b.f||a.f===b.f&&a.h<b.h;
 const push=(n,g)=>{const h=heuristic(n),entry={n,g,h,f:g+h};open.push(entry);for(let i=open.length-1;i>0;){const p=(i-1)>>1;if(!less(open[i],open[p]))break;[open[i],open[p]]=[open[p],open[i]];i=p;}},pop=()=>{const first=open[0],last=open.pop();if(open.length){open[0]=last;for(let i=0;;){const l=i*2+1,r=l+1;let next=i;if(l<open.length&&less(open[l],open[next]))next=l;if(r<open.length&&less(open[r],open[next]))next=r;if(next===i)break;[open[i],open[next]]=[open[next],open[i]];i=next;}}return first;};push(start,0);let end=null;
 while(open.length&&closed.size<64){const {n,g}=pop();if(closed.has(n)||g!==costs.get(n))continue;closed.add(n);const p=point(n);if(distance(p,target)<=50&&safe(p,target)){end=n;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=n%cols+dx,y=Math.floor(n/cols)+dy,next=y*cols+x,newCost=g+size;if(x<0||x>=cols||y<0||y>=height||closed.has(next)||newCost>=(costs.get(next)??Infinity)||!valid(next)||!edge(n,next))continue;costs.set(next,newCost);previous.set(next,n);push(next,newCost);}}

 const complete=end!==null;if(!complete){while(open.length){const next=pop();if(!closed.has(next.n)&&next.g===costs.get(next.n)){end=next.n;break;}}}if(end===null)return null;const path=complete?[copy(target)]:[];for(let n=end;n!==null;n=previous.get(n))path.push(point(n));path.reverse();while(path.length&&distance(before,path[0])<.06)path.shift();cache.set(id,{key,points:path});return path[0]||target;
}
function nearbyTurnSet(data,row){const parts=preparationNativeBodyParts(row,data.rows),radius=Math.max(...parts.flatMap(p=>p.vertices.map(v=>Math.hypot(v.x-row.point.x,v.y-row.point.y)))),top=Math.max(...parts.map(p=>preparationPartBounds(p).max.z)),references=[];for(const item of data.bodies){if(!intersectsBounds(row.point,item.bounds,radius,top-row.point.z))continue;nativeSet(item,data.rows);references.push(...item.parts.map(box=>({box,ownerId:item.body.id})));}if(!references.length){const item=data.bodies[0];nativeSet(item,data.rows);references.push(...item.parts.map(box=>({box,ownerId:item.body.id})));}return compileHeldBoxSet(references,{id:'preparation-route-yaw'});}
function clearWholeTurn(data,p,toFacing){const row={...data.own,point:copy(p),pose:{...data.own.pose,vx:0,vy:0}},from=row.pose.facing,delta=Math.atan2(Math.sin(toFacing-from),Math.cos(toFacing-from));return sweepPreparationNativeYaw(row,data.rows,from+delta,nearbyTurnSet(data,row)).clear;}
function prospectiveFacingData(data,p,facing){const own={...data.own,point:copy(p),pose:{...data.own.pose,facing,vx:1,vy:0}},parts=preparationNativeBodyParts(own,data.rows);return{...data,own,parts,movingParts:parts,movingAABB:overallBounds(parts.map(preparationPartBounds)),bodies:data.bodies.map(item=>({...item,initial:false}))};}
function approachForFacing(s,id,target,data,rects){
 if(!Number.isFinite(target.facing))return null;const actor=s.entities[id],key=JSON.stringify(target);let byId=approaches.get(s);if(!byId){byId=new Map();approaches.set(s,byId);}let saved=byId.get(id);if(saved?.key!==key){byId.delete(id);saved=null;}
 const difference=Math.abs(Math.atan2(Math.sin(target.facing-(actor.facing||0)),Math.cos(target.facing-(actor.facing||0))));if(difference<=1e-6){byId.delete(id);return null;}if(!saved&&distance(actor,target)>60)return null;
 if(!saved){const before=point(actor),canLeave=p=>{const future=prospectiveFacingData(data,p,target.facing),corner={x:target.x,y:p.y,z:p.z};return nativeLegal(p,p,future)&&legal(p,corner,rects,new Set())&&legal(corner,target,rects,new Set())&&nativeLegal(p,corner,future)&&nativeLegal(corner,target,future);};
  if(clearWholeTurn(data,before,target.facing)&&canLeave(before)){saved={key,point:before};byId.set(id,saved);}else{const bearing=Math.atan2(target.y-before.y,target.x-before.x),candidates=[{x:target.x,y:before.y,z:before.z},{x:before.x,y:target.y,z:before.z}];for(const radius of [16,32,48])for(let i=0;i<16;i++){const angle=bearing+i*Math.PI/8;candidates.push({x:before.x+Math.cos(angle)*radius,y:before.y+Math.sin(angle)*radius,z:before.z});}
   const clear=candidates.filter(p=>distance(before,p)>.05&&within(p,data.world,data.own.radius)&&legal(before,p,rects,new Set())&&nativeLegal(before,p,data)&&clearWholeTurn(data,p,target.facing)&&canLeave(p));clear.sort((a,b)=>distance(before,a)+distance(a,target)-distance(before,b)-distance(b,target));if(clear.length){saved={key,point:clear[0]};byId.set(id,saved);}}
 }
 // Preserve the actual escape facing while translating to this waypoint.
 // Only arrival here permits the requested final turn, never pose credit.
 return saved?.point||null;
}
function turnForRoute(s,id,target,dt,data,precise=false){
 const actor=s.entities[id],from=actor.facing||0,key=JSON.stringify([point(actor),target]);let byId=turns.get(s);if(!byId){byId=new Map();turns.set(s,byId);}let state=byId.get(id);if(!state||state.key!==key){state={key,index:0,direction:null};byId.set(id,state);}
 actor.vx=0;actor.vy=0;const row={...data.own,pose:{...data.own.pose,vx:0,vy:0}},parts=preparationNativeBodyParts(row,data.rows),radius=Math.max(...parts.flatMap(p=>p.vertices.map(v=>Math.hypot(v.x-row.point.x,v.y-row.point.y)))),solids=[];
 for(const item of data.bodies){if(!item.body.volumes.some(v=>intersectsBounds(row.point,v,radius,Math.max(...parts.map(p=>preparationPartBounds(p).max.z))-row.point.z)))continue;nativeSet(item,data.rows);solids.push(...item.parts.map(box=>({box,ownerId:item.body.id})));}
 if(!solids.length){const item=data.bodies[0];nativeSet(item,data.rows);solids.push(...item.parts.map(box=>({box,ownerId:item.body.id})));}const set=compileHeldBoxSet(solids,{id:'preparation-route-turn'}),bearing=Math.atan2(target.y-actor.y,target.x-actor.x),headings=precise?[target.facing]:[...(Number.isFinite(target.facing)?[target.facing]:[]),bearing,bearing-Math.PI/2,bearing+Math.PI/2,bearing+Math.PI];
 for(;state.index<headings.length;state.index++,state.direction=null){const angle=headings[state.index],wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),short=wrap(angle-from);if(Math.abs(short)<1e-6)continue;const direction=state.direction||Math.sign(short);for(const sign of state.direction?[direction]:[direction,-direction]){const remaining=sign>0?(angle-from)%(2*Math.PI):(from-angle)%(2*Math.PI),left=(remaining+2*Math.PI)%(2*Math.PI),amount=Math.min(2.4*dt,left),end=from+sign*amount,result=sweepPreparationNativeYaw(row,data.rows,end,set);if(result.clear){actor.facing=end;state.direction=sign;if(amount>=left-1e-7){state.index++;state.direction=null;}actor.route=[];delete actor.routeTarget;return true;}}}
 return false;
}
/** Return actual distance moved; refusal/wait returns0. A state/actor receives
 * at most one movement allowance at one accepted elapsed value. */
function followPreparedBody(s,id,target,speed,dt,{worldFor}={},authority=null){
  const actor=s?.entities?.[id];if((authority!==OWNED_MOUNT&&protectedActor(s,id,actor))||s.dialog||s.failure||!finitePoint(target)||target.facing!==undefined&&!Number.isFinite(target.facing)||!Number.isFinite(speed)||speed<=0||speed>MAX_PREPARATION_NPC_SPEED||!Number.isFinite(dt)||dt<=0||dt>.1||!Number.isFinite(s.elapsed)||typeof worldFor!=='function'||Math.abs((actor.z||0)-target.z)>EPS)return 0;
  let calls=stepped.get(s);if(!calls){calls=new Map();stepped.set(s,calls);}if(calls.get(id)===s.elapsed)return 0;
  let data;
  try{
    const base=worldFor(s);if(!base||!Number.isFinite(base.width)||base.width<=0||!Number.isFinite(base.height)||base.height<=0||!Array.isArray(base.obstacles))return 0;
    const obstacles=copy(base.obstacles);if(obstacles.some(o=>!o||!['x','y','w','h'].every(k=>Number.isFinite(o[k]))||o.w<=0||o.h<=0||!Number.isFinite(o.z??0)||!Number.isFinite(o.height??35)||(o.height??35)<0))return 0;
    data=obstaclesFor(s,id,{...base,obstacles},capturePreparationBodyBounds(s),false,authority===OWNED_MOUNT);
  }catch{return 0;}
  if(!data)return 0;data.ownedRecovery=authority===OWNED_MOUNT;const {own,world,base,bodies,rows}=data,radius=own.radius,before=point(actor),rects=configRects(base.obstacles,radius),initial=new Set(rects.filter(r=>inside(before,r)).map(r=>r.id)),inherited=initial.size||bodies.some(b=>b.initial);
  if(authority===OWNED_MOUNT&&distance(actor,s.entities.mara)>82){const clear=ownedFollowTarget(s,data);if(!clear)return 0;target=clear;}
  if(!within(before,world,radius))return 0;calls.set(id,s.elapsed);
  let candidate=null;
  if(distance(before,target)<=.05&&(!Number.isFinite(target.facing)||Math.abs(Math.atan2(Math.sin(target.facing-(actor.facing||0)),Math.cos(target.facing-(actor.facing||0))))<=1e-6)){actor.vx=0;actor.vy=0;return 0;}
  if(inherited){
    const d=distance(before,target),aim=d?Math.atan2(target.y-before.y,target.x-before.x):0,angles=[aim,...Array.from({length:32},(_,i)=>i*Math.PI/16)],step=Math.min(speed*dt,Math.max(d,.1));
    let waiting,key;if(authority===OWNED_MOUNT){waiting=recoveryWaits.get(s);if(!waiting){waiting=new Map();recoveryWaits.set(s,waiting);}const near={min:{x:data.movingAABB.min.x-step,y:data.movingAABB.min.y-step,z:data.movingAABB.min.z},max:{x:data.movingAABB.max.x+step,y:data.movingAABB.max.y+step,z:data.movingAABB.max.z}};key=JSON.stringify([before,target,speed,dt,own.pose,world.obstacles,bodies.filter(item=>boundsIntersect(near,item.bounds)).map(item=>item.body)]);if(waiting.get(id)===key){actor.vx=actor.vy=0;return 0;}}
    const herd=authority===OWNED_MOUNT?bodies.filter(item=>item.initial&&!item.solid):[];for(const item of herd)nativeSet(item,rows);let bestPotential=Infinity;
    for(const length of authority===OWNED_MOUNT?[step,step/2,step/4,step/8,Math.min(step,.25),Math.min(step,.1)]:[step]){for(const angle of angles){const p={x:before.x+Math.cos(angle)*length,y:before.y+Math.sin(angle)*length,z:before.z};if(!within(p,world,radius)||!legal(before,p,rects,initial)||!nativeLegal(before,p,data))continue;if(authority!==OWNED_MOUNT){candidate=p;break;}const potential=herd.length?nativeHerdTranslationPotential(data.parts,herd.map(item=>item.parts),{x:p.x-before.x,y:p.y-before.y,z:0}):0;if(potential<bestPotential){bestPotential=potential;candidate=p;}}if(candidate)break;}

    // Fixed facing avoids a recovery step changing the inherited footprint.
    if(!candidate){if(waiting)waiting.set(id,key);actor.vx=0;actor.vy=0;return 0;}if(waiting)waiting.delete(id);
    actor.x=candidate.x;actor.y=candidate.y;actor.vx=(actor.x-before.x)/dt;actor.vy=(actor.y-before.y)/dt;actor.route=[];delete actor.routeTarget;return distance(before,actor);
  }
  const staging=approachForFacing(s,id,target,data,rects);if(staging&&distance(before,staging)<=.05){turnForRoute(s,id,{...before,facing:target.facing},dt,data,true);return 0;}
  // A temporarily occupied destination is a wait, not evidence that this
  // actor should rotate its currently clear footprint into nearby bodies.
  // An authored arrival includes its final facing. A wider travel footprint
  // at that point must not prevent the separately checked turn toward a
  // clear arrival; actual translation still uses the current full body.
  const navigationTarget=staging||target,destinationData=Number.isFinite(navigationTarget.facing)?prospectiveFacingData(data,navigationTarget,navigationTarget.facing):{...data,bodies:bodies.map(item=>({...item,initial:false}))};destinationData.ownedRecovery=false;if(!nativeLegal(navigationTarget,navigationTarget,destinationData)){actor.vx=0;actor.vy=0;return 0;}
  const goal=nativeRoute(s,id,before,navigationTarget,data,rects);if(!goal){turnForRoute(s,id,target,dt,data);actor.vx=0;actor.vy=0;return 0;}const d=distance(before,goal),travel=Math.min(speed*dt,d);candidate={x:before.x+(d?(goal.x-before.x)/d*travel:0),y:before.y+(d?(goal.y-before.y)/d*travel:0),z:before.z};
 const corner={x:candidate.x,y:before.y,z:before.z};if(!within(candidate,base,radius)||!legal(before,candidate,rects,new Set())||!legal(before,corner,rects,new Set())||!legal(corner,candidate,rects,new Set())||!nativeLegal(before,candidate,data)||!nativeLegal(before,corner,data)||!nativeLegal(corner,candidate,data)){actor.vx=0;actor.vy=0;return 0;}
  actor.x=candidate.x;actor.y=candidate.y;actor.vx=(actor.x-before.x)/dt;actor.vy=(actor.y-before.y)/dt;actor.route=[];delete actor.routeTarget;
  return distance(before,actor);
}

/** Only the actual outgoing keeper may acknowledge a requested watch relief.
 * Its root never moves; the finite yaw uses the same one-frame NPC allowance. */
export function facePreparationWatchGuard(s,id,dt,{worldFor}={}){
 try{const work=s?.campaign?.missions?.[TRAIN_ID]?.train?.preparation?.work,actor=s?.entities?.[id],saved=work?.watchFixture;
  if(work?.kind!=='watch'||!saved||id!==work.args.fromActorId||id!==s.campaign.missions[RIVAL_ID].captivity.guardId||protectedActor(s,id,actor,true)||s.dialog||s.failure||!Number.isFinite(dt)||dt<=0||dt>.1||typeof worldFor!=='function'||!Number.isFinite(s.elapsed))return false;
  const fixture=preparationWatchFixture(saved.anchor,saved.rotation,work.args.fromActorId,work.args.toActorId),role=fixture?.actors[id];if(!role||distance(actor,saved.anchor)>1e-7)return false;let calls=stepped.get(s);if(!calls){calls=new Map();stepped.set(s,calls);}if(calls.get(id)===s.elapsed)return false;calls.set(id,s.elapsed);const world=worldFor(s);if(!world||!Array.isArray(world.obstacles))return false;const data=obstaclesFor(s,id,world,capturePreparationBodyBounds(s));return data&&turnForRoute(s,id,{...point(actor),facing:role.pose.facing},dt,data,true);
 }catch{return false;}
}

/** Free NPC entry retains its original exclusions, including every mount. */
export function followPreparationActor(s,id,target,speed,dt,ctx){return followPreparedBody(s,id,target,speed,dt,ctx);}
/** Only the canonical owned Copper can answer the existing follow command.
 * No actor is spawned, healed, re-owned, loaded, mounted or repositioned. */
export function followPreparationOwnedMount(s,dt,{worldFor}={}){
 const r=s?.campaign?.missions?.[TRAIN_ID],id=s?.party?.mountId,h=s?.entities?.[id],p=s?.entities?.mara;
 if(ownsPreparationCopperRecoveryActor(s,id))return 0;
 if(s?.campaign?.activeMissionId!==TRAIN_ID||s.region!=='snowbound'||r?.train?.preparationVersion!==1||id!=='copper'||s.party.playerId!=='mara'||!h||h.id!==id||h.kind!=='horse'||h.owned!==true||h.following!==true||h.hitched||h.hidden||h.departed||h.hp<=0||h.dead||h.bound||h.toolHeld||h.attachment||!p||p.hp<=0||p.mounted||p.attachment||Object.values(s.entities).some(a=>a.id!==id&&(a.attachment?.targetId===id||a.mounted&&a.mountId===id)))return 0;
 if(!Number.isFinite(dt)||dt<=0||dt>.1||!Number.isFinite(s.elapsed)||typeof worldFor!=='function')return 0;const caller=point(p),d=distance(h,caller),stop=82;if(d<=stop)return followPreparedBody(s,id,point(h),95,dt,{worldFor},OWNED_MOUNT);const target={x:caller.x+(h.x-caller.x)/d*stop,y:caller.y+(h.y-caller.y)/d*stop,z:h.z||0,facing:Math.atan2(caller.y-h.y,caller.x-h.x)};return followPreparedBody(s,id,target,95,dt,{worldFor},OWNED_MOUNT);
}

/** Canonical on-ground Mara/Copper control. The accepted mount action must
 * establish the root binding first; this never repairs an invalid source. */
export function stepPreparationMounted(s,dt,input,speed,{worldFor}={}){
 const r=s?.campaign?.missions?.[TRAIN_ID],h=s?.entities?.copper,p=s?.entities?.mara,axes=['x','y','z'];
 if(ownsPreparationCopperRecoveryActor(s,'copper'))return 0;
 if(s?.version!==5||s.region!=='snowbound'||s.campaign.activeMissionId!==TRAIN_ID||r?.status!=='active'||r.mission.stage!==2||r.train?.runtimeVersion!==1||s.party?.playerId!=='mara'||s.party.mountId!=='copper'||s.dialog||s.failure||!h||h.id!=='copper'||h.category!=='mount'||h.owned!==true||h.hp<=0||h.dead||h.hidden||h.departed||h.hitched||h.attachment||h.support||h.toolHeld||h.bound||h.regionId!=='snowbound'||!p||p.id!=='mara'||p.category!=='player'||p.hp<=0||p.dead||p.mounted!==true||p.mountId!=='copper'||p.regionId!=='snowbound'||p.attachment||p.support||p.carrying||p.toolHeld||p.weaponAction||p.reloadTimer>0||!finitePoint(point(h))||!finitePoint(point(p))||h.z!==0||p.z!==0||axes.some(k=>Math.abs(point(h)[k]-point(p)[k])>EPS)||!Number.isFinite(h.facing)||!Number.isFinite(p.facing)||Math.abs(Math.atan2(Math.sin(h.facing-p.facing),Math.cos(h.facing-p.facing)))>EPS||Object.values(s.entities).some(a=>a.id!=='mara'&&a.id!=='copper'&&(a.attachment?.targetId==='copper'||a.mounted&&a.mountId==='copper'))||!Number.isFinite(dt)||dt<=0||dt>.1||!Number.isFinite(s.elapsed)||!Number.isFinite(speed)||speed<=0||speed>230||!input||Object.keys(input).some(k=>!['mx','my'].includes(k))||!['mx','my'].every(k=>Number.isFinite(input[k])&&Math.abs(input[k])<=1)||typeof worldFor!=='function')return 0;
 let calls=stepped.get(s);if(!calls){calls=new Map();stepped.set(s,calls);}if(calls.get('copper')===s.elapsed||calls.get('mara')===s.elapsed)return 0;
 let data;try{const raw=worldFor(s),obstacles=copy(raw.obstacles);if(raw.id!=='snowbound'||!Number.isFinite(raw.width)||!Number.isFinite(raw.height)||obstacles.some(o=>!o||!['x','y','w','h'].every(k=>Number.isFinite(o[k]))||o.w<=0||o.h<=0||!Number.isFinite(o.z??0)||!Number.isFinite(o.height??35)||(o.height??35)<0))return 0;data=obstaclesFor(s,'copper',{...raw,obstacles},capturePreparationBodyBounds(s),true);}catch{return 0;}
 if(!data||data.bodies.some(item=>item.initial)||data.parts.some(part=>part.vertices.some(v=>v.x<0||v.y<0||v.x>data.world.width||v.y>data.world.height)))return 0;calls.set('copper',s.elapsed);calls.set('mara',s.elapsed);h.vx=h.vy=p.vx=p.vy=0;
 const length=Math.hypot(input.mx,input.my);if(length===0)return 0;const mx=input.mx/Math.max(1,length),my=input.my/Math.max(1,length),angle=Math.atan2(my,mx),difference=Math.atan2(Math.sin(angle-h.facing),Math.cos(angle-h.facing));
 if(Math.abs(difference)>1e-6){const end=h.facing+Math.sign(difference)*Math.min(Math.abs(difference),2.4*dt),references=[],radius=Math.max(...data.parts.flatMap(part=>part.vertices.map(v=>Math.hypot(v.x-h.x,v.y-h.y)))),top=Math.max(...data.parts.flatMap(part=>part.vertices.map(v=>v.z)));for(const item of data.bodies){if(!intersectsBounds(point(h),item.bounds,radius,top-h.z))continue;nativeSet(item,data.rows);references.push(...item.parts.map(box=>({box,ownerId:item.body.id})));}
  for(const [id,x,y,hx,hy]of [['west',-512,data.world.height/2,512,data.world.height/2+512],['east',data.world.width+512,data.world.height/2,512,data.world.height/2+512],['north',data.world.width/2,-512,data.world.width/2+512,512],['south',data.world.width/2,data.world.height+512,data.world.width/2+512,512]])references.push({box:createHeldBox({id:'boundary-'+id,frame:makeFrame({x,y,z:256},{x:1,y:0,z:0}),halfExtents:{x:hx,y:hy,z:512}}),ownerId:'world-boundary'});
  try{if(!sweepPreparationCompoundYaw(s,'copper',end,compileHeldBoxSet(references,{id:'mounted-camp-yaw'})).clear)return 0;}catch{return 0;}h.facing=p.facing=end;return 0;}
 const before=point(h),candidate={x:h.x+mx*speed*dt,y:h.y+my*speed*dt,z:h.z},rects=configRects(data.world.obstacles,data.own.radius);if(!within(candidate,data.world,data.own.radius)||!legal(before,candidate,rects,new Set())||!nativeLegal(before,candidate,data))return 0;
 h.x=p.x=candidate.x;h.y=p.y=candidate.y;h.vx=p.vx=(candidate.x-before.x)/dt;h.vy=p.vy=(candidate.y-before.y)/dt;h.route=[];p.route=[];delete h.routeTarget;delete p.routeTarget;return distance(before,candidate);
}
