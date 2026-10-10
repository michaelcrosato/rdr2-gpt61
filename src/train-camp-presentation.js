/** Native presentation for the SAME new clinic residents and watch bottle.
 * No arrival, name, possession, body position or clinical progress is written.
 */
import {createTrainHuman,createTrainMount,prepareTrainPose,prepareTrainMountedPose,physicalProjection,drawTrainOutfit,rigWorldPoint} from './train-native/rigs.js';
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
 if(!body||!['mara','ruth','ada'].includes(body.id)||body.hp<=0||state.region!=='snowbound'||body.regionId!=='snowbound'||state.entities?.[body.id]!==body||state.campaign?.activeMissionId!==TRAIN)return null;
 const r=state.campaign.missions[TRAIN],p=r.train?.preparation;if(r.mission.stage!==2||r.train.preparationVersion!==1||!p?.work?.workId)return null;
 const pending=r.train.powder?.pending.find(w=>w.workId===p.work.workId),start=pending&&r.train.powder.physicalEvents.find(e=>e.id===pending.workId),op=pending&&(start?.kind==='preparation-inspection-started'?start.data.operation:inspectCustodyRequest(state,pending.requestId)?.operation),entry=getPreparationWorkPose(state,body.id);
 if(!op?.actorIds.includes(body.id)||op.kind!==pending.kind||!entry||entry.body!==body||entry.at!==state.elapsed||entry.operationKind!==op.kind||!entry.reachable||!entry.usable||!finite(entry.contact))return null;
 return{...entry,kind:'preparation',operationKind:op.kind};
}
export function ownsTrainCampActor(state,body){return !!body&&state.region==='snowbound'&&state.entities?.[body.id]===body&&body.regionId==='snowbound'&&(ids.has(body.id)||!!activePreparationCampWorkPose(state,body)||!!activeTrainCampWorkPose(state,body));}
/** Replaces only old decorative resource proxies once the same actual store
 * fixture is latched. People, mounts and the earlier room remain unchanged. */
export function ownsPreparationCampProp(state,prop){return state.region==='snowbound'&&['ruth-charge-store','ruth-cap-store'].includes(prop.id)&&preparedCampSite(state,'quarry-charge-worktop');}
const prelude=s=>s.campaign?.missions?.[TRAIN]?.train?.prelude;

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
 const humans=new Map(),mounts=new Map();let diagnostics={at:null,actors:[],objects:[],contacts:[],guidance:[],errors:[]},updated=new WeakSet();
 function human(body){if(humans.get(body.id)?.body!==body)humans.set(body.id,{body,h:createTrainHuman(E,body)});return humans.get(body.id).h;}
 function mount(body){if(mounts.get(body.id)?.body!==body){const rig=createTrainMount(E,body);rig.update(0,body,!!reduceMotion());mounts.set(body.id,{body,rig});}return mounts.get(body.id).rig;}
 function visualBody(body){return{...body,z:0,vx:body.mounted?0:body.vx||0,vy:body.mounted?0:body.vy||0,vz:body.mounted?0:body.vz||0,pose:body.hp<=0?'die':body.pose||(body.crouch?'crouch':null)};}
 function currentHuman(s,body){const work=activePreparationCampWorkPose(s,body)||activeTrainCampWorkPose(s,body);if(work)return{h:work.human,shared:true,work};const shared=body.id==='abel'?getClinicBottleHuman(s):null;if(shared)return{h:shared,shared:true};const h=human(body);if(!updated.has(h)){h.rig.update(0,visualBody(body));updated.add(h);}return{h,shared:false};}
 function update(dt,s){
  if(!Number.isFinite(dt)||dt<0)return;
  for(const body of Object.values(s.entities||{})){
   if(!ownsTrainCampActor(s,body)||body.hidden||body.departed||body.escaped)continue;
   if(body.id==='rivet')mount(body).update(dt,body,!!reduceMotion());
   else if(!(body.id==='abel'&&getClinicBottleHuman(s))&&!activePreparationCampWorkPose(s,body)&&!activeTrainCampWorkPose(s,body)){const h=human(body);h.rig.update(dt,visualBody(body));updated.add(h);}
  }
 }
 function draw(r,s){
  diagnostics={at:s.elapsed,actors:[],objects:[],contacts:[],guidance:[],errors:[]};
  if(s.region!=='snowbound')return;
  const bottle=prelude(s)?.bottle,visible=body=>!body.hidden&&!body.departed&&!body.escaped&&(!r.visible||r.visible(body.x,body.y,body.z||0,100,160,100));
  const bodies=['rivet','abel','nell','mara','tomas','della','ruth','ada'].map(id=>s.entities?.[id]).filter(body=>ownsTrainCampActor(s,body)&&visible(body));
  for(const body of bodies){
   if(!finite(point(body)))throw new TypeError('Native clinic actor needs its actual finite body');
   r.shadow?.(body.x,body.y,body.id==='rivet'?18:8,.2,'#526d69',body.z||0);
   r.queue(body.x,body.y,body.z||0,g=>physicalProjection(E,()=>{
    if(body.id==='rivet'){const rig=mount(body);rig.pose(body);const result=rig.draw(g,r,body);diagnostics.actors.push({id:body.id,kind:'mount',world:point(body),mark:result.mark});return;}
    const {h,shared,work}=currentHuman(s,body),restore=savePose(h.rig),drawState=['_pitch','_camSide'].map(key=>({key,had:Object.hasOwn(h.rig,key),value:h.rig[key]})),p=prelude(s),held=body.id==='abel'&&bottle?.id==='abel-watch-bottle'&&bottle.location?.type==='carried'&&bottle.location.targetId===body.id;
    let pose;
    try{
     const horse=body.mounted?s.entities?.[body.mountId]:null;
     if(body.mounted&&horse?.id==='rivet'&&horse.hp>0&&!horse.dead&&Math.hypot(horse.x-body.x,horse.y-body.y)<1){pose=prepareTrainMountedPose(E,h,body,horse,mount(horse),{freeHands:body.holstered!==false||!body.equippedWeaponId});}
     else if(body.id==='abel'&&held&&body.pose==='kneel'&&p?.bottleWork?.finishedAt===null){pose=prepareClinicBottlePose(E,h,body,TRAIN_WATCH_BOTTLE_REST);}
     else if(work){pose=prepareTrainPose(E,h,body,null,{contacts:[{side:'R',kind:work.kind==='preparation'?`preparation-${work.operationKind}`:work.kind==='setup'?'briefing-setup':work.kind==='handoff'?'briefing-paper-handoff':'briefing-paper-layout',target:work.contact,elbowHint:work.contactHint}],freeHands:true});}
     else{if(body.mounted)diagnostics.errors.push({id:body.id,kind:'invalid-current-mount'});pose=prepareTrainPose(E,h,body,null);}
     const at=r.w(pose.root.x,pose.root.y,pose.root.z);h.rig.draw(g,...at,r.view);
     if(body.id==='abel')abelOutfit(E,g,r,h,pose.root);else drawTrainOutfit(E,g,r,h,{...body,...pose.root});
     if(held){const side=bottle.location.hand||'R',origin=rigWorldPoint(h.rig,pose.root,'hand'+side);bottleMesh(E,g,r,bottle,origin);diagnostics.objects.push({id:bottle.id,location:'carried',owner:body.id,world:origin,bounds:clinicBottleBounds(origin,bottle.closed)});}
     if(work?.kind==='layout'){
      const original=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects?.[work.objectId];
      if(original?.owner===body.id&&original.location?.type==='carried'&&original.location.targetId===body.id){const grip=rigWorldPoint(h.rig,pose.root,'handR'),plane={...grip,z:grip.z-3};paperMesh(E,g,r,original,plane);diagnostics.objects.push({id:original.id,location:'carried',owner:body.id,world:grip,paperPlane:plane});}
     }
     if(work?.kind==='handoff')for(let index=0;index<work.refs.length;index++){
      const ref=work.refs[index],original=ref.sourceMissionId==='snowbound-the-names-they-took'&&s.campaign?.missions?.[ref.sourceMissionId]?.objects?.[ref.objectId];
      if(original?.owner===body.id&&original.location?.type==='carried'&&original.location.targetId===body.id){const grip=rigWorldPoint(h.rig,pose.root,'handR'),plane={...grip,z:grip.z-3+index*.22};paperMesh(E,g,r,original,plane);diagnostics.objects.push({id:original.id,location:'carried',owner:body.id,world:grip,paperPlane:plane});}
     }
     diagnostics.contacts.push(...pose.diagnostics.map(c=>({...copy(c),actorId:body.id,errorFinite:Number.isFinite(c.error)})));
     for(const c of pose.diagnostics)if(!c.reachable||!Number.isFinite(c.error)||c.error>1e-5)diagnostics.errors.push({id:body.id,kind:'unreached-native-contact',contact:c.kind});
     diagnostics.actors.push({id:body.id,kind:'human',world:point(body),drawRoot:point(pose.root),physicsHuman:shared,rigUpdateSkipped:shared,work:work?.kind||null,operationKind:work?.operationKind||null,...(work?.kind==='preparation'?{elbow:rigWorldPoint(h.rig,pose.root,'elbowR'),contactHint:copy(work.contactHint)}:{})});
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
 function drawPreparationObjects(r,s){
  const sites=Object.fromEntries(PreparationCamp.TRAIN_PREPARATION_SOLIDS.map(site=>[site.id,preparedCampSite(s,site.id)])),objects=s.campaign?.missions?.['snowbound-the-names-they-took']?.objects||{};
  const drawBox=(g,center,half,color,options)=>boxes(E,g,r,center,box=>box(-half.x,-half.y,-half.z,half.x,half.y,half.z,color),options);
  const solid=(g,box,color)=>boxes(E,g,r,{x:0,y:0,z:0},add=>add(box.x,box.y,box.z,box.x+box.w,box.y+box.h,box.z+box.height,color));
  const queue=(id,center,half,fn,data={})=>{if(r.visible&&!r.visible(center.x,center.y,center.z,120,140,80))return;r.queue(center.x,center.y+half.y,center.z-half.z,g=>{fn(g);diagnostics.objects.push({id,world:copy(center),halfExtents:copy(half),...copy(data)});},{occluder:true});};
  for(const site of PreparationCamp.TRAIN_PREPARATION_SOLIDS)if(sites[site.id]){const center={x:site.x+site.w/2,y:site.y+site.h/2,z:site.z+site.height/2},half={x:site.w/2,y:site.h/2,z:site.height/2};queue(site.id,center,half,g=>solid(g,site,'#897657'),{location:'station',siteId:site.id,fixture:true});}
  const atStore=item=>item?.location.type==='station'&&item.location.targetId==='quarry-charge-store'&&item.location.regionId==='snowbound';
  if(sites['quarry-charge-worktop']){
   const crate=objects['charge-crate'];if(atStore(crate)){queue(crate.id,PreparationCamp.TRAIN_CRATE_STORED_CENTER,PreparationCamp.TRAIN_CRATE_SHAPE,g=>{for(const board of PreparationCamp.TRAIN_CRATE_SOLIDS)solid(g,board,'#8b7654');},{owner:crate.owner,location:'station',siteId:'quarry-charge-worktop'});
    for(const[id,slot]of Object.entries(PreparationCamp.TRAIN_CHILD_CONTACTS)){const child=objects[id];if(child?.location.type!=='crate'||child.location.targetId!==crate.id||!crate.chargeIds.includes(id))continue;queue(id,slot.center,TRAIN_CHARGE_HALF_EXTENTS,g=>{drawBox(g,slot.center,TRAIN_CHARGE_HALF_EXTENTS,child.sealed?'#c5b48c':'#8e8365');const top=slot.center.z+TRAIN_CHARGE_HALF_EXTENTS.z+.05;E.px.line(g,...r.w(slot.center.x,slot.center.y-2,top),...r.w(slot.center.x,slot.center.y+2,top),'#56716b',1);},{owner:child.owner,location:'crate',siteId:'quarry-charge-worktop'});}
   }
   const tin=objects['cap-tin'];if(atStore(tin)){
    const opened=typeof tin.openingEventId==='string'&&s.campaign.missions['snowbound-the-names-they-took'].rival.continuation.events.some(e=>e.id===tin.openingEventId&&e.kind==='open-tin');
    queue(tin.id,PreparationCamp.TRAIN_TIN_CENTER,PreparationCamp.TRAIN_TIN_SHAPE,g=>drawBox(g,PreparationCamp.TRAIN_TIN_CENTER,PreparationCamp.TRAIN_TIN_SHAPE,'#a87953',{openTop:opened}),{owner:tin.owner,location:'station',siteId:'quarry-charge-worktop',opened});
    if(opened)for(const unit of tin.primers||[]){const slot=PreparationCamp.TRAIN_PRIMER_SLOTS[unit.id];if(!slot||unit.location.type!=='tin'||unit.location.targetId!==tin.id)continue;let actual;try{actual=resolveFixedRef(s,{sourceMissionId:'snowbound-the-names-they-took',objectId:unit.id},'game-primer');}catch{continue;}if(actual!==unit)continue;queue(unit.id,slot.center,slot.halfExtents,g=>drawBox(g,slot.center,slot.halfExtents,unit.state==='damaged'?'#605d57':'#d4b781'),{location:'tin',siteId:'quarry-charge-worktop',state:unit.state});}
   }
  }
  if(sites['ruth-wiring-case-stand'])for(const[id,slot]of Object.entries(PreparationCamp.TRAIN_KIT_SLOTS)){const item=s.campaign.missions[TRAIN].train.powder.kit[id];if(item?.location.type==='container'&&item.location.targetId===TRAIN_TOOL_CASE.id)queue(id,slot.center,slot.halfExtents,g=>drawBox(g,slot.center,slot.halfExtents,item.kind==='wire-spool'?'#8d896b':item.kind==='game-fuse'?'#b3a681':'#54736b'),{owner:item.owner,location:'container',siteId:'ruth-wiring-case-stand'});}
  if(sites['ada-mending-worktop']){
   const min=Object.fromEntries(['x','y','z'].map(k=>[k,Math.min(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b[k]))])),max={x:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.x+b.w)),y:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.y+b.h)),z:Math.max(...TRAIN_MASK_BASKET_SOLIDS.map(b=>b.z+b.height))},center=Object.fromEntries(['x','y','z'].map(k=>[k,(min[k]+max[k])/2])),half=Object.fromEntries(['x','y','z'].map(k=>[k,(max[k]-min[k])/2]));
   queue(TRAIN_MASK_SOURCE.id,center,half,g=>{for(const board of TRAIN_MASK_BASKET_SOLIDS)solid(g,board,'#9c8260');},{location:'station',siteId:'ada-mending-worktop',source:true});
   const issued=s.campaign.missions['snowbound-the-names-they-took'].rival.continuation.events.some(e=>e.kind==='issue-mask');if(!issued&&!s.itemInstances?.[TRAIN_MASK_ID])queue(TRAIN_MASK_ID,TRAIN_MASK_FOLDED_CENTER,TRAIN_MASK_SHAPE.folded,g=>{drawBox(g,TRAIN_MASK_FOLDED_CENTER,TRAIN_MASK_SHAPE.folded,TRAIN_MASK_SHAPE.color);const c=TRAIN_MASK_FOLDED_CENTER;E.px.line(g,...r.w(c.x-2,c.y,c.z+.25),...r.w(c.x+2,c.y,c.z+.25),TRAIN_MASK_SHAPE.seam,1);},{owner:'ada',location:'source-basket',siteId:'ada-mending-worktop',source:true});
  }
 }
 return{update,draw,handles:ownsTrainCampActor,inspect:()=>copy(diagnostics),humanRig:id=>humans.get(id)?.h.rig};
}
