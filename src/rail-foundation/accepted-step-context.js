/** Immutable geometry and exact-fraction caches for ONE accepted physics step.
 * Raw public queries still validate raw arrays. No actor state is cached. */
import {EPS,validFrame,interpolateFrame} from './rigid-frame.js';
import {validPlatform,validPlatforms} from './platform-geometry.js';
const snapshots=new WeakSet(),sources=new WeakSet(),sourceDurations=new WeakMap(),contexts=new WeakMap(),arrays=new WeakMap(),platforms=new WeakMap();
export function immutableSnapshot(value){
 if(value===null||typeof value!=='object'){if(typeof value==='function'||typeof value==='symbol')throw new TypeError('Immutable motion data cannot contain a callback');return value;}
 if(snapshots.has(value))return value;
 if(Object.getPrototypeOf(value)!==Object.prototype&&!Array.isArray(value))throw new TypeError('Immutable motion data needs plain records');
 const result=Array.isArray(value)?value.map(immutableSnapshot):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,immutableSnapshot(v)]));Object.freeze(result);snapshots.add(result);return result;
}
/** Snapshot factory capability. Samplers must derive frames solely from their
 * frozen data and private immutable-source caches. Opaque external frameAt
 * closures are intentionally rejected by createAcceptedStepContext. */
export function createImmutableFrameSource(snapshot,sample,dt){
 duration(dt);if(typeof sample!=='function')throw new TypeError('A frame sampler is required');const data=immutableSnapshot(snapshot),cache=new Map();
 const source=u=>{fraction(u);if(!cache.has(u)){const f=sample(data,u);if(!validFrame(f))throw new TypeError('Invalid immutable motion frame');cache.set(u,immutableSnapshot(f));}return cache.get(u);};
 sources.add(source);sourceDurations.set(source,dt);return Object.freeze(source);
}
function fraction(u){if(!Number.isFinite(u)||u<0||u>1)throw new RangeError('Motion fraction outside accepted step');}
function duration(dt){if(!Number.isFinite(dt)||dt<0||dt>.1+EPS)throw new TypeError('Invalid accepted-step duration');}
function matches(a,b){return Math.abs(a-b)<=Number.EPSILON*8*Math.max(1,Math.abs(a),Math.abs(b));}
function meta(input){return contexts.get(input)||arrays.get(input);}
export function acceptedStepPlatforms(input,dt){const m=meta(input);if(!m)return null;if(dt!==undefined){duration(dt);if(!matches(dt,m.dt))throw new RangeError('Query duration differs from immutable accepted step');}return m.platforms;}
export function resolveStepPlatforms(input,dt){const owned=acceptedStepPlatforms(input,dt);if(owned)return owned;if(dt!==undefined)duration(dt);if(!validPlatforms(input))throw new TypeError('Invalid platform geometry');if(dt!==undefined)for(const p of input)assertPlatformDuration(p,dt);return input;}
export function acceptedStepDuration(input){return meta(input)?.dt;}
export const isAcceptedPlatform=p=>platforms.has(p);
export function assertPlatformDuration(p,dt){duration(dt);const m=platforms.get(p),bound=m?.dt??sourceDurations.get(p.frameAt);if(bound!==undefined&&!matches(dt,bound))throw new RangeError('Velocity duration differs from immutable accepted step');}
export function acceptedPlatformById(input,id){const m=meta(input);return m?m.byId.get(id):input.find(p=>p.id===id);}
export function acceptedPlatformMaps(p){const m=platforms.get(p);return m?.lookups||null;}
function equalFrame(a,b){return ['origin','x','y','z'].every(k=>['x','y','z'].every(axis=>a[k][axis]===b[k][axis]));}
function ownedPlatform(p,dt,stats,inherited=null){
 const existing=platforms.get(p)||platforms.get(inherited);if(platforms.has(p)&&matches(existing.dt,dt))return p;if(platforms.has(p)&&!inherited)throw new RangeError('Platform duration differs from immutable accepted step');
 if(!p||typeof p!=='object'||Array.isArray(p))throw new TypeError('Invalid accepted platform geometry');
 const {frameAt:callback,...geometry}=p,data=immutableSnapshot(geometry);
 if(!existing){stats.geometryValidations++;if(!validPlatform({...data,frameAt:callback}))throw new TypeError('Invalid accepted platform geometry');}
 if(callback&&!sources.has(callback))throw new TypeError('Immutable context requires a snapshot frame source; opaque frameAt remains on raw queries');if(callback&&!matches(sourceDurations.get(callback),dt))throw new RangeError('Motion-source duration differs from immutable accepted step');
 const source=callback||createImmutableFrameSource(data,(d,u)=>u===0?d.previousFrame:u===1?d.frame:interpolateFrame(d.previousFrame,d.frame,u),dt);
 if(!equalFrame(source(0),data.previousFrame)||!equalFrame(source(1),data.frame))throw new TypeError('Motion source endpoints differ from platform frames');
 const cache=new Map(),sample=u=>{fraction(u);stats.frameRequests++;if(!cache.has(u)){stats.frameSamples++;cache.set(u,source(u));}return cache.get(u);};sources.add(sample);sourceDurations.set(sample,dt);Object.freeze(sample);
 const result=Object.freeze({...data,frameAt:sample});const surfaceMap=new Map(data.surfaces.map(s=>[s.id,s])),coverMap=new Map(data.cover.map(c=>[c.id,c])),contactMap=new Map((data.contacts||[]).map(c=>[c.id,c]));platforms.set(result,{dt,rootSource:source,stats,lookups:Object.freeze({surface:id=>surfaceMap.get(id),cover:id=>coverMap.get(id),contact:id=>contactMap.get(id)})});return result;
}
function assemble(input,dt,{rootDt=dt,lo=0,hi=1,stats={geometryValidations:0,frameRequests:0,frameSamples:0},rootSources=null,inherited=null,statsGroups=null}={}){
 duration(dt);if(!Array.isArray(input))throw new TypeError('Duplicate or invalid accepted platform identities');
 const records=Object.freeze(input.map(p=>ownedPlatform(p,dt,stats,inherited?.get(p.id))));if(new Set(records.map(p=>p.id)).size!==records.length)throw new TypeError('Duplicate or invalid accepted platform identities');const m={dt,rootDt,lo,hi,stats,platforms:records,byId:new Map(records.map(p=>[p.id,p])),slices:new Map(),rootSources:rootSources||new Map(records.map(p=>[p.id,platforms.get(p).rootSource]))};
 m.statsGroups=new Set([stats,...(statsGroups||[]),...records.map(p=>platforms.get(p).stats)]);
 const context=Object.freeze({dt,platforms:records,slice:(from,to=1)=>sliceAcceptedStep(context,from,to),inspect:()=>{const totals={geometryValidations:0,frameRequests:0,frameSamples:0};for(const group of m.statsGroups)for(const key of Object.keys(totals))totals[key]+=group[key];return Object.freeze({dt,rootDt,rootInterval:Object.freeze([lo,hi]),platformCount:records.length,...totals});}});contexts.set(context,m);arrays.set(records,m);m.context=context;return context;
}
export function createAcceptedStepContext(input,dt){duration(dt);const existing=acceptedStepPlatforms(input,dt);return existing?meta(input).context:assemble(input,dt);}
export function sliceAcceptedStep(input,from,to=1){
 fraction(from);fraction(to);if(to<from)throw new RangeError('Reversed accepted-step slice');const parent=meta(input);if(!parent)throw new TypeError('An accepted-step context is required');const key=from+','+to;if(parent.slices.has(key))return parent.slices.get(key);
 const lo=parent.lo+(parent.hi-parent.lo)*from,hi=parent.lo+(parent.hi-parent.lo)*to,dt=parent.rootDt*(hi-lo),records=parent.platforms.map(p=>{const root=parent.rootSources.get(p.id),source=createImmutableFrameSource({lo,hi},(d,u)=>root(d.lo+(d.hi-d.lo)*u),dt);return{...p,previousFrame:source(0),frame:source(1),frameAt:source};});
 const child=assemble(records,dt,{rootDt:parent.rootDt,lo,hi,stats:parent.stats,rootSources:parent.rootSources,inherited:parent.byId,statsGroups:parent.statsGroups});
 // Future nested slices always address the ORIGINAL accepted root fraction.
 parent.slices.set(key,child);return child;
}
