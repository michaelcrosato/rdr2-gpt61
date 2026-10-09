/** Native clinic handling. A waist bend rotates the existing upper skeleton;
 * no limb length, physical body root or planted foot is changed to reach.
 */
import {savePose} from './western-animation.js';
import {prepareTrainPose,physicalProjection,createTrainHuman,rigWorldPoint} from './train-native/rigs.js';
import {clearLine} from './campaign-navigation.js';
const clinicHumans=new WeakMap();
export function getClinicBottleHuman(s){
  const entry=clinicHumans.get(s),p=s.campaign?.missions?.['snowbound-what-the-line-carries']?.train?.prelude;
  return entry&&entry.actor===s.entities?.abel&&entry.prelude===p&&entry.previous?.at===s.elapsed&&p?.bottleWork?.finishedAt===null&&p.bottle?.location.type==='carried'?entry.human:null;
}
export function prepareClinicBottlePose(E,human,body,target){
  return physicalProjection(E,()=>{
    const rig=human.rig,restore=savePose(rig),pivot=rig.J.hipC,c=Math.cos(1.15),s=Math.sin(1.15);
    for(const key of ['shC','shL','shR','head','elbowL','elbowR','handL','handR']){
      const joint=rig.J[key],x=joint[0]-pivot[0],z=joint[2]-pivot[2];
      rig.J[key]=[pivot[0]+c*x+s*z,joint[1],pivot[2]-s*x+c*z];
    }
    let pose;
    try{pose=prepareTrainPose(E,human,body,null,{contacts:[{side:'R',kind:'bottle-setdown',target,sourceId:'abel-watch-bottle',usesHeldTool:'abel-watch-bottle'}],freeHands:true});}
    catch(error){restore();throw error;}
    return{...pose,restore(){pose.restore();restore();}};
  });
}
/** A native skeleton supplies the contact proof. Drawing must use the same
 * authored prepareClinicBottlePose action rather than a different reach.
 * Every accepted interval checks both endpoints and conservative interpolated
 * bone capsules against actual camp solids; a fresh grip earns no unseen time.
 */
export function createClinicBottleContactProvider(E,worldFor){
  if(!E?.Humanoid||typeof worldFor!=='function')throw new TypeError('Native clinic world and skeleton are required');
  const cache=new WeakMap();
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
  return function clinicBottleContact(s,request){
    const actor=s.entities?.abel,p=s.campaign?.missions?.['snowbound-what-the-line-carries']?.train?.prelude;
    if(!actor||actor.hp<=0||actor.mounted||actor.attachment||actor.toolHeld!==request.objectId||p?.bottle?.location.type!=='carried'||p.bottle.location.targetId!=='abel'||request.actorId!=='abel'||request.hand!=='R'||!Number.isFinite(request.start)||!Number.isFinite(request.finish)||request.finish!==s.elapsed||request.finish<=request.start||request.finish-request.start>.1+1e-7)return null;
    const world=worldFor(s);if(!world||world.id!=='snowbound')return null;
    let entry=cache.get(s);if(!entry||entry.actor!==actor||entry.prelude!==p){entry={human:createTrainHuman(E,actor),previous:null,actor,prelude:p};cache.set(s,entry);clinicHumans.set(s,entry);}
    const dt=request.finish-request.start,body={...actor,pose:'kneel'};entry.human.rig.update(dt,body);
    const pose=prepareClinicBottlePose(E,entry.human,body,request.target);
    try{
      const joints=physicalProjection(E,()=>['shR','elbowR','handR'].map(id=>rigWorldPoint(entry.human.rig,pose.root,id))),old=entry.previous;
      const reachable=pose.diagnostics.every(c=>c.reachable&&c.error<=1e-5),handUsable=pose.diagnostics.every(c=>!c.blocked);
      let sweptClear=!!old&&Math.abs(old.at-request.start)<=1e-7&&old.reachable&&old.handUsable;
      if(sweptClear){
        const travel=Math.max(...joints.map((p,i)=>Math.hypot(p.x-old.joints[i].x,p.y-old.joints[i].y,p.z-old.joints[i].z))),count=Math.max(1,Math.ceil(travel)),radius=2.5+travel/(count*2);
        if(count>64)sweptClear=false;
        else for(let i=0;i<=count&&sweptClear;i++){
          const at=joints.map((p,j)=>mix(old.joints[j],p,i/count));
          if(!clearLine(world,at[0],at[1],radius,false)||!clearLine(world,at[1],at[2],radius,false))sweptClear=false;
        }
      }
      entry.previous={at:request.finish,joints,reachable,handUsable};
      return{actorId:'abel',objectId:request.objectId,start:request.start,finish:request.finish,actorPosition:{x:actor.x,y:actor.y,z:actor.z},handPoint:{...joints[2]},target:{...request.target},reachable,sweptClear,handUsable};
    }finally{pose.restore();}
  };
}
