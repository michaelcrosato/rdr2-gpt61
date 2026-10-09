/** Engine-native rigid world/local geometry. Camera projection owns no physics. */
import '../../my-3d2dge-agent.js';
const V=globalThis.My3D2dge.V3;
export const EPS=1e-7;
export const vector=p=>[p.x,p.y,p.z];
export const point=v=>({x:v[0],y:v[1],z:v[2]});
export const add=(a,b)=>point(V.add(vector(a),vector(b)));
export const sub=(a,b)=>point(V.sub(vector(a),vector(b)));
export const scale=(a,n)=>point(V.mul(vector(a),n));
export const dot=(a,b)=>V.dot(vector(a),vector(b));
export const length=a=>V.len(vector(a));
export const normalize=a=>{if(length(a)<EPS)throw new RangeError('Zero direction');return point(V.norm(vector(a)));};
export const mix=(a,b,u)=>point(V.lerp(vector(a),vector(b),u));
export const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const validPoint=p=>!!p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
export function makeFrame(origin,forward,upHint={x:0,y:0,z:1}){
 if(!validPoint(origin)||!validPoint(forward)||!validPoint(upHint))throw new TypeError('Nonfinite frame geometry');
 const x=normalize(forward),y=normalize(cross(upHint,x)),z=normalize(cross(x,y));
 return {origin:{...origin},x,y,z};
}
export function validFrame(f){return !!f&&[f.origin,f.x,f.y,f.z].every(validPoint)&&[f.x,f.y,f.z].every(a=>Math.abs(length(a)-1)<EPS)&&Math.abs(dot(f.x,f.y))+Math.abs(dot(f.x,f.z))+Math.abs(dot(f.y,f.z))<EPS&&dot(cross(f.x,f.y),f.z)>1-EPS;}
export function worldVector(f,v){return add(add(scale(f.x,v.x),scale(f.y,v.y)),scale(f.z,v.z));}
export const worldPoint=(f,p)=>add(f.origin,worldVector(f,p));
export const localVector=(f,v)=>({x:dot(v,f.x),y:dot(v,f.y),z:dot(v,f.z)});
export const localPoint=(f,p)=>localVector(f,sub(p,f.origin));
function quaternion(f){
 const m=[f.x.x,f.y.x,f.z.x,f.x.y,f.y.y,f.z.y,f.x.z,f.y.z,f.z.z],trace=m[0]+m[4]+m[8];let q;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[s/4,(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s];}
 else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[(m[7]-m[5])/s,s/4,(m[1]+m[3])/s,(m[2]+m[6])/s];}
 else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[2]-m[6])/s,(m[1]+m[3])/s,s/4,(m[5]+m[7])/s];}
 else{const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[3]-m[1])/s,(m[2]+m[6])/s,(m[5]+m[7])/s,s/4];}
 const n=Math.hypot(...q);return q.map(v=>v/n);
}
function shortest(a,b){return a.reduce((s,v,i)=>s+v*b[i],0)<0?b.map(v=>-v):b;}
function rotation(q){const[w,x,y,z]=q;return{x:{x:1-2*(y*y+z*z),y:2*(x*y+w*z),z:2*(x*z-w*y)},y:{x:2*(x*y-w*z),y:1-2*(x*x+z*z),z:2*(y*z+w*x)},z:{x:2*(x*z+w*y),y:2*(y*z-w*x),z:1-2*(x*x+y*y)}};}
export function interpolateFrame(a,b,u){
 if(!validFrame(a)||!validFrame(b)||!Number.isFinite(u)||u<0||u>1)throw new TypeError('Invalid rigid interpolation');
 const qa=quaternion(a),qb=shortest(qa,quaternion(b)),d=Math.max(-1,Math.min(1,qa.reduce((s,v,i)=>s+v*qb[i],0)));let q;
 if(d>.9995){q=qa.map((v,i)=>v+(qb[i]-v)*u);const n=Math.hypot(...q);q=q.map(v=>v/n);}
 else{const angle=Math.acos(d),sin=Math.sin(angle);q=qa.map((v,i)=>(v*Math.sin((1-u)*angle)+qb[i]*Math.sin(u*angle))/sin);}
 return{origin:mix(a.origin,b.origin,u),...rotation(q)};
}
export function rotationAngle(a,b){const qa=quaternion(a),qb=shortest(qa,quaternion(b));return 2*Math.acos(Math.min(1,Math.abs(qa.reduce((s,v,i)=>s+v*qb[i],0))));}
export function pointVelocity(a,b,local,dt,u=1){
 if(!(dt>0))return{x:0,y:0,z:0};
 // SLERP has constant world angular velocity. A centred difference evaluates
 // its rotational contribution at the requested point, including grade.
 const h=1e-5,lo=Math.max(0,u-h),hi=Math.min(1,u+h);
 return scale(sub(worldPoint(interpolateFrame(a,b,hi),local),worldPoint(interpolateFrame(a,b,lo),local)),1/((hi-lo)*dt));
}
export const validBounds=b=>!!b&&validPoint(b.min)&&validPoint(b.max)&&['x','y','z'].every(k=>b.max[k]>=b.min[k]);
export function insideBounds(p,b,margin=0){return ['x','y','z'].every(k=>p[k]>=b.min[k]+margin-EPS&&p[k]<=b.max[k]-margin+EPS);}
export function segmentBox(a,b,box,radius=0){
 let enter=0,leave=1;const d=sub(b,a);
 for(const k of['x','y','z']){const low=box.min[k]-radius,high=box.max[k]+radius;if(Math.abs(d[k])<EPS){if(a[k]<low-EPS||a[k]>high+EPS)return null;continue;}let u=(low-a[k])/d[k],v=(high-a[k])/d[k];if(u>v)[u,v]=[v,u];enter=Math.max(enter,u);leave=Math.min(leave,v);if(enter>leave+EPS)return null;}
 return enter>=-EPS&&enter<=1+EPS?Math.max(0,Math.min(1,enter)):null;
}
