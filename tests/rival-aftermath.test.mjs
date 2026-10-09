import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../src/rival-aftermath.js';
import {validateRivalDialog} from '../src/rival-dialogue-validation.js';
import {createRivalRecord} from '../src/rival-mission.js';
import {RIVAL_ID,RIVAL_WORLD as W} from '../content/campaign/bellwether-works.js';
const HUNT='snowbound-a-quiet-table',clone=v=>JSON.parse(JSON.stringify(v));
const rec=s=>s.campaign.missions[RIVAL_ID],h=s=>rec(s).aftermath.holding;
const ctx={talk:(s,id,speaker,text,choices)=>{s.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};},present:(s,kind,target,targetId,from,actorId)=>s.contacts.push({kind,target,targetId,from,actorId}),notice:(s,text)=>s.notices.push(text),log:(s,text)=>s.log.push(text)};
// Staged aftermath unit fixtures deliberately establish a completed operation;
// these tests prove schedule/visit transactions, not the complete Rival mission.
// This explicitly staged fixture preserves the pre-contract v4 scene/history.
// Contract-two exchanges use the separately earned full-route tests.
function fixture(care='deprive'){
  const r=createRivalRecord();delete r.rival.contractVersion;delete r.rival.questioningVersion;delete r.rival.questioning;delete r.rival.transportVersion;delete r.rival.transport;r.status='completed';r.mission.stage=13;r.mission.completed=true;r.mission.rewardPaid=true;r.choices.care=care;r.flags.bound=true;r.flags.held=true;r.flags.chargesStored=true;r.flags.accounted=true;r.captivity.state='held';r.captivity.trust=care==='care'?3:0;
  for(const key of ['care:levi','complete:account'])r.transactions[`${RIVAL_ID}:${key}`]={completed:true};
  r.aftermath={operationName:'The Names They Took',captiveId:'levi',care,order:'rival-first',assurance:'assurance'};
  for(const [id,owner]of [['route-diagram','tomas'],['seizure-list','tomas'],['levi-debt-card','levi']])r.objects[id]={id,kind:'document',owner,location:{type:'carried',targetId:owner}};
  const s={region:'snowbound',elapsed:120,honor:0,party:{playerId:'mara',mountId:'copper'},entities:{mara:{id:'mara',name:'Mara Vale',x:W.camp.holding.x,y:W.camp.holding.y-20,z:0,hp:100},levi:{id:'levi',name:'Levi Senn',x:W.camp.holding.x,y:W.camp.holding.y,z:0,hp:86,bound:true,regionId:null,attachment:{type:'rest',targetId:W.camp.holding.id,regionId:'snowbound'}},tomas:{id:'tomas',name:'Tomas Reed',x:610,y:1115,z:0,hp:91,regionId:'snowbound'},silas:{id:'silas',name:'Silas Orr',hp:55,scars:true},pavel:{id:'pavel',name:'Pavel Dune',hp:80,bound:true}},camp:{food:2,blankets:1},campaign:{activeMissionId:RIVAL_ID,missions:{[RIVAL_ID]:r,[HUNT]:{status:'unstarted',mission:{completed:false}}}},dialog:null,failure:null,contacts:[],notices:[],log:[]};
  assert.ok(A.initializeHolding(s));assert.equal(A.validateHolding(s),true);return s;
}
function choose(s,id){assert.ok(s.dialog?.choices.some(c=>c.id===id),`${id} is visibly offered`);assert.equal(A.chooseHolding(s,id,ctx),true,id);assert.equal(A.validateHolding(s),true,`${id} preserves the holding ledger`);assert.equal(validateRivalDialog(s),true,`${id} has a strict Rival dialogue contract`);}
function open(s,id){assert.ok(A.getHoldingInteractions(s).some(c=>c.id===id));assert.equal(A.interactHolding(s,id,ctx),true);assert.equal(A.validateHolding(s),true);assert.equal(validateRivalDialog(s),true);}
function advance(s,seconds){s.elapsed+=seconds;A.advanceRivalHolding(s,seconds,ctx);assert.equal(A.validateHolding(s),true);}
function first(s=fixture(),feed=true){open(s,'holding:first-visit');choose(s,'holding-reassure');choose(s,'holding-first-return');choose(s,'holding-denial');choose(s,'holding-first-return');choose(s,'holding-check');choose(s,'holding-first-return');if(feed){choose(s,'holding-feed');choose(s,'holding-first-return');}choose(s,'holding-first-finish');return s;}
function second(s=first(),comparison='holding-record-matches'){
  advance(s,8);Object.assign(s.entities.mara,{x:s.entities.tomas.x,y:s.entities.tomas.y});open(s,'holding:borrow-papers');assert.equal(s.dialog,null);Object.assign(s.entities.mara,{x:W.camp.holding.x,y:W.camp.holding.y-20});open(s,'holding:second-visit');
  for(const kind of ['route','list','card']){choose(s,`holding-read-${kind}`);choose(s,'holding-second-return');}
  choose(s,'holding-compare');choose(s,comparison);choose(s,'holding-second-return');choose(s,'holding-second-finish');return s;
}

test('initialization retains existing captivity, injuries, operation identity and previous patient/captive bodies',()=>{
  const s=fixture(),identity=clone(rec(s).aftermath);assert.equal(identity.operationName,'The Names They Took');assert.equal(identity.captiveId,'levi');assert.equal(s.entities.levi.hp,86);assert.deepEqual(s.entities.silas,{id:'silas',name:'Silas Orr',hp:55,scars:true});assert.deepEqual(s.entities.pavel,{id:'pavel',name:'Pavel Dune',hp:80,bound:true});
  const before=clone(s);A.initializeHolding(s);assert.deepEqual(s,before,'initialization is idempotent and grants no food');
  assert.deepEqual(s.entities.levi.farrierScar,{site:'left-thumb-web',kind:'old-tool-burn',actorId:'levi'});
});
test('global holding age uses actual story elapsed once, stops in dialogue/failure and persists outside camp and Rival',()=>{
  const s=fixture();s.campaign.activeMissionId=HUNT;s.region='willow-run';advance(s,80);assert.equal(rec(s).captivity.holdingHours,1);assert.equal(rec(s).captivity.withholdingHours,1);assert.equal(rec(s).captivity.hunger,12);assert.equal(s.entities.levi.holdingWristMarks.actorId,'levi');
  A.advanceRivalHolding(s,80,ctx);assert.equal(rec(s).captivity.holdingHours,1,'the same elapsed clock cannot charge twice');
  s.dialog={id:'hunt-wind'};s.elapsed+=10;A.advanceRivalHolding(s,10,ctx);assert.equal(rec(s).captivity.holdingHours,1);s.dialog=null;s.failure={reason:'Foreign failure'};s.elapsed+=10;A.advanceRivalHolding(s,10,ctx);assert.equal(rec(s).captivity.holdingHours,1);s.failure=null;advance(s,8);assert.equal(rec(s).captivity.holdingHours,1.1);
});
test('the first visit gives one actual portion, records denial and care, and leaves one guarded Levi',()=>{
  const s=fixture(),food=s.camp.food;first(s);assert.equal(h(s).visit1.completed,true);assert.equal(s.camp.food,food-1);assert.equal(rec(s).captivity.care.mealCount,1);assert.equal(rec(s).captivity.restraint,'loose');assert.equal(s.entities.levi.bound,true);assert.equal(s.entities.levi.attachment.targetId,W.camp.holding.id);assert.equal(s.entities.levi.hp,86,'care does not fabricate a heal');assert.equal(h(s).careHistory.length,4);
  assert.ok(s.contacts.some(e=>e.kind==='care'&&e.targetId==='levi'&&e.actorId==='mara'));assert.equal(A.getHoldingInteractions(s).some(o=>o.id==='holding:first-visit'),false);assert.equal(A.getHoldingInteractions(s).some(o=>o.id==='holding:second-visit'),false,'second visit has its own active-time gap and documents');
});
test('food shortages invent no serving and finishing requires the three actual first-visit responses',()=>{
  const s=fixture();s.camp.food=0;open(s,'holding:first-visit');assert.equal(A.chooseHolding(s,'holding-first-finish',ctx),false);choose(s,'holding-feed');assert.equal(s.dialog.id,'rival-holding-shortage');assert.equal(s.camp.food,0);assert.equal(h(s).visit1.foodGiven,false);choose(s,'holding-first-return');choose(s,'holding-reassure');choose(s,'holding-first-return');choose(s,'holding-denial');choose(s,'holding-first-return');choose(s,'holding-check');choose(s,'holding-first-return');choose(s,'holding-first-finish');assert.equal(h(s).visit1.completed,true);assert.equal(rec(s).captivity.care.mealCount,0);
});
test('reopening the first visit reads a counted food entry and cannot spend it twice',()=>{
  const s=fixture();open(s,'holding:first-visit');choose(s,'holding-feed');choose(s,'holding-first-return');assert.equal(s.dialog.choices.some(c=>c.id==='holding-feed'),false);choose(s,'holding-food-record');choose(s,'holding-first-return');assert.equal(s.camp.food,1);assert.equal(h(s).careHistory.filter(e=>e.foodUsed===1).length,1);choose(s,'holding-pause');open(s,'holding:first-visit');assert.equal(s.camp.food,1);
});
test('second visit borrows the actual documents from nearby Tomas and keeps uncertainty distinct from matching facts',()=>{
  const s=second();assert.equal(h(s).visit2.completed,true);assert.equal(rec(s).objects['route-diagram'].owner,'mara');assert.equal(rec(s).objects['seizure-list'].location.targetId,'mara');assert.equal(rec(s).objects['levi-debt-card'].owner,'levi');assert.deepEqual(h(s).testimony.map(e=>e.reliability),['corroborated-distance','corroborated-sum','uncertain','corroborated-facts']);assert.equal(A.getHoldingInteractions(s).length,0);
  const pressured=second(first(fixture(),false),'holding-demand-confession');assert.equal(h(pressured).visit2.comparison,'pressured-answer');assert.equal(pressured.honor,-1);assert.equal(h(pressured).testimony.at(-1).reliability,'pressured-answer');assert.match(h(pressured).testimony.at(-1).claim,/do not establish voluntary copying/);
});
test('document comparison cannot fabricate a missing card, an unseen reading or a remote handoff',()=>{
  const s=first();advance(s,8);assert.equal(A.getHoldingInteractions(s).some(o=>o.id==='holding:borrow-papers'),false,'Tomas is outside handoff reach');Object.assign(s.entities.mara,{x:s.entities.tomas.x,y:s.entities.tomas.y});open(s,'holding:borrow-papers');delete rec(s).objects['levi-debt-card'];Object.assign(s.entities.mara,{x:W.camp.holding.x,y:W.camp.holding.y-20});assert.equal(A.getHoldingInteractions(s).some(o=>o.id==='holding:second-visit'),false);
  const fresh=first();advance(fresh,8);Object.assign(fresh.entities.mara,{x:fresh.entities.tomas.x,y:fresh.entities.tomas.y});open(fresh,'holding:borrow-papers');Object.assign(fresh.entities.mara,{x:W.camp.holding.x,y:W.camp.holding.y-20});open(fresh,'holding:second-visit');assert.equal(A.chooseHolding(fresh,'holding-compare',ctx),false);assert.equal(h(fresh).visit2.comparison,null);
});
test('Hunt completion or an actually active train closes the visit window without erasing schedules or history',()=>{
  const s=first();s.campaign.missions[HUNT].mission.completed=true;advance(s,80);assert.equal(A.getHoldingInteractions(s).length,0);assert.equal(h(s).visit1.completed,true);assert.equal(rec(s).captivity.holdingHours,1);
  const beforeTrain=fixture();beforeTrain.campaign.missions.train={sourceRequirementId:'campaign-who-the-hell-is-leviticus-cornwall',status:'active',mission:{completed:false}};assert.equal(A.getHoldingInteractions(beforeTrain).length,0);
});
test('saved holding histories round trip and replay branches preserve isolated clocks, food and Levi identity',()=>{
  const s=second(),saved=clone(s);assert.equal(A.validateHolding(saved),true);assert.deepEqual(saved.campaign,s.campaign);
  const replay=clone(s);replay.replayCanonical=clone(s);advance(replay,80);assert.equal(rec(replay).captivity.holdingHours,1.1);assert.deepEqual(replay.replayCanonical,s,'replay aging cannot mutate the permanent holding record');
});
test('strict history validation rejects duplicate food, changed testimony attribution, invented consent and false clocks',()=>{
  const base=second();for(const[label,mutate]of [
    ['duplicate meal',s=>{rec(s).captivity.care.mealCount++;}],['duplicate care receipt',s=>{h(s).careHistory.push(clone(h(s).careHistory[0]));}],['future clock',s=>{h(s).lastAdvancedAt=s.elapsed+1;}],['false captivity age',s=>{rec(s).captivity.holdingHours+=100;}],['false hunger',s=>{rec(s).captivity.hunger=99;}],['Pavel testimony',s=>{h(s).testimony[0].actorId='pavel';}],['consent invented',s=>{h(s).testimony[2].reliability='voluntary-confession';}],['comparison claim rewritten',s=>{h(s).testimony[3].claim='The documents prove consent.';}],['care without transaction',s=>{delete rec(s).transactions[`${RIVAL_ID}:holding:first-food`];}],['renamed prisoner',s=>{s.entities.levi.name='Silas Orr';}],['unheld captive',s=>{s.entities.levi.attachment=null;}],['different paper owner',s=>{rec(s).objects['route-diagram'].owner='tomas';}],
  ]){const corrupt=clone(base);mutate(corrupt);assert.equal(A.validateHolding(corrupt),false,label);}
});
test('holding dialogue choices reject transplanted choices and foreign-dialogue calls have no effects',()=>{
  const s=fixture();open(s,'holding:first-visit');const before=clone(s);s.dialog.choices[0].id='holding-demand-confession';assert.equal(A.validateHoldingDialog(s),false);assert.equal(A.chooseHolding(s,'holding-demand-confession',ctx),false);assert.equal(rec(s).captivity.trust,rec(before).captivity.trust);
  s.dialog={id:'hunt-orla',choices:[{id:'holding-feed',label:'Injected food action.'}]};const stock=s.camp.food;assert.equal(A.chooseHolding(s,'holding-feed',ctx),false);assert.equal(s.camp.food,stock);
});
