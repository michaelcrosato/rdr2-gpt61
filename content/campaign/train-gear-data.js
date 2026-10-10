/** One finite original garment. Reading these definitions issues nothing. */
export const TRAIN_MASK_ID='mara-windwrap';
export const TRAIN_MASK_SOURCE=Object.freeze({id:'ada-mending-basket',ownerId:'ada',regionId:'snowbound',x:355,y:1180,z:24,handZ:36,issueSeconds:.9});
export const TRAIN_GEAR_DEFINITIONS=Object.freeze([Object.freeze({id:TRAIN_MASK_ID,kind:'face-covering',name:'Ada’s blue oilcloth windwrap',sourceOwnerId:'ada',sourceBasketId:TRAIN_MASK_SOURCE.id})]);
export const TRAIN_MASK_SHAPE=Object.freeze({folded:Object.freeze({x:3,y:2,z:.2}),worn:Object.freeze({x:6,y:.05,z:4}),color:'#476b85',seam:'#b8b79a'});
// A layered fold fits Mara's actual mouth/cheek plane. It is the same finite
// cloth volume; the original fitted profile remains historical version 1.
export const TRAIN_MASK_FIT_V2=Object.freeze({halfExtents:Object.freeze({x:3.9,y:9.6/(8*3.9*1.15),z:1.15}),forwardHeadRadius:.96,verticalHeadRadius:-.30});
export const TRAIN_MASK_FOLDED_CENTER=Object.freeze({x:355,y:1180,z:33.2});
export const TRAIN_MASK_BASKET_SOLIDS=Object.freeze([
  Object.freeze({id:'ada-basket-base',x:348,y:1176,z:24,w:14,h:8,height:1}),
  Object.freeze({id:'ada-basket-west',x:348,y:1176,z:25,w:1,h:8,height:7}),
  Object.freeze({id:'ada-basket-east',x:361,y:1176,z:25,w:1,h:8,height:7}),
  Object.freeze({id:'ada-basket-front',x:349,y:1176,z:25,w:12,h:1,height:7}),
  Object.freeze({id:'ada-basket-back',x:349,y:1183,z:25,w:12,h:1,height:7}),
]);
export const TRAIN_MASK_APPROACHES=Object.freeze({
  ada:Object.freeze({x:347.5,y:1160,z:0,facing:Math.atan2(20,7.5)-Math.PI/2,pose:'stand',hand:'R'}),
  mara:Object.freeze({x:374.5,y:1180,z:0,facing:Math.PI/2,pose:'stand',hand:'R'}),
});
// New work uses the current whole-native-body clearance. The original
// approaches above remain the exact identity of historical v1 site receipts.
export const TRAIN_MASK_V2_APPROACHES=Object.freeze({
  ada:Object.freeze({x:349,y:1160,z:0,facing:Math.atan2(20,6)-Math.PI/2,pose:'stand',hand:'R'}),
  mara:TRAIN_MASK_APPROACHES.mara,
});
// Current authored work keeps Ada's complete walking body outside the
// worktop and gives Mara a separate reachable side of the original basket.
// Older requested/pending work retains its own unchanged approach version.
export const TRAIN_MASK_V3_APPROACHES=Object.freeze({
  ada:Object.freeze({x:360,y:1159,z:0,facing:0,pose:'stand',hand:'R'}),
  mara:Object.freeze({x:375,y:1190,z:0,facing:Math.atan2(-10,-20)-Math.PI/2,pose:'stand',hand:'R',elbowHint:Object.freeze([1,-1,0])}),
});
