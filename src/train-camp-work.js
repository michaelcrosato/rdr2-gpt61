/** Native camp hands for the declared briefing. This provider never moves an
 * actor or awards time: the owning work controller accepts each clear interval.
 */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID,RIVAL_WORLD} from '../content/campaign/bellwether-works.js';
import {TRAIN_BRIEFING_TABLE as TABLE,TRAIN_BRIEFING_TABLE_SOLID as SOLID,TRAIN_BRIEFING_SETUP_APPROACHES as SETUP,TRAIN_BRIEFING_PAPER_CONTACTS as PAPERS} from '../content/campaign/train-camp.js';
import {createTrainHuman,prepareTrainPose,physicalProjection,rigWorldPoint} from './train-native/rigs.js';
import {resolveFixedRef,inspectCustodyRequest} from './rival-continuation.js';
import {powderFixedContactRoles,validatePowderCustodyCause} from './train-powder.js';
import {TRAIN_PREPARATION_SOLIDS} from '../content/campaign/train-preparation-camp.js';
const point=a=>({x:a.x,y:a.y,z:a.z||0}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const presentation=new WeakMap(),worlds=new WeakMap();
const bodyStamp=a=>JSON.stringify([a.x,a.y,a.z,a.facing,a.pose,a.crouch,a.mounted,a.hp,a.handInjury,a.injured,a.toolHeld,a.holstered,a.carrying,a.weaponAction,a.attachment,a.reloadTimer,a.reloadWeaponId]);
export function worldForTrainCamp(s,base){
  if(base?.id!=='snowbound')return base;
  const train=s.campaign?.missions?.[TRAIN_ID]?.train,table=train?.briefing?.setup?.finishedAt!=null,sites=train?.preparationVersion===1?train.preparation?.campSetup?.sites:null,props=TRAIN_PREPARATION_SOLIDS.filter(p=>sites&&Object.hasOwn(sites,p.id));if(!table&&!props.length)return base;
  let variants=worlds.get(base);if(!variants){variants=new Map();worlds.set(base,variants);}const key=`${table}/${props.map(p=>p.id).join(',')}`;let world=variants.get(key);
  if(!world){world={...base,obstacles:[...base.obstacles,...(table?[SOLID]:[]),...props]};variants.set(key,world);}return world;
}
export function getTrainCampWorkPose(s,id){const entry=presentation.get(s)?.get(id),body=s.entities?.[id];return entry&&body&&entry.at===s.elapsed&&entry.body===body&&entry.stamp===bodyStamp(body)?entry:null;}
function segmentBox(a,b,box,radius){
  let low=0,high=1;
  for(const [key,min,max]of [['x',box.x-radius,box.x+box.w+radius],['y',box.y-radius,box.y+box.h+radius],['z',(box.z||0)-radius,(box.z||0)+(box.height||35)+radius]]){
    const delta=b[key]-a[key];if(Math.abs(delta)<1e-10){if(a[key]<min||a[key]>max)return false;continue;}
    let t0=(min-a[key])/delta,t1=(max-a[key])/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return false;
  }return true;
}
function clearBones(world,old,current){
  const travel=Math.max(...current.map((p,i)=>distance(p,old[i]))),count=Math.max(1,Math.ceil(travel)),radius=2.5+travel/(2*count);
  if(count>64)return false;
  for(let i=0;i<=count;i++){const joints=current.map((p,j)=>mix(old[j],p,i/count));for(const obstacle of world.obstacles||[])for(const [a,b]of [[0,1],[1,2]])if(segmentBox(joints[a],joints[b],obstacle,radius))return false;}
  return true;
}
export function createTrainCampWorkProvider(E,worldFor){
  if(!E?.Humanoid||typeof worldFor!=='function')throw new TypeError('Native camp skeleton and world are required');
  const states=new WeakMap();
  function cache(s){let c=states.get(s);if(!c){c={humans:new Map(),windows:new Map(),setupRoots:null};states.set(s,c);presentation.set(s,c.humans);}return c;}
  const occupants=s=>Object.values(s.entities).filter(a=>a.regionId==='snowbound'&&!a.hidden&&!a.departed&&['npc','player','enemy','mount','animal'].includes(a.category)).map(a=>({id:a.id,...point(a),radius:a.category==='mount'?13:9,height:53}));
  function handFree(s,id){const a=s.entities[id];return !!a&&a.hp>0&&!a.mounted&&!a.attachment&&!a.carrying&&!a.toolHeld&&!a.weaponAction&&!(a.reloadTimer>0)&&a.holstered!==false;}
  function handUsable(s,id){const a=s.entities[id];return !!a&&!(a.handInjury&&a.injured!==false&&!a.handInjury.recovered&&a.handInjury.side==='right');}
  function native(s,id,target=null){
    const body=s.entities[id];if(!body)return null;const humans=cache(s).humans;let entry=humans.get(id);
    if(!entry||entry.body!==body){entry={body,human:createTrainHuman(E,body),at:null,target:null,joints:null};humans.set(id,entry);}
    const key=JSON.stringify(target),stamp=bodyStamp(body);if(entry.at===s.elapsed&&entry.target===key&&entry.stamp===stamp)return entry;
    const dt=entry.at===null?0:Math.max(0,Math.min(.1,s.elapsed-entry.at));if(entry.at!==s.elapsed||entry.stamp!==stamp)entry.human.rig.update(dt,{...body,pose:body.id==='silas'&&body.attachment?.type==='rest'||body.id==='gideon'&&body.injured?'down':body.pose||(body.crouch?'crouch':null)});
    physicalProjection(E,()=>{const pose=prepareTrainPose(E,entry.human,body,null,{contacts:target?[{side:'R',kind:'camp-work',target}]:[],freeHands:handFree(s,id)});
      try{entry.joints=['shR','elbowR','handR'].map(j=>rigWorldPoint(entry.human.rig,pose.root,j));entry.reachable=pose.diagnostics.every(c=>c.reachable&&c.error<1e-5);entry.usable=handUsable(s,id)&&pose.diagnostics.every(c=>!c.blocked);}finally{pose.restore();}});
    entry.at=s.elapsed;entry.target=key;entry.stamp=stamp;entry.contact=target&&{...target};return entry;
  }
  function fixedContact(s,id){
    const paper=Object.values(PAPERS).find(p=>p.id===id);if(paper&&s.campaign.missions[TRAIN_ID].train.briefing?.setup.finishedAt!=null)return point(paper);
    if(id==='actor:tomas:paper-handoff'){const a=s.entities.mara,b=s.entities.tomas;return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:Math.max(a.z||0,b.z||0)+33};}
    if(id==='station:levi-holding')return{...point(RIVAL_WORLD.camp.holding),z:33};
    return null;
  }
  function locationPoint(s,location){
    if(location.type==='carried'){const entry=cache(s).humans.get(location.targetId);return{...(entry?.at===s.elapsed?entry:native(s,location.targetId)).joints[2]};}
    if(location.type==='station')return fixedContact(s,location.targetId);
    return null;
  }
  function operationEntries(s,op){
    if(op.kind==='move-object'&&op.to?.location.type==='station'){const p=fixedContact(s,op.to.location.targetId);if(!p)return null;return op.actorIds.map(id=>native(s,id,{...p,z:p.z+3}));}
    if(op.kind==='return-papers'){const target=fixedContact(s,'actor:tomas:paper-handoff');return op.actorIds.map(id=>native(s,id,target));}
    if(op.kind==='establish-guard'){const target=fixedContact(s,'station:levi-holding');return op.actorIds.map(id=>native(s,id,target));}
    return null;
  }
  function intervalClear(s,key,start,finish,entries){
    const c=cache(s),prior=c.windows.get(key),current=entries.map(e=>e.joints.map(point)),valid=entries.every(e=>e.reachable&&e.usable&&handFree(s,e.body.id)),world=worldFor(s);
    const old=start===finish?current:prior?.at===start?prior.joints:null;
    const clear=!!world&&valid&&!!old&&entries.every((e,i)=>clearBones(world,old[i],current[i]));
    // Endpoint probes at the finish must not discard the accepted interval.
    c.windows.set(key,{at:finish,joints:current,start,finish,clear});return clear;
  }
  function powderContactWindow(s,op,{start,finish}){
    if(s.region!=='snowbound'||finish!==s.elapsed||finish<start||finish-start>.1+1e-7)return null;
    const entries=operationEntries(s,op);if(!entries)return null;
    const key=JSON.stringify({kind:op.kind,actorIds:op.actorIds,refs:op.refs,to:op.to,options:op.options});
    const actors=entries.map((e,i)=>({id:op.actorIds[i],root:point(e.body),hand:{...e.joints[2]},regionId:e.body.regionId,alive:e.body.hp>0,mounted:!!e.body.mounted,handUsable:e.usable,handFree:handFree(s,e.body.id)}));
    const endpoint=(p,extra)=>{if(!p)throw new TypeError('Absent camp contact');const actor=actors.reduce((best,a)=>!best||distance(a.hand,p)<distance(best.hand,p)?a:best,null);return{...extra,point:p,regionId:'snowbound',actorId:actor.id,maxHandDistance:22};};
    return{start,finish,sweptClear:intervalClear(s,key,start,finish,entries),actors,sources:op.refs.map(ref=>endpoint(locationPoint(s,resolveFixedRef(s,ref).location),{ref})),destinations:op.to?[endpoint(locationPoint(s,op.to.location),{location:op.to.location})]:[],fixedContacts:powderFixedContactRoles(op).map(role=>({...role,point:fixedContact(s,role.id),maxHandDistance:22}))};
  }
  function briefingTableWindow(s,{start,finish}){
    if(s.region!=='snowbound'||finish!==s.elapsed||finish<=start||finish-start>.1+1e-7)return null;
    const entries=['tomas','della'].map(id=>native(s,id,SETUP[id].target)),old=cache(s).setupRoots,current=occupants(s),blocked=current.filter(a=>{
      const from=old?.at===start?old.roots.find(p=>p.id===a.id):null;
      return !from||segmentBox(point(from),point(a),{...SOLID,z:-a.height,height:a.height+TABLE.height},a.radius);
    }).map(a=>a.id);
    return{start,finish,tableId:TABLE.id,sweptClear:intervalClear(s,'table-setup',start,finish,entries),futureSolidClear:blocked.length===0,occupants:blocked,actors:entries.map((e,i)=>({id:['tomas','della'][i],root:point(e.body),hand:{...e.joints[2]},target:{x:SETUP[e.body.id].target.x,y:TABLE.y,z:TABLE.height},reachable:e.reachable,handUsable:e.usable,handFree:handFree(s,e.body.id)}))};
  }
  return{briefingTableWindow,powderContactWindow,fixedContact,handFree,handUsable,pointForLocation:locationPoint,
    prepareNativeActor:native,inspectNativeInterval:intervalClear,
    prepareCampWork(s){
      const train=s.campaign.missions[TRAIN_ID].train;
      if(train.briefing?.setup?.finishedAt===null){const entries=['tomas','della'].map(id=>native(s,id,SETUP[id].target));intervalClear(s,'table-setup',s.elapsed,s.elapsed,entries);cache(s).setupRoots={at:s.elapsed,roots:occupants(s)};}
      for(const work of train.powder?.pending||[]){const op=inspectCustodyRequest(s,work.requestId)?.operation;if(op)powderContactWindow(s,op,{start:s.elapsed,finish:s.elapsed});}
    },
    canContain(s,item,to){return item.kind==='document'&&to.owner==='tomas'&&Object.values(PAPERS).some(p=>p.id===to.location.targetId)&&to.location.type==='station'&&to.location.regionId==='snowbound';},
    authorizeCustodyOp(s,op){const r=s.campaign.missions[TRAIN_ID],b=r.train.briefing;return s.campaign.activeMissionId===TRAIN_ID&&r.mission.stage===1&&b?.setup.finishedAt!=null&&b.acceptedAt===null&&(op.kind==='return-papers'||op.kind==='establish-guard'||op.kind==='move-object'&&op.actorIds.length===1&&op.actorIds[0]==='tomas'&&op.refs.length===1&&op.refs[0].sourceMissionId===RIVAL_ID&&Object.hasOwn(PAPERS,op.refs[0].objectId)&&op.to?.location.targetId===PAPERS[op.refs[0].objectId].id);},
    custodySnapshot(s,{actorIds,refs,destinations}){return{actors:actorIds.map(id=>({id,point:point(s.entities[id])})),sources:refs.map(ref=>({ref,point:locationPoint(s,resolveFixedRef(s,ref).location)})),destinations:destinations.map(location=>({location,point:locationPoint(s,location)}))};},
    validateCustodyCause:validatePowderCustodyCause,
  };
}
