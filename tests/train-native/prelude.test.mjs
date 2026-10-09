/** Genuine prior public Save with explicitly staged active-scene/player
 * proximity context. This is a native component route, not a valid Train
 * Journey, ordinary public input or completed twenty-scene mission.
 */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import * as Journey from '../../src/campaign-journey.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {followActor,clearLine} from '../../src/campaign-navigation.js';
import {createTrainHuman} from '../../src/train-native/rigs.js';
import {prepareClinicBottlePose} from '../../src/train-camp-motion.js';
import {createTrainPrelude,beginTrainPrelude,stepTrainPrelude,getTrainPreludeInteractions,interactTrainPrelude,chooseTrainPrelude,trainClinicComplete} from '../../src/train-prelude.js';
const E=globalThis.My3D2dge,copy=v=>structuredClone(v),dt=.05;
function setup(){
  const raw=gunzipSync(fs.readFileSync(new URL('../fixtures/journey-v4-rival-webkit-current-reloaded.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);
  const r=s.campaign.missions[TRAIN_ID];r.train.prelude=createTrainPrelude();s.campaign.activeMissionId=TRAIN_ID;r.status='active';
  s.entities.mara.x=385;s.entities.mara.y=1270;s.entities.mara.z=0;s.entities.mara.mounted=false;
  const old={patient:copy(s.entities.silas),clinical:copy(s.campaign.missions['snowbound-a-voice-under-ice'].rescue.silas),weapons:copy(s.weapons),camp:copy(s.camp),inventory:copy(s.inventory)};
  const world=Journey.worldForCampaign(s),events=[],rigs=new Map();let allowContact=true;
  const ctx={worldFor:()=>world,addEntity:(state,spec,regionId,category)=>{assert.equal(state.entities[spec.id],undefined);const actor={...copy(spec),regionId,category,attachment:null};state.entities[spec.id]=actor;state.regions[regionId].residentIds.push(actor.id);return actor;},notice:()=>{},present:(...args)=>events.push(args),talk:(state,id,speaker,text,choices)=>{state.dialog={id,speaker,text,choices:choices.map(([id,label])=>({id,label}))};},
    clinicBottleContact:(state,request)=>{
      const actor=state.entities.abel;if(!rigs.has(actor.id))rigs.set(actor.id,createTrainHuman(E,actor));const h=rigs.get(actor.id),body={...actor,pose:'kneel',facing:0};h.rig.update(dt,body);
      const feet=copy([h.rig.J.footL,h.rig.J.footR]);
      const pose=prepareClinicBottlePose(E,h,body,request.target);assert.deepEqual([h.rig.J.footL,h.rig.J.footR],feet,'the bend keeps the native planted feet');
      try{const proof={...request,actorPosition:{x:actor.x,y:actor.y,z:actor.z},handPoint:copy(pose.diagnostics.find(c=>c.side==='R').hit),reachable:pose.diagnostics.every(c=>c.reachable&&c.error<1e-5),sweptClear:allowContact&&clearLine(world,{x:actor.x,y:actor.y,z:actor.z+25},request.target,1,false),handUsable:pose.diagnostics.every(c=>!c.blocked)};ctx.lastBottleProof={proof,diagnostics:copy(pose.diagnostics),actor:{x:actor.x,y:actor.y,z:actor.z}};return proof;}finally{pose.restore();}
    }};
  function tick(){s.elapsed+=dt;assert.equal(stepTrainPrelude(s,dt,ctx),true);}
  function move(target){for(let i=0;i<1000;i++){if(Math.hypot(s.entities.mara.x-target.x,s.entities.mara.y-target.y)<8)return;followActor(world,s.entities.mara,target,105,dt,4,9);tick();}throw new Error('Native scene foot approach was blocked');}
  function exchange(id){assert.ok(getTrainPreludeInteractions(s).some(a=>a.id===id),id);assert.equal(interactTrainPrelude(s,id,ctx),true);const speakers=[];for(let i=0;i<10&&s.dialog;i++){speakers.push(s.dialog.speaker);assert.equal(chooseTrainPrelude(s,'train-speech-next',ctx),true);}assert.equal(r.train.prelude.exchange,null);return speakers;}
  return{s,r,old,ctx,events,tick,move,exchange,setContact:value=>allowContact=value};
}
test('actual native arrivals and separate bedside voices preserve existing patient, gear and scarce camp facts',()=>{
  const f=setup(),{s,r,ctx,tick,move,exchange,old}=f;assert.equal(beginTrainPrelude(s,ctx),true);
  const entry=copy(r.train.prelude.arrivals.abel.from);for(let i=0;i<240;i++)tick();
  assert.ok(r.train.prelude.arrivals.abel.arrivedAt!==null);assert.notDeepEqual({x:s.entities.abel.x,y:s.entities.abel.y,z:s.entities.abel.z},entry);
  const speakers=exchange('train:bedside');assert.deepEqual(speakers,['A visitor at the shelter','Abel Sedge','Mara Vale','Abel Sedge','Elin Orr']);
  f.setContact(false);for(let i=0;i<100;i++)tick();assert.equal(r.train.prelude.bottle.location.type,'carried','no clear native hand contact means no physical transfer');
  f.setContact(true);for(let i=0;i<100&&r.train.prelude.bottle.location.type!=='ground';i++)tick();assert.equal(r.train.prelude.bottle.location.type,'ground',JSON.stringify(ctx.lastBottleProof));
  exchange('train:silas');move({x:410,y:1270});const family=exchange('train:family');assert.deepEqual(family,['Fin Orr','Silas Orr','Elin Orr']);
  assert.ok(r.train.prelude.acknowledged.some(row=>row.text.includes('coat still needs cloth')));assert.equal(trainClinicComplete(s),true);
  assert.deepEqual(s.entities.silas,old.patient);assert.deepEqual(s.campaign.missions['snowbound-a-voice-under-ice'].rescue.silas,old.clinical);
  assert.deepEqual(s.weapons,old.weapons);assert.deepEqual(s.camp,old.camp);assert.deepEqual(s.inventory,old.inventory);
  assert.equal(beginTrainPrelude(s,ctx),false,'the same arrival cannot duplicate people or their bottle');
});
test('pausing an exchange earns no unheard line and duplicate world timestamps earn no arrival/work step',()=>{
  const {s,r,ctx,tick}=setup();beginTrainPrelude(s,ctx);for(let i=0;i<240;i++)tick();
  assert.equal(interactTrainPrelude(s,'train:bedside',ctx),true);assert.equal(chooseTrainPrelude(s,'train-speech-pause',ctx),true);
  assert.equal(r.train.prelude.acknowledged.length,0);const before=copy(r.train.prelude);assert.equal(stepTrainPrelude(s,dt,ctx),false);assert.deepEqual(r.train.prelude,before);
  assert.equal(interactTrainPrelude(s,'train:resume-prelude',ctx),true);chooseTrainPrelude(s,'train-speech-next',ctx);assert.equal(r.train.prelude.acknowledged.length,1);
});
