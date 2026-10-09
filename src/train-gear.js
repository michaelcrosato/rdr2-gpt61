/** Original finite clothing. Definitions create no possession. The custody
 * owner issues Ada's one windwrap only after the actual basket handoff. */
import {TRAIN_ID} from '../content/campaign/brass-cutting.js';
import {RIVAL_ID} from '../content/campaign/bellwether-works.js';
import {TRAIN_MASK_ID,TRAIN_GEAR_DEFINITIONS} from '../content/campaign/train-gear-data.js';
export {TRAIN_MASK_ID,TRAIN_MASK_SOURCE,TRAIN_GEAR_DEFINITIONS,TRAIN_MASK_SHAPE,TRAIN_MASK_APPROACHES} from '../content/campaign/train-gear-data.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const isTrainGearRef=ref=>keys(ref,['sourceMissionId','objectId'])&&ref.sourceMissionId===TRAIN_ID&&ref.objectId===TRAIN_MASK_ID;
export function trainGearLocation(location){
  return keys(location,['type','targetId'])&&location.type==='carried'&&location.targetId==='mara'
    ||keys(location,['type','targetId','slot'])&&location.type==='worn'&&location.targetId==='mara'&&location.slot==='face'
    ||keys(location,['type','targetId'])&&location.type==='saddle'&&location.targetId==='copper';
}
/** Pure birth value for the bridge's read-only model derivation, not a writer. */
export function createTrainGearInstance(at,eventId){
  if(!Number.isFinite(at)||at<0||typeof eventId!=='string'||!/^snowbound-the-names-they-took:continued:[1-9][0-9]*$/.test(eventId))throw new TypeError('Actual gear issue time/event required');
  return{...TRAIN_GEAR_DEFINITIONS[0],owner:'mara',location:{type:'carried',targetId:'mara'},issuedAt:at,issueEventId:eventId};
}
export function validateTrainGearInstance(s,item){
  try{
    const c=s.campaign.missions[RIVAL_ID].rival.continuation,t=s.campaign.missions[TRAIN_ID].train,event=c.events.find(e=>e.id===item?.issueEventId),birth=event&&createTrainGearInstance(event.at,event.id);
    return c.gearVersion===1&&t.preparationVersion===1&&Number.isFinite(t.preparation?.startedAt)&&event?.kind==='issue-mask'&&event.at>=t.preparation.startedAt&&event.at>=t.chronicle.acceptedAt&&event.at<=s.elapsed&&keys(item,Object.keys(birth))&&trainGearLocation(item.location)&&same({...item,location:birth.location},birth);
  }catch{return false;}
}
export function validateTrainGear(s){
  try{
    const c=s.campaign.missions[RIVAL_ID].rival.continuation,item=s.itemInstances?.[TRAIN_MASK_ID],issues=c.events.filter(e=>e.kind==='issue-mask');
    if(c.gearVersion===undefined)return item===undefined&&issues.length===0;
    return c.gearVersion===1&&issues.length===1&&validateTrainGearInstance(s,item);
  }catch{return false;}
}
export const trainFaceCovered=(s,actorId='mara')=>actorId==='mara'&&validateTrainGearInstance(s,s.itemInstances?.[TRAIN_MASK_ID])&&s.itemInstances[TRAIN_MASK_ID].location.type==='worn';
