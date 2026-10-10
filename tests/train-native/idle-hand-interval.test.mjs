import test from 'node:test';
import assert from 'node:assert/strict';
import '../../my-3d2dge-agent.js';
import {createTrainHuman,prepareTrainPose,rigWorldPoint} from '../../src/train-native/rigs.js';
import {captureNativeGroundLocomotion,applyNativeGroundLocomotion} from '../../src/train-native/locomotion-state.js';
import {inspectNativeIdleHandInterval as inspect} from '../../src/train-native/idle-hand-interval.js';
import {createHeldBox,compileHeldBoxSet,heldBoxContacts} from '../../src/train-held-volume.js';
import {makeFrame,localPoint} from '../../src/rail-foundation/rigid-frame.js';
import * as Camp from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_CHARGE_HALF_EXTENTS} from '../../content/campaign/train-equipment.js';
const E=My3D2dge,axes=['x','y','z'],copy=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z}),distance=(a,b)=>Math.hypot(...axes.map(k=>a[k]-b[k]));
const actor=(id='ruth',facing=0,crouch=false)=>({id,x:750,y:1247,z:0,facing,vx:0,vy:0,hp:100,holstered:true,crouch,pose:crouch?'crouch':'stand'});
function motion(body,clock){const h=createTrainHuman(E,body),r=h.rig;r.update(0,body);r.t=clock;r.phase=.31;r.mv=[1,0];r.spW=r.sq=r.sqV=0;r.poseW={cheer:0,cast:0,guard:0,kneel:0,crouch:body.crouch?1:0,wave:0,hips:0,block:0};r._pose();return captureNativeGroundLocomotion(r);}
// Independent reconstruction uses the actual engine's pose and IK at each
// interior clock, without consulting the interval bound implementation.
function native(body,record,clock,target=null,hint=[0,0,1],side='R'){const h=createTrainHuman(E,body);applyNativeGroundLocomotion(h.rig,{...copy(record),clock});const pose=prepareTrainPose(E,h,body,null,{contacts:target?[{side,target,elbowHint:hint}]:[],freeHands:true});try{return{joints:['sh','elbow','hand'].map(k=>rigWorldPoint(h.rig,pose.root,k+side)),radius:Math.max(2,h.rig.o.limbW)*h.rig.o.size,upper:h.rig.o.armUpper*h.rig.o.size,lower:h.rig.o.armLower*h.rig.o.size,diagnostics:copy(pose.diagnostics)};}finally{pose.restore();}}
function nativeBox(id,a,b,r){const d=P(...axes.map(k=>b[k]-a[k])),n=Math.hypot(d.x,d.y,d.z),center=P(...axes.map(k=>(a[k]+b[k])/2));return createHeldBox({id,frame:makeFrame(center,d,Math.abs(d.z/n)>.95?P(0,1,0):P(0,0,1)),halfExtents:P(n/2+r,r,r)});}
const inside=(point,box)=>{const q=localPoint(box.frame,point);return axes.every(k=>Math.abs(q[k])<=box.halfExtents[k]+1e-8);};
function checkSamples(body,from,to,target,hint=[0,0,1],side='R',count=32){const bound=inspect(E,body,{from,to,target,elbowHint:hint,side});assert.ok(bound);const midpoint=from.clock+(to.clock-from.clock)/2,direct=native(body,from,midpoint,target,hint,side);assert.deepEqual(bound.joints,direct.joints);assert.equal(bound.handBound,0);assert.equal(bound.radius,Math.sqrt(3)*direct.radius);assert.ok(bound.parts.every(Object.isFrozen));
 for(let i=0;i<=count;i++){const actual=native(body,from,from.clock+(to.clock-from.clock)*i/count,target,hint,side);assert.ok(actual.diagnostics[0].reachable);assert.ok(distance(actual.joints[0],bound.joints[0])<=bound.shoulderBound+1e-9);assert.ok(distance(actual.joints[1],bound.joints[1])<=bound.elbowBound+1e-9);assert.deepEqual(actual.joints[2],bound.joints[2],'unclamped fixed target does not move with the shoulder');for(const [kind,a,b]of [['upper',0,1],['lower',1,2]]){const box=nativeBox(kind,actual.joints[a],actual.joints[b],actual.radius),parts=bound.parts.filter(p=>p.id.startsWith('idle-'+kind+'-'));for(const vertex of box.vertices)assert.ok(parts.some(p=>inside(vertex,p)),kind+' actual native BOX corner at interior clock '+i);}}
 return bound;
}

test('stationary idle intervals enclose every interior native shoulder, fixed-target elbow and full arm BOX at both stances and sides',()=>{
 for(const id of ['ruth','mara'])for(const facing of [0,.7])for(const crouch of [false,true])for(const side of ['R','L'])for(const clock of [Math.PI/(2*2.3),4.1]){const body=actor(id,facing,crouch),from=motion(body,clock-.05),to=motion(body,clock+.05),shoulder=native(body,from,clock,null,[0,0,1],side).joints[0],target=P(shoulder.x+7,shoulder.y+8,shoulder.z-1),before=JSON.stringify({body,from,to,target}),style=JSON.stringify(E.style);checkSamples(body,from,to,target,[0,0,1],side);assert.equal(JSON.stringify({body,from,to,target}),before);assert.equal(JSON.stringify(E.style),style,'detached proof does not write global presentation state');}
});

test('interior breathing extrema and nonlinear IK bends are enclosed beyond an endpoint chord',()=>{
 const body=actor(),clock=Math.PI/(2*2.3),from=motion(body,clock-.05),to=motion(body,clock+.05),sh=native(body,from,clock).joints[0],target=P(sh.x+7,sh.y+8,sh.z-1),a=native(body,from,from.clock,target),m=native(body,from,clock,target),b=native(body,from,to.clock,target);
 assert.ok(m.joints[0].z>Math.max(a.joints[0].z,b.joints[0].z)+1e-4,'the real idle shoulder leaves the endpoint-only vertical span');const chord=P(...axes.map(k=>(a.joints[1][k]+b.joints[1][k])/2));assert.ok(distance(m.joints[1],chord)>1e-5,'the actual IK elbow does not follow a straight endpoint interpolation');const bound=checkSamples(body,from,to,target);assert.ok(bound.shoulderBound>0&&bound.elbowBound>bound.shoulderBound);
});

test('generic finite native poles retain their actual bend; degenerate, clamped and too-short intervals refuse',()=>{
 const body=actor('ruth',.63),from=motion(body,2),to=motion(body,2.05),clock=(from.clock+to.clock)/2,sh=native(body,from,clock).joints[0],target=P(sh.x+7,sh.y+8,sh.z+1);for(const hint of [[1,.2,.3],[-1,.7,-.2],[0,0,3]])checkSamples(body,from,to,target,hint);
 const p=native(body,from,clock),along=P(sh.x+6*Math.cos(body.facing),sh.y+6*Math.sin(body.facing),sh.z);assert.equal(inspect(E,body,{from,to,target:along,elbowHint:[1,0,0]}),null,'native fallback pole cannot receive an optimistic bound');for(const hint of [[0,0,0],[0,0,1e-6],[Infinity,0,1],[0,1]])assert.equal(inspect(E,body,{from,to,target,elbowHint:hint}),null);
 for(const d of [.001,Math.abs(p.upper-p.lower)/2,p.upper+p.lower-.005*from.profile.size,p.upper+p.lower+1])assert.equal(inspect(E,body,{from,to,target:P(sh.x+d,sh.y,sh.z),elbowHint:[0,0,1]}),null,'native IK clamp/short-distance branch is rejected');
 const zeroShoulder=native(body,from,from.clock).joints[0],tinyClamp=p.upper+p.lower-.01*from.profile.size+1e-7;assert.equal(inspect(E,body,{from,to:from,target:P(zeroShoulder.x+tinyClamp,zeroShoulder.y,zeroShoulder.z),elbowHint:[0,0,1]}),null,'sub-tolerance native clamp cannot masquerade as an exact fixed hand');
});

test('an actual .95 frame-reference crossing encloses both native oriented BOX branches',()=>{
 const body=actor(),from=motion(body,0),to=motion(body,.1),clock=.05,sh=native(body,from,clock).joints[0],hint=[1,0,0];let lo=15,hi=17;for(let i=0;i<48;i++){const d=(lo+hi)/2,p=native(body,from,clock,P(sh.x,sh.y,sh.z+d),hint).joints,z=(p[1].z-p[0].z)/distance(p[0],p[1]);if(z<.95)lo=d;else hi=d;}const target=P(sh.x,sh.y,sh.z+(lo+hi)/2),a=native(body,from,from.clock,target,hint).joints,b=native(body,from,to.clock,target,hint).joints,az=Math.abs(a[1].z-a[0].z)/distance(a[0],a[1]),bz=Math.abs(b[1].z-b[0].z)/distance(b[0],b[1]);assert.ok((az-.95)*(bz-.95)<0,'the actual native frame-up branch changes inside this accepted interval');const bound=checkSamples(body,from,to,target,hint,'R',128),ids=bound.parts.filter(p=>p.id.startsWith('idle-upper-')).map(p=>p.id);assert.ok(ids.some(id=>id.endsWith(':Y'))&&ids.some(id=>id.endsWith(':Z')));
});

test('oriented certificates clear the real finite crate where a diagnostic sqrt3 Minkowski cube would overblock',()=>{
 const body=actor(),from=motion(body,0),target=P(747,1264,46.2),hint=[0,0,1],cargo=[...Camp.TRAIN_CRATE_SOLIDS,...Object.entries(Camp.TRAIN_CHILD_CONTACTS).filter(([id])=>id!=='quarry-sealed-charge-1').map(([id,v])=>({id,x:v.center.x-TRAIN_CHARGE_HALF_EXTENTS.x,y:v.center.y-TRAIN_CHARGE_HALF_EXTENTS.y,z:v.center.z-TRAIN_CHARGE_HALF_EXTENTS.z,w:4,h:6,height:12})),{id:'cap-tin',x:732,y:1260,z:24,w:6,h:4,height:6},Camp.TRAIN_PREPARATION_SOLIDS.find(p=>p.id==='quarry-charge-worktop')],set=compileHeldBoxSet(cargo.map(o=>({box:createHeldBox({id:o.id,frame:makeFrame(P(o.x+o.w/2,o.y+o.h/2,o.z+o.height/2),P(1,0,0)),halfExtents:P(o.w/2,o.h/2,o.height/2)}),ownerId:o.id})),{id:'actual-finite-inspection-crate'});
 const p=native(body,from,.025,target),nativeParts=[nativeBox('upper',p.joints[0],p.joints[1],p.radius),nativeBox('lower',p.joints[1],p.joints[2],p.radius)];assert.ok(nativeParts.every(box=>heldBoxContacts(box,set).every(h=>!h.interiorOverlap)),'actual full-radius native arms clear all original crate/material solids');
 const rail=Camp.TRAIN_CRATE_SOLIDS.find(o=>o.id==='charge-crate-front-rail'),radius=Math.sqrt(3)*p.radius;assert.ok(p.joints[0].y+radius>rail.y&&p.joints[0].z-radius<rail.z+rail.height,'the axis-aligned cube around the actual shoulder falsely crosses the front rail');let leaves=0;
 function visit(a,b,depth){const proof=inspect(E,body,{from:motion(body,a),to:motion(body,b),target,elbowHint:hint});if(proof&&proof.parts.every(box=>heldBoxContacts(box,set).every(h=>!h.interiorOverlap))){leaves++;return true;}if(depth===16)return false;const m=(a+b)/2;return visit(a,m,depth+1)&&visit(m,b,depth+1);}
 assert.ok(visit(0,.05,0),'adaptive conservative oriented enclosures prove the actual continuous idle interval');assert.ok(leaves>1,'a broad interval cannot be accepted from one permissive endpoint sample');
 // Native cap BOX corners can lie farther than r from the centre segment.
 const upper=nativeParts[0],a=p.joints[0],b=p.joints[1],d=P(...axes.map(k=>b[k]-a[k])),n2=axes.reduce((n,k)=>n+d[k]*d[k],0),segmentDistance=v=>{const t=Math.max(0,Math.min(1,axes.reduce((n,k)=>n+(v[k]-a[k])*d[k],0)/n2));return distance(v,P(...axes.map(k=>a[k]+d[k]*t)));};assert.ok(upper.vertices.some(v=>segmentDistance(v)>p.radius+1));assert.ok(upper.vertices.every(v=>segmentDistance(v)<=radius+1e-8));
});

test('only the clock may advance; mismatched profiles, retained gait, blends, squash, body motion and extra fields refuse without writes',()=>{
 const body=actor(),from=motion(body,3),to=motion(body,3.05),sh=native(body,from,3.025).joints[0],args={from,to,target:P(sh.x+7,sh.y+8,sh.z),elbowHint:[0,0,1]},before=JSON.stringify({body,args});
 const changes=[v=>v.extra=true,v=>v.to.clock=3.11,v=>v.to.clock=2.9,v=>v.to.phase+=.01,v=>v.to.movement=[0,1],v=>v.from.speedWeight=1e-10,v=>v.to.squash=1e-10,v=>v.to.squashVelocity=1e-10,v=>v.to.poseWeights.crouch=.5,v=>v.to.poseWeights.wave=.01,v=>v.to.profile.size+=1e-10,v=>v.from.extra=true,v=>v.target.extra=true,v=>v.target.z=NaN,v=>v.side='middle',v=>delete v.elbowHint];for(const change of changes){const bad=copy(args);change(bad);assert.equal(inspect(E,body,bad),null);}
 for(const facts of [{vx:1e-10},{facing:.1},{crouch:true,pose:'crouch'},{pose:'down'},{toolHeld:'other'},{handInjury:{side:'right',recovered:false},injured:true},{mounted:true},{hp:0},{z:NaN}])assert.equal(inspect(E,{...body,...facts},args),null);
 assert.equal(JSON.stringify({body,args}),before);const still=inspect(E,body,{...args,to:from});assert.ok(still);assert.equal(still.shoulderBound,0);assert.equal(still.elbowBound,0);assert.equal(still.handBound,0);
});
