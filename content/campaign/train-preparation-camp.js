/** Actual original store/case work surfaces. Offsets are relative to the same
 * canonical Rival store; no child, cap or tool is issued by this metadata. */
import {RIVAL_WORLD} from './bellwether-works.js';
import {TRAIN_TOOL_CASE} from './train-equipment.js';
const point=(x,y,z=0)=>Object.freeze({x,y,z}),pose=(x,y,facing)=>Object.freeze({x,y,z:0,facing,pose:'stand',hand:'R'});
export const TRAIN_STORE_SURFACE=Object.freeze({id:RIVAL_WORLD.camp.charges.id,x:750,y:1270,z:24,width:42,depth:26});
export const TRAIN_CRATE_SHAPE=Object.freeze({x:14,y:10,z:8});
export const TRAIN_CRATE_STORED_CENTER=point(756,1268,32);
// The open wooden tray has a base and four rails. Its outer cargo bounds
// remain TRAIN_CRATE_SHAPE; the empty space between rails is not solid wood.
export const TRAIN_CRATE_SOLIDS=Object.freeze([
  Object.freeze({id:'charge-crate-base',x:742,y:1258,z:24,w:28,h:20,height:2}),
  Object.freeze({id:'charge-crate-west-rail',x:742,y:1258,z:26,w:1,h:20,height:14}),
  Object.freeze({id:'charge-crate-east-rail',x:769,y:1258,z:26,w:1,h:20,height:14}),
  Object.freeze({id:'charge-crate-front-rail',x:743,y:1258,z:26,w:26,h:1,height:14}),
  Object.freeze({id:'charge-crate-back-rail',x:743,y:1277,z:26,w:26,h:1,height:14}),
]);
export const TRAIN_STORE_CONTACT=point(755,1268,33);
export const TRAIN_CRATE_GRIP=point(770,1268,37);
export const TRAIN_STORE_MARA=pose(791,1260,Math.PI/2);
export const TRAIN_STORE_MARA_HAND=point(773,1268,37);
export const TRAIN_CHILD_CONTACTS=Object.freeze(Object.fromEntries([747,753,759,765].map((x,i)=>[`quarry-sealed-charge-${i+1}`,Object.freeze({center:point(x,1268,32),grip:point(x,1264,42),approach:pose(x,1244,0)})])));
// A fresh first inspection stands clear of the tack-room wall with Ruth's
// whole walking body. The original contacts remain the historical decoder;
// the child, its grip, tray and Ruth's real arm dimensions stay unchanged.
export const TRAIN_INSPECTION_V2_CONTACTS=Object.freeze(Object.fromEntries(Object.entries(TRAIN_CHILD_CONTACTS).map(([id,slot])=>[id,Object.freeze({...slot,approach:id==='quarry-sealed-charge-1'?pose(753,1244,0):slot.approach})])));
// Version3 raises the observing hand clear of the finite tray rails. Its
// separate player contact stays outside the east rail and within reach of
// the same store. Older requested/started operations retain their own poses.
export const TRAIN_INSPECTION_V3_CONTACTS=Object.freeze(Object.fromEntries(Object.entries(TRAIN_CHILD_CONTACTS).map(([id,slot])=>[id,Object.freeze({...slot,grip:point(slot.grip.x,slot.grip.y,46.2),approach:pose(Math.max(750,Math.min(slot.approach.x,759)),1245,0)})])));
export const TRAIN_INSPECTION_V3_MARA_HAND=point(776.5,1268,37);
export const TRAIN_INSPECTION_V3_MARA_APPROACH=pose(796,1265,Math.PI/2);
export const TRAIN_TIN_CENTER=point(735,1262,27);
export const TRAIN_TIN_SHAPE=Object.freeze({x:3,y:2,z:3});
export const TRAIN_PRIMER_SLOTS=Object.freeze(Object.fromEntries(Array.from({length:6},(_,i)=>[`quarry-primer-${i+1}`,Object.freeze({center:point(733.4+(i%3)*1.6,1261.3+Math.floor(i/3)*1.4,29),halfExtents:point(.4,.4,.6)})])));
export const TRAIN_TIN_APPROACH=pose(741,1247.5,Math.atan2(14.5,-6)-Math.PI/2);
export const TRAIN_TIN_HAND=point(735,1262,33);
export const TRAIN_FIRST_HELD_CENTER=point(738,1262,39);
export const TRAIN_FIRST_HELD_LEFT_HAND=point(738,1256,41);
export const TRAIN_FIRST_PRIMER_HAND=point(733,1262,44);
export const TRAIN_CASE_RUTH=pose(700,1295,Math.PI/2);
export const TRAIN_CASE_RUTH_HAND=point(685,1295,33);
export const TRAIN_CASE_MARA=pose(664,1274,0);
export const TRAIN_CASE_MARA_HAND=point(664,1295,36);
export const TRAIN_CASE_CONTACT=point(TRAIN_TOOL_CASE.x,TRAIN_TOOL_CASE.y,TRAIN_TOOL_CASE.handZ);
// Called speakers travel to actual nearby waiting places. Current holding
// keepers remain at their watch; these do not establish or transfer a duty.
export const TRAIN_PREPARATION_EXCHANGE_APPROACHES=Object.freeze({
  store:Object.freeze({ruth:TRAIN_TIN_APPROACH}),capsWire:Object.freeze({ruth:TRAIN_TIN_APPROACH}),
  holding:Object.freeze({inez:pose(865,1207,Math.PI/2),hob:pose(885,1270,-Math.PI/2)}),
  stable:Object.freeze({inez:pose(785,1215,Math.PI/2),ruth:TRAIN_TIN_APPROACH}),
  loadout:Object.freeze({bastian:pose(540,1155,Math.PI/2)}),
  readiness:Object.freeze({ruth:TRAIN_TIN_APPROACH}),review:Object.freeze({ruth:TRAIN_TIN_APPROACH}),
});
export const TRAIN_PREPARATION_SOLIDS=Object.freeze([
  Object.freeze({id:'quarry-charge-worktop',kind:'worktop',x:729,y:1257,z:0,w:42,h:26,height:24}),
  Object.freeze({id:'ruth-wiring-case-stand',kind:'worktop',x:657,y:1287,z:0,w:26,h:16,height:22}),
  Object.freeze({id:'ada-mending-worktop',kind:'worktop',x:345,y:1173,z:0,w:20,h:14,height:24}),
]);
export const TRAIN_KIT_SLOTS=Object.freeze({
  'brass-wire-spool':Object.freeze({center:point(664,1295,28),halfExtents:point(4.5,2.5,5)}),
  'brass-circuit-lead':Object.freeze({center:point(675,1299,24),halfExtents:point(3,1,1)}),
  'brass-detonator':Object.freeze({center:point(675,1295,26),halfExtents:point(3,2,3)}),
  'brass-terminal-pliers':Object.freeze({center:point(675,1291,27),halfExtents:point(1,1,4)}),
  'brass-fuse-a':Object.freeze({center:point(669,1290,28),halfExtents:point(1,1,5)}),
  'brass-fuse-b':Object.freeze({center:point(669,1300,28),halfExtents:point(1,1,5)}),
});
