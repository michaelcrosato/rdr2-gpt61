/** Original preparation furniture/contacts. The table is introduced only by
 * actual declared briefing setup, with people clear of its future solid. It
 * never changes the earlier Rival argument's room or recorded positions.
 */
export const TRAIN_BRIEFING_TABLE=Object.freeze({id:'train-briefing-table',kind:'briefing-table',x:575,y:1090,z:0,width:70,depth:38,height:27,setupSeconds:1.1});
export const TRAIN_BRIEFING_TABLE_SOLID=Object.freeze({id:TRAIN_BRIEFING_TABLE.id,kind:'work-table',x:540,y:1071,w:70,h:38,z:0,height:27});
export const TRAIN_BRIEFING_APPROACHES=Object.freeze({tomas:{x:625,y:1090,z:0},della:{x:525,y:1090,z:0},mara:{x:575,y:1145,z:0}});
export const TRAIN_BRIEFING_SETUP_APPROACHES=Object.freeze({
  tomas:Object.freeze({x:625,y:1090,z:0,facing:Math.PI/2,pose:'stand',hand:'R',target:Object.freeze({x:610,y:1090,z:30})}),
  della:Object.freeze({x:525,y:1090,z:0,facing:-Math.PI/2,pose:'stand',hand:'R',target:Object.freeze({x:540,y:1090,z:30})}),
});
// The north side of Tomas leaves room for two actual right-hand contacts.
export const TRAIN_BRIEFING_HANDOFF_APPROACH=Object.freeze({x:625,y:1062,z:0});
export const TRAIN_BRIEFING_CASH_APPROACH=Object.freeze({x:820,y:1205,z:0});
export const TRAIN_BRIEFING_PAPER_CONTACTS=Object.freeze({
  'route-diagram':Object.freeze({id:'train-table-diagram',x:565,y:1103,z:27}),
  'seizure-list':Object.freeze({id:'train-table-seizure-list',x:585,y:1103,z:27}),
});

// Keep people outside the solid and separate during individual paper work.
// Palm centres sit3 units above the physical paper plane; fingers meet it.
export const TRAIN_BRIEFING_LAYOUT_APPROACHES=Object.freeze({
  'route-diagram':Object.freeze({x:565,y:1119,z:0,facing:Math.PI,pose:'stand',hand:'R',handTargetZ:30}),
  'seizure-list':Object.freeze({x:585,y:1119,z:0,facing:Math.PI,pose:'stand',hand:'R',handTargetZ:30}),
});
export const TRAIN_BRIEFING_PAPER_HALF_EXTENTS=Object.freeze({x:8,y:5,z:.1});
