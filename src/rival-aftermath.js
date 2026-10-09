/** Persistent original holding-room visits. Source camp-window acceptance is open. */
import {RIVAL_ID,RIVAL_WORLD as W} from '../content/campaign/bellwether-works.js';
import {initialQuestioningCare} from './rival-questioning.js';
import {usesRivalContinuation,validateRivalContinuation,rivalHistoricalValidationState} from './rival-continuation.js';
const HUNT='snowbound-a-quiet-table',TRAIN='campaign-who-the-hell-is-leviticus-cornwall';
const record=s=>s?.campaign?.missions?.[RIVAL_ID],holding=s=>record(s)?.aftermath?.holding;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const clone=v=>JSON.parse(JSON.stringify(v)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const actor=(s,id)=>s.entities?.[id],player=s=>actor(s,s.party?.playerId||'mara')||s.player;
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
const txid=key=>`${RIVAL_ID}:${key}`;
export const HOLDING_TRANSACTION_KEYS=['holding:first-reassure','holding:first-food','holding:first-denial','holding:first-check','holding:first-finish','holding:borrow-papers','holding:second-route','holding:second-list','holding:second-card','holding:second-compare','holding:second-finish'];
const has=(r,key)=>r.transactions?.[txid(key)]?.completed===true;
function held(s){const r=record(s),a=actor(s,'levi');return !!r?.flags?.held&&r.flags.bound&&a?.id==='levi'&&a.name==='Levi Senn'&&a.hp>0&&a.bound===true&&a.attachment?.type==='rest'&&a.attachment.targetId===W.camp.holding.id&&a.attachment.regionId==='snowbound';}
function finalized(s){const r=record(s);return held(s)&&r.mission?.stage===13&&r.flags.accounted&&r.flags.chargesStored&&r.aftermath?.captiveId==='levi'&&['care','deprive'].includes(r.choices?.care)&&has(r,'complete:account')&&has(r,'care:levi');}
function close(s,radius=34){const p=player(s);return p?.id==='mara'&&p.name==='Mara Vale'&&p.hp>0&&s.region==='snowbound'&&distance(p,W.camp.holding)<=radius&&Math.abs(p.z||0)<8;}
function windowOpen(s){const r=record(s),hunt=s.campaign?.missions?.[HUNT];return r?.mission.completed&&r.status==='completed'&&hunt&&!hunt.mission.completed&&['unstarted','active'].includes(hunt.status)&&!Object.values(s.campaign.missions).some(m=>m.sourceRequirementId===TRAIN&&['active','completed'].includes(m.status))&&held(s);}
function documents(s,owner){const r=record(s);return ['route-diagram','seizure-list'].every(id=>r?.objects?.[id]?.owner===owner&&r.objects[id].location?.type==='carried'&&r.objects[id].location.targetId===owner);}
function debtCard(s){const o=record(s)?.objects?.['levi-debt-card'];return o?.id==='levi-debt-card'&&o.owner==='levi'&&o.location?.type==='carried'&&o.location.targetId==='levi';}
function transaction(s,key,apply){const r=record(s);if(has(r,key))return false;if(apply()===false)return false;r.transactions[txid(key)]={completed:true,actorId:'levi',at:s.elapsed};return true;}
function event(s,key,details={}){holding(s).careHistory.push({id:txid(key),at:s.elapsed,actorId:'levi',...details});}
function present(s,ctx,kind='care'){const p=player(s),a=actor(s,'levi');ctx?.present?.(s,kind,{x:a.x,y:a.y,z:a.z||0},'levi',{x:p.x,y:p.y,z:p.z||0,facing:p.facing||0},'mara',{sourceId:'mara'});}
function talk(s,ctx,id,speaker,text,choices){ctx.talk(s,`rival-holding-${id}`,speaker,text,choices);}

export function initializeHolding(s){
  const r=record(s);if(!finalized(s))return false;if(holding(s))return holding(s);
  const initial=initialQuestioningCare(r),c=r.captivity;if(!initial)return false;
  Object.assign(c,{holdingHours:0,withholdingHours:0,hunger:0,restraint:initial.restraint,care:{mealCount:initial.foodUsed,blanketCount:initial.blanketUsed,lastMealAt:null,provisions:initial.provisions}});
  r.aftermath.holding={schema:1,initializedAt:s.elapsed,lastAdvancedAt:s.elapsed,initialTrust:c.trust,
    visit1:{startedAt:null,finishedAt:null,reassured:false,foodGiven:false,denialHeard:false,breathingChecked:false,completed:false},
    visit2:{startedAt:null,finishedAt:null,borrowed:false,routeRead:false,listRead:false,cardRead:false,comparison:null,completed:false},
    careHistory:[],testimony:[]};
  // A distinct old work scar is original Levi character authoring, not a new
  // injury, cure, transferred patient scar or consequence invented on migration.
  actor(s,'levi').farrierScar={site:'left-thumb-web',kind:'old-tool-burn',actorId:'levi'};
  return r.aftermath.holding;
}
export function advanceRivalHolding(s,dt,ctx){
  const r=record(s),h=holding(s);if(!h||!r.mission.completed||!held(s)||((s.dialog||s.failure)&&!ctx?.acceptedWorldStep)||!finite(dt)||dt<=0||!finite(s.elapsed))return s;
  // The main story owns elapsed. Repeated hooks at the same world time cannot
  // age the captive twice; replay replaces this complete record with its branch.
  const seconds=Math.min(dt,Math.max(0,s.elapsed-h.lastAdvancedAt));if(seconds<=0)return s;h.lastAdvancedAt=s.elapsed;
  const c=r.captivity,hours=seconds/80;c.holdingHours+=hours;if(c.care.provisions==='withheld')c.withholdingHours+=hours;
  c.hunger=clamp(c.hunger+hours*(c.care.mealCount>0?8:12),0,100);
  const levi=actor(s,'levi');if(c.restraint==='tight'&&c.holdingHours>=.25&&!levi.holdingWristMarks){levi.holdingWristMarks={kind:'binding-pressure',actorId:'levi',firstSeenAt:s.elapsed};ctx?.log?.(s,'Levi’s tight holding bindings have left visible wrist pressure marks.');}
  return s;
}
function offer(s,id,label,target,radius,priority){const p=player(s);return p?.id==='mara'&&p.name==='Mara Vale'&&p.hp>0&&s.region==='snowbound'&&target&&distance(p,target)<=radius&&Math.abs((p.z||0)-(target.z||0))<8?{id,label,targetId:target.id||'levi',x:target.x,y:target.y,z:target.z||0,distance:distance(p,target),priority}:null;}
export function getHoldingInteractions(s){
  if(s.dialog||s.failure||!windowOpen(s)||!holding(s)||!validateHolding(s))return [];
  const h=holding(s),list=[];
  if(!h.visit1.completed)list.push(offer(s,'holding:first-visit','Visit Levi: food, restraints and his own account',actor(s,'levi'),34,-4));
  if(h.visit1.completed&&!h.visit2.completed&&s.elapsed>=h.visit1.finishedAt+8){
    const tomas=actor(s,'tomas');
    if(!h.visit2.borrowed&&tomas?.id==='tomas'&&tomas.name==='Tomas Reed'&&tomas.hp>0&&tomas.regionId==='snowbound'&&documents(s,'tomas'))list.push(offer(s,'holding:borrow-papers','Borrow Tomas’s actual diagram and seizure list for Levi’s account',tomas,45,-4));
    if(h.visit2.borrowed&&documents(s,'mara')&&debtCard(s))list.push(offer(s,'holding:second-visit','Visit Levi: compare the three recovered documents',actor(s,'levi'),34,-4));
  }
  return list.filter(Boolean);
}
const firstChoices=s=>[
  ['holding-reassure','Promise to check the warrants while the guard stays.'],
  [holding(s).visit1.foodGiven?'holding-food-record':'holding-feed',holding(s).visit1.foodGiven?'Read the single counted food entry.':'Give Levi one actual camp food portion.'],
  ['holding-denial','Ask why the Claimant coat was not a choice.'],
  ['holding-check','Check breathing and loosen the wrist binding.'],
  ['holding-first-finish','Finish this first holding-room visit.'],['holding-pause','Leave and return to this unfinished visit.'],
];
const secondChoices=[['holding-read-route','Read the recovered route diagram.'],['holding-read-list','Read the recovered seizure list.'],['holding-read-card','Read Levi’s actual torn payment card.'],['holding-compare','Compare the statement with all three documents.'],['holding-second-finish','Finish the second testimony visit.'],['holding-pause','Leave and return to this unfinished visit.']];
const returns1=[['holding-first-return','Return to the first visit.']],returns2=[['holding-second-return','Return to the testimony visit.']];
const texts={
  first:'The guard is still by the doorway. Levi shows the old burn between his left thumb and forefinger: “That came from a farrier’s tool, before Calder bought our arrears. You can guard this coat without pretending it chose the work.”',
  reassurance:'“A checked account is a narrower promise than release,” Levi says. “I can hold you to that one. Let the witness sheet answer what neither of us saw.”',
  food:'Levi receives one portion from the counted camp stock. “A bowl does not buy you a confession. It does let me answer without thinking only about the next mouthful.” The guard remains.',
  shortage:'The camp has no counted food portion to give. Mara records the shortage without inventing a bowl. Levi remains a person needing food, and this visit can continue without a false gift.',
  denial:'“Calder bought our arrears, then issued the coat with the copying work,” Levi says. “I wrote the hand. That does not make the extra debt true, and it does not tell you whose signature was on the loose sheet.”',
  check:'Mara checks Levi’s breathing beside the actual holding bench and loosens the wrist binding. The old farrier burn and any pressure marks remain distinct. Levi stays bound under guard; easier breathing is not release.',
  second:'Mara brings the borrowed route diagram and seizure list to Levi’s own torn card. “I can identify the copying hand and a road I walked,” he says. “I cannot become the witness Calder left off the sheet.”',
  route:'The actual route diagram marks survey chains and says the creek spur takes wagons rather than the full locomotive. Levi remembers walking that spur to replace a wagon shoe. The distance is corroborated; Calder’s success is not predicted.',
  list:'The recovered seizure list repeats a seventeen-unit demand beside Senn’s forty-one paid. The copied account is evidence of the duplicate demand. Levi’s description of the original loose sheet remains unverified.',
  card:'Levi’s actual card keeps his name and the forty-one paid despite its torn witness line. The later seventeen agrees with the duplicate list. The surviving card does not reveal who signed the absent witness sheet.',
  compare:'The sums agree across the card and seizure list; the route’s scale agrees with the walked spur. Neither comparison proves that Levi chose the copying work or identifies a signature he never saw.',
  recorded:'Della’s account distinguishes matching sums and distances from an uncertain witness. Levi’s statements remain his statements. A guard remains while the original signature sheet is sought.',
  pressured:'Mara demands a confession from the copied hand. Levi agrees that the hand was his but gives no new witness name. The account marks this answer as pressured; coercion adds no corroborating document.',
};
function first(s,ctx){talk(s,ctx,'first','Levi Senn',texts.first,firstChoices(s));}
function second(s,ctx){talk(s,ctx,'second','Levi Senn',texts.second,secondChoices);}
export function interactHolding(s,id,ctx){
  if(!getHoldingInteractions(s).some(o=>o.id===id))return false;
  const h=holding(s);
  if(id==='holding:first-visit'){if(h.visit1.startedAt===null)h.visit1.startedAt=s.elapsed;first(s,ctx);}
  else if(id==='holding:borrow-papers'){
    transaction(s,'holding:borrow-papers',()=>{for(const id of ['route-diagram','seizure-list']){const o=record(s).objects[id];o.owner='mara';o.location={type:'carried',targetId:'mara'};}h.visit2.borrowed=true;return true;});
    const p=player(s),t=actor(s,'tomas');ctx?.present?.(s,'give-plans',p,'route-diagram',{x:t.x,y:t.y,z:t.z||0,facing:t.facing||0},'tomas',{sourceId:'tomas'});ctx?.notice?.(s,'The actual diagram and seizure list are now carried by Mara for comparison, with their original identities.');
  }else if(id==='holding:second-visit'){if(h.visit2.startedAt===null)h.visit2.startedAt=s.elapsed;second(s,ctx);}
  return true;
}
const claims={
  route:{id:'pulley-distance',claim:'The creek spur carries wagons, not a full locomotive.',evidenceIds:['route-diagram'],reliability:'corroborated-distance'},
  list:{id:'duplicate-demand',claim:'Seventeen was demanded again beside forty-one already paid.',evidenceIds:['seizure-list','levi-debt-card'],reliability:'corroborated-sum'},
  card:{id:'absent-witness',claim:'Levi copied the hand but did not see the original signatures.',evidenceIds:['levi-debt-card'],reliability:'uncertain'},
};
export function chooseHolding(s,id,ctx){
  if(!s.dialog?.id?.startsWith('rival-holding-')||!validateHolding(s)||!s.dialog?.choices.some(c=>c.id===id))return false;
  const h=holding(s),r=record(s),c=r.captivity;
  if(id==='holding-pause'){s.dialog=null;return true;}
  if(id==='holding-first-return'){first(s,ctx);return true;}if(id==='holding-second-return'){second(s,ctx);return true;}
  if(id==='holding-reassure'){transaction(s,'holding:first-reassure',()=>{h.visit1.reassured=true;c.trust++;event(s,'holding:first-reassure',{kind:'reassurance',foodUsed:0});});talk(s,ctx,'reassurance','Levi Senn',texts.reassurance,returns1);}
  else if(id==='holding-feed'||id==='holding-food-record'){
    if(!h.visit1.foodGiven&&(s.camp.food||0)<1){talk(s,ctx,'shortage','Mara Vale',texts.shortage,returns1);return true;}
    if(!h.visit1.foodGiven)transaction(s,'holding:first-food',()=>{const before=c.hunger;s.camp.food--;h.visit1.foodGiven=true;c.care.mealCount++;c.care.lastMealAt=s.elapsed;c.care.provisions='limited';c.hunger=Math.max(0,c.hunger-35);c.trust++;event(s,'holding:first-food',{kind:'food',foodUsed:1,holdingHours:c.holdingHours,hungerBefore:before,hungerAfter:c.hunger});present(s,ctx,'eat');});
    talk(s,ctx,'food','Levi Senn',texts.food,returns1);
  }else if(id==='holding-denial'){transaction(s,'holding:first-denial',()=>{h.visit1.denialHeard=true;event(s,'holding:first-denial',{kind:'denial',foodUsed:0});});talk(s,ctx,'denial','Levi Senn',texts.denial,returns1);}
  else if(id==='holding-check'){transaction(s,'holding:first-check',()=>{h.visit1.breathingChecked=true;c.restraint='loose';event(s,'holding:first-check',{kind:'binding-care',foodUsed:0});present(s,ctx);});talk(s,ctx,'check','Mara Vale',texts.check,returns1);}
  else if(id==='holding-first-finish'){
    if(!h.visit1.reassured||!h.visit1.denialHeard||!h.visit1.breathingChecked){ctx?.notice?.(s,'Hear Levi’s denial, make the conditional promise and check his breathing before finishing this visit. Food remains a separate stock-backed choice.');return false;}
    transaction(s,'holding:first-finish',()=>{h.visit1.completed=true;h.visit1.finishedAt=s.elapsed;});s.dialog=null;
  }else if(id.startsWith('holding-read-')){
    const kind=id.slice(13);if(!claims[kind])return false;
    transaction(s,`holding:second-${kind}`,()=>{h.visit2[`${kind}Read`]=true;h.testimony.push({...clone(claims[kind]),actorId:'levi',at:s.elapsed});});talk(s,ctx,kind,'Levi Senn',texts[kind],returns2);
  }else if(id==='holding-compare'){
    if(!h.visit2.routeRead||!h.visit2.listRead||!h.visit2.cardRead){ctx?.notice?.(s,'Read the actual diagram, list and torn card before comparing the statement.');return false;}
    talk(s,ctx,'compare','Mara Vale',texts.compare,[['holding-record-matches','Record matching facts and keep the witness uncertain.'],['holding-demand-confession','Demand a confession from the copied hand.'],['holding-second-return','Return to the testimony visit.']]);
  }else if(id==='holding-record-matches'||id==='holding-demand-confession'){
    transaction(s,'holding:second-compare',()=>{h.visit2.comparison=id==='holding-record-matches'?'corroborated-facts':'pressured-answer';if(id==='holding-demand-confession'){c.trust--;c.cruelty++;s.honor=(s.honor||0)-1;}h.testimony.push({id:'comparison-account',actorId:'levi',at:s.elapsed,evidenceIds:['route-diagram','seizure-list','levi-debt-card'],reliability:h.visit2.comparison,claim:'Matching sums and distance do not establish voluntary copying or an unseen witness.'});});
    const pressured=h.visit2.comparison==='pressured-answer';talk(s,ctx,pressured?'pressured':'recorded',pressured?'Levi Senn':'Mara Vale',texts[pressured?'pressured':'recorded'],returns2);
  }else if(id==='holding-second-finish'){
    if(!h.visit2.comparison||!h.visit2.routeRead||!h.visit2.listRead||!h.visit2.cardRead){ctx?.notice?.(s,'Complete the separate document comparison before closing this testimony visit.');return false;}
    transaction(s,'holding:second-finish',()=>{h.visit2.completed=true;h.visit2.finishedAt=s.elapsed;});s.dialog=null;
  }else return false;
  return true;
}
const exact=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every((c,i)=>c?.id===expected[i][0]&&c.label===expected[i][1]);
export function validateHoldingDialog(s){
  const d=s.dialog;if(!d?.id?.startsWith('rival-holding-'))return true;
  const h=holding(s);if(!h||!windowOpen(s)||!close(s)||s.failure)return false;
  const id=d.id.slice(14),firstIds=['first','reassurance','food','shortage','denial','check'],secondIds=['second','route','list','card','compare','recorded','pressured'];
  if(firstIds.includes(id)&&(!h.visit1.startedAt&&h.visit1.startedAt!==0||h.visit1.completed))return false;
  if(secondIds.includes(id)&&(!h.visit1.completed||h.visit2.startedAt===null||h.visit2.completed||!h.visit2.borrowed||!documents(s,'mara')||!debtCard(s)))return false;
  const speaker=['shortage','check','compare','recorded'].includes(id)?'Mara Vale':'Levi Senn';
  const choices=id==='first'?firstChoices(s):id==='second'?secondChoices:id==='compare'?[['holding-record-matches','Record matching facts and keep the witness uncertain.'],['holding-demand-confession','Demand a confession from the copied hand.'],['holding-second-return','Return to the testimony visit.']]:firstIds.includes(id)?returns1:returns2;
  const gate={first:true,reassurance:h.visit1.reassured,food:h.visit1.foodGiven,shortage:!h.visit1.foodGiven&&(s.camp.food||0)<1,denial:h.visit1.denialHeard,check:h.visit1.breathingChecked,second:true,route:h.visit2.routeRead,list:h.visit2.listRead,card:h.visit2.cardRead,compare:h.visit2.routeRead&&h.visit2.listRead&&h.visit2.cardRead,recorded:h.visit2.comparison==='corroborated-facts',pressured:h.visit2.comparison==='pressured-answer'}[id];
  return !!gate&&d.speaker===speaker&&d.text===texts[id]&&exact(d.choices,choices);
}
export function validateHolding(s){
  if(usesRivalContinuation(s)&&record(s).rival.continuation?.initializedAt!==null){if(!validateRivalContinuation(s))return false;s=rivalHistoricalValidationState(s);}
  const r=record(s),h=holding(s);if(!r)return true;
  if(!h)return !finalized(s)&&!['holdingHours','withholdingHours','hunger','restraint','care'].some(key=>Object.hasOwn(r.captivity||{},key));
  if(!finalized(s)||h.schema!==1||!finite(h.initializedAt)||!finite(h.lastAdvancedAt)||h.initializedAt<0||h.lastAdvancedAt<h.initializedAt||h.lastAdvancedAt>s.elapsed||!finite(h.initialTrust))return false;
  const c=r.captivity;if(!['holdingHours','withholdingHours','hunger'].every(key=>finite(c[key])&&c[key]>=0)||c.withholdingHours>c.holdingHours+1e-8||c.holdingHours>(s.elapsed-h.initializedAt)/80+1e-8||c.hunger>100||!['loose','tight'].includes(c.restraint)||!object(c.care))return false;
  const v1=h.visit1,v2=h.visit2;if(!object(v1)||Object.keys(v1).length!==7||!object(v2)||Object.keys(v2).length!==8||!Array.isArray(h.careHistory)||!Array.isArray(h.testimony)||h.careHistory.length>4||h.testimony.length>4)return false;
  for(const [v,flags]of [[v1,['reassured','foodGiven','denialHeard','breathingChecked','completed']],[v2,['borrowed','routeRead','listRead','cardRead','completed']]])if(flags.some(key=>typeof v[key]!=='boolean')||['startedAt','finishedAt'].some(key=>v[key]!==null&&(!finite(v[key])||v[key]<h.initializedAt||v[key]>s.elapsed))||v.completed!==(v.finishedAt!==null)||v.completed&&v.startedAt===null)return false;
  if(![null,'corroborated-facts','pressured-answer'].includes(v2.comparison)||v1.completed&&(!v1.reassured||!v1.denialHeard||!v1.breathingChecked)||v2.completed&&(!v1.completed||!v2.routeRead||!v2.listRead||!v2.cardRead||!v2.comparison)||v2.startedAt!==null&&(!v1.completed||v2.startedAt<v1.finishedAt+8))return false;
  const mappings=[[v1.reassured,'holding:first-reassure'],[v1.foodGiven,'holding:first-food'],[v1.denialHeard,'holding:first-denial'],[v1.breathingChecked,'holding:first-check'],[v1.completed,'holding:first-finish'],[v2.borrowed,'holding:borrow-papers'],[v2.routeRead,'holding:second-route'],[v2.listRead,'holding:second-list'],[v2.cardRead,'holding:second-card'],[!!v2.comparison,'holding:second-compare'],[v2.completed,'holding:second-finish']];
  if(mappings.some(([flag,key])=>flag!==has(r,key)))return false;
  if(Object.entries(r.transactions).some(([id,t])=>id.startsWith(txid('holding:'))&&(!HOLDING_TRANSACTION_KEYS.includes(id.slice(RIVAL_ID.length+1))||t.actorId!=='levi'||!finite(t.at)||t.at<h.initializedAt||t.at>s.elapsed)))return false;
  if(v1.startedAt===null&&[v1.reassured,v1.foodGiven,v1.denialHeard,v1.breathingChecked,v1.completed].some(Boolean)||v2.startedAt===null&&[v2.routeRead,v2.listRead,v2.cardRead,!!v2.comparison,v2.completed].some(Boolean))return false;
  if(v1.completed&&v1.finishedAt!==r.transactions[txid('holding:first-finish')].at||v2.completed&&v2.finishedAt!==r.transactions[txid('holding:second-finish')].at||v2.borrowed&&r.transactions[txid('holding:borrow-papers')].at<v1.finishedAt+8)return false;
  if(Object.entries(r.transactions).some(([id,t])=>id.startsWith(txid('holding:first-'))&&(t.at<v1.startedAt||v1.completed&&t.at>v1.finishedAt)||id.startsWith(txid('holding:second-'))&&(t.at<v2.startedAt||v2.completed&&t.at>v2.finishedAt)))return false;
  const initial=initialQuestioningCare(r);if(!initial)return false;const initialCare=!initial.deprived;if(c.care.mealCount!==initial.foodUsed+(v1.foodGiven?1:0)||c.care.blanketCount!==initial.blanketUsed||c.care.provisions!==(v1.foodGiven?'limited':initial.provisions)||c.care.lastMealAt!==(v1.foodGiven?r.transactions[txid('holding:first-food')].at:null)||c.restraint!==(initialCare||v1.breathingChecked?'loose':'tight')||c.trust!==h.initialTrust+(v1.reassured?1:0)+(v1.foodGiven?1:0)-(v2.comparison==='pressured-answer'?1:0))return false;
  const expectedCare=[['reassured','holding:first-reassure','reassurance',0],['foodGiven','holding:first-food','food',1],['denialHeard','holding:first-denial','denial',0],['breathingChecked','holding:first-check','binding-care',0]].filter(([key])=>v1[key]);
  if(h.careHistory.length!==expectedCare.length||new Set(h.careHistory.map(e=>e.id)).size!==h.careHistory.length||expectedCare.some(([,key,kind,food])=>!h.careHistory.some(e=>e.id===txid(key)&&e.kind===kind&&e.foodUsed===food&&e.actorId==='levi'&&e.at===r.transactions[txid(key)].at)))return false;
  const meal=h.careHistory.find(e=>e.kind==='food'),rate=initial.foodUsed?8:12;
  if(meal&&(!finite(meal.holdingHours)||meal.holdingHours<0||meal.holdingHours>c.holdingHours||Math.abs(meal.hungerBefore-clamp(meal.holdingHours*rate,0,100))>1e-7||Math.abs(meal.hungerAfter-Math.max(0,meal.hungerBefore-35))>1e-7))return false;
  const expectedHunger=meal?clamp(meal.hungerAfter+(c.holdingHours-meal.holdingHours)*8,0,100):clamp(c.holdingHours*rate,0,100),expectedWithholding=initialCare?0:meal?meal.holdingHours:c.holdingHours;
  if(Math.abs(c.hunger-expectedHunger)>1e-7||Math.abs(c.withholdingHours-expectedWithholding)>1e-7)return false;
  for(const[kind,claim]of Object.entries(claims)){const entries=h.testimony.filter(e=>e.id===claim.id);if(entries.length!==(v2[`${kind}Read`]?1:0)||entries.some(e=>e.actorId!=='levi'||e.claim!==claim.claim||e.reliability!==claim.reliability||JSON.stringify(e.evidenceIds)!==JSON.stringify(claim.evidenceIds)||e.at!==r.transactions[txid(`holding:second-${kind}`)]?.at))return false;}
  const comparisons=h.testimony.filter(e=>e.id==='comparison-account');if(comparisons.length!==(v2.comparison?1:0)||h.testimony.length!==[v2.routeRead,v2.listRead,v2.cardRead,!!v2.comparison].filter(Boolean).length||comparisons.some(e=>e.actorId!=='levi'||e.reliability!==v2.comparison||e.claim!=='Matching sums and distance do not establish voluntary copying or an unseen witness.'||e.at!==r.transactions[txid('holding:second-compare')]?.at||JSON.stringify(e.evidenceIds)!==JSON.stringify(['route-diagram','seizure-list','levi-debt-card'])))return false;
  if(v2.borrowed&&!documents(s,'mara')||!v2.borrowed&&!documents(s,'tomas')||v2.startedAt!==null&&!debtCard(s))return false;
  const scar=actor(s,'levi').farrierScar;if(scar?.site!=='left-thumb-web'||scar.kind!=='old-tool-burn'||scar.actorId!=='levi')return false;
  const marks=actor(s,'levi').holdingWristMarks;if(marks&&(marks.kind!=='binding-pressure'||marks.actorId!=='levi'||!finite(marks.firstSeenAt)||marks.firstSeenAt<h.initializedAt||marks.firstSeenAt>s.elapsed||initialCare))return false;
  return validateHoldingDialog(s);
}
