/** Original train inhabitants on the supplied native humanoid/animal skeletons. */
import {createRivalHuman,drawRivalOutfit,RivalMountRig} from '../rival-rigs.js';
import {createWillowHuman,drawWillowOutfit,WillowAnimalRig} from '../willow-run-rigs.js';
import {EXPEDITION_CAST_IDS,createExpeditionHuman,drawExpeditionOutfit} from '../expedition-cast.js';
import {savePose,solveLimb} from '../western-animation.js';
import {add,sub,scale,dot,cross,length,worldPoint,localPoint} from '../rail-foundation/rigid-frame.js';

export const TRAIN_PROFILES=Object.freeze({
 ada:{size:1.61,build:'heroic',coat:'#617d87',cloth:'#8fa7a0',pants:'#465e65',hair:'#7f6951',skin:'#bba17f',hat:'#8e727f',hipHalf:1.8,shoulderHalf:3.5,headR:3.05,accessory:'mending-basket'},
 gideon:{size:1.68,build:'heroic',coat:'#6f7770',cloth:'#b1ad95',pants:'#5b6355',hair:'#b2afa0',skin:'#bba17f',hat:null,hipHalf:1.8,shoulderHalf:3.5,headR:3.05},
 nell:{size:1.64,build:'heroic',coat:'#32676a',cloth:'#b69560',pants:'#465858',hair:'#30251f',skin:'#ba8763',hat:null,hipHalf:2.4,shoulderHalf:3.4,headR:3.5,accessory:'riveter-stitch'},
 abel:{size:1.82,build:'heroic',coat:'#484740',cloth:'#c6c5af',pants:'#45483e',hair:'#b5b6a3',skin:'#af886d',hat:'#393e39',hipHalf:2.6,shoulderHalf:3.2,headR:3.3,accessory:'watch-satchel'},
 harlan:{size:1.77,build:'bulky',coat:'#62636a',cloth:'#9c9a83',pants:'#3f4449',hair:'#685347',skin:'#b67a54',hat:'#2b3539',hipHalf:3.1,shoulderHalf:4.2,headR:3.7,accessory:'shovel'},
 etta:{size:1.62,build:'bulky',coat:'#566452',cloth:'#c5b794',pants:'#4b5248',hair:'#342823',skin:'#aa7150',hat:null,hipHalf:3.2,shoulderHalf:3.7,headR:3.6,accessory:'folio'},
 conrad:{size:1.86,build:'heroic',coat:'#9b9070',cloth:'#d5ccb2',pants:'#565344',hair:'#4c3c31',skin:'#c09b75',hat:null,hipHalf:2.4,shoulderHalf:3.1,headR:3.1,accessory:'steward-apron'},
 odo:{size:1.71,build:'heroic',coat:'#704d3e',cloth:'#b4a17a',pants:'#4d4e45',hair:'#2e2723',skin:'#ccac87',hat:'#5b4535',hipHalf:2.3,shoulderHalf:3.3,headR:3.4,accessory:'message-case'},
 jana:{size:1.68,build:'heroic',coat:'#324e54',cloth:'#a8aaa0',pants:'#3a484d',hair:'#3b3028',skin:'#a67757',hat:'#2c4248',hipHalf:2.7,shoulderHalf:3.3,headR:3.2,accessory:'signal-book'},
 faber:{size:1.74,build:'bulky',coat:'#746f52',cloth:'#bab08c',pants:'#4c5142',hair:'#b4aa91',skin:'#bd9573',hat:'#4a4a3c',hipHalf:3.2,shoulderHalf:4,headR:3.8,accessory:'oil-case'},
});
export function createTrainHuman(E,body){
 if(EXPEDITION_CAST_IDS.has(body.id))return{...createExpeditionHuman(E,body.id),legacy:'expedition'};
 const p=TRAIN_PROFILES[body.id];if(!p){if(body.id==='juno')return{...createWillowHuman(E,body.id),legacy:'willow'};if(/^(morrow-|brass-)/.test(body.id))return{...createRivalHuman(E,body.id,{...body,rig:{coat:'#3d5358',cloth:'#b5a47d',hat:'#34464c',scarf:'#b69b69',...(body.rig||{})}}),legacy:'morrow-guard'};return{...createRivalHuman(E,body.id,body),legacy:'rival'};}
 const colors={...p,boot:'#35413c',belt:'#6b5842',trim:'#c9b48b',glove:'#a69978',metal:'#a8b9ac'};
 return{id:body.id,profile:p,colors,rig:new E.Humanoid({size:p.size,build:p.build,hipHalf:p.hipHalf,shoulderHalf:p.shoulderHalf,headR:p.headR,outfit:'coat',sleeves:'long',weapon:null,hair:body.id==='etta'?'bun':body.id==='nell'?'short':'short',colors,cheat:0})};
}
export function physicalProjection(E,fn){const had=Object.hasOwn(E.style,'charPitch'),old=E.style.charPitch;E.style.charPitch=false;try{return fn();}finally{if(had)E.style.charPitch=old;else delete E.style.charPitch;}}
export function rigWorldPoint(rig,root,joint){const p=typeof joint==='string'?rig.J[joint]:joint,w=rig._w(p);return add(root,{x:w[0],y:w[1],z:w[2]});}
/** Invert the engine's actual affine native-joint transform. No screen position
 * or camera pitch is used to determine a hand/foot contact. */
export function worldToRig(rig,root,target){
 const base=rig._w([0,0,0]),origin=add(root,{x:base[0],y:base[1],z:base[2]}),unit=i=>{const a=[0,0,0];a[i]=1;const p=rig._w(a);return{x:p[0]-base[0],y:p[1]-base[1],z:p[2]-base[2]};},x=unit(0),y=unit(1),z=unit(2),v=sub(target,origin),det=dot(x,cross(y,z));
 if(Math.abs(det)<1e-8)throw new TypeError('Degenerate native joint transform');return[dot(v,cross(y,z))/det,dot(v,cross(z,x))/det,dot(v,cross(x,y))/det];
}
function validateElbowHint(hint){if(hint!==undefined&&hint!==null&&(!Array.isArray(hint)||hint.length!==3||!hint.every(Number.isFinite)))throw new TypeError('A finite local three-component elbow hint is required');}
export function fitWorldLimb(E,rig,root,side,target,{leg=false,kind='contact',elbowHint=null}={}){
 validateElbowHint(elbowHint);
 const local=worldToRig(rig,root,target),start=rig.J[(leg?'hip':'sh')+side],reach=leg?rig.o.legUpper+rig.o.legLower:rig.o.armUpper+rig.o.armLower,d=Math.hypot(...local.map((n,i)=>n-start[i]));
 solveLimb(E,rig,side,local,1,leg,elbowHint);const hit=rigWorldPoint(rig,root,(leg?'foot':'hand')+side);
 return{kind,side,leg,target:{...target},hit,error:length(sub(target,hit)),reachable:d<=reach+1e-6};
}
function contactKey(c){return(c.hand===false?'foot':'hand')+(c.side||'R');}
function validateContacts(contacts){const seen=new Set();for(const c of contacts){validateElbowHint(c.elbowHint);const key=contactKey(c);if(seen.has(key))throw new TypeError('One native limb cannot hold simultaneous distinct contacts');seen.add(key);}}
function handBlock(body,c,freeHands){
 if(c.hand===false)return null;
 const side=c.side||'R';
 if(body.toolHeld&&(body.toolHand||'R')===side&&c.usesHeldTool!==body.toolHeld)return'hand-holds-other-tool';
 if(body.handInjury&&body.injured!==false&&!body.handInjury.recovered&&body.handInjury.side===(side==='R'?'right':'left'))return'injured-hand';
 return freeHands?null:'hands-occupied';
}
function fitContact(E,rig,root,body,c,freeHands){const blocked=handBlock(body,c,freeHands);return blocked?{kind:c.kind||'hand-contact',side:c.side||'R',leg:false,target:{...c.target},hit:rigWorldPoint(rig,root,'hand'+(c.side||'R')),error:Infinity,reachable:false,blocked}:fitWorldLimb(E,rig,root,c.side||'R',c.target,{leg:c.hand===false,kind:c.kind||'hand-contact',elbowHint:c.elbowHint});}
function finalContacts(rig,root,diagnostics){for(const c of diagnostics){c.hit=rigWorldPoint(rig,root,(c.leg?'foot':'hand')+c.side);c.error=length(sub(c.target,c.hit));c.reachable=!!c.reachable&&!c.blocked&&c.error<=1e-5;}return diagnostics;}
export function prepareTrainPose(E,h,body,platform,{contacts=[],freeHands=true}={}){
 validateContacts(contacts);
 const rig=h.rig,restore=savePose(rig),root={x:body.x,y:body.y,z:body.z||0},diagnostics=[],requested=new Set(contacts.map(contactKey));
 // Prevent optional camera-facing sprite yaw from moving physical sockets.
 rig._cheat=0;rig.o.cheat=0;
 if(body.support&&platform){const surface=platform.surfaces.find(s=>s.id===body.support.surfaceId);if(surface){const feet=['L','R'].map(side=>{const old=rigWorldPoint(rig,root,'foot'+side),local=localPoint(platform.frame,old),lift=Math.max(0,rig._w(rig.J['foot'+side])[2]);local.z=surface.bounds.max.z+lift;return{side,target:worldPoint(platform.frame,local),lift};});
  // A supported body bends its knees on a graded deck; its authoritative root
  // does not move. Drop the private pelvis only enough to fit both actual feet.
  const reach=rig.o.legUpper+rig.o.legLower;let drop=0;
  for(const foot of feet){const target=worldToRig(rig,root,foot.target),hip=rig.J['hip'+foot.side],horizontal=(hip[0]-target[0])**2+(hip[1]-target[1])**2,vertical=Math.sqrt(Math.max(0,reach*reach-horizontal));drop=Math.max(drop,hip[2]-target[2]-vertical+.02);}
  if(drop>0)for(const key of['hipC','hipL','hipR','shC','shL','shR','head','elbowL','elbowR','handL','handR'])rig.J[key][2]-=drop;
  for(const foot of feet)if(!requested.has('foot'+foot.side))diagnostics.push({...fitWorldLimb(E,rig,root,foot.side,foot.target,{leg:true,kind:'deck-foot'}),planted:foot.lift<1e-4,balanceDropNative:Math.max(0,drop)});
 }}
 for(const c of contacts)diagnostics.push(fitContact(E,rig,root,body,c,freeHands));
 return{root,diagnostics:finalContacts(rig,root,diagnostics),restore};
}
export function drawTrainOutfit(E,g,r,h,body){
 if(h.legacy==='expedition'){drawExpeditionOutfit(E,g,r.w(body.x,body.y,body.z||0),h,r.view,body,{});return;}
 if(h.legacy){if(h.legacy==='willow')drawWillowOutfit(E,g,r.w(body.x,body.y,body.z||0),h,r.view,body,{});else drawRivalOutfit(E,g,r.w(body.x,body.y,body.z||0),h,r.view,body,{});if(h.legacy==='morrow-guard'){const p=rigWorldPoint(h.rig,body,'shL'),at=r.w(p.x,p.y,p.z);E.px.line(g,at[0]-2,at[1]+4,at[0],at[1]+7,'#d4be80',2);E.px.line(g,at[0],at[1]+7,at[0]+2,at[1]+4,'#d4be80',2);}return;}
 const P=E.px,at=j=>{const p=rigWorldPoint(h.rig,body,j);return r.w(p.x,p.y,p.z);},head=at('head'),sh=at('shC'),hip=at('hipC'),left=at('handL'),right=at('handR'),p=h.profile;
 if(p.hat){P.ell(g,head[0],head[1],11,3,p.hat);P.rect(g,head[0]-5,head[1]-9,10,8,p.hat);}else if(body.id==='etta')P.disc(g,head[0]-6,head[1]-4,4,p.hair);
 if(body.id==='nell'){P.line(g,sh[0]-8,sh[1]+1,hip[0]+7,hip[1]+7,'#d1b679',2);for(let i=0;i<6;i++)P.line(g,sh[0]-7+i*2,sh[1]+2+i,sh[0]-5+i*2,sh[1]+2+i,'#e5cf96',1);P.rect(g,hip[0]+3,hip[1]+1,5,8,'#8f7350');}
 if(body.id==='abel'){for(const hand of[left,right])P.line(g,hand[0]-3,hand[1]-4,hand[0]+3,hand[1]-4,'#d4d0b6',3);P.line(g,sh[0]-7,sh[1]+1,hip[0]+8,hip[1]+2,'#83988d',2);P.rect(g,hip[0]+3,hip[1]+1,12,13,'#527d72');P.disc(g,right[0],right[1],3,'#c5b17f');}
 if(body.id==='harlan'){P.line(g,head[0]-5,head[1]+5,head[0]+5,head[1]+5,'#534e44',3);if(body.toolHeld==='shovel'){P.line(g,right[0],right[1],right[0]+3,right[1]-24,'#a38a65',3);P.poly(g,[[right[0]-2,right[1]-27],[right[0]+8,right[1]-27],[right[0]+7,right[1]-18],[right[0]-1,right[1]-18]],'#7f9093');}else P.line(g,sh[0]+4,sh[1]-10,hip[0]-5,hip[1]+8,'#8e7b5d',3);}
 if(body.id==='etta'){P.rect(g,left[0]-4,left[1]-3,10,15,'#3d6151');P.line(g,left[0]-2,left[1]-1,left[0]+5,left[1]-1,'#c3b98a',1);}
 if(body.id==='conrad'){P.poly(g,[[sh[0]-5,sh[1]+4],[sh[0]+5,sh[1]+4],[hip[0]+9,hip[1]+13],[hip[0]-9,hip[1]+13]],'#d3c7a7');P.rect(g,right[0]-3,right[1]-1,8,5,'#e1d9c1');}
 if(body.id==='odo'){P.line(g,sh[0]-6,sh[1],hip[0]+6,hip[1]+4,'#aa8e65',3);P.rect(g,hip[0]+2,hip[1]+1,12,10,'#765039');P.rect(g,hip[0]+6,hip[1]+3,3,3,'#cbb97f');}
 if(body.id==='jana'||body.id==='faber'){P.rect(g,left[0]-4,left[1]-1,9,12,body.id==='jana'?'#547c72':'#8d7951');P.line(g,hip[0]-7,hip[1]+1,hip[0]+7,hip[1]+1,'#baa57d',2);}
}

export class RivetRig extends WillowAnimalRig{
 constructor(E){super(E,'rivet','horse');}
 world(body,p,origin=body){const q=typeof p==='string'?this.J[p]:p;return super.world(body,[q[0]*.88,q[1]*.87,q[2]*.92],origin);}
 draw(g,r,body){const P=this.E.px,at=q=>r.w(...this.world(body,q)),J=this.J,fur='#3d2d29',light='#705043',mane='#242b29',ops=[];
  const line=(a,b,width,color)=>ops.push({d:r.view.depth(...this.world(body,a))+r.view.depth(...this.world(body,b)),draw:()=>P.line(g,...at(a),...at(b),color,width*r.view.scale)});
  const ell=(q,rx,rz,color)=>{const pts=[];for(let i=0;i<24;i++){const a=i*Math.PI/12;pts.push(at([q[0]+Math.cos(a)*rx,q[1]+Math.sin(a)*rx*.35,q[2]+Math.sin(a)*rz]));}ops.push({d:2*r.view.depth(...this.world(body,q)),draw:()=>P.poly(g,pts,color)});};
  for(let i=0;i<4;i++){line(J['hip'+i],J['knee'+i],4,fur);line(J['knee'+i],J['foot'+i],3,i%2?light:mane);ell(J['foot'+i],3,2,'#29332e');}ell(J.body,27,15,fur);ell(J.rump,14,13,light);line(J.body,J.chest,17,fur);line(J.chest,J.neck,11,fur);line(J.neck,J.head,9,light);ell(J.head,10,7,light);line(J.rump,J.tail,5,mane);ops.sort((a,b)=>a.d-b.d);for(const op of ops)op.draw();
  const h=J.head;for(const side of[-1,1]){P.line(g,...at(h),...at([h[0]-4,side*4,h[2]+10]),mane,2);const eye=at([h[0]+4,side*5,h[2]+2]);P.disc(g,...eye,1.5,'#172721');}
  // Rivet's crescent belongs below her RIGHT eye, not a reused forehead star.
  const c=at([h[0]+4,5,h[2]-1]);P.line(g,c[0]-2,c[1]-1,c[0]-1,c[1]+2,'#e0d4b5',2);P.line(g,c[0]-1,c[1]+2,c[0]+2,c[1]+2,'#e0d4b5',2);
  P.poly(g,[at([-17,-9,40]),at([14,-9,40]),at([14,9,36]),at([-17,9,36])],'#996d46');P.ell(g,...at([0,0,42]),15,5,'#2d4140');for(const side of[-1,1]){P.line(g,...at([0,side*7,42]),...at([0,side*7,26]),'#b79b6a',2);P.ell(g,...at([0,side*7,26]),4,2,'#b4c0ad');}
  return{mark:'right-eye-crescent'};
 }
}
export const createTrainMount=(E,body)=>body.id==='rivet'?new RivetRig(E):new RivalMountRig(E,body.id);

/** Mounted world-root is the existing horse-ground convention. A private draw
 * root seats the SAME actor at the actual saddle; nothing writes either body. */
export function prepareTrainMountedPose(E,h,body,horse,mount,{contacts=[],freeHands=true}={}){
 validateContacts(contacts);
 const rig=h.rig,restore=savePose(rig),requested=new Set(contacts.map(contactKey));rig._cheat=0;rig.o.cheat=0;
 const saddle=mount.world(horse,[0,0,44]),desired={x:saddle[0],y:saddle[1],z:saddle[2]},hip=rigWorldPoint(rig,body,'hipC'),root=add(body,sub(desired,hip)),diagnostics=[];
 for(const side of['L','R'])if(!requested.has('foot'+side)){const p=mount.world(horse,[0,side==='L'?-6.5:6.5,26]);diagnostics.push(fitWorldLimb(E,rig,root,side,{x:p[0],y:p[1],z:p[2]},{leg:true,kind:'mounted-stirrup'}));}
 for(const side of['L','R'])if(!requested.has('hand'+side)){const p=mount.world(horse,[8,side==='L'?-2:2,48]),c={side,target:{x:p[0],y:p[1],z:p[2]},kind:'mounted-rein'};if(!handBlock(body,c,freeHands))diagnostics.push(fitContact(E,rig,root,body,c,freeHands));}
 for(const c of contacts)diagnostics.push(fitContact(E,rig,root,body,c,freeHands));
 return{root,diagnostics:finalContacts(rig,root,diagnostics),restore};
}
