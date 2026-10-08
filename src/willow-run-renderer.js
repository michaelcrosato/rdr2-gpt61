import { WILLOW_RUN_WORLD as WORLD } from '../content/campaign/willow-run.js';
import { createWillowActors } from './willow-run-actors.js';

const E=globalThis.My3D2dge,P=E.px,rows=v=>Array.isArray(v)?v:Object.values(v||{});
const hash=n=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
const poly=(r,g,pts,color)=>P.poly(g,pts.map(p=>r.w(p[0],p[1],p[2]||0)),color);
function segmentDistance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
function makeTerrain(){
  const cv=document.createElement('canvas');cv.width=WORLD.width;cv.height=WORLD.height;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;P.rect(g,0,0,cv.width,cv.height,'#aeb9a5');
  for(let y=0;y<cv.height;y+=25)for(let x=0;x<cv.width;x+=25)P.rect(g,x,y,26,26,Math.sin(x/180+y/94)>.1?'#b9c2aa':'#a7b39d');
  for(let i=0;i<180;i++)P.ell(g,hash(i+38)*cv.width,hash(i+338)*cv.height,18+hash(i+143)*85,12+hash(i+29)*40,i%3?'#d2d5bd':'#929d82');
  for(const z of WORLD.terrainZones){P.rect(g,z.x,z.y,z.w,z.h,z.kind==='mud'?'#a59474':z.kind==='grass'?'#87947a':z.kind==='snow'?'#d3d7bf':'#b6bda0');for(let i=0;i<200;i++){const x=z.x+hash(i+z.x)*z.w,y=z.y+hash(i+z.y)*z.h;P.line(g,x,y,x+3+hash(i+44)*6,y+2,z.kind==='mud'?'#887b60':z.kind==='grass'?'#a5b092':'#b5c4b0',1);}}
  for(const path of[WORLD.trail,WORLD.returnRoute])for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];P.line(g,a.x,a.y,b.x,b.y,'#a3a88d',34);P.line(g,a.x,a.y,b.x,b.y,'#b6b494',19);}
  P.line(g,425,1305,800,1440,'#948c71',28);P.line(g,425,1305,800,1440,'#b8a881',12);
  for(let i=1;i<WORLD.stream.length;i++){const a=WORLD.stream[i-1],b=WORLD.stream[i];P.line(g,a.x,a.y,b.x,b.y,'#d7d9bd',WORLD.creekWidth+22);P.line(g,a.x,a.y,b.x,b.y,'#7c9a9b',WORLD.creekWidth+6);P.line(g,a.x,a.y,b.x,b.y,'#527977',WORLD.creekWidth-7);P.line(g,a.x-5,a.y,b.x-5,b.y,'#9bbdb0',10);}
  for(const pool of WORLD.pools){P.ell(g,pool.x,pool.y,pool.rx+7,pool.ry+6,'#6d8c83');P.ell(g,pool.x,pool.y,pool.rx,pool.ry,'#47746f');for(let i=0;i<50;i++){const a=hash(i+7)*Math.PI*2,x=pool.x+Math.cos(a)*(pool.rx-7),y=pool.y+Math.sin(a)*(pool.ry-7);P.line(g,x,y,x+3,y-8,'#847c52',2);}}
  for(const ford of WORLD.fords){P.rect(g,ford.x,ford.y,ford.w,ford.h,'#899d83');for(let i=0;i<60;i++)P.ell(g,ford.x+hash(i+53)*ford.w,ford.y+hash(i+122)*ford.h,2+hash(i+55)*5,2,'#c4c5a1');}
  for(let i=0;i<8000;i++){const x=hash(i+584)*cv.width,y=hash(i+714)*cv.height;P.line(g,x,y,x+3+hash(i+541)*5,y+1,i%4?'#c3cbb1':'#90a58b',1);}return cv;
}
function makeTrees(){
  const trees=[],paths=[WORLD.trail,WORLD.returnRoute,WORLD.searchRoute,WORLD.secondRoute,...WORLD.habitats.map(h=>h.routine)];
  for(let i=0;i<330;i++){
    const x=35+hash(i+319)*(WORLD.width-70),y=40+hash(i+231)*(WORLD.height-80);
    if(paths.some(path=>path.some((b,j)=>j&&segmentDistance(x,y,path[j-1],b)<52))||WORLD.stream.some((b,j)=>j&&segmentDistance(x,y,WORLD.stream[j-1],b)<60)||WORLD.props.some(p=>Math.hypot(x-p.x,y-p.y)<75)||WORLD.obstacles.some(o=>x>o.x-28&&x<o.x+o.w+28&&y>o.y-28&&y<o.y+o.h+28))continue;
    trees.push({x,y,seed:i,kind:i%4?'cedar':'willow',size:.65+hash(i+863)*.8});
  }return trees;
}
function sky(r){const g=r.ctx,h=Math.min(90,r.H*.15);r.sky(['#758a89','#a6b5a2','#d2d2b6'],{bands:16});for(let l=0;l<3;l++){const pts=[[-30,h]];for(let x=-70,i=0;x<r.bw+100;x+=100,i++)pts.push([x,h],[x+28,h-14-l*13-hash(i+l*33)*22],[x+55,h-10-l*9],[x+100,h]);pts.push([r.bw+50,h]);P.poly(g,pts,['#a2b3a2','#8c9c8d','#6d897f'][l]);}return h;}
function tree(r,t,s,clock,reduced){
  if(!r.visible(t.x,t.y,0,80,190,70))return;r.queue(t.x,t.y,0,g=>{
    const[x,y]=r.w(t.x,t.y,0),k=t.size,targets=[s.player,...rows(s.animals).filter(a=>a.kind==='deer'&&!a.hidden)],fade=targets.some(a=>{const p=r.w(a.x,a.y,a.z||0);return p[1]<y+8&&p[1]>y-135*k&&Math.abs(p[0]-x)<35*k;});
    if(fade){g.save();g.globalAlpha*=.22;}P.line(g,x,y,x+2*k,y-89*k,'#68684c',6*k);P.line(g,x-1*k,y,x+1*k,y-88*k,'#9e9572',2*k);
    const wind=reduced?0:Math.sin(clock*.85+t.seed)*2;
    if(t.kind==='cedar'){for(let i=0;i<6;i++){const top=y-(130-i*18)*k,w=(13+i*5)*k;P.poly(g,[[x+wind,top],[x+w,top+35*k],[x-w,top+34*k]],i%2?'#4f7164':'#597b65');P.poly(g,[[x+wind,top],[x+w*.8,top+21*k],[x-w*.75,top+25*k]],'#bfc9b0');}}
    else{for(let i=0;i<7;i++){const side=i%2?1:-1,at=y-(48+i*7)*k,end=x+side*(19+i*3)*k+wind;P.line(g,x,at,end,at-13*k,'#7d8161',2);P.line(g,end,at-13*k,end+side*6*k+wind,at+13*k,'#8e9b70',2);for(let j=0;j<4;j++)P.line(g,end+side*j*k,at-8*k+j*5*k,end+side*(7+j)*k,at-3*k+j*6*k,'#a9b286',2);}}
    P.ell(g,x,y+1,18*k,4*k,'#cbd2b6');if(fade){g.restore();g._c=null;}
  });
}
function architecture(r,s){
  for(const o of WORLD.obstacles){if(!r.visible(o.x+o.w/2,o.y+o.h,0,o.w+100,o.height+90,70))continue;
    if(o.kind==='ravine'){poly(r,r.ctx,[[o.x,o.y,0],[o.x+o.w,o.y,0],[o.x+o.w,o.y+o.h,0],[o.x,o.y+o.h,0]],'#344f4d');P.line(r.ctx,...r.w(o.x,o.y,0),...r.w(o.x,o.y+o.h,0),'#a2ae92',4);continue;}
    r.queue(o.x+o.w/2,o.y+o.h,0,g=>{const at=r.w(s.player.x,s.player.y,s.player.z||0),front=r.w(o.x+o.w/2,o.y+o.h,0),fade=front[1]>at[1]&&front[1]-o.height*1.5<at[1]&&Math.abs(front[0]-at[0])<o.w+30;
      if(fade){g.save();g.globalAlpha*=.28;}r.box(g,o.x,o.y,0,o.x+o.w,o.y+o.h,o.height,o.kind==='log'||o.kind==='root'?'#a4976d':'#b3b8a0',o.kind==='log'||o.kind==='root'?'#746d51':'#737e70');for(let z=10;z<o.height;z+=16)P.line(g,...r.w(o.x,o.y+o.h,z),...r.w(o.x+o.w,o.y+o.h,z),'#929d83',1);if(fade){g.restore();g._c=null;}});
  }
}
function drawProp(r,p,s,clock,reduced){
  if(!r.visible(p.x,p.y,p.z||0,110,140,60))return;r.queue(p.x,p.y,p.z||0,g=>{const[x,y]=r.w(p.x,p.y,p.z||0),known=s.tracks?.inspected?.[p.id]||s.hunt?.inspected?.[p.id];
    if(p.kind==='hitch'){for(const dx of[-30,30])P.line(g,x+dx,y,x+dx,y-30,'#817a57',5);P.line(g,x-34,y-24,x+34,y-24,'#b3a077',5);P.line(g,x-34,y-26,x+34,y-26,'#d0c19a',2);}
    else if(p.kind==='trailpost'||p.kind==='road-sign'||p.kind==='gorge-marker'){P.line(g,x,y,x,y-50,'#8b8060',5);P.rect(g,x-26,y-45,52,16,p.kind==='road-sign'?'#897659':'#5e765a');P.line(g,x-15,y-37,x+15,y-37,'#d9d0aa',2);P.line(g,x+15,y-37,x+9,y-41,'#d9d0aa',2);if(p.kind==='gorge-marker')P.line(g,x-10,y-30,x+10,y-10,'#b1a076',2);}
    else if(p.kind==='rest'){P.ell(g,x,y,24,11,'#a9b295');P.poly(g,[[x-15,y-6],[x+17,y-6],[x+12,y+6],[x-14,y+7]],'#85876a');P.line(g,x-9,y-5,x-9,y+6,'#c5b88e',2);}
    else if(p.kind==='ribbon'){P.line(g,x,y,x,y-40,'#9d8e66',3);const sway=reduced?0:Math.sin(clock*1.9)*3;P.poly(g,[[x,y-40],[x-20,y-33+sway],[x-32,y-35-sway],[x-18,y-42]],'#b27450');}
    else if(p.kind==='hoof-sign'||p.kind==='old-track'){for(let i=0;i<6;i++){const d=i*5-15;P.ell(g,x+d,y-d*.4,2,3,p.kind==='old-track'?'#a8b6a0':known?'#5f6850':'#74795a');P.line(g,x+d,y-d*.4-2,x+d,y-d*.4+2,'#c3c5a0',1);}}
    else if(p.kind==='browse-sign'){for(let i=0;i<5;i++){const d=i*4-8;P.line(g,x+d,y,x+d-2,y-8-i%2*3,'#82734c',2);P.line(g,x+d-3,y-8-i%2*3,x+d,y-8-i%2*3,'#c8c59e',2);}if(p.id==='cedar-rub')P.line(g,x-13,y-18,x-13,y-5,'#a68c5a',4);}
    else if(p.kind==='abandoned-cart'){for(const dx of[-25,25]){P.ell(g,x+dx,y,12,13,'#6b6d4e');P.ell(g,x+dx,y,8,9,'#b0a478');}P.poly(g,[[x-28,y-32],[x+25,y-32],[x+25,y-10],[x-28,y-13]],'#96815d');for(let i=0;i<6;i++)P.line(g,x-26+i*10,y-29,x-26+i*10,y-12,'#b5a277',2);P.line(g,x+25,y-15,x+44,y-5,'#857550',4);}
  });
}
function trackRows(s){const t=s.tracks||{},h=s.hunt||{};const samples=[...Object.entries(t.samples||{}).flatMap(([animalId,v])=>rows(v).map(p=>({...p,animalId}))),...rows(t.footprints),...rows(t.blood),...rows(h.trackSamples)];return samples.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));}
function drawTracks(r,s){const list=trackRows(s),fallback=!s.tracks?.samples&&!list.length?WORLD.habitats.filter(h=>h.animalId.includes('doe')||h.animalId.includes('buck')).flatMap(h=>h.initialTracks.map((p,i)=>({...p,animalId:h.animalId,index:i}))):list,overlay=!!s.tracks?.overlay;
  const footprints=[],previous=new Map();
  for(const p of fallback){const before=previous.get(p.animalId),distance=before&&Math.hypot(p.x-before.x,p.y-before.y);if(before&&distance>10&&distance<180)for(let i=1;i<Math.ceil(distance/12);i++){const t=i/Math.ceil(distance/12);footprints.push({...p,x:before.x+(p.x-before.x)*t,y:before.y+(p.y-before.y)*t});}footprints.push(p);previous.set(p.animalId,p);}
  for(const p of footprints){if(!r.visible(p.x,p.y,p.z||0,20,20,10))continue;const blood=p.kind==='blood'||p.type==='blood',wet=WORLD.stream.some((b,j)=>j&&segmentDistance(p.x,p.y,WORLD.stream[j-1],b)<WORLD.creekWidth*.42),ford=WORLD.fords.some(f=>p.x>f.x&&p.x<f.x+f.w&&p.y>f.y&&p.y<f.y+f.h);if(wet&&!ford&&!blood)continue;const q=r.w(p.x,p.y,p.z||0),color=blood?'#98634f':overlay?'#e1d2a7':'#707b62';P.ell(r.ctx,q[0]-2,q[1],blood?2:1.5,blood?2:3,color);if(!blood)P.ell(r.ctx,q[0]+3,q[1]+2,1.5,3,color);if(overlay&&!blood)P.line(r.ctx,q[0]-6,q[1]+4,q[0]+7,q[1]+4,'#b9b98a',1);}
}
export function createWillowRunRenderer(game){
  const terrain=makeTerrain(),trees=makeTrees(),actors=createWillowActors(E,game);let clock=0;
  return{update(dt,s){if(!game.reduceMotion)clock+=dt;actors.update(dt,s);},draw(r,s){
    const horizon=sky(r),g=r.ctx;g.save();g.beginPath();g.rect(0,horizon,r.bw,r.bh-horizon);g.clip();P.rect(g,0,horizon,r.bw,r.bh-horizon,'#bcc4aa');g.transform(r.view.ax,r.view.bx,r.view.ay,r.view.by,-r.ix,-r.iy);g.drawImage(terrain,0,0);g.restore();
    drawTracks(r,s);architecture(r,s);for(const t of trees)if(r.w(t.x,t.y,0)[1]>horizon)tree(r,t,s,clock,game.reduceMotion);for(const p of WORLD.props)drawProp(r,p,s,clock,game.reduceMotion);actors.draw(r,s);
    for(const bullet of s.bullets||[])r.queue(bullet.x,bullet.y,bullet.z||32,g=>P.line(g,...r.w(bullet.x,bullet.y,bullet.z||32),...r.w(bullet.x-bullet.vx*.018,bullet.y-bullet.vy*.018,bullet.z||32),'#e1cc93',2));
    r.overlay(g=>{const target=s.interactionTarget||s.nearby;if(target&&Number.isFinite(target.x)){const q=r.w(target.x,target.y,(target.z||0)+44);P.poly(g,[[q[0],q[1]-5],[q[0]+4,q[1]],[q[0],q[1]+5],[q[0]-4,q[1]]],'#e4d3a6');}if(s.aiming&&s.pointer&&s.weapons?.[s.player.equippedWeaponId]?.kind!=='bow'){const{x,y}=s.pointer;for(const d of[-1,1]){P.line(g,x+d*5,y,x+d*10,y,'#eee3b8',1);P.line(g,x,y+d*5,x,y+d*10,'#eee3b8',1);}P.dot(g,x,y,'#a8674d');}});
  },inspectAnimation:()=>actors.inspect()};
}

export function createWillowCampPresentation(game){
  const actors=createWillowActors(E,game);let clock=0;
  function draw(r,s){
    if(!s.entities?.orla)return;const c=WORLD.camp,b=c.interiors[0],inside=actors.animation.clip('juno')?.kind==='give-bow'||s.player.x>b.x-40&&s.player.x<b.x+b.w+40&&s.player.y>b.y-40&&s.player.y<b.y+b.h+45;
    poly(r,r.ctx,[[b.x,b.y,0],[b.x+b.w,b.y,0],[b.x+b.w,b.y+b.h,0],[b.x,b.y+b.h,0]],'#aaa381');for(let x=b.x+4;x<b.x+b.w;x+=12)P.line(r.ctx,...r.w(x,b.y,0),...r.w(x,b.y+b.h,0),'#8f8c6e',1);
    for(const o of c.obstacles)r.queue(o.x+o.w/2,o.y+o.h,0,g=>{if(inside){g.save();g.globalAlpha*=.22;}r.box(g,o.x,o.y,0,o.x+o.w,o.y+o.h,o.height,'#b1a17c','#766f53');for(let z=12;z<o.height;z+=12)P.line(g,...r.w(o.x,o.y+o.h,z),...r.w(o.x+o.w,o.y+o.h,z),'#8c8664',1);if(inside){g.restore();g._c=null;}});
    if(!inside)r.queue(b.x+b.w/2,b.y+b.h,0,g=>{poly(r,g,[[b.x-8,b.y-8,65],[b.x+b.w/2,b.y-8,87],[b.x+b.w/2,b.y+b.h+8,87],[b.x-8,b.y+b.h+8,65]],'#bfbaa0');poly(r,g,[[b.x+b.w/2,b.y-8,87],[b.x+b.w+8,b.y-8,65],[b.x+b.w+8,b.y+b.h+8,65],[b.x+b.w/2,b.y+b.h+8,87]],'#89957b');});
    for(const p of c.props){if(!r.visible(p.x,p.y,0,150,150,90))continue;r.queue(p.x,p.y,0,g=>{const[x,y]=r.w(p.x,p.y,p.z||0),ground=r.w(p.x,p.y,0);
      if(p.kind==='processing-bench'){for(const dx of[-27,27])P.line(g,x+dx,y+1,x+dx,ground[1]+5,'#807254',5);poly(r,g,[[p.x-35,p.y-10,p.z],[p.x+35,p.y-10,p.z],[p.x+35,p.y+10,p.z],[p.x-35,p.y+10,p.z]],'#b19c70');P.line(g,x-44,y+2,x+45,y+2,'#7e7151',3);const hide=Object.values(s.itemInstances||{}).find(i=>i.kind==='deer-hide'&&i.location?.type==='bench'&&i.location.targetId===p.id);if(hide){P.poly(g,[[x-21,y-3],[x+19,y-4],[x+24,y+3],[x+12,y+8],[x-15,y+7]],'#bea473');P.line(g,x-15,y,x+15,y-1,'#d4bb8b',2);}}
      else if(p.kind==='hitch'){for(const dx of[-30,30])P.line(g,x+dx,y,x+dx,y-30,'#817a57',5);P.line(g,x-34,y-24,x+34,y-24,'#b3a077',5);P.line(g,x-34,y-26,x+34,y-26,'#d0c19a',2);}
      else if(p.kind==='hide-rack'){for(const dx of[-18,18])P.line(g,...r.w(p.x+dx,p.y,0),...r.w(p.x+dx,p.y,54),'#857455',5);P.line(g,...r.w(p.x-22,p.y,48),...r.w(p.x+22,p.y,48),'#a6926b',5);const clip=actors.animation.clip('mara'),hides=Object.values(s.itemInstances||{}).filter(i=>i.kind==='deer-hide'&&i.location?.type==='drying-rack'&&i.location.targetId===p.id&&!(clip?.kind==='hang-hide'&&clip.targetId===i.id&&clip.age/clip.duration<.72));for(let i=0;i<hides.length;i++){const dx=i*25-15;P.poly(g,[[x+dx-9,y-51],[x+dx+8,y-51],[x+dx+12,y-41],[x+dx+8,y-16],[x+dx+3,y-13],[x+dx-3,y-18],[x+dx-11,y-16],[x+dx-11,y-40]],hides[i].owner==='mara'?'#c5a777':'#a89065');P.line(g,x+dx-8,y-51,x+dx-8,y-57,'#d4c596',1);P.line(g,x+dx+7,y-51,x+dx+7,y-57,'#d4c596',1);}}
      else if(p.kind==='pantry'){r.box(g,p.x-15,p.y-10,0,p.x+15,p.y+10,40,'#a69468','#7c7250');P.rect(g,x-13,y-36,26,24,'#d1c7a2');P.line(g,x-8,y-31,x+8,y-31,'#8b7e5a',2);P.line(g,x-7,y-25,x+6,y-25,'#9b906d',1);}
      else if(p.kind==='stove'){P.rect(g,x-21,y-29,42,28,'#45574b');P.line(g,x+12,y-27,x+12,y-74,'#63715c',8);P.ell(g,x-4,y-29,16,7,'#8b9277');P.ell(g,x-4,y-33,13,6,'#c3b77d');P.rect(g,x-13,y-18,19,13,'#304337');const cooking=s.flags?.cooked||s.processing?.cook;if(cooking){P.rect(g,x-10,y-15,13,7,'#d0a060');if(!game.reduceMotion)for(let i=0;i<3;i++){const t=(clock*.3+i*.31)%1;P.blend(g,(1-t)*.4,'normal',()=>P.ell(g,x-4+t*10,y-42-t*20,5+t*7,3+t*4,'#d9d9ba'));}}}
      else if(p.kind==='flour-map'){r.box(g,p.x-17,p.y-10,0,p.x+17,p.y+10,p.z,'#a9946b','#776b4e');P.poly(g,[[x-20,y-7],[x+20,y-7],[x+16,y+6],[x-18,y+8]],'#d7c8a0');P.line(g,x-14,y+4,x-6,y-3,'#8d7850',1);P.line(g,x-6,y-3,x+9,y+2,'#8d7850',1);P.disc(g,x+9,y+2,2,'#8b6b48');}
      else if(p.kind==='knife-station'&&!s.flags?.knifeSecured){P.line(g,x-8,y,x+8,y-2,'#bfc3ab',2);P.line(g,x-15,y+1,x-8,y,'#8d6c48',4);}
      else if(p.kind==='chair'){P.line(g,x-8,y,x-8,y-34,'#7e7352',4);P.line(g,x+8,y,x+8,y-34,'#7e7352',4);P.line(g,x-11,y-28,x+11,y-28,'#ad9870',5);P.line(g,x-12,y-12,x+12,y-12,'#c0aa7f',7);}
      else if(p.kind==='account'){P.rect(g,x-8,y-10,16,12,'#8b7152');P.line(g,x-6,y-8,x+5,y-8,'#ddc99d',2);}
    });}
    actors.draw(r,s);
  }
  return{update(dt,s){if(!game.reduceMotion)clock+=dt;actors.update(dt,s);},draw,inspect:()=>actors.inspect()};
}
