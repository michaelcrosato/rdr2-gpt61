import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {validateRivalDialog} from '../src/rival-dialogue-validation.js';
import * as Rival from '../src/rival-mission.js';
import * as Journey from '../src/campaign-journey.js';
import {RIVAL_ID,RIVAL_WORLD as W,RIVAL_CAST,RIVAL_ENEMIES,RIVAL_CARBINE} from '../content/campaign/bellwether-works.js';
import {SNOWBOUND_CAST} from '../content/campaign/snowbound.js';
import {RESCUE_CAST} from '../content/campaign/north-cutting.js';
import {HUNT_CAST} from '../content/campaign/willow-run.js';

const RESCUE='snowbound-a-voice-under-ice',HUNT='snowbound-a-quiet-table';
const clone=v=>JSON.parse(JSON.stringify(v));

test('genuine earlier shortage wire text survives while resumed speech uses counted singular nouns',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('fixtures/rival-questioning-provenance.json',import.meta.url),'utf8'));
  const bytes=gunzipSync(fs.readFileSync(new URL(`fixtures/${manifest.fixture}`,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256OfUncompressedOriginalBytes,'the genuine native shortage is not rewritten');
  const raw=JSON.parse(bytes),state=Journey.restoreCampaign(raw);
  assert.ok(state,'the complete original declared-feature graph remains valid');
  assert.match(raw.dialog.text,/Available now: 0 food portions and 1 blankets\./);
  assert.deepEqual(JSON.parse(Journey.serializeCampaign(state)).dialog,raw.dialog,'restore preserves the original wire text exactly');
  const before=clone(state.campaign.missions[RIVAL_ID].rival.questioning),stock={food:state.camp.food,blankets:state.camp.blankets};
  Journey.chooseCampaign(state,'question:leave');
  Journey.interactCampaign(state,'talk:levi-evidence');
  assert.match(state.dialog.text,/Available now: 0 food portions and 1 blanket\./);
  assert.deepEqual(state.campaign.missions[RIVAL_ID].rival.questioning,before,'resuming earns no unheard answers, grants or care');
  assert.deepEqual({food:state.camp.food,blankets:state.camp.blankets},stock);
  assert.ok(Journey.restoreCampaign(JSON.parse(Journey.serializeCampaign(state))),'new canonical text also round-trips');
  for(const text of [state.dialog.text.replace('0 food portions','99 food portions'),state.dialog.text+' Invented assurance.']){
    const forged=JSON.parse(Journey.serializeCampaign(state));forged.dialog.text=text;
    assert.equal(Journey.restoreCampaign(forged),null,'only exact counted canonical/older wire text is accepted');
  }
});
const rec=s=>s.campaign.missions[RIVAL_ID];
const position=(s,target,z=target.z||0)=>Object.assign(s.entities.mara,{x:target.x,y:target.y,z});
const locate=(actor,target)=>Object.assign(actor,{x:target.x,y:target.y,z:target.z||0});
const atActor=(s,id)=>position(s,s.entities[id]);
function put(s,id,owner,type='carried',targetId=owner){
  const chargeIds=['quarry-sealed-charge-1','quarry-sealed-charge-2','quarry-sealed-charge-3','quarry-sealed-charge-4'];
  rec(s).objects[id]={id,kind:id==='charge-crate'?'sealed-quarry-charges':'document',...(id==='charge-crate'?{count:4,chargeIds}:{}),owner,location:{type,targetId}};
  if(id==='charge-crate')for(const child of chargeIds)rec(s).objects[child]={id:child,kind:'sealed-charge',sealed:true,inspected:true,owner,location:{type:'crate',targetId:'charge-crate'}};
}
function holding(s){const r=rec(s),a=s.entities.levi;r.flags.bound=true;r.flags.held=true;a.bound=true;a.regionId=null;a.attachment={type:'rest',targetId:W.camp.holding.id,regionId:'snowbound'};Object.assign(a,{x:W.camp.holding.x,y:W.camp.holding.y,z:0});r.captivity.state='held';}
function papers(s,owner,station=false){for(const id of ['route-diagram','seizure-list'])put(s,id,owner,station?'station':'carried',station?W.plans.id:owner);}

// These are explicitly staged legacy-dialogue codec fixtures. Runtime interactions author every
// tested dialogue; they do not demonstrate travel, combat or fourteen scenes.
// This explicitly staged fixture preserves the pre-contract v4 scene/history.
// Contract-two exchanges use the separately earned full-route tests.
function fixture(stage=0,region='snowbound') {
  const r=Rival.createRivalRecord();delete r.rival.narrative;delete r.rival.narrativeVersion;delete r.rival.contractVersion;delete r.rival.questioningVersion;delete r.rival.questioning;delete r.rival.transportVersion;delete r.rival.transport;r.status='active';r.mission.stage=stage;
  const s={region,entities:{},weapons:{},party:{playerId:'mara',mountId:'copper'},regions:{snowbound:{residentIds:[]},[W.id]:{residentIds:[]}},campaign:{activeMissionId:RIVAL_ID,unlocks:{},missions:{[RIVAL_ID]:r,[RESCUE]:{mission:{completed:true}},[HUNT]:{mission:{completed:false}}}},companions:{ruth:{trust:0},bastian:{trust:0},emmett:{trust:0}},camp:{food:3,blankets:2,morale:20},stats:{},failure:null,dialog:null,notices:[],log:[],bullets:[],elapsed:80};
  const actors=[...SNOWBOUND_CAST,...RESCUE_CAST,...HUNT_CAST,...RIVAL_CAST,...RIVAL_ENEMIES,{id:'mara',name:'Mara Vale',hp:100,x:575,y:1120,z:0,mounted:false,carrying:null},{id:'copper',name:'Copper',kind:'horse',hp:100,x:545,y:1195,z:0,facing:0,stamina:100,owned:true,pack:{}},{id:'tomas-mount',name:'Moth',kind:'horse',hp:100,x:485,y:1175,z:0,facing:0,stamina:100,owned:true,pack:{}}];
  for(const actor of actors){const a={z:0,...clone(actor),attachment:null,regionId:actor.regionId||'snowbound'};a.category=a.id==='mara'?'player':RIVAL_ENEMIES.some(e=>e.id===a.id)?'enemy':a.kind==='horse'?'mount':'npc';s.entities[a.id]=a;}
  for(const who of ['tomas','inez','ruth','bastian','emmett'])s.entities[who].mountId={tomas:'tomas-mount',inez:'thimble',ruth:'plover',bastian:'cinder',emmett:'button'}[who];
  if(region===W.id){for(const id of ['mara','copper',...Rival.RIVAL_PARTY,...Rival.RIVAL_MOUNTS]){locate(s.entities[id],W.readyCover);s.entities[id].regionId=W.id;}for(const who of Rival.RIVAL_PARTY)locate(s.entities[who],W.yardCover[who]);}
  if(stage>=1){r.flags.accepted=true;r.flags.carbineGranted=true;r.flags.lariatGranted=true;r.flags.sightglassGranted=true;s.weapons[RIVAL_CARBINE.id]={...RIVAL_CARBINE,loanMissionId:null};s.weapons['working-lariat']={id:'working-lariat',kind:'lariat',owner:'mara',capacity:0,ammo:0,reserve:0};put(s,'sightglass','mara');}
  if(stage>=2)r.flags.entered=true;
  Object.defineProperties(s,{player:{get:()=>s.entities.mara},horse:{get:()=>s.entities.copper},mission:{get:()=>s.campaign.missions[s.campaign.activeMissionId].mission},enemies:{get:()=>Object.values(s.entities).filter(a=>a.category==='enemy')}});
  return s;
}
const context={
  addEntity:(s,a,regionId,category)=>s.entities[a.id]||(s.entities[a.id]={...clone(a),regionId,category}),
  worldFor:()=>W,present:()=>{},notice:()=>{},log:(s,text)=>s.log.push({text}),checkpoint:()=>{},
  talk:(s,id,speaker,text,choices)=>{s.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};},
  startMission:(s,id)=>{s.campaign.activeMissionId=id;s.campaign.missions[id].status='active';return true;},
  complete:s=>{const r=rec(s);r.status='completed';r.mission.completed=true;r.mission.rewardPaid=true;},
};
function generate(action,stage,region,prepare=()=>{}){const s=fixture(stage,region);prepare(s);Rival.interactRival(s,action,context);assert.ok(s.dialog,`${action} generated an actual runtime dialogue`);return s;}
const acceptedPrelude=s=>{rec(s).flags.intervened=true;};
const voices=s=>{acceptedPrelude(s);for(const id of ['ruth','emmett','bastian','inez'])rec(s).flags[`${id}Heard`]=true;};
function makeArgument(){return generate('rival:briefing',0,'snowbound',s=>{rec(s).status='unstarted';s.campaign.activeMissionId=RESCUE;position(s,W.camp.briefing);});}
function completedPreparation(s){const r=rec(s);r.flags.chargesStored=true;r.flags.questioned=true;r.flags.accounted=false;r.choices.care='care';r.choices.assurance='assurance';r.choices.order='rival-first';holding(s);for(const id of ['charge-crate','cap-tin'])put(s,id,'ruth','station',W.camp.charges.id);papers(s,'tomas');for(const id of Rival.RIVAL_PARTY)Object.assign(s.entities[id],{x:W.camp.ledger.x,y:W.camp.ledger.y,z:0,regionId:'snowbound'});locate(s.entities.bastian,{x:W.camp.holding.x+30,y:W.camp.holding.y,z:0});position(s,W.camp.ledger);}
const cases=[
  ['argument',makeArgument],
  ['motive',()=>{const s=makeArgument();Rival.chooseRival(s,'ask-motive',context);return s;}],
  ...['ruth','emmett','bastian','inez'].map(who=>[who,()=>generate(`talk:${who}`,0,'snowbound',s=>{acceptedPrelude(s);atActor(s,who);})]),
  ['invitation',()=>generate('rival:accept',0,'snowbound',s=>{voices(s);atActor(s,'tomas');})],
  ['carbine',()=>generate('rack:inspect-carbine',1,'snowbound',s=>{position(s,s.horse);})],
  ['lariat',()=>generate('gear:lariat',1,'snowbound',s=>{rec(s).flags.lariatGranted=false;delete s.weapons['working-lariat'];atActor(s,'inez');})],
  ['postpone',()=>generate('rival:postpone',1,'snowbound',s=>atActor(s,'tomas'))],
  ['ridge',()=>generate('lesson:ridge',2,W.id,s=>{const r=rec(s);r.flags.groovesRead=true;r.flags.hoovesRead=true;r.rival.trailIndex=W.trail.length;position(s,W.observation);locate(s.horse,W.observation);})],
  ['descent',()=>generate('recon:plan',3,W.id,s=>{const r=rec(s);r.flags.reconComplete=true;for(const key of Object.keys(r.scope.observed))r.scope.observed[key]=true;locate(s.entities.tomas,W.observation);position(s,W.observation);})],
  ['first-shot',()=>generate('choose-first',4,W.id,s=>{const r=rec(s);r.flags.reconComplete=true;r.flags.approachReady=true;r.rival.descentIndex=W.descent.length;position(s,W.readyCover);})],
  ['tactics',()=>generate('battle:tactics',6,W.id,s=>{const r=rec(s);r.flags.yardSafe=true;r.flags.pocketSearched=true;r.flags.patrolWarned=true;for(const e of RIVAL_ENEMIES.filter(e=>e.wave==='yard'))s.entities[e.id].hp=0;atActor(s,'tomas');})],
  ['powder',()=>generate('pass:charge',8,W.id,s=>{const r=rec(s);r.flags.patrolSafe=true;r.flags.magazineRead=true;r.flags.chargeInspected=true;put(s,'charge-crate','quarry-store','station',W.charge.id);locate(s.entities.ruth,W.charge);position(s,W.charge);})],
  ['plans',()=>generate('read:plans',8,W.id,s=>{const r=rec(s);r.flags.patrolSafe=true;r.flags.weighhouseRead=true;papers(s,'bastian',true);locate(s.entities.bastian,W.plans);position(s,W.plans);})],
  ['convoy',()=>generate('convoy:depart',8,W.id,s=>{const r=rec(s);r.flags.crateTaken=true;r.flags.plansDelivered=true;r.flags.horsesRetrieved=true;put(s,'charge-crate','ruth');put(s,'cap-tin','ruth');papers(s,'tomas');for(const id of ['mara',...Rival.RIVAL_PARTY])s.entities[id].mounted=true;atActor(s,'tomas');})],
  ['levi-road',()=>generate('talk:levi-road',11,W.id,s=>{const r=rec(s),a=s.entities.levi;r.flags.chaseStarted=true;r.flags.bound=true;r.flags.loaded=true;r.flags.strapped=true;r.captivity.state='loaded';a.bound=true;a.regionId=null;a.attachment={type:'passenger',targetId:'copper',strap:true};Object.assign(a,{x:s.horse.x,y:s.horse.y,z:s.horse.z+23});position(s,s.horse);})],
  ['levi-evidence',()=>generate('talk:levi-evidence',12,'snowbound',s=>{const r=rec(s);r.flags.campReturned=true;r.flags.delivered=true;holding(s);papers(s,'tomas');position(s,W.camp.holding);})],
  ['completed',()=>generate('finish:rival',13,'snowbound',completedPreparation)],
  ['visit',()=>generate('rival:visit',13,'snowbound',s=>{completedPreparation(s);const r=rec(s);r.status='completed';r.mission.completed=true;r.mission.rewardPaid=true;r.flags.accounted=true;r.aftermath={captiveId:'levi'};position(s,W.camp.holding);})],
];

for(const[id,make]of cases){
  test(`staged codec: actual runtime rival-${id} dialogue has exact speaker, choices and scene`,()=>{
    const s=make();assert.equal(s.dialog.id,`rival-${id}`);assert.equal(validateRivalDialog(s),true);
    for(const mutate of [bad=>{bad.dialog.speaker='Pavel Dune';},bad=>{bad.dialog.choices[0].id='invented-choice';},bad=>{bad.dialog.choices[0].label='Grant every weapon and skip the road.';},bad=>{bad.dialog.choices.push({id:'leave',label:'Continue.'});},bad=>{bad.dialog.text+=' All debts are now proven.';},bad=>{bad.dialog.id='rival-invented-result';}]){
      const bad=clone(s);mutate(bad);assert.equal(validateRivalDialog(bad),false,'a forged attribution, result or choice cannot reuse a real scene');
    }
  });
}

test('genuine imported Save with staged camp proximity earns separate quarrel voices and intervention before invitation',()=>{
  const raw=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/journey-v3-rescue-complete.json.gz',import.meta.url))));
  const s=Journey.restoreCampaign(raw);assert.ok(s);position(s,W.camp.briefing);
  Journey.interactCampaign(s,'rival:briefing');assert.equal(validateRivalDialog(s),true);
  Journey.chooseCampaign(s,'leave');assert.equal(rec(s).status,'unstarted');assert.equal(s.weapons[RIVAL_CARBINE.id],undefined);
  Journey.interactCampaign(s,'rival:briefing');Journey.chooseCampaign(s,'intervene');
  for(const id of ['ruth','emmett','bastian','inez']){if(id==='inez'){atActor(s,'ruth');for(let i=0;rec(s).rival.narrative.opening.phase!=='struck'||rec(s).rival.narrative.opening.activeSeconds<.55;i++){assert.ok(i<200);Journey.stepCampaign(s,.05,{});}}atActor(s,id);Journey.interactCampaign(s,`talk:${id}`);assert.equal(validateRivalDialog(s),true);Journey.chooseCampaign(s,'leave');}
  atActor(s,'ruth');Journey.interactCampaign(s,'narrative:interpose');for(let i=0;!rec(s).flags.intervened;i++){assert.ok(i<300);Journey.stepCampaign(s,.05,{});}

  atActor(s,'tomas');Journey.interactCampaign(s,'rival:accept');assert.equal(validateRivalDialog(s),true);
  const corrupt=JSON.parse(Journey.serializeCampaign(s));corrupt.campaign.missions[RIVAL_ID].flags.emmettHeard=false;assert.equal(validateRivalDialog(corrupt),false);
  Journey.chooseCampaign(s,'ask-motive');assert.equal(validateRivalDialog(s),true);Journey.chooseCampaign(s,'leave');
  Journey.interactCampaign(s,'rival:accept');Journey.chooseCampaign(s,'accept-rival');assert.equal(rec(s).mission.stage,1);assert.equal(validateRivalDialog(s),true);
});

test('scene prerequisites reject fabricated invitations, unseen recon, premature tactics and unsupported custody',()=>{
  const byId=new Map(cases);
  const checks=[
    ['argument',s=>{rec(s).flags.carbineGranted=true;}],
    ['motive',s=>{s.campaign.missions[RESCUE].mission.completed=false;}],
    ['invitation',s=>{rec(s).flags.inezHeard=false;}],
    ['carbine',s=>{delete s.weapons[RIVAL_CARBINE.id];}],
    ['lariat',s=>{rec(s).flags.lariatGranted=false;}],
    ['ridge',s=>{rec(s).rival.trailIndex--; }],
    ['descent',s=>{rec(s).scope.observed.levi=false;}],
    ['first-shot',s=>{s.entities.ruth.x+=500;}],
    ['tactics',s=>{s.entities[RIVAL_ENEMIES.find(e=>e.wave==='yard').id].hp=90;}],
    ['powder',s=>{rec(s).objects['charge-crate'].count=5;}],
    ['plans',s=>{delete rec(s).objects['seizure-list'];}],
    ['convoy',s=>{rec(s).objects['charge-crate'].owner='mara';}],
    ['levi-road',s=>{s.entities.levi.attachment.strap=false;}],
    ['levi-evidence',s=>{rec(s).flags.held=false;}],
    ['completed',s=>{rec(s).flags.accounted=false;}],
    ['visit',s=>{s.entities.levi.attachment=null;}],
  ];
  for(const[id,mutate]of checks){const s=byId.get(id)();mutate(s);assert.equal(validateRivalDialog(s),false,id);}
});

test('dialogues persist with newly assigned movement goals, but cannot be imported at another action location or stage',()=>{
  for(const[id,make]of cases){const s=make();for(const a of Object.values(s.entities))a.goal={x:a.x+100,y:a.y+100,z:a.z};assert.equal(validateRivalDialog(s),true,`${id} preserves assigned goals during pause`);s.entities.mara.x=2950;s.entities.mara.y=2320;assert.equal(validateRivalDialog(s),false,`${id} is not a remote action menu`);const elsewhere=make();rec(elsewhere).mission.stage=rec(elsewhere).mission.stage===13?0:13;assert.equal(validateRivalDialog(elsewhere),false,`${id} has its own scene stage`);}
});

test('independent Hunt/Rescue dialogue is ignored; completed captive visits remain valid during a different active mission',()=>{
  const s=fixture();s.dialog={id:'hunt-juno-invitation',speaker:'Juno Mercier',text:'Foreign owner validates this.',choices:[]};assert.equal(validateRivalDialog(s),true);
  s.dialog.id='rescue-briefing';assert.equal(validateRivalDialog(s),true);
  s.dialog={id:'mission-failed',speaker:'A Quiet Table · Checkpoint',text:'Foreign failure.',choices:[]};s.campaign.activeMissionId=HUNT;assert.equal(validateRivalDialog(s),true);
  const visit=new Map(cases).get('visit')();visit.campaign.activeMissionId=HUNT;visit.campaign.missions[HUNT].mission.completed=false;assert.equal(validateRivalDialog(visit),true);
});

test('care shortage keeps the evidence choice readable, while a false Hunt-first convoy or care visit is rejected',()=>{
  const byId=new Map(cases),care=byId.get('levi-evidence')();care.camp.food=0;care.camp.blankets=0;assert.equal(validateRivalDialog(care),true,'choice availability is distinct from resource authorization');
  const convoy=byId.get('convoy')();convoy.campaign.missions[HUNT].mission.completed=true;assert.equal(validateRivalDialog(convoy),false,'dialogue order follows the actual permanent Hunt history');
  const visit=byId.get('visit')();rec(visit).choices.care='deprive';assert.equal(validateRivalDialog(visit),false,'care and deprivation have different recorded speech');
});

test('staged runtime speaks the distinct Hunt-first convoy and deprivation holding visit branches',()=>{
  const convoy=generate('convoy:depart',8,W.id,s=>{const r=rec(s);s.campaign.missions[HUNT].mission.completed=true;r.rival.huntAtEntry=true;r.flags.crateTaken=true;r.flags.plansDelivered=true;r.flags.horsesRetrieved=true;put(s,'charge-crate','ruth');put(s,'cap-tin','ruth');papers(s,'tomas');for(const id of ['mara',...Rival.RIVAL_PARTY])s.entities[id].mounted=true;atActor(s,'tomas');});
  assert.equal(rec(convoy).choices.order,'hunt-first');assert.match(convoy.dialog.text,/Juno’s food is counted/);assert.equal(validateRivalDialog(convoy),true);
  const visit=generate('rival:visit',13,'snowbound',s=>{completedPreparation(s);const r=rec(s);r.status='completed';r.mission.completed=true;r.mission.rewardPaid=true;r.flags.accounted=true;r.choices.care='deprive';r.aftermath={captiveId:'levi'};position(s,W.camp.holding);});
  assert.match(visit.dialog.text,/still cold under guard/);assert.equal(validateRivalDialog(visit),true);
});

test('active Rival failure requires its exact owner, reason and retry/restart/replay choices',()=>{
  for(const replay of [false,true]){const s=fixture(5,W.id);s.failure={reason:'A required person was harmed.'};s.replayCanonical=replay?{}:null;s.dialog={id:'mission-failed',speaker:'The Names They Took · Checkpoint',text:s.failure.reason,choices:[{id:'retry',label:'Retry the latest checkpoint.'},{id:'restart',label:'Restart this mission.'},...(replay?[{id:'finish-replay',label:'Return to the permanent journey.'}]:[])]};assert.equal(validateRivalDialog(s),true);
    for(const mutate of [bad=>{bad.failure=null;},bad=>{bad.dialog.speaker='The Last Warm Light · Checkpoint';},bad=>{bad.dialog.text='An invented earlier failure.';},bad=>{bad.dialog.choices.reverse();},bad=>{bad.dialog.choices.push({id:'leave',label:'Continue.'});}]){const bad=clone(s);mutate(bad);assert.equal(validateRivalDialog(bad),false);}
  }
});
