/** Actual original store/case work surfaces. Offsets are relative to the same
 * canonical Rival store; no child, cap or tool is issued by this metadata. */
import {RIVAL_WORLD} from './bellwether-works.js';
import {TRAIN_TOOL_CASE} from './train-equipment.js';
const point=(x,y,z=0)=>Object.freeze({x,y,z}),pose=(x,y,facing)=>Object.freeze({x,y,z:0,facing,pose:'stand',hand:'R'});
export const TRAIN_STORE_SURFACE=Object.freeze({id:RIVAL_WORLD.camp.charges.id,x:750,y:1270,z:24,width:42,depth:26});
export const TRAIN_CRATE_SHAPE=Object.freeze({x:14,y:10,z:8});
export const TRAIN_CRATE_STORED_CENTER=point(756,1268,32);
export const TRAIN_STORE_CONTACT=point(755,1268,33);
export const TRAIN_CRATE_GRIP=point(770,1268,37);
export const TRAIN_STORE_MARA=pose(781,1260,Math.PI/2);
export const TRAIN_STORE_MARA_HAND=point(773,1268,37);
export const TRAIN_CHILD_CONTACTS=Object.freeze(Object.fromEntries([747,753,759,765].map((x,i)=>[`quarry-sealed-charge-${i+1}`,Object.freeze({center:point(x,1268,32),grip:point(x,1268,41),approach:pose(x,1247.5,0)})])));
export const TRAIN_TIN_CENTER=point(735,1262,27);
export const TRAIN_TIN_SHAPE=Object.freeze({x:3,y:2,z:3});
export const TRAIN_TIN_APPROACH=pose(741,1247.5,Math.atan2(14.5,-6));
export const TRAIN_TIN_HAND=point(735,1262,33);
export const TRAIN_FIRST_HELD_CENTER=point(738,1262,39);
export const TRAIN_FIRST_HELD_LEFT_HAND=point(738,1256,41);
export const TRAIN_FIRST_PRIMER_HAND=point(733,1262,44);
export const TRAIN_CASE_RUTH=pose(700,1295,Math.PI/2);
export const TRAIN_CASE_RUTH_HAND=point(685,1295,33);
export const TRAIN_CASE_MARA=pose(664,1274,0);
export const TRAIN_CASE_MARA_HAND=point(664,1295,36);
export const TRAIN_CASE_CONTACT=point(TRAIN_TOOL_CASE.x,TRAIN_TOOL_CASE.y,TRAIN_TOOL_CASE.handZ);
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
