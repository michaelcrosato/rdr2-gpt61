/** Original finite game equipment. No historical engineering specification.
 * Definitions create no possessions. Ruth must physically open her case and
 * hand over its actual contents in the train preparation scene.
 */
export const TRAIN_TOOL_CASE={id:'ruth-wiring-case',ownerId:'ruth',regionId:'snowbound',x:670,y:1295,z:0,handZ:33,openSeconds:1.2};
const inCase={type:'container',targetId:TRAIN_TOOL_CASE.id};
export const TRAIN_KIT_DEFINITIONS=[
  {id:'brass-wire-spool',kind:'wire-spool',name:'Ruth’s counted wire reel',ownerId:'ruth',location:{...inCase},issuedLength:420},
  {id:'brass-circuit-lead',kind:'circuit-lead',name:'Turnout circuit lead',ownerId:'ruth',location:{...inCase}},
  {id:'brass-detonator',kind:'game-detonator',name:'Ruth’s turnout handle',ownerId:'ruth',location:{...inCase}},
  {id:'brass-terminal-pliers',kind:'terminal-tool',name:'Terminal pliers',ownerId:'ruth',location:{...inCase}},
  {id:'brass-fuse-a',kind:'game-fuse',name:'First hinge fuse',ownerId:'ruth',location:{...inCase},fuseSeconds:6},
  {id:'brass-fuse-b',kind:'game-fuse',name:'Second hinge fuse',ownerId:'ruth',location:{...inCase},fuseSeconds:6},
];
export const TRAIN_KIT_IDS=TRAIN_KIT_DEFINITIONS.map(item=>item.id);
export const TRAIN_KIT_SOURCE='ruth-personal-tool-case';

// Original game bundle dimensions, using the same conserved quarry child.
// At exterior socketX87 it spans85..89, touching the door face85 without
// entering the iron. This describes shape, never a new charge or a recipe.
export const TRAIN_CHARGE_HALF_EXTENTS={x:2,y:3,z:6};

// Held/attached placement aligns this box with the target car contact frame,
// independently of the actor torso facing. The wrist transition needs a real
// swept-volume proof; inheriting Juno’s diagonal torso penetrates the door.
