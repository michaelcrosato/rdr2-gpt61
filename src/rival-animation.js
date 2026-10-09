import { clamp01, smooth, jointScreen, contactHand, localFromScreen, savePose, solveLimb } from './western-animation.js';
import { fitContactRoot, lowerTorso, seatPose, mixPoint } from './expedition-animation.js';

const durations={mount:1.05,dismount:.95,hitch:.95,'give-carbine':1.35,'give-lariat':1.2,'give-sightglass':1.2,equip:.95,'store-weapon':.95,'inspect-track':1.15,sightglass:1.15,descend:1.4,signal:1.1,loot:1.3,'search-surrendered':1.3,'inspect-charge':1.5,'pass-charge':1.35,'repack-charge':1.45,'carry-crate':1.4,'load-crate':1.55,'unload-crate':1.45,'give-plans':1.25,'lariat-throw':.7,bind:1.65,tackle:.9,lift:1.55,load:1.75,strap:1.2,unload:1.75,setdown:1.5,handoff:1.65,'holding-transfer':1.7,care:1.6,deposit:1.35,'card-tear':1.1,strike:.55,intervene:.7,'lever-cycle':.35,reload:.95,pat:1,calm:1,'human-collapse':.65};
const aliases={'take-carbine':'give-carbine','take-lariat':'give-lariat','take-sightglass':'give-sightglass','retrieve-longarm':'equip','inspect-carbine':'equip','observe':'sightglass','observe-calder':'sightglass','observe-magazine':'sightglass','observe-weighhouse':'sightglass','observe-entry':'sightglass','search':'inspect-charge','search-body':'loot','inspect-body':'loot','search-prisoner':'search-surrendered','open-charges':'inspect-charge','inspect-crate':'inspect-charge','give-charge':'pass-charge','inspect-cap':'inspect-charge','repack-charges':'repack-charge','lift-crate':'carry-crate','inspect-plans':'give-plans','throw-lariat':'lariat-throw','restrain':'bind','bind-levi':'bind','lift-levi':'lift','load-levi':'load','stow':'load','stow-levi':'load','strap-levi':'strap','unload-levi':'unload','set-down-levi':'setdown','deliver-levi':'handoff','hold-levi':'holding-transfer','care-levi':'care','deposit-crate':'deposit','shoot':'lever-cycle','collapse':'human-collapse'};
const shared=new Set(['lift','load','unload','setdown','handoff','holding-transfer','tackle','bind','strike','intervene']);
const sequential=new Set(['lift','load','unload','setdown','handoff','holding-transfer','strap','load-crate','unload-crate']);
Object.assign(durations,{disarm:.6,grapple:.9,'pickup-weapon':.9,'give-engraved':1.25,'weapon-drop':.5});
Object.assign(durations,{'give-cartridges':1.1,'receive-cartridges':1.1,'give-cap':1.2,'receive-cap':1.2,'receive-plans':1.25});
shared.add('disarm');shared.add('grapple');
export const rivalClipDurations=Object.freeze({...durations});
export function fitRivalSeatFeet(E,rig,view,root,sockets,weight=1){
  for(const side of['L','R']){
    const point=sockets['stirrup'+side],zero=localFromScreen(rig,view,root,point,0),one=localFromScreen(rig,view,root,point,1);if(!zero||!one)continue;
    // A socket has one screen location and a line of native-space solutions.
    // Select the reachable height nearest the hip, rather than forcing every
    // stirrup to the character root's plane and stretching the far-side leg.
    const axis=one.map((n,i)=>n-zero[i]),hip=rig.J['hip'+side],height=axis.reduce((sum,n,i)=>sum+(hip[i]-zero[i])*n,0)/axis.reduce((sum,n)=>sum+n*n,0),target=localFromScreen(rig,view,root,point,height);
    solveLimb(E,rig,side,target,weight,true,[1,side==='L'?-.8:.8,.4]);
  }
}
export function createRivalAnimator(){
  const clips=new Map();let stateRef,generation,seq=0,clock=0;
  function update(dt,state,stream={generation:0,events:[]},reduced=false){
    if(stateRef!==state||generation!==stream.generation){stateRef=state;generation=stream.generation;seq=0;clips.clear();}
    if(!reduced)clock+=dt;
    for(const clip of new Set(clips.values()))clip.age+=dt;
    for(const[id,c]of clips)if(c.age+1e-9>=c.duration){
      if(c.next&&id===c.actorId){c.next.age=Math.max(0,c.age-c.duration);clips.set(id,c.next);if(shared.has(c.next.kind)&&c.next.targetId)clips.set(c.next.targetId,c.next);}
      else if(clips.get(id)===c)clips.delete(id);
    }
    for(const event of stream.events||[]){
      if(event.seq<=seq)continue;seq=event.seq;const kind=aliases[event.kind]||event.kind,duration=durations[kind];if(!duration)continue;
      const c={...event,kind,actorId:event.actorId||'mara',age:0,duration},prior=clips.get(c.actorId);
      // Accepted physical work can be issued during its previous manipulation.
      // Queue it in presentation only; the simulation is never paused, delayed
      // or given another body by this clip stream.
      if(prior&&sequential.has(prior.kind)&&(kind==='mount'||kind==='strap'||sequential.has(kind))){let tail=prior;while(tail.next)tail=tail.next;tail.next=c;continue;}
      clips.set(c.actorId,c);if(shared.has(kind)&&c.targetId)clips.set(c.targetId,c);
    }
  }
  return{update,clip:id=>clips.get(id),get clock(){return clock;},inspect:()=>Object.fromEntries([...clips].map(([id,c])=>[id,{...c}]))};
}

export function prepareRivalHuman(E,body,rig,root,worldView,context={}){
  const restore=savePose(rig),view=E.charView(worldView),clip=context.clip,u=clip?clamp01(clip.age/clip.duration):0,diagnostics=[];
  rig.o.cheat=0;rig._cheat=0;
  const a={body,rig,root,clip,restore,diagnostics,preserveFeet:true};
  const fit=(target,side,height,weight)=>{
    const next=fitContactRoot(rig,view,a.root,target,side,height,weight);
    if(a.preserveFeet){const delta=localFromScreen(rig,view,a.root,next,0);if(delta)for(const key of['shC','shL','shR','head','elbowL','elbowR','handL','handR'])rig.J[key]=rig.J[key].map((n,i)=>n+delta[i]);}
    else a.root=next;
  };
  a.hand=(target,side='R',height=32,weight=1,fitRoot=true,kind=clip?.kind||'contact')=>{
    if(fitRoot)fit(target,side,height,weight);const hit=contactHand(E,rig,view,a.root,target,side,height,weight);
    if(hit&&weight>.995)diagnostics.push({actorId:body.id,kind,side,target:target.slice(),hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});return hit;
  };
  a.pair=(left,right,height=32,weight=1,kind=clip?.kind||'contact')=>{for(let i=0;i<6;i++){fit(left,'L',height,weight);fit(right,'R',height,weight);}a.hand(left,'L',height,weight,false,kind);a.hand(right,'R',height,weight,false,kind);};
  if((context.mounted||body.mounted||clip&&['mount','dismount','hitch'].includes(clip.kind))&&context.sockets){
    let weight=body.mounted||context.mounted?1:0,swing=0;
    if(clip?.kind==='mount'){weight=smooth(clamp01((u-.2)/.7));swing=Math.sin(u*Math.PI);if(clip.from&&context.project)a.root=context.project(clip.from.x,clip.from.y,clip.from.z||0);}
    else if(clip&&['dismount','hitch'].includes(clip.kind)){weight=1-smooth(clamp01((u-.15)/.7));swing=Math.sin(u*Math.PI);if(clip.target&&context.project)a.root=mixPoint(a.root,context.project(clip.target.x,clip.target.y,clip.target.z||0),smooth(u));}
    else if(clip?.kind==='load-crate'){weight=0;if(clip.from&&context.project)a.root=context.project(clip.from.x,clip.from.y,clip.from.z||0);}
    a.root=seatPose(E,rig,view,a.root,context.sockets,weight,false,swing);
    if(Math.abs(swing)<.001)fitRivalSeatFeet(E,rig,view,a.root,context.sockets,weight);
    if(weight>.995&&Math.abs(swing)<.001)for(const side of['L','R']){const target=context.sockets['stirrup'+side],hit=jointScreen(rig,view,a.root,'foot'+side);diagnostics.push({actorId:body.id,kind:'rival-seat',side:'foot'+side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}
  }
  if(body.traversal?.kind==='descend'||clip?.kind==='descend'){
    const t=body.traversal?.progress??u;lowerTorso(E,rig,3.4, -2.2);const hand=rig.J.shL;solveLimb(E,rig,'L',[hand[0]-2,hand[1]-2,hand[2]+3],.8);
    if(context.project&&body.traversal){const route=body.traversal,p=mixPoint([route.from.x,route.from.y,route.from.z||0],[route.to.x,route.to.y,route.to.z||0],smooth(t));for(const side of['L','R']){const target=context.project(p[0]+(side==='L'?-5:5),p[1],p[2]),local=localFromScreen(rig,view,a.root,target,0);solveLimb(E,rig,side,local,1,true);}}
  }
  if(body.crouch&&!body.mounted&&context.cover){lowerTorso(E,rig,context.aiming?.8:2.4,context.aiming?1.5:-.8);}
  if(body.surrendered&&body.hp>0)for(const side of['L','R']){const sh=rig.J['sh'+side];solveLimb(E,rig,side,[sh[0]-1,sh[1]+(side==='L'?-2:2),sh[2]+rig.o.armUpper+rig.o.armLower-1]);}
  if(clip?.kind==='bind'&&clip.targetId===body.id&&clip.actorId!==body.id){const hip=rig.J.hipC;for(const side of['L','R'])solveLimb(E,rig,side,[hip[0]+4,side==='L'?-.8:.8,hip[2]+3]);}
  const work=clip?.actorId===body.id&&context.project&&(clip.target||context.propPoint);
  if(work){
    const point=context.propPoint||context.project(clip.target.x,clip.target.y,clip.target.z||0),weight=smooth(clamp01(u/.24))*(1-smooth(clamp01((u-.8)/.2)));
    if(['loot','search-surrendered','inspect-track','bind','tackle','pickup-weapon'].includes(clip.kind)){
      lowerTorso(E,rig,weight*(clip.kind==='search-surrendered'?2:5),weight*2.3);const contact=context.bodySocket||[point[0],point[1]-12];
      if(clip.kind==='bind')a.pair([contact[0]-3,contact[1]],[contact[0]+3,contact[1]],23,weight,'restraint-knot');else a.hand(contact,'R',clip.kind==='search-surrendered'?31:19,weight,true,clip.kind);
    }else if(['give-carbine','give-lariat','give-sightglass','give-cartridges','receive-cartridges','give-engraved','give-cap','receive-cap','receive-plans','equip','store-weapon','inspect-charge','pass-charge','repack-charge','give-plans','deposit'].includes(clip.kind)){
      lowerTorso(E,rig,weight*1.2,weight*1.5);const height=['give-carbine','give-lariat','give-sightglass'].includes(clip.kind)?36:30;
      a.hand(point,['give-plans','receive-cap'].includes(clip.kind)?'L':'R',height,weight,true,clip.kind);
      if(['inspect-charge','repack-charge'].includes(clip.kind))a.hand([point[0]-9,point[1]],'L',height,weight,true,clip.kind);
    }else if(clip.kind==='strap'){
      lowerTorso(E,rig,weight*1.1,weight);const socket=context.passengerHip||point;a.pair([socket[0]-4,socket[1]],[socket[0]+4,socket[1]],33,weight,'passenger-strap');
    }else if(clip.kind==='care'){
      lowerTorso(E,rig,weight*4,weight*2.1);const socket=context.bodySocket||point;a.pair([socket[0]-3,socket[1]],[socket[0]+3,socket[1]+1],25,weight,'holding-care');
    }else if(['pat','calm'].includes(clip.kind))a.hand(context.horseNeck||point,'R',37,weight,true,clip.kind);
    else if(clip.kind==='signal'){const sh=rig.J.shR;solveLimb(E,rig,'R',[sh[0],sh[1]+1,sh[2]+rig.o.armUpper+rig.o.armLower-1],weight);}
    else if(clip.kind==='strike'||clip.kind==='intervene'){lowerTorso(E,rig,weight,weight*2);a.hand(context.bodySocket||point,'R',34,weight,true,clip.kind);}
    else if(clip.kind==='card-tear'){const socket=context.bodySocket||point;a.pair([socket[0]-3-weight*3,socket[1]],[socket[0]+3+weight*3,socket[1]],34,weight,'debt-card-tear');}
    else if(clip.kind==='disarm'||clip.kind==='grapple'){const socket=context.bodySocket||point;lowerTorso(E,rig,1.5*weight,1.5*weight);a.pair([socket[0]-3,socket[1]],[socket[0]+3,socket[1]],31,weight,clip.kind==='disarm'?'weapon-disarm-contact':'weapon-grapple-contact');}
  }
  if(context.sightglass||clip?.kind==='sightglass'){
    const head=rig.J.head,grip=[head[0]+3,head[1]-.6,head[2]-1];solveLimb(E,rig,'R',grip);solveLimb(E,rig,'L',[grip[0]+3,grip[1]-.2,grip[2]]);
  }
  if(clip?.kind==='lariat-throw'||context.lariat){
    const sh=rig.J.shR,phase=clip?smooth(clamp01(u/.65)):0;solveLimb(E,rig,'R',[sh[0]+4+phase*4,sh[1]+2,sh[2]+(1-phase)*6],1);if(!body.mounted)solveLimb(E,rig,'L',[rig.J.shL[0]+2,-2,rig.J.shL[2]-4]);
  }
  if(clip?.kind==='tackle'&&clip.targetId===body.id&&clip.actorId!==body.id)lowerTorso(E,rig,Math.sin(u*Math.PI)*6,-Math.sin(u*Math.PI)*3);
  if(clip&&['strike','intervene'].includes(clip.kind)&&clip.targetId===body.id&&clip.actorId!==body.id)lowerTorso(E,rig,Math.sin(u*Math.PI)*1.4,-Math.sin(u*Math.PI)*2.4);
  if(clip&&['disarm','grapple'].includes(clip.kind)&&clip.targetId===body.id&&clip.actorId!==body.id)lowerTorso(E,rig,Math.sin(u*Math.PI)*1.8,-Math.sin(u*Math.PI)*1.6);
  return a;
}
