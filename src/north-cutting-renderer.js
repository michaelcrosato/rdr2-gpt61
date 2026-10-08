import { NORTH_CUTTING_WORLD as WORLD } from '../content/campaign/north-cutting.js';
import { createExpeditionActors } from './expedition-actors.js';
import { getCampaignPresentation } from './campaign.js';

const E=globalThis.My3D2dge,P=E.px;
const C={snow:'#c1d0cf',white:'#e0e5d6',ice:'#91b7bf',river:'#587e8d',stone:'#6c818a',ink:'#30434c'};
const hash=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
const rows=v=>Array.isArray(v)?v:Object.values(v||{});
const poly=(r,g,points,color)=>P.poly(g,points.map(p=>r.w(p[0],p[1],p[2]||0)),color);
const route=[...WORLD.trail,...WORLD.searchRoute,...WORLD.retreatRoute];
function nearSegment(x,y,a,b,radius){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<radius;}
function makeTerrain(){
  const cv=document.createElement('canvas');cv.width=WORLD.width+2;cv.height=WORLD.height+2;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;P.rect(g,0,0,cv.width,cv.height,C.snow);
  for(let y=0;y<cv.height;y+=24)for(let x=0;x<cv.width;x+=24)P.rect(g,x,y,25,25,Math.sin(x/170+y/109)>.3?'#cbd6d0':'#b9ccca');
  for(let i=0;i<130;i++)P.ell(g,hash(i+28)*cv.width,hash(i+189)*cv.height,22+hash(i+479)*75,10+hash(i+783)*38,i%3?'#d4dcd0':'#a6c2c5');
  for(const path of [WORLD.trail,WORLD.searchRoute,WORLD.retreatRoute])for(let i=1;i<path.length;i++){P.line(g,path[i-1].x,path[i-1].y,path[i].x,path[i].y,'#b3bdb0',36);P.line(g,path[i-1].x,path[i-1].y,path[i].x,path[i].y,'#c0c3b0',20);}
  for(let i=1;i<WORLD.river.length;i++){const a=WORLD.river[i-1],b=WORLD.river[i];P.line(g,a.x,a.y,b.x,b.y,'#d7e2d5',WORLD.creekWidth+30);P.line(g,a.x,a.y,b.x,b.y,'#7199a6',WORLD.creekWidth+10);P.line(g,a.x,a.y,b.x,b.y,C.river,WORLD.creekWidth-12);P.line(g,a.x-5,a.y,b.x-5,b.y,'#9fc4c5',12);}
  for(let i=0;i<8200;i++){const x=hash(i+54)*cv.width,y=hash(i+508)*cv.height;P.line(g,x,y,x+3+hash(i+91)*5,y,i%4?'#dce2d2':'#9ebbbe',1);}
  return cv;
}
function scenery(){
  const list=[];
  for(let i=0;i<165;i++){const x=30+hash(i+519)*(WORLD.width-60),y=40+hash(i+251)*(WORLD.height-80);
    if(route.some((p,j)=>j&&nearSegment(x,y,route[j-1],p,75))||WORLD.river.some((p,j)=>j&&nearSegment(x,y,WORLD.river[j-1],p,70))||WORLD.props.some(p=>Math.hypot(x-p.x,y-p.y)<110)||x>1480&&y<730)continue;
    list.push({x,y,seed:i,size:.7+hash(i+396)*.6,kind:i%3?'birch':'pine'});
  }return list;
}
function sky(r){
  const g=r.ctx,h=Math.min(100,r.H*.16);r.sky(['#718999','#9db6bd','#c0d1cc'],{bands:18});
  for(let layer=0;layer<3;layer++){const pts=[[-60,h]];for(let x=-90,i=0;x<r.bw+170;x+=145,i++){const top=h*(.18+layer*.2)-hash(i+layer*23)*18;pts.push([x,h-5],[x+55,top+18],[x+85,top],[x+122,top+31],[x+145,h]);}pts.push([r.bw+100,h]);P.poly(g,pts,['#9aafb5','#809ca7','#63818e'][layer]);}
  return h;
}
function tree(r,p,state,clock,reduced){
  if(!r.visible(p.x,p.y,0,60,150,50))return;
  r.queue(p.x,p.y,0,g=>{const [x,y]=r.w(p.x,p.y,0),s=p.size,at=r.w(state.player.x,state.player.y,state.player.z||0),fade=y>at[1]&&y-130*s<at[1]&&Math.abs(x-at[0])<35*s;
    if(fade){g.save();g.globalAlpha*=.25;}
    if(p.kind==='birch'){
      P.line(g,x,y,x-4*s,y-91*s,'#797f76',7*s);P.line(g,x-1*s,y-3,x-6*s,y-91*s,'#d1d4c1',4*s);
      for(let i=0;i<5;i++)P.line(g,x-4*s,y-(15+i*15)*s,x+1*s,y-(16+i*15)*s,'#596d73',2);
      for(let i=0;i<5;i++){const side=i%2?1:-1,branch=y-(45+i*10)*s;P.line(g,x-4*s,branch,x+side*(14+i*2)*s,branch-17*s,'#829184',2);P.line(g,x+side*12*s,branch-12*s,x+side*23*s,branch-18*s,'#cfdacd',2);}
      P.line(g,x-3*s,y-90*s,x+7*s,y-117*s,'#798e90',3);P.line(g,x+5*s,y-110*s,x+19*s,y-121*s,'#819493',2);
    }else{P.line(g,x,y,x,y-84*s,'#6c7666',5);for(let i=0;i<5;i++){const top=y-115*s+i*17*s,w=(12+i*5)*s,sway=reduced?0:Math.sin(clock*.5+p.seed)*s;P.poly(g,[[x+sway,top],[x+w,top+30*s],[x-w,top+31*s]],'#4d7179');P.poly(g,[[x+sway,top],[x+w*.5,top+17*s],[x-w*.72,top+24*s]],'#b6ceca');}}
    P.ell(g,x,y+2,16*s,4*s,'#dde2d2');if(fade){g.restore();g._c=null;}
  });
}
function platforms(r,state){
  const g=r.ctx,p=state.player;
  // The lower approach stays at zero elevation until the climb begins. The
  // authored ascent strips expose that notch rather than auto-raising feet.
  for(const z of WORLD.elevationZones){
    if(!r.visible(z.x+z.w/2,z.y+z.h,z.z,z.w+100,z.z+180,100))continue;
    const at=r.w(p.x,p.y,p.z||0),corner=r.w(z.x+z.w/2,z.y+z.h,z.z),fade=(p.z||0)<z.z&&Math.abs(at[0]-corner[0])<z.w*.6&&Math.abs(at[1]-corner[1])<80;
    if(fade){g.save();g.globalAlpha*=.45;}
    const notch=WORLD.approachCorridor,ix=notch&&Math.max(z.x,notch.x),iy=notch&&Math.max(z.y,notch.y),ex=notch&&Math.min(z.x+z.w,notch.x+notch.w),ey=notch&&Math.min(z.y+z.h,notch.y+notch.h);
    const parts=notch&&ex>ix&&ey>iy?[[z.x,z.y,z.x+z.w,iy],[z.x,ey,z.x+z.w,z.y+z.h],[z.x,iy,ix,ey],[ex,iy,z.x+z.w,ey]]:[[z.x,z.y,z.x+z.w,z.y+z.h]];
    for(const [x0,y0,x1,y1]of parts)if(x1>x0&&y1>y0)r.box(g,x0,y0,0,x1,y1,z.z,'#cbdad2','#748e99');
    for(let k=12;k<z.z;k+=18)P.line(g,...r.w(z.x,z.y+z.h,k),...r.w(z.x+z.w,z.y+z.h,k),'#91a8ae',1);
    for(let i=0;i<z.w;i+=27)P.line(g,...r.w(z.x+i,z.y+z.h,z.z),...r.w(z.x+i+8,z.y+z.h,z.z-8),'#d7e4d8',2);
    for(let i=0;i<14;i++){const x=z.x+8+hash(i+z.z*7)*(z.w-16),y=z.y+5+hash(i+z.z*11)*(z.h-10);if(notch&&x>notch.x&&x<notch.x+notch.w&&y>notch.y&&y<notch.y+notch.h)continue;P.line(g,...r.w(x,y,z.z+.2),...r.w(x+8+hash(i+15)*17,y-2,z.z+.2),i%4?'#dce5d6':'#adc7cc',2);if(i%3===0)P.line(g,...r.w(x,y,z.z+.3),...r.w(x-4,y+8,z.z+.3),'#9eb9bf',1);}
    if(fade){g.restore();g._c=null;}
  }
  for(const edge of [...WORLD.climbs,...WORLD.descents]){
    const a=edge.from,b=edge.to,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,w=edge.id.startsWith('descent')?23:15,nx=-dy/len*w,ny=dx/len*w;
    poly(r,g,[[a.x+nx,a.y+ny,a.z],[b.x+nx,b.y+ny,b.z],[b.x-nx,b.y-ny,b.z],[a.x-nx,a.y-ny,a.z]],edge.id.startsWith('descent')?'#abbeb9':'#839eaa');
    for(let i=0;i<=6;i++){const t=i/6,x=a.x+dx*t,y=a.y+dy*t,z=a.z+(b.z-a.z)*t;P.line(g,...r.w(x-nx*.7,y-ny*.7,z+1),...r.w(x+nx*.7,y+ny*.7,z+1),'#d9e3d4',2);}
  }
  const a=WORLD.brace.from,b=WORLD.brace.to;P.line(g,...r.w(a.x,a.y,a.z),...r.w(b.x,b.y,b.z),'#b1cbd1',20);P.line(g,...r.w(a.x,a.y-9,a.z+4),...r.w(b.x,b.y-9,b.z+4),'#e0e8d8',3);
  poly(r,g,[[a.x,a.y-12,a.z],[b.x,b.y-12,b.z],[b.x,b.y-12,b.z+28],[a.x,a.y-12,a.z+28]],'#a6c4cd');P.line(g,...r.w(a.x,a.y-12,a.z+28),...r.w(b.x,b.y-12,b.z+28),'#d7e6db',3);
}
function architecture(r,state){
  for(const o of WORLD.obstacles){if(!r.visible(o.x+o.w/2,o.y+o.h,0,o.w+90,o.height+100,90))continue;
    r.queue(o.x+o.w/2,o.y+o.h,0,g=>{const p=state.player,at=r.w(p.x,p.y,p.z||0),front=r.w(o.x+o.w/2,o.y+o.h,0),fade=front[1]>at[1]&&front[1]-o.height<at[1]&&Math.abs(front[0]-at[0])<o.w/2+45;
      if(fade){g.save();g.globalAlpha*=.27;}r.box(g,o.x,o.y,0,o.x+o.w,o.y+o.h,o.height,o.kind==='ice'?'#c6dddd':'#abbcb6',o.kind==='ice'?'#87aebb':'#677f8a');
      if(o.kind==='stone'||o.kind==='cliff'){for(let z=12;z<o.height;z+=16)P.line(g,...r.w(o.x,o.y+o.h,z),...r.w(o.x+o.w,o.y+o.h,z),'#91a5a5',1);for(let x=o.x+20;x<o.x+o.w;x+=23)P.line(g,...r.w(x,o.y+o.h,0),...r.w(x,o.y+o.h,o.height),'#536e7c',1);}
      if(fade){g.restore();g._c=null;}
    });
  }
  const a=WORLD.lowArch;
  r.queue(a.x+a.w/2,a.y+a.h,a.z,g=>{const p=state.player,under=p.x>a.x-60&&p.x<a.x+a.w+60&&p.y<a.y+a.h+60;
    if(under){g.save();g.globalAlpha*=.45;}
    for(const x of [a.x-7,a.x+a.w-3])r.box(g,x,a.y,a.z,x+10,a.y+a.h,a.z+a.clearance,'#bac9c1','#728d97');
    poly(r,g,[[a.x-8,a.y,a.z+a.clearance],[a.x+a.w+8,a.y,a.z+a.clearance],[a.x+a.w+8,a.y+a.h,a.z+a.clearance],[a.x-8,a.y+a.h,a.z+a.clearance]],'#dae4d6');
    for(let x=a.x+8;x<a.x+a.w;x+=14)P.line(g,...r.w(x,a.y+a.h,a.z+a.clearance),...r.w(x+2,a.y+a.h,a.z+a.clearance-13-hash(x)*10),'#a9c6cc',3);
    if(under){g.restore();g._c=null;}
  });
  // Broken iron aqueduct on the back of the maintenance recess.
  r.queue(1880,322,108,g=>{P.line(g,...r.w(1730,330,156),...r.w(2070,330,156),'#566f7c',7);P.line(g,...r.w(1730,330,161),...r.w(2070,330,161),'#a3b8b5',2);for(let x=1740;x<2070;x+=25)P.line(g,...r.w(x,330,148),...r.w(x+10,330,156),'#c6d6cf',2);});
  if(state.flags?.iceCollapsed||state.worldChanges?.upperIceClosed){const g=r.ctx;for(let i=0;i<10;i++){const x=1830+hash(i+67)*150,y=360+hash(i+19)*70;poly(r,g,[[x-14,y,108],[x,y-8,130+hash(i+83)*16],[x+20,y+7,108]],i%2?'#aacbd0':'#d4e1d5');}P.line(g,...r.w(1830,390,109),...r.w(1900,365,109),'#536f7e',5);}
}
function drawProp(r,p,state,clock){
  if(p.kind==='case'&&(state.flags?.caseCollected||state.flags?.caseLost))return;
  if(!r.visible(p.x,p.y,p.z||0,100,110,60))return;
  r.queue(p.x,p.y,p.z||0,g=>{const [x,y]=r.w(p.x,p.y,p.z||0),known=state.tracks?.inspected?.[p.id];
    if(p.kind==='embers'){P.ell(g,x,y,21,10,'#59696a');for(let i=0;i<6;i++){const a=i*Math.PI/3;P.line(g,x+Math.cos(a)*16,y+Math.sin(a)*6,x-Math.cos(a)*13,y-Math.sin(a)*5,'#746b57',3);}for(let i=0;i<5;i++)P.disc(g,x-8+i*4,y-2+Math.sin(i),2,known?'#c0a47c':'#cb9874');}
    else if(p.kind==='tracks'){for(let i=0;i<7;i++){const d=i*7;P.ell(g,x+d-22,y-d*.35,2,4,known?'#607e7d':'#829c9a');P.ell(g,x+d-16,y-d*.35+4,2,4,known?'#607e7d':'#829c9a');}if(p.id==='ford-scrape')P.line(g,x-25,y+9,x+21,y-4,'#728f90',3);}
    else if(p.kind==='paper'){P.poly(g,[[x-9,y-5],[x+12,y-8],[x+8,y+6],[x+3,y+2],[x-7,y+8]],'#d7d6b7');P.line(g,x-5,y,x+5,y-2,'#9b8970',1);P.line(g,x-3,y+3,x+5,y+1,'#9b8970',1);}
    else if(p.kind==='sled'){P.line(g,x-35,y+10,x+35,y+10,'#57666b',4);P.line(g,x-38,y+13,x-43,y+4,'#57666b',3);P.line(g,x-25,y-3,x+28,y-3,'#9b8562',7);for(let i=0;i<6;i++)P.line(g,x-28+i*10,y-8,x-28+i*10,y+8,'#b4a17b',4);P.rect(g,x-19,y-25,28,20,'#8a7e66');P.poly(g,[[x-18,y-25],[x+8,y-25],[x+14,y-12],[x-13,y-12]],'#c2bea0');P.line(g,x+7,y-22,x+22,y-35,'#ab9a72',2);}
    else if(p.kind==='hitch'){for(const dx of [-30,30]){P.line(g,x+dx,y,x+dx,y-31,'#7d7860',5);P.ell(g,x+dx,y-31,4,2,'#d9dfc9');}P.line(g,x-35,y-22,x+35,y-22,'#958b69',5);P.line(g,x-35,y-24,x+35,y-24,'#c4c4a2',2);}
    else if(p.kind==='anchor'){P.disc(g,x,y-17,5,'#697e7d');P.disc(g,x,y-17,3,'#b7c4b2');if(state.flags?.ropeSecured){P.line(g,x,y-14,...r.w(WORLD.brace.from.x,WORLD.brace.from.y,WORLD.brace.from.z+25),'#c4b58c',2);P.line(g,x,y-14,x+4,y+10,'#c4b58c',2);}}
    else if(p.kind==='rest-pad'){P.ell(g,x,y,30,13,'#839e9a');P.ell(g,x,y-2,25,10,'#bbbba1');P.line(g,x-18,y-6,x+16,y+3,'#d7ceb0',2);}
    else if(p.kind==='case'){P.rect(g,x-13,y-12,26,13,'#8f795b');P.line(g,x-12,y-10,x+12,y-10,'#c6b894',2);P.rect(g,x-2,y-9,5,4,'#c9c6a8');}
    else if(p.kind==='ice'){P.poly(g,[[x-38,y-12],[x-26,y-50],[x-4,y-58],[x+25,y-34],[x+40,y+3],[x+12,y-5]],'#b2ccd1');P.poly(g,[[x-21,y-36],[x-5,y-47],[x+16,y-20],[x+11,y+5],[x-17,y+5]],'#3e5b6b');P.line(g,x-29,y-28,x-20,y-38,'#e0e9d9',3);}
  });
}
class WolfRig{
  constructor(id){this.id=id;this.phase=0;this.clock=0;this.bite=0;}
  update(dt,body,reduced){this.bite=Math.max(0,this.bite-dt);this.phase+=dt*Math.hypot(body.vx||0,body.vy||0)*.12;if(!reduced)this.clock+=dt;}
  draw(g,x,y,body,behavior){
    const phase=this.bite>0?'bite':behavior?.phase||body.phase||'assess',flip=Math.cos(body.facing||0)<0?-1:1,running=['charge','intercept','pursue','chase','bite'].includes(phase),hesitant=['hesitate','hesitant','flee','fled'].includes(phase)||behavior?.role==='hesitant'&&!running,dead=body.hp<=0||phase==='dead',q=(a,b)=>[x+a*flip,y+b],dark=this.id.includes('left')||this.id==='pack-flanker';
    const fur=dark?'#6e858b':this.id==='pack-hesitant'?'#b4bab0':'#8c9b98',light=dark?'#9caeac':'#cbd0bb',legs=dark?'#536d76':'#6f8589';
    if(dead){P.ell(g,x,y-5,23,9,fur);P.line(g,...q(16,-5),...q(29,-2),light,5);P.line(g,...q(-15,0),...q(-27,3),legs,3);P.line(g,...q(7,0),...q(19,4),legs,3);return;}
    const crouch=['stalk','circle','flank','assess','testing'].includes(phase)?3:0,bob=running?Math.sin(this.phase*2)*2:0;
    for(let i=0;i<4;i++){const base=i<2?-12:13,stride=Math.sin(this.phase+i*Math.PI*.85)*(running?10:4);P.line(g,...q(base,-14+crouch+bob),...q(base+stride*.5,-6),i%2?legs:light,3);P.line(g,...q(base+stride*.5,-6),...q(base+stride,0),legs,3);}
    P.ell(g,...q(-1,-17+crouch+bob),22,9,fur);P.poly(g,[q(10,-15+crouch),q(16,-28+crouch),q(25,-30+crouch),q(30,-19+crouch)],fur);
    P.poly(g,[q(19,-26+crouch),q(28,-24+crouch),q(35,-18+crouch),q(28,-13+crouch),q(18,-17+crouch)],light);
    const ear=hesitant?5:0;P.poly(g,[q(18,-27+crouch),q(17-ear,-37+crouch),q(24,-29+crouch)],legs);P.poly(g,[q(25,-27+crouch),q(29-ear,-34+crouch),q(30,-25+crouch)],fur);
    P.dot(g,...q(28,-23+crouch),'#354e50');P.disc(g,...q(35,-18+crouch),2,'#2e4850');
    const tail=hesitant?3:Math.sin(this.clock*2)*4;P.line(g,...q(-20,-20+crouch),...q(-31,-16+tail+crouch),fur,6);P.line(g,...q(-31,-16+tail+crouch),...q(-38,-11+tail),light,3);
    if(phase==='bite'||phase==='charge'){const open=phase==='bite'?2+Math.sin(this.bite*25)*2:0;P.line(g,...q(27,-15+crouch),...q(36,-13+crouch+open),'#465655',2);P.line(g,...q(30,-15+crouch),...q(31,-12+crouch+open),'#e5e6ca',1);}
    if(behavior?.wounded||body.hp<70)P.line(g,...q(-6,-22+crouch),...q(1,-19+crouch),'#9c685f',2);
  }
}

export function createNorthCuttingRenderer(game){
  const terrain=makeTerrain(),trees=scenery(),actors=createExpeditionActors(E,game),wolves=new Map();let clock=0,stateRef=null,generation=null,seq=0;
  function update(dt,state){const stream=getCampaignPresentation(state);if(stateRef!==state||generation!==stream.generation){stateRef=state;generation=stream.generation;seq=0;for(const wolf of wolves.values())wolf.bite=0;}if(!game.reduceMotion)clock+=dt;actors.update(dt,state);for(const wolf of rows(state.enemies).filter(a=>a.kind==='wolf')){if(!wolves.has(wolf.id))wolves.set(wolf.id,new WolfRig(wolf.id));wolves.get(wolf.id).update(dt,wolf,game.reduceMotion);}for(const event of stream.events){if(event.seq<=seq)continue;seq=event.seq;if(event.kind==='wolf-bite'&&wolves.has(event.actorId))wolves.get(event.actorId).bite=.32;}}
  function draw(r,state){
    const horizon=sky(r),g=r.ctx;g.save();g.beginPath();g.rect(0,horizon,r.bw,r.bh-horizon);g.clip();P.rect(g,0,horizon,r.bw,r.bh-horizon,C.snow);g.transform(r.view.ax,r.view.bx,r.view.ay,r.view.by,-r.ix,-r.iy);g.drawImage(terrain,0,0);g.restore();
    platforms(r,state);architecture(r,state);
    for(const track of rows(state.tracks?.scentTrail)){if(!r.visible(track.x,track.y,track.z||0,20,20,10))continue;const q=r.w(track.x,track.y,track.z||0);P.ell(g,q[0]-3,q[1],2,3,'#849a96');P.ell(g,q[0]+4,q[1]+2,2,3,'#849a96');}
    for(const treeProp of trees)if(r.w(treeProp.x,treeProp.y,0)[1]>horizon)tree(r,treeProp,state,clock,game.reduceMotion);
    for(const p of WORLD.props)drawProp(r,p,state,clock);
    for(const wolf of rows(state.enemies)){if(wolf.kind!=='wolf'||wolf.hidden)continue;const behavior=rows(state.predators).find(w=>w.id===wolf.id);if(['dormant','fled'].includes(behavior?.phase))continue;if(!r.visible(wolf.x,wolf.y,wolf.z||0,80,75,50))continue;
      r.shadow(wolf.x,wolf.y,14,.19,'#587781',wolf.z||0);r.actor(wolf.x,wolf.y,wolf.z||0,(ctx,x,y)=>(wolves.get(wolf.id)||new WolfRig(wolf.id)).draw(ctx,x,y,wolf,behavior),{outline:false,margin:90});}
    actors.draw(r,state);
    for(const bullet of state.bullets||[]){const at=r.w(bullet.x,bullet.y,bullet.z||25),tail=r.w(bullet.x-bullet.vx*.016,bullet.y-bullet.vy*.016,bullet.z||25);r.queue(bullet.x,bullet.y,bullet.z||25,ctx=>P.line(ctx,...at,...tail,'#e6d4a4',2));}
    r.overlay(ctx=>{
      const target=state.interactionTarget||state.nearby;if(target&&Number.isFinite(target.x)){const at=r.w(target.x,target.y,(target.z||0)+48);if(at[0]>0&&at[0]<r.bw&&at[1]>0&&at[1]<r.bh){P.poly(ctx,[[at[0],at[1]-6],[at[0]+5,at[1]],[at[0],at[1]+6],[at[0]-5,at[1]]],'#e2d0a3');P.disc(ctx,...at,2,'#55746f');}}
      if(!game.reduceMotion)for(let i=0;i<Math.min(85,Math.ceil(r.bw*r.bh/7000));i++){const x=(hash(i+251)*r.bw+clock*(19+hash(i+493)*14))%(r.bw+20)-10,y=(hash(i+469)*r.bh+clock*(13+hash(i+357)*13))%(r.bh+20)-10;P.blend(ctx,.3+hash(i+124)*.35,'normal',()=>P.line(ctx,x,y,x-3,y+2,'#e4ead8',1));}
      if(state.aiming&&state.pointer){const{x,y}=state.pointer;for(const d of [-1,1]){P.line(ctx,x+d*5,y,x+d*10,y,'#ede4bf',1);P.line(ctx,x,y+d*5,x,y+d*10,'#ede4bf',1);}P.dot(ctx,x,y,'#ac7863');}
    });
  }
  return{update,draw,inspectAnimation:()=>actors.inspect()};
}
