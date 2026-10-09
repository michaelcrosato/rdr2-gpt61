/** The spoken evidence and counted-care contract. Legacy v4 summaries remain
 * historical; only newly declared contractVersion 2 uses these exchanges.
 */
import {RIVAL_ID,RIVAL_WORLD as W,RIVAL_DIALOGUE as D,RIVAL_STAGES} from '../content/campaign/bellwether-works.js';
import {followActor} from './campaign-navigation.js';
import {usesRivalContinuation,validateRivalContinuation,rivalHistoricalValidationState} from './rival-continuation.js';
const record=s=>s.campaign?.missions?.[RIVAL_ID],player=s=>s.entities?.[s.party?.playerId||'mara'],actor=(s,id)=>s.entities?.[id];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value),finite=Number.isFinite;
const point=a=>({x:a.x,y:a.y,z:a.z||0}),validPoint=p=>object(p)&&['x','y','z'].every(key=>finite(p[key]));
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
const near=(a,b,radius=65)=>a&&b&&distance(a,b)<=radius&&Math.abs((a.z||0)-(b.z||0))<8;
const council=['della','tomas','bastian','ruth'];
export const QUESTIONING_ANCHORS={della:{x:W.camp.holding.x-30,y:W.camp.holding.y-18,z:0},tomas:{x:W.camp.holding.x+34,y:W.camp.holding.y-18,z:0},bastian:{x:W.camp.holding.x+42,y:W.camp.holding.y+24,z:0},ruth:{x:W.camp.holding.x-28,y:W.camp.holding.y+24,z:0}};
const speakers={cardQuestion:'della',leviCard:'levi',signatureQuestion:'mara',signatureAnswer:'levi',identityDenial:'levi',coercion:'bastian',objection:'mara',temporaryHold:'tomas',care:'ruth',noStock:'della',assurance:'mara',deprivation:'bastian',deprivationResponse:'levi'};
const required=['cardQuestion','leviCard','signatureQuestion','signatureAnswer','identityDenial','coercion','temporaryHold'];
export const QUESTIONING_TRANSACTION_KEYS=[...required,'objection'].map(key=>`question:${key}`);
export const QUESTIONING_CHOICES=['question:continue','question:leave','question:object','question:allow-order','care:return','care:partial','care:assure','care-levi','deprive-levi'];
const key=id=>`${RIVAL_ID}:${id}`,heard=(q,id)=>q.seen.some(entry=>entry.lineId===id);
export const usesQuestioningContract=r=>r?.rival?.contractVersion===2&&r.rival.questioningVersion===1;
export function createRivalQuestioning(){return {schema:1,startedAt:null,finishedAt:null,phase:'unstarted',cursor:null,objection:null,seen:[],careSeen:[],fetches:[],initialStock:null,care:null};}
function held(s){const r=record(s),levi=actor(s,'levi');return s.region==='snowbound'&&r?.flags.held&&r.flags.bound&&levi?.hp>0&&levi.bound===true&&levi.attachment?.type==='rest'&&levi.attachment.targetId===W.camp.holding.id&&levi.attachment.regionId==='snowbound';}
function available(s){const r=record(s);return usesQuestioningContract(r)&&s.campaign.activeMissionId===RIVAL_ID&&r.status==='active'&&r.mission.stage===12&&held(s)&&!s.failure;}
function councilReady(s){return council.every(id=>actor(s,id)?.hp>0&&!actor(s,id).hidden&&!actor(s,id).departed&&!actor(s,id).escaped&&actor(s,id).regionId==='snowbound'&&!actor(s,id).mounted&&near(actor(s,id),QUESTIONING_ANCHORS[id],15));}
function evidence(r){const owner=r.mission.completed&&r.aftermath?.holding?.visit2.borrowed?'mara':'tomas';return ['route-diagram','seizure-list'].every(id=>r.objects[id]?.kind==='document'&&r.objects[id].owner===owner&&r.objects[id].location?.type==='carried'&&r.objects[id].location.targetId===owner)&&r.objects['levi-debt-card']?.kind==='debt-card'&&r.objects['levi-debt-card'].owner==='levi'&&r.objects['levi-debt-card'].location?.type==='carried'&&r.objects['levi-debt-card'].location.targetId==='levi';}
function setGoal(a,target){a.goal=point(target);a.route=[];delete a.routeTarget;}
function stock(s){return {food:s.camp.food||0,blankets:s.camp.blankets||0};}
function careChoices(s){const n=stock(s),choices=[['care-levi','Provide one counted meal and one blanket from camp.']];if((n.food>=1)!==(n.blankets>=1))choices.push(['care:partial','Give the supplies actually available and loosen the knots.']);if(n.food<1&&n.blankets<1)choices.push(['care:assure','Offer reassurance and loosen the knots; no provisions are available.']);choices.push(['deprive-levi','Withhold provisions and tighten the hold.'],['question:leave','Leave to fetch supplies and return to this unfinished decision.']);return choices;}
function choices(s,line){if(line==='coercion')return [['question:object','Object to Bastian’s demand.'],['question:allow-order','Let Tomas give the guarded order.'],['question:leave','Pause this exchange and return.']];if(line==='care'||line==='noStock')return careChoices(s);return [['question:continue','Continue the exchange.'],...(['assurance','deprivation','deprivationResponse'].includes(line)?[['care:return','Reconsider the care decision.']]:[]),['question:leave','Pause this exchange and return.']];}
function text(s,line,legacyCounts=false){
  if(line!=='noStock')return D[line]?.text;
  const n=stock(s),portion=legacyCounts||n.food!==1?'portions':'portion',blanket=legacyCounts||n.blankets!==1?'blankets':'blanket';
  return (n.food<1?D.noStock.text:'No spare blanket is available. Record the meal we can give and the blanket still needing to be fetched.')+` Available now: ${n.food} food ${portion} and ${n.blankets} ${blanket}.`;
}
function show(s,ctx){const q=record(s).rival.questioning,line=q.cursor;if(!available(s)||!councilReady(s)||!near(player(s),W.camp.holding,65))return false;ctx.talk(s,`rival-questioning-${line}`,D[line].speaker,text(s,line),choices(s,line));return true;}
function start(s){const r=record(s),q=r.rival.questioning;if(!q)return null;if(q.phase!=='unstarted')return q;const n=stock(s);Object.assign(q,{startedAt:s.elapsed,phase:'assembling',cursor:'cardQuestion',initialStock:n});for(const id of council)setGoal(actor(s,id),QUESTIONING_ANCHORS[id]);return q;}
function receipt(s,line){const r=record(s),q=r.rival.questioning,id=key(`question:${line}`);if(r.transactions[id])return false;const who=speakers[line];q.seen.push({lineId:line,actorId:who,at:s.elapsed,position:point(actor(s,who)),playerPosition:point(player(s))});r.transactions[id]={completed:true,actorId:who,at:s.elapsed};return true;}
function careSpeech(s,line){const q=record(s).rival.questioning;if(q.careSeen.some(entry=>entry.lineId===line))return;const who=speakers[line];q.careSeen.push({lineId:line,actorId:who,at:s.elapsed,position:point(actor(s,who)),playerPosition:point(player(s))});}
export function initialQuestioningCare(r){
  if(!usesQuestioningContract(r)){if(r.rival.questioningVersion!==undefined||r.rival.questioning!==undefined)return null;return {foodUsed:r.choices.care==='care'?1:0,blanketUsed:r.choices.care==='care'?1:0,restraint:r.choices.care==='care'?'loose':'tight',provisions:r.choices.care==='care'?'provided':'withheld',deprived:r.choices.care==='deprive'};}
  const c=r.rival.questioning?.care;if(!c)return null;
  return {foodUsed:c.foodUsed,blanketUsed:c.blanketUsed,restraint:c.mode==='deprive'?'tight':'loose',provisions:c.mode==='deprive'?'withheld':c.foodUsed?c.blanketUsed?'provided':'limited':'unavailable',deprived:c.mode==='deprive'};
}
export function questioningVisitText(r,{legacyDeprivationText=false}={}){
  const c=initialQuestioningCare(r);if(!usesQuestioningContract(r)||!c)return null;
  const meal=c.foodUsed?'The counted meal arrived.':c.deprived&&!legacyDeprivationText?'No meal was provided at the first holding decision.':'No meal was available at the first holding decision.';
  return `${meal} ${c.blanketUsed?'The blanket arrived too.':'No blanket was provided at that decision.'} ${c.deprived?'The tightened hold was chosen.':'The knots were loosened.'} I am still under guard; checking the copied warrants does not make this a free room.`;
}
export function advanceQuestioning(s,dt,ctx){
  const r=record(s),q=r?.rival.questioning;if(!usesQuestioningContract(r)||!q||q.phase==='unstarted'||s.dialog||s.failure||s.region!=='snowbound'||!finite(dt)||dt<=0)return;
  if(available(s)&&council.some(id=>!actor(s,id)||actor(s,id).hp<=0||actor(s,id).departed||actor(s,id).escaped)){ctx.fail(s,'A required holding-room speaker was lost. Retry the actual camp-return checkpoint.');return;}
  const della=actor(s,'della');if(della?.goal){followActor(ctx.worldFor(s),della,della.goal,76,dt,4,9);if(near(della,della.goal,5))delete della.goal;}
  if(available(s)&&q.phase==='assembling'&&councilReady(s)&&near(player(s),W.camp.holding,65)){q.phase='questioning';show(s,ctx);}
}
function offer(s,id,label,target,radius=65){const p=player(s);return near(p,target,radius)?{id,label,targetId:target.id||'levi',x:target.x,y:target.y,z:target.z||0,distance:distance(p,target),priority:-4}:null;}
export function getQuestioningInteractions(s){
  if(!available(s)||s.dialog)return [];
  const r=record(s),q=r.rival.questioning,list=[];
  if(q&&q.phase!=='done')list.push(offer(s,'talk:levi-evidence',q.phase==='unstarted'?'Bring Della, Tomas, Bastian and Ruth to Levi’s holding room':'Resume the holding-room questions and care',W.camp.holding));
  if(q&&q.finishedAt!==null&&!q.care){
    // Only already-owned ordinary provisions can be brought back. Gifted
    // Rescue/Hunt rations retain their owning ledgers and are not convertible.
    for(const id of ['broth','oats','blankets']){
      const field=id==='blankets'?'blankets':'food';if((s.camp[field]||0)>=1)continue;
      if((s.inventory[id]||0)>0)list.push(offer(s,`care:bring:${id}`,'Bring one owned provision to Ruth’s care account',W.camp.ledger,55));
      if((s.horse.pack?.[id]||0)>0)list.push(offer(s,`care:unpack:${id}`,'Fetch one owned provision from Copper’s actual pack',s.horse,58));
    }
  }
  return list.filter(Boolean);
}
export function interactQuestioning(s,id,ctx){
  if(!getQuestioningInteractions(s).some(offer=>offer.id===id))return false;
  const r=record(s),q=start(s);if(!q)return false;
  if(id==='talk:levi-evidence'){if(q.phase!=='assembling'){if(q.cursor==='noStock'&&stock(s).food>=1&&stock(s).blankets>=1)q.cursor='care';show(s,ctx);}else ctx.notice(s,'The four named speakers are walking through the doorway. Their questions wait until they are actually here.');return true;}
  const from=id.startsWith('care:bring:')?'inventory':'copper',item=id.slice(id.lastIndexOf(':')+1),source=from==='inventory'?s.inventory:s.horse.pack,field=item==='blankets'?'blankets':'food';
  if(!(source[item]>0)||(s.camp[field]||0)>=1)return false;
  q.fetches.push({serial:q.fetches.length+1,item,from,at:s.elapsed,position:point(player(s)),sourcePosition:point(from==='copper'?s.horse:W.camp.ledger),stockBefore:source[item],campBefore:s.camp[field]||0});source[item]--;s.camp[field]=(s.camp[field]||0)+1;ctx.notice(s,'One actual owned provision was brought back. Return to Levi to decide what is provided.');return true;
}
function finishCare(s,mode,ctx){
  const r=record(s),q=r.rival.questioning,n=stock(s);if(q.care||r.transactions[key('care:levi')])return false;
  const food=mode==='deprive'||mode==='assurance'?0:n.food>=1?1:0,blanket=mode==='deprive'||mode==='assurance'?0:n.blankets>=1?1:0;
  if(mode==='full'&&(!food||!blanket)||mode==='partial'&&food+blanket!==1||mode==='assurance'&&(n.food>=1||n.blankets>=1))return false;
  q.care={mode,foodUsed:food,blanketUsed:blanket,foodBefore:n.food,blanketsBefore:n.blankets,foodAfter:n.food-food,blanketsAfter:n.blankets-blanket,at:s.elapsed,actorId:'mara'};
  s.camp.food-=food;s.camp.blankets=(s.camp.blankets||0)-blanket;r.choices.care=mode==='deprive'?'deprive':'care';
  if(mode==='deprive'){r.captivity.cruelty+=2;s.honor-=3;}else{const benefit=mode==='full'?2:1;r.captivity.trust+=benefit;s.honor+=benefit;}
  r.transactions[key('care:levi')]={completed:true,actorId:'mara',at:s.elapsed,foodUsed:food,blanketUsed:blanket};
  actor(s,'levi').blanket=!!blanket;actor(s,'levi').initialHoldingBinding=mode==='deprive'?'tight':'loose';r.captivity.guardId='bastian';
  setGoal(actor(s,'bastian'),{x:W.camp.holding.x+30,y:W.camp.holding.y,z:0});setGoal(actor(s,'della'),W.camp.ledger);
  q.phase='done';q.cursor=null;s.dialog=null;r.mission.stage=13;r.mission.objective=RIVAL_STAGES[13];
  ctx.present(s,'care',point(actor(s,'levi')),'levi',point(player(s)),'mara',{sourceId:'mara'});ctx.checkpoint(s,'guarded-hold','Spoken testimony and the actual provided or unavailable care recorded');return true;
}
export function chooseQuestioning(s,id,ctx){
  if(!s.dialog?.id?.startsWith('rival-questioning-'))return false;
  if(!validateQuestioningDialog(s)||!s.dialog.choices.some(choice=>choice.id===id))return false;
  const r=record(s),q=r.rival.questioning,line=q.cursor;
  if(id==='question:leave'){s.dialog=null;return true;}
  if(id==='care:return'){q.cursor='care';show(s,ctx);return true;}
  if(line==='care'||line==='noStock'){
    careSpeech(s,line);
    if(id==='care-levi'&&(stock(s).food<1||stock(s).blankets<1)){q.cursor='noStock';show(s,ctx);return true;}
    if(id==='deprive-levi'){q.cursor='deprivation';show(s,ctx);return true;}
    if(id==='care:assure'){q.cursor='assurance';show(s,ctx);return true;}
    if(id==='care-levi'||id==='care:partial')return finishCare(s,id==='care-levi'?'full':'partial',ctx);
  }
  if(line==='assurance'){careSpeech(s,line);return finishCare(s,'assurance',ctx);}
  if(line==='deprivation'){careSpeech(s,line);q.cursor='deprivationResponse';show(s,ctx);return true;}
  if(line==='deprivationResponse'){careSpeech(s,line);return finishCare(s,'deprive',ctx);}
  receipt(s,line);
  if(line==='leviCard')r.captivity.questions.card=true;
  if(line==='signatureAnswer')r.captivity.questions.signatures=true;
  if(line==='coercion'){q.objection=id==='question:object';q.cursor=q.objection?'objection':'temporaryHold';}
  else if(line==='objection')q.cursor='temporaryHold';
  else if(line==='temporaryHold'){q.finishedAt=s.elapsed;q.phase='care';q.cursor='care';r.flags.questioned=true;r.captivity.guardId='bastian';}
  else q.cursor=required[required.indexOf(line)+1];
  show(s,ctx);return true;
}
export function validateQuestioningDialog(s){
  const d=s.dialog;if(!d?.id?.startsWith('rival-questioning-'))return true;
  const r=record(s),q=r?.rival.questioning;if(!available(s)||!q||!councilReady(s)||!near(player(s),W.camp.holding,65)||!evidence(r))return false;
  const line=d.id.slice('rival-questioning-'.length),who=speakers[line],body=actor(s,who),expected=choices(s,line);
  const exactText=d.text===text(s,line)||line==='noStock'&&d.text===text(s,line,true);
  return q.cursor===line&&body?.hp>0&&body.name===D[line]?.speaker&&near(player(s),body,65)&&d.speaker===D[line].speaker&&exactText&&Array.isArray(d.choices)&&d.choices.length===expected.length&&d.choices.every((choice,index)=>choice.id===expected[index][0]&&choice.label===expected[index][1]);
}
export function validateQuestioning(s){
  if(usesRivalContinuation(s)&&record(s).rival.continuation?.initializedAt!==null){if(!validateRivalContinuation(s))return false;s=rivalHistoricalValidationState(s);}
  const r=record(s),q=r.rival.questioning,transactions=Object.entries(r.transactions).filter(([id])=>id.startsWith(key('question:')));
  if(!object(r.captivity))return false;
  const guardPresent=Object.hasOwn(r.captivity,'guardId'),ordered=r.transactions[key('question:temporaryHold')]?.completed===true;
  if(guardPresent&&(r.captivity.guardId!=='bastian'||!r.flags.bound||!r.flags.held))return false;
  if(usesQuestioningContract(r)&&(ordered?r.captivity.guardId!=='bastian':guardPresent))return false;
  if(!usesQuestioningContract(r))return [undefined,2].includes(r.rival.contractVersion)&&r.rival.questioningVersion===undefined&&q===undefined&&!transactions.length;
  if(!object(q))return false;
  if(q.phase==='unstarted'){const empty=createRivalQuestioning();return Object.keys(q).length===Object.keys(empty).length&&Object.entries(empty).every(([key,value])=>Array.isArray(value)?Array.isArray(q[key])&&q[key].length===0:q[key]===value)&&!r.flags.questioned&&r.choices.care===null&&!r.captivity.questions.card&&!r.captivity.questions.signatures&&!transactions.length&&r.mission.stage<=12;}
  if(!object(q)||q.schema!==1||!finite(q.startedAt)||q.startedAt<0||q.startedAt>s.elapsed||!['assembling','questioning','care','done'].includes(q.phase)||!Array.isArray(q.seen)||!Array.isArray(q.careSeen)||q.careSeen.length>5||!Array.isArray(q.fetches)||q.fetches.length>99||!object(q.initialStock)||!['food','blankets'].every(field=>finite(q.initialStock[field])&&q.initialStock[field]>=0)||![null,true,false].includes(q.objection)||!evidence(r))return false;
  const order=[...required.slice(0,6),...(q.objection===true?['objection']:[]),'temporaryHold'];
  if(heard(q,'coercion')?(q.objection!==true&&q.objection!==false):q.objection!==null)return false;
  if(q.seen.length>order.length||q.seen.some((entry,index)=>entry.lineId!==order[index]||entry.actorId!==speakers[entry.lineId]||!finite(entry.at)||entry.at<q.startedAt||entry.at>s.elapsed||index&&entry.at<q.seen[index-1].at||!validPoint(entry.position)||!validPoint(entry.playerPosition)||!near(entry.playerPosition,W.camp.holding,65)||!near(entry.position,entry.actorId==='mara'?entry.playerPosition:entry.actorId==='levi'?W.camp.holding:QUESTIONING_ANCHORS[entry.actorId],15)||!near(entry.position,entry.playerPosition,65)))return false;
  if(transactions.length!==q.seen.length||q.seen.some(entry=>{const t=r.transactions[key(`question:${entry.lineId}`)];return !t||t.completed!==true||t.actorId!==entry.actorId||t.at!==entry.at;})||transactions.some(([id])=>!QUESTIONING_TRANSACTION_KEYS.includes(id.slice(RIVAL_ID.length+1))))return false;
  const finished=q.seen.length===order.length;
  if(!finished&&q.cursor!==order[q.seen.length]||q.phase==='assembling'&&q.seen.length)return false;
  if(r.captivity.questions.card!==heard(q,'leviCard')||r.captivity.questions.signatures!==heard(q,'signatureAnswer')||r.flags.questioned!==finished||finished!==(q.finishedAt!==null)||finished&&q.finishedAt!==q.seen.at(-1).at||!finished&&q.phase!=='assembling'&&q.phase!=='questioning')return false;
  if(q.fetches.some((fetch,index)=>fetch.serial!==index+1||!['broth','oats','blankets'].includes(fetch.item)||!['inventory','copper'].includes(fetch.from)||!finite(fetch.at)||fetch.at<q.finishedAt||fetch.at>s.elapsed||!Number.isInteger(fetch.stockBefore)||fetch.stockBefore<1||!finite(fetch.campBefore)||fetch.campBefore<0||fetch.campBefore>=1||!validPoint(fetch.position)||!validPoint(fetch.sourcePosition)||!near(fetch.position,fetch.sourcePosition,fetch.from==='inventory'?55:58)||fetch.from==='inventory'&&!near(fetch.sourcePosition,W.camp.ledger,1)))return false;
  if(new Set(q.careSeen.map(entry=>entry.lineId)).size!==q.careSeen.length||q.careSeen.some((entry,index)=>!['care','noStock','assurance','deprivation','deprivationResponse'].includes(entry.lineId)||entry.actorId!==speakers[entry.lineId]||!finished||!finite(entry.at)||entry.at<q.finishedAt||entry.at>s.elapsed||index&&entry.at<q.careSeen[index-1].at||!validPoint(entry.position)||!validPoint(entry.playerPosition)||!near(entry.playerPosition,W.camp.holding,65)||!near(entry.position,entry.actorId==='mara'?entry.playerPosition:entry.actorId==='levi'?W.camp.holding:QUESTIONING_ANCHORS[entry.actorId],15)||!near(entry.position,entry.playerPosition,65)))return false;
  if(q.careSeen.length&&q.careSeen[0].lineId!=='care'||q.careSeen.some(entry=>entry.lineId==='deprivationResponse')&&q.careSeen.findIndex(entry=>entry.lineId==='deprivation')<0)return false;
  if(!q.care)return r.choices.care===null&&!r.transactions[key('care:levi')]&&r.mission.stage===12&&q.phase!=='done'&&(!finished||['care','noStock','assurance','deprivation','deprivationResponse'].includes(q.cursor))&&validateQuestioningDialog(s);
  const c=q.care,t=r.transactions[key('care:levi')];if(!finished||q.phase!=='done'||q.cursor!==null||r.mission.stage<13||!['full','partial','assurance','deprive'].includes(c.mode)||c.actorId!=='mara'||!finite(c.at)||c.at<q.finishedAt||c.at>s.elapsed||![0,1].includes(c.foodUsed)||![0,1].includes(c.blanketUsed)||!finite(c.foodBefore)||!finite(c.blanketsBefore)||c.foodBefore<c.foodUsed||c.blanketsBefore<c.blanketUsed||c.foodAfter!==c.foodBefore-c.foodUsed||c.blanketsAfter!==c.blanketsBefore-c.blanketUsed||!t||t.actorId!=='mara'||t.at!==c.at||t.foodUsed!==c.foodUsed||t.blanketUsed!==c.blanketUsed)return false;
  if(c.mode==='full'&&(c.foodUsed!==1||c.blanketUsed!==1)||c.mode==='partial'&&(c.foodUsed+c.blanketUsed!==1||c.foodUsed!==Number(c.foodBefore>=1)||c.blanketUsed!==Number(c.blanketsBefore>=1))||c.mode==='assurance'&&(c.foodBefore>=1||c.blanketsBefore>=1)||['assurance','deprive'].includes(c.mode)&&(c.foodUsed||c.blanketUsed)||r.choices.care!==(c.mode==='deprive'?'deprive':'care'))return false;
  if(!q.careSeen.some(entry=>entry.lineId==='care')||c.mode==='assurance'&&!q.careSeen.some(entry=>entry.lineId==='assurance')||c.mode==='deprive'&&!['deprivation','deprivationResponse'].every(line=>q.careSeen.some(entry=>entry.lineId===line))||q.careSeen.some(entry=>entry.at>c.at))return false;
  if(c.foodBefore>q.initialStock.food+q.fetches.filter(f=>f.item!=='blankets').length||c.blanketsBefore>q.initialStock.blankets+q.fetches.filter(f=>f.item==='blankets').length||actor(s,'levi').blanket!==!!c.blanketUsed||actor(s,'levi').initialHoldingBinding!==(c.mode==='deprive'?'tight':'loose'))return false;
  return true;
}
