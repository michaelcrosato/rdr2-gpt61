import {followPreparationGuideNative} from '../helpers/train-preparation-route.mjs';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from '../helpers/train-preparation-route.mjs';
import {interactNative,chooseNative} from '../helpers/train-clinic-route.mjs';
import {TRAIN_STORE_MARA,TRAIN_PREPARATION_SOLIDS} from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_MASK_ID,TRAIN_MASK_APPROACHES} from '../../content/campaign/train-gear-data.js';
import {RIVAL_ID} from '../../content/campaign/bellwether-works.js';
import {getPreparationWorkPose,validatePreparationMaskEvidence,preparationPlayerApproach} from '../../src/train-preparation-work.js';
import {preparationInspectionEvidence} from '../../src/train-powder.js';
import {trainCampWorkContext} from '../../src/train-camp-work-view.js';

const prep=s=>trainRecord(s).train.preparation,powder=s=>trainRecord(s).train.powder;
const root=fileURLToPath(new URL('../../',import.meta.url)),artifact=process.env.DUST_MERCY_NATIVE_ARTIFACT_DIR?resolve(process.env.DUST_MERCY_NATIVE_ARTIFACT_DIR):null,captures=[];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function sourceHashes(){const paths=['index.html','styles.css','my-3d2dge-agent.js','scripts/campaign_save.py','tests/train-native/preparation-work.test.mjs','tests/helpers/train-preparation-route.mjs','tests/helpers/train-clinic-route.mjs','tests/fixtures/journey-v4-rival-webkit-current-reloaded.json.gz'];for(const folder of ['src','content'])for(const path of readdirSync(join(root,folder),{recursive:true}))if(path.endsWith('.js'))paths.push(join(folder,path));return Object.fromEntries(paths.sort().map(path=>[path,sha(readFileSync(join(root,path)))]));}
const sourceStart=artifact?sourceHashes():null;
if(artifact){const path=relative(root,artifact);assert.ok(path==='..'||path.startsWith('../'),'native artifacts stay outside the repository');assert.equal(existsSync(artifact),false,'preserve previous receipts');mkdirSync(artifact,{recursive:true});}
function capture(s,label){if(!artifact)return;const raw=Journey.serializeCampaign(s);writeFileSync(join(artifact,`${label}.json`),raw);captures.push({label,sha256:sha(raw),elapsed:s.elapsed,stage:trainRecord(s).mission.stage,pending:structuredClone(powder(s).pending)});}
after(()=>{if(!artifact)return;const sourceEnd=sourceHashes(),stable=JSON.stringify(sourceStart)===JSON.stringify(sourceEnd),originalInput='tests/fixtures/journey-v4-rival-webkit-current-reloaded.json.gz';writeFileSync(join(artifact,'provenance.json'),JSON.stringify({scope:'Whole native controller route from unchanged earned Rival Save through actual clinic/briefing/preparation verbs. No body, stock, elapsed, stage or outcome assignments. This is bounded phase-two prefix evidence; not public Train entry, completed scene-three/full mission, final source or presentation acceptance.',originalInput,originalInputSHA256:sourceStart[originalInput],sourceStart,sourceEnd,sourceStable:stable,completeEvidenceSet:captures.length===8,requiresTerminalTestExitZero:true,captures},null,2));assert.ok(stable,'source and historical input remain frozen during formal native evidence capture');});
function wait(s,predicate,seconds,label){
  for(let i=0;!predicate()&&i<seconds/.05;i++)Journey.stepCampaign(s,.05);
  assert.ok(predicate(),`${label}: ${JSON.stringify({work:prep(s)?.work,pending:powder(s).pending,ruth:{x:s.entities.ruth.x,y:s.entities.ruth.y},poses:['mara','ruth','ada'].map(id=>{const p=getPreparationWorkPose(s,id);return p&&{id,reachable:p.reachable,usable:p.usable,joints:p.joints};})})}`);
}
function whole(s){const bytes=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(bytes);assert.ok(restored,'entire earned campaign graph restores');assert.equal(Journey.serializeCampaign(restored),bytes);return restored;}
function begin(){
  const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});interactNative(s,'train:prepare-call');
  moveNative(s,TRAIN_STORE_MARA);interactNative(s,'train:prepare-talk:store');
  wait(s,()=>!!s.dialog,20,'actual store speakers');while(s.dialog)chooseNative(s,'train-prepare-next');
  wait(s,()=>!!prep(s).campSetup.sites['quarry-charge-worktop'],20,'clear store worktop');return s;
}
function complete(s,id){interactNative(s,id);followPreparationGuideNative(s);assert.ok(trainCampWorkContext(s)?.caption,'the actual requested operation has a readable work caption');wait(s,()=>prep(s).work===null,30,`complete ${id}`);}
function approachMask(s,target=TRAIN_MASK_APPROACHES.mara){
  // This narrow valid contact is beside the bench, within a blocked 20-unit
  // navigation cell. Finish the ordinary movement from a clear outer cell.
  moveNative(s,{x:390,y:target.y});const t=target;
  for(let i=0;i<60&&Math.hypot(s.player.x-t.x,s.player.y-t.y)>.2;i++){const d=Math.hypot(s.player.x-t.x,s.player.y-t.y);Journey.stepCampaign(s,.005,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});}
  assert.ok(Math.hypot(s.player.x-t.x,s.player.y-t.y)<=.3);
}

test('real native bundle inspections and original tin work survive in-progress and completed whole Saves',()=>{
  let s=begin();capture(s,'01-store-ready');const before=structuredClone(s.campaign.missions[RIVAL_ID].objects),score=structuredClone(s.campaign.missions[RIVAL_ID].performance);
  assert.ok(Journey.worldForCampaign(s).obstacles.some(o=>o.id==='quarry-charge-worktop'));
  assert.equal(prep(s).campSetup.sites['ruth-wiring-case-stand'],undefined,'Skein still physically blocks the case');
  for(let i=1;i<=4;i++){
    const id=`quarry-sealed-charge-${i}`;interactNative(s,`train:prepare-inspect:${id}`);followPreparationGuideNative(s);
    wait(s,()=>powder(s).pending.some(w=>w.kind==='inspect-child-seal'&&w.acceptedSeconds>0),30,'real clear native inspection interval');
    for(const actor of ['mara','ruth']){const p=getPreparationWorkPose(s,actor);assert.ok(p?.reachable&&p.usable);assert.equal(p.body,s.entities[actor]);assert.equal(p.operationKind,'inspect-child-seal');}
    if(i===1){capture(s,'02-first-inspection-mid-work');s=whole(s);}
    wait(s,()=>prep(s).work===null,10,'actual inspection completion');
    assert.equal(getPreparationWorkPose(s,'ruth'),null,'completed work does not leave a task pose');
  }
  assert.deepEqual(s.campaign.missions[RIVAL_ID].objects,before,'observation does not consume or move the original bundles');
  capture(s,'03-four-inspections');interactNative(s,'train:prepare-open-tin');assert.equal(trainCampWorkContext(s).phase,'openTin');wait(s,()=>powder(s).pending.some(w=>w.kind==='open-tin'&&w.acceptedSeconds>0),30,'native tin interval');capture(s,'04-tin-mid-work');s=whole(s);assert.equal(trainCampWorkContext(s).phase,'openTin');
  wait(s,()=>prep(s).work===null,10,'original tin opening');
  const tin=s.campaign.missions[RIVAL_ID].objects['cap-tin'];assert.equal(tin.primers.length,6);const units=structuredClone(tin.primers),opening=tin.openingEventId;
  assert.equal(Journey.getCampaignInteractions(s).some(a=>a.id==='train:prepare-open-tin'),false,'already opened tin is not offered as a new supply');
  complete(s,'train:prepare-inspect-tin');s=whole(s);capture(s,'05-tin-counted');
  assert.deepEqual(s.campaign.missions[RIVAL_ID].objects['cap-tin'].primers,units);assert.equal(s.campaign.missions[RIVAL_ID].objects['cap-tin'].openingEventId,opening);
  const rows=preparationInspectionEvidence(s,{since:prep(s).startedAt});assert.equal(rows.filter(r=>r.topic==='child-seal').length,4);assert.equal(rows.filter(r=>r.topic==='primer-tin').length,1);
  assert.deepEqual(s.campaign.missions[RIVAL_ID].performance,score,'later preparation keeps earlier mission performance');assert.equal(trainRecord(s).mission.stage,2);
});

test('Ada hands over one original mask through native contact; actual drawing interrupts work and stale revisions are refused',()=>{
  let s=begin();const stock=structuredClone(s.campaign.missions[RIVAL_ID].objects);
  interactNative(s,'train:prepare-inspect:quarry-sealed-charge-1');followPreparationGuideNative(s);wait(s,()=>powder(s).pending.some(w=>w.acceptedSeconds>0),30,'inspection starts');
  assert.ok(getPreparationWorkPose(s,'mara'));Journey.campaignAction(s,'draw');assert.equal(getPreparationWorkPose(s,'mara'),null,'same-clock occupied hand invalidates the pose');
  Journey.stepCampaign(s,.05);assert.equal(powder(s).pending.length,0);assert.ok(powder(s).physicalEvents.some(e=>e.kind==='work-cancelled'));assert.deepEqual(s.campaign.missions[RIVAL_ID].objects,stock);Journey.campaignAction(s,'holster');s=whole(s);
  approachMask(s);wait(s,()=>!!prep(s).campSetup.sites['ada-mending-worktop'],20,'clear mending worktop');
  const now=s.elapsed,revision=s.campaign.missions[RIVAL_ID].rival.continuation.events.length,e={schema:1,choice:'uncovered',at:now,revision,actorPosition:{x:s.player.x,y:s.player.y,z:s.player.z||0},itemRef:null,itemState:null,issueEventId:null};
  assert.equal(validatePreparationMaskEvidence(s,e),true);for(const revision of [-1,999])assert.equal(validatePreparationMaskEvidence(s,{...e,revision}),false);
  capture(s,'06-mending-ready');interactNative(s,'train:prepare-mask-issue');Journey.stepCampaign(s,.05);const approach=preparationPlayerApproach(s);if(approach)approachMask(s,approach.point);assert.equal(trainCampWorkContext(s).phase,'issueMask');wait(s,()=>powder(s).pending.some(w=>w.kind==='issue-mask'&&w.acceptedSeconds>0),30,'real Ada and Mara hands');capture(s,'07-mask-mid-work');s=whole(s);assert.equal(trainCampWorkContext(s).phase,'issueMask');
  wait(s,()=>prep(s).work===null,10,'one finite windwrap handoff');assert.equal(s.itemInstances[TRAIN_MASK_ID].location.type,'carried');
  assert.equal(s.campaign.missions[RIVAL_ID].rival.continuation.events.filter(e=>e.kind==='issue-mask').length,1);assert.equal(Journey.getCampaignInteractions(s).some(a=>a.id==='train:prepare-mask-issue'),false);
  interactNative(s,'train:prepare-mask-bring');assert.equal(validatePreparationMaskEvidence(s,prep(s).maskChoice),true);s=whole(s);assert.equal(prep(s).maskChoice.choice,'bring');capture(s,'08-mask-owned-bring');
  const forged=JSON.parse(Journey.serializeCampaign(s));forged.campaign.missions[trainRecord(s).mission.id].train.preparation.maskChoice.revision=-1;assert.equal(Journey.restoreCampaign(forged),null);
  for(const solid of TRAIN_PREPARATION_SOLIDS)if(prep(s).campSetup.sites[solid.id])assert.ok(Journey.worldForCampaign(s).obstacles.some(o=>o.id===solid.id));
});
