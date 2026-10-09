/** Witnessed reconnaissance events. Location identification is a separate fact. */
import {RIVAL_ID,RIVAL_WORLD as W} from '../content/campaign/bellwether-works.js';
const rec=s=>s.campaign.missions[RIVAL_ID];
const point=a=>({x:a.x,y:a.y,z:a.z||0});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const events={
  card:{actors:['calder','levi'],text:'Calder tears the payment card in Levi’s hand.'},
  strike:{actors:['calder','levi'],text:'Calder strikes Levi. The younger man stays on his feet.'},
  departure:{actors:['calder','grout'],text:'Calder rides away on Grout along the northern road.'},
  dismissal:{actors:['levi','skein'],text:'Levi takes Skein out of the works after Calder dismisses him.'},
};
export const requiresReconWitness=s=>rec(s).rival.contractVersion===2;
export function initializeReconWitness(s){
  const r=rec(s);
  if(requiresReconWitness(s)&&!r.rival.reconWitness)r.rival.reconWitness={schema:1,receipts:[],departureOrigin:null,dismissalOrigin:null};
  return r.rival.reconWitness;
}
export function visibleReconActors(s,input,ids){
  const r=rec(s);
  if(!r.scope.raised||input.scopeVisible===false)return false;
  return ids.every(id=>{
    const actor=s.entities[id];
    if(!actor||actor.hidden||actor.departed||actor.hp<=0||actor.regionId!==s.region)return false;
    if(Array.isArray(input.scopeActors))return input.scopeActors.includes(id);
    // State-unit input can hold an explicit world aim without a renderer. It
    // must still frame these actual nearby actors; this is not public proof.
    return distance(r.scope.aim,actor)<110;
  });
}
export function witnessedReconEvent(s,id){return !!rec(s).rival.reconWitness?.receipts.some(receipt=>receipt.id===id);}
export function recordReconEvent(s,id,input,ctx){
  if(!requiresReconWitness(s)||witnessedReconEvent(s,id)||!visibleReconActors(s,input,events[id].actors))return false;
  const r=rec(s),w=initializeReconWitness(s);
  w.receipts.push({id,at:s.elapsed,from:point(s.entities.mara),actors:events[id].actors.map(actorId=>({id:actorId,...point(s.entities[actorId]),mounted:!!s.entities[actorId].mounted}))});
  ctx.log(s,events[id].text);ctx.notice(s,events[id].text);return true;
}
export function reconWitnessComplete(s){
  if(!requiresReconWitness(s))return rec(s).rival.reconEventPhase>=2;
  return Object.keys(events).every(id=>witnessedReconEvent(s,id))&&s.entities.calder.departed===true&&s.entities.grout.departed===true;
}
export function validateReconWitness(s){
  const r=rec(s),w=r.rival.reconWitness;
  if(r.rival.contractVersion!==undefined&&r.rival.contractVersion!==2)return false;
  if(!requiresReconWitness(s))return w===undefined;
  if(!Number.isInteger(r.rival.reconEventPhase)||r.rival.reconEventPhase<0||r.rival.reconEventPhase>2||!Number.isFinite(r.rival.reconAge)||r.rival.reconAge<0)return false;
  if(w===undefined)return !r.scope.observed.calder&&!r.flags.reconComplete;
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v),validPoint=p=>object(p)&&['x','y','z'].every(k=>Number.isFinite(p[k]))&&p.x>=0&&p.y>=0&&p.x<=W.width&&p.y<=W.height&&p.z>=0&&p.z<=160;
  if(!object(w)||w.schema!==1||Object.keys(w).length!==4||!Array.isArray(w.receipts)||w.receipts.length>4||new Set(w.receipts.map(a=>a?.id)).size!==w.receipts.length)return false;
  for(const key of ['departureOrigin','dismissalOrigin'])if(w[key]!==null&&!validPoint(w[key]))return false;
  for(let n=0;n<w.receipts.length;n++){
    const entry=w.receipts[n],definition=events[entry?.id];
    if(!definition||!Number.isFinite(entry.at)||entry.at<0||entry.at>s.elapsed||n&&entry.at<w.receipts[n-1].at||!validPoint(entry.from)||!Array.isArray(entry.actors)||entry.actors.length!==2)return false;
    if(entry.actors.some((actor,index)=>!actor||actor.id!==definition.actors[index]||!validPoint(actor)||typeof actor.mounted!=='boolean'))return false;
    if(entry.id==='card'&&(r.rival.reconEventPhase<1||r.objects['levi-debt-card']?.torn!==true))return false;
    if(entry.id==='strike'&&(r.rival.reconEventPhase<2||!s.entities.levi.bruised||!witnessedReconEvent(s,'card')))return false;
    if(entry.id==='departure'&&(!w.departureOrigin||entry.actors[0].mounted!==true||distance(entry.actors[0],w.departureOrigin)<40||!witnessedReconEvent(s,'strike')))return false;
    if(entry.id==='dismissal'&&(!w.dismissalOrigin||entry.actors[0].mounted!==true||distance(entry.actors[0],w.dismissalOrigin)<40||!witnessedReconEvent(s,'strike')))return false;
  }
  if(r.flags.reconComplete&&!reconWitnessComplete(s))return false;
  return true;
}
