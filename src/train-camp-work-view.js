/** Presentation-only framing for the actual declared stove-room work. This
 * owns neither people/props nor movement, time, custody or mission outcomes. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_BRIEFING_TABLE as TABLE,TRAIN_BRIEFING_PAPER_CONTACTS as PAPERS} from '../content/campaign/train-camp.js';
import {activeTrainCampWorkPose} from './train-camp-presentation.js';
import {TRAIN_PREPARATION_SOLIDS} from '../content/campaign/train-preparation-camp.js';
import {getPreparationWorkPose} from './train-preparation-work.js';
const finite=Number.isFinite,point=p=>p&&['x','y','z'].every(k=>finite(p[k]));
const root=a=>({x:a.x,y:a.y,z:a.z||0});

function preparationContext(s,r,p){
 const prep=r.train.preparation;if(r.mission.stage!==2||r.train.preparationVersion!==1||!prep)return null;
 const requested=prep.work&&({inspectChild:'quarry-charge-worktop',openTin:'quarry-charge-worktop',inspectTin:'quarry-charge-worktop',issueKit:'ruth-wiring-case-stand',inspectKit:'ruth-wiring-case-stand',issueMask:'ada-mending-worktop'})[prep.work.kind];if(prep.work&&!requested)return null;
 const candidates=TRAIN_PREPARATION_SOLIDS.filter(site=>prep.campSetup?.sites?.[site.id]&&(!requested||site.id===requested)).map(site=>({site,distance:Math.hypot(p.x-site.x-site.w/2,p.y-site.y-site.h/2)})).filter(row=>row.distance<=110).sort((a,b)=>a.distance-b.distance),site=candidates[0]?.site;if(!site)return null;
 const mask=site.id==='ada-mending-worktop',ids=mask?['mara','ada']:['mara','ruth'],participants=ids.map(id=>s.entities[id]).filter(a=>a&&a.hp>0&&!a.hidden&&!a.departed&&a.regionId==='snowbound'&&point(root(a))&&Math.hypot(a.x-site.x-site.w/2,a.y-site.y-site.h/2)<=150),points=[];
 for(const x of[site.x,site.x+site.w])for(const y of[site.y,site.y+site.h])for(const z of[site.z,site.z+site.height+16])points.push({x,y,z});
 for(const a of participants){points.push(root(a),{x:a.x,y:a.y,z:(a.z||0)+66});const work=getPreparationWorkPose(s,a.id);if(work?.contact)points.push({...work.contact});}
 let caption=mask?'Ask Ada about the windwrap.':site.id==='quarry-charge-worktop'?'Inspect each numbered bundle and the separate tin.':'Open and count Ruth’s actual wiring case.';
 if(prep.work)caption=prep.work.kind==='inspectChild'?`Inspect original bundle ${prep.work.args.objectId.slice(-1)} with Ruth.`:({openTin:'Let Ruth open her one cap tin.',inspectTin:'Count the actual units in the separate tin.',issueKit:'Open Ruth’s case together.',inspectKit:'Count the wire and separate tools.',issueMask:'Meet Ada’s hands above the mending basket.'})[prep.work.kind]||'Finish the current preparation work.';
 return{key:`train-preparation:${site.id}`,phase:prep.work?.kind||'preparation',caption:(s.replayCanonical?'Mission replay · ':'')+caption,actorIds:participants.map(a=>a.id),points};
}

export function trainCampWorkContext(s){
 const r=s?.campaign?.missions?.[TRAIN_ID],b=r?.train?.briefing,p=s?.entities?.mara;
 if(s?.campaign?.activeMissionId!==TRAIN_ID||s.region!=='snowbound'||s.failure||!p||p.hp<=0||!point(root(p)))return null;
 if(r.mission.stage===2)return preparationContext(s,r,p);
 if(r.mission.stage!==1||r.train.briefingVersion!==1||!b||Math.hypot(p.x-TABLE.x,p.y-TABLE.y)>150)return null;
 const participants=['mara','tomas','della'].map(id=>s.entities[id]).filter(a=>a&&a.hp>0&&!a.hidden&&!a.departed&&a.regionId==='snowbound'&&point(root(a))&&Math.hypot(a.x-TABLE.x,a.y-TABLE.y)<=150);
 const points=[];
 for(const x of[-TABLE.width/2,TABLE.width/2])for(const y of[-TABLE.depth/2,TABLE.depth/2])for(const z of[0,TABLE.height])points.push({x:TABLE.x+x,y:TABLE.y+y,z:TABLE.z+z});
 for(const a of participants){points.push(root(a),{x:a.x,y:a.y,z:(a.z||0)+(a.mounted?110:66)});const work=activeTrainCampWorkPose(s,a);if(work)points.push({...work.contact});}
 const handoff=participants.some(a=>activeTrainCampWorkPose(s,a)?.kind==='handoff'),layout=b.paperWork;
 let phase='briefing',caption='Bring each original to the table.';
 if(b.setup.finishedAt===null){phase='setup';caption='Give Tomas and Della room to open the table.';}
 else if(handoff){phase='handoff';caption='Hold both originals beside Tomas.';}
 else if(layout){phase='layout';caption=`Give Tomas room for the original ${layout.objectId==='route-diagram'?'route diagram':'seizure list'}.`;}
 else if(Object.entries(PAPERS).every(([id,slot])=>{const object=s.campaign.missions[RIVAL_ID]?.objects?.[id];return object?.owner==='tomas'&&object.location?.type==='station'&&object.location.targetId===slot.id&&object.location.regionId==='snowbound';}))caption='Speak beside the originals.';
 return{key:'train-stove-room',phase,caption:(s.replayCanonical?'Mission replay · ':'')+caption,actorIds:participants.map(a=>a.id),points};
}

/** Focus targets are world points; camera x/y are projected offsets. This
 * computes the exact ordinary orthographic focus for a measured safe area. */
export function frameTrainCampWork(context,{view,width,height,safeRect}){
 if(!context||!Array.isArray(context.points)||!context.points.length||!context.points.every(point)||typeof view?.p!=='function'||typeof view.toGround!=='function'||![width,height].every(v=>finite(v)&&v>0)||!safeRect||!['left','right','top','bottom'].every(k=>finite(safeRect[k]))||safeRect.left<0||safeRect.top<0||safeRect.right>width||safeRect.bottom>height||safeRect.right<=safeRect.left||safeRect.bottom<=safeRect.top)return null;
 const projected=context.points.map(p=>view.p(p.x,p.y,p.z));if(projected.some(p=>!p.every(finite)))return null;
 const bounds={left:Math.min(...projected.map(p=>p[0])),right:Math.max(...projected.map(p=>p[0])),top:Math.min(...projected.map(p=>p[1])),bottom:Math.max(...projected.map(p=>p[1]))};
 const center=[(bounds.left+bounds.right)/2,(bounds.top+bounds.bottom)/2],desired=[(safeRect.left+safeRect.right)/2,(safeRect.top+safeRect.bottom)/2],ground=view.toGround(center[0]+width/2-desired[0],center[1]+height/2-desired[1]);
 if(!ground||!ground.every(finite))return null;
 return{context:context.key,phase:context.phase,focus:{x:ground[0],y:ground[1],z:0},fits:bounds.right-bounds.left<=safeRect.right-safeRect.left&&bounds.bottom-bounds.top<=safeRect.bottom-safeRect.top,bounds,safeRect:{...safeRect}};
}

/** Convert actual CSS element bounds through the engine's real pixel scale,
 * device ratio and letterboxing; no CSS coordinate is treated as world XY. */
export function campWorkLogicalRect(screen,rect){
 const canvas=screen?.canvas?.getBoundingClientRect?.();
 if(!canvas||!rect||![screen.S,screen.dpr].every(v=>finite(v)&&v>0)||!['OX','OY','W','H'].every(k=>finite(screen[k]))||!['left','right','top','bottom'].every(k=>finite(rect[k]))||rect.right<=rect.left||rect.bottom<=rect.top)return null;
 const x=v=>((v-canvas.left)*screen.dpr-screen.OX)/screen.S,y=v=>((v-canvas.top)*screen.dpr-screen.OY)/screen.S;
 return{left:Math.max(0,x(rect.left)),right:Math.min(screen.W,x(rect.right)),top:Math.max(0,y(rect.top)),bottom:Math.min(screen.H,y(rect.bottom))};
}

export function createTrainCampWorkView(doc){
 const objective=doc?.querySelector?.('.objective');if(!objective)throw new TypeError('The ordinary objective panel is required');
 const toggle=doc.createElement('button'),caption=doc.createElement('p');toggle.id='camp-objective-toggle';toggle.type='button';toggle.hidden=true;toggle.setAttribute('aria-controls','objective-text mission-detail mission-progress');caption.id='camp-work-caption';caption.hidden=true;objective.append(caption,toggle);
 let expanded=false,lastState=null,lastScreen=null,lastKey=null,safeRects=[];
 function sync(s,{screen}){
  const context=trainCampWorkContext(s);if(s!==lastState||context?.key!==lastKey)expanded=false;lastState=s;lastScreen=screen;lastKey=context?.key??null;
  doc.body.classList.toggle('camp-work-view',!!context);doc.body.classList.toggle('camp-work-expanded',!!context&&expanded);toggle.hidden=caption.hidden=!context;
  if(!context){safeRects=[];return null;}
  caption.textContent=context.caption;toggle.textContent=expanded?'Less':'More';toggle.setAttribute('aria-label',expanded?'Show compact objective':'Show full objective');toggle.setAttribute('aria-expanded',String(expanded));
  let top=12,bottom=screen.H-12;
  const measure=selector=>{const el=doc.querySelector(selector);if(!el||el.hidden||el.closest?.('[hidden]'))return null;return campWorkLogicalRect(screen,el.getBoundingClientRect());};
  for(const selector of ['.topbar','.objective']){const r=measure(selector);if(r&&r.right>r.left&&r.bottom>r.top)top=Math.max(top,r.bottom+12);}
  for(const selector of ['.bottom-hud','.interaction-area','#joystick','.touch-actions','#notices']){const r=measure(selector);if(r&&r.right>r.left&&r.bottom>r.top&&r.top>screen.H*.45)bottom=Math.min(bottom,r.top-12);}
  const controls=measure('#campaign-controls'),base={left:12,right:screen.W-12,top,bottom};safeRects=[base];
  if(controls&&controls.right>controls.left&&controls.bottom>controls.top){safeRects=[{...base,top:Math.max(top,controls.bottom+12)}];if(controls.left>screen.W/2)safeRects.push({...base,right:Math.min(base.right,controls.left-12)});}
  safeRects=safeRects.filter(r=>r.right>r.left&&r.bottom>r.top).sort((a,b)=>(b.right-b.left)*(b.bottom-b.top)-(a.right-a.left)*(a.bottom-a.top));return context;
 }
 toggle.addEventListener('click',()=>{expanded=!expanded;if(lastState&&lastScreen)sync(lastState,{screen:lastScreen});});
 return{sync,frame(s,{view,screen}){const context=trainCampWorkContext(s);if(!context)return null;const candidates=safeRects.map(safeRect=>frameTrainCampWork(context,{view,width:screen.W,height:screen.H,safeRect})).filter(Boolean);return candidates.find(frame=>frame.fits)||candidates[0]||null;}};
}
