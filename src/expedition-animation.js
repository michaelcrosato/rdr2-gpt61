// Joint authoring for the northern rescue. All roots/outcomes remain owned by
// the campaign; returned roots and altered joints exist only during drawing.
import { clamp01, smooth, sampleTrack, localFromScreen, jointScreen, solveLimb, contactHand, savePose } from './western-animation.js';

export const mixPoint = (a,b,t) => a.map((n,i)=>n+(b[i]-n)*clamp01(t));
const durations={mount:1.05,dismount:.95,hitch:.95,pat:1,calm:1,lift:1.4,setdown:1.3,handoff:1.55,load:1.8,strap:1.2,unload:1.7,deliver:1.55,stabilize:1.7,care:1.9,rope:1.5,signal:1.2,divert:.9,aid:1.2,pickup:.9};
export function climbGrips(rig,view,root,traversal,project){
  let best=null;
  for(const ahead of[.12,.16,.2,.24,.08]){
    const t=Math.min(1,smooth(traversal.progress)+ahead),xyz=['x','y','z'].map(k=>traversal.from[k]+(traversal.to[k]-traversal.from[k])*t),edge=project(xyz[0],xyz[1],xyz[2]+10),grips=[];
    for(const side of['L','R']){
      const point=[edge[0]+(side==='L'?-5:5),edge[1]],zero=localFromScreen(rig,view,root,point,0),one=localFromScreen(rig,view,root,point,1),sh=rig.J['sh'+side],axis=one.map((n,i)=>n-zero[i]);
      const height=Math.max(14,Math.min(42,axis.reduce((sum,n,i)=>sum+(sh[i]-zero[i])*n,0)/axis.reduce((sum,n)=>sum+n*n,0))),local=localFromScreen(rig,view,root,point,height);
      grips.push({side,point,height,reach:Math.hypot(...local.map((n,i)=>n-sh[i]))/(rig.o.armUpper+rig.o.armLower)});
    }
    const score=Math.max(...grips.map(g=>g.reach));if(!best||score<best.score)best={grips,score};if(score<.97)break;
  }
  return best.grips;
}
export function fitContactRoot(rig,view,root,point,side,height,weight=1) {
  const target=localFromScreen(rig,view,root,point,height);if(!target||weight<=0)return root;
  const sh=rig.J['sh'+side],d=target.map((n,i)=>n-sh[i]),reach=(rig.o.armUpper+rig.o.armLower)*.94;
  if(Math.hypot(...d)<=reach)return root;
  const dz=Math.max(-reach*.9,Math.min(reach*.9,d[2])),xy=Math.hypot(d[0],d[1]),allowed=Math.sqrt(reach*reach-dz*dz);
  if(xy<1e-8)return root;
  const q=jointScreen(rig,view,root,[sh[0]+d[0]/xy*Math.min(xy,allowed),sh[1]+d[1]/xy*Math.min(xy,allowed),sh[2]+dz]);
  return [root[0]+(point[0]-q[0])*weight,root[1]+(point[1]-q[1])*weight];
}
export function lowerTorso(E,rig,drop,lean=0,side=0){
  const feet=[rig.J.footL.slice(),rig.J.footR.slice()];
  for(const key of ['hipC','hipL','hipR','shC','shL','shR','head','elbowL','elbowR','handL','handR']){
    const p=rig.J[key],upper=/sh|head|elbow|hand/.test(key);rig.J[key]=[p[0]+lean*(upper?1:.15),p[1]+side*(upper?1:.2),p[2]-drop];
  }
  for(const [i,sideName]of ['L','R'].entries())solveLimb(E,rig,sideName,feet[i],1,true);
}
export function seatPose(E,rig,view,root,sockets,amount=1,passenger=false,swing=0){
  const seated=[0,0,rig.o.hipZ*.61],shift=seated.map((n,i)=>(n-rig.J.hipC[i])*amount);
  for(const key of Object.keys(rig.J))if(!/^(foot|knee|blade)/.test(key))rig.J[key]=rig.J[key].map((n,i)=>n+shift[i]);
  const hip=jointScreen(rig,view,[0,0],'hipC'),at=[sockets.saddle[0]-hip[0],sockets.saddle[1]-hip[1]];root=mixPoint(root,at,amount);
  for(const side of ['L','R']){
    const foot=sockets['stirrup'+side].slice();if(side==='R'){foot[0]+=Math.sin(swing*Math.PI)*sockets.flip*25;foot[1]-=Math.sin(swing*Math.PI)*40;}
    const local=localFromScreen(rig,view,root,foot,0);if(local)solveLimb(E,rig,side,local,amount,true,[sockets.flip,side==='R'?.8:-.8,.4]);
  }
  if(passenger){lowerTorso(E,rig,.5,-1.5);for(const side of ['L','R'])solveLimb(E,rig,side,[rig.J.shC[0]+2,side==='L'?-1:1,rig.J.hipC[2]+4],1);}
  else contactHand(E,rig,view,root,sockets.reins,'L',36,amount);
  return root;
}
export function createExpeditionAnimator(E){
  const clips=new Map();let stateRef=null,generation=null,seq=0,clock=0;
  function update(dt,state,stream={generation:0,events:[]},reduced=false){
    if(state!==stateRef||generation!==stream.generation){stateRef=state;generation=stream.generation;seq=0;clips.clear();}
    if(!reduced)clock+=dt;
    for(const c of new Set(clips.values()))c.age+=dt;
    for(const [id,c]of clips)if(c.age+1e-9>=c.duration){if(c.next){c.next.age=Math.max(0,c.age-c.duration);clips.set(id,c.next);}else clips.delete(id);}
    for(const event of stream.events||[]){
      if(event.seq<=seq)continue;seq=event.seq;const duration=durations[event.kind];if(!duration)continue;
      const patientClip=clips.get('silas'),wait=event.kind==='strap'&&patientClip?.kind==='load'||event.kind==='care'&&patientClip?.kind==='setdown';
      const id=event.actorId||'mara',prior=clips.get(id),c={...event,age:wait?-Math.max(0,patientClip.duration-patientClip.age):0,duration};
      // A fast accepted strap may still be waiting for the patient's lift when
      // the simulation mounts its driver. Keep both accepted movements visible
      // in order without delaying the real mounted actor or writing save data.
      if(event.kind==='mount'&&prior?.kind==='strap'){prior.next=c;continue;}
      clips.set(id,c);
      if(['lift','setdown','handoff','deliver','load','unload'].includes(event.kind))clips.set('silas',c);
    }
  }
  const clip=id=>clips.get(id);
  function apply(body,rig,root,worldView,context={}){
    const restore=savePose(rig),view=E.charView(worldView),c=clip(body.id),u=c?clamp01(c.age/c.duration):0,diagnostics=[];
    rig.o.cheat=0;rig._cheat=0;
    const hand=(target,side='R',height=32,w=1,fit=true)=>{
      if(fit)root=fitContactRoot(rig,view,root,target,side,height,w);
      const hit=contactHand(E,rig,view,root,target,side,height,w);
      if(hit&&w>.995)diagnostics.push({actorId:body.id,kind:c?.kind||body.traversal?.kind||'contact',side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});return hit;
    };
    const pair=(left,right,height,w)=>{for(let i=0;i<6;i++){root=fitContactRoot(rig,view,root,left,'L',height,w);root=fitContactRoot(rig,view,root,right,'R',height,w);}hand(left,'L',height,w,false);hand(right,'R',height,w,false);};
    const traversal=body.traversal;
    if(traversal&&context.project){
      const t=clamp01(traversal.progress),from=context.project(traversal.from.x,traversal.from.y,traversal.from.z),to=context.project(traversal.to.x,traversal.to.y,traversal.to.z);
      if(traversal.kind==='climb'){
        lowerTorso(E,rig,Math.sin(t*Math.PI)*3,2.1);
        // The campaign interpolates the real collision root along this stone
        // strip. Reach to the next grip without moving that root off the strip.
        for(const grip of climbGrips(rig,view,root,traversal,context.project))hand(grip.point,grip.side,grip.height,Math.sin(t*Math.PI),false);
        // Both feet remain attached to the authored lower/upper surfaces.
        for(const side of ['L','R']){const foot=mixPoint(from,to,smooth(t));foot[0]+=side==='L'?-5:5;
          const local=localFromScreen(rig,view,root,foot,0);if(local){solveLimb(E,rig,side,local,1,true,[2,side==='L'?-.8:.8,1]);const hit=jointScreen(rig,view,root,'foot'+side);diagnostics.push({actorId:body.id,kind:'climb-foot',side:'foot'+side,target:foot,hit,error:Math.hypot(hit[0]-foot[0],hit[1]-foot[1])});}}
      }else if(traversal.kind==='brace'){
        lowerTorso(E,rig,4,-2.4,1.5);const f=Math.min(1,smooth(t)+.06),rail=context.braceSocket||context.project(traversal.from.x+(traversal.to.x-traversal.from.x)*f,traversal.from.y+(traversal.to.y-traversal.from.y)*f-12,traversal.from.z+28);hand(rail,'L',37,1,false);
      }else if(traversal.kind==='crouch')lowerTorso(E,rig,rig.o.hipZ*.35,3);
      else if(traversal.kind==='handoff')lowerTorso(E,rig,1.8,-1.3);
    }
    if(context.sockets&&(body.mounted||context.mounted||c&&['mount','dismount','hitch'].includes(c.kind))){
      let amount=context.seatWeight??1,swing=0;if(c?.kind==='mount'){amount=sampleTrack([[0,0],[.15,0],[.6,1],[1,1]],u);swing=sampleTrack([[0,0],[.32,0],[.7,1],[1,1]],u);}
      else if(c&&['dismount','hitch'].includes(c.kind)){amount=sampleTrack([[0,1],[.24,1],[.82,0],[1,0]],u);swing=sampleTrack([[0,1],[.18,1],[.64,0],[1,0]],u);}
      if(c?.from&&context.project)root=mixPoint(context.project(c.from.x,c.from.y,c.from.z||0),root,smooth(u));
      root=seatPose(E,rig,view,root,context.sockets,amount,false,swing);
      if(amount>.995&&(swing<.005||swing>.995))for(const side of ['L','R']){const target=context.sockets['stirrup'+side],hit=jointScreen(rig,view,root,'foot'+side);diagnostics.push({actorId:body.id,kind:'seat',side:'foot'+side,target,hit,error:Math.hypot(hit[0]-target[0],hit[1]-target[1])});}
    }
    if(c&&context.project){
      const p=c.target?context.project(c.target.x,c.target.y,c.target.z||0):root,w=sampleTrack([[0,0],[.25,1],[.7,1],[1,0]],u);
      if(c.kind==='rope'){lowerTorso(E,rig,w*2,2);pair([p[0]-3,p[1]-17],[p[0]+3,p[1]-17],31,w);}
      else if(c.kind==='stabilize'||c.kind==='care'){lowerTorso(E,rig,rig.o.hipZ*.4*w,3);const socket=context.patientShoulder||[p[0]-5,p[1]-8];pair(socket,[socket[0]+5,socket[1]+2],17,w);}
      else if(c.kind==='strap'){const socket=context.passengerHip||[p[0]-18,p[1]-50];pair([socket[0]-4,socket[1]],[socket[0]+4,socket[1]],33,w);}
      else if(c.kind==='pat'||c.kind==='calm'){hand(context.horseNeck||[p[0]+27,p[1]-55],'R',37,w);}
      else if(c.kind==='signal'){const sh=rig.J.shR;solveLimb(E,rig,'R',[sh[0],sh[1]+.8,sh[2]+rig.o.armUpper+rig.o.armLower-1],w);rig.J.bladeDir=[0,0,1];}
      else if(c.kind==='divert'){solveLimb(E,rig,'L',[rig.J.shC[0]+3,-4,rig.J.shC[2]+5],w);solveLimb(E,rig,'R',[rig.J.shC[0]+3,4,rig.J.shC[2]+5],w);}
      else if(c.kind==='aid'||c.kind==='pickup'){lowerTorso(E,rig,w*4,2);hand([p[0],p[1]-12],'R',25,w);}
      if(['lift','setdown','unload','load','handoff','deliver'].includes(c.kind))lowerTorso(E,rig,Math.sin(u*Math.PI)*7,2);
    }
    if(!c&&!traversal&&!body.mounted&&!body.carrying&&context.exposed&&!context.reducedMotion){const wind=.3+Math.sin(clock*.65)*.12;lowerTorso(E,rig,wind,-wind*2);if(!context.aiming)solveLimb(E,rig,'L',[rig.J.shC[0]+2,-1.5,rig.J.shC[2]+2],wind);}
    if(body.reloadTimer>0&&!body.carrying&&!traversal){
      const sh=rig.J.shR;solveLimb(E,rig,'R',[sh[0]+4,sh[1]+.5,sh[2]-4]);rig.J.bladeDir=[1,0,body.reloadTimer>.3?-.45:0];
      const chamber=jointScreen(rig,view,root,rig.J.handR.map((n,i)=>n+[.7,0,-.4][i]));hand(chamber,'L',rig.J.handR[2]*rig.o.size,1,false);
    }
    else if(context.weaponKind==='coach-gun'&&context.aiming&&!body.carrying&&!traversal&&c?.kind!=='signal'){
      const sh=rig.J.shR;solveLimb(E,rig,'R',[sh[0]+4.5,sh[1]-.3,sh[2]-1]);
      const target=jointScreen(rig,view,root,rig.J.handR.map((n,i)=>n+rig.J.bladeDir[i]*3));hand(target,'L',rig.J.handR[2]*rig.o.size,1,false);
    }
    for(const d of diagnostics){d.hit=jointScreen(rig,view,root,d.side.startsWith('foot')?d.side:'hand'+d.side);d.error=Math.hypot(d.hit[0]-d.target[0],d.hit[1]-d.target[1]);}
    return{get root(){return root;},set root(value){root=value;},restore,diagnostics,hand,view,clip:c};
  }
  return{update,clip,apply,get clock(){return clock;}};
}
