/** Canonical owned-Copper camp controls. Only an accepted named interaction
 * commits the existing ground-root mount binding. These actions do not claim a
 * continuously animated mount transition or reset any horse/custody history. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {SNOWBOUND_WORLD} from '../content/campaign/snowbound.js';
import {NORTH_CUTTING_WORLD} from '../content/campaign/north-cutting.js';
import {WILLOW_RUN_WORLD} from '../content/campaign/willow-run.js';
import {RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_BRIEFING_TABLE_SOLID} from '../content/campaign/train-camp.js';
import {TRAIN_PREPARATION_SOLIDS} from '../content/campaign/train-preparation-camp.js';
import {blockedAt,clearLine} from './campaign-navigation.js';
import {capturePreparationBodyBounds} from './train-preparation-layout.js';
import {ownsPreparationCopperRecoveryActor} from './train-preparation-copper-recovery.js';
import {preparationNativeBodyParts} from './train-preparation-body-geometry.js';
import {createHeldBox,translateHeldBox,compileHeldBoxSet,heldBoxContacts,createHeldBoxMotion,sweepHeldBox} from './train-held-volume.js';
import {makeFrame} from './rail-foundation/rigid-frame.js';
const EPS=1e-7,copy=structuredClone,P=(x=0,y=0,z=0)=>({x,y,z}),axes=['x','y','z'],worldSets=new Map();
const point=a=>P(a.x,a.y,a.z??0),finite=p=>p&&axes.every(k=>Number.isFinite(p[k])),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),alive=a=>a?.hp>0&&!a.dead&&!a.hidden&&!a.departed;
function active(s){const r=s?.campaign?.missions?.[TRAIN_ID];return s.version===5&&s.region==='snowbound'&&s.campaign.activeMissionId===TRAIN_ID&&r?.status==='active'&&r.mission.stage===2&&r.train?.runtimeVersion===1&&!s.dialog&&!s.failure;}
function canonical(s){const p=s.entities?.mara,h=s.entities?.copper,prep=s.campaign?.missions?.[TRAIN_ID]?.train?.preparation;if(!active(s)||ownsPreparationCopperRecoveryActor(s,'copper')||s.party?.playerId!=='mara'||s.party.mountId!=='copper'||p?.id!=='mara'||p.category!=='player'||h?.id!=='copper'||h.category!=='mount'||!alive(p)||!alive(h)||h.owned!==true||p.regionId!=='snowbound'||h.regionId!=='snowbound'||p.attachment||h.attachment||p.support||h.support||p.carrying||p.toolHeld||p.weaponAction||p.reloadTimer>0||prep?.work||prep?.exchange||!finite(point(p))||!finite(point(h))||p.z!==0||h.z!==0||!Number.isFinite(p.facing??0)||!Number.isFinite(h.facing??0)||!Number.isFinite(h.vx??0)||!Number.isFinite(h.vy??0)||Math.hypot(h.vx??0,h.vy??0)>.01)return null;
  if(Object.values(s.entities).some(a=>a.id!=='mara'&&a.mounted&&a.mountId==='copper'))return null;
  if(p.mounted&&(p.mountId!=='copper'||axes.some(k=>Math.abs(point(p)[k]-point(h)[k])>EPS)))return null;
  return{p,h};
}
function worldSnapshot(s,ctx){const raw=ctx?.worldFor?.(s);if(!raw||raw.id!=='snowbound'||raw.width!==SNOWBOUND_WORLD.width||raw.height!==SNOWBOUND_WORLD.height||!Array.isArray(raw.obstacles))throw new TypeError('Actual camp collision world required');const obstacles=copy(raw.obstacles);for(const o of obstacles)if(!o||typeof o.id!=='string'||!['x','y','w','h'].every(k=>Number.isFinite(o[k]))||o.w<=0||o.h<=0||!Number.isFinite(o.z??0)||!Number.isFinite(o.height??35)||(o.height??35)<0)throw new TypeError('Finite camp collision solid required');
  const t=s.campaign.missions[TRAIN_ID].train,sites=t.preparation?.campSetup?.sites,required=[...SNOWBOUND_WORLD.obstacles,...NORTH_CUTTING_WORLD.camp.obstacles,...WILLOW_RUN_WORLD.camp.obstacles,...RIVAL_WORLD.camp.obstacles,...(t.briefing?.setup.finishedAt!=null?[TRAIN_BRIEFING_TABLE_SOLID]:[]),...TRAIN_PREPARATION_SOLIDS.filter(o=>sites&&Object.hasOwn(sites,o.id))];
  for(const original of required)if(!obstacles.some(o=>o.id===original.id&&['x','y','w','h'].every(k=>o[k]===original[k])&&(o.z??0)===(original.z??0)&&(o.height??35)===(original.height??35)))throw new TypeError('A required actual camp collider is missing or replaced');
  return{id:raw.id,width:raw.width,height:raw.height,obstacles};}
function worldReferences(w){const key=JSON.stringify(w);if(worldSets.has(key))return worldSets.get(key);const refs=Object.freeze(w.obstacles.filter(o=>(o.height??35)>0).map((o,n)=>Object.freeze({box:createHeldBox({id:o.id||'camp-solid:'+n,frame:makeFrame(P(o.x+o.w/2,o.y+o.h/2,(o.z??0)+(o.height??35)/2),P(1,0,0)),halfExtents:P(o.w/2,o.h/2,(o.height??35)/2)}),ownerId:'world'})));if(worldSets.size>=16)worldSets.delete(worldSets.keys().next().value);worldSets.set(key,refs);return refs;}
function clearBodies(rows,ids,w){const own=new Set(ids),refs=[...worldReferences(w)];for(const r of rows)if(r.regionId==='snowbound'&&!own.has(r.id))refs.push(...preparationNativeBodyParts(r,rows).map(box=>({box,ownerId:r.id})));if(!refs.length)throw new TypeError('Complete collision authority required');const set=compileHeldBoxSet(refs,{id:'camp-horse-action'});for(const id of own){const r=rows.find(r=>r.id===id);if(!r||r.regionId!=='snowbound')return false;for(const part of preparationNativeBodyParts(r,rows)){if(part.vertices.some(p=>p.x<0||p.y<0||p.x>w.width||p.y>w.height)||heldBoxContacts(part,set).some(h=>h.interiorOverlap))return false;}}return true;}
function clearGroundApproach(rows,target,w){const own=rows.find(r=>r.id==='mara');if(!own||own.binding.type!=='free')return false;const refs=[...worldReferences(w)];for(const r of rows)if(r.id!=='mara'&&r.rootId!=='copper'&&r.regionId==='snowbound')refs.push(...preparationNativeBodyParts(r,rows).map(box=>({box,ownerId:r.id})));if(!refs.length)throw new TypeError('Complete approach collision authority required');const set=compileHeldBoxSet(refs,{id:'camp-horse-ground-approach'}),delta=P(...axes.map(k=>target[k]-own.point[k]));return preparationNativeBodyParts(own,rows).every(part=>sweepHeldBox(createHeldBoxMotion(part,translateHeldBox(part,delta)),set,{contactMode:'interior'}).clear);}
function plan(s,id,ctx){
  const c=canonical(s);if(!c)return null;const{p,h}=c,w=worldSnapshot(s,ctx);
  if(id==='train:mount-copper'){
    if(p.mounted||distance(p,h)>58||Math.abs(p.z-h.z)>=8||blockedAt(w,h.x,h.y,13)||!clearLine(w,p,h,9,false))return null;
    const target={...p,...point(h),facing:h.facing??0,vx:0,vy:0,crouch:false,...(p.pose==='crouch'?{pose:'stand'}:{}),mounted:true,mountId:'copper'},shadow={...s,entities:{...s.entities,mara:target}},rows=capturePreparationBodyBounds(shadow),members=rows.filter(r=>r.rootId==='copper').map(r=>r.id);
    if(!members.includes('mara')||!members.includes('copper')||!clearBodies(rows,members,w)||!clearGroundApproach(capturePreparationBodyBounds(s),point(h),w))return null;
    return{kind:'mount',p,h,target:point(h),facing:h.facing??0,from:{...point(p),facing:p.facing??0}};
  }
  if(id!=='train:dismount-copper'||!p.mounted)return null;
  for(const radius of[27,35,44])for(const offset of[Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4,Math.PI*.75,-Math.PI*.75]){
    const heading=(h.facing??p.facing??0)+offset,target=P(h.x+Math.cos(heading)*radius,h.y+Math.sin(heading)*radius,h.z);
    if(blockedAt(w,target.x,target.y,9)||!clearLine(w,h,target,9,false))continue;
    const candidate={...p,...target,vx:0,vy:0,mounted:false},shadow={...s,entities:{...s.entities,mara:candidate}},rows=capturePreparationBodyBounds(shadow);
    const standing={...s,entities:{...s.entities,mara:{...p,mounted:false,vx:0,vy:0}}};
    if(clearBodies(rows,['mara'],w)&&clearGroundApproach(capturePreparationBodyBounds(standing),target,w))return{kind:'dismount',p,h,target,facing:p.facing??0,from:{...point(p),z:h.z+23,facing:p.facing??0}};
  }
  return null;
}
export function getTrainCampHorseInteractions(s,ctx){try{const c=canonical(s);if(!c)return[];const id=c.p.mounted?'train:dismount-copper':'train:mount-copper',ready=plan(s,id,ctx);return ready?[{id,label:ready.kind==='mount'?'Mount Copper':'Dismount Copper',targetId:'copper',...point(c.h),distance:distance(c.p,c.h),priority:7}]:[];}catch{return[];}}
export function interactTrainCampHorse(s,id,ctx){
  if(typeof ctx?.present!=='function')return false;let ready;try{ready=plan(s,id,ctx);}catch{return false;}if(!ready)return false;
  const{p,h,target,facing,from,kind}=ready;p.mounted=kind==='mount';if(kind==='mount'){p.mountId='copper';p.crouch=false;if(p.pose==='crouch')p.pose='stand';h.hitched=false;}
  Object.assign(p,target,{facing,vx:0,vy:0});p.route=[];delete p.routeTarget;
  ctx.present(s,kind,kind==='mount'?{...point(h),z:h.z+23}:target,'copper',from,'mara',{sourceId:'mara'});return true;
}
