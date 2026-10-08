// Native three-dimensional joints for Willow's animals and supplied humanoids.
// Their body centers are the same geometry used by the physical shot resolver.
import { huntAnimalHitZones } from '../content/campaign/willow-run.js';
import { createExpeditionHuman, drawExpeditionOutfit } from './expedition-cast.js';
import { jointScreen, solveLimb, localFromScreen } from './western-animation.js';
import { fitContactRoot } from './expedition-animation.js';

export function animalLocalPoint(body, point, origin=body) {
  const c=Math.cos(body.facing||0),s=Math.sin(body.facing||0);
  return [(origin.x||0)+point[0]*c-point[1]*s,(origin.y||0)+point[0]*s+point[1]*c,(origin.z||0)+point[2]];
}
export function deerPoseJoints(body) {
  const zones=huntAnimalHitZones({...body,x:0,y:0,z:0,facing:0}),q=id=>{const a=zones.find(z=>z.id===id);return[a.x,a.y,a.z];};
  return {body:q('body'),chest:q('vital'),neck:q('neck'),head:q('head'),rump:[-17,0,21],tail:[-26,0,24]};
}
function convexHull(points){
  const pts=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const low=[],high=[];for(const p of pts){while(low.length>1&&cross(low.at(-2),low.at(-1),p)<=0)low.pop();low.push(p);}for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(high.length>1&&cross(high.at(-2),high.at(-1),p)<=0)high.pop();high.push(p);}low.pop();high.pop();return low.concat(high);
}
export class WillowAnimalRig {
  constructor(E,id,kind='deer'){this.E=E;this.id=id;this.kind=kind;this.phase=0;this.clock=0;this.speed=0;this.fear=0;this.J={};}
  update(dt,body,reduced=false){this.speed=Math.hypot(body.vx||0,body.vy||0);this.phase+=dt*this.speed*.075;if(!reduced)this.clock+=dt;this.fear=Math.max(0,Math.min(1,(body.fear||0)/100));this.pose(body);}
  pose(body){
    const horse=this.kind==='horse',bear=this.kind==='bear',dead=body.dead||body.hp<=0;
    const J=this.J=horse?{body:[-3,0,32],chest:[17,0,34],rump:[-23,0,33],neck:[26,0,45+this.fear*5],head:[37,0,52+this.fear*9],tail:[-38,0,24]}:bear?{body:[0,0,25],chest:[19,0,27],rump:[-22,0,23],neck:[27,0,23],head:[35,0,25],tail:[-29,0,28]}:deerPoseJoints(body);
    for(let i=0;i<4;i++){
      const front=i>=2,side=i%2?1:-1,x=front?(horse?18:bear?17:12):(horse?-22:bear?-19:-16),y=side*(horse?7:bear?10:4.5),hip=[x,y,horse?30:bear?23:19];
      const stride=Math.sin(this.phase+(front?Math.PI:0)+(side>0?Math.PI:0))*(this.speed>2?(horse?12:bear?7:9):0),lift=Math.max(0,Math.sin(this.phase+(front?Math.PI:0)+(side>0?Math.PI:0)))*(this.speed>2?5:0);
      const foot=dead?[x+10,y+side*7,1]:[x+stride,y,lift],a=horse?16:bear?12:10,b=horse?16:bear?12:10;
      const [knee,reached]=this.E.ik3(hip,foot,a,b,[front?-1:1,side*.2,.15]);J['hip'+i]=hip;J['knee'+i]=knee;J['foot'+i]=reached;
    }
    if(dead){
      const standing=Object.fromEntries(Object.entries(J).map(([key,p])=>[key,p.slice()]));
      for(const key of ['body','chest','rump','neck','head','tail'])J[key]=[J[key][0],J[key][1],key==='head'?4:7];
      // Lie on one flank: all four folded legs leave the same side of the
      // torso. Symmetric legs could read as standing at southeast headings.
      for(let i=0;i<4;i++){const front=i>=2,x=J['hip'+i][0];J['hip'+i]=[x,3,i%2?5:9];J['knee'+i]=[x+(front?5:-3),13,4];J['foot'+i]=[x+(front?12:-5),23,1];}
      if(Number.isFinite(body.presentationFall)){const t=Math.max(0,Math.min(1,body.presentationFall)),u=t*t*(3-2*t);for(const key of Object.keys(J))J[key]=J[key].map((n,i)=>standing[key][i]+(n-standing[key][i])*u);}
    }
    return J;
  }
  world(body,p,origin=body){return animalLocalPoint(body,typeof p==='string'?this.J[p]:p,origin);}
  sockets(r,body,origin=body){const at=p=>r.w(...this.world(body,p,origin));return{flip:Math.cos(body.facing||0)<0?-1:1,saddle:at([0,0,44]),stirrupL:at([0,-10,26]),stirrupR:at([0,10,26]),reins:at([24,0,43]),neck:at(this.J.neck),halter:at([40,0,51+this.fear*9]),rear:at([-22,0,44])};}
  draw(g,r,body,options={}) {
    const P=this.E.px,J=this.J,origin=options.origin||body,offset=options.screenOffset||[0,0],scale=options.scale||1,base=r.w(origin.x,origin.y,origin.z||0),world=p=>this.world(body,p,origin);
    const at=p=>{const q=r.w(...world(p));return[base[0]+(q[0]-base[0])*scale+offset[0],base[1]+(q[1]-base[1])*scale+offset[1]];};
    const horse=this.kind==='horse',bear=this.kind==='bear',bracken=this.id==='bracken',dead=body.dead||body.hp<=0,skin=options.skinProgress||0;
    const fur=horse?(bracken?'#664432':'#b08c5d'):bear?'#986246':body.sex==='buck'?'#8b6c4e':'#a08058',light=horse?(bracken?'#98714d':'#ceb080'):bear?'#bb865b':'#c6ae80',dark=horse?'#372f28':bear?'#624331':'#5d5846',belly=skin>0?'#bba58e':horse?'#917154':bear?'#a1704f':'#d0c09a';
    const ops=[],line=(a,b,w,c)=>ops.push({depth:r.view.depth(...world(a))+r.view.depth(...world(b)),draw:()=>P.line(g,...at(a),...at(b),c,w*r.view.scale*scale)}),ell=(p,rx,ry,c)=>ops.push({depth:2*r.view.depth(...world(p)),draw:()=>{
      // A projected native ellipsoid turns with facing, unlike an upright
      // screen ellipse that could visibly disagree with its physical zones.
      const pts=[],rz=ry*.8,wy=Math.min(rx*.48,ry*.8);for(let i=0;i<12;i++){const a=i*Math.PI/6,co=Math.cos(a),si=Math.sin(a);pts.push(at([p[0]+co*rx,p[1]+si*wy,p[2]]),at([p[0]+co*rx,p[1],p[2]+si*rz]),at([p[0],p[1]+co*wy,p[2]+si*rz]));}P.poly(g,convexHull(pts),c);
    }});
    for(let i=0;i<4;i++){line(J['hip'+i],J['knee'+i],horse?4:bear?6:2.8,i%2?fur:dark);line(J['knee'+i],J['foot'+i],horse?3:bear?4:2,i%2?light:dark);ell(J['foot'+i],horse?3:bear?4:2,horse?2:bear?3:1.5,'#3b3d32');}
    ell(J.body,horse?28:bear?30:24,horse?15:bear?18:10,skin>.45?belly:fur);ell(J.rump,horse?14:bear?15:11,horse?13:bear?15:10,skin>.72?belly:light);
    line(J.chest,J.neck,horse?11:bear?16:6,fur);line(J.neck,J.head,horse?10:bear?16:5,light);ell(J.head,horse?11:bear?12:7,horse?7:bear?9:5,light);
    line(J.body,J.chest,horse?17:bear?23:12,skin>.2?belly:fur);
    line(J.rump,J.tail,horse?5:bear?4:2,horse?dark:light);
    ops.sort((a,b)=>a.depth-b.depth);for(const op of ops)op.draw();
    const h=J.head,ears=horse?[[h[0]-4,-4,h[2]+(dead?2:11)],[h[0]-4,4,h[2]+(dead?2:11)]]:bear?[[h[0]-4,-8,h[2]+(dead?2:6)],[h[0]-4,8,h[2]+(dead?2:6)]]:[[h[0]-2,-6,h[2]+(dead?2:8)],[h[0]-2,6,h[2]+(dead?2:8)]];
    for(const ear of ears){P.line(g,...at(h),...at(ear),dark,(bear?4:2)*r.view.scale*scale);P.disc(g,...at(ear),(bear?3:2)*scale,fur);}
    for(const side of [-1,1]){const eye=[h[0]+(horse?4:bear?5:2),side*(horse?5:bear?8:3),h[2]+2],q=at(eye);if(dead)P.line(g,q[0]-1.5*scale,q[1],q[0]+1.5*scale,q[1]+scale,'#2f362e',1);else P.disc(g,...q,1.5*scale,'#2f362e');}
    P.disc(g,...at([h[0]+(horse?10:bear?11:6),0,h[2]-2]),(horse?3:bear?4:2)*scale,dark);
    if(body.sex==='buck'&&!options.noAntlers){for(const side of[-1,1]){const a=[h[0]-3,side*4,h[2]+5],b=[h[0]-8,side*8,h[2]+18],c=[h[0]-14,side*12,h[2]+24];P.line(g,...at(a),...at(b),'#d1bd8d',2);P.line(g,...at(b),...at(c),'#c6aa77',2);for(let i=0;i<3;i++)P.line(g,...at([h[0]-6-i*3,side*(7+i*2),h[2]+14+i*3]),...at([h[0]-1-i*3,side*(11+i*2),h[2]+21+i*4]),'#d5c195',2);}}
    if((body.hunt?.arrowImpacts||0)+(body.hunt?.gunImpacts||0)>0){P.line(g,...at([7,-5,J.chest[2]-1]),...at([12,-5,J.chest[2]-4]),'#885744',2);if(dead)P.disc(g,...at([8,-5,J.chest[2]-3]),2,'#97624e');}
    if(horse&&!dead){
      P.line(g,...at([-25,0,37]),...at([-38,0,15]),dark,5);P.line(g,...at([18,0,35]),...at([27,0,54+this.fear*9]),dark,5);
      if(bracken){const k=J.knee2,f=J.foot2;P.line(g,...at(k.map((n,i)=>n+(f[i]-n)*.75)),...at(f),'#dfd2af',4);}
      const saddle=at([0,0,42]);P.ell(g,...saddle,16,5,'#354a43');P.poly(g,[at([-17,-9,40]),at([14,-9,40]),at([14,9,36]),at([-17,9,36])],bracken?'#435264':'#637754');
      P.line(g,...at([0,-10,42]),...at([0,-10,26]),'#9b805c',2);P.line(g,...at([0,10,42]),...at([0,10,26]),'#9b805c',2);
      for(const side of[-1,1]){const p=at([0,side*10,26]);P.ell(g,...p,4,2,'#c3b792');P.poly(g,[at([-25,side*9,36]),at([-15,side*9,36]),at([-15,side*10,22]),at([-25,side*10,22])],bracken?'#796249':'#a38a63');}
      P.line(g,...at([40,0,51+this.fear*9]),...at([25,0,44]),'#d1bb8c',2);P.line(g,...at([25,0,44]),...at([6,0,42]),'#ae9262',1);
    }
    return {at,world};
  }
}

const huntPalettes={
  orla:{size:1.54,build:'bulky',cloth:'#a0a78c',coat:'#5e7562',pants:'#4b5451',hair:'#928570',skin:'#b8a181',glove:'#9d8c6e',scarf:'#b06349'},
  juno:{size:1.72,build:'heroic',cloth:'#8190a0',coat:'#364f66',pants:'#514d49',hair:'#302e29',skin:'#a18b6f',glove:'#786e55',scarf:'#a45b45'},
  hob:{size:1.6,build:'bulky',cloth:'#9b8571',coat:'#6d4350',pants:'#475052',hair:'#75624c',skin:'#b99b7d',glove:'#847155',scarf:'#bdb092'},
};
export const HUNT_HUMAN_IDS=new Set(['mara','orla','juno','hob']);
export function createWillowHuman(E,id){
  if(!huntPalettes[id])return createExpeditionHuman(E,id);
  const p=huntPalettes[id],colors={...p,boot:'#3c443b',belt:'#796244',trim:'#c6b08b',metal:'#a5b09f'};
  return{id,rig:new E.Humanoid({size:p.size,build:p.build,outfit:'coat',weapon:null,hair:id==='juno'?'long':'short',sleeves:'long',colors,cheat:0}),colors,scarf:p.scarf,armed:false};
}
export function drawWillowOutfit(E,g,root,h,view,actor,state){
  if(!huntPalettes[h.id]){drawExpeditionOutfit(E,g,root,h,view,actor,state);return;}
  const P=E.px,cv=E.charView(view),at=j=>jointScreen(h.rig,cv,root,j),head=at('head'),sh=at('shC'),hip=at('hipC'),l=at('handL'),right=at('handR');
  P.line(g,sh[0]-8,sh[1],sh[0]+8,sh[1],h.scarf,3);
  if(h.id==='orla'){
    P.poly(g,[[head[0]-9,head[1]-5],[head[0]-3,head[1]-11],[head[0]+7,head[1]-8],[head[0]+10,head[1]-1]],h.scarf);P.line(g,head[0]-7,head[1]+1,head[0]-11,head[1]+8,h.scarf,4);
    P.poly(g,[[sh[0]-5,sh[1]+3],[sh[0]+5,sh[1]+3],[hip[0]+10,hip[1]+12],[hip[0]-10,hip[1]+12]],'#c9bda0');P.line(g,hip[0]-7,hip[1]+3,hip[0]+7,hip[1]+3,'#8f8d73',1);P.rect(g,hip[0]-5,hip[1]+4,10,6,'#acaa8b');
  }else if(h.id==='juno'){
    P.ell(g,head[0],head[1]-6,9,6,'#374d57');P.line(g,head[0]-8,head[1],head[0]+8,head[1],'#91a2a0',3);
    P.line(g,sh[0]-6,sh[1]+3,hip[0]+6,hip[1]+2,'#96714f',4);P.rect(g,hip[0]+2,hip[1]-1,12,10,'#776046');P.line(g,hip[0]+3,hip[1]+1,hip[0]+12,hip[1]+1,'#c1a577',2);
    // Only the injured right fingers are wrapped; the left shoulder bears loads.
    P.disc(g,...right,3,'#d6c7a4');P.line(g,right[0]-2,right[1]-1,right[0]+2,right[1]-1,'#8f8873',1);P.line(g,right[0]-2,right[1]+1,right[0]+2,right[1]+1,'#8f8873',1);P.disc(g,...l,2,'#83735b');
  }else{
    P.ell(g,head[0],head[1]-6,10,5,'#765744');P.line(g,head[0]-10,head[1]-2,head[0]+10,head[1]-2,'#b39164',2);
    for(const dx of[-4,4]){P.ell(g,head[0]+dx,head[1]+1,3,2,'#c3b489');P.dot(g,head[0]+dx,head[1]+1,'#484839');}P.line(g,head[0]-1,head[1]+1,head[0]+1,head[1]+1,'#bbae8a',1);
    P.poly(g,[[sh[0]-8,sh[1]+4],[sh[0]+8,sh[1]+4],[hip[0]+12,hip[1]+10],[hip[0]-12,hip[1]+10]],'#92795b');P.line(g,sh[0]-5,sh[1],hip[0]-5,hip[1],'#b9a47b',2);P.line(g,sh[0]+5,sh[1],hip[0]+5,hip[1],'#b9a47b',2);P.ell(g,l[0]+3,l[1]+3,6,3,'#615044');
  }
}

export function poseWillowBow(E,rig,charge=0,pitch=0,sway=0,gripOverride=null){
  const J=rig.J,center=J.shC,angle=Math.max(-.6,Math.min(.6,pitch))+sway*.03,forward=[Math.cos(angle),0,Math.sin(angle)],grip=gripOverride||[center[0]+forward[0]*6,-1.5,center[2]+forward[2]*6];
  const pull=3.8+Math.max(0,Math.min(1,charge))*6.1,nock=[grip[0]-forward[0]*pull,1,grip[2]-forward[2]*pull];
  solveLimb(E,rig,'L',grip);solveLimb(E,rig,'R',nock);const left=J.handL,right=J.handR;
  return{grip:left.slice(),nock:right.slice(),top:[left[0]+2.2, left[1],left[2]+10.5],bottom:[left[0]+2.2,left[1],left[2]-10.5],tip:[left[0]+forward[0]*11,left[1],left[2]+forward[2]*11],forward};
}
export function fitWillowBowShoulder(E,rig,worldView,root,source){
  const cv=E.charView(worldView),height=rig.J.shC[2]*rig.o.size,fit=fitContactRoot(rig,cv,root,source,'L',height),delta=localFromScreen(rig,cv,root,fit,0);
  // Aim leans the torso toward the release point. Feet and seated hips stay at
  // their actual ground/stirrup contacts in every direction.
  if(delta)for(const key of['shC','shL','shR','head','elbowL','elbowR','handL','handR'])rig.J[key]=rig.J[key].map((n,i)=>n+delta[i]);
  return localFromScreen(rig,cv,root,source,height);
}
export function drawWillowBow(E,g,r,rig,root,bow,{arrow=true}={}){
  const P=E.px,cv=E.charView(r.view),at=p=>jointScreen(rig,cv,root,p),q=[at(bow.top),at([bow.grip[0]-1,bow.grip[1],bow.grip[2]+6]),at(bow.grip),at([bow.grip[0]-1,bow.grip[1],bow.grip[2]-6]),at(bow.bottom)],n=at(bow.nock);
  for(let i=1;i<q.length;i++){P.line(g,...q[i-1],...q[i],'#5c492f',3);P.line(g,q[i-1][0]+1,q[i-1][1],q[i][0]+1,q[i][1],'#b29462',1);}P.line(g,...q[0],...n,'#cfbc90',1);P.line(g,...n,...q[4],'#cfbc90',1);P.line(g,...at(bow.grip),...at([bow.grip[0],bow.grip[1],bow.grip[2]+1.8]),'#8d6543',3);
  if(arrow){const tip=at(bow.tip);P.line(g,...n,...tip,'#d3c098',1);P.line(g,n[0],n[1]-2,n[0]+3,n[1],'#c1cbaf',2);P.line(g,n[0],n[1]+2,n[0]+3,n[1],'#c1cbaf',2);P.disc(g,...tip,1,'#61756d');}
}
