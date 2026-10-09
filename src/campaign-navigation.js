/** Shared world-space navigation. Drawing never changes these positions. */
const grids=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const insideRect=(p,o,r=0)=>p.x>o.x-r+1e-7&&p.x<o.x+o.w+r-1e-7&&p.y>o.y-r+1e-7&&p.y<o.y+o.h+r-1e-7;
export function blockedAt(world,x,y,radius=9){return x<radius||y<radius||x>world.width-radius||y>world.height-radius||(world.obstacles||[]).some(o=>insideRect({x,y},o,radius));}
export function moveActor(world,a,dx,dy,radius=9){const old={x:a.x,y:a.y};if(!blockedAt(world,a.x+dx,a.y,radius))a.x+=dx;if(!blockedAt(world,a.x,a.y+dy,radius))a.y+=dy;return distance(old,a);}
export function clearLine(world,a,b,radius=1,projectile=true){
  const n=Math.max(1,Math.ceil(distance(a,b)/4));
  for(let i=1;i<=n;i++){const u=i/n,p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:(a.z||0)+((b.z||0)-(a.z||0))*u};
    if((world.obstacles||[]).some(o=>insideRect(p,o,radius)&&(!projectile||!o.impassable&&p.z<=(o.z||0)+(o.height||35))))return false;
  }return true;
}
function route(world,a,b,radius){
  let caches=grids.get(world);if(!caches){caches=new Map();grids.set(world,caches);}const cellSize=20,cols=Math.ceil(world.width/cellSize),rows=Math.ceil(world.height/cellSize);
  let grid=caches.get(radius);if(!grid){grid=Array.from({length:cols*rows},(_,i)=>!blockedAt(world,i%cols*cellSize+10,Math.floor(i/cols)*cellSize+10,radius));caches.set(radius,grid);}
  const cell=p=>Math.max(0,Math.min(rows-1,Math.floor(p.y/cellSize)))*cols+Math.max(0,Math.min(cols-1,Math.floor(p.x/cellSize)));
  const closest=n=>{if(grid[n])return n;let result=null,best=Infinity;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=n%cols+dx,y=Math.floor(n/cols)+dy,id=y*cols+x;if(x>=0&&x<cols&&y>=0&&y<rows&&grid[id]&&dx*dx+dy*dy<best){result=id;best=dx*dx+dy*dy;}}return result;};
  const start=closest(cell(a)),end=closest(cell(b));if(start===null||end===null)return[];const prev=new Int32Array(cols*rows).fill(-1),queue=[start];prev[start]=start;
  for(let at=0;at<queue.length&&prev[end]<0;at++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const n=queue[at],x=n%cols+dx,y=Math.floor(n/cols)+dy,id=y*cols+x;if(x<0||x>=cols||y<0||y>=rows||!grid[id]||prev[id]>=0)continue;prev[id]=n;queue.push(id);}
  if(prev[end]<0)return[];const points=[{x:b.x,y:b.y,z:b.z||0}];for(let n=end;n!==start;n=prev[n])points.push({x:n%cols*cellSize+10,y:Math.floor(n/cols)*cellSize+10,z:a.z||0});return points.reverse();
}
export function followActor(world,a,target,speed,dt,stop=20,radius=9){
  if(!a||!target||dt<=0)return 0;if(distance(a,target)<=stop){a.vx=0;a.vy=0;return 0;}
  if(!a.routeTarget||distance(a.routeTarget,target)>20||!a.route?.length){a.routeTarget={x:target.x,y:target.y,z:target.z||0};a.route=clearLine(world,a,target,radius,false)?[a.routeTarget]:route(world,a,target,radius);}
  while(a.route?.length&&distance(a,a.route[0])<6)a.route.shift();const goal=a.route?.[0]||target,d=distance(a,goal),step=Math.min(speed*dt,d),old={x:a.x,y:a.y};
  moveActor(world,a,d?(goal.x-a.x)/d*step:0,d?(goal.y-a.y)/d*step:0,radius);a.vx=(a.x-old.x)/dt;a.vy=(a.y-old.y)/dt;if(Math.hypot(a.vx,a.vy)>1)a.facing=Math.atan2(a.vy,a.vx);return distance(old,a);
}
