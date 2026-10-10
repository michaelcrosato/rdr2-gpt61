/** Original camp lead contacts. These points propose work; they grant no
 * arrival, watch, ownership, care, stock or stable completion. */
const point=(x,y,z=0)=>Object.freeze({x,y,z});
export const TRAIN_STABLE_LEAD=Object.freeze({
  actorId:'inez',mountId:'skein',source:point(680,1280),
  west:point(620,1280),settle:point(620,1318),turnFacing:Math.PI/2,
  leaderLocal:point(42,36),leaderFacingOffset:Math.PI,
  reinLocal:point(42,14,38),halterLocal:point(40,0,51),
  approachSpeed:65,leadSpeed:24,turnSpeed:.6,gripSeconds:.8,
  reinRadius:.5,initialDepartureSolidId:'rival-tack-west',
});
