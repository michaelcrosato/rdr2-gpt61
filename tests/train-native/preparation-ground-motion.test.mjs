import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
import {createTrainHuman} from '../../src/train-native/rigs.js';
import {captureNativeGroundLocomotion as capture} from '../../src/train-native/locomotion-state.js';
import {predictNativeGroundStep as predict} from '../../src/train-native/ground-motion-step.js';
import {beginPreparationGroundMotion as begin,advancePreparationGroundMotion as advance,preparationGroundMotionHuman as current,validatePreparationGroundMotion as valid,resumePreparationGroundMotion as resume} from '../../src/train-preparation-ground-motion.js';
import {createTrainCampWorkProvider} from '../../src/train-camp-work.js';
import {createTrainCampPresentation} from '../../src/train-camp-presentation.js';
import * as Journey from '../../src/campaign-journey.js';
import {acceptedBriefingNative,moveNative} from '../helpers/train-preparation-route.mjs';
import {interactTrainPreparation} from '../../src/train-preparation.js';
import {getPreparationWorkPose} from '../../src/train-preparation-work.js';

const E=globalThis.My3D2dge,copy=structuredClone;
const prep=s=>s.campaign.missions[TRAIN_ID].train.preparation;
function component(){
 // Detached owner-domain fixture. Prospective body/time changes in these
 // component cases are not played campaign steps or work receipts.
 const body={id:'ruth',category:'npc',x:500,y:1200,z:0,facing:0,vx:0,vy:0,hp:100,crouch:false};
 const mara={...body,id:'mara',category:'player',x:550},s={elapsed:10,entities:{ruth:body,mara},campaign:{missions:{[TRAIN_ID]:{train:{preparation:{startedAt:10}}}}}},human=createTrainHuman(E,body),maraHuman=createTrainHuman(E,mara);human.rig.update(0,body);human.rig.t=15;human.rig._pose();maraHuman.rig.update(0,mara);begin(s,E,[{body,human},{body:mara,human:maraHuman}]);return{s,body,human};
}

test('same-clock ground reads preserve native blends, are root-bound and repair corrupted borrowed private poses',()=>{
 const {s,body}=component(),before=JSON.stringify(s),row=copy(prep(s).groundMotion.actors.ruth),a=current(s,'ruth');assert.ok(a);assert.equal(current(s,'ruth'),a);
 body.crouch=true;const desired=current(s,'ruth');assert.deepEqual(desired.motion.poseWeights,row.motion.poseWeights,'a desired stance cannot snap the actual blend at zero time');
 body.facing=1;const turned=current(s,'ruth');assert.equal(turned.motion.facing,1);assert.equal(turned.motion.phase,row.motion.phase);assert.equal(turned.motion.clock,row.motion.clock);assert.deepEqual(turned.motion.poseWeights,row.motion.poseWeights);
 turned.human.rig.J.handR[0]+=100;assert.notEqual(current(s,'ruth'),turned);assert.deepEqual(capture(current(s,'ruth').human.rig),current(s,'ruth').motion);
 const movedRig=current(s,'ruth');movedRig.human.rig.x+=100;assert.notEqual(current(s,'ruth'),movedRig);assert.equal(current(s,'ruth').human.rig.x,body.x);
 body.facing=0;body.crouch=false;assert.equal(JSON.stringify(s),before);body.x++;assert.equal(current(s,'ruth'),null,'same-clock roots cannot be moved by pose reconstruction');assert.equal(valid(s,prep(s).groundMotion),false);
});

test('every prospective preview derives from one canonical predecessor and commits exactly one native update',()=>{
 const {s,body}=component(),owner=prep(s).groundMotion,old=copy(owner),from=owner.actors.ruth.motion;s.elapsed+=.05;body.x+=2;body.vx=40;
 const east=current(s,'ruth');assert.deepEqual(east.motion,predict(E,body,from,s.elapsed-owner.at).toRecord);assert.deepEqual(owner,old,'previews cannot mutate the saved predecessor');
 assert.ok(Object.isFrozen(east));assert.throws(()=>east.motion={...east.motion,clock:east.motion.clock+3});
 body.vx=0;body.vy=65;body.facing=.4;const final=current(s,'ruth');assert.notEqual(final,east);assert.deepEqual(final.motion,predict(E,body,from,s.elapsed-owner.at).toRecord);
 assert.equal(advance(s),true);assert.deepEqual(prep(s).groundMotion.actors.ruth.motion,final.motion);assert.equal(advance(s),false,'the same world time cannot be advanced twice');assert.equal(current(s,'ruth').human,final.human);assert.ok(valid(s,prep(s).groundMotion));
});

test('excluded domains retain suspended history and require an actual matching native capture to resume',()=>{
 const {s,body}=component(),old=copy(prep(s).groundMotion.actors.ruth);body.mounted=true;body.attachment=false;body.support=false;body.weaponAction=false;body.attack=false;s.elapsed+=.05;assert.equal(advance(s),true);const suspended=copy(prep(s).groundMotion.actors.ruth);assert.deepEqual(suspended.motion,old.motion);assert.equal(suspended.at,old.at);assert.equal(suspended.suspendedAt,s.elapsed);assert.equal(current(s,'ruth'),null);
 body.mounted=false;s.elapsed+=.05;assert.equal(advance(s),true);assert.deepEqual(prep(s).groundMotion.actors.ruth,suspended);assert.equal(current(s,'ruth'),null,'leaving the advanced domain cannot fabricate missing movement history');
 for(const badBody of[{...body,crouch:'invalid-string'},{...body,pose:'invented'},{...body,airborne:'yes'},{...body,dead:.5},{...body,attachment:{}},{...body,toolHeld:27},{...body,reloadTimer:-1},{...body}]){const bad=copy(prep(s).groundMotion);bad.actors.ruth.suspendedBody=badBody;assert.equal(valid(s,bad),false,'malformed or ordinary snapshots cannot masquerade as a supported suspension cause');}
 const human=createTrainHuman(E,body);human.rig.update(0,body);human.rig.t=20;human.rig._pose();const before=JSON.stringify(s);assert.throws(()=>resume(s,E,{body:{...body},human}));assert.equal(JSON.stringify(s),before);resume(s,E,{body,human});assert.equal(current(s,'ruth').motion.clock,20);assert.ok(valid(s,prep(s).groundMotion));
});

test('malformed ownership, wrong profiles and unresolved steps refuse atomically',()=>{
 const {s,body,human}=component(),owner=copy(prep(s).groundMotion),before=JSON.stringify(s);
 for(const mutate of[v=>v.extra=true,v=>v.at+=.01,v=>v.startedAt=11,v=>v.actors={},v=>v.actorIds=[],v=>v.actorIds.push('ruth'),v=>{delete v.actors.ruth;v.actorIds=['mara'];},v=>v.actors.ruth.at-=1,v=>v.actors.ruth.body.x+=1,v=>v.actors.ruth.motion.profile.size+=.1,v=>v.actors.ruth.motion.facing+=1,v=>v.actors.ruth.motion.phase=NaN,v=>v.actors.ruth.suspendedAt=9,v=>v.actors.ruth.suspendedAt=10]){const bad=copy(owner);mutate(bad);assert.equal(valid(s,bad),false);}
 const cached=current(s,'ruth');s.entities.ruth={...body};const replacement=current(s,'ruth');assert.notEqual(replacement,cached);assert.equal(replacement.body,s.entities.ruth);s.entities.ruth=body;
 assert.throws(()=>begin(s,E,[{body,human}]));assert.equal(JSON.stringify(s),before);s.elapsed+=.2;const stale=JSON.stringify(s);assert.equal(current(s,'ruth'),null);assert.equal(advance(s),false);assert.equal(JSON.stringify(s),stale);
 const other=component();delete prep(other.s).groundMotion;const raw=JSON.stringify(other.s);assert.throws(()=>begin(other.s,E,[{body:other.body,human:other.human},{body:other.body,human:other.human}]));assert.equal(JSON.stringify(other.s),raw);
});

test('actual camp steps preserve braking and crouch history through whole Save/Continue and share physics and draw Humans',()=>{
 const raw=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);assert.equal(prep(s).groundMotion,undefined);
 const provider=createTrainCampWorkProvider(E,Journey.worldForCampaign),objects=copy(s.campaign.missions['snowbound-the-names-they-took'].objects);begin(s,E,['mara','ruth'].map(id=>({body:s.entities[id],human:provider.prepareNativeActor(s,id).human})));
 const start=s.player.x;for(let i=0;i<6;i++)Journey.stepCampaign(s,.05,{mx:1,my:0});Journey.stepCampaign(s,.05,{});assert.ok(s.player.x>start);assert.equal(s.player.vx,0);assert.ok(current(s,'mara').motion.speedWeight>0);
 Journey.stepCampaign(s,.025,{crouch:true});const motion=current(s,'mara');assert.ok(motion.motion.poseWeights.crouch>0&&motion.motion.poseWeights.crouch<1);assert.equal(provider.prepareNativeActor(s,'mara').human,motion.human,'physics observes the same accepted Human');
 const saved=Journey.serializeCampaign(s),restored=Journey.restoreCampaign(saved);assert.ok(restored);assert.equal(Journey.serializeCampaign(restored),saved);assert.deepEqual(current(restored,'mara').motion,motion.motion);assert.deepEqual(current(restored,'mara').human.rig.J,motion.human.rig.J);
 for(const mutate of[v=>v.actorIds=['mara'],v=>delete v.actors.ruth,v=>v.actors.mara.motion.profile.size+=.1,v=>v.actors.mara.body.x+=1,v=>v.at-=.01,v=>v.actors.mara.suspendedAt=v.at]){const bad=JSON.parse(saved);mutate(prep(bad).groundMotion);assert.equal(Journey.restoreCampaign(JSON.stringify(bad)),null,'owning Save validation rejects malformed canonical motion');}
 // Drawing consumes the authoritative Human without calling update again.
 const oldUpdate=motion.human.rig.update,oldDraw=motion.human.rig.draw;let draws=0;motion.human.rig.update=()=>{throw new Error('second native update');};motion.human.rig.draw=function(...args){draws++;return oldDraw.apply(this,args);};
 try{const presentation=createTrainCampPresentation(E),pending=[],view=E.VIEWS.threequarter,g=new Proxy({globalAlpha:1,measureText:t=>({width:t.length*5})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});presentation.update(.05,s);presentation.draw({view,w:(x,y,z=0)=>view.p(x,y,z),visible:()=>true,shadow:()=>{},queue:(x,y,z,fn)=>pending.push(fn)},s);for(const fn of pending)fn(g);assert.equal(draws,1);assert.equal(Journey.serializeCampaign(s),saved);}finally{motion.human.rig.update=oldUpdate;motion.human.rig.draw=oldDraw;}
 for(const input of[{crouch:true},{crouch:false,mx:0,my:1},{}]){Journey.stepCampaign(s,.05,input);Journey.stepCampaign(restored,.05,input);assert.deepEqual(current(restored,'mara').motion,current(s,'mara').motion);assert.deepEqual(current(restored,'mara').human.rig.J,current(s,'mara').human.rig.J);}
 assert.deepEqual(s.campaign.missions['snowbound-the-names-they-took'].objects,objects,'motion state grants no stock or custody changes');
});

test('fresh preparation captures actual workers through the public call and persists subsequent ordinary accepted motion',()=>{
 const s=acceptedBriefingNative();moveNative(s,{x:s.entities.ruth.x,y:s.entities.ruth.y+40});assert.ok(Journey.getCampaignInteractions(s).some(a=>a.id==='train:prepare-call'));const before=Journey.serializeCampaign(s);assert.equal(interactTrainPreparation(s,'train:prepare-call',{beginPreparationGroundMotion(){throw new TypeError('unsupported actual capture');},notice(){throw new Error('failed call must not emit a successful notice');}}),false);assert.equal(Journey.serializeCampaign(s),before,'a refused actual capture rolls back the entire new preparation call');Journey.interactCampaign(s,'train:prepare-call');
 assert.ok(prep(s).groundMotion);assert.deepEqual(Object.keys(prep(s).groundMotion.actors).sort(),['mara','ruth']);assert.ok(valid(s,prep(s).groundMotion));const start=s.elapsed;for(let i=0;i<4;i++)Journey.stepCampaign(s,.05,{mx:1});assert.ok(prep(s).groundMotion.at>start);const saved=Journey.serializeCampaign(s);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(saved)),saved);
});

test('unchanged earned canonical-motion inspection restores its paused shared pose and extends the same work prefix',()=>{
 const raw=gunzipSync(readFileSync(new URL('../fixtures/train-preparation-ground-motion-inspection-pending.json.gz',import.meta.url))).toString(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw);
 const t=s.campaign.missions[TRAIN_ID].train,old=copy(t.powder.pending[0]);assert.ok(old.acceptedSeconds>0);Journey.getCampaignInteractions(s);
 for(const id of['mara','ruth']){const work=getPreparationWorkPose(s,id);assert.ok(work?.reachable&&work.usable);assert.equal(work.workId,old.workId);assert.equal(work.human,current(s,id).human);}
 assert.equal(Journey.serializeCampaign(s),raw,'paused pose reconstruction changes neither canonical history nor accepted work');Journey.stepCampaign(s,.05);const next=t.powder.pending.find(w=>w.workId===old.workId);assert.ok(next.acceptedSeconds>old.acceptedSeconds);assert.deepEqual(next.intervals.slice(0,old.intervals.length),old.intervals);assert.equal(t.powder.physicalEvents.some(e=>e.kind==='work-cancelled'&&e.data.workId===old.workId),false);const saved=Journey.serializeCampaign(s);assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(saved)),saved);
});
