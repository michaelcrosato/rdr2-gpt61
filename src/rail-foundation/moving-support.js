/** Accepted-step support and moving-volume queries in the same rigid frames.
 * Bodies retain one world position. Only a swept downward contact earns support. */
import {EPS,add,sub,scale,length,mix,dot,worldPoint,worldVector,localPoint,localVector,interpolateFrame,validFrame,validPoint,validBounds,segmentBox} from './rigid-frame.js';
import {validPlatforms} from './platform-geometry.js';
import {acceptedStepPlatforms,resolveStepPlatforms,acceptedPlatformById,acceptedPlatformMaps,isAcceptedPlatform,sliceAcceptedStep,assertPlatformDuration} from './accepted-step-context.js';
const axes=['x','y','z'],zero=()=>({x:0,y:0,z:0}),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export {validPlatforms} from './platform-geometry.js';
export function frameAt(platform,u){if(!Number.isFinite(u)||u<0||u>1)throw new RangeError('Motion fraction outside accepted step');const f=platform.frameAt?platform.frameAt(u):interpolateFrame(platform.previousFrame,platform.frame,u);if(!isAcceptedPlatform(platform)&&!validFrame(f))throw new TypeError('Invalid moving frame');return f;}
export function supportPointVelocity(platform,local,dt,u=1){assertPlatformDuration(platform,dt);if(!Number.isFinite(u)||u<0||u>1)throw new RangeError('Velocity fraction outside accepted step');if(!validPoint(local))throw new TypeError('Invalid velocity local point');if(!dt)return zero();const h=1e-5,lo=Math.max(0,u-h),hi=Math.min(1,u+h);return scale(sub(worldPoint(frameAt(platform,hi),local),worldPoint(frameAt(platform,lo),local)),1/((hi-lo)*dt));}
const xyInside=(p,b,r=0)=>p.x>=b.min.x+r-EPS&&p.x<=b.max.x-r+EPS&&p.y>=b.min.y+r-EPS&&p.y<=b.max.y-r+EPS;
const positionAt=(from,to,u)=>mix(from,to,u);
/** Adaptive relative chords bound nonlinear rigid motion to a small world-unit
 * tolerance. Translation-only paths use exact slabs even at arbitrarily high
 * relative speed; they do not rely on endpoint occupancy or render frames. */
function relativeIntervals(platform,from,to,tolerance=1e-5,shape=null){
 const out=[],at=u=>{const f=frameAt(platform,u);return{p:localPoint(f,positionAt(from,to,u)),f};};let count=0;
 const curveError=(a,b,q,t)=>{let extent=0;if(shape)for(const axis of axes){const d=sub(q.f[axis],mix(a.f[axis],b.f[axis],t)),horizontal=shape.footprint==='circle'?Math.hypot(d.x,d.y):Math.abs(d.x)+Math.abs(d.y);extent=Math.max(extent,shape.radius*horizontal+shape.height/2*Math.abs(d.z));}return length(sub(q.p,mix(a.p,b.p,t)))+extent;};
 function divide(lo,hi,a,b,depth){if(++count>32768)throw new RangeError('Motion needs a smaller accepted step');const mid=(lo+hi)/2,q1=(lo+mid)/2,q3=(mid+hi)/2,m=at(mid),one=at(q1),three=at(q3),error=Math.max(curveError(a,b,m,.5),curveError(a,b,one,.25),curveError(a,b,three,.75));
  if(error>tolerance){if(depth>=22)throw new RangeError('Unresolved motion curvature');divide(lo,mid,a,m,depth+1);divide(mid,hi,m,b,depth+1);}else out.push({lo,hi,a:a.p,b:b.p,error});
 }
 divide(0,1,at(0),at(1),0);return out;
}
function checkQuery(from,to,platforms,dt){if(!validPoint(from)||!validPoint(to)||!Number.isFinite(dt))throw new TypeError('Invalid world query or accepted step');return resolveStepPlatforms(platforms,dt);}
export function sweepLanding(from,to,platforms,dt,{footRadius=0,ignoreInitialSupport=null}={}){
 platforms=checkQuery(from,to,platforms,dt);if(!Number.isFinite(footRadius)||footRadius<0)throw new TypeError('Invalid foot radius');if(!dt)return null;const hits=[];
 for(const platform of platforms)for(const surface of platform.surfaces){const b=surface.bounds,z=b.max.z;if(b.max.x-b.min.x<2*footRadius||b.max.y-b.min.y<2*footRadius)continue;
  for(const interval of relativeIntervals(platform,from,to)){const a=interval.a.z-z,bz=interval.b.z-z;if(a< -EPS||bz>EPS||bz>=a-EPS)continue;
   let lo=interval.lo,hi=interval.hi;for(let n=0;n<40;n++){const u=(lo+hi)/2,d=localPoint(frameAt(platform,u),positionAt(from,to,u)).z-z;if(d>0)lo=u;else hi=u;}const u=(lo+hi)/2,f=frameAt(platform,u),p=localPoint(f,positionAt(from,to,u));
   if(!xyInside(p,b,footRadius)||u<1e-6&&ignoreInitialSupport?.carId===platform.id&&ignoreInitialSupport.surfaceId===surface.id)continue;
   // An actor leaving an edge is not reattached to its old boundary at t=0.
   if(u<1e-6&&!xyInside(localPoint(frameAt(platform,Math.min(1,u+1e-5)),positionAt(from,to,Math.min(1,u+1e-5))),b,footRadius))continue;
   p.z=z;hits.push({carId:platform.id,surfaceId:surface.id,u,local:p,world:worldPoint(f,p),normal:f.z});break;
  }
 }
 return hits.sort((a,b)=>a.u-b.u||a.carId.localeCompare(b.carId)||a.surfaceId.localeCompare(b.surfaceId))[0]||null;
}
function inflation(frame,radius,height,footprint='box'){
 const half=height/2,span=axis=>(footprint==='circle'?Math.hypot(frame[axis].x,frame[axis].y):Math.abs(frame[axis].x)+Math.abs(frame[axis].y))*radius+Math.abs(frame[axis].z)*half;
 return{x:span('x'),y:span('y'),z:span('z')};
}
/** Point projectiles use radius=height=0. The default optional radius/height
 * retains the conservative WORLD-aligned box query. Explicit footprint:'circle'
 * uses the native body's vertical circular cylinder. Local slabs bound either
 * shape conservatively; neither claims exact rounded-corner contact. */
export function sweepMovingCover(from,to,platforms,dt,options={}){return sweepCoverInternal(from,to,platforms,dt,options);}
function sweepCoverInternal(from,to,platforms,dt,{radius=0,height=0,mode='projectile',ignoreFloor=null,footprint='box'}={},deferLanding=null,footFrom=null,footTo=null,footRadius=0){
 platforms=checkQuery(from,to,platforms,dt);if(![radius,height].every(n=>Number.isFinite(n)&&n>=0)||!['projectile','body'].includes(mode)||!['box','circle'].includes(footprint))throw new TypeError('Invalid query shape');if(!dt)return null;const hits=[];
 for(const platform of platforms){if(!platform.cover.some(c=>mode==='body'?c.bodySolid:c.projectileSolid))continue;const intervals=relativeIntervals(platform,from,to,1e-5,{radius,height,footprint});for(const cover of platform.cover){if(!(mode==='body'?cover.bodySolid:cover.projectileSolid)||mode==='body'&&ignoreFloor?.carId===platform.id&&cover.bounds.max.z<=ignoreFloor.localZ+EPS)continue;
  for(const i of intervals){const factors=[frameAt(platform,i.lo),frameAt(platform,(i.lo+i.hi)/2),frameAt(platform,i.hi)].map(f=>inflation(f,radius,height,footprint)),pad=Object.fromEntries(axes.map(k=>[k,Math.max(...factors.map(f=>f[k]))+i.error])),box={min:Object.fromEntries(axes.map(k=>[k,cover.bounds.min[k]-pad[k]])),max:Object.fromEntries(axes.map(k=>[k,cover.bounds.max[k]+pad[k]]))};
   if(mode==='body'&&axes.some(k=>i.a[k]>=box.max[k]-EPS&&i.b[k]>=box.max[k]-EPS||i.a[k]<=box.min[k]+EPS&&i.b[k]<=box.min[k]+EPS))continue;
   const t=segmentBox(i.a,i.b,box);if(t===null)continue;const u=i.lo+(i.hi-i.lo)*t,p=positionAt(from,to,u),f=frameAt(platform,u),local=localPoint(f,p);let face=null,best=Infinity;
   for(const k of axes)for(const sign of[-1,1]){const d=Math.abs(local[k]-(sign<0?box.min[k]:box.max[k]));if(d<best){best=d;face={...zero(),[k]:sign};}}
   const hit={carId:platform.id,volumeId:cover.id,material:cover.material||null,u,world:p,local,normal:worldVector(f,face),tolerance:i.error};if(footFrom&&footOwnedTop(deferLanding,hit,footFrom,footTo,footRadius,platforms))continue;hits.push(hit);break;
  }
 }}return hits.sort((a,b)=>a.u-b.u||a.carId.localeCompare(b.carId)||a.volumeId.localeCompare(b.volumeId))[0]||null;
}
export function validateBodySupport(body,platforms,{previous=false,tolerance=1e-5}={}){
 if(!Number.isFinite(tolerance)||tolerance<0||!body||!validPoint(body)||body.supports!==undefined)return false;try{platforms=resolveStepPlatforms(platforms);}catch{return false;}const s=body.support;if(s==null)return true;
 if(typeof s!=='object'||Array.isArray(s)||Object.keys(s).length!==4||body.attachment||body.onGround!==true||!validPoint(s.local)||!validPoint(s.relativeVelocity)||Math.abs(s.relativeVelocity.z)>EPS)return false;
 const p=acceptedPlatformById(platforms,s.carId),surface=p&&(acceptedPlatformMaps(p)?.surface(s.surfaceId)||p.surfaces.find(v=>v.id===s.surfaceId));if(!surface||!xyInside(s.local,surface.bounds,body.footRadius??body.r??0)||Math.abs(s.local.z-surface.bounds.max.z)>EPS)return false;
 const expected=worldPoint(previous?p.previousFrame:p.frame,s.local);return length(sub(expected,body))<=tolerance;
}
function identify(body,platforms){const p=acceptedPlatformById(platforms,body.support.carId);return{platform:p,surface:acceptedPlatformMaps(p)?.surface(body.support.surfaceId)||p.surfaces.find(s=>s.id===body.support.surfaceId)};}
function setWorld(body,platform,local,relative,dt,u=1){const f=frameAt(platform,u),p=worldPoint(f,local),v=add(supportPointVelocity(platform,local,dt,u),worldVector(f,relative));Object.assign(body,p,{vx:v.x,vy:v.y,vz:v.z,groundZ:p.z,onGround:true});}
export function jumpFromSupport(body,platforms,dt,speed=220){
 try{platforms=resolveStepPlatforms(platforms,dt);}catch{return false;}
 if(!validateBodySupport(body,platforms)||!body.support||!Number.isFinite(speed)||speed<=0||typeof body.jump!=='function')return false;const {platform}=identify(body,platforms),relative=body.support.relativeVelocity,local=body.support.local,f=platform.frame,v=add(supportPointVelocity(platform,local,dt),worldVector(f,relative));
 if(!body.jump(speed))return false;body.support=null;body.vx=v.x;body.vy=v.y;body.vz=v.z+speed;body.onGround=false;return true;
}
function remainingPlatforms(platforms,from){if(acceptedStepPlatforms(platforms))return sliceAcceptedStep(platforms,from).platforms;return platforms.map(p=>({...p,previousFrame:frameAt(p,from),frameAt:u=>frameAt(p,from+(1-from)*u)}));}
function footOwnedTop(landing,cover,from,to,radius,platforms){
 const platform=acceptedPlatformById(platforms,cover.carId),volume=platform.cover.find(c=>c.id===cover.volumeId),f=frameAt(platform,cover.u);
 if(!volume||dot(cover.normal,f.z)<=1-EPS)return false;
 const foot=localPoint(f,positionAt(from,to,cover.u)),surfaces=platform.surfaces.filter(s=>Math.abs(volume.bounds.max.z-s.bounds.max.z)<=EPS&&xyInside(foot,s.bounds,radius));
 for(const surface of surfaces){const z=surface.bounds.max.z;if(localPoint(platform.previousFrame,from).z<z-EPS||foot.z<z-EPS)continue;
  if(landing?.carId===platform.id&&landing.surfaceId===surface.id)return true;
  // The centre-foot solver owns this declared walkable top. A cylinder toe
  // may reach its tilted slab during an earlier step, while the entire root
  // trajectory is still above it. Defer only that top hit; award no support.
  if(relativeIntervals(platform,from,to).every(i=>Math.min(i.a.z,i.b.z)-i.error>=z-EPS))return true;
 }return false;
}
function freeStep(body,platforms,dt,options,preparedVz=null,depth=0){
 if(depth>32)throw new RangeError('Collision sequence needs a smaller accepted step');
 const gravity=body.gravity??700,from={x:body.x,y:body.y,z:body.z},ground=options.groundAt??(()=>0),g0=ground(body.x,body.y,body.r??0,body.z,body.step??2);
 if(body.onGround&&body.z<=g0+.5){body.z=g0;body.vz=0;}else body.onGround=false;
 const vz=preparedVz!==null?preparedVz:body.onGround?0:(body.vz||0)-gravity*dt,to={x:body.x+(body.vx||0)*dt,y:body.y+(body.vy||0)*dt,z:body.z+vz*dt},landing=sweepLanding(from,to,platforms,dt,{footRadius:body.footRadius??body.r??0,ignoreInitialSupport:options.ignoreInitialSupport});
 const h=body.height??0;let cover=sweepMovingCover(add(from,{x:0,y:0,z:h/2}),add(to,{x:0,y:0,z:h/2}),platforms,dt,{radius:body.r??0,height:h,mode:'body',footprint:'circle'});
 if(cover&&footOwnedTop(landing,cover,from,to,body.footRadius??body.r??0,platforms))cover=sweepCoverInternal(add(from,{x:0,y:0,z:h/2}),add(to,{x:0,y:0,z:h/2}),platforms,dt,{radius:body.r??0,height:h,mode:'body',footprint:'circle'},landing,from,to,body.footRadius??body.r??0);
 if(landing&&(!cover||cover.u>=landing.u-1e-5&&dot(cover.normal,landing.normal)>.9)){const platform=acceptedPlatformById(platforms,landing.carId),f=frameAt(platform,landing.u),pv=supportPointVelocity(platform,landing.local,dt,landing.u),relative=localVector(f,sub({x:body.vx||0,y:body.vy||0,z:vz},pv));relative.z=0;
  body.support={carId:landing.carId,surfaceId:landing.surfaceId,local:landing.local,relativeVelocity:relative};body.landed=true;const tail=dt*(1-landing.u);
  setWorld(body,platform,landing.local,relative,dt,landing.u);
  if(tail>1e-10){const after=stepRailBody(body,remainingPlatforms(platforms,landing.u),tail,options);body.landed=true;return{kind:'landed',contact:landing,after};}
  return{kind:'landed',contact:landing};
 }
 if(cover){
  const platform=acceptedPlatformById(platforms,cover.carId),p=positionAt(from,to,cover.u),pv=supportPointVelocity(platform,cover.local,dt,cover.u),incoming={x:body.vx||0,y:body.vy||0,z:vz},relative=sub(incoming,pv),normalSpeed=dot(relative,cover.normal),velocity=sub(incoming,scale(cover.normal,Math.min(0,normalSpeed)));
  // Resolve at actual contact time, then query the remaining path again.
  // Gravity/friction were already applied for this accepted step.
  const contactFrame=frameAt(platform,cover.u),volume=acceptedPlatformMaps(platform)?.cover(cover.volumeId)||platform.cover.find(c=>c.id===cover.volumeId),pad=inflation(contactFrame,body.r??0,h,'circle'),bounds={min:Object.fromEntries(axes.map(k=>[k,volume.bounds.min[k]-pad[k]])),max:Object.fromEntries(axes.map(k=>[k,volume.bounds.max[k]+pad[k]]))};let contact=p,local=localPoint(contactFrame,add(contact,{x:0,y:0,z:h/2}));
  if(axes.every(k=>local[k]>bounds.min[k]&&local[k]<bounds.max[k])){let face=null,best=Infinity;for(const k of axes)for(const sign of[-1,1]){const edge=sign<0?bounds.min[k]:bounds.max[k],distance=Math.abs(local[k]-edge);if(distance<best){best=distance;face={k,sign,edge};}}local[face.k]=face.edge+face.sign*EPS;contact=sub(worldPoint(contactFrame,local),{x:0,y:0,z:h/2});}
  contact=add(contact,scale(cover.normal,cover.tolerance+EPS));Object.assign(body,contact,{vx:velocity.x,vy:velocity.y,vz:velocity.z,hitWall:true});const tail=dt*(1-cover.u);
  if(tail>1e-10){const after=freeStep(body,remainingPlatforms(platforms,cover.u),tail,options,velocity.z,depth+1);body.hitWall=true;return{kind:'cover',contact:cover,after};}
  return{kind:'cover',contact:cover};
 }
 Object.assign(body,to);body.vz=vz;const floor=ground(body.x,body.y,body.r??0,body.z,body.step??2);if(!Number.isFinite(floor))throw new TypeError('Nonfinite static terrain');
 if(body.z<=floor){body.z=floor;body.vz=0;body.onGround=true;body.landed=true;}body.groundZ=floor;return{kind:body.onGround?'ground':'air'};
}
export function stepRailBody(body,platforms,dt,options={}){
 if(!Number.isFinite(dt))throw new TypeError('Invalid native body or fixed step');platforms=resolveStepPlatforms(platforms,dt);
 if(body?.attachment||!validPoint(body)||!['vx','vy','vz','gravity','r','height','footRadius','friction'].every(k=>body[k]===undefined||Number.isFinite(body[k]))||[body.r??0,body.height??0,body.footRadius??0].some(v=>v<0))throw new TypeError('Invalid native body or fixed step');
 if(!dt)return{kind:'paused'};body.landed=false;body.hitWall=false;
 if(!body.support){if(!validateBodySupport(body,platforms))throw new TypeError('Duplicate or invalid support declaration');if(body.friction){const f=Math.exp(-body.friction*dt);body.vx*=f;body.vy*=f;}return freeStep(body,platforms,dt,options);}
 if(!validateBodySupport(body,platforms,{previous:true}))throw new TypeError('Duplicate, detached or unattainable support');
 const {platform,surface}=identify(body,platforms),s=body.support,relative=options.relativeVelocity?{...options.relativeVelocity}:{...s.relativeVelocity};if(!validPoint(relative))throw new TypeError('Nonfinite movement input');
 const rel=options.inputSpace==='world'?localVector(platform.previousFrame,relative):relative;rel.z=0;if(body.friction&&!options.relativeVelocity){const k=Math.exp(-body.friction*dt);rel.x*=k;rel.y*=k;}
 const start={...s.local},end=add(start,scale(rel,dt)),radius=body.footRadius??body.r??0;let exit=1;
 for(const k of['x','y']){const d=end[k]-start[k];if(d>0&&end[k]>surface.bounds.max[k]-radius)exit=Math.min(exit,(surface.bounds.max[k]-radius-start[k])/d);if(d<0&&end[k]<surface.bounds.min[k]+radius)exit=Math.min(exit,(surface.bounds.min[k]+radius-start[k])/d);}
 if(exit<1){const u=clamp(exit,0,1),local=mix(start,end,u);setWorld(body,platform,local,rel,dt,u);body.support=null;body.onGround=false;return freeStep(body,remainingPlatforms(platforms,u),dt*(1-u),{...options,ignoreInitialSupport:{carId:platform.id,surfaceId:surface.id}});}
 const h=body.height??0,from=add(worldPoint(platform.previousFrame,start),{x:0,y:0,z:h/2}),to=add(worldPoint(platform.frame,end),{x:0,y:0,z:h/2}),cover=sweepMovingCover(from,to,platforms,dt,{radius:body.r??0,height:h,mode:'body',footprint:'circle',ignoreFloor:{carId:platform.id,localZ:surface.bounds.max.z}});
 if(cover){s.local=mix(start,end,Math.max(0,cover.u-1e-6));s.relativeVelocity=zero();setWorld(body,platform,s.local,s.relativeVelocity,dt);body.hitWall=true;return{kind:'cover',contact:cover};}
 s.local=end;s.relativeVelocity=rel;setWorld(body,platform,end,rel,dt);return{kind:'supported'};
}

export function worldContact(platform,contactId,u=1){const contact=acceptedPlatformMaps(platform)?.contact(contactId)||platform.contacts?.find(c=>c.id===contactId);if(!contact||!validPoint(contact.local))throw new TypeError('Unknown or invalid physical contact');return worldPoint(frameAt(platform,u),contact.local);}
/** Hand/tool samples must actually sweep through a moving contact's declared
 * world-space tolerance. Returning a contact does not operate a control, grant
 * a rescue, move a climber or acknowledge dialogue. */
export function sweepMovingContact(from,to,platforms,dt,{radius=1,carId=null,contactId=null,kind=null}={}){
 platforms=checkQuery(from,to,platforms,dt);if(!Number.isFinite(radius)||radius<=0)throw new TypeError('Invalid contact tolerance');if(!dt)return null;const hits=[];
 for(const platform of platforms){if(carId&&platform.id!==carId)continue;for(const contact of platform.contacts||[]){if(contactId&&contact.id!==contactId||kind&&contact.kind!==kind)continue;if(!validPoint(contact.local))throw new TypeError('Nonfinite contact geometry');
  for(const i of relativeIntervals(platform,from,to)){const a=sub(i.a,contact.local),d=sub(i.b,i.a),r=radius+i.error,A=dot(d,d),B=2*dot(a,d),C=dot(a,a)-r*r;let t=null;
   if(C<=0)t=0;else if(A>EPS){const discriminant=B*B-4*A*C;if(discriminant>=0){const q=(-B-Math.sqrt(discriminant))/(2*A);if(q>=0&&q<=1)t=q;}}
   if(t===null)continue;const u=i.lo+(i.hi-i.lo)*t,target=worldContact(platform,contact.id,u),hand=positionAt(from,to,u);hits.push({carId:platform.id,contactId:contact.id,kind:contact.kind,u,target,hand,distance:length(sub(target,hand)),tolerance:i.error});break;
  }
 }}return hits.sort((a,b)=>a.u-b.u||a.carId.localeCompare(b.carId)||a.contactId.localeCompare(b.contactId))[0]||null;
}
