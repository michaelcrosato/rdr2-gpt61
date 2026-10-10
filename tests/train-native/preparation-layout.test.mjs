import test from 'node:test';
import assert from 'node:assert/strict';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from '../helpers/train-preparation-route.mjs';
import {interactNative} from '../helpers/train-clinic-route.mjs';
import {blockedAt,clearLine} from '../../src/campaign-navigation.js';
import {RIVAL_ID} from '../../content/campaign/bellwether-works.js';
import * as Camp from '../../content/campaign/train-preparation-camp.js';
import {TRAIN_TOOL_CASE} from '../../content/campaign/train-equipment.js';
import {capturePreparationBodyBounds,validatePreparationBodyBounds,validatePreparationCampSetup,stepPreparationCampSetup,preparedCampSite} from '../../src/train-preparation-layout.js';

const STORE='quarry-charge-worktop',CASE='ruth-wiring-case-stand',MENDING='ada-mending-worktop';
const prep=s=>trainRecord(s).train.preparation,point=a=>({x:a.x,y:a.y,z:a.z??0}),clone=structuredClone;
const overlap=(r,site)=>r.regionId==='snowbound'&&r.volumes.some(b=>b.min.x<site.x+site.w-1e-7&&b.max.x>site.x+1e-7&&b.min.y<site.y+site.h-1e-7&&b.max.y>site.y+1e-7&&b.min.z<site.z+site.height-1e-7&&b.max.z>site.z+1e-7);
function begin(){const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});assert.equal(blockedAt(Journey.worldForCampaign(s),s.entities.ruth.x,s.entities.ruth.y,9),false);interactNative(s,'train:prepare-call');assert.deepEqual(prep(s).campSetup,{schema:1,sites:{}});return s;}
function settled(){const s=begin();for(let i=0;i<80&&!preparedCampSite(s,STORE);i++)Journey.stepCampaign(s,.05);assert.ok(preparedCampSite(s,STORE));assert.ok(preparedCampSite(s,MENDING));return s;}
function setupOnly(s){const world=Journey.worldForCampaign(s);Journey.stepCampaign(s,.05);return world;}
// Invalid registries are owner-component negatives, never playable/Save graphs.
function rejectInvalidSetup(s){s.elapsed+=.05;assert.equal(stepPreparationCampSetup(s,.05,{worldFor:Journey.worldForCampaign}),false);assert.deepEqual(prep(s).campSetup.sites,{});}

test('actual accepted call clears Ruth through old-world native steps before introducing store; mending is independent and Skein blocks the case',()=>{
  const s=begin(),start=s.elapsed,mara=point(s.player),skein=clone(s.entities.skein),bastian=point(s.entities.bastian),stock=clone(s.campaign.missions[RIVAL_ID].objects),inventory=clone(s.inventory),hp=s.player.hp,oldWorld=Journey.worldForCampaign(s);
  const initial=capturePreparationBodyBounds(s),site=Camp.TRAIN_PREPARATION_SOLIDS.find(p=>p.id===STORE);
  assert.ok(overlap(initial.find(r=>r.id==='ruth'),site),'genuine original Ruth overlap is reproduced before introduction');
  assert.ok(!oldWorld.obstacles.some(o=>o.id===STORE));
  const travelled=[];
  for(let i=0;i<80&&!preparedCampSite(s,STORE);i++){
    const before=point(s.entities.ruth);Journey.stepCampaign(s,.05);const after=point(s.entities.ruth),distance=Math.hypot(after.x-before.x,after.y-before.y);
    assert.ok(distance<=65*.05+1e-7,'every displacement is speed-bounded native movement');
    assert.ok(clearLine(oldWorld,before,after,9,false),'the actual feet traverse the old colliders');
    if(distance)travelled.push({before,after,distance});
    assert.deepEqual(point(s.player),mara,'layout never moves Mara');
  }
  assert.ok(travelled.length>1,'clearance is earned over actual movement intervals');
  assert.ok(preparedCampSite(s,STORE));assert.ok(preparedCampSite(s,MENDING));assert.equal(preparedCampSite(s,CASE),false);
  const receipt=prep(s).campSetup.sites[STORE];assert.ok(receipt.introducedAt>start);assert.equal(preparedCampSite(s,STORE,start),false);
  assert.ok(receipt.bodyBounds.every(r=>!overlap(r,site)),'every captured occupied volume clears the future solid');
  assert.equal(receipt.bodyBounds.length,Object.keys(s.entities).length,'all registered bodies are captured, including corpses');
  assert.ok(receipt.bodyBounds.some(r=>r.id==='neri'&&r.hp===0));
  assert.deepEqual(s.entities.skein,skein);assert.deepEqual(point(s.entities.bastian),bastian);assert.deepEqual(s.campaign.missions[RIVAL_ID].objects,stock);assert.deepEqual(s.inventory,inventory);assert.equal(s.player.hp,hp);
  assert.ok(Journey.worldForCampaign(s).obstacles.some(o=>o.id===STORE));assert.ok(Journey.worldForCampaign(s).obstacles.some(o=>o.id===MENDING));assert.ok(!Journey.worldForCampaign(s).obstacles.some(o=>o.id===CASE));
});

test('earned per-site clearance survives exact whole Save/Continue and no later occupancy turns a collider off',()=>{
  let s=settled();const bytes=Journey.serializeCampaign(s);s=Journey.restoreCampaign(bytes);assert.ok(s);assert.equal(Journey.serializeCampaign(s),bytes);
  const captured=clone(prep(s).campSetup.sites),before=Journey.serializeCampaign(s);
  assert.ok(validatePreparationCampSetup(s,prep(s).campSetup));assert.ok(validatePreparationBodyBounds(s,captured[STORE].bodyBounds));assert.equal(Journey.serializeCampaign(s),before,'pure validation writes no game state');
  for(let i=0;i<6;i++)Journey.stepCampaign(s,.05);assert.deepEqual(prep(s).campSetup.sites,captured,'sites latch their original evidence instead of recapturing');
  // Deliberately invalid current occupancy is a negative latch probe only.
  // It is never serialized or presented as an earned native position.
  s.entities.ruth.x=750;s.entities.ruth.y=1267;
  assert.ok(preparedCampSite(s,STORE));assert.ok(validatePreparationCampSetup(s,prep(s).campSetup));assert.ok(Journey.worldForCampaign(s).obstacles.some(o=>o.id===STORE));
});

test('historical captures resolve typed rest/mounted attachments and remain detached from later poses',()=>{
  const s=settled(),rows=capturePreparationBodyBounds(s),silas=rows.find(r=>r.id==='silas'),nell=rows.find(r=>r.id==='nell'),rivet=rows.find(r=>r.id==='rivet');
  assert.equal(silas.binding.type,'rest');assert.equal(silas.regionId,'snowbound');assert.equal(silas.point.x,365);assert.equal(silas.point.y,1270);
  assert.equal(nell.binding.type,'mounted');assert.deepEqual(nell.point,rivet.point);assert.equal(nell.rootId,'rivet');assert.ok(nell.height>=90);assert.ok(rivet.height>=90);
  assert.ok(validatePreparationBodyBounds(s,rows));const old=clone(rows);s.entities.nell.facing+=.7;s.entities.ruth.x-=10;
  assert.ok(validatePreparationBodyBounds(s,rows),'lawful later movement does not rewrite captured history');assert.deepEqual(rows,old);
});

test('a full yawed horse body blocks introduction even when its radius14 root clears (staged negative geometry)',()=>{
  const s=begin(),a=s.entities.skein;Object.assign(a,{x:715,y:1230,facing:Math.PI/2});
  const site=Camp.TRAIN_PREPARATION_SOLIDS.find(p=>p.id===STORE),row=capturePreparationBodyBounds(s).find(r=>r.id===a.id);
  assert.ok(a.y+14<site.y,'root footprint is clear');assert.ok(overlap(row,site),'actual long body reaches the proposed worktop');
  setupOnly(s);assert.equal(preparedCampSite(s,STORE),false);assert.equal(a.x,715);assert.equal(a.y,1230);
});

test('dead, hidden, and injured horizontal human volumes block setup without moving them (staged negatives)',()=>{
  for(const id of ['neri','gideon']){
    const s=begin(),a=s.entities[id];Object.assign(a,{x:710,y:1267,z:0,facing:Math.PI,hidden:true});
    const row=capturePreparationBodyBounds(s).find(r=>r.id===id),site=Camp.TRAIN_PREPARATION_SOLIDS.find(p=>p.id===STORE);
    assert.ok(a.x+9<site.x,'root footprint alone misses the horizontal torso');assert.ok(overlap(row,site));
    setupOnly(s);assert.equal(preparedCampSite(s,STORE),false);assert.equal(a.x,710);assert.equal(a.y,1267);
  }
});

test('a carried body derives its carrier region and finite volume; a cyclic/missing parent refuses setup (staged negatives)',()=>{
  const s=begin(),a=s.entities.neri,carrier=s.entities.ruth;
  a.regionId='north-cutting';a.attachment={type:'carried',targetId:carrier.id};carrier.carrying=a.id;
  const row=capturePreparationBodyBounds(s).find(r=>r.id===a.id);assert.equal(row.regionId,'snowbound');assert.equal(row.rootId,'ruth');assert.equal(row.point.z,25);
  setupOnly(s);assert.equal(preparedCampSite(s,STORE),false);
  for(const targetId of ['missing-body','neri']){const bad=begin();bad.entities.neri.attachment={type:'carried',targetId};assert.throws(()=>capturePreparationBodyBounds(bad));rejectInvalidSetup(bad);}
});

test('layout never routes Mara or the active holding guard out of a proposed site (staged negatives)',()=>{
  for(const id of ['mara','bastian']){const s=begin(),a=s.entities[id];Object.assign(a,{x:750,y:1267,z:0});const before=point(a);setupOnly(s);assert.deepEqual(point(a),before);assert.equal(preparedCampSite(s,STORE),false);}
});

test('strict historical body/geometry/time forgeries fail owner validation and whole Save restore',()=>{
  const s=settled(),setup=prep(s).campSetup;
  const mutations=[
    v=>v.sites[STORE].introducedAt=s.elapsed+.01,
    v=>v.sites[STORE].introducedAt=prep(s).startedAt,
    v=>v.sites[STORE].geometry.solid.w-=1,
    v=>v.sites[STORE].bodyBounds=v.sites[STORE].bodyBounds.filter(r=>r.id!=='neri'),
    v=>v.sites[STORE].bodyBounds=v.sites[STORE].bodyBounds.filter(r=>r.id!=='skein'),
    v=>v.sites[STORE].bodyBounds.push(clone(v.sites[STORE].bodyBounds[0])),
    v=>v.sites[STORE].bodyBounds.find(r=>r.id==='mara').radius=1,
    v=>v.sites[STORE].bodyBounds.find(r=>r.id==='ruth').volumes[0].max.x-=1,
    v=>v.sites[STORE].bodyBounds.find(r=>r.id==='nell').binding.targetId='missing-mount',
    v=>v.sites[STORE].bodyBounds.find(r=>r.id==='ruth').sourcePoint.x=NaN,
    v=>v.sites[STORE].unexpected=true,
  ];
  for(const mutate of mutations){const value=clone(setup);mutate(value);assert.equal(validatePreparationCampSetup(s,value),false);const raw=JSON.parse(Journey.serializeCampaign(s));raw.campaign.missions[trainRecord(s).mission.id].train.preparation.campSetup=value;assert.equal(Journey.restoreCampaign(raw),null);}
  for(const at of [NaN,-1,s.elapsed+.1])assert.equal(validatePreparationCampSetup(s,setup,at),false);
  const unknown=clone(setup);unknown.sites['invented-worktop']=clone(unknown.sites[STORE]);assert.equal(validatePreparationCampSetup(s,unknown),false);
});

test('relocating Skein only inside a fabricated case capture cannot invent native lead clearance',()=>{
  const s=settled(),saved=point(s.entities.skein);Object.assign(s.entities.skein,{x:680,y:1380,z:0});
  const rows=capturePreparationBodyBounds(s);Object.assign(s.entities.skein,saved);
  const solid=Camp.TRAIN_PREPARATION_SOLIDS.find(p=>p.id===CASE),contacts={case:TRAIN_TOOL_CASE,...Object.fromEntries(Object.entries(Camp).filter(([k])=>k.startsWith('TRAIN_CASE')||k.startsWith('TRAIN_KIT')))};
  const forged=clone(prep(s).campSetup);forged.sites[CASE]={schema:1,siteId:CASE,introducedAt:s.elapsed,geometry:{solid:clone(solid),contacts:JSON.stringify(contacts)},bodyBounds:rows};
  assert.ok(rows.every(r=>!overlap(r,solid)),'the staged snapshot itself claims clearance');assert.equal(validatePreparationCampSetup(s,forged),false,'a snapshot cannot substitute for an earlier real lead');
  assert.equal(preparedCampSite(s,CASE),false);assert.deepEqual(point(s.entities.skein),saved);
});

test('missing/old campSetup remains incomplete; invalid world, dialog and repeated clock never introduce a site',()=>{
  for(const mode of ['absent','null']){const s=begin();if(mode==='absent')delete prep(s).campSetup;else prep(s).campSetup=null;for(let i=0;i<4;i++)Journey.stepCampaign(s,.05);assert.equal(preparedCampSite(s,STORE),false);assert.ok(validatePreparationCampSetup(s,prep(s).campSetup));assert.equal(Object.hasOwn(prep(s),'campSetup'),mode!=='absent');}
  const s=begin(),before=clone(prep(s).campSetup);assert.equal(stepPreparationCampSetup(s,.05,{worldFor:Journey.worldForCampaign}),false,'same declaration clock earns no introduction');
  Journey.stepCampaign(s,.05);const captured=clone(prep(s).campSetup);assert.equal(stepPreparationCampSetup(s,.05,{worldFor:Journey.worldForCampaign}),false,'same clock is not advanced twice');assert.deepEqual(prep(s).campSetup,captured);
  const bad=begin();bad.elapsed+=.05;assert.equal(stepPreparationCampSetup(bad,.05,{worldFor:()=>null}),false);assert.deepEqual(prep(bad).campSetup,before);
  for(const obstacle of [{x:NaN,y:1200,w:10,h:10},{x:730,y:1230,w:-1,h:20},{x:730,y:1230,w:10,h:20,height:Infinity}]){const invalid=begin(),world=Journey.worldForCampaign(invalid),ruth=point(invalid.entities.ruth);invalid.elapsed+=.05;assert.equal(stepPreparationCampSetup(invalid,.05,{worldFor:()=>({...world,obstacles:[...world.obstacles,obstacle]})}),false);assert.deepEqual(prep(invalid).campSetup,before);assert.deepEqual(point(invalid.entities.ruth),ruth);}
  const outside=begin();outside.entities.neri.x=-1;assert.throws(()=>capturePreparationBodyBounds(outside));rejectInvalidSetup(outside);
});
