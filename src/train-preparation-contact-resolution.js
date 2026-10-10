/** Continuous native compound translation certificates. Local separation and
 * complete bounded initial-contact episodes have distinct explicit contracts. */
import {compileHeldBoxSet} from './train-held-volume.js';
const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],models=new WeakMap();
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),unit=v=>{const n=Math.hypot(v.x,v.y,v.z);return n?{x:v.x/n,y:v.y/n,z:v.z/n}:null;};
function axesOf(box){return{normals:faces.map(f=>unit(cross(sub(box.vertices[f[1]],box.vertices[f[0]]),sub(box.vertices[f[2]],box.vertices[f[0]])))),edges:edges.map(e=>unit(sub(box.vertices[e[1]],box.vertices[e[0]])))};}
function pairModel(a,b){let map=models.get(a);if(!map){map=new WeakMap();models.set(a,map);}if(map.has(b))return map.get(b);const A=axesOf(a),B=axesOf(b),axes=[...A.normals,...B.normals,...A.edges.flatMap(x=>B.edges.map(y=>unit(cross(x,y))))].filter(Boolean),origin=a.vertices[0],out=[];for(const axis of axes){const x=a.vertices.map(v=>dot(sub(v,origin),axis)),y=b.vertices.map(v=>dot(sub(v,origin),axis));out.push({axis,forward:Math.max(...x)-Math.min(...y),backward:Math.max(...y)-Math.min(...x)});}map.set(b,out);return out;}
function lowerEnvelope(lines){const sorted=lines.sort((a,b)=>b.m-a.m||a.b-b.b),unique=[];for(const l of sorted)if(!unique.length||l.m!==unique.at(-1).m)unique.push(l);const hull=[];for(const line of unique){let start=-Infinity;while(hull.length){const last=hull.at(-1);start=(line.b-last.b)/(last.m-line.m);if(start>last.start)break;hull.pop();}hull.push({...line,start:hull.length?start:-Infinity});}return hull;}
function active(hull,u){let line=hull[0];for(let i=1;i<hull.length&&hull[i].start<=u;i++)line=hull[i];return line;}
const at=(line,u)=>line.b+line.m*u;
const boundsCache=new WeakMap();
function bounds(box){let value=boundsCache.get(box);if(!value){value={min:Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...box.vertices.map(v=>v[k]))])),max:Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(...box.vertices.map(v=>v[k]))]))};boundsCache.set(box,value);}return value;}
function possible(a,b,d){const x=bounds(a),y=bounds(b);return ['x','y','z'].every(k=>x.max[k]+Math.max(0,d[k])>y.min[k]&&x.min[k]+Math.min(0,d[k])<y.max[k]);}
/** The arrays contain owning immutable boxes, not editable source vertices.
 * This is an exact piecewise-linear SAT-depth check within floating precision;
 * the strict variant requires a net worst-depth decrease, or (on a worst-depth
 * plateau) continuously decreasing aggregate native contact depth. The caller
 * separately sweeps every new body and solid and constrains the prospective
 * walking enclosure. No native OBB-union-volume claim is made. */
function inspectTranslation(parts,foreign,delta,strict){
 const A=Array.from(parts),B=Array.from(foreign),d=structuredClone(delta);if(!d||Object.keys(d).length!==3||!['x','y','z'].every(k=>Number.isFinite(d[k])))throw new TypeError('Finite native translation required');compileHeldBoxSet(A.map(box=>({box,ownerId:'moving'})),{id:'resolution-moving'});compileHeldBoxSet(B.map(box=>({box,ownerId:'foreign'})),{id:'resolution-foreign'});
 const hulls=[],cuts=new Set([0,1]);for(const a of A)for(const b of B){if(!possible(a,b,d))continue;const hull=lowerEnvelope(pairModel(a,b).flatMap(v=>{const m=dot(d,v.axis);return[{m,b:v.forward},{m:-m,b:v.backward}];}));hulls.push(hull);for(let i=0;i<hull.length;i++){const l=hull[i],lo=Math.max(0,l.start),hi=Math.min(1,hull[i+1]?.start??Infinity);if(lo>=hi)continue;cuts.add(lo);cuts.add(hi);if(l.m){const zero=-l.b/l.m;if(zero>lo&&zero<hi)cuts.add(zero);}}}
 const depth=u=>Math.max(0,...hulls.map(h=>at(active(h,u),u))),initial=depth(0),padding=1024*Number.EPSILON*(1+Math.max(initial,depth(1),...A.flatMap(p=>p.vertices.flatMap(v=>[Math.abs(v.x),Math.abs(v.y),Math.abs(v.z)])),...B.flatMap(p=>p.vertices.flatMap(v=>[Math.abs(v.x),Math.abs(v.y),Math.abs(v.z)]))));if(!(initial>padding)||depth(1)>initial+padding)return false;const sum=u=>hulls.reduce((n,h)=>n+Math.max(0,at(active(h,u),u)),0),aggregate=strict&&depth(1)>=initial-padding;if(aggregate&&sum(1)>=sum(0)-padding)return false;
 const times=[...cuts].sort((a,b)=>a-b);for(let i=1;i<times.length;i++){const lo=times[i-1],hi=times[i];if(aggregate&&sum(hi)>sum(lo)+padding)return false;const mid=(lo+hi)/2,lines=[{m:0,b:0},...hulls.map(h=>active(h,mid)).filter(l=>at(l,mid)>0)],local=new Set([lo,hi]);for(let a=0;a<lines.length;a++)for(let b=a+1;b<lines.length;b++){const x=lines[a],y=lines[b];if(x.m===y.m)continue;const u=(y.b-x.b)/(x.m-y.m);if(u>lo&&u<hi)local.add(u);}const ts=[...local].sort((a,b)=>a-b);for(let n=1;n<ts.length;n++){const start=Math.max(...lines.map(l=>at(l,ts[n-1]))),finish=Math.max(...lines.map(l=>at(l,ts[n])));if(finish>start+padding)return false;}}
 return true;
}

export const nativeTranslationPenetrationNonIncreasing=(parts,foreign,delta)=>inspectTranslation(parts,foreign,delta,false);
export const nativeTranslationPenetrationDecreases=(parts,foreign,delta)=>inspectTranslation(parts,foreign,delta,true);

/** Owned-horse recovery from an inherited interpenetrating herd only. Each
 * body's depth is its greatest actual native SAT contact depth. The squared
 * sum must decrease continuously; individual old contacts may redistribute.
 * This is a contact-depth metric, not occupied volume. New bodies and all
 * world solids must be independently checked by the movement owner. */
export function nativeHerdTranslationDepthDecreases(parts,foreignBodies,delta,{strict=true}={}){
 const A=Array.from(parts),groups=Array.from(foreignBodies,g=>Array.from(g)),d=structuredClone(delta);
 if(!d||Object.keys(d).length!==3||!['x','y','z'].every(k=>Number.isFinite(d[k]))||typeof strict!=='boolean'||!groups.length)throw new TypeError('Finite herd translation required');
 compileHeldBoxSet(A.map(box=>({box,ownerId:'moving'})),{id:'herd-moving'});
 const cuts=new Set([0,1]),hulls=groups.map((B,i)=>{compileHeldBoxSet(B.map(box=>({box,ownerId:'foreign'})),{id:'herd-foreign:'+i});const out=[];for(const a of A)for(const b of B){if(!possible(a,b,d))continue;const h=lowerEnvelope(pairModel(a,b).flatMap(v=>{const m=dot(d,v.axis);return[{m,b:v.forward},{m:-m,b:v.backward}];}));out.push(h);for(let j=0;j<h.length;j++){const l=h[j],lo=Math.max(0,l.start),hi=Math.min(1,h[j+1]?.start??Infinity);if(lo>=hi)continue;cuts.add(lo);cuts.add(hi);if(l.m){const u=-l.b/l.m;if(u>lo&&u<hi)cuts.add(u);}}}return out;});
 const depth=(hs,u)=>Math.max(0,...hs.map(h=>at(active(h,u),u))),metric=u=>hulls.reduce((n,hs)=>n+depth(hs,u)**2,0),start=metric(0),finish=metric(1),scale=Math.max(1,start,finish),padding=2048*Number.EPSILON*scale;
 if(!(start>padding)||finish>start+padding||strict&&finish>=start-padding)return false;
 // Within each pair-axis interval every pair is affine. Split again wherever
 // the maximum pair for a body changes, then the squared-sum derivative is
 // affine and its two endpoints bound the entire accepted interval.
 const base=[...cuts].sort((a,b)=>a-b);
 for(let i=1;i<base.length;i++){const lo=base[i-1],hi=base[i],mid=(lo+hi)/2,bodyLines=hulls.map(hs=>[{m:0,b:0},...hs.map(h=>active(h,mid))]),local=new Set([lo,hi]);for(const lines of bodyLines)for(let j=0;j<lines.length;j++)for(let k=j+1;k<lines.length;k++){const a=lines[j],b=lines[k];if(a.m===b.m)continue;const u=(b.b-a.b)/(a.m-b.m);if(u>lo&&u<hi)local.add(u);}const times=[...local].sort((a,b)=>a-b);
  for(let j=1;j<times.length;j++){const a=times[j-1],b=times[j],m=(a+b)/2,lines=bodyLines.map(ls=>ls.reduce((best,l)=>at(l,m)>at(best,m)?l:best)),derivative=u=>2*lines.reduce((n,l)=>n+Math.max(0,at(l,u))*l.m,0),tolerance=padding*(1+Math.max(...lines.map(l=>Math.abs(l.m))));if(derivative(a)>tolerance||derivative(b)>tolerance)return false;}
 }
 return true;
}

/** The same rest-native squared per-body depth used to rank already certified
 * owned-horse exits. This never grants clearance or substitutes for a sweep. */
export function nativeHerdTranslationPotential(parts,foreignBodies,delta){
 const A=Array.from(parts),groups=Array.from(foreignBodies,g=>Array.from(g)),d=structuredClone(delta);if(!d||Object.keys(d).length!==3||!['x','y','z'].every(k=>Number.isFinite(d[k]))||!groups.length)throw new TypeError('Finite herd translation required');compileHeldBoxSet(A.map(box=>({box,ownerId:'moving'})),{id:'herd-rank-moving'});
 return groups.reduce((sum,B,i)=>{compileHeldBoxSet(B.map(box=>({box,ownerId:'foreign'})),{id:'herd-rank-foreign:'+i});let depth=0;for(const a of A)for(const b of B){if(!possible(a,b,d))continue;depth=Math.max(depth,Math.min(...pairModel(a,b).flatMap(v=>{const m=dot(d,v.axis);return[v.forward+m,v.backward-m];})));}return sum+depth*depth;},0);
}

/** Certify an ENTIRE finite escape from already overlapping bodies. Local
 * depth may redistribute below the episode's original per-body limits. Every
 * body's contact interval must remain connected to the start, then end clear;
 * a cleared body cannot be touched again. This grants no movement authority:
 * the owner must separately sweep all world/new bodies, preserve the original
 * limits through Save, and check both resting and full walking compounds. */
export function nativeInitialContactEpisode(parts,foreignBodies,delta,{depthLimits=null}={}){
 const A=Array.from(parts),groups=Array.from(foreignBodies,g=>Array.from(g)),d=structuredClone(delta);
 if(!A.length||!groups.length||!d||Object.keys(d).length!==3||!['x','y','z'].every(k=>Number.isFinite(d[k]))||depthLimits!==null&&(!Array.isArray(depthLimits)||depthLimits.length!==groups.length||depthLimits.some(v=>!Number.isFinite(v)||v<0)))throw new TypeError('Finite complete initial-contact episode required');
 compileHeldBoxSet(A.map(box=>({box,ownerId:'moving'})),{id:'episode-moving'});
 const scale=Math.max(1,...A.flatMap(p=>p.vertices.flatMap(v=>['x','y','z'].map(k=>Math.abs(v[k])))),...groups.flatMap(g=>g.flatMap(p=>p.vertices.flatMap(v=>['x','y','z'].map(k=>Math.abs(v[k])))))),padding=2048*Number.EPSILON*scale,uPadding=padding/Math.max(1,Math.hypot(d.x,d.y,d.z)),certificates=[];
 for(const [index,B]of groups.entries()){
  compileHeldBoxSet(B.map(box=>({box,ownerId:'foreign'})),{id:'episode-body:'+index});const hulls=[],cuts=new Set([0,1]),ranges=[];
  for(const a of A)for(const b of B){if(!possible(a,b,d))continue;const lines=pairModel(a,b).flatMap(v=>{const m=dot(d,v.axis);return[{m,b:v.forward},{m:-m,b:v.backward}];}),hull=lowerEnvelope([...lines]);hulls.push(hull);
   for(let j=0;j<hull.length;j++){const lo=Math.max(0,hull[j].start),hi=Math.min(1,hull[j+1]?.start??Infinity);if(lo<hi){cuts.add(lo);cuts.add(hi);}}
   // Each slab inequality is affine. Their intersection is the exact open
   // interior-contact interval of this pair, including every intervening pose.
   let lo=0,hi=1;for(const l of lines){if(l.m===0){if(l.b<=padding){hi=-1;break;}}else if(l.m>0)lo=Math.max(lo,(padding-l.b)/l.m);else hi=Math.min(hi,(padding-l.b)/l.m);}
   if(lo<hi&&hi>0&&lo<1)ranges.push([Math.max(0,lo),Math.min(1,hi)]);
  }
  const depth=u=>Math.max(0,...hulls.map(h=>at(active(h,u),u))),initialDepth=depth(0),limit=depthLimits===null?initialDepth:depthLimits[index],maximumDepth=Math.max(...[...cuts].map(depth));
  if(depthLimits===null&&initialDepth<=padding||initialDepth>limit+padding||maximumDepth>limit+padding||depth(1)>padding)return null;
  // On each pair-axis interval every pair depth is affine; their maximum
  // (and zero) is convex. Its maximum occurs at one of these exact endpoints.
  ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let exitFraction=0;
  if(ranges.length){if(initialDepth<=padding||ranges[0][0]>uPadding)return null;exitFraction=ranges[0][1];for(const range of ranges.slice(1)){if(range[0]>exitFraction+uPadding)return null;exitFraction=Math.max(exitFraction,range[1]);}}
  certificates.push({initialDepth,maximumDepth,limit,exitFraction,axisIntervals:cuts.size-1});
 }
 return{bodies:certificates,initialEnergy:certificates.reduce((n,c)=>n+c.initialDepth*c.initialDepth,0),barrierEnergy:certificates.reduce((n,c)=>n+c.limit*c.limit,0),finalEnergy:0};
}
