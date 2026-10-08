import { WORLD, riverX } from './simulation.js';

const E = globalThis.My3D2dge;
const P = E.px;

const PALETTE = {
  earth: '#847c45', grass: '#8c8c50', grassLight: '#a3a369', grassDark: '#626c3f',
  ochre: '#c0a572', sand: '#c3ad80', mud: '#847456', water: '#568582',
  waterLight: '#83a29a', bark: '#594a36', wood: '#7f6146', plank: '#a1845d',
  shadow: '#394032', ivory: '#e3d5ab', gold: '#d8b871', ink: '#2a2b24',
};
const WORLD_W = WORLD.width, WORLD_H = WORLD.height;
const TAU = Math.PI * 2;
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) { return hash(x * 31.7 + y * 61.3); }
const creekX = riverX;
function groundPoly(r, g, points, color, alpha = 1) {
  const q = points.map(p => r.w(p[0], p[1], p[2] || 0));
  if (alpha < 1) P.polyDither(g, q, color, alpha); else P.poly(g, q, color);
}

const BUILDINGS = [
  { x: 910, y: 570, w: 110, h: 65, z: 91, color: '#876952', name: 'THE LANTERN', type: 'saloon' },
  { x: 1030, y: 360, w: 110, h: 55, z: 75, color: '#777764', name: 'SHERIFF', type: 'sheriff' },
  { x: 900, y: 385, w: 100, h: 60, z: 73, color: '#937450', name: 'GENERAL STORE', type: 'store' },
  { x: 1070, y: 570, w: 90, h: 65, z: 75, color: '#7a5140', name: 'LIVERY & ARMS', type: 'livery' },
  { x: 1180, y: 935, w: 100, h: 55, z: 52, color: '#99896b', name: 'CINDER DEPOT', type: 'depot' },
  { x: 1340, y: 690, w: 115, h: 78, z: 75, color: '#885748', name: 'BELL RANCH', type: 'ranch' },
];

function makeGround() {
  // Store the valley in world coordinates. Projecting this single cached
  // surface at draw time also keeps it aligned after a camera scale change.
  const sx = 1, sy = 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(WORLD_W * sx + 4); canvas.height = Math.ceil(WORLD_H * sy + 4);
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  const q = (x, y) => [x * sx, y * sy];
  P.rect(g, 0, 0, canvas.width, canvas.height, PALETTE.grass);
  // A fixed seed gives the valley its own geography, independent of frame rate.
  for (let y = 0; y < WORLD_H; y += 12) for (let x = 0; x < WORLD_W; x += 12) {
    const n = noise(Math.floor(x / 90), Math.floor(y / 75));
    const band = Math.sin(x / 170 + y / 130) * .5 + Math.sin(y / 92) * .15;
    const colors = band > .15 ? ['#969258', '#999561', '#9b965f'] : ['#858749', '#888b4e', '#8e8d53'];
    P.rect(g, x * sx, y * sy, 13 * sx, 13 * sy, colors[Math.floor(n * 3)]);
  }
  // Broad, sunlit grassy clearings and weathered sandstone shelves.
  for (let i = 0; i < 85; i++) {
    const x = hash(i + 4) * WORLD_W, y = hash(i + 97) * WORLD_H;
    const rx = 30 + hash(i + 723) * 100, ry = 15 + hash(i + 615) * 70;
    P.ell(g, x * sx, y * sy, rx * sx, ry * sy, ['#a49c66', '#97945a', '#8d8952', '#9e9760'][i % 4]);
  }
  const trail = (points, width = 31) => {
    for (let i = 1; i < points.length; i++) {
      const a = q(...points[i - 1]), b = q(...points[i]);
      P.line(g, ...a, ...b, '#a3956a', width * sx + 10);
      P.line(g, ...a, ...b, '#b4a277', width * sx);
      P.line(g, ...a, ...b, '#bdab81', width * sx - 10);
      P.line(g, a[0] - 9, a[1], b[0] - 9, b[1], '#9f8c65', 2);
      P.line(g, a[0] + 9, a[1], b[0] + 9, b[1], '#9f8c65', 2);
    }
  };
  trail([[280,1200],[420,1060],[555,930],[655,800],[730,685],[840,610],[995,500],[1070,365],[1100,120]], 28);
  trail([[985,505],[1135,525],[1255,560],[1375,700],[1500,735],[1600,800]], 29);
  trail([[760,675],[940,760],[1040,880],[1160,930],[1450,960],[1600,980]], 25);
  trail([[720,690],[570,685],[440,650],[320,620],[180,600],[0,655]], 18);
  // Settlement clearings, fenced ranch soil, campsite, and the river's gravel bars.
  P.ell(g, 680 * sx, 730 * sy, 112 * sx, 84 * sy, '#a19a6c');
  P.ell(g, 680 * sx, 730 * sy, 73 * sx, 53 * sy, '#b0a279');
  P.rect(g, 830 * sx, 330 * sy, 390 * sx, 300 * sy, '#ad9870');
  trail([[1010,280],[1010,660]], 64);
  trail([[820,510],[1280,510]], 44);
  P.ell(g, 1395 * sx, 735 * sy, 142 * sx, 98 * sy, '#a29165');
  const banksL = [], banksR = [], waterL = [], waterR = [];
  for (let y = 0; y <= WORLD_H; y += 12) {
    const cx = creekX(y), width = WORLD.river.width / 2;
    banksL.push(q(cx - width - 13, y)); banksR.push(q(cx + width + 13, y));
    waterL.push(q(cx - width, y)); waterR.push(q(cx + width, y));
  }
  P.poly(g, [...banksL, ...banksR.reverse()], '#b6af82');
  P.poly(g, [...waterL, ...waterR.reverse()], '#517c77');
  for (let i = 0; i < 470; i++) {
    const y = hash(i + 61) * WORLD_H, x = creekX(y) + (hash(i + 377) - .5) * 34;
    const a = q(x,y); P.line(g, a[0],a[1],a[0] + 3 + hash(i + 8) * 16,a[1], i % 3 ? '#65938a' : '#94afa0', 1);
  }
  // The wagon crossing is wide enough for a horse; the wood bears old wheel ruts.
  const bridgeX=creekX(605)-59;
  P.rect(g, bridgeX * sx, 588 * sy, 118 * sx, 34 * sy, '#6e5c44');
  for (let x = bridgeX + 3; x < bridgeX + 117; x += 7) {
    P.rect(g,x * sx,589 * sy,6 * sx,32 * sy, x % 3 ? '#a48a5d' : '#947c55');
    P.line(g,x * sx,591 * sy,x * sx,619 * sy,'#5e523e',1);
  }
  // Railroad sleepers form a readable landmark across the southern flood plain.
  for (let x = 935; x < WORLD_W; x += 14) {
    P.line(g, ...q(x,932), ...q(x,966), '#5a4d3c', 5);
    P.dot(g,x * sx,940 * sy,'#a4a198'); P.dot(g,x * sx,958 * sy,'#a4a198');
  }
  P.line(g,...q(935,940),...q(WORLD_W,940),'#413e36',4);
  P.line(g,...q(935,940),...q(WORLD_W,940),'#a9a18a',1);
  P.line(g,...q(935,958),...q(WORLD_W,958),'#413e36',4);
  P.line(g,...q(935,958),...q(WORLD_W,958),'#a9a18a',1);
  // Thousands of tiny, fixed marks make soil and grass read as actual surfaces.
  for (let i = 0; i < 23000; i++) {
    const x = hash(i + 71) * WORLD_W, y = hash(i + 892) * WORLD_H;
    if (Math.abs(x - creekX(y)) < 32) continue;
    const town = x > 825 && x < 1225 && y > 320 && y < 650;
    const a = q(x,y), green = town ? '#8f805d' : i % 4 ? '#747846' : '#b2ab70';
    P.line(g,a[0],a[1],a[0] + (hash(i + 75)-.5)*5,a[1] - 1 - hash(i + 141)*4,green,1);
    if (i % 13 === 0 && !town) P.dot(g,a[0] + 2,a[1] - 4,'#c7b577');
  }
  return canvas;
}

function generateScenery() {
  const props = [];
  const clear = (x,y) => Math.hypot(x - 700,y - 750) < 210 || (x > 815 && x < 1330 && y > 310 && y < 660) || Math.abs(x - creekX(y)) < 38 || (y > 900 && y < 988 && x > 900);
  for (let i = 0; i < 260; i++) {
    const x = 30 + hash(i + 876) * 1530, y = 40 + hash(i + 562) * 1100;
    if (clear(x,y)) continue;
    // Trees bunch into a cool western forest and frame the open camp valley.
    const forest = x < 290 || y < 240 || x > 1440;
    if (!forest && hash(i + 615) < .56) continue;
    props.push({kind: forest && hash(i + 942) < .7 ? 'pine' : 'tree',x,y,size:.65 + hash(i + 442)*.75,seed:i});
  }
  // Intentional framing trees avoid the player's opening silhouette.
  props.push({kind:'tree',x:503,y:820,size:1.27,seed:920},{kind:'pine',x:848,y:805,size:1.18,seed:921},
    {kind:'tree',x:485,y:534,size:1.04,seed:922},{kind:'pine',x:837,y:445,size:1.3,seed:923});
  for (let i = 0; i < 110; i++) {
    const x = 30 + hash(i + 179)*1540, y = 30 + hash(i + 654)*1140;
    if (clear(x,y)) continue;
    props.push({kind:'rock',x,y,size: .5 + hash(i + 87)*1.15,seed:i + 500});
  }
  for (let i = 0; i < 95; i++) {
    const x = creekX(i * 12) + 33 + hash(i + 122)*15, y = i * 12 + 3;
    props.push({kind:'reeds',x,y,size:.6 + hash(i + 944)*.5,seed:i + 1000});
  }
  for (let i = 0; i < 18; i++) props.push({kind:'rock',x:105 + i * 30,y:260 + Math.sin(i*.8)*22,size:1.5 + hash(i + 572)*1.4,seed:400 + i});
  return props;
}

function drawDistant(r, time, hour, wind, weather) {
  const g = r.ctx, w = r.bw, horizon = Math.round(Math.min(112, r.H * .18));
  const night = hour < 6 || hour > 20, sunset = hour >= 17.5 && hour <= 20;
  const sky = night ? ['#253238','#555950','#98916f'] : weather !== 'clear' ? ['#777f79','#a0a491','#c1baa0'] : sunset ? ['#909888','#c6af88','#e4c596'] : ['#aaa797','#c8baa0','#dccba5'];
  r.sky(sky, {bands:32});
  const sunY = horizon * (sunset ? .66 : .35), radius = Math.min(22, horizon * .18);
  if (weather === 'clear') {
    P.disc(g,w * .79,sunY,night ? radius * .62 : radius,night ? '#e1dbc4' : '#ead8af');
    if (!night) P.disc(g,w * .79,sunY,radius * .7,'#f2e0b7');
  }
  if (night) for (let i = 0; i < Math.ceil(w / 18); i++) P.dot(g,hash(i + 718) * w,hash(i + 983) * horizon * .7,i % 4 ? '#a7b5b0' : '#d2cfb1');
  const drift = (gameCam(r).x || 0) * .032;
  for (let layer = 0; layer < 3; layer++) {
    const pts = [[-30,horizon]];
    for (let x = -30; x <= w + 30; x += 24) {
      const t = x + drift * (layer + 1);
      const y = horizon * (.61 + layer * .12) - Math.sin(t / (101 - layer*15))*horizon*.1 - Math.sin(t / (47 + layer*23) + layer)*horizon*.1;
      pts.push([x,y]);
    }
    pts.push([w+30,horizon]);
    P.poly(g,pts,(night ? ['#586861','#46584c','#3a4c3f'] : ['#8a9386','#737d6b','#626d55'])[layer]);
  }
  // Far timber line: its fine silhouette sells depth before the nearby trees.
  for (let i = 0; i < Math.ceil(w / 15) + 1; i++) {
    const x = i * 15 - ((drift * 2.3) % 15), h = horizon * (.035 + hash(i + 281)*.075);
    P.poly(g,[[x,horizon],[x+4,horizon-h],[x+8,horizon]],night ? '#34463a' : '#60694e');
  }
  // Narrow atmospheric haze joins the textured ground to the distant valley.
  P.polyDither(g,[[0,horizon-7],[w,horizon-7],[w,horizon],[0,horizon]],night ? '#71847b' : '#b6b391',.32);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 237 + time * (6 + i)) % (w + 140)) - 70;
    const y = horizon * (.25 + i * .11) + Math.sin(time*.3 + i)*2;
    P.line(g,x-4,y+2,x,y,'#545a50',1); P.line(g,x,y,x+5,y+2,'#545a50',1);
  }
  // Pale streaks are high cirrus, drawn as pixels instead of canvas gradients.
  for (let i = 0; i < 6; i++) {
    const x = ((i*191 + 65 + wind*2) % (w+160))-80;
    const y = horizon * (.16 + i % 3 * .16);
    if (!night) {
      P.line(g,x,y,x+52,y-2,'#d9cdb3',1);
      P.line(g,x+18,y+1,x+71,y+1,'#d0c5ae',1);
    }
  }
  return horizon;
}
function gameCam(r) { return r.game.cam; }

function longShadow(r,x,y,length,width) {
  r.decal(g => groundPoly(r,g,[[x-width,y],[x+width,y],[x+length*.6+width,y+length*.55],[x+length*.6-width,y+length*.55]],'#4a4d34',.22));
}

function drawTree(r, p, time, focus) {
  const {x,y,size:s,seed} = p, pine = p.kind === 'pine';
  longShadow(r,x,y,75*s,7*s);
  r.queue(x,y,0,g => {
    const [ox,oy] = r.w(x,y,0), sway = Math.sin(time*.65 + seed)*1.4*s, h = (pine?126:105)*s;
    const target=focus?r.w(focus.x,focus.y,0):null;
    const fades=target&&oy>target[1]&&oy-h<target[1]&&Math.abs(ox-target[0])<48*s;
    if(fades){g.save();g.globalAlpha*=.32;}
    P.poly(g,[[ox-5*s,oy],[ox+5*s,oy],[ox+3*s,oy-h*.66],[ox-2*s,oy-h*.69]],'#514c37');
    P.line(g,ox-2*s,oy-3,ox-1*s,oy-h*.66,'#9b8357',2*s);
    P.line(g,ox,oy-h*.4,ox-20*s,oy-h*.61,'#5b533b',3*s);
    P.line(g,ox+1,oy-h*.52,ox+18*s,oy-h*.72,'#5b533b',3*s);
    if (pine) {
      for (let l = 0; l < 6; l++) {
        const top = oy-h+l*h*.108, bottom = top+h*.29, radius = (10+l*5.6)*s;
        const pts = [[ox+sway,top],[ox+radius*.7+sway,bottom-8*s],[ox+radius+sway,bottom],
          [ox+radius*.35+sway,bottom-3*s],[ox+radius*.1+sway,bottom+4*s],[ox-radius*.35+sway,bottom],
          [ox-radius+sway,bottom+1*s],[ox-radius*.57+sway,bottom-9*s]];
        P.poly(g,pts,l%2?'#4c6140':'#566a43');
        P.poly(g,[[ox+sway,top],[ox+radius*.15+sway,bottom-3*s],[ox-radius*.74+sway,bottom-1*s],[ox-radius*.52+sway,bottom-9*s]],l%2?'#7a8250':'#727e4a');
        P.line(g,ox-radius*.52, bottom-6*s,ox-2*s,bottom-14*s,'#90905a',1);
      }
    } else {
      for (let j = 0; j < 19; j++) {
        const a = hash(seed*19 + j)*TAU, d = Math.sqrt(hash(seed*11+j+9)), rx = 11+hash(j+seed+29)*13;
        const cx = ox+Math.cos(a)*37*s*d+sway, cy = oy-h*.78+Math.sin(a)*24*s*d;
        P.ell(g,cx,cy,rx*s,(rx*.77)*s,['#55613d','#627044','#74804a','#829053'][j%4]);
        if (j%3===0) P.ell(g,cx-4*s,cy-4*s,rx*.65*s,rx*.4*s,'#949860');
        if (j%4===0) P.line(g,cx-8*s,cy-4*s,cx-2*s,cy-6*s,'#b1ad76',1);
      }
    }
    P.line(g,ox-8*s,oy+2*s,ox+6*s,oy+1*s,'#7f7950',2);
    if(fades){g.restore();g._c=null;}
  });
}

function drawRock(r,p) {
  const s=p.size, {x,y}=p;
  r.shadow(x,y,12*s,.25,'#454a33');
  r.queue(x,y,0,g=>{
    const [ox,oy]=r.w(x,y,0);
    P.poly(g,[[ox-19*s,oy-3*s],[ox-15*s,oy-18*s],[ox+1*s,oy-29*s],[ox+16*s,oy-17*s],[ox+22*s,oy-1*s],[ox+8*s,oy+5*s]],'#787761');
    P.poly(g,[[ox-19*s,oy-3*s],[ox-15*s,oy-18*s],[ox+1*s,oy-29*s],[ox+5*s,oy-15*s],[ox-1*s,oy-2*s]],'#a29a79');
    P.poly(g,[[ox+5*s,oy-15*s],[ox+16*s,oy-17*s],[ox+22*s,oy-1*s],[ox+8*s,oy+5*s],[ox-1*s,oy-2*s]],'#606656');
    P.line(g,ox-13*s,oy-17*s,ox-3*s,oy-22*s,'#c0b18a',1);
    P.line(g,ox+5*s,oy-15*s,ox+9*s,oy-4*s,'#474f43',1);
  });
}
function drawReeds(r,p,time) {
  r.queue(p.x,p.y,0,g=>{
    const [ox,oy]=r.w(p.x,p.y,0);
    for(let i=0;i<6;i++) {
      const h=(9+hash(p.seed+i)*15)*p.size, dx=(i-3)*2;
      const bend=Math.sin(time*1.1+p.seed+i)*2;
      P.line(g,ox+dx,oy,ox+dx+bend,oy-h,'#677247',1);
      if(i%2) P.line(g,ox+dx+bend,oy-h,ox+dx+bend,oy-h+5,'#6c5936',2);
    }
  });
}

function drawBuilding(r,b,focus) {
  if (!r.visible(b.x+b.w/2,b.y+b.h,0,b.w*2,200,130)) return;
  longShadow(r,b.x+b.w*.5,b.y+b.h,b.z*.8,b.w*.45);
  r.queue(b.x+b.w/2,b.y+b.h,0,g=>{
    const face=b.y+b.h;
    const target=focus?r.w(focus.x,focus.y,0):null,left=r.w(b.x,face,0),right=r.w(b.x+b.w,face,0);
    const fades=target&&focus.y<face&&target[0]>Math.min(left[0],right[0])-12&&target[0]<Math.max(left[0],right[0])+12&&target[1]>left[1]+r.view.bz*(b.z+20)-65;
    if(fades){g.save();g.globalAlpha*=.42;}
    r.box(g,b.x,b.y,0,b.x+b.w,face,b.z,'#5d5948',b.color);
    // Sun-facing false front and the old timber's horizontal grain.
    groundPoly(r,g,[[b.x,face,b.z],[b.x+b.w,face,b.z],[b.x+b.w,face,b.z+13],[b.x,face,b.z+13]],E.shade(b.color,.08));
    for(let z=5;z<b.z+13;z+=7) {
      const a=r.w(b.x,face,z),c=r.w(b.x+b.w,face,z); P.line(g,...a,...c,E.shade(b.color,-.17),1);
    }
    const plinth=r.w(b.x,face,b.z+14), end=r.w(b.x+b.w,face,b.z+14);
    P.line(g,...plinth,...end,'#c4aa7d',4);
    P.line(g,...r.w(b.x,face,4),...r.w(b.x+b.w,face,4),'#554535',3);
    // Porch overhang, steps and posts are real projected geometry.
    r.box(g,b.x-5,face,0,b.x+b.w+5,face+18,4,'#a48a61','#79684b');
    r.box(g,b.x-3,face+18,0,b.x+b.w+3,face+23,2,'#a48a61','#79684b');
    r.box(g,b.x-6,face-3,42,b.x+b.w+6,face+21,45,'#857352','#61543f');
    for(const dx of [3,b.w*.48,b.w-3]) {
      const a=r.w(b.x+dx,face+16,4),c=r.w(b.x+dx,face+16,44);
      P.line(g,...a,...c,'#473e30',5); P.line(g,a[0]-1,a[1],c[0]-1,c[1],'#b79c6a',2);
    }
    const window=(x,z,w=15,h=24)=>{
      groundPoly(r,g,[[x,face+.2,z],[x+w,face+.2,z],[x+w,face+.2,z+h],[x,face+.2,z+h]],'#cfb381');
      groundPoly(r,g,[[x+2,face+.3,z+2],[x+w-2,face+.3,z+2],[x+w-2,face+.3,z+h-2],[x+2,face+.3,z+h-2]],'#353e34');
      P.line(g,...r.w(x+w*.5,face+.4,z+2),...r.w(x+w*.5,face+.4,z+h-2),'#ae956b',2);
      P.line(g,...r.w(x+1,face+.4,z+h*.55),...r.w(x+w-1,face+.4,z+h*.55),'#ae956b',2);
      const a=r.w(x+3,face+.5,z+4);P.rect(g,a[0],a[1]-8,4,7,'#7f8461');
    };
    window(b.x+11,10);window(b.x+b.w-27,10);
    if(b.z>82) {window(b.x+13,57,18,20);window(b.x+b.w-31,57,18,20);}
    groundPoly(r,g,[[b.x+b.w*.43,face+.4,4],[b.x+b.w*.59,face+.4,4],[b.x+b.w*.59,face+.4,32],[b.x+b.w*.43,face+.4,32]],'#3f392d');
    const signZ=b.z>82?49:54, sign=r.w(b.x+b.w/2,face+.8,signZ);
    P.rect(g,sign[0]-b.w*.68,sign[1]-11,b.w*1.36,19,'#ded0a3');
    P.rect(g,sign[0]-b.w*.68+2,sign[1]-9,b.w*1.36-4,15,'#3d4234');
    E.font.text(g,b.name,sign[0],sign[1]-5,'#dbc493',{align:'center',outline:false,scale:1});
    // Small roof chimney, rain barrel and a hanging brass lantern.
    r.box(g,b.x+b.w-19,b.y+16,b.z,b.x+b.w-8,b.y+27,b.z+24,'#787367','#68604e');
    const la=r.w(b.x+8,face+16,33);P.line(g,la[0],la[1]-10,la[0],la[1]-2,'#413b2c',1);P.rect(g,la[0]-3,la[1]-2,6,7,'#e3bf72');
    const barrel=r.w(b.x+b.w+10,face+9,0);drawBarrelPixels(g,barrel[0],barrel[1],.8);
    if(fades){g.restore();g._c=null;}
  });
}
function drawBarrelPixels(g,x,y,s=1) {
  P.ell(g,x,y-10*s,8*s,12*s,'#66503a');P.rect(g,x-7*s,y-19*s,14*s,18*s,'#8b6e45');
  P.ell(g,x,y-19*s,7*s,3*s,'#b09462');P.line(g,x-7*s,y-15*s,x+7*s,y-15*s,'#383c33',2*s);
  P.line(g,x-7*s,y-5*s,x+7*s,y-5*s,'#383c33',2*s);P.line(g,x-3*s,y-16*s,x-3*s,y-6*s,'#ac8a52',1);
}
function drawTent(r,x,y,color,s=1) {
  longShadow(r,x,y,45*s,23*s);
  r.queue(x,y+17*s,0,g=>{
    const width=40*s, depth=38*s,h=39*s;
    groundPoly(r,g,[[x-width,y+depth,0],[x,y+depth,h],[x+width,y+depth,0]],color);
    groundPoly(r,g,[[x-width,y+depth,0],[x,y+depth,h],[x,y-depth,h],[x-width,y-depth,0]],E.shade(color,.17));
    groundPoly(r,g,[[x+width,y+depth,0],[x,y+depth,h],[x,y-depth,h],[x+width,y-depth,0]],E.shade(color,-.15));
    groundPoly(r,g,[[x-17*s,y+depth+.3,1],[x,y+depth+.3,h-6*s],[x+17*s,y+depth+.3,1]],'#454835');
    P.line(g,...r.w(x,y+depth,h+3),...r.w(x,y+depth,0),'#786045',3*s);
    P.line(g,...r.w(x,y-depth,h+3),...r.w(x,y+depth,h+3),'#635037',2*s);
    for(const d of [-1,1]) P.line(g,...r.w(x+d*width,y+depth,4),...r.w(x+d*(width+17*s),y+depth+12*s,0),'#d0ba8a',1);
    const q=r.w(x-26*s,y+depth+1,6);P.line(g,q[0],q[1],q[0]+16*s,q[1]-26*s,E.shade(color,.33),1);
  });
}
function drawWagon(r,x,y,time) {
  longShadow(r,x,y,55,28);
  r.queue(x,y+16,0,g=>{
    r.box(g,x-34,y-19,16,x+34,y+19,32,'#977852','#644d38');
    const [ox,oy]=r.w(x,y,0);
    for(const dx of [-30,30]) {
      P.disc(g,ox+dx*1.5,oy-4,17,'#403e30');P.disc(g,ox+dx*1.5,oy-4,13,'#b59a64');P.disc(g,ox+dx*1.5,oy-4,10,'#68583b');
      for(let j=0;j<6;j++){const a=j*Math.PI/3;P.line(g,ox+dx*1.5,oy-4,ox+dx*1.5+Math.cos(a)*12,oy-4+Math.sin(a)*12,'#b59a64',2);}
      P.disc(g,ox+dx*1.5,oy-4,3,'#3e3e30');
    }
    const top=r.w(x,y,73),front=r.w(x,y+19,32);
    P.poly(g,[[front[0]-46,front[1]],[top[0]-38,top[1]+9],[top[0]-28,top[1]-2],[top[0]+28,top[1]-2],[top[0]+38,top[1]+9],[front[0]+46,front[1]]],'#d0c6a0');
    P.poly(g,[[front[0]-35,front[1]],[top[0]-25,top[1]+8],[top[0]+25,top[1]+8],[front[0]+35,front[1]]],'#5a5842');
    P.line(g,top[0]-28,top[1],top[0]-37,top[1]+19,'#e7d9b0',3);P.line(g,top[0]+28,top[1],top[0]+37,top[1]+19,'#a99c77',3);
    P.line(g,...r.w(x+34,y-10,19),...r.w(x+83,y-8,8),'#71593c',3);
    drawBarrelPixels(g,ox-60,oy-5,.9);
  });
}
function drawCamp(r,time,camp) {
  drawTent(r,640,767,'#bcaf86',.7);drawTent(r,765,779,'#918b62',.67);drawTent(r,617,650,'#baa97d',.74);
  drawWagon(r,802,621,time);
  r.queue(734,757,0,g=>{
    r.box(g,711,745,0,739,760,14,'#ac9268','#765e41');
    P.line(g,...r.w(715,745,15),...r.w(734,760,15),'#e1d0a1',2);
    drawBarrelPixels(g,...r.w(751,764,0),1);
  });
  r.queue(690,785,0,g=>{
    const [ox,oy]=r.w(690,785,0);
    P.ell(g,ox,oy,22,11,'#8b8057');
    for(let i=0;i<10;i++){const a=i*TAU/10;P.ell(g,ox+Math.cos(a)*20,oy+Math.sin(a)*9,4,3,i%2?'#9d9472':'#696c56');}
    P.line(g,ox-12,oy+1,ox+12,oy-3,'#534b34',4);P.line(g,ox-12,oy-4,ox+9,oy+4,'#7b603b',4);
    for(let i=0;i<7;i++) {
      const h=11+Math.sin(time*8+i*1.8)*7,dx=(i-3)*3;
      P.poly(g,[[ox+dx-4,oy-2],[ox+dx+Math.sin(time*5+i)*3,oy-h-8],[ox+dx+4,oy-2]],i%2?'#e0ac53':'#c5763e');
      P.poly(g,[[ox+dx-2,oy-2],[ox+dx+1,oy-h*.65],[ox+dx+2,oy-2]],'#efcf7a');
    }
    for(let i=0;i<3;i++){const t=(time*.3+i*.31)%1;P.blend(g,(1-t)*.48,'normal',()=>P.ell(g,ox+Math.sin(t*5+i)*10,oy-28-t*57,7+t*9,5+t*5,'#929181'));}
    P.line(g,ox-24,oy,ox-13,oy-36,'#494938',2);P.line(g,ox+24,oy,ox+13,oy-36,'#494938',2);P.line(g,ox-13,oy-36,ox+13,oy-36,'#494938',2);
    P.line(g,ox,oy-36,ox,oy-23,'#413f30',1);P.ell(g,ox,oy-19,6,4,'#363b33');
  });
  r.decal(g=>{
    const [x,y]=r.w(690,785,0);P.ddisc(g,x,y,37,'#e7bc68',.12);
    groundPoly(r,g,[[648,750],[658,766],[663,762],[653,746]],'#5b573b');
    groundPoly(r,g,[[699,701],[729,713],[727,719],[697,707]],'#64583a');
  });
  // An old camp standard flutters without obscuring the cast.
  r.queue(739,692,0,g=>{
    const [ox,oy]=r.w(739,692,0);P.line(g,ox,oy,ox,oy-96,'#7c6a49',3);
    const w=Math.sin(time*2)*3;
    P.poly(g,[[ox+2,oy-93],[ox+32,oy-90+w],[ox+28,oy-73+w],[ox+2,oy-76]],'#a2523e');
    P.line(g,ox+3,oy-84,ox+27,oy-81+w,'#d8c19b',2);P.disc(g,ox,oy-98,3,'#d2b06c');
  });
  // A hitching post and split-rail enclosure make Juniper's resting place clear.
  drawFence(r,[[752,690],[795,699],[837,718]],25);
  if(camp?.upgrades?.shelter)r.queue(775,740,0,g=>{
    for(const x of [742,812])for(const y of [690,740])P.line(g,...r.w(x,y,0),...r.w(x,y,58),'#6d5a3e',4);
    groundPoly(r,g,[[736,686,56],[777,686,69],[777,744,69],[736,744,56]],'#b2a47b');
    groundPoly(r,g,[[777,686,69],[818,686,56],[818,744,56],[777,744,69]],'#817657');
    for(let y=694;y<740;y+=8)P.line(g,...r.w(736,y,56),...r.w(777,y,69),'#91825c',1);
  });
  if(camp?.upgrades?.infirmary)r.queue(852,690,0,g=>{
    r.box(g,843,682,0,869,696,20,'#c1b285','#807559');
    const q=r.w(856,696,15);P.rect(g,q[0]-6,q[1]-3,12,4,'#9c5f49');P.rect(g,q[0]-2,q[1]-7,4,12,'#9c5f49');
    for(let i=0;i<3;i++){const q=r.w(847+i*6,686,25);P.rect(g,q[0],q[1],3,5,'#6f8770');P.rect(g,q[0],q[1]-2,3,2,'#d6c7a0');}
  });
  if(camp?.upgrades?.cookpot)r.queue(707,790,0,g=>{
    const q=r.w(707,790,22);P.ell(g,q[0],q[1],11,6,'#393f33');P.ell(g,q[0],q[1]-5,11,3,'#7d7b60');
    for(const dx of [-10,10])P.line(g,q[0]+dx,q[1]+1,q[0]+dx*1.4,q[1]+19,'#4a4936',2);
    P.line(g,q[0]-12,q[1]-7,q[0]+12,q[1]-7,'#5b5c46',2);
  });
}
function drawFence(r,points,z=24) {
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i];
    r.queue((a[0]+b[0])/2,Math.max(a[1],b[1]),0,g=>{
      for(const p of [a,b])P.line(g,...r.w(p[0],p[1],0),...r.w(p[0],p[1],z+3),'#776349',4);
      for(const h of [8,z-4])P.line(g,...r.w(a[0],a[1],h),...r.w(b[0],b[1],h),'#b29a68',3);
      P.line(g,...r.w(a[0],a[1],z-5),...r.w(b[0],b[1],z-5),'#d4ba83',1);
    });
  }
}
function drawRailroad(r,time,waterRunning,focus) {
  drawFence(r,[[1128,885],[1163,876],[1194,885]],22);
  r.queue(1150,888,0,g=>{
    const fades=focus&&focus.x>1120&&focus.x<1182&&focus.y<888&&focus.y>750;
    if(fades){g.save();g.globalAlpha*=.35;}
    for(const x of [1132,1168])for(const y of [858,886])P.line(g,...r.w(x,y,0),...r.w(x,y,64),'#68573e',6);
    r.box(g,1127,853,54,1173,891,61,'#877558','#65563e');
    const [ox,oy]=r.w(1150,871,72);P.ell(g,ox,oy,36,12,'#b5a179');P.rect(g,ox-36,oy-29,72,29,'#91805e');
    for(let i=-30;i<35;i+=9)P.line(g,ox+i,oy-26,ox+i,oy-2,'#695d44',1);
    P.ell(g,ox,oy-29,36,12,'#c2ae83');P.line(g,ox-36,oy-24,ox+36,oy-24,'#494d40',3);P.line(g,ox-36,oy-4,ox+36,oy-4,'#494d40',3);
    P.line(g,...r.w(1174,884,56),...r.w(1188,884,56),'#44483d',5);P.line(g,...r.w(1188,884,56),...r.w(1188,884,24),'#44483d',5);
    const q=r.w(1150,892,26);E.font.text(g,'WATER / RAIL',q[0],q[1],'#e0c99a',{outline:'#504c3b',align:'center',scale:1});
    if(fades){g.restore();g._c=null;}
  });
  // An idle freight car sits beside the pump, not across the walkable approach.
  r.queue(1287,960,0,g=>{
    r.box(g,1232,936,14,1350,962,66,'#7b684e','#76513d');
    for(let x=1237;x<1348;x+=9)P.line(g,...r.w(x,962,18),...r.w(x,962,61),'#9b7954',1);
    for(const x of [1250,1332]){const p=r.w(x,962,8);P.disc(g,p[0],p[1],10,'#353a32');P.disc(g,p[0],p[1],4,'#868272');}
    const q=r.w(1290,962,42);E.font.text(g,'B & W',q[0],q[1],'#cdb589',{outline:false,align:'center',scale:2});
  });
  r.queue(1095,857,0,g=>{
    P.line(g,...r.w(1083,857,0),...r.w(1083,857,24),'#545c4b',9);
    P.line(g,...r.w(1083,857,24),...r.w(1102,857,24),'#747e69',8);
    const q=r.w(1095,857,28);P.disc(g,q[0],q[1],12,'#4d5445');P.disc(g,q[0],q[1],9,'#927654');P.disc(g,q[0],q[1],5,'#5c624d');
    for(let i=0;i<4;i++){const a=i*Math.PI/2+(waterRunning?Math.PI/4:0);P.line(g,q[0],q[1],q[0]+Math.cos(a)*10,q[1]+Math.sin(a)*10,'#a78e5e',2);}
    if (!waterRunning) {
      P.line(g,q[0]-11,q[1]-8,q[0]+11,q[1]+7,'#b1b395',2);
      P.rect(g,q[0]-3,q[1]+7,6,8,'#d1ad67');P.line(g,q[0]-2,q[1]+7,q[0]-2,q[1]+4,'#bdb98c',1);P.line(g,q[0]+2,q[1]+7,q[0]+2,q[1]+4,'#bdb98c',1);
    }
  });
  if (waterRunning) {
    r.decal(g=>{
      groundPoly(r,g,[[1178,886],[1199,882],[1210,912],[1184,921]],'#658c80');
      for(let i=0;i<5;i++) {
        const y=889+((time*17+i*7)%30),x=1194+Math.sin(i+time)*6;
        P.line(g,...r.w(x-4,y,0),...r.w(x+4,y,0),'#afc3a9',1);
      }
    });
    r.queue(1188,885,0,g=>{
      for(let i=0;i<4;i++) {
        const z=22-((time*24+i*6)%22);
        P.line(g,...r.w(1188,884,z+4),...r.w(1189,885,z),'#b8ceba',2);
      }
    });
  }
  for(const c of [{x:1085,y:913,w:56,h:24},{x:1210,y:825,w:35,h:38},{x:455,y:975,w:70,h:26}]) {
    r.queue(c.x+c.w/2,c.y+c.h,0,g=>{
      r.box(g,c.x,c.y,0,c.x+c.w,c.y+c.h,24,'#a68d5e','#836b46');
      P.line(g,...r.w(c.x+2,c.y+c.h,3),...r.w(c.x+c.w-2,c.y+c.h,22),'#c3a16b',3);
      P.line(g,...r.w(c.x+2,c.y+c.h,22),...r.w(c.x+c.w-2,c.y+c.h,3),'#c3a16b',3);
    });
  }
}

class HorseRig {
  constructor() { this.phase=0;this.facing=0;this.speed=0;this.time=0; }
  update(dt,s) {this.speed=Math.hypot(s.vx||0,s.vy||0);this.phase+=dt*(this.speed>5?this.speed*.055:0);this.time+=dt;if(this.speed>3)this.facing=Math.atan2(s.vy,s.vx);else if(Number.isFinite(s.facing))this.facing=s.facing;}
  draw(g,x,y,scale=1,down=false) {
    const flip=Math.cos(this.facing)<0?-1:1, s=scale, bob=Math.sin(this.phase*2)*Math.min(2,this.speed/80);
    const q=(a,b)=>[x+a*s*flip,y+b*s+bob];
    if (down) {
      P.ell(g,...q(0,-7),29*s,10*s,'#886345');P.ell(g,...q(33,-6),13*s,5*s,'#a78255');
      for(let i=0;i<4;i++)P.line(g,...q(i<2?-12:13,-6),...q((i<2?-20:22)+(i%2?4:0),2),'#6b5038',3*s);
      P.line(g,...q(-24,-8),...q(-35,-2),'#4b402b',4*s);
      return;
    }
    // Four separately posed legs, hooves, lifted neck, ears, mane and reins.
    for(let i=0;i<4;i++){
      const base=i<2?-14:13, lift=Math.sin(this.phase+i*Math.PI*.93)*(this.speed>5?7:0), side=i%2?3:-3;
      const a=q(base+side,-24),b=q(base+side+lift*.55,-12-Math.max(0,lift)),c=q(base+side+lift,0-Math.max(0,lift));
      P.line(g,...a,...b,i%2?'#72533a':'#4f4331',4*s);P.line(g,...b,...c,i%2?'#8d6844':'#5f4d35',3*s);P.line(g,c[0]-3*s,c[1],c[0]+3*s,c[1],'#38392e',3*s);
    }
    P.ell(g,...q(-2,-31),25*s,12*s,'#886345');P.ell(g,...q(-10,-35),13*s,10*s,'#a07a51');
    P.poly(g,[q(15,-30),q(17,-45),q(26,-64),q(35,-61),q(32,-39),q(27,-27)],'#98714a');
    P.poly(g,[q(16,-40),q(21,-59),q(27,-66),q(31,-63),q(25,-44)],'#433e2c');
    P.poly(g,[q(25,-60),q(42,-57),q(46,-49),q(39,-45),q(29,-49)],'#a78255');
    P.poly(g,[q(28,-61),q(26,-72),q(32,-64)],'#77573d');P.poly(g,[q(35,-59),q(36,-69),q(39,-59)],'#a27b4e');
    P.ell(g,...q(43,-49),5*s,4*s,'#6c5539');P.dot(g,...q(37,-54),'#22291f');P.dot(g,...q(37,-55),'#daca9f');
    const tail=Math.sin(this.time*1.4)*4;
    P.line(g,...q(-23,-32),...q(-28+tail,-17),'#4b402b',4*s);P.line(g,...q(-28+tail,-17),...q(-32+tail,-8),'#4b402b',3*s);
    P.poly(g,[q(-13,-43),q(11,-43),q(13,-29),q(-13,-29)],'#65736c');
    P.line(g,...q(-10,-42),...q(8,-42),'#d0bd89',2*s);P.ell(g,...q(-1,-44),12*s,4*s,'#443d2c');
    P.line(g,...q(37,-54),...q(10,-44),'#d0b987',1);P.line(g,...q(9,-44),...q(13,-26),'#514934',1);
    P.line(g,...q(30,-55),...q(40,-52),'#514934',2*s);
    P.line(g,...q(-8,-34),...q(-8,-19),'#3e4334',2*s);P.rect(g,...q(-10,-20),5*s,4*s,'#b1a589');
  }
}

function makeHuman(kind='npc',id='') {
  const styles={
    player:{cloth:'#bbb092',coat:'#615d49',pants:'#3a4543',skin:'#b49372',hair:'#45362a',boot:'#3d392c',belt:'#4b3c2a',trim:'#d0b588'},
    enemy:{cloth:'#948460',coat:'#885c45',pants:'#454a3c',skin:'#b69a74',hair:'#38352a',boot:'#3b382b',trim:'#b79b6e'},
    sheriff:{cloth:'#b9ab83',coat:'#777d6a',pants:'#505f58',skin:'#ba9b79',hair:'#47372a',boot:'#3c382b',trim:'#d2b364'},
    npc:{cloth:'#c1ad82',coat:'#837357',pants:'#5c6550',skin:'#bca17d',hair:'#6a5840',boot:'#403c2d',trim:'#d6c399'},
  };
  const C={...(styles[kind]||styles.npc)};
  if(id==='ada'){C.coat='#485d52';C.cloth='#627c6d';C.pants='#4d584e';C.hair='#aaa89a';}
  if(id==='nell'){C.coat='#946b55';C.cloth='#c6ba91';C.hair='#493b2c';}
  if(id==='silas'){C.coat='#9b8053';C.cloth='#cac09e';C.hair='#736347';}
  if(id==='gideon'){C.coat='#57605a';C.cloth='#9ca390';C.hair='#3d3c30';}
  if(id==='tomas'){C.coat='#80684c';C.cloth='#99654a';C.pants='#444f4c';C.skin='#a78360';C.hair='#4f4b38';}
  if(id==='fern'){C.coat='#4f6b69';C.cloth='#718e87';C.pants='#535f57';C.hair='#5e4634';}
  C.metal='#737a70';C.hilt='#705239';
  const armed=kind==='player'||kind==='enemy'||kind==='sheriff';
  const rig=new E.Humanoid({size:id==='fern'?1.56:id==='tomas'?1.58:1.67,build:id==='tomas'?'bulky':'heroic',weapon:armed?'gun':null,outfit:id==='ada'?'robe':id==='tomas'?'shirt':'coat',hair:'short',sleeves:'long',colors:C});
  rig.t=hash([...id].reduce((n,c)=>n*31+c.charCodeAt(0),7))*10;
  return {rig,kind,id,armed,ready:false,flash:0,hat:['ada','fern','tomas'].includes(id)?null:kind==='player'?'#706047':kind==='sheriff'?'#8b845d':kind==='enemy'?'#61513b':'#a08b60'};
}
function drawHat(g,x,y,rig,view,color) {
  // The engine's hat silhouettes are fantasy-oriented, so this bespoke broad
  // brim and pinched crown keep every rider recognizably western.
  if((rig.downW||0)>.6)return;
  const head=E.charView(view).p(...rig._w(rig.J.head));
  const headX=x+head[0],headY=y+head[1]-5;
  P.ell(g,headX,headY+3,13,3,color);P.rect(g,headX-7,headY-5,14,7,color);
  P.poly(g,[[headX-7,headY-5],[headX-5,headY-10],[headX,headY-8],[headX+5,headY-10],[headX+7,headY-5]],E.shade(color,.08));
  P.line(g,headX-7,headY-1,headX+7,headY-1,'#383b2c',2);P.line(g,headX-11,headY+3,headX-3,headY+2,E.shade(color,.25),1);
}

function actorPoint(rig,view,x,y,joint,offset=[0,0,0]) {
  const at=rig.J[joint],q=E.charView(view).p(...rig._w([at[0]+offset[0],at[1]+offset[1],at[2]+offset[2]]));
  return [x+q[0],y+q[1]];
}

function drawRoleDetails(g,x,y,h,view) {
  const rig=h.rig;
  if((rig.downW||0)>.6)return;
  const head=actorPoint(rig,view,x,y,'head'),hip=actorPoint(rig,view,x,y,'hipC'),shoulder=actorPoint(rig,view,x,y,'shC');
  if(h.hat)drawHat(g,x,y,rig,view,h.hat);
  if(h.id==='ada') {
    P.ell(g,head[0]-6,head[1]-3,5,4,'#a4a497');P.line(g,head[0]-9,head[1]-5,head[0]-4,head[1]-6,'#d2cbbb',1);
    P.poly(g,[[shoulder[0]-11,shoulder[1]-1],[shoulder[0]+10,shoulder[1]-1],[hip[0]+3,hip[1]-1],[hip[0]-8,hip[1]-6]],'#9ba28d');
    P.line(g,shoulder[0]-9,shoulder[1],hip[0]+1,hip[1]-3,'#d0c6a3',2);
  } else if(h.id==='tomas') {
    P.ell(g,head[0]+1,head[1]-2,9,2,'#635644');P.rect(g,head[0]-6,head[1]-7,12,5,'#73644e');
    P.poly(g,[[shoulder[0]-5,shoulder[1]+2],[shoulder[0]+4,shoulder[1]+2],[hip[0]+7,hip[1]+12],[hip[0]-7,hip[1]+12]],'#b09368');
    P.rect(g,hip[0]-4,hip[1],8,5,'#806548');P.line(g,hip[0]-1,hip[1]+1,hip[0]-1,hip[1]-6,'#565e56',2);P.line(g,hip[0]-4,hip[1]-5,hip[0]+2,hip[1]-5,'#a9aca1',2);
  } else if(h.id==='fern') {
    P.poly(g,[[head[0]-7,head[1]-3],[head[0]-5,head[1]-9],[head[0]+4,head[1]-9],[head[0]+8,head[1]-2]],'#cdc6a9');
    P.line(g,head[0]-6,head[1]-2,head[0]-7,head[1]+7,'#aaa58b',2);
    P.poly(g,[[shoulder[0]-4,shoulder[1]+3],[shoulder[0]+5,shoulder[1]+3],[hip[0]+7,hip[1]+13],[hip[0]-6,hip[1]+13]],'#c5c4aa');
    P.rect(g,hip[0]-2,hip[1]+1,5,5,'#8d9e8b');P.line(g,shoulder[0]+6,shoulder[1]+2,hip[0]-5,hip[1]+2,'#645d43',2);
  }
}

function drawRevolver(g,x,y,h,view) {
  if(!h.armed||(h.rig.downW||0)>.6)return null;
  const rig=h.rig;
  if(!h.ready) {
    const hip=actorPoint(rig,view,x,y,'hipR',[1.8,1.3,-.5]);
    P.poly(g,[[hip[0]-3,hip[1]-2],[hip[0]+4,hip[1]-1],[hip[0]+3,hip[1]+8],[hip[0]-2,hip[1]+9]],'#624a34');
    P.line(g,hip[0]-2,hip[1]-4,hip[0]+2,hip[1]-3,'#3f4239',3);P.line(g,hip[0]+2,hip[1]+1,hip[0]+2,hip[1]+6,'#a28558',1);
    return null;
  }
  const hand=actorPoint(rig,view,x,y,'handR'),d=rig.J.bladeDir;
  const muzzle=actorPoint(rig,view,x,y,'handR',[d[0]*3.8,d[1]*3.8,d[2]*3.8]);
  const grip=actorPoint(rig,view,x,y,'handR',[-d[0]*.4,-d[1]*.4,-2]);
  P.line(g,...hand,...grip,'#654b33',3);P.line(g,...hand,...muzzle,'#414b45',3);P.line(g,hand[0],hand[1]-1,muzzle[0],muzzle[1]-1,'#a8afa0',1);
  P.disc(g,hand[0]+(muzzle[0]-hand[0])*.25,hand[1]+(muzzle[1]-hand[1])*.25,2,'#808b7e');P.dot(g,...muzzle,'#29372f');
  return muzzle;
}
function animalDraw(g,x,y,animal,phase) {
  const deer=!/wolf|coyote|fox/i.test(animal.kind||''),flip=Math.cos(animal.facing||0)<0?-1:1;
  const q=(a,b)=>[x+a*flip,y+b],alive=animal.hp>0&&animal.alive!==false;
  const color=deer?'#a99469':'#8a8c71',leg=alive?Math.sin(phase*2+animal.x)*3:0;
  if (!alive) {
    P.ell(g,...q(-2,-6),18,7,color);P.ell(g,...q(21,-3),8,4,color);
    P.line(g,...q(10,-9),...q(20,-3),color,5);
    for(let i=0;i<4;i++)P.line(g,...q(i<2?-11:8,-5),...q((i<2?-18:14)+(i%2?4:0),3),'#7f7154',2);
    P.line(g,...q(21,-5),...q(25,-10),E.shade(color,-.15),2);
    P.line(g,...q(-18,-7),...q(-24,-4),E.shade(color,-.2),2);
    return;
  }
  for(let i=0;i<4;i++)P.line(g,...q(i<2?-11:8,-14),...q((i<2?-11:8)+(i%2?leg:-leg),alive?0:-5),deer?'#7f7154':'#616951',2);
  P.ell(g,...q(-2,alive?-18:-8),17,7,color);P.poly(g,[q(10,-16),q(13,-30),q(18,-31),q(19,-20)],color);
  P.ell(g,...q(20,-30),7,4,color);P.line(g,...q(17,-32),...q(15,-40),E.shade(color,-.2),2);
  P.line(g,...q(19,-32),...q(21,-39),E.shade(color,-.1),2);P.dot(g,...q(23,-31),'#313b2a');
  P.line(g,...q(-17,-19),...q(-24,-15),E.shade(color,-.2),2);
  if(deer&&hash(animal.x)>.4){P.line(g,...q(14,-34),...q(9,-44),'#d2bd8b',1);P.line(g,...q(9,-44),...q(4,-46),'#d2bd8b',1);P.line(g,...q(9,-41),...q(7,-47),'#d2bd8b',1);}
}

function drawFishing(r,state,time) {
  const p=state.player;
  if(!state.fishing?.active||!p)return;
  const bobY=p.y+31,bobX=creekX(bobY),direction=bobX>p.x?1:-1;
  const float=r.w(bobX,bobY,state.fishing.bite?Math.sin(time*18)*2:1);
  r.queue(p.x,p.y,.1,g=>{
    const hand=r.w(p.x+direction*6,p.y,22),tip=r.w(p.x+direction*25,p.y+5,43);
    P.line(g,...hand,...tip,'#765b3d',3);P.line(g,...hand,...tip,'#ceb280',1);
    const sag=[(tip[0]+float[0])/2,(tip[1]+float[1])/2+8];
    P.line(g,...tip,...sag,'#d4c7a0',1);P.line(g,...sag,...float,'#d4c7a0',1);
    P.rect(g,float[0]-1,float[1]-3,3,4,state.fishing.bite?'#eac37e':'#a9654b');P.dot(g,float[0],float[1]-4,'#e8d6a8');
  });
  r.decal(()=>r.groundRing(bobX,bobY,3+((time*2)%1)*7,'#c1c5a4',state.fishing.bite?.8:.35));
}

function markerPoint(state,target) {
  if(!target)return null;
  if(Number.isFinite(target.x)&&Number.isFinite(target.y))return target;
  if(['mount','dismount'].includes(target.id))return target.id==='mount'?state.horse:state.player;
  if(target.id==='campfire')return {x:690,y:785};
  if(target.id==='valve')return {x:1095,y:857};
  if(target.id==='calm-stray')return state.animals?.find(a=>a.id==='stray');
  if(target.id==='collect-bounty')return state.enemies?.find(e=>e.id==='deserter');
  if(target.id?.startsWith('harvest:'))return state.animals?.find(a=>a.id===target.id.slice(8));
  if(target.id?.startsWith('gather:'))return state.resources?.find(a=>a.id===target.id.slice(7));
  return state.npcs?.find(n=>n.id===target.id);
}

function drawResource(r,node) {
  if(!r.visible(node.x,node.y,0,35,50,30))return;
  r.queue(node.x,node.y,0,g=>{
    const [x,y]=r.w(node.x,node.y,0);
    if(node.kind==='timber') {
      for(let i=0;i<3;i++) {
        const a=[x-16+i*3,y-3-i*3],b=[x+15+i*2,y-6-i*3];
        P.line(g,...a,...b,'#715637',5);P.line(g,a[0],a[1]-2,b[0],b[1]-2,'#a78a58',1);
        P.disc(g,...b,3,'#c2a16c');P.dot(g,...b,'#896641');
      }
    } else {
      for(let i=0;i<7;i++) {
        const dx=(i-3)*4,h=11+hash(i+node.x)*11;
        P.line(g,x+dx,y,x+dx+Math.sin(i)*3,y-h,'#666f42',1);
        P.ell(g,x+dx-3,y-h*.5,4,2,node.kind==='herbs'?'#bac29a':'#8c9c5c');
        P.ell(g,x+dx+2,y-h*.72,4,2,node.kind==='herbs'?'#a6b58a':'#6d8150');
        if(node.kind==='berries')P.disc(g,x+dx,y-h,2,i%2?'#b08465':'#8c6752');
      }
    }
  });
}

export function createWorldRenderer(game) {
  const scenery=generateScenery(), humans=new Map(), horses=new Map(), previous=new Map();
  const terrain=makeGround();
  let clock=0;
  const humanFor=(id,kind)=>{if(!humans.has(id))humans.set(id,makeHuman(kind,id));return humans.get(id);};
  const horseFor=(id)=>{if(!horses.has(id))horses.set(id,new HorseRig());return horses.get(id);};
  function motion(id,body,dt) {
    const before=previous.get(id), vx=before&&dt>0?(body.x-before.x)/dt:0, vy=before&&dt>0?(body.y-before.y)/dt:0;
    previous.set(id,{x:body.x,y:body.y});
    // Restoring a journey is a teleport, so it cannot become a galloping gait.
    return {vx:Math.abs(vx)<500?vx:0,vy:Math.abs(vy)<500?vy:0};
  }
  function update(dt,state) {
    clock+=dt;
    const player=state.player;
    if(player){
      const h=humanFor('player','player');
      h.ready=!!(state.aiming||player.aiming||player.shotTimer>0);
      h.flash=player.shotTimer>.24?player.shotTimer-.24:0;
      h.rig.update(dt,{...player,vx:player.mounted?0:player.vx,vy:player.mounted?0:player.vy,z:player.mounted?23:0,point:state.aiming||player.aiming||player.shotTimer>0,pose:player.hp<=0?'die':player.crouch?'crouch':state.fishing?.active?'cast':null,hurt:player.invulnerable>0&&player.invulnerable<.3,stance:state.aiming?'ready':null});
      if (state.horse) horseFor('juniper').update(dt,player.mounted?player:{...state.horse,...motion('juniper',state.horse,dt)});
    }
    for(const npc of state.npcs||[]) {
      if(npc.departed)continue;
      const kind=/holt|marshal|sheriff/i.test(npc.id+' '+npc.name)?'sheriff':'npc';
      humanFor(npc.id,kind).rig.update(dt,{...npc,...motion(npc.id,npc,dt),pose:npc.hp<=0?'die':npc.id==='ada'?'hips':null,facing:npc.facing??1.3});
    }
    for(const enemy of state.enemies||[]) {
      const h=humanFor(enemy.id,enemy.kind==='law'?'sheriff':'enemy');
      h.ready=!!(enemy.active&&enemy.hp>0&&!enemy.surrendered&&!enemy.captured);
      h.flash=Math.max(0,h.flash-dt);
      if(enemy.active&&enemy.hp>0&&Number.isFinite(h.lastFireTimer)&&enemy.fireTimer>h.lastFireTimer+.4)h.flash=.08;
      h.lastFireTimer=enemy.fireTimer;
      h.rig.update(dt,{...enemy,...motion(enemy.id,enemy,dt),point:enemy.active&&enemy.hp>0,pose:enemy.hp<=0?'die':enemy.surrendered?'guard':null});
    }
    for(const animal of state.animals||[])if(animal.kind==='horse')horseFor(animal.id).update(dt,{...animal,...motion(animal.id,animal,dt)});
    const liveIds=new Set(['player',...(state.npcs||[]).map(n=>n.id),...(state.enemies||[]).map(e=>e.id)]);
    for(const id of humans.keys())if(!liveIds.has(id)){humans.delete(id);previous.delete(id);}
  }
  function drawHuman(r,body,id,kind,isPlayer=false) {
    const h=humanFor(id,kind),z=body.mounted?23:body.z||0;
    if(!r.visible(body.x,body.y,z,75,115,100))return;
    r.shadow(body.x,body.y,body.mounted?18:8,.23,'#363f2e');
    if(!body.mounted)longShadow(r,body.x,body.y,23,5);
    r.actor(body.x,body.y,z,(g,ox,oy)=>{
      // The engine still poses and draws the character. A custom compact
      // revolver replaces its bright weapon sprite and rests in a holster.
      const weapon=h.rig.o.weapon;h.rig.o.weapon=null;h.rig.draw(g,ox,oy,r.view);h.rig.o.weapon=weapon;
      drawRoleDetails(g,ox,oy,h,r.view);
      const muzzle=drawRevolver(g,ox,oy,h,r.view);
      if(h.flash>0&&muzzle) {
        const [tx,ty]=muzzle;
        P.ddisc(g,tx,ty,9,'#e3b567',.16);
        P.poly(g,[[tx-5,ty],[tx-1,ty-3],[tx+3,ty-2],[tx+7,ty],[tx+2,ty+2],[tx-1,ty+3]],'#f1d59a');
        P.disc(g,tx,ty,2,'#fff0c0');
      }
      if(isPlayer&&!(h.rig.downW>.5)){
        // Mara's faded red neckerchief is her identifying accent in the dust.
        const y=oy-42-(body.mounted?0:0);P.poly(g,[[ox-4,y],[ox+5,y],[ox+3,y+7],[ox+1,y+3],[ox-3,y+6]],'#a15d43');
      }
    },{outline:false,flash:isPlayer&&body.invulnerable>0&&body.invulnerable<.3?'#ead8af':false,alpha:body.hp<=0?.8:1});
  }
  function draw(r,state) {
    const hour=state.time??17.5;
    // Ground is pre-rendered once. The engine still owns world projection,
    // painter's order, procedural rigs, camera, particles and all animation.
    const horizon=drawDistant(r,clock,hour,clock,state.weather||'clear'),g=r.ctx;
    g.save();g.beginPath();g.rect(0,horizon,r.bw,r.bh-horizon);g.clip();
    P.rect(g,0,horizon,r.bw,r.bh-horizon,'#8b8b50');
    g.transform(r.view.ax,r.view.bx,r.view.ay,r.view.by,-r.ix,-r.iy);
    g.drawImage(terrain,0,0);g.restore();
    // Clip world geometry at the skyline until the first screen overlay.
    // Decals execute before actors in the engine's painter-ordered pass.
    r.decal(ctx=>{ctx.save();ctx.beginPath();ctx.rect(0,horizon,r.bw,r.bh-horizon);ctx.clip();});
    r.overlay(ctx=>ctx.restore());
    // Water glints move slowly across the cached creek texture.
    for(let i=0;i<26;i++){
      const wy=((i*43+clock*6)%WORLD_H),wx=creekX(wy)+Math.sin(i*7)*13;
      const q=r.w(wx,wy,0);if(q[1]<horizon||q[0]<-25||q[0]>r.bw+25)continue;
      P.line(g,q[0],q[1],q[0]+8+Math.sin(clock+i)*4,q[1],'#b7bba1',1);
    }
    for(const p of scenery) {
      const screen=r.w(p.x,p.y,0);if(screen[1]<horizon||!r.visible(p.x,p.y,0,100,190,90))continue;
      if(p.kind==='tree'||p.kind==='pine')drawTree(r,p,clock,state.player);else if(p.kind==='rock')drawRock(r,p);else drawReeds(r,p,clock);
    }
    for(const b of BUILDINGS)drawBuilding(r,b,state.player);
    for(const node of state.resources||[])if(state.day>=node.availableDay)drawResource(r,node);
    if(r.visible(700,730,0,250,250,220))drawCamp(r,clock,state.camp);
    drawRailroad(r,clock,state.mission?.waterRunning,state.player);
    drawFence(r,[[1300,800],[1340,810],[1380,820],[1420,816],[1460,808]],24);
    drawFence(r,[[1300,690],[1290,735],[1300,780]],24);
    // Bridge rails, a painted location sign, and a trail cairn.
    const bridgeX=creekX(605)-59;
    drawFence(r,[[bridgeX,587],[bridgeX+59,587],[bridgeX+118,587]],15);drawFence(r,[[bridgeX,623],[bridgeX+59,623],[bridgeX+118,623]],15);
    r.queue(842,583,0,ctx=>{
      P.line(ctx,...r.w(842,583,0),...r.w(842,583,40),'#66553b',3);
      const q=r.w(842,583,37);P.rect(ctx,q[0]-45,q[1]-5,90,12,'#d1bd8c');E.font.text(ctx,'← MERCY RIVER',q[0],q[1]-3,'#474a34',{align:'center',outline:false});
    });
    for(const animal of state.animals||[]) {
      if(animal.harvested||!r.visible(animal.x,animal.y,0,65,90,60))continue;
      r.shadow(animal.x,animal.y,12,.23,'#455038');
      r.actor(animal.x,animal.y,0,(ctx,x,y)=>{if(animal.kind==='horse')horseFor(animal.id).draw(ctx,x,y,1,animal.hp<=0);else animalDraw(ctx,x,y,animal,clock);},{outline:false});
    }
    for(const npc of state.npcs||[])if(!npc.departed)drawHuman(r,npc,npc.id,/holt|marshal|sheriff/i.test(npc.id+' '+npc.name)?'sheriff':'npc');
    for(const enemy of state.enemies||[]) {
      if(enemy.captured&&state.captive!==enemy.id)continue;
      drawHuman(r,enemy,enemy.id,enemy.kind==='law'?'sheriff':'enemy');
      if(state.captive===enemy.id)r.queue(enemy.x,enemy.y,.2,ctx=>{
        const q=r.w(enemy.x,enemy.y,18);P.line(ctx,q[0]-6,q[1],q[0]+6,q[1],'#c7b385',3);P.line(ctx,q[0]-3,q[1]-5,q[0]-3,q[1]+4,'#706044',1);
      });
      if(enemy.hp>0&&enemy.active)r.textAt(enemy.x,enemy.y,62,'•','#c08357',{scale:2,outline:false});
    }
    const player=state.player,horse=player?.mounted?player:state.horse;
    if(horse) {
      r.shadow(horse.x,horse.y,22,.28,'#3c4430');longShadow(r,horse.x,horse.y,40,13);
      r.actor(horse.x,horse.y,0,(ctx,x,y)=>horseFor('juniper').draw(ctx,x,y,1.19),{outline:false,margin:100});
    }
    if(player)drawHuman(r,player,'player','player',true);
    drawFishing(r,state,clock);
    for(const shot of state.bullets||[]) {
      const a=r.w(shot.x,shot.y,shot.z??25), b=r.w(shot.x-(shot.vx||0)*.019,shot.y-(shot.vy||0)*.019,shot.z??25);
      r.queue(shot.x,shot.y,30,ctx=>{P.line(ctx,...a,...b,shot.faction==='enemy'?'#e6ac70':'#e9d9a4',2);P.dot(ctx,...a,'#f2e7be');});
    }
    r.overlay(ctx=>{
      const night=hour<6||hour>20,wet=state.weather==='rain';
      const tint=night?'#182e34':state.weather==='overcast'||wet?'#627977':'#dab57b';
      P.blend(ctx,night?.42:wet?.14:state.weather==='overcast'?.1:.055,'normal',()=>P.rect(ctx,0,horizon,r.bw,r.bh-horizon,tint));
      if(night) {
        const fire=r.w(690,785,0);
        if(fire[1]>=horizon)P.ddisc(ctx,...fire,85,'#e8b46a',.16);
      }
      if(wet)for(let i=0;i<Math.min(140,Math.ceil(r.bw*r.bh/5000));i++) {
        const x=(hash(i+242)*r.bw+clock*33)%(r.bw+30)-15;
        const y=(hash(i+619)*r.bh+clock*(220+hash(i+731)*120))%(r.bh+30)-15;
        P.blend(ctx,.35+hash(i+917)*.2,'normal',()=>P.line(ctx,x,y,x-3,y+8+hash(i+57)*7,'#b2c2b1',1));
      }
      if(player?.focusActive)P.blend(ctx,.1,'normal',()=>P.rect(ctx,0,0,r.bw,r.bh,'#ccae77'));
    });
    // Interaction ids are simulation data; coordinates come from the same
    // people and landmarks drawn above, including restored journeys.
    const target=markerPoint(state,state.nearby||state.interactionTarget);
    if(target&&typeof target.x==='number'){
      const q=r.w(target.x,target.y,60);r.overlay(ctx=>{
        if(q[1]<horizon||q[0]<0||q[0]>r.bw||q[1]>r.bh)return;
        P.poly(ctx,[[q[0],q[1]-6],[q[0]+5,q[1]],[q[0],q[1]+6],[q[0]-5,q[1]]],'#e3cea0');
        P.poly(ctx,[[q[0],q[1]-3],[q[0]+2,q[1]],[q[0],q[1]+3],[q[0]-2,q[1]]],'#68694b');
      });
    }
    const pointer=state.pointer;
    if(state.aiming&&pointer&&typeof pointer.x==='number')r.overlay(ctx=>{
      const x=pointer.x,y=pointer.y;
      for(const sign of [-1,1]){P.line(ctx,x+sign*5,y,x+sign*10,y,'#e5d3a7',1);P.line(ctx,x,y+sign*5,x,y+sign*10,'#e5d3a7',1);}
      P.dot(ctx,x,y,'#ad6b45');
    });
  }
  return {update,draw};
}
