/** Preserved pre-context60-iteration numerical oracle; not current solver. */
import {EPS,length,sub,worldPoint} from '../../../src/rail-foundation/rigid-frame.js';
import {validateCarSpecs,sampleRail} from '../../../src/rail-foundation/rail-consist.js';
export function legacyPlaceConsist(path,specs,headDistance){
 if(!validateCarSpecs(specs))throw new TypeError('Invalid car identities or geometry');const result=[];
 for(let i=0;i<specs.length;i++){
  const c=specs[i];let cursor=headDistance;
  if(i){const lead=result[i-1],prior=specs[i-1],anchor=lead.rearCoupler;const high=lead.cursor-Math.abs(prior.rearCoupler.x)-c.frontCoupler.x;
   if(high<0)throw new RangeError('Consist tail is outside the authored path');let lo=Math.max(0,high-Math.max(c.couplerGap*4+5,(prior.length+c.length)/2)),hi=high;
   const gap=d=>length(sub(worldPoint(sampleRail(path,d).frame,c.frontCoupler),anchor))-c.couplerGap;
   if(gap(hi)>1e-5||gap(lo)<-1e-5)throw new RangeError('Unattainable coupler on this track');
   for(let n=0;n<60;n++){const m=(lo+hi)/2;if(gap(m)>0)lo=m;else hi=m;}cursor=(lo+hi)/2;
  }
  if(cursor+c.frontCoupler.x>path.length+EPS||cursor+c.rearCoupler.x< -EPS)throw new RangeError('Car endpoints exceed the authored rail');const sample=sampleRail(path,cursor),frame=sample.frame;
  result.push({id:c.id,cursor,frame,frontCoupler:worldPoint(frame,c.frontCoupler),rearCoupler:worldPoint(frame,c.rearCoupler),wheelAngle:0,segmentId:sample.segmentId});
 }
 return result;
}
