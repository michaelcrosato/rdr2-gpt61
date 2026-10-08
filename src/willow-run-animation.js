import { clamp01, smooth, jointScreen, contactHand, localFromScreen, savePose } from './western-animation.js';
import { fitContactRoot, lowerTorso, seatPose, mixPoint } from './expedition-animation.js';

const durations={mount:1.05,dismount:.95,hitch:.95,lift:1.45,setdown:1.25,load:1.65,unload:1.65,deliver:1.45,'hang-hide':1.3,'lift-hide':1.1,'store-hide':1.1,'equip':.95,'store-bow':.95,'nock-arrow':.35,'skin-start':.7,'skin-finish':.75,'release-bow':.32,'cancel-bow':.4,'take-knife':.85,'pickup':.85,'pat':1,'calm':1,'inspect-track':1.1,'wind-lesson':1.2,'give-bow':1.25,'animal-collapse':.7};
const aliases={'pickup-arrow':'pickup','inspect-sign':'inspect-track','inspect-body':'inspect-track'};
const bodyEvents=new Set(['lift','setdown','load','unload','deliver']);
export const huntClipDurations=Object.freeze({...durations});
export function createHuntAnimator(){
  const clips=new Map();let stateRef,generation,seq=0,clock=0;
  function update(dt,state,stream={generation:0,events:[]},reduced=false){
    if(stateRef!==state||generation!==stream.generation){stateRef=state;generation=stream.generation;seq=0;clips.clear();}
    if(!reduced)clock+=dt;
    for(const c of new Set(clips.values()))c.age+=dt;
    for(const[id,c]of clips)if(c.age+1e-9>=c.duration){if(c.next&&id===c.actorId){c.next.age=Math.max(0,c.age-c.duration);clips.set(id,c.next);}else clips.delete(id);}
    for(const event of stream.events||[]){
      if(event.seq<=seq)continue;seq=event.seq;const kind=aliases[event.kind]||event.kind,duration=durations[kind];if(!duration)continue;
      const c={...event,kind,actorId:event.actorId||'mara',age:0,duration},previous=clips.get(c.actorId);
      if(event.kind==='mount'&&previous&&bodyEvents.has(previous.kind)){previous.next=c;continue;}
      clips.set(c.actorId,c);if(bodyEvents.has(c.kind)&&c.targetId)clips.set(c.targetId,c);
    }
  }
  return{update,clip:id=>clips.get(id),get clock(){return clock},inspect:()=>Object.fromEntries([...clips].map(([id,c])=>[id,{...c}]))};
}
export function prepareHuntHuman(E,body,rig,root,worldView,context={}){
  const restore=savePose(rig),cv=E.charView(worldView),clip=context.clip,u=clip?clamp01(clip.age/clip.duration):0,diagnostics=[];
  rig.o.cheat=0;rig._cheat=0;
  const a={rig,root,body,clip,restore,diagnostics};
  const fit=(target,side,height,w)=>{
    const next=fitContactRoot(rig,cv,a.root,target,side,height,w);
    if(a.preserveFeet){const d=localFromScreen(rig,cv,a.root,next,0);if(d)for(const key of['shC','shL','shR','head','elbowL','elbowR','handL','handR'])rig.J[key]=rig.J[key].map((n,i)=>n+d[i]);}
    else a.root=next;
  };
  a.hand=(target,side='R',height=32,w=1,fitRoot=true,kind=clip?.kind||'support')=>{
    if(fitRoot)fit(target,side,height,w);
    const hit=contactHand(E,rig,cv,a.root,target,side,height,w);
    if(hit&&w>.995)diagnostics.push({actorId:body.id,kind,side,target:target.slice(),hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});return hit;
  };
  a.pair=(left,right,height=32,w=1,kind='carcass-support')=>{for(let i=0;i<6;i++){fit(left,'L',height,w);fit(right,'R',height,w);}a.hand(left,'L',height,w,false,kind);a.hand(right,'R',height,w,false,kind);};
  const riding=context.mounted||body.mounted;
  if((riding||clip?.kind==='mount'||clip?.kind==='dismount')&&context.sockets){
    let weight=riding?1:0,swing=0;
    if(clip?.kind==='mount'){
      weight=smooth(clamp01((u-.2)/.7));swing=Math.sin(u*Math.PI);
      if(context.project&&clip.from)a.root=context.project(clip.from.x,clip.from.y,clip.from.z||0);
    }else if(clip?.kind==='dismount'){
      weight=1-smooth(clamp01((u-.15)/.7));swing=Math.sin(u*Math.PI);
      if(context.project&&clip.target){const end=context.project(clip.target.x,clip.target.y,clip.target.z||0);a.root=mixPoint(a.root,end,smooth(u));}
    }
    a.root=seatPose(E,rig,cv,a.root,context.sockets,weight,false,swing);
    if(weight>.995)for(const side of['L','R']){if(side==='R'&&Math.abs(swing)>.001)continue;const hit=jointScreen(rig,cv,a.root,'foot'+side),target=context.sockets['stirrup'+side];diagnostics.push({actorId:body.id,kind:'driver-seat',side:'foot'+side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}
  }
  if(body.id==='juno'&&!body.carrying&&!riding){
    const J=rig.J;lowerTorso(E,rig,.2,-.25);
    // A resting injured hand has no external contact obligation. Author it in
    // native rig space rather than inventing a projected prop socket.
    const hand=[J.hipC[0]+1,J.hipC[1]+3,J.hipC[2]+4],sh=J.shR;
    const [bend,reached]=E.ik3(sh,hand,rig.o.armUpper,rig.o.armLower,[-1,.7,-.2]);J.elbowR=bend;J.handR=reached;
  }
  if(clip?.kind==='wind-lesson'&&context.project&&clip.target){
    const w=smooth(clamp01(u/.24))*(1-smooth(clamp01((u-.78)/.22))),p=clip.target,at=context.project(p.x,p.y,p.z||0);
    // Point toward the ribbon rather than reaching across the clearing. Keep
    // the seated root and stirrups fixed while the healthy left arm gestures.
    const sh=rig.J.shL,target=localFromScreen(rig,cv,a.root,[at[0],at[1]-40],sh[2]+2);
    if(target){
      const d=target.map((n,i)=>n-sh[i]),length=Math.hypot(...d)||1,reach=(rig.o.armUpper+rig.o.armLower)*.85;
      const end=d.map((n,i)=>sh[i]+n/length*reach),hand=rig.J.handL.map((n,i)=>n+(end[i]-n)*w);
      const [bend,reached]=E.ik3(sh,hand,rig.o.armUpper,rig.o.armLower,[-1,.7,-.2]);rig.J.elbowL=bend;rig.J.handL=reached;
    }
  }
  if(clip&&['pickup','take-knife','hang-hide','lift-hide','store-hide','equip','store-bow','pat','calm','inspect-track','give-bow'].includes(clip.kind)&&context.project&&clip.target){
    const w=smooth(clamp01(u/.24))*(1-smooth(clamp01((u-.78)/.22))),p=clip.target;
    lowerTorso(E,rig,clip.kind==='inspect-track'?3*w:1.5*w,1.2*w);
    const side=body.id==='juno'?'L':clip.kind.includes('hide')?'L':'R';a.hand(context.propPoint||context.project(p.x,p.y,(p.z||0)+(clip.kind==='hang-hide'?48:0)),side,clip.kind==='inspect-track'?15:clip.kind==='give-bow'?38:30,w,clip.kind!=='give-bow');
  }
  return a;
}
