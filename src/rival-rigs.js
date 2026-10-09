// Bellwether's cast and mount skins are authored in the engine's native joint
// space. The campaign remains the sole owner of positions and attachments.
import { createExpeditionHuman, drawExpeditionOutfit } from './expedition-cast.js';
import { createWillowHuman, drawWillowOutfit, WillowAnimalRig } from './willow-run-rigs.js';
import { jointScreen, solveLimb, localFromScreen } from './western-animation.js';
import { fitContactRoot } from './expedition-animation.js';

export const RIVAL_HUMAN_IDS=new Set(['mara','tomas','inez','ruth','bastian','emmett','levi','calder','pavel','della','hob']);
export const RIVAL_MOUNT_IDS=new Set(['tomas-mount','thimble','plover','cinder','button','skein','grout']);
export const RIVAL_PALETTES=Object.freeze({
  tomas:{size:1.78,build:'bulky',cloth:'#916a4e',coat:'#675a45',pants:'#485950',hair:'#ada58a',skin:'#a68a6b',glove:'#7c7055',hat:'#7c7a5b',scarf:'#b09c72'},
  ruth:{size:1.61,build:'heroic',cloth:'#bfac81',coat:'#426d65',pants:'#3d5255',hair:'#72705b',skin:'#ac8568',glove:'#c1b38d',hat:'#728277',scarf:'#b89868'},
  bastian:{size:1.85,build:'heroic',cloth:'#bdb49c',coat:'#543e48',pants:'#444a59',hair:'#312d2d',skin:'#bd956e',glove:'#685c4a',hat:'#443b41',scarf:'#c2ac79'},
  emmett:{size:1.7,build:'heroic',cloth:'#aaa580',coat:'#8a7952',pants:'#465e60',hair:'#775039',skin:'#c7a382',glove:'#786f52',hat:'#697b82',scarf:'#748d91'},
  levi:{size:1.67,build:'heroic',cloth:'#b3a891',coat:'#646f65',pants:'#5b574c',hair:'#554538',skin:'#bfa384',glove:'#99886b',hat:null,scarf:'#b0ab89'},
  calder:{size:1.91,build:'bulky',cloth:'#788c89',coat:'#293c40',pants:'#38484d',hair:'#403a31',skin:'#aa8e6c',glove:'#716344',hat:'#354548',scarf:'#d2ba85'},
  pavel:{size:1.69,build:'heroic',cloth:'#a47d5b',coat:'#965f48',pants:'#5b6a5f',hair:'#514533',skin:'#bba17f',glove:'#5a5947',hat:'#a29276',scarf:'#c2ab7f'},
});
const rolePalettes={watcher:['#5c7080','#a9b9aa'],rifleman:['#536457','#b7ab86'],flanker:['#877e5b','#c0b08b'],runner:['#76574e','#baa080'],scout:['#536f68','#8ea28b'],reserve:['#665361','#b6a392']};
const seed=id=>[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,9);
export function createRivalHuman(E,id,body={}){
  if(['mara','inez','della'].includes(id))return createExpeditionHuman(E,id);
  if(id==='hob')return createWillowHuman(E,id);
  const base=RIVAL_PALETTES[id]||(()=>{const role=/watcher/.test(body.role)?'watcher':/scout/.test(body.role)?'scout':/reserve|leader/.test(body.role)?'reserve':/flank/.test(body.role)?'flanker':/runner/.test(body.role)?'runner':'rifleman',c=rolePalettes[role],n=seed(id);return{size:1.58+n%23/100,build:n%3?'heroic':'bulky',cloth:c[1],coat:c[0],pants:'#465450',hair:['#483e32','#74614b','#3c3934'][n%3],skin:['#ac8b6c','#b69b7b','#987d61'][n%3],glove:'#796c52',hat:c[0],scarf:'#ac9674'};})();
  const p={...base,...body.rig};
  const colors={...p,boot:'#343f3b',belt:'#735f45',trim:'#c9b28b',metal:'#a3b7ac'};
  return{id,colors,hat:p.hat,scarf:p.scarf,rig:new E.Humanoid({size:p.size,build:p.build,outfit:'coat',sleeves:'long',weapon:null,hair:id==='ruth'?'long':'short',colors,cheat:0})};
}
export function drawRivalOutfit(E,g,root,h,view,body={},state={}){
  if(['mara','inez','della'].includes(h.id)){drawExpeditionOutfit(E,g,root,h,view,body,state);return;}
  if(h.id==='hob'){drawWillowOutfit(E,g,root,h,view,body,state);return;}
  const P=E.px,cv=E.charView(view),at=j=>jointScreen(h.rig,cv,root,j),head=at('head'),sh=at('shC'),hip=at('hipC'),left=at('handL'),right=at('handR');
  if(h.hat){P.ell(g,head[0],head[1]+1,h.id==='bastian'?14:11,3,h.hat);P.rect(g,head[0]-6,head[1]-10,12,10,h.hat);P.line(g,head[0]-6,head[1]-2,head[0]+6,head[1]-2,h.scarf,2);}
  P.line(g,sh[0]-7,sh[1]+1,sh[0]+7,sh[1]+1,h.scarf,3);
  if(h.id==='ruth'){
    // Powder keeper's canvas cuffs and split leather apron remain attached to
    // her own arms while inspecting, carrying, shooting and treating Levi.
    for(const side of['L','R']){const elbow=at('elbow'+side),hand=at('hand'+side);P.line(g,elbow[0],elbow[1],hand[0],hand[1],'#c8bb96',5);P.disc(g,...hand,3,'#d0c6a6');}
    P.poly(g,[[sh[0]-5,sh[1]+4],[sh[0]+6,sh[1]+4],[hip[0]+10,hip[1]+14],[hip[0]+2,hip[1]+11],[hip[0]-8,hip[1]+14]],'#887859');P.line(g,hip[0]-7,hip[1]+1,hip[0]+7,hip[1]+1,'#d1bf97',2);P.rect(g,hip[0]+3,hip[1]+4,5,7,'#566e65');
  }else if(h.id==='bastian'){
    P.line(g,sh[0]-7,sh[1]+4,hip[0]+7,hip[1]+2,'#8c7154',3);P.rect(g,hip[0]+3,hip[1]-3,7,10,'#3b3737');if(!body.gunDisarmed)P.line(g,hip[0]+4,hip[1]-3,hip[0]+9,hip[1]-3,'#dfd5b1',2);P.line(g,head[0]-4,head[1]+6,head[0]+5,head[1]+6,'#3f3430',2);
  }else if(h.id==='emmett'){
    P.line(g,sh[0]+5,sh[1]+2,hip[0]-6,hip[1]+5,'#514d3e',3);P.rect(g,hip[0]-14,hip[1]+1,13,14,'#75664b');P.rect(g,hip[0]-12,hip[1]+3,7,5,'#a7b9af');for(let i=0;i<3;i++)P.line(g,hip[0]-13+i*4,hip[1]+9,hip[0]-11+i*4,hip[1]+10,'#c8bb91',1);P.line(g,sh[0]+4,sh[1]+6,sh[0]+4,sh[1]+13,'#d6c997',2);
  }else if(h.id==='levi'){
    const carried=body.attachment?.type==='carried',apron=carried?['shL','shR','hipR','hipL'].map(j=>at(j)):[[sh[0]-5,sh[1]+3],[sh[0]+5,sh[1]+3],[hip[0]+10,hip[1]+13],[hip[0]-9,hip[1]+13]];
    P.poly(g,apron,'#a18a63');P.line(g,...apron[0],...apron[3],'#c3b08a',2);if(carried){P.line(g,hip[0]-4,hip[1]-2,hip[0]+4,hip[1]+2,'#cab590',3);P.disc(g,head[0]+1,head[1]+1,3,h.colors.skin);P.line(g,head[0]-1,head[1]+2,head[0]+2,head[1]+2,'#755542',1);}else{P.rect(g,hip[0]-5,hip[1]+3,11,7,'#796b50');P.line(g,hip[0]-3,hip[1]+4,hip[0]+4,hip[1]+4,'#c5c5a5',2);}P.line(g,head[0]+4,head[1]+1,head[0]+5,head[1]+5,'#955b49',1);
    if(body.bound||body.restrained||body.rival?.bound||body.binding){P.line(g,left[0]-2,left[1],right[0]+2,right[1],'#c9ad7c',2);for(const hand of[left,right])P.ell(g,...hand,4,2,'#bba173');}
    if(body.blanket||body.rival?.blanket||state.campaign?.missions?.['snowbound-the-names-they-took']?.choices?.care==='care'){P.poly(g,[[sh[0]-10,sh[1]],[sh[0]+9,sh[1]],[hip[0]+12,hip[1]+9],[hip[0]-10,hip[1]+9]],'#586b78');P.line(g,sh[0]-8,sh[1]+3,hip[0]-8,hip[1]+8,'#879b9e',2);P.line(g,sh[0]+7,sh[1]+3,hip[0]+9,hip[1]+8,'#a2aea5',1);}
  }else if(h.id==='calder'){
    P.line(g,sh[0]-9,sh[1]+1,sh[0]+9,sh[1]+1,'#c6b27f',4);P.rect(g,hip[0]+3,hip[1]-2,10,7,'#344340');P.rect(g,hip[0]+6,hip[1],4,3,'#cbb173');P.line(g,head[0]-3,head[1]+6,head[0]+6,head[1]+6,'#50473b',2);
  }else if(h.id==='tomas'){
    P.line(g,head[0]-6,head[1]-7,head[0]+6,head[1]-7,'#bdbb99',3);P.poly(g,[[head[0]-4,head[1]+5],[head[0]+5,head[1]+4],[head[0]+4,head[1]+9],[head[0]-3,head[1]+9]],'#a2a18b');P.line(g,sh[0]+6,sh[1]+2,hip[0]-6,hip[1]+3,'#836747',3);
  }else{
    P.line(g,sh[0]-5,sh[1]+3,hip[0]+5,hip[1]+2,'#715f45',3);P.rect(g,sh[0]+2,sh[1]+5,5,5,'#b9a475');if(body.surrendered){P.line(g,right[0]-2,right[1],right[0]+2,right[1],'#c9b78c',1);}
  }
}

export const RIVAL_MOUNT_COATS=Object.freeze({
  'tomas-mount':{fur:'#675740',light:'#998365',mane:'#343732',blanket:'#7d6750',mark:'moth'},thimble:{fur:'#a4b2b9',light:'#ccd3ca',mane:'#4f5a54',blanket:'#6e808f',mark:'star'},
  plover:{fur:'#b5a372',light:'#d7c18b',mane:'#463b2f',blanket:'#527369',mark:'dun'},cinder:{fur:'#684536',light:'#96684a',mane:'#362e2b',blanket:'#7d5360',mark:'blaze'},
  button:{fur:'#9b816c',light:'#bdac97',mane:'#564436',blanket:'#9b845c',mark:'roan-sock'},skein:{fur:'#b99c76',light:'#dbc29a',mane:'#594538',blanket:'#6c7f78',mark:'split-ear'},grout:{fur:'#3e4944',light:'#707971',mane:'#272f2c',blanket:'#314f52',mark:'dark-muzzle'},
  copper:{fur:'#ae8759',light:'#ceb180',mane:'#45392b',blanket:'#607454',mark:'star'},juniper:{fur:'#ae8759',light:'#ceb180',mane:'#45392b',blanket:'#607454',mark:'star'},
});
export class RivalMountRig extends WillowAnimalRig{
  constructor(E,id){super(E,id,'horse');}
  sockets(r,body,origin=body){const base=super.sockets(r,body,origin),at=q=>r.w(...this.world(body,q,origin));return{...base,stirrupL:at([0,-6.5,26]),stirrupR:at([0,6.5,26]),rearStirrupL:at([-22,-6.5,25]),rearStirrupR:at([-22,6.5,25])};}
  draw(g,r,body,options={}){
    const P=this.E.px,J=this.J,p=RIVAL_MOUNT_COATS[this.id]||RIVAL_MOUNT_COATS.copper,origin=options.origin||body,at=q=>r.w(...this.world(body,typeof q==='string'?J[q]:q,origin)),dead=body.dead||body.hp<=0,ops=[];
    const line=(a,b,width,color)=>ops.push({depth:r.view.depth(...this.world(body,a,origin))+r.view.depth(...this.world(body,b,origin)),draw:()=>P.line(g,...at(a),...at(b),color,width*r.view.scale)});
    const ell=(q,rx,rz,color)=>{const center=at(q),forward=at([q[0]+rx,q[1],q[2]]),across=at([q[0],q[1]+rx*.38,q[2]]),up=at([q[0],q[1],q[2]+rz]),pts=[];for(let i=0;i<20;i++){const angle=i*Math.PI/10;pts.push([center[0]+Math.cos(angle)*(forward[0]-center[0])+Math.sin(angle)*(across[0]-center[0]),center[1]+Math.cos(angle)*(forward[1]-center[1])+Math.sin(angle)*(up[1]-center[1])]);}ops.push({depth:2*r.view.depth(...this.world(body,q,origin)),draw:()=>P.poly(g,pts,color)});};
    for(let i=0;i<4;i++){line(J['hip'+i],J['knee'+i],4,i%2?p.fur:p.mane);line(J['knee'+i],J['foot'+i],3,i%2?p.light:p.mane);ell(J['foot'+i],3,2,'#343b33');}
    ell(J.body,28,15,p.fur);ell(J.rump,14,13,p.light);line(J.body,J.chest,17,p.fur);line(J.chest,J.neck,11,p.fur);line(J.neck,J.head,10,p.light);ell(J.head,11,7,p.light);line(J.rump,J.tail,5,p.mane);ops.sort((a,b)=>a.depth-b.depth);for(const op of ops)op.draw();
    const h=J.head;for(const side of[-1,1]){const ear=[h[0]-4,side*4,h[2]+(dead?2:this.id==='skein'&&side<0?7:11)];P.line(g,...at(h),...at(ear),p.mane,2);P.disc(g,...at(ear),2,p.light);const eye=at([h[0]+4,side*5,h[2]+2]);if(dead)P.line(g,eye[0]-2,eye[1],eye[0]+1,eye[1]+1,'#2a332d',1);else P.disc(g,...eye,1.4,'#29362d');}
    if(p.mark==='dun')P.line(g,...at([-24,0,J.body[2]+13]),...at([23,0,J.chest[2]+10]),p.mane,2);
    if(p.mark.startsWith('roan'))for(let i=0;i<12;i++)P.line(g,...at([-21+i*4,-6,J.body[2]+(i%3)*3]),...at([-19+i*4,-6,J.body[2]+(i%3)*3+1]),'#d3c6b0',1);
    if(['star','moth','blaze'].includes(p.mark)){const q=at([h[0]+5,-3,h[2]+4]);P.line(g,q[0],q[1],q[0]+(p.mark==='blaze'?2:0),q[1]+(p.mark==='blaze'?8:3),'#e2d8b9',3);}
    if(p.mark.includes('sock')){const a=J.knee1,b=J.foot1;P.line(g,...at(a.map((n,i)=>n+(b[i]-n)*.6)),...at(b),'#dacbb0',4);}
    P.disc(g,...at([h[0]+10,0,h[2]-2]),3,p.mane);
    if(!dead){
      P.line(g,...at([18,0,35]),...at([27,0,54+this.fear*9]),p.mane,5);P.line(g,...at([-25,0,37]),...at([-38,0,15]),p.mane,5);
      P.poly(g,[at([-17,-9,40]),at([14,-9,40]),at([14,9,36]),at([-17,9,36])],p.blanket);P.ell(g,...at([0,0,42]),16,5,'#344d43');
      for(const side of[-1,1]){P.line(g,...at([0,side*6.5,42]),...at([0,side*6.5,26]),'#b1966b',2);P.ell(g,...at([0,side*6.5,26]),4,2,'#c6bc99');P.poly(g,[at([-25,side*9,36]),at([-15,side*9,36]),at([-15,side*10,22]),at([-25,side*10,22])],'#8b7253');}
      P.line(g,...at([40,0,51+this.fear*9]),...at([6,0,42]),'#bfaa80',1);
    }
    return{at,world:q=>this.world(body,q,origin)};
  }
}

export function boundRivalPose(E,rig,{prone=false,carried=false}={}){
  if(prone){for(const key of Object.keys(rig.J))if(key!=='bladeDir'){const p=rig.J[key];rig.J[key]=[p[2]-14,p[1],5-p[0]];}}
  const J=rig.J,center=J.hipC,target=[center[0]+(carried?2:4),0,center[2]+3];for(const side of['L','R'])solveLimb(E,rig,side,[target[0],side==='L'?-.8:.8,target[2]],1);
}
export function poseRivalCarbine(E,rig,worldView,root,source,{reload=0,cycle=0,recoil=0,kind='carbine'}={}){
  const cv=E.charView(worldView),height=rig.J.shC[2]*rig.o.size,tip=localFromScreen(rig,cv,root,source,height),length=kind==='sidearm'?5:12,grip=tip.map((n,i)=>n-(i===0?length:0)),stock=[grip[0]-5,grip[1]+.2,grip[2]-2],fore=[tip[0]-4,tip[1]-.3,tip[2]],lever=[grip[0]-1,grip[1],grip[2]-2-Math.sin(cycle*Math.PI)*2],rightContact=cycle>0?lever:grip,leftContact=reload>0?[grip[0]-2,grip[1]-1,grip[2]-4]:fore;
  // Fit the actual receiver and forestock contacts, not the muzzle (which no
  // hand touches). The physical tip remains fixed. Both boots and stirrups
  // remain fixed while a modest torso lean brings both grips within reach.
  const fit=(point,side)=>{const screen=jointScreen(rig,cv,root,point),next=fitContactRoot(rig,cv,root,screen,side,point[2]*(1+(rig.sq||0))*rig.o.size),delta=localFromScreen(rig,cv,root,next,0);if(delta)for(const key of['shC','shL','shR','head','elbowL','elbowR','handL','handR'])rig.J[key]=rig.J[key].map((n,i)=>n+delta[i]);};
  for(let i=0;i<6;i++){fit(rightContact,'R');fit(leftContact,'L');}solveLimb(E,rig,'R',rightContact);solveLimb(E,rig,'L',leftContact);
  return{tip,grip,stock,fore,lever,rightContact,leftContact,recoil,kind};
}
export function drawRivalCarbine(E,g,rig,root,view,shape){
  const P=E.px,cv=E.charView(view),at=q=>jointScreen(rig,cv,root,q),tip=at(shape.tip),grip=at(shape.grip),stock=at(shape.stock),lever=at(shape.lever);
  P.line(g,...stock,...grip,'#8c613f',shape.kind==='sidearm'?3:5);P.line(g,...grip,...tip,'#3f5650',shape.kind==='sidearm'?3:4);P.line(g,grip[0],grip[1]-1,tip[0],tip[1]-1,'#b9c2ab',1);P.line(g,...grip,...lever,'#bda984',2);
  if(shape.recoil>0){P.disc(g,...tip,3,'#ebd6a0');P.line(g,tip[0]-5,tip[1],tip[0]+5,tip[1],'#e6b775',1);}
}
