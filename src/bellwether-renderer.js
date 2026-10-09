import { RIVAL_WORLD as WORLD } from '../content/campaign/bellwether-works.js';
import { createRivalActors, rivalEntities } from './rival-actors.js';

const E=globalThis.My3D2dge,P=E.px,TAU=Math.PI*2,rows=v=>Array.isArray(v)?v:Object.values(v||{});
const hash=n=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);},poly=(r,g,pts,color)=>P.poly(g,pts.map(p=>r.w(p[0],p[1],p[2]||0)),color);
const C={snow:'#a8bec4',lit:'#d5e0d6',blue:'#718d99',deep:'#355460',wood:'#68584c',plank:'#8f795e',iron:'#435f5b',oxide:'#658d7c',brass:'#b8a572',paper:'#d2c49e'};
const record=s=>s.campaign?.missions?.['snowbound-the-names-they-took']||{};
const paths=()=>[WORLD.trail,WORLD.returnRoute,WORLD.descent,WORLD.horseRamp,WORLD.chase?.route,...rows(WORLD.patrolRoutes)].filter(Array.isArray);
function distance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
function terrain(){
  const cv=document.createElement('canvas');cv.width=WORLD.width;cv.height=WORLD.height;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;P.rect(g,0,0,cv.width,cv.height,C.snow);
  for(let y=0;y<cv.height;y+=24)for(let x=0;x<cv.width;x+=24)P.rect(g,x,y,25,25,Math.sin(x/184+y/147)>.25?'#b6c9c9':Math.sin(y/126-x/213)<-.4?'#98b0b9':'#aec1c3');
  for(let i=0;i<120;i++)P.ell(g,hash(i+12)*cv.width,hash(i+981)*cv.height,25+hash(i+56)*95,13+hash(i+455)*37,i%3?'#c6d3cd':'#8fa9b4');
  for(const z of rows(WORLD.elevationZones)){P.rect(g,z.x,z.y,z.w,z.h,'#92a8b1');for(let y=z.y+8;y<z.y+z.h;y+=17)P.line(g,z.x,y,z.x+z.w,y,'#b5c6c7',1);}
  for(const path of paths())for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];P.line(g,a.x,a.y,b.x,b.y,'#b9c6c1',38);P.line(g,a.x,a.y,b.x,b.y,'#8e9b96',24);P.line(g,a.x,a.y,b.x,b.y,'#afbab0',14);}
  // Tracks into three gates form a radial pattern unique to the wagon works.
  const hub=rows(WORLD.places).find(p=>/traverser/.test(p.id||''))||{x:1590,y:1330};P.ell(g,hub.x,hub.y,190,170,'#8e9d99');
  for(const end of[{x:1360,y:1480},{x:1740,y:1530},{x:1880,y:1160}])for(const offset of[-8,8]){P.line(g,hub.x+offset,hub.y,end.x+offset,end.y,'#536e69',3);P.line(g,hub.x+offset+1,hub.y,end.x+offset+1,end.y,'#b6bcb0',1);}
  const creek=rows(WORLD.river||WORLD.stream||WORLD.creek?.route||WORLD.chase?.creek);if(creek.length>1)for(let i=1;i<creek.length;i++){const a=creek[i-1],b=creek[i];P.line(g,a.x,a.y,b.x,b.y,'#d8ded0',63);P.line(g,a.x,a.y,b.x,b.y,'#6a929d',41);P.line(g,a.x,a.y,b.x,b.y,'#afc8cd',27);}
  for(let i=0;i<12000;i++){const x=hash(i+84)*cv.width,y=hash(i+432)*cv.height;P.line(g,x,y,x+2+hash(i+541)*6,y+1,i%4?'#c4d1ca':'#88a5af',1);}return cv;
}
function trees(){
  const out=[],routes=paths();for(let i=0;i<390;i++){const x=40+hash(i+516)*(WORLD.width-80),y=35+hash(i+267)*(WORLD.height-70);
    if(routes.some(path=>path.some((b,j)=>j&&distance(x,y,path[j-1],b)<64))||rows(WORLD.interiors).some(b=>x>b.x-50&&x<b.x+b.w+50&&y>b.y-50&&y<b.y+b.h+50)||rows(WORLD.props).some(p=>Math.hypot(p.x-x,p.y-y)<90)||rows(WORLD.obstacles).some(o=>x>o.x-22&&x<o.x+o.w+22&&y>o.y-22&&y<o.y+o.h+22)||Math.hypot(x-1590,y-1330)<280)continue;
    out.push({x,y,seed:i,size:.65+hash(i+967)*.8,kind:i%6?'spruce':'snag'});
  }return out;
}
function sky(r,clock,reduced){
  const g=r.ctx,h=Math.min(98,r.H*.17);r.sky(['#3e596c','#7893a1','#b5c7c5'],{bands:20});for(let layer=0;layer<3;layer++){const pts=[[-60,h]];for(let x=-90,i=0;x<r.bw+100;x+=120,i++){const k=hash(i+layer*73),top=h-20-layer*12-k*25;pts.push([x,h],[x+32,top+9],[x+55,top],[x+81,top+17],[x+120,h]);}pts.push([r.bw+90,h]);P.poly(g,pts,['#809aa4','#65818e','#496974'][layer]);}
  if(!reduced)for(let i=0;i<3;i++){const x=(i*217+clock*3)%(r.bw+120)-80;P.line(g,x,h*.35+i*8,x+70,h*.35+i*8,'#a4b9be',1);}return h;
}
function tree(r,t,s,clock,reduced){
  if(!r.visible(t.x,t.y,0,100,220,90))return;r.queue(t.x,t.y,0,g=>{const[x,y]=r.w(t.x,t.y,0),k=t.size,fade=Object.values(rivalEntities(s)).some(b=>!b.hidden&&(b.id==='mara'||b.faction==='claimants')&&(()=>{const q=r.w(b.x,b.y,b.z||0);return q[1]<y+4&&q[1]>y-143*k&&Math.abs(q[0]-x)<40*k;})());if(fade){g.save();g.globalAlpha*=.23;}P.line(g,x,y,x,y-90*k,'#5c655e',6*k);P.line(g,x-1,y,x-1,y-87*k,'#909480',2*k);
    const sway=reduced?0:Math.sin(clock*.7+t.seed)*1.7;if(t.kind==='snag'){for(let i=0;i<5;i++){const sign=i%2?1:-1;P.line(g,x,y-(45+i*10)*k,x+sign*(12+i*3)*k,y-(60+i*10)*k,'#72857b',3*k);}}else for(let i=0;i<6;i++){const top=y-(139-i*20)*k,w=(12+i*6)*k;P.poly(g,[[x+sway,top],[x+w,top+36*k],[x-w,top+35*k]],i%2?'#375e60':'#476a69');P.poly(g,[[x+sway,top],[x+w*.75,top+24*k],[x-w*.8,top+27*k]],i%2?'#bad0cb':'#a5bfc2');}
    P.ell(g,x,y+2,19*k,4*k,C.lit);if(fade){g.restore();g._c=null;}
  });
}
function elevatedSnow(r){
  for(const zone of rows(WORLD.elevationZones)){
    if(zone.id==='gallery-loft'||!r.visible(zone.x+zone.w/2,zone.y+zone.h,zone.z,zone.w+120,zone.h+180,90))continue;
    // These are supporting ground surfaces, drawn before the depth queue.
    // Characters, shadows and chute steps all project at the same authored
    // elevation; the ridge is a visible snow shelf rather than floating feet.
    const loft=/loft/.test(zone.id);r.box(r.ctx,zone.x,zone.y,0,zone.x+zone.w,zone.y+zone.h,zone.z,loft?'#aa9874':'#b7cbcc',loft?'#6d6250':'#7b99a5');
    for(let y=zone.y+9;y<zone.y+zone.h;y+=21)P.line(r.ctx,...r.w(zone.x+4,y,zone.z),...r.w(zone.x+zone.w-4,y+2,zone.z),loft?'#d0b991':'#d0dcd2',1);
    if(/chute/.test(zone.id))for(let x=zone.x+8;x<zone.x+zone.w;x+=17)P.line(r.ctx,...r.w(x,zone.y,zone.z),...r.w(x+3,zone.y+zone.h,zone.z),'#90acb5',2);
  }
}
function obstruction(r,o,s){
  const height=o.height||o.z||28,base=o.baseZ||0;if(!r.visible(o.x+o.w/2,o.y+o.h,base,o.w+100,height+100,90))return;
  r.queue(o.x+o.w/2,o.y+o.h,base,g=>{const at=r.w(s.player.x,s.player.y,s.player.z||0),front=r.w(o.x+o.w/2,o.y+o.h,base),fade=front[1]>at[1]&&front[1]-height*1.6<at[1]&&Math.abs(front[0]-at[0])<o.w+20;if(fade){g.save();g.globalAlpha*=.3;}
    const material=(o.kind||'')+' '+(o.id||''),iron=/rail|traverser|scale|winch|wheel/.test(material),snow=/snow/.test(material),stone=/stone|rock|quarry/.test(material),wood=/timber|beam|gallery|log|crate|wagon/.test(material);
    r.box(g,o.x,o.y,base,o.x+o.w,o.y+o.h,base+height,snow?'#d0ded4':iron?'#93b3a5':stone?'#a1b4b0':'#ab9875',snow?'#7896a2':iron?C.iron:stone?'#637e82':C.wood);
    for(let z=base+8;z<base+height;z+=iron?17:wood?9:15)P.line(g,...r.w(o.x,o.y+o.h,z),...r.w(o.x+o.w,o.y+o.h,z),iron?'#adc2b2':wood?'#8d785b':'#8da5a5',1);
    if(/crate|cover/.test(o.kind||'')){P.line(g,...r.w(o.x+3,o.y+o.h,base+3),...r.w(o.x+o.w-3,o.y+o.h,base+height-3),'#bfa781',2);P.line(g,...r.w(o.x+3,o.y+o.h,base+height-3),...r.w(o.x+o.w-3,o.y+o.h,base+3),'#bfa781',2);}
    if(/machinery/.test(material)){
      const center=r.w(o.x+o.w*.5,o.y+o.h,base+height*.52),radius=Math.min(o.w*.32,height*.42)*r.view.scale;P.ell(g,...center,radius,radius*.7,'#2d4745');P.ell(g,...center,radius*.76,radius*.5,'#699887');P.ell(g,...center,radius*.45,radius*.29,'#b1bda1');for(let i=0;i<8;i++){const a=i*TAU/8;P.line(g,center[0]+Math.cos(a)*radius*.1,center[1]+Math.sin(a)*radius*.07,center[0]+Math.cos(a)*radius*.72,center[1]+Math.sin(a)*radius*.47,'#3b5c53',3);}P.disc(g,...center,4,'#ccb987');
      for(const dx of[o.w*.18,o.w*.82]){const at=r.w(o.x+dx,o.y+o.h,base+height*.83);P.rect(g,at[0]-8,at[1]-7,16,13,'#c5bc94');P.line(g,at[0]-4,at[1]-3,at[0]+5,at[1]+3,'#586a5e',1);}for(const f of[.15,.85])P.line(g,...r.w(o.x+o.w*f,o.y,base+height+2),...r.w(o.x+o.w*f,o.y+o.h,base+height+2),'#c7c7ab',3);
    }
    if(o.kind==='trunk'){
      const cx=o.x+o.w/2,cy=o.y+o.h/2;for(const dz of[height*.4,height*.58,height*.72])for(const sign of[-1,1])P.line(g,...r.w(cx,cy,base+dz),...r.w(cx+sign*(o.w+4),cy+sign*5,base+dz+14),'#768879',4);for(const f of[.12,.35,.63,.84])P.line(g,...r.w(o.x+o.w*f,o.y+o.h,base+4),...r.w(o.x+o.w*f,o.y+o.h,base+height),'#7b7c66',2);
    }
    if(fade){g.restore();g._c=null;}
  });
}
function architecture(r,s,world=WORLD){
  for(const b of rows(world.interiors)){poly(r,r.ctx,[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]],'#8a846f');for(let x=b.x+5;x<b.x+b.w;x+=12)P.line(r.ctx,...r.w(x,b.y,0),...r.w(x,b.y+b.h,0),'#6e6c5a',1);}
  for(const o of rows(world.obstacles))obstruction(r,o,s);
  for(const b of rows(world.interiors)){
    const inside=s.player.x>b.x-50&&s.player.x<b.x+b.w+50&&s.player.y>b.y-60&&s.player.y<b.y+b.h+65;if(inside||b.roof===false)continue;const height=b.height||68;
    r.queue(b.x+b.w/2,b.y+b.h,height,g=>{const ridge=b.x+b.w/2;poly(r,g,[[b.x-8,b.y-7,height],[ridge,b.y-7,height+23],[ridge,b.y+b.h+8,height+23],[b.x-8,b.y+b.h+8,height]],'#c4d6d0');poly(r,g,[[ridge,b.y-7,height+23],[b.x+b.w+8,b.y-7,height],[b.x+b.w+8,b.y+b.h+8,height],[ridge,b.y+b.h+8,height+23]],'#7497a0');for(let y=b.y;y<b.y+b.h;y+=15)P.line(g,...r.w(b.x-8,y,height),...r.w(ridge,y,height+23),'#dce6d7',1);});
  }
}
function prop(r,p,s,clock){
  if(!r.visible(p.x,p.y,p.z||0,180,180,120))return;r.queue(p.x,p.y,p.z||0,g=>{const story=record(s),objects=s.rivalObjects||story.objects||{},[x,y]=r.w(p.x,p.y,p.z||0),kind=p.kind||'',id=p.id||'',known=s.rival?.recon?.[id]||s.rival?.observed?.includes?.(id);
    if(/traverser/.test(kind+' '+id)){
      // Radial rail deck and oxidized pivot. Its blocking machinery is drawn
      // separately from WORLD.obstacles, exactly where the collision lives.
      const radius=p.radius||115,pts=[];for(let i=0;i<32;i++){const a=i*TAU/32;pts.push(r.w(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius,p.z||0));}P.poly(g,pts,'#677c77');for(let i=0;i<32;i++){const a=i*TAU/32;P.line(g,...r.w(p.x+Math.cos(a)*(radius-5),p.y+Math.sin(a)*(radius-5),4),...r.w(p.x+Math.cos(a)*(radius+3),p.y+Math.sin(a)*(radius+3),4),'#b0bba8',2);}for(let d=-90;d<=90;d+=15)P.line(g,...r.w(p.x-90,p.y+d,5),...r.w(p.x+90,p.y+d,5),'#9b9072',3);for(const d of[-12,12])P.line(g,...r.w(p.x-108,p.y+d,7),...r.w(p.x+108,p.y+d,7),'#c0c8b4',3);P.ell(g,x,y-5,18,8,C.oxide);P.disc(g,x,y-6,4,C.brass);
    }else if(/scale|weigh/.test(kind+' '+id)){
      for(const dx of[-24,24])P.line(g,x+dx,y,x+dx,y-64,C.oxide,6);P.line(g,x-32,y-62,x+32,y-62,'#8eada0',6);P.ell(g,x,y-27,23,10,'#496760');P.line(g,x,y-63,x,y-28,'#c9b987',2);P.rect(g,x-12,y-76,24,18,'#476760');P.ell(g,x,y-67,8,7,'#d0c7a3');P.line(g,x,y-67,x+4,y-71,'#465955',1);
    }else if(/cap-wagon|wagon/.test(kind+' '+id)){
      for(const dx of[-27,27]){P.ell(g,x+dx,y,12,13,'#485c55');P.ell(g,x+dx,y,8,9,'#a89570');for(let i=0;i<4;i++){const a=i*TAU/4;P.line(g,x+dx,y,x+dx+Math.cos(a)*8,y+Math.sin(a)*9,'#675c49',2);}}P.poly(g,[[x-32,y-36],[x+29,y-36],[x+29,y-14],[x-32,y-16]],'#8b7757');for(let i=0;i<6;i++)P.line(g,x-29+i*11,y-35,x-29+i*11,y-15,'#b4a079',2);P.rect(g,x-7,y-46,14,10,'#577b6c');P.line(g,x-6,y-44,x+6,y-44,'#d8c49b',1);P.line(g,x+29,y-16,x+54,y-8,'#a08962',4);
    }else if(/timber-gallery/.test(kind)){
      const w=p.w||380,h=p.h||75,z=p.z||32;poly(r,g,[[p.x-w/2,p.y-h/2,z],[p.x+w/2,p.y-h/2,z],[p.x+w/2,p.y+h/2,z],[p.x-w/2,p.y+h/2,z]],'#7e7960');for(let dx=-w/2;dx<=w/2;dx+=22)P.line(g,...r.w(p.x+dx,p.y-h/2,z),...r.w(p.x+dx,p.y+h/2,z),'#b5a888',2);for(const dx of[-w/2,w/2])P.line(g,...r.w(p.x+dx,p.y,0),...r.w(p.x+dx,p.y,z),'#6a604e',7);P.line(g,...r.w(p.x-w/2,p.y-h/2,z+7),...r.w(p.x+w/2,p.y-h/2,z+7),'#c3bc99',3);
    }else if(/crate|charge/.test(kind+' '+id)){
      const item=objects['charge-crate']||Object.values(s.itemInstances||{}).find(i=>i.id===id||i.location?.targetId===id),station=item?.location?.type==='station',atStation=station&&item.location.targetId===id,store=/store/.test(kind+' '+id);
      if(item&&(item.location?.type==='carried'||station&&!atStation&&!(item.location.targetId==='quarry-charge-store'&&store)))return;if(store&&!item)return;
      r.box(g,p.x-21,p.y-13,p.z||0,p.x+21,p.y+13,(p.z||0)+24,'#b19a71','#756548');for(const dx of[-13,13])P.line(g,x+dx,y-25,x+dx,y,'#c9b589',2);P.rect(g,x-6,y-16,12,7,'#537c6c');P.line(g,x-4,y-14,x+4,y-14,'#d1c59a',1);
    }else if(/shelf|worktop|workbench/.test(kind+' '+id)){
      r.box(g,p.x-30,p.y-12,0,p.x+30,p.y+12,p.z||30,'#a3906a','#73644d');for(let i=0;i<4;i++){P.rect(g,x-22+i*12,y-8,8,6,'#8b7852');P.line(g,x-20+i*12,y-8,x-20+i*12,y-12,'#cab489',1);}
    }else if(/ledger|diagram|plan|seizure|account/.test(kind+' '+id)){
      r.box(g,p.x-20,p.y-12,0,p.x+20,p.y+12,p.z||30,'#9c8a65','#6e624f');if(id==='route-plans'&&['route-diagram','seizure-list'].every(key=>objects[key]?.location?.type==='carried'))return;P.poly(g,[[x-16,y-9],[x+16,y-9],[x+15,y+6],[x-17,y+7]],C.paper);P.line(g,x-12,y-5,x+10,y+3,'#7a7158',1);P.line(g,x-5,y-8,x+6,y+5,'#8f7553',1);P.rect(g,x-11,y-1,7,5,'#929d85');
    }else if(/pulley|winch/.test(kind+' '+id)){
      P.line(g,x-17,y,x-17,y-73,'#776d59',7);P.line(g,x+19,y,x+19,y-70,'#776d59',7);P.line(g,x-23,y-72,x+24,y-72,'#a58c65',6);P.ell(g,x,y-72,10,9,'#69897a');P.ell(g,x,y-72,6,5,'#b7b99b');P.line(g,x-1,y-73,x+6,y-20,'#bdab7e',2);P.line(g,x+6,y-20,x+17,y-6,'#c8b589',2);
    }else if(/hitch|mount-line/.test(kind+' '+id)){
      for(const dx of[-32,32])P.line(g,x+dx,y,x+dx,y-31,'#7b6d56',5);P.line(g,x-37,y-26,x+37,y-26,'#af9974',5);P.line(g,x-36,y-28,x+36,y-28,'#d4c4a2',1);
    }else if(/track|hoof|groove/.test(kind+' '+id)){
      for(let i=0;i<8;i++){const dx=i*6-21;if(/wheel|groove/.test(kind))P.line(g,x+dx,y-5,x+dx+5,y-5,'#6b8689',2);else{P.ell(g,x+dx,y-dx*.25,2,3,known?'#526c67':'#718b8e');P.line(g,x+dx,y-dx*.25-2,x+dx,y-dx*.25+2,'#c6d7ce',1);}}
    }else if(/gate|trailpost|sign/.test(kind+' '+id)){
      P.line(g,x,y,x,y-57,'#786c55',5);P.rect(g,x-28,y-53,56,17,'#698277');P.line(g,x-20,y-45,x+17,y-45,'#dfcea5',2);P.line(g,x+17,y-45,x+10,y-49,'#dfcea5',2);
    }else if(/lantern|lamp/.test(kind+' '+id)){
      P.line(g,x,y,x,y-47,'#88785c',3);P.rect(g,x-5,y-44,10,13,'#d4b67b');P.rect(g,x-3,y-42,6,8,'#e5cea0');P.ddisc(g,x,y-37,18,'#edc88b',.12);
    }else if(/holding|rest|bench/.test(kind+' '+id)){
      P.poly(g,[[x-32,y-16],[x+33,y-16],[x+33,y-4],[x-32,y-4]],'#a3916e');for(const dx of[-26,27])P.line(g,x+dx,y-7,x+dx,y+5,'#76684d',4);P.line(g,x-30,y-17,x+30,y-17,'#c3ad82',2);
    }else if(/stove/.test(kind+' '+id)){
      P.rect(g,x-20,y-30,40,28,'#3c5651');P.line(g,x+12,y-28,x+12,y-76,'#5b7066',8);P.rect(g,x-12,y-19,21,12,'#cc9e6a');P.line(g,x-12,y-15,x+9,y-15,'#edd1a1',1);
    }else if(/weapon-rack/.test(kind)){
      for(const dx of[-21,21])P.line(g,x+dx,y+4,x+dx,y-24,'#71614d',4);P.line(g,x-25,y-19,x+25,y-19,'#b49a71',5);for(const [i,w]of Object.values(s.weapons||{}).filter(w=>w.location==='saddle').entries()){const dx=-15+i*13;P.line(g,x+dx,y-18,x+dx+3,y-38,'#879e8e',2);P.line(g,x+dx+3,y-38,x+dx+4,y-47,'#baa786',3);}
    }else if(/debt-card/.test(kind)){
      if(story.scope?.observed?.levi){P.rect(g,x-7,y-5,14,10,C.paper);P.line(g,x-5,y-3,x+5,y-3,'#88785a',1);P.line(g,x-2,y-5,x+1,y+4,'#aa9874',1);}
    }else if(/cap-tin|cap-store/.test(kind)){
      const tin=objects['cap-tin'];if(tin&&tin.location?.type!=='station'&&tin.location?.targetId!==id)return;P.rect(g,x-6,y-5,12,9,C.oxide);P.line(g,x-5,y-5,x+5,y-5,'#c8b786',2);
    }else if(kind==='cup'){
      P.ell(g,x,y-5,4,2,'#c9c6a8');P.rect(g,x-4,y-5,8,6,'#a4afa0');P.ell(g,x+5,y-2,3,3,'#919e91');
    }
  });
}
function tracks(r,s){
  for(const sample of rows(s.rival?.tracks?.samples||s.rival?.trackSamples||s.rival?.footprints)){if(!Number.isFinite(sample.x)||!r.visible(sample.x,sample.y,sample.z||0,20,20,10))continue;const q=r.w(sample.x,sample.y,sample.z||0);P.ell(r.ctx,q[0]-2,q[1],1.5,3,'#587780');P.ell(r.ctx,q[0]+3,q[1]+1,1.5,3,'#587780');}
}
function overlay(r,s){
  r.overlay(g=>{
    const story=record(s),scope=s.scope||s.sightglass||story.scope||{},focus=s.focus||story.focus||{},all=rivalEntities(s),pointer=s.pointer||{x:r.bw/2,y:r.bh/2};
    if(scope.active||scope.raised){const cx=r.bw/2,cy=r.bh/2,rx=Math.min(r.bw*.43,230),ry=Math.min(r.bh*.4,145);g.save();g.beginPath();g.rect(0,0,r.bw,r.bh);g.ellipse(cx,cy,rx,ry,0,0,TAU,true);g.fillStyle='rgba(19,37,40,.82)';g.fill('evenodd');g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.strokeStyle='#b9a77c';g.lineWidth=3;g.stroke();g.restore();g._c=null;for(const sign of[-1,1]){P.line(g,cx+sign*8,cy,cx+sign*28,cy,'#d5cda7',1);P.line(g,cx,cy+sign*8,cx,cy+sign*25,'#d5cda7',1);}P.line(g,cx-rx+16,cy+ry-17,cx-rx+50,cy+ry-17,'#c5ba93',1);}
    if(focus.active)P.blend(g,.065,'normal',()=>P.rect(g,0,0,r.bw,r.bh,'#cda976'));
    for(const[order,mark]of rows(focus.queue?.length?focus.queue:focus.marks).entries()){
      const body=all[mark.targetId];if(!body||body.hidden)continue;const p=mark.localHitPoint||mark.localPoint||mark.point||mark.hitPoint||mark.local,offset=Array.isArray(p)?p:p&&Number.isFinite(p.x)?[p.x,p.y||0,p.z||0]:[mark.x||0,mark.y||0,mark.z??(mark.zone==='head'?body.mounted?78:42:body.mounted?65:29)],co=p?Math.cos(body.facing||0):1,si=p?Math.sin(body.facing||0):0,q=r.w(body.x+offset[0]*co-offset[1]*si,body.y+offset[0]*si+offset[1]*co,(body.z||0)+offset[2]);
      for(const sign of[-1,1]){P.line(g,q[0]+sign*3,q[1]+sign*3,q[0]+sign*7,q[1]+sign*7,'#f0ba8f',2);P.line(g,q[0]+sign*3,q[1]-sign*3,q[0]+sign*7,q[1]-sign*7,'#f0ba8f',2);}if(g.fillText){g.font='8px monospace';g.fillStyle='#f2dcb3';g.fillText(String(order+1),q[0]+8,q[1]-5);g._c=null;}
    }
    if(s.aiming&&!scope.active&&!scope.raised){const{x,y}=pointer;for(const sign of[-1,1]){P.line(g,x+sign*5,y,x+sign*11,y,'#eadfb9',1);P.line(g,x,y+sign*5,x,y+sign*11,'#eadfb9',1);}P.dot(g,x,y,focus.active?'#d69c7a':'#ac7059');}
    const target=s.interactionTarget||s.nearby;if(target&&Number.isFinite(target.x)){const q=r.w(target.x,target.y,(target.z||0)+44);P.poly(g,[[q[0],q[1]-5],[q[0]+4,q[1]],[q[0],q[1]+5],[q[0]-4,q[1]]],'#e3d4ac');}
  });
}
export function createBellwetherRenderer(game){
  const ground=terrain(),scenery=trees(),actors=createRivalActors(E,game);let clock=0;
  return{update(dt,s){if(!game.reduceMotion)clock+=dt;actors.update(dt,s);},draw(r,s){
    const h=sky(r,clock,game.reduceMotion),g=r.ctx;g.save();g.beginPath();g.rect(0,h,r.bw,r.bh-h);g.clip();P.rect(g,0,h,r.bw,r.bh-h,'#9fb8bd');g.transform(r.view.ax,r.view.bx,r.view.ay,r.view.by,-r.ix,-r.iy);g.drawImage(ground,0,0);g.restore();
    elevatedSnow(r);tracks(r,s);architecture(r,s);for(const t of scenery)if(r.w(t.x,t.y,0)[1]>h)tree(r,t,s,clock,game.reduceMotion);for(const p of rows(WORLD.props))prop(r,p,s,clock);actors.draw(r,s);
    for(const b of s.bullets||[])r.queue(b.x,b.y,b.z||32,g=>P.line(g,...r.w(b.x,b.y,b.z||32),...r.w(b.x-(b.vx||0)*.018,b.y-(b.vy||0)*.018,(b.z||32)-(b.vz||0)*.018),'#e2ce9c',2));overlay(r,s);
  },inspectAnimation:()=>actors.inspect()};
}
export function createRivalCampPresentation(game){
  const actors=createRivalActors(E,game);let clock=0;
  return{update(dt,s){if(!game.reduceMotion)clock+=dt;actors.update(dt,s);},draw(r,s){
    const camp=WORLD.camp||{};architecture(r,s,camp);const placed=new Set();for(const p of rows(camp.props)){const key=`${p.kind}:${p.x}:${p.y}`;if(placed.has(key))continue;placed.add(key);prop(r,p,s,clock);}actors.draw(r,s);if(s.campaign?.activeMissionId==='snowbound-the-names-they-took')overlay(r,s);
  },inspect:()=>actors.inspect()};
}
