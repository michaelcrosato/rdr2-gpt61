/** Physical lapped gangways derived from two actual moving deck anchors.
 * A fixed plate/pad design bounds articulation. Invalid spans reject, not warp. */
import {makeFrame,worldPoint,add,scale,sub,length,validPoint} from './rigid-frame.js';
import {frameAt,worldContact,validPlatforms} from './moving-support.js';
import {acceptedStepPlatforms,acceptedStepDuration,immutableSnapshot,createImmutableFrameSource} from './accepted-step-context.js';
const EPS=1e-7;
const bounds=(length,width)=>({min:{x:-length/2,y:-width/2,z:0},max:{x:length/2,y:width/2,z:0}});
export function createGangwayPlatforms(platforms,definitions){
 const accepted=acceptedStepPlatforms(platforms),dt=acceptedStepDuration(platforms);platforms=accepted||platforms;
 if((!accepted&&!validPlatforms(platforms))||!Array.isArray(definitions)||new Set(definitions.map(d=>d?.id)).size!==definitions.length)throw new TypeError('Invalid gangway identities');
 const out=[];
 for(const sourceDefinition of definitions){const d=accepted?immutableSnapshot(sourceDefinition):sourceDefinition;if(!d||typeof d.id!=='string'||!['width','maxSpan','overlap','padOverlap','padOut'].every(k=>Number.isFinite(d[k])&&d[k]>0))throw new TypeError('Invalid gangway geometry');
  const forward=platforms.find(p=>p.id===d.forward?.carId),rear=platforms.find(p=>p.id===d.rear?.carId);if(!forward||!rear||forward.id===rear.id)throw new TypeError('Gangway requires two actual distinct cars');
  const anchor=(p,ref,u)=>worldContact(p,ref.contactId,u);
  const deriveMiddle=u=>{const a=anchor(forward,d.forward,u),b=anchor(rear,d.rear,u),span=length(sub(a,b));if(span> d.maxSpan+EPS||span<EPS)throw new RangeError('Gangway span outside physical design');return makeFrame(scale(add(a,b),.5),sub(a,b));};
  const middle=accepted?createImmutableFrameSource(d,(_,u)=>deriveMiddle(u),dt):deriveMiddle;
  // Verify articulation bounds inside the accepted step, not just at endpoints.
  for(const u of[0,.25,.5,.75,1])middle(u);
  const surface={id:d.surfaceId||'gangway-deck',bounds:bounds(d.maxSpan+2*d.overlap,d.width),oneWay:true};
  out.push({id:d.id,kind:'gangway',parents:[forward.id,rear.id],previousFrame:middle(0),frame:middle(1),frameAt:middle,surfaces:[surface],cover:[],contacts:[]});
  for(const [suffix,parent,ref,insideSign]of[['forward-pad',forward,d.forward,1],['rear-pad',rear,d.rear,-1]]){
   const derivePose=u=>{const f=frameAt(parent,u);return{...f,origin:anchor(parent,ref,u)};},pose=accepted?createImmutableFrameSource(d,(_,u)=>derivePose(u),dt):derivePose,b={min:{x:insideSign>0?-d.padOut:-d.padOverlap,y:-d.width/2,z:0},max:{x:insideSign>0?d.padOverlap:d.padOut,y:d.width/2,z:0}};
   out.push({id:`${d.id}-${suffix}`,kind:'gangway-pad',parents:[parent.id],previousFrame:pose(0),frame:pose(1),frameAt:pose,surfaces:[{id:'pad-deck',bounds:b,oneWay:true}],cover:[],contacts:[]});
  }
 }
 if(new Set([...platforms,...out].map(p=>p.id)).size!==platforms.length+out.length)throw new TypeError('Gangways cannot duplicate an existing support');return out;
}
