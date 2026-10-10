/** Manual inspection of the SAME Skein after the accepted lead. Component
 * coordinates derive from RivalMountRig's existing tack and coat; no brush,
 * water, feed, medicine or replacement saddle is issued by this metadata. */
const point=(x,y,z=0)=>Object.freeze({x,y,z});
export const TRAIN_STABLE_CARE=Object.freeze({
 actorId:'inez',mountId:'skein',sourceOwnerId:'levi',
 glove:Object.freeze({actorId:'inez',side:'R',kind:'worn-native-glove',color:'#575c43',source:'src/expedition-cast.js:createExpeditionHuman'}),
 elbowHint:Object.freeze([-1,.7,-.2]),approachSpeed:55,contactSpeed:4,reachSeconds:.8,returnSeconds:.8,
 operations:Object.freeze({
  tack:Object.freeze({id:'manual-tack-check',componentId:'near-stirrup-strap',source:'src/rival-rigs.js:RivalMountRig.draw',foot:point(0,30.1),facingOffset:Math.PI,seconds:2,path:Object.freeze([point(0,6.5,39),point(0,6.5,37),point(0,6.5,39)]),zone:Object.freeze({center:point(-1.5,9,34),halfExtents:point(15.5,10,14)})}),
  coat:Object.freeze({id:'manual-coat-observation',componentId:'near-shoulder-coat',source:'src/willow-run-rigs.js:WillowAnimalRig.pose;src/rival-rigs.js:RivalMountRig.draw',foot:point(-3,32),facingOffset:Math.PI,seconds:2,path:Object.freeze([point(-3,10.64,35),point(1,10.64,35),point(-3,10.64,35)]),zone:Object.freeze({center:point(-3,12,32),halfExtents:point(14,10,16)})}),
 }),
});
