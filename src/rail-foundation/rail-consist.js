/** Coherent rail-distance motion, SI forces, and articulated rigid cars.
 * This is a foundation: no mission stages, arrivals, grants, or train unlocks. */
import {EPS,add,sub,scale,length,dot,mix,normalize,makeFrame,worldPoint,validPoint,validFrame,validBounds} from './rigid-frame.js';
import {immutableSnapshot,createImmutableFrameSource} from './accepted-step-context.js';
const compiledSpecs=new WeakSet();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),copy=v=>JSON.parse(JSON.stringify(v));
function at(s,t){if(s.kind==='line')return mix(s.from,s.to,t);const u=1-t;return add(add(scale(s.from,u*u*u),scale(s.c1,3*u*u*t)),add(scale(s.c2,3*u*t*t),scale(s.to,t*t*t)));}
function tangent(s,t){if(s.kind==='line')return normalize(sub(s.to,s.from));const u=1-t;let d=scale(add(add(scale(sub(s.c1,s.from),u*u),scale(sub(s.c2,s.c1),2*u*t)),scale(sub(s.to,s.c2),t*t)),3);if(length(d)<EPS)d=sub(at(s,Math.min(1,t+1e-4)),at(s,Math.max(0,t-1e-4)));return normalize(d);}
function flatten(s,tolerance){
 const table=[{t:0,point:at(s,0),s:0}];
 function split(a,b,depth){const pa=at(s,a),pb=at(s,b),m=(a+b)/2,pm=at(s,m),q1=at(s,(a+m)/2),q3=at(s,(m+b)/2),poly=length(sub(q1,pa))+length(sub(pm,q1))+length(sub(q3,pm))+length(sub(pb,q3));
  if(depth<20&&(poly-length(sub(pb,pa))>tolerance||length(sub(pm,mix(pa,pb,.5)))>tolerance)){split(a,m,depth+1);split(m,b,depth+1);}else table.push({t:b,point:pb,s:0});
 }
 if(s.kind==='line')table.push({t:1,point:at(s,1),s:0});else split(0,1,0);
 for(let i=1;i<table.length;i++)table[i].s=table[i-1].s+length(sub(table[i].point,table[i-1].point));return table;
}
export function createRailPath(spec){
 if(!spec||typeof spec.id!=='string'||!Array.isArray(spec.segments)||!spec.segments.length||new Set(spec.segments.map(s=>s.id)).size!==spec.segments.length)throw new TypeError('Rail path needs unique nonempty segments');
 const tolerance=spec.arcTolerance??.005;if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1)throw new RangeError('Invalid arc tolerance');let cursor=0,previous=null;
 const segments=spec.segments.map(source=>{const s=copy(source);if(typeof s.id!=='string'||!['line','bezier'].includes(s.kind)||![s.from,s.to,...(s.kind==='bezier'?[s.c1,s.c2]:[])].every(validPoint)||length(sub(s.to,s.from))<EPS||!(Number.isFinite(s.maxSpeed)&&s.maxSpeed>0))throw new TypeError('Invalid rail geometry or allowed speed');
  if(previous&&(length(sub(previous.to,s.from))>EPS||dot(tangent(previous,1),tangent(s,0))<.99999))throw new RangeError('Disconnected or kinked rail; author a continuous curve');
  const table=flatten(s,tolerance),len=table.at(-1).s;if(!(len>EPS)||!Number.isFinite(len)||table.some(p=>!validPoint(p.point)||!Number.isFinite(p.s)))throw new RangeError('Zero or nonfinite rail length');const result={...s,table,start:cursor,length:len};cursor+=len;if(!Number.isFinite(cursor))throw new RangeError('Nonfinite total rail length');previous=s;return result;
 });
 if(spec.gauge!==undefined&&(!Number.isFinite(spec.gauge)||spec.gauge<=0))throw new TypeError('Invalid track gauge');return immutableSnapshot({id:spec.id,segments,length:cursor,arcTolerance:tolerance,...(spec.gauge===undefined?{}:{gauge:spec.gauge})});
}
export function sampleRail(path,distance){
 if(!Number.isFinite(distance)||distance<-EPS||distance>path.length+EPS)throw new RangeError('Rail sample outside authored path');const s=path.segments.find(s=>distance<=s.start+s.length+EPS)||path.segments.at(-1),local=clamp(distance-s.start,0,s.length),table=s.table;
 let low=0,high=table.length-1;while(high-low>1){const mid=(low+high)>>1;if(table[mid].s<local)low=mid;else high=mid;}const a=table[low],b=table[high],u=(local-a.s)/Math.max(EPS,b.s-a.s),t=a.t+(b.t-a.t)*u;
 return {frame:makeFrame(at(s,t),tangent(s,t)),segmentId:s.id,maxSpeed:s.maxSpeed,distance};
}
export function validateCarSpecs(cars){
 if(!Array.isArray(cars)||!cars.length||new Set(cars.map(c=>c?.id)).size!==cars.length||!Number.isFinite(cars.reduce((mass,car)=>mass+(car?.mass||0),0)))return false;
 return cars.every(c=>c&&typeof c.id==='string'&&c.id.length>0&&['length','width','mass','wheelRadius'].every(k=>Number.isFinite(c[k])&&c[k]>0)&&Number.isFinite(c.couplerGap)&&c.couplerGap>=0&&[c.frontCoupler,c.rearCoupler].every(validPoint)&&c.frontCoupler.x>=c.length/2-EPS&&c.rearCoupler.x<=-c.length/2+EPS&&[c.surfaces,c.cover,c.contacts].every(Array.isArray)&&new Set(c.surfaces.map(s=>s?.id)).size===c.surfaces.length&&new Set(c.cover.map(s=>s?.id)).size===c.cover.length&&new Set(c.contacts.map(s=>s?.id)).size===c.contacts.length&&c.surfaces.every(s=>s&&typeof s.id==='string'&&validBounds(s.bounds)&&s.bounds.max.x>s.bounds.min.x&&s.bounds.max.y>s.bounds.min.y&&s.oneWay===true)&&c.cover.every(s=>s&&typeof s.id==='string'&&validBounds(s.bounds)&&['x','y','z'].every(k=>s.bounds.max[k]>s.bounds.min[k])&&typeof s.bodySolid==='boolean'&&typeof s.projectileSolid==='boolean')&&c.contacts.every(s=>s&&typeof s.id==='string'&&typeof s.kind==='string'&&validPoint(s.local)));
}
export function compileCarSpecs(specs){const snapshot=immutableSnapshot(specs);if(!validateCarSpecs(snapshot))throw new TypeError('Invalid car identities or geometry');compiledSpecs.add(snapshot);return snapshot;}
export function placeConsist(path,specs,headDistance){if(!validateCarSpecs(specs))throw new TypeError('Invalid car identities or geometry');return placeConsistValidated(path,specs,headDistance);}
function placeConsistValidated(path,specs,headDistance){
 const result=[];
 for(let i=0;i<specs.length;i++){
  const c=specs[i];let cursor=headDistance;
  if(i){const lead=result[i-1],prior=specs[i-1],anchor=lead.rearCoupler;const high=lead.cursor-Math.abs(prior.rearCoupler.x)-c.frontCoupler.x;
   if(high<0)throw new RangeError('Consist tail is outside the authored path');let lo=Math.max(0,high-Math.max(c.couplerGap*4+5,(prior.length+c.length)/2)),hi=high;
   const gap=d=>length(sub(worldPoint(sampleRail(path,d).frame,c.frontCoupler),anchor))-c.couplerGap;
   if(gap(hi)>1e-5||gap(lo)<-1e-5)throw new RangeError('Unattainable coupler on this track');
   for(let n=0;n<60;n++){const m=(lo+hi)/2,stagnant=m===lo||m===hi;if(gap(m)>0)lo=m;else hi=m;if(stagnant)break;}cursor=(lo+hi)/2;
  }
  if(cursor+c.frontCoupler.x>path.length+EPS||cursor+c.rearCoupler.x< -EPS)throw new RangeError('Car endpoints exceed the authored rail');const sample=sampleRail(path,cursor),frame=sample.frame;
  result.push({id:c.id,cursor,frame,frontCoupler:worldPoint(frame,c.frontCoupler),rearCoupler:worldPoint(frame,c.rearCoupler),wheelAngle:0,segmentId:sample.segmentId});
 }
 return result;
}
export const DEFAULT_RAIL_FORCES=Object.freeze({worldUnitsPerMeter:25,tractionForceN:120000,maxBrakeForceN:90000,rollingResistanceN:0,brakeResponseSeconds:.6,gravityMps2:9.81});
function forces(config){const c={...DEFAULT_RAIL_FORCES,...config};if(!['worldUnitsPerMeter','tractionForceN','maxBrakeForceN','rollingResistanceN','brakeResponseSeconds','gravityMps2'].every(k=>Number.isFinite(c[k])&&c[k]>=0)||c.worldUnitsPerMeter<=0||c.maxBrakeForceN<=0)throw new TypeError('Invalid rail units or force');return c;}
export function createConsist(path,specs,{id='rail-consist',cursor,speed=0,brakePressure=0}={}){
 if(!Number.isFinite(speed)||speed<0||!Number.isFinite(brakePressure)||brakePressure<0||brakePressure>1)throw new TypeError('Invalid initial motion');
 return{schema:1,id,pathId:path.id,cursor,speed,brakePressure,time:0,cars:placeConsist(path,specs,cursor)};
}
export function validateConsist(path,specs,state){return validateCarSpecs(specs)&&validateConsistValidated(path,specs,state);}
function validateConsistValidated(path,specs,state){
 try{if(!state||state.schema!==1||state.pathId!==path.id||typeof state.id!=='string'||!Number.isFinite(state.cursor)||!Number.isFinite(state.speed)||state.speed<0||!Number.isFinite(state.time)||state.time<0||!Number.isFinite(state.brakePressure)||state.brakePressure<0||state.brakePressure>1||!Array.isArray(state.cars)||state.cars.length!==specs.length)return false;
  const expected=placeConsistValidated(path,specs,state.cursor);return state.cars.every((car,i)=>car.id===specs[i].id&&validFrame(car.frame)&&Number.isFinite(car.wheelAngle)&&Math.abs(car.cursor-expected[i].cursor)<1e-5&&length(sub(car.frame.origin,expected[i].frame.origin))<1e-5&&['x','y','z'].every(axis=>dot(car.frame[axis],expected[i].frame[axis])>1-1e-7)&&length(sub(car.frontCoupler,expected[i].frontCoupler))<1e-5&&length(sub(car.rearCoupler,expected[i].rearCoupler))<1e-5);
 }catch{return false;}
}
export function advanceConsist(path,specs,state,dt,controls={},configuration={}){
 if(!Number.isFinite(dt)||dt<0||dt>.1+EPS)throw new TypeError('Use a valid accepted fixed step, no larger than 0.1 seconds');
 specs=compiledSpecs.has(specs)?specs:compileCarSpecs(specs);path=immutableSnapshot(path);state=immutableSnapshot(state);if(!validateConsistValidated(path,specs,state))throw new TypeError('Use a valid accepted fixed step, no larger than 0.1 seconds');
 const c=forces(configuration),mass=specs.reduce((m,s)=>m+s.mass,0),rawThrottle=controls.throttle??0,rawBrake=controls.brake??0;
 if(!Number.isFinite(rawThrottle)||!Number.isFinite(rawBrake))throw new TypeError('Nonfinite regulator');const throttle=clamp(rawThrottle,0,1),brake=clamp(rawBrake,0,1);
 if(!Number.isFinite(throttle)||!Number.isFinite(brake))throw new TypeError('Nonfinite regulator');
 if(!dt)return{state:copy(state),platforms:specs.map((car,i)=>({id:car.id,previousFrame:state.cars[i].frame,frame:state.cars[i].frame,surfaces:car.surfaces,cover:car.cover,contacts:car.contacts,frameAt:createImmutableFrameSource({frame:state.cars[i].frame},d=>d.frame,0)})),physics:{massKg:mass,travel:0,stopTime:null,pressureStart:state.brakePressure,pressureEnd:state.brakePressure},hazards:[]};
 const grade=state.cars.reduce((g,car,i)=>g+car.frame.x.z*specs[i].mass,0)/mass;
 const base=(throttle*c.tractionForceN-c.maxBrakeForceN*brake-c.rollingResistanceN)/mass*c.worldUnitsPerMeter-c.gravityMps2*grade*c.worldUnitsPerMeter;
 const transient=c.brakeResponseSeconds>0?-c.maxBrakeForceN/mass*c.worldUnitsPerMeter*(state.brakePressure-brake):0,tau=c.brakeResponseSeconds;
 if(!Number.isFinite(base)||!Number.isFinite(transient))throw new RangeError('Nonfinite derived rail force');
 const pressure=t=>tau?brake+(state.brakePressure-brake)*Math.exp(-t/tau):brake;
 const velocity=t=>state.speed+base*t+(tau?transient*tau*(1-Math.exp(-t/tau)):0);
 const distance=t=>state.speed*t+.5*base*t*t+(tau?transient*tau*(t-tau*(1-Math.exp(-t/tau))):0);
 if(![velocity(dt),distance(dt),pressure(dt)].every(Number.isFinite))throw new RangeError('Nonfinite derived rail motion');
 const acceleration=t=>base+(tau?transient*Math.exp(-t/tau):0);
 const ratio=transient&&tau?-base/transient:0,turn=ratio>0?-tau*Math.log(ratio):null;
 const increasing=transient<0&&tau>0,forceTurn=increasing&&turn!==null&&turn>=0&&turn<=dt?turn:null;
 const resetVelocity=(t,start)=>base*(t-start)+(tau?transient*tau*(Math.exp(-start/tau)-Math.exp(-t/tau)):0);
 const resetDistance=(t,start)=>.5*base*(t-start)**2+(tau?transient*tau*(Math.exp(-start/tau)*(t-start)-tau*(Math.exp(-start/tau)-Math.exp(-t/tau))):0);
 let stopTime=null,restartTime=null,stoppedDistance=0;
 const startsHeld=state.speed===0&&acceleration(0)<=0&&!(increasing&&acceleration(0)===0);
 if(startsHeld){stopTime=0;restartTime=forceTurn!==null&&acceleration(dt)>0?forceTurn:null;}
 else{
  // A released brake can make v(t) dip below zero and recover before dt.
  // Its acceleration turning point, not just the endpoint, bounds the first stop.
  const minimumTime=forceTurn??dt;
  if(velocity(minimumTime)<0){let lo=0,hi=minimumTime;for(let n=0;n<60;n++){const m=(lo+hi)/2;if(velocity(m)>0)lo=m;else hi=m;}stopTime=(lo+hi)/2;stoppedDistance=Math.max(0,distance(stopTime));restartTime=forceTurn!==null&&forceTurn>=stopTime&&acceleration(dt)>0?forceTurn:null;}
 }
 const travelAt=t=>stopTime===null||t<=stopTime?Math.max(0,distance(t)):stoppedDistance+(restartTime!==null&&t>restartTime?Math.max(0,resetDistance(t,restartTime)):0);
 const speedAt=t=>stopTime===null||t<stopTime?Math.max(0,velocity(t)):restartTime!==null&&t>restartTime?Math.max(0,resetVelocity(t,restartTime)):0;
 const travel=travelAt(dt),newCursor=state.cursor+travel,cars=placeConsistValidated(path,specs,newCursor);
 const next={...state,cursor:newCursor,speed:speedAt(dt),brakePressure:pressure(dt),time:state.time+dt,cars:cars.map((car,i)=>({...car,wheelAngle:state.cars[i].wheelAngle+(car.cursor-state.cars[i].cursor)/specs[i].wheelRadius}))};
 const poses=new Map([[0,state.cars],[1,immutableSnapshot(next.cars)]]),atFraction=u=>{if(!Number.isFinite(u)||u<0||u>1)throw new RangeError('Motion fraction outside accepted step');if(!poses.has(u))poses.set(u,placeConsistValidated(path,specs,state.cursor+travelAt(dt*u)));return poses.get(u);};
 const platforms=specs.map((car,i)=>({id:car.id,previousFrame:state.cars[i].frame,frame:next.cars[i].frame,surfaces:car.surfaces,cover:car.cover,contacts:car.contacts,frameAt:createImmutableFrameSource({},(_,u)=>atFraction(u)[i].frame,dt)}));
 return{state:next,platforms,physics:{massKg:mass,grade,travel,stopTime,restartTime,motionPolicy:'hold-at-zero-until-force-positive',forceAccelerationWorld:base,pressureStart:state.brakePressure,pressureEnd:next.brakePressure},hazards:next.speed>sampleRail(path,next.cursor).maxSpeed?[{kind:'overspeed',speed:next.speed,allowed:sampleRail(path,next.cursor).maxSpeed}]:[]};
}
