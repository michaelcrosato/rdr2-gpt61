import { NORTH_CUTTING_WORLD as WORLD } from '../content/campaign/north-cutting.js';

export function drawExpeditionCamp(E,r,state){
  if(!state.entities?.elin)return;
  const P=E.px,c=WORLD.camp,b=c.interiors[0],inside=state.player.x>b.x-35&&state.player.x<b.x+b.w+35&&state.player.y>b.y-50&&state.player.y<b.y+b.h+35;
  const poly=(g,pts,color)=>P.poly(g,pts.map(p=>r.w(...p)),color);
  poly(r.ctx,[[b.x,b.y,0],[b.x+b.w,b.y,0],[b.x+b.w,b.y+b.h,0],[b.x,b.y+b.h,0]],'#a4a289');
  for(let x=b.x+5;x<b.x+b.w;x+=12)P.line(r.ctx,...r.w(x,b.y,0),...r.w(x,b.y+b.h,0),'#8b8d76',1);
  for(const o of c.obstacles)r.queue(o.x+o.w/2,o.y+o.h,0,g=>{const fades=inside||state.entities.silas?.attachment?.type==='carried'&&state.entities.silas.attachment.targetId==='moss';if(fades){g.save();g.globalAlpha*=.24;}r.box(g,o.x,o.y,0,o.x+o.w,o.y+o.h,o.height,'#b0b29b','#7e8982');for(let y=o.y+12;y<o.y+o.h;y+=17)P.line(g,...r.w(o.x+o.w,y,0),...r.w(o.x+o.w,y,o.height),'#acb39c',1);if(fades){g.restore();g._c=null;}});
  // Authored north wall segments above leave the actual 57-unit doorway open.
  if(!inside)r.queue(b.x+b.w/2,b.y+b.h,0,g=>{const fade=state.player.y<b.y+b.h&&Math.abs(state.player.x-(b.x+b.w/2))<120;if(fade){g.save();g.globalAlpha*=.25;}poly(g,[[b.x-10,b.y-8,55],[380,b.y-8,78],[380,b.y+b.h+8,78],[b.x-10,b.y+b.h+8,55]],'#d1d8c2');poly(g,[[380,b.y-8,78],[b.x+b.w+10,b.y-8,55],[b.x+b.w+10,b.y+b.h+8,55],[380,b.y+b.h+8,78]],'#93aca6');for(let y=b.y;y<b.y+b.h;y+=18)P.line(g,...r.w(b.x-9,y,56),...r.w(380,y,79),'#e0e4cd',1);if(fade){g.restore();g._c=null;}});
  for(const p of c.props){if(!r.visible(p.x,p.y,0,120,100,60))continue;r.queue(p.x,p.y,0,g=>{const[x,y]=r.w(p.x,p.y,0);
    if(p.kind==='chest'){P.rect(g,x-20,y-26,40,27,'#8c7655');P.poly(g,[[x-22,y-27],[x+15,y-32],[x+22,y-26],[x-17,y-22]],'#b3a17a');P.line(g,x-12,y-25,x-12,y,'#d2bf93',3);P.line(g,x+11,y-28,x+11,y,'#d2bf93',3);P.rect(g,x-4,y-16,8,6,'#c6c4a0');P.line(g,x-3,y-13,x+3,y-13,'#56685a',1);}
    else if(p.kind==='bed'){P.line(g,x-52,y+5,x+49,y+5,'#83775a',5);P.rect(g,x-50,y-11,98,16,'#727e6b');P.poly(g,[[x-49,y-13],[x-34,y-20],[x+48,y-14],[x+48,y+1],[x-49,y+2]],'#c3b58f');P.rect(g,x-49,y-15,22,12,'#d0ceb1');P.line(g,x+17,y-13,x+17,y+2,'#99876a',3);}
    else if(p.kind==='scarf'){P.line(g,x-8,y-7,x+11,y+4,'#b78768',5);for(let i=0;i<4;i++)P.line(g,x+5+i*2,y+2,x+5+i*2,y+7,'#d4bd93',1);}
    else if(p.kind==='waypoint'){P.line(g,x-25,y,x-25,y-40,'#857859',5);P.line(g,x+25,y,x+25,y-40,'#857859',5);P.line(g,x-29,y-35,x+29,y-35,'#ac9771',5);P.rect(g,x-17,y-31,34,15,'#576e66');P.line(g,x-8,y-23,x+9,y-23,'#d6d2ad',2);P.line(g,x+9,y-23,x+4,y-27,'#d6d2ad',2);}
  });}
}
