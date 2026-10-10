import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Journey,acceptedBriefingNative,moveNative,trainRecord} from './helpers/train-preparation-route.mjs';
import {capturePreparationBodyBounds,validatePreparationBodyBounds,validatePreparationCampSetup} from '../src/train-preparation-layout.js';
import {preparationNativeBodyParts,preparationNativeBodyContacts,preparationPartBounds,preparationPartSolid,sweepPreparationNativeYaw} from '../src/train-preparation-body-geometry.js';
import {createHeldBox,compileHeldSolidSet,heldBoxContacts} from '../src/train-held-volume.js';
import {createTrainHuman,rigWorldPoint} from '../src/train-native/rigs.js';
import {boundRivalPose} from '../src/rival-rigs.js';
import {lowerTorso} from '../src/expedition-animation.js';
import {localPoint,makeFrame} from '../src/rail-foundation/rigid-frame.js';
const E=globalThis.My3D2dge,copy=structuredClone,axes=['x','y','z'];
const oldBytes=()=>gunzipSync(readFileSync(new URL('./fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString();
const inside=(p,b)=>{const q=localPoint(b.frame,p);return axes.every(k=>Math.abs(q[k])<=b.halfExtents[k]+1e-7);};

test('unchanged genuine PR9 whole Save and historical v1 rows remain exact after the v2 native correction',()=>{
  const bytes=oldBytes();assert.equal(createHash('sha256').update(bytes).digest('hex'),'2c3aa5309166cbb316838f5b2332165057671df8be8839d95424c5968d3bb76c');
  const s=Journey.restoreCampaign(bytes);assert.ok(s,'old whole graph restores without rewriting an old receipt');assert.equal(Journey.serializeCampaign(s),bytes);
  const p=trainRecord(s).train.preparation,old=copy(p.campSetup),site=old.sites['quarry-charge-worktop'];assert.equal(site.geometryVersion,undefined);assert.ok(site.bodyBounds.every(r=>r.geometryVersion===undefined));
  assert.ok(validatePreparationCampSetup(s,old));assert.ok(validatePreparationBodyBounds(s,site.bodyBounds));
  const fresh=capturePreparationBodyBounds(s);assert.ok(fresh.every(r=>r.geometryVersion===3));assert.ok(validatePreparationBodyBounds(s,fresh));
  const currentLegacy=capturePreparationBodyBounds(s,{geometryVersion:1});assert.ok(currentLegacy.every(r=>r.geometryVersion===undefined));assert.ok(validatePreparationBodyBounds(s,currentLegacy));assert.deepEqual(currentLegacy.find(r=>r.id==='levi').volumes,site.bodyBounds.find(r=>r.id==='levi').volumes,'explicit old pending-work capture retains exact v1 geometry');
  assert.notDeepEqual(fresh.find(r=>r.id==='levi').volumes,site.bodyBounds.find(r=>r.id==='levi').volumes,'the new native pose is different, while old evidence stays historical');
  assert.deepEqual(p.campSetup,old);assert.equal(Journey.serializeCampaign(s),bytes,'reading fresh geometry gives no migration, lead, fixture or duty');
  for(const receipt of Object.values(old.sites)){const forged=copy(old);forged.sites[receipt.siteId].geometryVersion=2;assert.equal(validatePreparationCampSetup(s,forged),false,'adding a marker cannot reinterpret old row geometry');}
});

test('v2 Levi compound follows the actual guard/rest native pose and keeps the owning foot prism',()=>{
  const s=Journey.restoreCampaign(oldBytes()),rows=capturePreparationBodyBounds(s),row=rows.find(r=>r.id==='levi'),parts=preparationNativeBodyParts(row,rows),body=s.entities.levi;
  assert.equal(row.pose.bound,true);assert.equal(row.binding.type,'rest');assert.ok(Object.isFrozen(parts));
  const h=createTrainHuman(E,body),rig=h.rig;rig.t=0;rig.phase=0;rig.facing=row.pose.facing;rig._cheat=0;rig.o.cheat=0;rig.downW=0;rig.poseW={cheer:0,cast:0,guard:1,kneel:0,crouch:0,wave:0,hips:0,block:0};rig._pose();lowerTorso(E,rig,5.5,0);boundRivalPose(E,rig);
  const root=row.point,head=rigWorldPoint(rig,root,'head'),hand=rigWorldPoint(rig,root,'handR');assert.ok(inside(head,parts.find(p=>p.id==='head')));assert.ok(inside(hand,parts.find(p=>p.id==='elbow-hand-R')));
  assert.deepEqual(parts.find(p=>p.id==='head').frame.origin,head,'same authored lowered head, not a standing substitute');
  const foot=parts.find(p=>p.id==='root-foot');assert.equal(foot.halfExtents.x,9);assert.equal(foot.halfExtents.y,9);assert.equal(foot.halfExtents.z,row.height/2);assert.ok(!parts.some(p=>p.id==='stride'),'a static rest anchor does not inherit old transport velocity as gait');
});

test('native compounds retain actual Inez/Thimble contact while removing opposing empty horse-envelope contacts',()=>{
  const s=Journey.restoreCampaign(oldBytes()),rows=capturePreparationBodyBounds(s),inez=rows.find(r=>r.id==='inez'),human=preparationNativeBodyParts(inez,rows),before=Journey.serializeCampaign(s),style=JSON.stringify(E.style);
  // These are actual unchanged positions in the earned old Save. SAT removes
  // only empty space inside coarse envelopes; native parts and feet stay full.
  for(const id of ['thimble','plover','tomas-mount']){const horse=rows.find(r=>r.id===id),parts=preparationNativeBodyParts(horse,rows);assert.equal(parts.find(p=>p.id==='root-foot').halfExtents.x,14);assert.ok(parts.length>=23);const contacts=preparationNativeBodyContacts(human,parts);if(id==='thimble'){assert.ok(contacts.length>0);assert.ok(contacts.every(c=>c.solidId==='root-foot'&&c.penetration<1));}else assert.deepEqual(contacts,[],id);}
  // Detached separation geometry only, not a performed move or positive Save.
  // Keep facing, all body pieces and both owning footprints unchanged.
  const shadow={...s,entities:{...s.entities,inez:{...s.entities.inez,y:s.entities.inez.y-2}}},after=capturePreparationBodyBounds(shadow),north=preparationNativeBodyParts(after.find(r=>r.id==='inez'),after);
  for(const id of ['thimble','plover','tomas-mount'])assert.deepEqual(preparationNativeBodyContacts(north,preparationNativeBodyParts(after.find(r=>r.id===id),after)),[],`two-unit unturned north separation clears ${id}`);
  assert.equal(Journey.serializeCampaign(s),before);assert.equal(JSON.stringify(E.style),style);
});

test('all native horse pieces and finite9/14foot sizes survive detached rotation probes without source mutation',()=>{
  const s=Journey.restoreCampaign(oldBytes()),original=Journey.serializeCampaign(s);
  for(let i=0;i<8;i++){
    // Detached geometry only: these headings do not earn a lead, move a live
    // registry actor, create a duty or prove a positive whole Save.
    const shadow={...s,entities:{...s.entities,skein:{...s.entities.skein,facing:i*Math.PI/4}}},rows=capturePreparationBodyBounds(shadow),r=rows.find(r=>r.id==='skein'),parts=preparationNativeBodyParts(r,rows);
    assert.ok(parts.every(p=>Object.isFrozen(p)&&p.vertices.every(v=>axes.every(k=>Number.isFinite(v[k])))));assert.ok(parts.some(p=>p.id==='tail'));assert.ok(parts.some(p=>p.id==='hoof-3'));assert.ok(parts.some(p=>p.id==='nose'));
    const foot=parts.find(p=>p.id==='root-foot');assert.equal(foot.halfExtents.x,14);assert.equal(foot.halfExtents.y,14);assert.ok(foot.halfExtents.z>=45);
    assert.deepEqual(parts.map(preparationPartBounds),r.volumes);assert.ok(validatePreparationBodyBounds(shadow,rows));
  }
  assert.equal(Journey.serializeCampaign(s),original);
});

test('new actual call introduces only explicit v2 clear sites and restores its whole graph',()=>{
  const s=acceptedBriefingNative();moveNative(s,{x:790,y:1205});Journey.interactCampaign(s,'train:prepare-call');for(let i=0;i<80&&!trainRecord(s).train.preparation.campSetup.sites['quarry-charge-worktop'];i++)Journey.stepCampaign(s,.05);
  const p=trainRecord(s).train.preparation;for(const site of ['quarry-charge-worktop','ada-mending-worktop']){assert.equal(p.campSetup.sites[site].geometryVersion,3);assert.ok(p.campSetup.sites[site].bodyBounds.every(r=>r.geometryVersion===3));}
  assert.equal(p.campSetup.sites['ruth-wiring-case-stand'],undefined,'new geometry grants no lead or case receipt');assert.equal(p.stableDuty,null);
  const bytes=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(bytes));assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(bytes)),bytes);
});

test('unknown or mixed geometry versions and invalid typed native data refuse instead of narrowing a shape',()=>{
  const s=Journey.restoreCampaign(oldBytes()),rows=capturePreparationBodyBounds(s);
  for(const mutate of [r=>r[0].geometryVersion=4,r=>delete r[0].geometryVersion,r=>r[0].pose.bound='yes',r=>r[0].pose.fear=NaN,r=>r.find(a=>a.id==='skein').radius=13]){const bad=copy(rows);mutate(bad);assert.equal(validatePreparationBodyBounds(s,bad),false);}
  const row=copy(rows.find(r=>r.id==='inez'));row.geometryVersion=1;assert.throws(()=>preparationNativeBodyParts(row,rows));
  const dead=copy(rows.find(r=>r.id==='neri'));dead.volumes[0].max.x=dead.volumes[0].min.x-1;assert.throws(()=>preparationNativeBodyParts(dead,rows));
  for(const target of [null,{x:null,y:1,z:2},{x:NaN,y:1,z:2}])assert.throws(()=>preparationNativeBodyParts(rows.find(r=>r.id==='inez'),rows,{contact:{target}}));
});

function yawFixture(){const s=Journey.restoreCampaign(oldBytes()),shadow={...s,entities:{...s.entities,skein:{...s.entities.skein,x:1000,y:900,facing:0,vx:0,vy:0}}},rows=capturePreparationBodyBounds(shadow);return{rows,row:rows.find(r=>r.id==='skein')};}
function panel(id,center,half){const shape=createHeldBox({id,frame:makeFrame(center,{x:1,y:0,z:0}),halfExtents:half});return compileHeldSolidSet([preparationPartSolid(shape,'fixture-panel')],{id});}
test('native yaw includes orbital part-centre motion through a thin panel with clear endpoints',()=>{
  // Detached rigid geometry only; no live animal, elapsed, duty or watch is
  // assigned. The head centre orbits the root instead of crossing its chord.
  const {rows,row}=yawFixture(),root=row.point,set=panel('thin-mid-orbit',{x:root.x,y:root.y+37,z:root.z+52},{x:1e-6,y:.01,z:.1}),from=preparationNativeBodyParts(row,rows),to=preparationNativeBodyParts({...row,pose:{...row.pose,facing:Math.PI}},rows);
  assert.ok(from.every(p=>!heldBoxContacts(p,set).length));assert.ok(to.every(p=>!heldBoxContacts(p,set).length));
  const before=JSON.stringify(rows),hit=sweepPreparationNativeYaw(row,rows,Math.PI,set);assert.equal(hit.clear,false);assert.ok(['contact','unresolved'].includes(hit.status));assert.equal(hit.solidId,'thin-mid-orbit');assert.equal(JSON.stringify(rows),before);
  const radius=Math.max(...from.flatMap(p=>p.vertices.map(v=>Math.hypot(v.x-root.x,v.y-root.y)))),far=panel('beyond-all-yaw',{x:root.x,y:root.y+radius+5,z:root.z+52},{x:.01,y:.01,z:.1});assert.equal(sweepPreparationNativeYaw(row,rows,Math.PI,far).clear,true,'a panel beyond every orbital corner is certified clear');
});

test('owning world-foot prism stays full and fixed while native body turns',()=>{
  const {rows,row}=yawFixture(),root=row.point,set=panel('fixed-foot-corner',{x:root.x+13,y:root.y+13,z:root.z+80},{x:.1,y:.1,z:.1}),before=JSON.stringify(rows),hit=sweepPreparationNativeYaw(row,rows,Math.PI/2,set);
  assert.equal(hit.clear,false);assert.equal(hit.partId,'root-foot');assert.equal(hit.status,'contact');assert.equal(JSON.stringify(rows),before);
});

test('yaw refuses absent/copied solid authority, nonfinite or ambiguous turns and unresolved interval budgets',()=>{
  const {rows,row}=yawFixture(),set=panel('far',{x:1500,y:1300,z:20},{x:1,y:1,z:1});
  for(const world of [null,{}, {...set}])assert.throws(()=>sweepPreparationNativeYaw(row,rows,1,world));
  for(const angle of [NaN,Infinity,2*Math.PI])assert.throws(()=>sweepPreparationNativeYaw(row,rows,angle,set));
  for(const options of [{spatialTolerance:0},{maxIntervals:0},{maxIntervals:NaN}])assert.throws(()=>sweepPreparationNativeYaw(row,rows,1,set,options));
  const root=row.point,near=panel('mid',{x:root.x,y:root.y+37,z:52},{x:.001,y:.001,z:.001}),limited=sweepPreparationNativeYaw(row,rows,Math.PI,near,{maxIntervals:1});assert.equal(limited.clear,false);assert.equal(limited.status,'unresolved');
});
