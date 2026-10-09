/** Mission rail state uses the same frames for bodies, shots and drawing.
 * Query caches are transient; the complete consist remains in its owning Save.
 */
import {TRAIN_TRACK,TRAIN_CARS,TRAIN_GANGWAYS,TRAIN_MOTION_PROPOSAL} from '../content/campaign/brass-cutting.js';
import {createRailPath,compileCarSpecs,createConsist,advanceConsist,validateConsist,placeConsist} from './rail-foundation/rail-consist.js';
import {immutableSnapshot,createImmutableFrameSource,createAcceptedStepContext} from './rail-foundation/accepted-step-context.js';
import {createGangwayPlatforms} from './rail-foundation/moving-gangways.js';
import {stepRailBody,jumpFromSupport,validateBodySupport} from './rail-foundation/moving-support.js';
import {validPoint} from './rail-foundation/rigid-frame.js';

export const TRAIN_PATH=immutableSnapshot(createRailPath(TRAIN_TRACK));
export const TRAIN_CAR_SPECS=compileCarSpecs(TRAIN_CARS);
export const TRAIN_INITIAL_CURSOR=1100;
const CONSIST_ID='morrow-freight-consist',cache=new WeakMap(),ownedStates=new WeakSet();
const gangwaySpecs=immutableSnapshot(TRAIN_GANGWAYS);
const initialCars=placeConsist(TRAIN_PATH,TRAIN_CAR_SPECS,TRAIN_INITIAL_CURSOR);
const sameKeys=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));

export function createTrainConsist(){
  const state=immutableSnapshot(createConsist(TRAIN_PATH,TRAIN_CAR_SPECS,{id:CONSIST_ID,cursor:TRAIN_INITIAL_CURSOR,speed:TRAIN_MOTION_PROPOSAL.approachSpeed}));ownedStates.add(state);return state;
}
export function validateTrainConsist(value){
  try{
    if(!sameKeys(value,['schema','id','pathId','cursor','speed','brakePressure','time','cars'])||value.id!==CONSIST_ID||value.cursor<TRAIN_INITIAL_CURSOR||!validateConsist(TRAIN_PATH,TRAIN_CAR_SPECS,value))return false;
    if(value.time===0&&(value.cursor!==TRAIN_INITIAL_CURSOR||value.speed!==TRAIN_MOTION_PROPOSAL.approachSpeed||value.brakePressure!==0))return false;
    return value.cars.every((car,i)=>sameKeys(car,['id','cursor','frame','frontCoupler','rearCoupler','wheelAngle','segmentId'])&&Math.abs(car.wheelAngle-(car.cursor-initialCars[i].cursor)/TRAIN_CAR_SPECS[i].wheelRadius)<1e-7);
  }catch{return false;}
}
function joinGeometry(platforms,dt){
  const cars=createAcceptedStepContext(platforms,dt);
  return createAcceptedStepContext([...cars.platforms,...createGangwayPlatforms(cars,gangwaySpecs)],dt);
}
export function trainGeometry(consist){
  if(cache.has(consist))return cache.get(consist);
  if(!validateTrainConsist(consist))throw new TypeError('Invalid owning train motion state');
  const platforms=TRAIN_CAR_SPECS.map((spec,i)=>{
    const frame=immutableSnapshot(consist.cars[i].frame);
    return{id:spec.id,previousFrame:frame,frame,frameAt:createImmutableFrameSource({frame},data=>data.frame,0),surfaces:spec.surfaces,cover:spec.cover,contacts:spec.contacts};
  });
  const geometry=joinGeometry(platforms,0);if(ownedStates.has(consist))cache.set(consist,geometry);return geometry;
}
export function advanceTrainConsist(consist,dt,controls){
  if(!ownedStates.has(consist)&&!validateTrainConsist(consist))throw new TypeError('Invalid owning train motion state');
  // advanceConsist snapshots and validates its inputs before any mutation.
  const next=advanceConsist(TRAIN_PATH,TRAIN_CAR_SPECS,consist,dt,controls,TRAIN_MOTION_PROPOSAL);
  const geometry=joinGeometry(next.platforms,dt),state=immutableSnapshot(next.state);ownedStates.add(state);cache.set(state,geometry);
  return{...next,state,geometry};
}
export function bindTrainJump(body){
  Object.defineProperty(body,'jump',{configurable:true,enumerable:false,value(speed){
    const native=globalThis.My3D2dge?.Body?.prototype?.jump;
    if(!native)throw new Error('The supplied engine must be loaded before native jumping');
    return native.call(this,speed);
  }});
  return body;
}
export function jumpTrainBody(body,geometry,speed=220){
  if(!validPoint(body)||!Number.isFinite(speed)||speed<=0||!geometry||!Number.isFinite(geometry.dt))return false;
  // A restored stationary query has no point-velocity derivative. Wait for the
  // next accepted step rather than silently discarding the train's velocity.
  if(body.attachment||body.mounted||body.hp<=0||body.support&&geometry.dt===0)return false;
  bindTrainJump(body);
  return body.support?jumpFromSupport(body,geometry,geometry.dt,speed):body.jump(speed);
}
export function stepTrainBody(body,geometry,options){return stepRailBody(body,geometry,geometry.dt,options);}
export function validateTrainSupport(body,consist){
  try{return !body.attachment&&validateBodySupport(body,trainGeometry(consist));}catch{return false;}
}
