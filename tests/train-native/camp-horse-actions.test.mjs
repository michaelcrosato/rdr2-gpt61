import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Journey,moveNative} from '../helpers/train-preparation-route.mjs';
import {getCampaignPresentation,emitCampaignPresentation} from '../../src/campaign.js';
import {getTrainCampHorseInteractions,interactTrainCampHorse} from '../../src/train-camp-horse-actions.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
const original=()=>gunzipSync(readFileSync(new URL('../fixtures/train-preparation-pr9-mask-owned-bring.json.gz',import.meta.url))).toString();
const ctx={worldFor:Journey.worldForCampaign,present:emitCampaignPresentation};
let nearBytes;
function offeredBaseline(s){assert.ok(getTrainCampHorseInteractions(s,ctx).some(o=>o.id==='train:mount-copper'),`genuine call/approach has not earned clear mount: ${JSON.stringify({mara:{x:s.player.x,y:s.player.y},copper:{x:s.horse.x,y:s.horse.y,facing:s.horse.facing,vx:s.horse.vx,vy:s.horse.vy}})}`);return s;}
function besideCopper(){if(nearBytes){const s=Journey.restoreCampaign(nearBytes);assert.ok(s);return offeredBaseline(s);}const raw=original(),s=Journey.restoreCampaign(raw);assert.ok(s);assert.equal(Journey.serializeCampaign(s),raw,'original earned PR9 mask graph remains unchanged on read');const h=s.entities.copper;
  // The unchanged earned save really parks Copper partly through Plover. Use
  // the actual named owned-follow command and native separation, never move
  // either horse or a helper by fixture assignment to manufacture a mount.
  moveNative(s,{x:600,y:1330,z:0});Journey.whistleCampaign(s);for(let i=0;i<100&&(Math.hypot(s.player.x-h.x,s.player.y-h.y)>82.1||Math.hypot(h.vx||0,h.vy||0)>.01);i++)Journey.stepCampaign(s,.05);
  assert.equal(s.campaign.missions[TRAIN_ID].train.preparation.copperRecovery?.status,'clear','the original contact episode must finish before mount');moveNative(s,{x:h.x+28,y:h.y,z:0});Journey.stepCampaign(s,.05);assert.ok(Math.hypot(s.player.x-h.x,s.player.y-h.y)<=58);nearBytes=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(nearBytes));return offeredBaseline(s);}
const preserved=s=>JSON.stringify({rival:s.campaign.missions['snowbound-the-names-they-took'],items:s.itemInstances,weapons:s.weapons,inventory:s.inventory,party:s.party,horse:{...s.entities.copper,hitched:undefined},stats:s.stats});
function mount(s){assert.ok(getTrainCampHorseInteractions(s,ctx).some(o=>o.id==='train:mount-copper'));assert.equal(interactTrainCampHorse(s,'train:mount-copper',ctx),true);return s;}

test('unchanged earned PR9 mask journey walks to canonical Copper, accepts named mount, whole Saves and accepts a real clear dismount',()=>{
  let s=besideCopper();const before=preserved(s),pBefore={x:s.player.x,y:s.player.y,z:s.player.z,facing:s.player.facing},horseBefore={x:s.horse.x,y:s.horse.y,z:s.horse.z},elapsed=s.elapsed;
  const offer=getTrainCampHorseInteractions(s,ctx)[0];assert.equal(offer.id,'train:mount-copper');assert.equal(offer.targetId,'copper');assert.equal(offer.label,'Mount Copper');mount(s);
  assert.equal(s.player.mounted,true);assert.equal(s.player.mountId,'copper');assert.deepEqual({x:s.player.x,y:s.player.y,z:s.player.z},horseBefore);assert.deepEqual({x:s.horse.x,y:s.horse.y,z:s.horse.z},horseBefore,'mounting never moves the horse to repair a binding');assert.equal(s.elapsed,elapsed);assert.equal(preserved(s),before);
  const event=getCampaignPresentation(s).events.at(-1);assert.equal(event.kind,'mount');assert.equal(event.actorId,'mara');assert.equal(event.targetId,'copper');assert.deepEqual(event.from,pBefore);assert.equal(event.target.z,horseBefore.z+23);
  const mounted=Journey.serializeCampaign(s);s=Journey.restoreCampaign(mounted);assert.ok(s,'entire mounted graph restores');assert.equal(Journey.serializeCampaign(s),mounted);assert.equal(s.player.mounted,true);
  assert.ok(getTrainCampHorseInteractions(s,ctx).some(o=>o.id==='train:dismount-copper'));assert.equal(interactTrainCampHorse(s,'train:dismount-copper',ctx),true);assert.equal(s.player.mounted,false);assert.ok(Math.hypot(s.player.x-s.horse.x,s.player.y-s.horse.y)>=27-1e-7);assert.deepEqual({x:s.horse.x,y:s.horse.y,z:s.horse.z},horseBefore);assert.equal(preserved(s),before);
  const down=getCampaignPresentation(s).events.at(-1);assert.equal(down.kind,'dismount');assert.equal(down.from.z,horseBefore.z+23);assert.deepEqual({x:down.target.x,y:down.target.y,z:down.target.z},{x:s.player.x,y:s.player.y,z:s.player.z});const unmounted=Journey.serializeCampaign(s);assert.ok(Journey.restoreCampaign(unmounted));assert.equal(Journey.serializeCampaign(Journey.restoreCampaign(unmounted)),unmounted);
  // This proves the functional legacy binding action, its real native clear
  // endpoints and whole Save. It is not complete transition-animation physics.
});

test('mount requires actual named owned party Copper, alive/free actors, actual collision authority and presentation commit',()=>{
  const good=besideCopper();for(const mutate of [s=>s.entities.copper.owned=false,s=>s.party.mountId='thimble',s=>s.entities.copper.hp=0,s=>s.entities.mara.hp=0,s=>s.entities.copper.vx=20,s=>s.entities.mara.toolHeld='foreign-tool',s=>s.entities.mara.weaponAction={kind:'busy'},s=>s.entities.mara.carrying='gideon',s=>s.entities.copper.attachment={type:'rest',targetId:'missing',regionId:'snowbound'},s=>s.campaign.missions[TRAIN_ID].mission.stage=1]){const s=Journey.restoreCampaign(Journey.serializeCampaign(good));mutate(s);const before=JSON.stringify(s);assert.deepEqual(getTrainCampHorseInteractions(s,ctx),[]);assert.equal(interactTrainCampHorse(s,'train:mount-copper',ctx),false);assert.equal(JSON.stringify(s),before,'negative staged inputs are not repaired');}
  for(const world of [null,{id:'wrong',width:1800,height:1400,obstacles:[]},{...Journey.worldForCampaign(good),obstacles:[]},{...Journey.worldForCampaign(good),obstacles:[{id:'bad',x:0,y:0,w:NaN,h:1}]}]){const before=Journey.serializeCampaign(good),bad={...ctx,worldFor:()=>world};assert.deepEqual(getTrainCampHorseInteractions(good,bad),[]);assert.equal(interactTrainCampHorse(good,'train:mount-copper',bad),false);assert.equal(Journey.serializeCampaign(good),before);}
  const before=Journey.serializeCampaign(good);assert.equal(interactTrainCampHorse(good,'train:mount-copper',{worldFor:Journey.worldForCampaign}),false);assert.equal(Journey.serializeCampaign(good),before);
});

test('a real world wall or registered corpse blocks the binding and all unavailable dismount sides without hidden-body exemptions',()=>{
  const s=besideCopper(),world=Journey.worldForCampaign(s),h=s.horse,blocked={...ctx,worldFor:()=>({...world,obstacles:[...world.obstacles,{id:'staged-blocker',x:h.x-60,y:h.y-60,z:0,w:120,h:120,height:100}]})},before=Journey.serializeCampaign(s);assert.deepEqual(getTrainCampHorseInteractions(s,blocked),[]);assert.equal(interactTrainCampHorse(s,'train:mount-copper',blocked),false);assert.equal(Journey.serializeCampaign(s),before);
  mount(s);const mounted=Journey.serializeCampaign(s);assert.deepEqual(getTrainCampHorseInteractions(s,blocked),[]);assert.equal(interactTrainCampHorse(s,'train:dismount-copper',blocked),false);assert.equal(Journey.serializeCampaign(s),mounted);
  const negative=Journey.restoreCampaign(mounted);Object.assign(negative.entities.neri,{x:h.x,y:h.y,z:0,hidden:true});const snapshot=JSON.stringify(negative);assert.deepEqual(getTrainCampHorseInteractions(negative,ctx),[]);assert.equal(interactTrainCampHorse(negative,'train:dismount-copper',ctx),false);assert.equal(JSON.stringify(negative),snapshot,'staged corpse obstruction never produces a positive actor placement');
});

test('invalid mounted co-location is refused unchanged instead of snapping Mara or Copper into agreement',()=>{
  const s=mount(besideCopper());s.player.x+=1;const before=JSON.stringify(s);assert.deepEqual(getTrainCampHorseInteractions(s,ctx),[]);assert.equal(interactTrainCampHorse(s,'train:dismount-copper',ctx),false);assert.equal(interactTrainCampHorse(s,'train:mount-copper',ctx),false);assert.equal(JSON.stringify(s),before);
});
