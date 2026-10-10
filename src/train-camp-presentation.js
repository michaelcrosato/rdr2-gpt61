/** Native presentation for the SAME new clinic residents and watch bottle.
 * No arrival, name, possession, body position or clinical progress is written.
 */
import {createTrainHuman,createTrainMount,prepareTrainPose,prepareTrainMountedPose,physicalProjection,drawTrainOutfit,rigWorldPoint} from './train-native/rigs.js';
import {preparationGroundMotionHuman} from './train-preparation-ground-motion.js';
import {prepareClinicBottlePose,getClinicBottleHuman as physicsHuman} from './train-camp-motion.js';
import {TRAIN_WATCH_BOTTLE_REST} from './train-prelude.js';
import {savePose} from './western-animation.js';
import {TRAIN_BRIEFING_TABLE,TRAIN_BRIEFING_PAPER_CONTACTS,TRAIN_BRIEFING_SETUP_APPROACHES,TRAIN_BRIEFING_LAYOUT_APPROACHES,TRAIN_BRIEFING_PAPER_HALF_EXTENTS} from '../content/campaign/train-camp.js';
import {getTrainCampWorkPose} from './train-camp-work.js';
import {inspectCustodyRequest,resolveFixedRef} from './rival-continuation.js';
import {getPreparationWorkPose,preparationPlayerApproach} from './train-preparation-work.js';
import {preparedCampSite} from './train-preparation-layout.js';
import * as PreparationCamp from '../content/campaign/train-preparation-camp.js';
import {TRAIN_CHARGE_HALF_EXTENTS,TRAIN_TOOL_CASE} from '../content/campaign/train-equipment.js';
import {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,TRAIN_MASK_FOLDED_CENTER,TRAIN_MASK_BASKET_SOLIDS,TRAIN_MASK_SHAPE} from '../content/campaign/train-gear-data.js';
import {getPreparationMaskPose,getPreparationWornMaskPose,preparationMaskGeometry} from './train-preparation-mask.js';
import {currentPreparationStableLead,preparePreparationStablePose} from './train-preparation-stable.js';
import {currentTrainStableCare,prepareTrainStableCarePose,trainStableCareComponentPoint} from './train-stable-care.js';
import {TRAIN_STABLE_CARE} from '../content/campaign/train-stable-care-data.js';
import {TRAIN_STABLE_LEAD} from '../content/campaign/train-stable-data.js';
import {createHeldBox} from './train-held-volume.js';
import {makeFrame} from './rail-foundation/rigid-frame.js';
const TRAIN='snowbound-what-the-line-carries',ids=new Set(['abel','nell','rivet']),point=a=>({x:a.x,y:a.y,z:a.z||0}),finite=a=>a&&['x','y','z'].every(k=>Number.isFinite(a[k]));
const copy=structuredClone;
const samePoint=(a,b)=>finite(a)&&finite(b)&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-6,near=(a,b,r)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<=r&&Math.abs((a.z||0)-(b.z||0))<8;
export function activeTrainCampWorkPose(state,body){
 if(!body||!['mara','tomas','della'].includes(body.id)||state.region!=='snowbound'||state.entities?.[body.id]!==body||body.regionId!=='snowbound')return null;
 const train=state.campaign?.missions?.[TRAIN]?.train,b=train?.briefing,entry=getTrainCampWorkPose(state,body.id);
 if(train?.briefingVersion!==1||!b||!entry||entry.body!==body||entry.at!==state.elapsed||!entry.reachable||!entry.usable||!finite(entry.contact))return null;
 const setup=TRAIN_BRIEFING_SETUP_APPROACHES[body.id];
 if(setup&&b.setup?.finishedAt===null&&near(body,setup,8)&&body.pose===setup.pose&&samePoint(entry.contact,setup.target))return{...entry,kind:'setup'};
 for(const work of train.powder?.pending||[]){
  const op=inspectCustodyRequest(state,work.requestId)?.operation;
  if(op?.kind!=='return-papers'||!op.actorIds.includes(body.id)||!['mara','tomas'].includes(body.id))continue;
  const other=state.entities[body.id==='mara'?'tomas':'mara'],paired=getTrainCampWorkPose(state,other?.id);
  if(paired?.body===other&&paired.at===state.elapsed&&paired.reachable&&paired.usable&&samePoint(entry.contact,paired.contact))return{...entry,kind:'handoff',refs:op.refs};
 }
 const job=b.paperWork,work=job?.requestId&&train.powder?.pending?.find(work=>work.requestId===job.requestId),op=work&&inspectCustodyRequest(state,work.requestId)?.operation,slot=TRAIN_BRIEFING_PAPER_CONTACTS[job?.objectId],approach=TRAIN_BRIEFING_LAYOUT_APPROACHES[job?.objectId];
 if(body.id==='tomas'&&b.setup?.finishedAt!==null&&work&&op?.kind==='move-object'&&op.actorIds.includes(body.id)&&op.refs.length===1&&op.refs[0].objectId===job.objectId&&op.to?.location.targetId===slot?.id&&near(body,approach,3)&&body.pose===approach.pose&&samePoint(entry.contact,{x:slot.x,y:slot.y,z:slot.z+3}))return{...entry,kind:'layout',objectId:job.objectId};
 return null;
}
export function activePreparationCampWorkPose(state,body){
 if(!body||body.hp<=0||state.region!=='snowbound'||body.regionId!=='snowbound'||state.entities?.[body.id]!==body||state.campaign?.activeMissionId!==TRAIN)return null;
 const r=state.campaign.missions[TRAIN],p=r.train?.preparation;if(r.mission.stage!==2||r.train.preparationVersion!==1||!p?.work?.workId)return null;
 const pending=r.train.powder?.pending.find(w=>w.workId===p.work.workId),start=pending&&r.train.powder.physicalEvents.find(e=>e.id===pending.workId),op=pending&&(start?.kind==='preparation-inspection-started'?start.data.operation:inspectCustodyRequest(state,pending.requestId)?.operation),entry=getPreparationWorkPose(state,body.id);
 if(!op?.actorIds.includes(body.id)||op.kind!==pending.kind||!entry||entry.workId!==pending.workId||entry.body!==body||entry.at!==state.elapsed||entry.operationKind!==op.kind||!entry.reachable||!entry.usable||!finite(entry.contact))return null;
 return{...entry,kind:'preparation',operationKind:op.kind};
}
export function currentPreparationMaskPose(state,body){
 const item=state.itemInstances?.[TRAIN_MASK_ID];if(state.region!=='snowbound'||body?.id!=='mara'||state.entities?.mara!==body||body.regionId!=='snowbound'||body.hp<=0||item?.owner!=='mara'||item.location?.targetId!=='mara')return null;
 const active=getPreparationMaskPose(state),worn=getPreparationWornMaskPose(state),entry=active||worn,g=entry?.geometry;
 if(!entry||entry.body!==body||entry.at!==state.elapsed||!entry.human||active&&(!entry.reachable||!entry.usable)||!g||g.itemRef?.sourceMissionId!==TRAIN||g.itemRef.objectId!==TRAIN_MASK_ID||!finite(g.center)||!finite(g.halfExtents)||!['x','y','z'].every(k=>g.halfExtents[k]>0&&finite(g.axes?.[k])))return null;
 return{...entry,kind:active?'mask-fitting':'mask-worn'};
}
export function currentPreparationMaskMount(state,body){const rider=state.entities?.mara;if(!body||body.kind!=='horse'||state.entities?.[body.id]!==body||!rider?.mounted||(rider.mountId||state.party?.mountId)!==body.id)return null;const entry=currentPreparationMaskPose(state,rider);return entry?.kind==='mask-worn'&&entry.mountBody===body&&entry.mountRig&&finite(entry.mountedRoot)?entry:null;}
export function currentPreparationStableWork(state,body){
 if(!body||state.entities?.[body.id]!==body||body.regionId!=='snowbound'||body.hp<=0||body.dead||body.hidden||body.departed||body.escaped)return null;
 const lead=currentPreparationStableLead(state);if(!lead||!['inez','skein'].includes(body.id)||body!==(body.id==='inez'?lead.inez:lead.mare))return null;
 return{kind:'stable-lead',phase:lead.phase,progress:lead.gripProgress,mare:lead.mare,leader:lead.inez};
}
export function currentPreparationCareWork(state,body){
 if(!body||!['inez','skein'].includes(body.id)||state.entities?.[body.id]!==body||body.regionId!=='snowbound'||body.hp<=0||body.dead||body.hidden||body.departed||body.escaped)return null;
 const care=currentTrainStableCare(state);if(!care||body!==(body.id==='inez'?care.inez:care.mare))return null;
 const operation=TRAIN_STABLE_CARE.operations[care.work.kind];if(!operation||care.work.phase!=='approach'&&!finite(care.target))return null;
 return{kind:'manual-care',phase:care.work.phase,operationKind:care.work.kind,seconds:care.work.seconds,target:care.target,componentRef:{bodyId:'skein',componentId:operation.componentId},glove:TRAIN_STABLE_CARE.glove,mare:care.mare,leader:care.inez};
}
export function ownsTrainCampActor(state,body){return !!body&&state.region==='snowbound'&&state.entities?.[body.id]===body&&body.regionId==='snowbound'&&(ids.has(body.id)||!!currentPreparationCareWork(state,body)||!!currentPreparationStableWork(state,body)||!!currentPreparationMaskMount(state,body)||!!currentPreparationMaskPose(state,body)||!!activePreparationCampWorkPose(state,body)||!!activeTrainCampWorkPose(state,body)||!!preparationGroundMotionHuman(state,body.id));}
/** Replaces only old decorative resource proxies once the same actual store
 * fixture is latched. People, mounts and the earlier room remain unchanged. */
export function ownsPreparationCampProp(state,prop){return state.region==='snowbound'&&['ruth-charge-store','ruth-cap-store'].includes(prop.id)&&preparedCampSite(state,'quarry-charge-worktop');}
const prelude=s=>s.campaign?.missions?.[TRAIN]?.train?.prelude;
const preparationFaces=[{name:'bottom',indices:[2,3,1,0],normal:[0,0,-1],shade:-.2},{name:'top',indices:[5,7,6,4],normal:[0,0,1],shade:.14},{name:'back',indices:[1,5,4,0],normal:[0,-1,0],shade:-.12},{name:'front',indices:[6,7,3,2],normal:[0,1,0],shade:-.08},{name:'left',indices:[4,6,2,0],normal:[-1,0,0],shade:-.18},{name:'right',indices:[3,7,5,1],normal:[1,0,0],shade:-.03}];
function preparationBox(center,half,color,{openTop=false,number=null}={}){
 const vertices=[];for(const z of[-half.z,half.z])for(const y of[-half.y,half.y])for(const x of[-half.x,half.x])vertices.push({x:center.x+x,y:center.y+y,z:center.z+z});
 return preparationFaces.filter(face=>!openTop||face.name!=='top').map(face=>({...face,world:face.indices.map(i=>vertices[i]),color,number,center,half,twoSided:openTop&&['front','back','left','right'].includes(face.name)}));
}
function preparationFacePieces(face){
 const[a,b,,d]=face.world,u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:d.x-a.x,y:d.y-a.y,z:d.z-a.z},nx=Math.max(1,Math.ceil(Math.hypot(u.x,u.y,u.z)/4)),ny=Math.max(1,Math.ceil(Math.hypot(v.x,v.y,v.z)/4)),pieces=[],at=(x,y)=>({x:a.x+u.x*x+v.x*y,y:a.y+u.y*x+v.y*y,z:a.z+u.z*x+v.z*y});
 // Large planes cannot use a single centre depth when small objects sit on
 // one end. Tessellation retains the complete same plane and its boundaries.
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)pieces.push({...face,world:[at(x/nx,y/ny),at((x+1)/nx,y/ny),at((x+1)/nx,(y+1)/ny),at(x/nx,(y+1)/ny)]});
 return pieces;
}
const wrapperDigits={1:['010','110','010','010','111'],2:['110','001','010','100','111'],3:['110','001','010','001','110'],4:['101','101','111','001','001']};
/** Printed marks lie on the existing wrapper faces, not on a screen label. */
function drawWrapperNumber(E,g,r,face){
 const rows=wrapperDigits[face.number];if(!rows||!['top','front'].includes(face.name))return;
 const c=face.center,h=face.half,top=face.name==='top',at=(x,y)=>top?{x:c.x+x,y:c.y+y,z:c.z+h.z+.015}:{x:c.x+x,y:c.y+h.y+.015,z:c.z-y};
 const quad=(x0,y0,x1,y1,color)=>E.px.poly(g,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>{const p=at(x,y);return r.w(p.x,p.y,p.z);}),color);
 quad(-1.35,-2.3,1.35,2.3,'#eee5c4');
 for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(rows[y][x]==='1')quad(-1.05+x*.7,-2.1+y*.84,-.35+x*.7,-1.26+y*.84,'#364e48');
}
function drawPreparationMask(E,g,r,geometry){
 const h=geometry.halfExtents,axes=geometry.axes,at=(x,y,z)=>Object.fromEntries(['x','y','z'].map(k=>[k,geometry.center[k]+axes.x[k]*x+axes.y[k]*y+axes.z[k]*z])),vertices=[];
 for(const z of[-h.z,h.z])for(const y of[-h.y,h.y])for(const x of[-h.x,h.x])vertices.push(at(x,y,z));
 const ray={x:r.view.ay*r.view.bz,y:-r.view.ax*r.view.bz,z:r.view.ax*r.view.by-r.view.ay*r.view.bx},depth=p=>p.x*ray.x+p.y*ray.y+p.z*ray.z;
 const faces=preparationFaces.map(face=>({...face,world:face.indices.map(i=>vertices[i]),normal:Object.fromEntries(['x','y','z'].map(k=>[k,axes.x[k]*face.normal[0]+axes.y[k]*face.normal[1]+axes.z[k]*face.normal[2]]))})).filter(face=>depth(face.normal)>1e-9).sort((a,b)=>a.world.reduce((n,p)=>n+depth(p),0)-b.world.reduce((n,p)=>n+depth(p),0));
 for(const face of faces){E.px.poly(g,face.world.map(p=>r.w(p.x,p.y,p.z)),E.shade(geometry.color,face.shade));if(['front','back'].includes(face.name))for(const z of[-h.z*.72,h.z*.72]){const y=face.name==='front'?h.y:-h.y,a=at(-h.x*.86,y,z),b=at(h.x*.86,y,z);E.px.line(g,...r.w(a.x,a.y,a.z),...r.w(b.x,b.y,b.z),geometry.seam,1);}}
 return{vertices,facesCamera:-(axes.y.x*ray.x+axes.y.y*ray.y+axes.y.z*ray.z)>=0};
}
/** The finite rein uses the same circumscribed native capsule envelope as
 * the accepted stable motion owner. Reaching hands approach its existing end. */
function drawStableRein(E,g,r,pose){
 const a=pose.reinEnd,b=pose.halter,d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},n=Math.hypot(d.x,d.y,d.z),radius=TRAIN_STABLE_LEAD.reinRadius,center=Object.fromEntries(['x','y','z'].map(k=>[k,(a[k]+b[k])/2])),box=createHeldBox({id:'stable-rein',frame:makeFrame(center,n>1e-7?d:{x:1,y:0,z:0},n>1e-7&&Math.abs(d.z/n)>.95?{x:0,y:1,z:0}:{x:0,y:0,z:1}),halfExtents:{x:n/2+radius,y:radius,z:radius}}),vertices=box.vertices;
 const depth=p=>r.view.depth(p.x,p.y,p.z),faces=preparationFaces.map(face=>({...face,world:face.indices.map(i=>vertices[[0,1,3,2,4,5,7,6][i]])})).sort((x,y)=>x.world.reduce((sum,p)=>sum+depth(p),0)-y.world.reduce((sum,p)=>sum+depth(p),0));
 for(const face of faces)E.px.poly(g,face.world.map(p=>r.w(p.x,p.y,p.z)),E.shade('#655e43',face.shade));
 return{world:center,hand:rigWorldPoint(pose.human.rig,pose.root,'handR'),reinEnd:copy(a),halter:copy(b),radius,vertices:copy(vertices)};
}
/** Bounds of the actual materials still at the store, used only to frame the
 * explicitly separate close-up. No carrier, source or material is created. */
function preparationStoreBounds(s){
 if(s.region!=='snowbound'||s.campaign?.activeMissionId!==TRAIN||s.campaign.missions[TRAIN]?.mission.stage!==2||!preparedCampSite(s,'quarry-charge-worktop'))return null;
 const objects=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects,atStore=item=>item?.location?.type==='station'&&item.location.targetId==='quarry-charge-store'&&item.location.regionId==='snowbound',bounds=[];
 if(atStore(objects?.['charge-crate']))bounds.push([PreparationCamp.TRAIN_CRATE_STORED_CENTER,PreparationCamp.TRAIN_CRATE_SHAPE]);
 if(atStore(objects?.['cap-tin']))bounds.push([PreparationCamp.TRAIN_TIN_CENTER,PreparationCamp.TRAIN_TIN_SHAPE]);
 if(!bounds.length)return null;
 return{min:Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...bounds.map(([c,h])=>c[k]-h[k]))])),max:Object.fromEntries(['x','y','z'].map(k=>[k,Math.max(...bounds.map(([c,h])=>c[k]+h[k]))]))};
}
/** A magnified viewport of the SAME materials. It contains no actor pass and
 * never touches a Human, accepted clock, work record or canonical object. */
export function createPreparationMaterialDetail(E){
 const presenter=createTrainCampPresentation(E),view=new E.View('train-material-closeup','Store close-up',0,75,1,1);
 return{draw(g,s,{width,height}){
  const bounds=preparationStoreBounds(s);if(!bounds||![width,height].every(n=>Number.isFinite(n)&&n>32))return null;
  const corners=[];for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z])corners.push({x,y,z});
  view.set(0,75,1,1);const points=corners.map(p=>view.p(p.x,p.y,p.z)),range={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))},scale=Math.min((width-24)/(range.right-range.left),(height-24)/(range.bottom-range.top));view.set(0,75,scale,1);
  const center=[(range.left+range.right)/2*scale,(range.top+range.bottom)/2*scale],pending=[],r={view,w:(...args)=>view.p(...args).map((n,i)=>n-center[i]+[width,height][i]/2),visible:()=>true,queue:(x,y,z,fn,o)=>pending.push({key:view.order(x,y,z)+(o?.bias||0),fn})};
  g.save();try{g.beginPath();g.rect(0,0,width,height);g.clip();E.px.rect(g,0,0,width,height,'#243b38');presenter.drawMaterials(r,s,'quarry-charge-worktop');pending.sort((a,b)=>a.key-b.key);for(const item of pending)item.fn(g);}finally{g.restore();g._c=null;}
  return{...presenter.inspect(),view:'material-closeup',bounds:copy(bounds),scale};
 }};
}

function boxes(E,g,r,origin,build,{openTop=false}={}){
 const P=E.px,quads=[];
 function box(x0,y0,z0,x1,y1,z1,color){
  const v=[];for(const z of[z0,z1])for(const y of[y0,y1])for(const x of[x0,x1])v.push({x:origin.x+x,y:origin.y+y,z:origin.z+z});
  for(const [index,face]of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].entries()){if(openTop&&index===1)continue;const p=face.map(i=>v[i]);quads.push({depth:p.reduce((n,a)=>n+r.view.depth(a.x,a.y,a.z),0)/4,points:p,color});}
 }
 build(box);
 quads.sort((a,b)=>a.depth-b.depth);for(const q of quads)P.poly(g,q.points.map(a=>r.w(a.x,a.y,a.z)),q.color);
}
const bottleParts=[[-1.8,-1.4,0,1.8,1.4,6.3,'#8a7951'],[-1,-.9,6.3,1,.9,8.4,'#b3a478'],[-1.2,-1,8.4,1.2,1,9.3,'#665640'],[-1.85,-1.45,2,1.85,1.45,4.5,'#cec7a2']];
const partsFor=closed=>bottleParts.filter((_,index)=>index!==2||closed);
/** The canonical hand/rest point is the grip four units above the base. */
export function clinicBottleBounds(origin,closed=true){
 if(!finite(origin))throw new TypeError('A finite canonical bottle grip is required');
 const parts=partsFor(closed);return{min:{x:origin.x+Math.min(...parts.map(p=>p[0])),y:origin.y+Math.min(...parts.map(p=>p[1])),z:origin.z+Math.min(...parts.map(p=>p[2]-4))},max:{x:origin.x+Math.max(...parts.map(p=>p[3])),y:origin.y+Math.max(...parts.map(p=>p[4])),z:origin.z+Math.max(...parts.map(p=>p[5]-4))}};
}
function bottleMesh(E,g,r,bottle,origin){boxes(E,g,r,origin,box=>{for(const [x0,y0,z0,x1,y1,z1,color]of partsFor(bottle.closed))box(x0,y0,z0-4,x1,y1,z1-4,color);});}
function paperMesh(E,g,r,original,plane){
 const half=TRAIN_BRIEFING_PAPER_HALF_EXTENTS,z=plane.z+half.z+.05,P=E.px;
 boxes(E,g,r,plane,box=>box(-half.x,-half.y,-half.z,half.x,half.y,half.z,original.id==='route-diagram'?'#d4c79e':'#cbbd93'));
 const at=(x,y)=>r.w(plane.x+x,plane.y+y,z);
 if(original.id==='route-diagram'){P.line(g,...at(-5,-2),...at(-1,1),'#477870',1);P.line(g,...at(-1,1),...at(5,-1),'#477870',1);P.line(g,...at(4,2),...at(4,3),'#685c44',1);}
 else for(const y of[-2,0,2])P.line(g,...at(-5,y),...at(y===0?4:2,y),'#66543e',1);
}
function abelOutfit(E,g,r,h,root){
 const at=id=>{const p=rigWorldPoint(h.rig,root,id);return r.w(p.x,p.y,p.z);},P=E.px,head=at('head'),sh=at('shC'),hip=at('hipC');
 P.ell(g,head[0],head[1],11,3,h.profile.hat);P.rect(g,head[0]-5,head[1]-9,10,8,h.profile.hat);
 for(const id of['handL','handR']){const p=at(id);P.line(g,p[0]-3,p[1]-4,p[0]+3,p[1]-4,'#d4d0b6',3);}
 P.line(g,sh[0]-7,sh[1]+1,hip[0]+8,hip[1]+2,'#83988d',2);P.rect(g,hip[0]+3,hip[1]+1,12,13,'#527d72');P.line(g,hip[0]+4,hip[1]+4,hip[0]+14,hip[1]+4,'#a9b5a0',1);
}
export function createTrainCampPresentation(E,{getClinicBottleHuman=physicsHuman,reduceMotion=()=>false}={}){
 if(!E?.Humanoid||typeof getClinicBottleHuman!=='function')throw new TypeError('Native clinic rigs and actual physics getter are required');
 const humans=new Map(),mounts=new Map();let diagnostics={at:null,actors:[],objects:[],contacts:[],guidance:[],surfaces:[],errors:[]},updated=new WeakSet();
 function human(body){if(humans.get(body.id)?.body!==body)humans.set(body.id,{body,h:createTrainHuman(E,body)});return humans.get(body.id).h;}
 function mount(body){if(mounts.get(body.id)?.body!==body){const rig=createTrainMount(E,body);rig.update(0,body,!!reduceMotion());mounts.set(body.id,{body,rig});}return mounts.get(body.id).rig;}
 function visualBody(body){return{...body,z:0,vx:body.mounted?0:body.vx||0,vy:body.mounted?0:body.vy||0,vz:body.mounted?0:body.vz||0,pose:body.hp<=0?'die':body.pose||(body.crouch?'crouch':null)};}
 function currentHuman(s,body){const care=currentPreparationCareWork(s,body);if(care&&body.id==='inez'){const h=human(body);if(care.phase==='approach'&&!updated.has(h)){h.rig.update(0,visualBody(body));updated.add(h);}return{h,shared:false,care};}const stable=currentPreparationStableWork(s,body);if(stable&&body.id==='inez'&&stable.phase!=='approach')return{h:human(body),shared:false,stable};const mask=currentPreparationMaskPose(s,body),work=mask?.kind==='mask-fitting'?mask:activePreparationCampWorkPose(s,body)||activeTrainCampWorkPose(s,body);if(work)return{h:work.human,shared:true,work,mask};const ground=preparationGroundMotionHuman(s,body.id,E);if(ground)return{h:ground.human,shared:true,mask,ground};if(mask)return{h:mask.human,shared:true,mask};const shared=body.id==='abel'?getClinicBottleHuman(s):null;if(shared)return{h:shared,shared:true};const h=human(body);if(!updated.has(h)){h.rig.update(0,visualBody(body));updated.add(h);}return{h,shared:false};}
 function update(dt,s){
  if(!Number.isFinite(dt)||dt<0)return;
  for(const body of Object.values(s.entities||{})){
   if(!ownsTrainCampActor(s,body)||body.hidden||body.departed||body.escaped)continue;
   if(preparationGroundMotionHuman(s,body.id,E))continue;
   if(body.kind==='horse'||body.id==='rivet'){if(!currentPreparationMaskMount(s,body)&&!currentPreparationStableWork(s,body)&&!currentPreparationCareWork(s,body))mount(body).update(dt,body,!!reduceMotion());}
   else if((!currentPreparationCareWork(s,body)||currentPreparationCareWork(s,body).phase==='approach')&&(!currentPreparationStableWork(s,body)||currentPreparationStableWork(s,body).phase==='approach')&&!(body.id==='abel'&&getClinicBottleHuman(s))&&!currentPreparationMaskPose(s,body)&&!activePreparationCampWorkPose(s,body)&&!activeTrainCampWorkPose(s,body)){const h=human(body);h.rig.update(dt,visualBody(body));updated.add(h);}
  }
 }
 function draw(r,s){
  diagnostics={at:s.elapsed,actors:[],objects:[],contacts:[],guidance:[],surfaces:[],errors:[]};
  if(s.region!=='snowbound')return;
  const bottle=prelude(s)?.bottle,visible=body=>!body.hidden&&!body.departed&&!body.escaped&&(!r.visible||r.visible(body.x,body.y,body.z||0,100,160,100));
  // Only registered bodies accepted by the live ownership predicate enter.
  // Current work may include a keeper who has no ambient Train draw owner.
  const wornMount=currentPreparationMaskPose(s,s.entities?.mara)?.mountBody,bodies=[...new Set(['rivet',wornMount?.id,'abel','nell','mara','tomas','della','ruth','ada',...Object.keys(s.entities||{})])].map(id=>s.entities?.[id]).filter(body=>ownsTrainCampActor(s,body)&&visible(body));
  for(const body of bodies){
   if(!finite(point(body)))throw new TypeError('Native clinic actor needs its actual finite body');
   r.shadow?.(body.x,body.y,body.kind==='horse'||body.id==='rivet'?18:8,.2,'#526d69',body.z||0);
   r.queue(body.x,body.y,body.z||0,g=>physicalProjection(E,()=>{
    if(body.kind==='horse'||body.id==='rivet'){const physical=currentPreparationMaskMount(s,body),stable=currentPreparationStableWork(s,body),care=currentPreparationCareWork(s,body),rig=physical?.mountRig||(stable||care?createTrainMount(E,body):mount(body));if((stable||care)&&!physical)rig.update(0,body);else if(!physical)rig.pose(body);const result=rig.draw(g,r,body);diagnostics.actors.push({id:body.id,kind:'mount',world:point(body),physicsMount:!!physical,nativeStablePose:!!stable,stablePhase:stable?.phase??null,nativeCarePose:!!care,carePhase:care?.phase??null,rigUpdateSkipped:!!physical||!!stable||!!care,...(result.mark?{mark:result.mark}:{})});return;}
    const {h,shared,work,mask,stable,care,ground}=currentHuman(s,body),restore=savePose(h.rig),drawState=['_pitch','_camSide'].map(key=>({key,had:Object.hasOwn(h.rig,key),value:h.rig[key]})),p=prelude(s),held=body.id==='abel'&&bottle?.id==='abel-watch-bottle'&&bottle.location?.type==='carried'&&bottle.location.targetId===body.id;
    let pose;
    try{
     const horse=body.mounted?s.entities?.[body.mountId||s.party?.mountId]:null;
     if(care&&care.phase!=='approach'){pose=prepareTrainStableCarePose(E,h,body,care.target);}
     else if(stable){pose=preparePreparationStablePose(E,h,body,stable.mare,stable.progress);}
     else if(body.mounted&&mask?.mountBody===horse&&mask.mountRig){pose=prepareTrainMountedPose(E,h,body,horse,mask.mountRig,{freeHands:body.holstered!==false||!body.equippedWeaponId});}
     else if(body.mounted&&horse?.id==='rivet'&&horse.hp>0&&!horse.dead&&Math.hypot(horse.x-body.x,horse.y-body.y)<1){pose=prepareTrainMountedPose(E,h,body,horse,mount(horse),{freeHands:body.holstered!==false||!body.equippedWeaponId});}
     else if(body.id==='abel'&&held&&body.pose==='kneel'&&p?.bottleWork?.finishedAt===null){pose=prepareClinicBottlePose(E,h,body,TRAIN_WATCH_BOTTLE_REST);}
     else if(work){pose=prepareTrainPose(E,h,body,null,{contacts:[{side:'R',kind:work.kind==='mask-fitting'?`preparation-mask-${work.geometry.mode}`:work.kind==='preparation'?`preparation-${work.operationKind}`:work.kind==='setup'?'briefing-setup':work.kind==='handoff'?'briefing-paper-handoff':'briefing-paper-layout',target:work.contact,elbowHint:work.contactHint}],freeHands:true});}
     else{if(body.mounted)diagnostics.errors.push({id:body.id,kind:'invalid-current-mount'});pose=prepareTrainPose(E,h,body,null);}
     // A permanent worn item follows the Human actually chosen for this draw.
     // Its idle provider may retain a different gait/stance blend history from
     // the active work Human. Active fitting keeps the owning timed geometry.
     const maskGeometry=mask?.kind==='mask-worn'?preparationMaskGeometry(E,{body,human:h},'wear',1,{root:pose.root,fitVersion:mask.geometry.fitVersion??1}):mask?.geometry;
     const maskNear=maskGeometry&&-(maskGeometry.axes.y.x*r.view.ay*r.view.bz-maskGeometry.axes.y.y*r.view.ax*r.view.bz+maskGeometry.axes.y.z*(r.view.ax*r.view.by-r.view.ay*r.view.bx))>=0;
     const paintMask=()=>{const item=s.itemInstances[TRAIN_MASK_ID],result=drawPreparationMask(E,g,r,maskGeometry);diagnostics.objects.push({id:TRAIN_MASK_ID,owner:item.owner,location:item.location.type,presentation:mask.kind,world:copy(maskGeometry.center),halfExtents:copy(maskGeometry.halfExtents),axes:copy(maskGeometry.axes),vertices:copy(result.vertices),facePoint:copy(maskGeometry.face),fitVersion:maskGeometry.fitVersion??1,mode:maskGeometry.mode,progress:maskGeometry.progress,unfolded:maskGeometry.unfolded,physicsHuman:mask.kind==='mask-worn'||h===mask.human,getterHumanMatchesDraw:h===mask.human,geometrySource:mask.kind==='mask-worn'?'drawn-native-pose':'active-native-fitting',facesCamera:result.facesCamera});};
     if(mask&&!maskNear)paintMask();
     const at=r.w(pose.root.x,pose.root.y,pose.root.z);h.rig.draw(g,...at,r.view);
     if(body.id==='abel')abelOutfit(E,g,r,h,pose.root);else drawTrainOutfit(E,g,r,h,{...body,...pose.root});
     if(mask&&maskNear)paintMask();
     if(stable){const rein=drawStableRein(E,g,r,{...pose,human:h});diagnostics.objects.push({id:'stable-skein-rein',presentation:'native-stable-rein',owner:stable.mare.ownerId,sourceBodyId:'skein',leaderId:'inez',phase:stable.phase,gripProgress:stable.progress,...rein});}
     if(care){diagnostics.objects.push({id:`manual-care:inez:skein:${care.operationKind}`,presentation:'manual-care',actorId:'inez',sourceBodyId:'skein',operationKind:care.operationKind,phase:care.phase,componentRef:copy(care.componentRef),glove:copy(care.glove),target:care.target&&copy(care.target),hand:rigWorldPoint(h.rig,pose.root,'handR'),componentPoint:care.phase==='contact'?trainStableCareComponentPoint(s,care.operationKind,care.seconds/TRAIN_STABLE_CARE.operations[care.operationKind].seconds):null,healing:0,stockTransfer:0,cleanlinessChange:0,bondChange:0});}
     if(held){const side=bottle.location.hand||'R',origin=rigWorldPoint(h.rig,pose.root,'hand'+side);bottleMesh(E,g,r,bottle,origin);diagnostics.objects.push({id:bottle.id,location:'carried',owner:body.id,world:origin,bounds:clinicBottleBounds(origin,bottle.closed)});}
     if(work?.kind==='layout'){
      const original=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects?.[work.objectId];
      if(original?.owner===body.id&&original.location?.type==='carried'&&original.location.targetId===body.id){const grip=rigWorldPoint(h.rig,pose.root,'handR'),plane={...grip,z:grip.z-3};paperMesh(E,g,r,original,plane);diagnostics.objects.push({id:original.id,location:'carried',owner:body.id,world:grip,paperPlane:plane});}
     }
     if(work?.kind==='handoff')for(let index=0;index<work.refs.length;index++){
      const ref=work.refs[index],original=ref.sourceMissionId==='snowbound-the-names-they-took'&&s.campaign?.missions?.[ref.sourceMissionId]?.objects?.[ref.objectId];
      if(original?.owner===body.id&&original.location?.type==='carried'&&original.location.targetId===body.id){const grip=rigWorldPoint(h.rig,pose.root,'handR'),plane={...grip,z:grip.z-3+index*.22};paperMesh(E,g,r,original,plane);diagnostics.objects.push({id:original.id,location:'carried',owner:body.id,world:grip,paperPlane:plane});}
     }
     diagnostics.contacts.push(...pose.diagnostics.map(c=>({...copy(c),actorId:body.id,errorFinite:Number.isFinite(c.error),...(care?{presentation:'manual-care',carePhase:care.phase,componentRef:copy(care.componentRef)}:{})})));
     for(const c of pose.diagnostics)if(!c.reachable||!Number.isFinite(c.error)||c.error>1e-5)diagnostics.errors.push({id:body.id,kind:'unreached-native-contact',contact:c.kind});
     diagnostics.actors.push({id:body.id,kind:'human',world:point(body),drawRoot:point(pose.root),physicsHuman:shared,nativeStablePose:!!stable,stablePhase:stable?.phase??null,nativeCarePose:!!care,carePhase:care?.phase??null,rigUpdateSkipped:shared||!!stable||!!care&&care.phase!=='approach',work:work?.kind||null,workId:work?.workId||null,operationKind:work?.operationKind||null,maskPresentation:mask?.kind||null,...(ground?{groundMotion:{clock:h.rig.t,phase:h.rig.phase,speedWeight:h.rig.spW,movement:[...h.rig.mv],poseWeights:copy(h.rig.poseW)}}:{}),...(mask?{maskHead:rigWorldPoint(h.rig,pose.root,'head')}:{}),...(['preparation','mask-fitting'].includes(work?.kind)?{elbow:rigWorldPoint(h.rig,pose.root,'elbowR'),contactHint:copy(work.contactHint)}:{})});
    }finally{pose?.restore();restore();for(const {key,had,value}of drawState){if(had)h.rig[key]=value;else delete h.rig[key];}}
   }),{occluder:true});
  }
  if(bottle?.id==='abel-watch-bottle'&&bottle.location?.type==='ground'&&bottle.location.regionId==='snowbound'&&finite(bottle.location.point)){
   const origin=bottle.location.point;
   r.queue(origin.x,origin.y,origin.z,g=>{bottleMesh(E,g,r,bottle,origin);diagnostics.objects.push({id:bottle.id,location:'ground',owner:bottle.owner,world:copy(origin),bounds:clinicBottleBounds(origin,bottle.closed)});},{occluder:true});
  }
  const train=s.campaign?.missions?.[TRAIN]?.train;
  drawPreparationObjects(r,s);
  drawPreparationGuidance(r,s);
  if(train?.briefingVersion===1&&train.briefing?.setup?.finishedAt!==null&&Number.isFinite(train.briefing?.setup?.finishedAt)){
   const table=TRAIN_BRIEFING_TABLE;
   r.queue(table.x,table.y+table.depth/2,table.z,g=>{
    // Closed work-table base agrees with its actual full solid; no painted
    // under-table firing gap contradicts the collision footprint.
    boxes(E,g,r,table,box=>{box(-table.width/2,-table.depth/2,0,table.width/2,table.depth/2,table.height-3,'#79694e');box(-table.width/2,-table.depth/2,table.height-3,table.width/2,table.depth/2,table.height,'#aa936a');});
    diagnostics.objects.push({id:table.id,location:'station',world:point(table)});
   },{occluder:true});
   const originals=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects;
   for(const [id,slot]of Object.entries(TRAIN_BRIEFING_PAPER_CONTACTS)){
    const original=originals?.[id];if(!original||original.owner!=='tomas'||original.location?.type!=='station'||original.location.targetId!==slot.id||original.location.regionId!=='snowbound')continue;
    r.queue(table.x,table.y+table.depth/2,table.z,g=>{const z=slot.z+.1,half=TRAIN_BRIEFING_PAPER_HALF_EXTENTS;E.px.poly(g,[[-half.x,-half.y],[half.x,-half.y],[half.x,half.y],[-half.x,half.y]].map(([x,y])=>r.w(slot.x+x,slot.y+y,z)),'#d4c79e');E.px.line(g,...r.w(slot.x-5,slot.y-2,z+.05),...r.w(slot.x+4,slot.y+2,z+.05),id==='route-diagram'?'#6e8b83':'#877456',1);diagnostics.objects.push({id,location:'station',owner:original.owner,world:point(slot)});},{occluder:true,bias:.01});
   }
  }
 }
 function drawPreparationGuidance(r,s){
  const approach=preparationPlayerApproach(s);if(!approach||!finite(approach.point))return;
  const p=approach.point;if(r.visible&&!r.visible(p.x,p.y,p.z,40,40,30))return;
  const color='#e7d4a1',radius=3,label='Stand here';
  r.queue(p.x,p.y,p.z,g=>{
   for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;E.px.line(g,...r.w(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius,p.z+.05),...r.w(p.x+Math.cos(b)*radius,p.y+Math.sin(b)*radius,p.z+.05),color,2);}
   diagnostics.guidance.push({kind:'player-approach',siteId:approach.siteId,world:copy(p),facing:approach.facing,radius,label});
  },{occluder:false,bias:.02});
  const drawLabel=g=>{const[x,y]=r.w(p.x,p.y,p.z);E.font.text(g,label,x,y-15,color,{align:'center',outline:'#263b36'});};
  if(r.overlay)r.overlay(drawLabel);else r.queue(p.x,p.y,p.z,drawLabel,{occluder:false,bias:.03});
 }
 function drawPreparationObjects(r,s,onlySite=null){
  const sites=Object.fromEntries(PreparationCamp.TRAIN_PREPARATION_SOLIDS.map(site=>[site.id,(!onlySite||onlySite===site.id)&&preparedCampSite(s,site.id)])),objects=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects||{};
  // The screen-axis cross product includes the view's actual height boost;
  // view.depth alone describes the unboosted camera and is not this ray.
  const ray={x:r.view.ay*r.view.bz,y:-r.view.ax*r.view.bz,z:r.view.ax*r.view.by-r.view.ay*r.view.bx},ground=Math.hypot(ray.x,ray.y),divisor=r.view.isTop?Math.abs(ray.z):ground;
  const solid=(box,color)=>preparationBox({x:box.x+box.w/2,y:box.y+box.h/2,z:box.z+box.height/2},{x:box.w/2,y:box.h/2,z:box.height/2},color).map(face=>({...face,partId:box.id}));
  const queue=(id,center,half,faces,data={})=>{
   if(r.visible&&!r.visible(center.x,center.y,center.z,120,140,80))return;
   let recorded=false;
   for(const face of faces.flatMap(preparationFacePieces)){
    if(!face.twoSided&&face.normal[0]*ray.x+face.normal[1]*ray.y+face.normal[2]*ray.z<=1e-9)continue;
    const c=Object.fromEntries(['x','y','z'].map(k=>[k,face.world.reduce((n,p)=>n+p[k],0)/4]));
    // Normalize true camera depth to the legacy renderer's ground-order units.
    // Every face competes with the other actual surfaces, rather than letting
    // a worktop's front-bottom key repaint all the objects above its top.
    const depth=(ray.x*c.x+ray.y*c.y+ray.z*c.z)/divisor,bias=depth-r.view.order(c.x,c.y,c.z);
    r.queue(c.x,c.y,c.z,g=>{
     if(!recorded){diagnostics.objects.push({id,world:copy(center),halfExtents:copy(half),...copy(data)});recorded=true;}
     const polygon=face.world.map(p=>r.w(p.x,p.y,p.z));E.px.poly(g,polygon,E.shade(face.color,face.shade));
     if(face.number&&['top','front'].includes(face.name)||id===TRAIN_MASK_ID&&face.name==='top'&&data.source){g.save();g.beginPath();g.moveTo(...polygon[0]);for(const p of polygon.slice(1))g.lineTo(...p);g.closePath();g.clip();drawWrapperNumber(E,g,r,face);if(id===TRAIN_MASK_ID&&data.source){const c=TRAIN_MASK_FOLDED_CENTER;E.px.line(g,...r.w(c.x-2,c.y,c.z+.25),...r.w(c.x+2,c.y,c.z+.25),TRAIN_MASK_SHAPE.seam,1);}g.restore();g._c=null;}
     diagnostics.surfaces.push({id,face:face.name,world:copy(face.world),depth,...(face.partId?{partId:face.partId}:{}),...(face.number?{number:face.number}:{})});
    },{occluder:true,bias});
   }
  };
  for(const site of PreparationCamp.TRAIN_PREPARATION_SOLIDS)if(sites[site.id]){const center={x:site.x+site.w/2,y:site.y+site.h/2,z:site.z+site.height/2},half={x:site.w/2,y:site.h/2,z:site.height/2};queue(site.id,center,half,solid(site,'#897657'),{location:'station',siteId:site.id,fixture:true});}
  const atStore=item=>item?.location.type==='station'&&item.location.targetId==='quarry-charge-store'&&item.location.regionId==='snowbound';
  if(sites['quarry-charge-worktop']){
   const crate=objects['charge-crate'];if(atStore(crate)){queue(crate.id,PreparationCamp.TRAIN_CRATE_STORED_CENTER,PreparationCamp.TRAIN_CRATE_SHAPE,PreparationCamp.TRAIN_CRATE_SOLIDS.flatMap(board=>solid(board,'#8b7654')),{owner:crate.owner,location:'station',siteId:'quarry-charge-worktop'});
    for(const[id,slot]of Object.entries(PreparationCamp.TRAIN_CHILD_CONTACTS)){const child=objects[id];if(child?.location.type!=='crate'||child.location.targetId!==crate.id||!crate.chargeIds.includes(id))continue;const number=Number(id.slice(-1)),colors=['#c5b48c','#bda274','#d3c39d','#b4b496'];queue(id,slot.center,TRAIN_CHARGE_HALF_EXTENTS,preparationBox(slot.center,TRAIN_CHARGE_HALF_EXTENTS,child.sealed?colors[number-1]:'#8e8365',{number}),{owner:child.owner,location:'crate',siteId:'quarry-charge-worktop',displayNumber:number});}
   }
   const tin=objects['cap-tin'];if(atStore(tin)){
    const opened=typeof tin.openingEventId==='string'&&s.campaign.missions['snowbound-the-names-they-took'].rival.continuation.events.some(e=>e.id===tin.openingEventId&&e.kind==='open-tin');
    queue(tin.id,PreparationCamp.TRAIN_TIN_CENTER,PreparationCamp.TRAIN_TIN_SHAPE,preparationBox(PreparationCamp.TRAIN_TIN_CENTER,PreparationCamp.TRAIN_TIN_SHAPE,'#526f6c',{openTop:opened}),{owner:tin.owner,location:'station',siteId:'quarry-charge-worktop',opened});
    if(opened)for(const unit of tin.primers||[]){const slot=PreparationCamp.TRAIN_PRIMER_SLOTS[unit.id];if(!slot||unit.location.type!=='tin'||unit.location.targetId!==tin.id)continue;let actual;try{actual=resolveFixedRef(s,{sourceMissionId:'snowbound-the-names-they-took',objectId:unit.id},'game-primer');}catch{continue;}if(actual!==unit)continue;queue(unit.id,slot.center,slot.halfExtents,preparationBox(slot.center,slot.halfExtents,unit.state==='damaged'?'#605d57':'#d4b781'),{location:'tin',siteId:'quarry-charge-worktop',state:unit.state});}
   }
  }
  if(sites['ruth-wiring-case-stand'])for(const[id,slot]of Object.entries(PreparationCamp.TRAIN_KIT_SLOTS)){const item=s.campaign.missions[TRAIN].train.powder.kit[id];if(item?.location.type==='container'&&item.location.targetId===TRAIN_TOOL_CASE.id)queue(id,slot.center,slot.halfExtents,preparationBox(slot.center,slot.halfExtents,item.kind==='wire-spool'?'#8d896b':item.kind==='game-fuse'?'#b3a681':'#54736b'),{owner:item.owner,location:'container',siteId:'ruth-wiring-case-stand'});}
  if(sites['ada-mending-worktop']){
   const min=Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b[k]))])),max={x:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.x+b.w)),y:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.y+b.h)),z:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.z+b.height))},center=Object.fromEntries(['x','y','z'].map(k=>[k,(min[k]+max[k])/2])),half=Object.fromEntries(['x','y','z'].map(k=>[k,(max[k]-min[k])/2]));
   queue(TRAIN_MASK_SOURCE.id,center,half,TRAIN_MASK_BASKET_SOLIDS.flatMap(board=>solid(board,'#9c8260')),{location:'station',siteId:'ada-mending-worktop',source:true});
   const issued=s.campaign.missions['snowbound-the-names-they-took'].rival.continuation.events.some(e=>e.kind==='issue-mask');if(!issued&&!s.itemInstances?.[TRAIN_MASK_ID])queue(TRAIN_MASK_ID,TRAIN_MASK_FOLDED_CENTER,TRAIN_MASK_SHAPE.folded,preparationBox(TRAIN_MASK_FOLDED_CENTER,TRAIN_MASK_SHAPE.folded,TRAIN_MASK_SHAPE.color),{owner:'ada',location:'source-basket',siteId:'ada-mending-worktop',source:true});
  }
 }
 function drawMaterials(r,s,siteId){diagnostics={at:s.elapsed,view:'material-closeup',actors:[],objects:[],contacts:[],guidance:[],surfaces:[],errors:[]};if(s.region==='snowbound')drawPreparationObjects(r,s,siteId);}
 return{update,draw,drawMaterials,handles:ownsTrainCampActor,inspect:()=>copy(diagnostics),humanRig:id=>humans.get(id)?.h.rig};
}
