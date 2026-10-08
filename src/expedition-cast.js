import { jointScreen } from './western-animation.js';

export const EXPEDITION_CAST_IDS = new Set(['silas', 'elin', 'fin', 'moss', 'vera', 'della']);
const palettes = {
  mara: { cloth:'#6b8583', coat:'#456570', pants:'#3e515b', hair:'#443b32', skin:'#bba17f', glove:'#5a5947', hat:'#666b5b', scarf:'#ad6550', size:1.7 },
  inez: { cloth:'#87946e', coat:'#657856', pants:'#465b4e', hair:'#342f28', skin:'#a28a65', glove:'#575c43', hat:'#8c8060', scarf:'#c3aa7c', size:1.57 },
  silas: { cloth:'#9a806a', coat:'#8a504d', pants:'#48595f', hair:'#634c3d', skin:'#b7987d', glove:'#85766a', hat:null, scarf:'#c5bfa1', size:1.69 },
  elin: { cloth:'#b3949c', coat:'#805f78', pants:'#514e62', hair:'#7e5e46', skin:'#b99b7c', glove:'#aa9879', hat:'#beaead', scarf:'#d3c6a7', size:1.64 },
  fin: { cloth:'#d1a576', coat:'#c19457', pants:'#576779', hair:'#795441', skin:'#c5a68b', glove:'#766d58', hat:'#658499', scarf:'#9e6553', size:1.2 },
  moss: { cloth:'#8c8070', coat:'#59675c', pants:'#4c5357', hair:'#5b493d', skin:'#a68b6e', glove:'#7c6b4c', hat:'#696a5c', scarf:'#a99a7a', size:1.93, build:'bulky' },
  vera: { cloth:'#829398', coat:'#435f78', pants:'#4c5e69', hair:'#a37b4e', skin:'#b99e82', glove:'#766c4f', hat:'#8c9f9f', scarf:'#c4a46f', size:1.58 },
  della: { cloth:'#a6939e', coat:'#665466', pants:'#3f5059', hair:'#554e4a', skin:'#ad947c', glove:'#665d4b', hat:'#575867', scarf:'#d1b987', size:1.78 },
};

export function createExpeditionHuman(E, id) {
  const p = palettes[id] || palettes.mara;
  const colors = { skin:p.skin, hair:p.hair, cloth:p.cloth, coat:p.coat, pants:p.pants, boot:'#344743', belt:'#6d5b41', trim:'#c6b48c', glove:p.glove, metal:'#a2b4aa' };
  const child = id === 'fin';
  const rig = new E.Humanoid({ build:child ? 'chibi' : p.build || 'heroic', size:p.size, outfit:'coat', sleeves:'long', weapon:null, hair:id === 'elin' || id === 'vera' ? 'long' : 'short', colors,
    ...(child ? { hipZ:8.6,legUpper:4.5,legLower:4.5,torso:5.5,shoulderHalf:2.2,hipHalf:1.4,headR:3.8,neck:.7,armUpper:3.4,armLower:3.3,stride:4.8,speedRef:55,face:{eyes:'big',bangs:.3} } : {}),
  });
  return { id,rig,colors,hat:p.hat,scarf:p.scarf,armed:id === 'mara' || id === 'inez',ready:false,flash:0,phase:0 };
}

export function drawExpeditionOutfit(E, g, root, h, worldView, actor = {}, state = {}) {
  const P=E.px,view=E.charView(worldView),rig=h.rig;
  const at=(joint,offset=[0,0,0])=>jointScreen(rig,view,root,rig.J[joint].map((n,i)=>n+offset[i]));
  const head=at('head'),shoulder=at('shC'),hip=at('hipC'),left=at('handL'),right=at('handR');
  if (h.id === 'silas') {
    // The torn left sleeve, wrapped fingers and jaw scar remain visible in
    // standing, carried, passenger and resting poses.
    const torn=at('shL'),elbow=at('elbowL');
    P.line(g,torn[0]-3,torn[1]+1,elbow[0],elbow[1]-1,'#c2b7a0',4);
    P.line(g,torn[0]-2,torn[1]+2,elbow[0],elbow[1],'#88594d',1);
    if(actor.coatRepaired){P.poly(g,[[torn[0]-4,torn[1]-2],[torn[0]+4,torn[1]-1],[elbow[0]+3,elbow[1]+1],[elbow[0]-3,elbow[1]+2]],'#687d82');for(let i=0;i<4;i++){const t=i/3,x=torn[0]+(elbow[0]-torn[0])*t,y=torn[1]+(elbow[1]-torn[1])*t;P.line(g,x-3,y,x-1,y+1,'#d0bf9b',1);P.line(g,x+2,y,x+4,y+1,'#d0bf9b',1);}}
    for(const hand of [left,right]) {P.disc(g,...hand,3,'#b5ad95');P.line(g,hand[0]-2,hand[1],hand[0]+2,hand[1],'#766c62',1);}
    P.line(g,head[0]+3,head[1]+3,head[0]+6,head[1]+6,'#8f584d',2);
    P.line(g,head[0]+1,head[1]+5,head[0]+4,head[1]+7,'#d0b096',1);
    P.line(g,shoulder[0]-7,shoulder[1]+1,shoulder[0]+6,shoulder[1]+2,h.scarf,4);
    return;
  }
  if ((rig.downW || 0) > .6) return;
  if(h.id==='mara' || h.id==='inez') {
    P.line(g,shoulder[0]-8,shoulder[1],shoulder[0]+8,shoulder[1],'#bdc5ac',4);
    P.poly(g,[[shoulder[0]-5,shoulder[1]+1],[shoulder[0]+4,shoulder[1]+1],[shoulder[0]+2,shoulder[1]+9],[shoulder[0]-2,shoulder[1]+4]],h.scarf);
    P.ell(g,head[0],head[1]+1,h.id==='mara'?12:9,3,h.hat);P.rect(g,head[0]-6,head[1]-9,12,9,h.hat);
    if(h.id==='mara') {P.line(g,shoulder[0]-6,shoulder[1]+2,hip[0]+5,hip[1]+3,'#746344',3);P.rect(g,hip[0]+2,hip[1]-2,5,4,'#c9b892');}
    else {P.line(g,head[0]-5,head[1]+1,shoulder[0]-7,shoulder[1]+5,'#423e2e',3);P.ell(g,hip[0]+8,hip[1]+1,5,7,'#a09668');}
  } else if(h.id==='elin') {
    P.poly(g,[[head[0]-9,head[1]-4],[head[0],head[1]-10],[head[0]+9,head[1]-3],[head[0]+5,head[1]-4],[head[0]-5,head[1]-4]],h.hat);
    P.line(g,head[0]-7,head[1]-2,head[0]-6,head[1]+5,h.hat,3);P.line(g,head[0]+7,head[1]-2,head[0]+6,head[1]+5,h.hat,3);
    P.poly(g,[[shoulder[0]-11,shoulder[1]],[shoulder[0],shoulder[1]+4],[shoulder[0]+11,shoulder[1]],[hip[0]+8,hip[1]-1],[hip[0]-8,hip[1]-1]],'#c5b69d');
    P.line(g,shoulder[0]-7,shoulder[1]+3,hip[0]+5,hip[1]-1,'#e0cfad',2);
    P.rect(g,hip[0]-7,hip[1]-3,14,11,'#8e7672');P.dot(g,hip[0]+5,hip[1]+2,'#dbc69d');P.line(g,hip[0]+3,hip[1]-2,hip[0]+7,hip[1]-5,'#b9bdad',1);
  } else if(h.id==='fin') {
    P.ell(g,head[0],head[1]-5,8,6,h.hat);P.line(g,head[0]-7,head[1]-1,head[0]+7,head[1]-1,'#9fb6ba',3);P.disc(g,head[0]+1,head[1]-11,3,'#cfba8d');
    P.line(g,shoulder[0]-5,shoulder[1]+1,shoulder[0]+5,shoulder[1]+1,h.scarf,3);P.line(g,shoulder[0]+2,shoulder[1]+2,hip[0]+3,hip[1]-1,h.scarf,3);
  } else if(h.id==='moss') {
    P.ell(g,head[0],head[1]-5,10,5,h.hat);P.line(g,head[0]-10,head[1]-1,head[0]+10,head[1]-1,'#98967e',3);
    P.poly(g,[[head[0]-5,head[1]+3],[head[0]+5,head[1]+3],[head[0]+3,head[1]+9],[head[0]-2,head[1]+9]],'#796453');
    P.poly(g,[[shoulder[0]-7,shoulder[1]+5],[shoulder[0]+7,shoulder[1]+5],[hip[0]+10,hip[1]+7],[hip[0]-10,hip[1]+7]],'#85745a');
    P.line(g,shoulder[0]-5,shoulder[1],shoulder[0]-5,shoulder[1]+6,'#b7a684',2);P.line(g,shoulder[0]+5,shoulder[1],shoulder[0]+5,shoulder[1]+6,'#b7a684',2);
  } else if(h.id==='vera') {
    P.ell(g,head[0],head[1]-5,8,6,h.hat);P.line(g,head[0]-8,head[1],head[0]+8,head[1],'#becbc0',3);
    P.line(g,head[0]+5,head[1]+1,shoulder[0]+7,shoulder[1]+5,'#a57a4d',3);
    P.line(g,hip[0]-8,hip[1]-3,hip[0]+9,hip[1]-3,'#8f7350',4);
    P.line(g,hip[0]+7,hip[1]-7,hip[0]+7,hip[1]+5,'#c7bb9c',2);P.line(g,hip[0]+7,hip[1]+5,hip[0]+1,hip[1]+5,'#c7bb9c',2);
    P.line(g,hip[0]-4,hip[1]-5,hip[0]-4,hip[1]+5,'#95714b',2);P.line(g,hip[0]-7,hip[1]-6,hip[0],hip[1]-6,'#9aa89c',3);
  } else if(h.id==='della') {
    P.ell(g,head[0],head[1]-5,9,5,h.hat);P.rect(g,head[0]-7,head[1]-10,14,7,h.hat);P.line(g,head[0]-9,head[1],head[0]+9,head[1],'#b5a7ad',2);
    P.line(g,shoulder[0]-7,shoulder[1]+2,shoulder[0]+7,shoulder[1]+2,h.scarf,3);
    P.rect(g,left[0]-7,left[1]-5,13,17,'#79604e');P.line(g,left[0]-5,left[1]-3,left[0]+4,left[1]-3,'#d7c29d',2);P.line(g,left[0]-4,left[1]+1,left[0]+3,left[1]+1,'#bfa987',1);
  }
  if(actor.concerned || actor.expression==='concerned') {P.line(g,head[0]-4,head[1]-1,head[0]-1,head[1]-2,'#64534b',1);P.line(g,head[0]+2,head[1]-2,head[0]+5,head[1]-1,'#64534b',1);}
}
