/** The Names They Took: original operation authoring.
 * All positions are absolute ground units, z is ground elevation. These identities,
 * quantities and balance values are original; data does not establish source acceptance.
 * Every enemy exists before combat. Runtime owns presence, wounds, pockets and custody.
 */
export const RIVAL_ID = 'snowbound-the-names-they-took';

export const RIVAL_PARTY = [
  { actorId:'tomas', mountId:'tomas-mount', name:'Tomas Reed', duty:'lead', formation:{x:0,y:-58}, coverId:'tomas-ready' },
  { actorId:'inez', mountId:'thimble', name:'Inez Pike', duty:'mount-line', formation:{x:48,y:48}, coverId:'mount-line-east' },
  { actorId:'ruth', mountId:'plover', name:'Ruth Arlow', duty:'powder', formation:{x:-48,y:48}, coverId:'ruth-west' },
  { actorId:'bastian', mountId:'cinder', name:'Bastian Holt', duty:'west-assault', formation:{x:-48,y:112}, coverId:'bastian-west' },
  { actorId:'emmett', mountId:'button', name:'Emmett Rowan', duty:'survey-and-mounts', formation:{x:48,y:112}, coverId:'mount-line-west' },
];

export const RIVAL_STAGES = [
  'Enter the stove room. Intervene in Ruth and Bastian’s quarrel, hear the expedition, and decide whether to accept.',
  'Meet Tomas at Copper’s rack. Receive the Tern carbine, counted cartridges, lariat and sightglass; choose and retrieve your equipment.',
  'Ride with all five companions through the south snow gate. Inspect the cart grooves, hoofprints and branch trail before reaching the ridge.',
  'Dismount, reach the viewpoint and raise the sightglass. Observe Levi and Calder, watch the departure, and identify the magazine, weighhouse and screened entry.',
  'Follow Tomas down the screened chute. Let Ruth and Bastian take west cover, leave the mount line to Inez and Emmett, then choose the first shot from ready cover.',
  'Clear the traverser and gallery with the expedition. Sweep the focus reticle across visible targets, resolve the real defenders and protect the party.',
  'Search reachable bodies or surrendering guards. Read what they carried; watch the existing woodland scouts approaching the yard.',
  'Choose to hold the wheels or meet the trees. Resolve both wooded approaches and the reserve while companions follow their separate routes.',
  'Search the powder magazine and inspect four charges with Ruth. Let Bastian search the weighhouse and hand over the diagram; retrieve the cap tin and bring the mounts down.',
  'Remount and leave as a convoy with the recovered cargo. Cross the pulley creek and see Levi recognize the party and flee on Skein.',
  'Pursue Levi through the ice crossing and forks. Throw and hold a real lariat or catch him on foot, then approach and bind him.',
  'Lift Levi, secure him at Copper’s rear and ride to camp. Answer his questions while protecting the actual passenger, mounts and cargo.',
  'Unload Levi and carry him through the tack-room doorway. Question the signatures, choose real care or deprivation, and help Ruth and Hob move him to guarded holding.',
  'Store the sealed charges under Ruth’s custody, record the recovered property and Levi’s name, and let every surviving person and mount settle into camp.',
];

export const RIVAL_STAGE_DETAILS = [
  { stage:0,id:'stove-room',name:'The stove-room argument',actors:['mara','ruth','bastian','emmett','inez','tomas'],required:['enter:stove-room','intervene:quarrel','hear:expedition','accept:rival'],optional:['ask:tomas-motive','decline:rival','hear:resident-reactions'],minorBeats:['rescue completion gates acceptance','Bastian’s strike and Inez’s intervention involve actual participants','deferred acceptance grants nothing','Ruth and Emmett retain separate relationship responses'] },
  { stage:1,id:'seven-chambers',name:'Seven chambers and a length of rope',actors:['mara','tomas','ruth','inez','copper'],required:['rack:inspect-tern','receive:cartridges','receive:lariat','receive:sightglass','equip:longarm','depart:bellwether'],optional:['rack:store-tern','equip:sidearm','postpone:departure','ask:equipment-again'],checkpoint:'equipment-secured',minorBeats:['exactly seven loaded and forty-two reserve cartridges once','each gift has one owner','existing bow and coach gun retained','stored weapon recovery and lawful unavailable-mount handling'] },
  { stage:2,id:'marks-below-drift',name:'Marks below the drift',actors:['mara','tomas','inez','ruth','bastian','emmett','copper','tomas-mount','thimble','plover','cinder','button'],required:['depart:snow-gate','inspect:cart-grooves','inspect:return-hooves','inspect:branch-trail','arrive:ridge'],optional:['inspect:wrong-fork','rejoin:party','rest:mounts'],minorBeats:['six separate riders and mounts travel','conversation pauses for separation','wrong fork leads to a return route','mount wounds, stamina and care remain real'] },
  { stage:3,id:'weight-on-card',name:'The weight on the card',actors:['mara','tomas','calder','levi','grout','skein'],required:['dismount:ridge','walk:viewpoint','raise:sightglass','observe:card-and-strike','observe:calder-departure','identify:magazine','identify:weighhouse','identify:screened-entry'],optional:['pan:sightglass','zoom:sightglass','ask:levi','ask:calder'],checkpoint:'before-screened-descent',minorBeats:['held tool gates observation','moving outgoing identities beyond weapon reach','early exposure fails and restores actual checkpoint','separate west pair and mount-line pair assignments'] },
  { stage:4,id:'sled-gallery',name:'Beneath the sled gallery',actors:['mara','tomas','ruth','bastian','inez','emmett'],required:['descend:screened-chute','cross:gallery-shadow','party:ready-cover','choose:first-shot'],optional:['open:mara','open:tomas','fire:ready-cover','rack:recover-longarm'],checkpoint:'at-first-shot-cover',minorBeats:['steep screened foot route differs from east horse ramp','enemy hearing and sightlines before readiness','premature fire failure differs from allowed reprimanded shot','allies occupy their own cover points'] },
  { stage:5,id:'clear-traverser',name:'Clear the traverser',actors:['mara','tomas','ruth','bastian','inez','emmett'],required:['resolve:initial-yard','teach:automatic-focus'],optional:['focus:sweep-three','disarm:engraved-revolver','recognize:released-pavel','accept:surrender','pursue:retreat'],checkpoint:'after-first-battle',minorBeats:['thirteen original yard defenders plus conditional existing Pavel','ammo, reload, cover and real projectile intersections','ally damage and kills are authoritative','disarm/grapple/acquisition variation owns one engraved weapon','no stage quota substitutes for finite resolution'] },
  { stage:6,id:'pocket-account',name:'What a pocket will buy',actors:['mara','tomas','ruth','bastian','emmett'],required:['search:reachable-body-or-surrender','observe:patrol-warning'],optional:['read:quarry-letter','search:remaining-bodies','search:living-guard'],checkpoint:'at-patrol-warning',minorBeats:['per-body finite inventory transfers','living surrendered search uses its own verb','unsearched bodies remain','preexisting scouts move in response to hearing and elapsed battle time'] },
  { stage:7,id:'wheels-or-trees',name:'Hold the wheels or meet the trees',actors:['mara','tomas','ruth','bastian','inez','emmett'],required:['choose:patrol-tactic','resolve:west-patrol','resolve:east-patrol','resolve:reserve','clear:horse-ramp'],optional:['tactic:hold','tactic:advance','pursue:retreat','accept:patrol-surrender'],checkpoint:'after-reinforcements',minorBeats:['four west and four east identities plus four later reserve','two tactics change cover and route positions','reserve arrives physically through north timber gap','retreated identities persist','two mount paths remain navigable after combat'] },
  { stage:8,id:'three-searches',name:'The three searches',actors:['mara','tomas','ruth','bastian','inez','emmett'],required:['open:charge-crate','inspect:four-charges','handoff:inspection-charge','repack:charge-crate','ruth:carry-crate','search:cap-wagon','bastian:search-weighhouse','handoff:diagram-and-list','mounts:descend-east-ramp'],optional:['read:route-diagram','read:seizure-list','inspect:magazine-shelves'],checkpoint:'before-convoy-departure',minorBeats:['magazine, cap wagon and weighhouse distinct physical sites','charge, cap and paper custody independent','charge inspection hands meet actual crate and Ruth','Emmett checks diagram scale','Inez leads actual mounts down clear ramp'] },
  { stage:9,id:'six-tracks-home',name:'Six tracks home',actors:['mara','tomas','inez','ruth','bastian','emmett','levi','skein'],required:['mount:convoy','depart:works','ride:pulley-creek','see:levi-recognition','start:levi-chase'],optional:['challenge:no-one-lost','talk:hunt-first','talk:rival-first','rest:loaded-mounts'],checkpoint:'at-chase-start',minorBeats:['Ruth carries sealed equipment and actual six riders return','injury claims read authoritative wounds','food/hides/Juno rest only referenced if Hunt completed','Levi and Skein physically enter visible escape route','capture clock starts at flight rather than battle'] },
  { stage:10,id:'end-of-rope',name:'A person at the end of the rope',actors:['mara','copper','levi','skein','inez'],required:['pursue:levi','restrain:levi','approach:levi','bind:levi'],optional:['capture:lariat','capture:tackle','recover:missed-rope','release:slack','recover:skein'],checkpoint:'after-secured-capture',minorBeats:['two lane forks and physical ice crossing','rope obstruction, range and tension matter','on-foot capture if mount wounded or dead','Levi never becomes hostile to justify killing','binding timestamp follows real approach and timed knot work'] },
  { stage:11,id:'load-that-answers',name:'The load that answers',actors:['mara','copper','levi','inez','skein'],required:['lift:levi','approach:copper-rear','stow:bound-passenger','fasten:strap','ride:snow-gate','return:camp'],optional:['answer:assurance','answer:threat','check:bindings','recover:dropped-levi','take:short-detour'],checkpoint:'before-tack-room-questioning',minorBeats:['one authoritative carried/rear body','rear large-load capacity conflicts remain real','burden changes riding and escort pressure','short detours recoverable before prolonged abandonment','Skein outcome and ownership preserved'] },
  { stage:12,id:'doorway-question',name:'The question at the doorway',actors:['mara','levi','della','bastian','tomas','ruth','hob'],required:['dismount:camp','unload:levi','carry:tack-doorway','question:debt-card','question:signatures','choose:holding-care','handoff:ruth-and-hob','secure:holding-anchor'],optional:['care:food-and-blanket','care:looser-restraints','care:no-stock-assurance','deprive:levi','object:bastian','check:breathing'],minorBeats:['doorway and two-helper handoffs physically performed','diagram/list gate corroborated answers','uncertain testimony remains uncertain','care consumes available stock once','holding anchor guarded and captive trust persistent'] },
  { stage:13,id:'write-every-name',name:'Write every name',actors:['mara','della','ruth','tomas','inez','bastian','emmett','levi'],required:['store:sealed-equipment','record:property','record:levi-name','settle:party-and-mounts','finish:rival'],optional:['visit:levi-first','visit:levi-second','pause:next-readiness'],minorBeats:['exactly-once custody/deposits/reward','camp locations retain wounds and mortality','rival-first holding visits remain available before Hunt','Hunt AND rival prerequisite without fake next mission','complete aftermath survives canonical saves and historical replay'] },
];

export const RIVAL_ITEMS = {
  ternCarbine:{name:'Tern lever carbine',description:'A seven-chamber carbine delivered to Copper’s rack, with one recorded owner.'},
  ternCartridge:{name:'Tern cartridge',description:'Counted carbine ammunition, separate from revolver and coach-gun cartridges.'},
  lariat:{name:'Inez’s working lariat',description:'A coiled rope that must reach, catch and hold a physical target before binding.'},
  sightglass:{name:'Brass sightglass',description:'A held observation tool with pan and zoom; unseen events reveal no facts.'},
  chargeCrate:{name:'Sealed quarry-charge crate',description:'Four inspected quarry charges travel under Ruth’s custody for later preparation.'},
  sealedCharge:{name:'Waxed quarry charge',description:'One of four uniquely identified charges; inspection and repacking preserve its identity.'},
  capTin:{name:'Copper cap tin',description:'A separate sealed primer tin recovered from the cap wagon and checked by Ruth.'},
  routeDiagram:{name:'Bond-and-deed train diagram',description:'An original surveyed diversion diagram recovered from the weighhouse and handed to Tomas.'},
  seizureList:{name:'Duplicate seizure list',description:'Addresses and signatures whose duplicate entries reveal the intended double sale.'},
  debtCard:{name:'Levi Senn’s torn debt card',description:'Levi’s own payment record; its rent total can be compared with the seizure list.'},
  quarryLetter:{name:'Unsent quarry letter',description:'A former worker’s letter about his children and wages, recovered from his actual pocket.'},
  engravedRevolver:{name:'Bastian’s engraved revolver',description:'One polished six-shot weapon whose theft, recovery and ownership must be recorded.'},
};

export const RIVAL_CARBINE = {id:'tern-carbine',name:'Tern lever carbine',kind:'carbine',owner:'mara',ammoType:'tern-cartridge',capacity:7,ammo:7,reserve:42,condition:1,sourceId:'tomas',location:'saddle',rackMountId:'copper',cadence:.52,reloadCadence:.56,recoil:.65,spread:.017,range:690,muzzleHeight:44};
export const RIVAL_ENCOUNTER_WEAPON = {id:'bastian-engraved-revolver',name:'Bastian’s engraved revolver',kind:'revolver',owner:'bastian',ammoType:'revolver-round',capacity:6,ammo:6,reserve:24,condition:1,location:'carried'};

export const RIVAL_CAST = [
  {id:'ruth',name:'Ruth Arlow',role:'former cooperative powder keeper',x:540,y:1070,z:0,hp:100,faction:'camp',regionId:'snowbound',facing:0,protected:true,rig:{coat:'#57634b',hat:'#6b5b42',hair:'#adac9b',skin:'#a87455',accessory:'powder-gloves',voiceId:'ruth-low-measured'},portrait:{backdrop:'#514b39',accent:'#c2a66a'},scheduleId:'ruth-powder-care'},
  {id:'bastian',name:'Bastian Holt',role:'contracted scout and impatient west assault',x:575,y:1080,z:0,hp:100,faction:'camp',regionId:'snowbound',facing:Math.PI,protected:true,rig:{coat:'#5c3c33',hat:'#47382e',hair:'#312a26',skin:'#c29573',accessory:'polished-revolver',voiceId:'bastian-sharp-quick'},portrait:{backdrop:'#503b37',accent:'#bd9674'},scheduleId:'bastian-scout-round'},
  {id:'emmett',name:'Emmett Rowan',role:'survey assistant and branch-trail reader',x:545,y:1120,z:0,hp:100,faction:'camp',regionId:'snowbound',facing:-Math.PI/2,protected:true,rig:{coat:'#3d5962',hat:'#665747',hair:'#8a5031',skin:'#d4ad8a',accessory:'patched-survey-case',voiceId:'emmett-young-cautious'},portrait:{backdrop:'#394f5a',accent:'#bca379'},scheduleId:'emmett-map-table'},
  {id:'levi',name:'Levi Senn',age:24,role:'compelled farrier’s assistant and warrant copyist',x:1810,y:1240,z:0,hp:100,faction:'claimant-captive',regionId:'bellwether-works',facing:Math.PI,hidden:false,hostile:false,rig:{coat:'#6c675b',hat:null,hair:'#3b2e26',skin:'#b98863',accessory:'farrier-apron',voiceId:'levi-breath-short'},portrait:{backdrop:'#5a5d58',accent:'#b9a179'},mountId:'skein',captivity:{bound:false,bindings:0,trust:0,hunger:0,statements:[],holdingTime:0}},
  {id:'calder',name:'Rafe Calder',role:'Claimant commander and foreclosure negotiator',x:1760,y:1240,z:0,hp:120,faction:'claimants',regionId:'bellwether-works',facing:0,hidden:false,hostile:false,rig:{coat:'#303b39',hat:'#242c2a',hair:'#747467',skin:'#b58e73',accessory:'green-warrant-wallet',voiceId:'calder-cold-even'},portrait:{backdrop:'#343e39',accent:'#a1b197'},mountId:'grout'},
  {id:'plover',name:'Plover',kind:'horse',role:'Ruth’s dun gelding',x:565,y:1175,z:0,hp:100,stamina:100,fear:0,bond:3,owned:true,ownerId:'ruth',hitched:true,pack:{},regionId:'snowbound',coat:'dun',marking:'black-dorsal-stripe',sex:'gelding'},
  {id:'cinder',name:'Cinder',kind:'horse',role:'Bastian’s dark chestnut mare',x:630,y:1175,z:0,hp:100,stamina:100,fear:0,bond:2,owned:true,ownerId:'bastian',hitched:true,pack:{},regionId:'snowbound',coat:'dark-chestnut',marking:'narrow-white-blaze',sex:'mare'},
  {id:'button',name:'Button',kind:'horse',role:'Emmett’s brown roan gelding',x:690,y:1175,z:0,hp:100,stamina:100,fear:0,bond:3,owned:true,ownerId:'emmett',hitched:true,pack:{},regionId:'snowbound',coat:'brown-roan',marking:'white-right-hind-sock',sex:'gelding'},
  {id:'skein',name:'Skein',kind:'horse',role:'Levi’s pale bay mare with a split ear',x:1850,y:1250,z:0,hp:100,stamina:100,fear:12,bond:3,owned:true,ownerId:'levi',hitched:false,pack:{},regionId:'bellwether-works',coat:'pale-bay',marking:'split-left-ear',sex:'mare'},
  {id:'grout',name:'Grout',kind:'horse',role:'Calder’s iron-gray gelding',x:1730,y:1200,z:0,hp:100,stamina:100,fear:0,bond:3,owned:true,ownerId:'calder',hitched:false,pack:{},regionId:'bellwether-works',coat:'iron-gray',marking:'dark-muzzle',sex:'gelding'},
];

const defender = (id,name,role,x,y,extra={}) => {
  const actor = {id,name,kind:'claimant',role,x,y,z:0,hp:90,facing:Math.PI,faction:'claimants',regionId:'bellwether-works',active:false,hidden:false,wave:'yard',fireTimer:1.8,routeIndex:0,lifeState:'alive',resolution:null,ammo:7,reserve:14,weapon:{id:`${id}-weapon`,kind:'carbine',ammoType:'tern-cartridge',capacity:7,ammo:7,reserve:14,owner:id},loot:{money:12,ammunition:{'tern-cartridge':5},objects:[]},...extra};
  if(actor.group) actor.wave=actor.group;
  actor.loot.cartridges=actor.loot.ammunition['tern-cartridge']||0;
  actor.loot.keepsake=actor.loot.objects[0]||null;
  return actor;
};

export const RIVAL_ENEMIES = [
  defender('bellwether-gallery-watch','Sled-gallery watcher','tower-watcher',1530,1100,{z:32,hp:85,coverId:'gallery-watch-cover',behavior:'observe-then-crossfire',loot:{money:18,ammunition:{'tern-cartridge':6},objects:[]}}),
  defender('bellwether-scale-watch','Scale-house watcher','tower-watcher',2190,1370,{z:32,hp:85,coverId:'scale-watch-cover',behavior:'observe-then-crossfire'}),
  defender('bellwether-wheel-left','West wheel-well guard','low-cover-defender',1450,1290,{coverId:'wheel-well-west',behavior:'peek-and-reload'}),
  defender('bellwether-wheel-right','East wheel-well guard','low-cover-defender',1730,1330,{coverId:'wheel-well-east',behavior:'peek-and-reload'}),
  defender('bellwether-pusher-west','West traverser rifleman','pushing-rifleman',1370,1210,{coverId:'west-rail-cart',behavior:'push-between-cover'}),
  defender('bellwether-pusher-east','East traverser rifleman','pushing-rifleman',1900,1270,{coverId:'east-rail-cart',behavior:'push-between-cover'}),
  defender('bellwether-gallery-flank','Gallery-side flanker','flanker',1660,1030,{routeId:'galleryFlank',behavior:'gallery-crossfire'}),
  defender('bellwether-creek-flank','Pulley-creek flanker','flanker',2170,1580,{routeId:'creekFlank',behavior:'creek-crossfire'}),
  defender('bellwether-magazine-sentry','Powder-shelf sentry','low-cover-defender',2100,980,{coverId:'magazine-screen',behavior:'guard-essential-equipment',loot:{money:8,ammunition:{'tern-cartridge':4},objects:[]}}),
  defender('bellwether-weighhouse-guard','Account-room guard','low-cover-defender',2080,1465,{coverId:'weighhouse-door-cover',behavior:'defend-doorway',loot:{money:22,ammunition:{'tern-cartridge':4},objects:['account-key']}}),
  defender('bellwether-shed-guard','Quarry shed guard','surrender-capable',1200,1590,{coverId:'shed-timber',behavior:'surrender-when-isolated',loot:{money:6,ammunition:{'tern-cartridge':3},objects:['quarry-letter']}}),
  defender('bellwether-runner','Claimant message runner','runner',1850,1160,{routeId:'initialRetreat',behavior:'warn-reserve-or-retreat',hp:75,loot:{money:10,ammunition:{'tern-cartridge':2},objects:['patrol-roster']}}),
  defender('bellwether-revolver-thief','West-yard grappler','disarm-grappler',1310,1320,{coverId:'west-cart-wheel',behavior:'steal-bastian-weapon-when-disarmed',hp:100,loot:{money:14,ammunition:{'tern-cartridge':3},objects:[]}}),
  defender('bellwether-west-scout-1','West timber scout','patrol-scout',420,700,{group:'west',wave:1,routeId:'patrolWest',hearingRadius:1900,behavior:'hear-and-advance',loot:{money:10,ammunition:{'tern-cartridge':4},objects:[]}}),
  defender('bellwether-west-scout-2','West ridge scout','patrol-scout',450,650,{group:'west',wave:1,routeId:'patrolWest',hearingRadius:1900,behavior:'hear-and-flank'}),
  defender('bellwether-west-rifle-1','West timber rifleman','pushing-rifleman',390,670,{group:'west',wave:1,routeId:'patrolWest',behavior:'advance-behind-scout'}),
  defender('bellwether-west-rifle-2','West reload guard','low-cover-defender',375,720,{group:'west',wave:1,routeId:'patrolWest',behavior:'bound-between-cover'}),
  defender('bellwether-east-scout-1','East creek scout','patrol-scout',2720,750,{group:'east',wave:1,routeId:'patrolEast',hearingRadius:1900,behavior:'hear-and-advance'}),
  defender('bellwether-east-scout-2','East cedar scout','patrol-scout',2760,800,{group:'east',wave:1,routeId:'patrolEast',hearingRadius:1900,behavior:'hear-and-flank'}),
  defender('bellwether-east-rifle-1','East timber rifleman','pushing-rifleman',2780,740,{group:'east',wave:1,routeId:'patrolEast',behavior:'advance-behind-scout'}),
  defender('bellwether-east-rifle-2','East reload guard','low-cover-defender',2800,840,{group:'east',wave:1,routeId:'patrolEast',behavior:'bound-between-cover'}),
  defender('bellwether-reserve-lead','Northern reserve leader','patrol-leader',1660,210,{group:'reserve',wave:2,routeId:'patrolReserve',behavior:'delayed-reserve-push',hp:105,loot:{money:24,ammunition:{'tern-cartridge':8},objects:['reserve-order']}}),
  defender('bellwether-reserve-rifle-1','Northern reserve rifleman','pushing-rifleman',1710,230,{group:'reserve',wave:2,routeId:'patrolReserve',behavior:'delayed-reserve-push'}),
  defender('bellwether-reserve-rifle-2','Northern reserve flanker','flanker',1610,240,{group:'reserve',wave:2,routeId:'patrolReserve',behavior:'reserve-east-flank'}),
  defender('bellwether-reserve-runner','Northern reserve runner','runner',1690,170,{group:'reserve',wave:2,routeId:'patrolReserve',behavior:'retreat-when-reserve-broken',hp:75}),
];

const trail = [{x:340,y:2180,z:0},{x:475,y:2010,z:0},{x:590,y:1810,z:0},{x:710,y:1640,z:0},{x:790,y:1440,z:0},{x:840,y:1310,z:36},{x:890,y:1180,z:72}];
const horseRamp = [{x:890,y:1180,z:72},{x:960,y:1040,z:72},{x:960,y:930,z:72},{x:1090,y:960,z:72},{x:1240,y:950,z:48},{x:1500,y:920,z:24},{x:1800,y:950,z:0},{x:1880,y:1030,z:0},{x:1840,y:1240,z:0},{x:1860,y:1600,z:0}];
const returnRoute = [{x:1860,y:1600,z:0},{x:1780,y:1730,z:0},{x:1570,y:1830,z:0},{x:1320,y:1880,z:0},{x:1160,y:1950,z:0},{x:960,y:2060,z:0},{x:730,y:2110,z:0},{x:520,y:2190,z:0},{x:340,y:2180,z:0}];
const patrolWest = [{x:420,y:700,z:0},{x:580,y:850,z:0},{x:790,y:940,z:0},{x:1050,y:960,z:0},{x:1170,y:1040,z:0},{x:1260,y:1180,z:0},{x:1350,y:1280,z:0}];
const patrolEast = [{x:2720,y:750,z:0},{x:2620,y:970,z:0},{x:2440,y:1080,z:0},{x:2300,y:1210,z:0},{x:2250,y:1450,z:0},{x:2090,y:1580,z:0},{x:1860,y:1570,z:0}];
const patrolReserve = [{x:1660,y:210,z:0},{x:1770,y:420,z:0},{x:1870,y:640,z:0},{x:1810,y:850,z:0},{x:1700,y:1000,z:0},{x:1680,y:1170,z:0}];
const chaseMain = [{x:1310,y:1880,z:0},{x:1210,y:1940,z:0},{x:1090,y:1990,z:0},{x:1000,y:2110,z:0},{x:875,y:2170,z:0},{x:790,y:2200,z:0},{x:660,y:2240,z:0},{x:540,y:2250,z:0}];

export const RIVAL_WORLD = {
  id:'bellwether-works',width:3000,height:2400,
  entry:{id:'bellwether-south-gate',x:340,y:2180,z:0},
  travelGate:{id:'bellwether-camp-gate',regionId:'snowbound',x:800,y:760,z:0,name:'Bellwether cart trail'},
  places:[
    {id:'bellwether-south-gate',name:'South Snow Gate',x:340,y:2180},
    {id:'cart-fork',name:'Branched Cart Trail',x:710,y:1640},
    {id:'observation-ridge',name:'West Observation Ridge',x:890,y:1180,z:72},
    {id:'bellwether-viewpoint',name:'Surveyor’s Viewpoint',x:1000,y:1050,z:72},
    {id:'screened-chute',name:'Screened Foot Descent',x:1110,y:1280,z:36},
    {id:'gallery-shadow',name:'Sled Gallery Crossing',x:1180,y:1430},
    {id:'traverser',name:'Radial Wagon Traverser',x:1590,y:1330},
    {id:'weighhouse',name:'Covered Weighhouse',x:2040,y:1420},
    {id:'powder-magazine',name:'Powder Magazine',x:2070,y:1120},
    {id:'cap-wagon',name:'Cap Wagon',x:1830,y:1510},
    {id:'east-horse-ramp',name:'East Horse Ramp',x:1500,y:920,z:24},
    {id:'west-timber-approach',name:'West Timber Screen',x:1050,y:960},
    {id:'east-timber-approach',name:'East Cedar Approach',x:2440,y:1080},
    {id:'reserve-gap',name:'Northern Timber Gap',x:1870,y:640},
    {id:'pulley-creek',name:'Frozen Pulley Creek',x:1320,y:1880},
    {id:'ice-crossing',name:'Pulley Ice Crossing',x:1160,y:1950},
    {id:'low-fork',name:'Lower Lane Fork',x:1000,y:2110},
    {id:'far-fork',name:'Far Snow Lane Fork',x:790,y:2200},
  ],
  trail,returnRoute,horseRamp,mountRoutes:[horseRamp,[...returnRoute].reverse()],
  wrongFork:[{x:710,y:1640,z:0},{x:570,y:1510,z:0},{x:430,y:1430,z:0},{x:475,y:1610,z:0},{x:710,y:1640,z:0}],
  ridgeWalk:[{x:890,y:1180,z:72},{x:940,y:1130,z:72},{x:1000,y:1050,z:72}],
  tracks:[{id:'cart-grooves',kind:'cart-tracks',x:620,y:1770,z:0,description:'Two parallel sled grooves carry green scale dust north.'},{id:'return-hooves',kind:'hoof-tracks',x:755,y:1520,z:0,description:'Fresh hoofprints cross the older sled grooves toward the timber screens.'},{id:'branch-trail',kind:'survey-track',x:825,y:1340,z:0,description:'A boot heel with a survey nail turns uphill beside a snapped birch.'},{id:'wrong-fork',kind:'old-track',x:470,y:1480,z:0,description:'The shallow marks are drift-filled and end at an abandoned sled.'}],
  recon:{viewpoint:{id:'bellwether-viewpoint',x:1000,y:1050,z:72},dismount:{x:890,y:1180,z:72},calderStart:{x:1760,y:1240,z:0},leviStart:{x:1810,y:1240,z:0},card:{id:'levi-debt-card',x:1800,y:1240,z:35},observationRadius:95,viewRange:1400,sightglass:{minZoom:1,maxZoom:3.5,panRate:1.2},landmarks:[{id:'magazine',propId:'charge-crate',x:2070,y:1120,z:24},{id:'weighhouse',propId:'route-plans',x:2040,y:1420,z:30},{id:'screened-entry',propId:'first-shot-cover',x:1260,y:1440,z:0}],calderEscape:[{x:1760,y:1240,z:0},{x:1830,y:1170,z:0},{x:1880,y:1020,z:0},{x:1920,y:880,z:0},{x:2050,y:710,z:0},{x:2250,y:560,z:0},{x:2530,y:400,z:0},{x:2890,y:230,z:0}],leviDismissal:[{x:1810,y:1240,z:0},{x:1860,y:1320,z:0},{x:1860,y:1600,z:0},{x:1660,y:1760,z:0},{x:1320,y:1850,z:0}],duration:{cardTear:2.2,strike:1.1,mountDeparture:2.5},exposureBoundary:{x:1110,y:1030,w:150,h:200},safeObservation:true},
  descent:[{x:1000,y:1050,z:72},{x:1000,y:1170,z:72},{x:1055,y:1240,z:48},{x:1110,y:1280,z:36},{x:1140,y:1360,z:12},{x:1180,y:1450,z:0},{x:1260,y:1440,z:0}],
  descentDetails:{id:'screened-chute',segments:[{id:'upper-screen',from:{x:1000,y:1170,z:72},to:{x:1055,y:1240,z:48},duration:1.5},{id:'steep-chute',from:{x:1055,y:1240,z:48},to:{x:1140,y:1360,z:12},duration:2.8,requires:'crouch'},{id:'low-gallery',from:{x:1140,y:1360,z:12},to:{x:1180,y:1450,z:0},duration:1.6,clearance:45}],westPair:[{x:1000,y:1170,z:72},{x:945,y:1270,z:48},{x:950,y:1420,z:0},{x:1110,y:1430,z:0},{x:1180,y:1430,z:0},{x:1160,y:1440,z:0}],mountLine:{inez:{x:920,y:1180,z:72},emmett:{x:860,y:1180,z:72}},concealment:.78,noiseLimit:.62},
  firstShotCover:{id:'first-shot-cover',x:1260,y:1440,z:0,radius:65,partyPositions:{mara:{x:1260,y:1440,z:0},tomas:{x:1300,y:1440,z:0},ruth:{x:1120,y:1425,z:0},bastian:{x:1160,y:1440,z:0},inez:{x:920,y:1180,z:72},emmett:{x:860,y:1180,z:72}},focusOpportunity:['bellwether-wheel-left','bellwether-wheel-right','bellwether-pusher-east'],safeFireRequires:['descent-complete','tomas-ready','west-pair-ready','mount-line-ready']},
  mountParking:{copper:{x:830,y:1180,z:72},'tomas-mount':{x:890,y:1180,z:72},thimble:{x:950,y:1180,z:72},plover:{x:830,y:1250,z:72},cinder:{x:890,y:1250,z:72},button:{x:950,y:1250,z:72}},
  yardMountParking:{copper:{x:1780,y:1630,z:0},'tomas-mount':{x:1840,y:1630,z:0},thimble:{x:1900,y:1630,z:0},plover:{x:1780,y:1700,z:0},cinder:{x:1840,y:1700,z:0},button:{x:1900,y:1700,z:0}},
  routes:{patrolWest,patrolEast,patrolReserve,galleryFlank:[{x:1660,y:1030,z:0},{x:1540,y:1030,z:0},{x:1400,y:1120,z:0},{x:1320,y:1280,z:0}],creekFlank:[{x:2170,y:1580,z:0},{x:2060,y:1620,z:0},{x:1860,y:1570,z:0},{x:1760,y:1500,z:0}],initialRetreat:[{x:1850,y:1160,z:0},{x:1880,y:970,z:0},{x:1840,y:800,z:0},{x:1770,y:600,z:0},{x:1660,y:210,z:0}],westRetreat:[...patrolWest].reverse(),eastRetreat:[...patrolEast].reverse(),reserveRetreat:[...patrolReserve].reverse()},
  patrols:{warningAt:{x:1170,y:1040,z:0},hearingOn:'first-yard-shot',groups:[{id:'west',count:4,routeId:'patrolWest',startAfter:0,formationWidth:72},{id:'east',count:4,routeId:'patrolEast',startAfter:5,formationWidth:72},{id:'reserve',count:4,routeId:'patrolReserve',startAfter:28,formationWidth:84}],warning:'Emmett sees two coat sleeves moving between the western trunks; Inez points to hoofless boot tracks at the east ramp.'},
  tactics:{hold:{name:'Hold the wheels',playerAnchor:{x:1510,y:1430,z:0},partyPositions:{tomas:{x:1700,y:1440,z:0},ruth:{x:1450,y:1460,z:0},bastian:{x:1350,y:1250,z:0},inez:{x:1860,y:1590,z:0},emmett:{x:1900,y:1590,z:0}},routes:{tomas:[{x:1300,y:1440,z:0},{x:1510,y:1500,z:0},{x:1700,y:1440,z:0}],ruth:[{x:1120,y:1325,z:0},{x:1250,y:1450,z:0},{x:1450,y:1460,z:0}],bastian:[{x:1160,y:1440,z:0},{x:1250,y:1250,z:0},{x:1350,y:1250,z:0}]}},advance:{name:'Meet the trees',playerAnchor:{x:1160,y:1000,z:0},partyPositions:{tomas:{x:1260,y:1030,z:0},ruth:{x:1080,y:1130,z:0},bastian:{x:1170,y:950,z:0},inez:{x:1870,y:1010,z:0},emmett:{x:1930,y:1040,z:0}},routes:{tomas:[{x:1300,y:1440,z:0},{x:1250,y:1300,z:0},{x:1260,y:1030,z:0}],ruth:[{x:1120,y:1325,z:0},{x:1080,y:1240,z:0},{x:1080,y:1130,z:0}],bastian:[{x:1160,y:1440,z:0},{x:1170,y:1180,z:0},{x:1170,y:950,z:0}],inez:[{x:950,y:1180,z:72},...horseRamp.slice(1,6)],emmett:[{x:860,y:1180,z:72},...horseRamp.slice(1,6),{x:1930,y:1040,z:0}]}}},
  searchSites:{chargeCrate:{id:'charge-crate',x:2070,y:1120,z:24,interiorId:'powder-magazine',owner:'claimants',chargeIds:['quarry-charge-1','quarry-charge-2','quarry-charge-3','quarry-charge-4'],workpoint:{x:2070,y:1146,z:0},ruthPoint:{x:2096,y:1146,z:0},carryRoute:[{x:2096,y:1146,z:0},{x:2070,y:1218,z:0},{x:1940,y:1230,z:0},{x:1860,y:1600,z:0}]},capTin:{id:'cap-tin',x:1830,y:1510,z:25,owner:'claimants',siteId:'cap-wagon',workpoint:{x:1830,y:1538,z:0}},plans:{id:'route-plans',x:2040,y:1420,z:30,interiorId:'weighhouse',objectIds:['route-diagram','seizure-list'],owner:'claimants',workpoint:{x:2040,y:1448,z:0},bastianRoute:[{x:1160,y:1440,z:0},{x:1550,y:1520,z:0},{x:1980,y:1560,z:0},{x:2040,y:1555,z:0},{x:2040,y:1448,z:0}],handoffPoint:{x:1940,y:1570,z:0},tomasPoint:{x:1920,y:1570,z:0}}},
  documents:{routeDiagram:{title:'Bond-and-deed diversion — quarry scale copy',text:'Run the northbound bond coach onto Bellwether’s weigh siding after the pulley signal is covered. Wagon three carries the tin deed box. The paired ledger names are to be sold once at the courthouse and again under the railroad warrant. Red marks denote occupied homes; Calder’s clerk is to strike them from the public copy. Scale: one survey chain equals the short square; the creek spur cannot carry the full locomotive.'},seizureList:{title:'Two accounts for the same homes',text:'Senn: forty-one paid, seventeen demanded again. Arlow cooperative lot: release signed, seizure repeated. Rowan survey shed: tools to be held against a debt already transferred. Five signatures copied in the same narrow hand. No witness countersignature appears beside the second set.'},quarryLetter:{title:'Unsent letter from the quarry shed',text:'Mira — They say keeping the scale house means the boys can eat before the thaw. I used to weigh stone, not names. If the shed key comes back without me, do not let anyone tell them I volunteered our roof.'},debtCard:{title:'Levi Senn — payment card',text:'Forty-one paid against the family arrears. The last seventeen were written in after the seal dried. A tear crosses the witness line; the numbers survive.'}},
  chase:{trigger:{x:1320,y:1880,z:0,radius:130},leviStart:{x:1310,y:1850,z:0},skeinStart:{x:1326,y:1840,z:0},recognitionRange:220,route:chaseMain,forks:[{id:'low-fork',x:1000,y:2110,z:0,left:[{x:1000,y:2110,z:0},{x:900,y:2020,z:0},{x:820,y:2080,z:0},{x:875,y:2170,z:0}],right:[{x:1000,y:2110,z:0},{x:1080,y:2180,z:0},{x:970,y:2260,z:0},{x:875,y:2170,z:0}]},{id:'far-fork',x:790,y:2200,z:0,left:[{x:790,y:2200,z:0},{x:760,y:2110,z:0},{x:650,y:2160,z:0},{x:660,y:2240,z:0}],right:[{x:790,y:2200,z:0},{x:825,y:2300,z:0},{x:715,y:2340,z:0},{x:660,y:2240,z:0}]}],onFootRoute:[{x:1090,y:1990,z:0},{x:1080,y:2060,z:0},{x:1000,y:2110,z:0},{x:875,y:2170,z:0},{x:790,y:2200,z:0},{x:660,y:2240,z:0}],escapeBoundary:{x:470,y:2210,w:90,h:120},iceCrossing:{x:1160,y:1915,w:110,h:120,friction:.55},capture:{lariatRange:180,ropeLength:180,minimumTension:.18,breakTension:.95,approachRange:28,bindSeconds:3.4,tackleRange:30,escapeWarnSeconds:8,escapeFailSeconds:18},transportRoute:[{x:660,y:2240,z:0},{x:580,y:2270,z:0},{x:460,y:2240,z:0},{x:340,y:2180,z:0}],detour:[{x:580,y:2270,z:0},{x:480,y:2320,z:0},{x:360,y:2300,z:0},{x:340,y:2180,z:0}],skeinRecovery:{inezPoint:{x:730,y:2220,z:0},leadRoute:[{x:730,y:2220,z:0},{x:580,y:2270,z:0},{x:460,y:2240,z:0},{x:340,y:2180,z:0}]},bindingWarning:12,abandonWarning:20,abandonFailure:50},
  elevationZones:[{id:'west-ridge',x:770,y:990,w:310,h:280,z:72},{id:'upper-chute',x:1035,y:1215,w:70,h:85,z:48},{id:'middle-chute',x:1095,y:1270,w:70,h:100,z:36},{id:'lower-chute',x:1125,y:1350,w:70,h:70,z:12},{id:'horse-ramp-upper',x:1160,y:915,w:170,h:100,z:48},{id:'horse-ramp-lower',x:1370,y:880,w:290,h:100,z:24},{id:'gallery-loft',x:1375,y:1075,w:380,h:75,z:32},{id:'weighhouse-loft',x:2175,y:1350,w:55,h:75,z:32}],
  terrainZones:[{id:'south-deep-snow',kind:'snow',x:270,y:1800,w:360,h:520,noise:.65,speed:.88},{id:'chute-snow',kind:'snow',x:1000,y:1200,w:220,h:240,noise:.45,speed:.74},{id:'yard-packed-snow',kind:'packed-snow',x:1150,y:1010,w:1150,h:670,noise:.6,speed:1},{id:'pulley-ice',kind:'ice',x:1080,y:1880,w:220,h:200,noise:.8,speed:.9}],
  river:[{x:2990,y:1680},{x:2580,y:1720},{x:2100,y:1770},{x:1670,y:1830},{x:1320,y:1880},{x:1160,y:1950},{x:850,y:1940},{x:610,y:2020},{x:320,y:2050}],creekWidth:58,
  fords:[{id:'pulley-ice-ford',x:1100,y:1880,w:200,h:190,depth:.12}],
  coverZones:[{id:'ridge-screen',x:915,y:995,w:150,h:170,concealment:.95},{id:'chute-screen',x:1010,y:1200,w:180,h:230,concealment:.85},{id:'gallery-shadow',x:1110,y:1400,w:215,h:90,concealment:.9},{id:'west-timber-screen',x:980,y:900,w:210,h:290,concealment:.65},{id:'east-timber-screen',x:2250,y:1000,w:260,h:410,concealment:.6}],
  covers:[{id:'tomas-ready',x:1300,y:1440,z:0},{id:'ruth-west',x:1120,y:1365,z:0},{id:'bastian-west',x:1160,y:1355,z:0},{id:'mount-line-east',x:920,y:1180,z:72},{id:'mount-line-west',x:860,y:1180,z:72},{id:'wheel-well-west',x:1450,y:1290,z:0},{id:'wheel-well-east',x:1730,y:1330,z:0}],
  interiors:[{id:'powder-magazine',name:'Quarry powder magazine',x:1970,y:1020,w:210,h:200,height:82,doors:[{x:2070,y:1220,w:80},{x:1970,y:1120,w:74}],shelves:[{x:2130,y:1050,w:30,h:100}],roofCutaway:true},{id:'weighhouse',name:'Weighhouse account room',x:1940,y:1330,w:230,h:220,height:88,doors:[{x:2040,y:1550,w:80},{x:1940,y:1430,w:70}],loftWindow:{x:2190,y:1370,z:32,w:56},roofCutaway:true},{id:'quarry-shed',name:'Seized quarry shed',x:1120,y:1550,w:160,h:120,height:66,doors:[{x:1200,y:1670,w:80}],roofCutaway:true}],
  props:[
    {id:'bellwether-south-gate',kind:'trailpost',x:340,y:2180,z:0,name:'South Snow Gate'},
    {id:'wagon-grooves',kind:'cart-tracks',x:620,y:1770,z:0},{id:'patrol-hooves',kind:'hoof-sign',x:755,y:1520,z:0},{id:'branch-trail',kind:'tracks',x:825,y:1340,z:0},{id:'wrong-fork',kind:'old-track',x:470,y:1480,z:0},
    {id:'ridge-hitch',kind:'hitch',x:890,y:1210,z:72},{id:'bellwether-viewpoint',kind:'sightglass-view',x:1000,y:1050,z:72},{id:'levi-debt-card',kind:'debt-card',x:1800,y:1240,z:35},
    {id:'first-shot-cover',kind:'cover-marker',x:1260,y:1440,z:0},{id:'traverser',kind:'wagon-traverser',x:1590,y:1330,z:0,radius:155,entrances:[{x:1440,y:1330},{x:1670,y:1200},{x:1670,y:1460}]},
    {id:'sled-gallery',kind:'timber-gallery',x:1550,y:1115,z:32,w:380,h:75},{id:'oxidized-scales',kind:'scale',x:2200,y:1440,z:0},
    {id:'charge-crate',kind:'charge-crate',x:2070,y:1120,z:24},{id:'magazine-workbench',kind:'workbench',x:2070,y:1120,z:24},
    {id:'cap-wagon',kind:'cap-wagon',x:1830,y:1510,z:0},{id:'cap-tin',kind:'cap-tin',x:1830,y:1510,z:25},
    {id:'route-plans',kind:'plan',x:2040,y:1420,z:30},{id:'account-lantern',kind:'lamp',x:2080,y:1420,z:40},{id:'powder-lantern',kind:'lamp',x:2110,y:1190,z:40},
    {id:'yard-hitch',kind:'hitch',x:1860,y:1640,z:0},{id:'frozen-pulley',kind:'pulley',x:1370,y:1810,z:0},{id:'ice-crossing',kind:'ice',x:1160,y:1950,z:0},
  ],
  obstacles:[
    {id:'ridge-snow-wall',kind:'snow-wall',x:1055,y:985,w:30,h:215,height:86,projectileCover:true},
    {id:'chute-west-screen',kind:'snow-wall',x:980,y:1250,w:38,h:155,height:78,projectileCover:true},{id:'chute-east-screen',kind:'snow-wall',x:1190,y:1190,w:35,h:200,height:80,projectileCover:true},
    {id:'gallery-footbeam',kind:'beam',x:1200,y:1390,w:180,h:18,height:20,projectileCover:true},{id:'gallery-roofbeam',kind:'beam',x:1380,y:1060,w:375,h:20,height:72,projectileCover:true},
    {id:'gallery-west-post',kind:'timber',x:1380,y:1075,w:24,h:90,height:90,projectileCover:true},{id:'gallery-east-post',kind:'timber',x:1720,y:1075,w:24,h:90,height:90,projectileCover:true},
    {id:'traverser-machinery',kind:'machinery',x:1535,y:1290,w:110,h:80,height:68,projectileCover:true},
    {id:'wheel-well-west',kind:'wheel-well',x:1420,y:1308,w:95,h:22,height:30,projectileCover:true},{id:'wheel-well-east',kind:'wheel-well',x:1700,y:1350,w:80,h:22,height:30,projectileCover:true},
    {id:'first-shot-timber',kind:'timber',x:1230,y:1405,w:125,h:22,height:42,projectileCover:true},
    {id:'west-rail-cart',kind:'wagon',x:1330,y:1150,w:80,h:32,height:48,projectileCover:true},{id:'east-rail-cart',kind:'wagon',x:1870,y:1210,w:85,h:34,height:50,projectileCover:true},
    {id:'west-cart-wheel',kind:'wheel',x:1270,y:1350,w:54,h:26,height:38,projectileCover:true},{id:'shed-timber',kind:'timber',x:1065,y:1380,w:60,h:18,height:36,projectileCover:true},
    {id:'magazine-north',kind:'timber-wall',x:1960,y:1010,w:230,h:10,height:82,projectileCover:true},{id:'magazine-east',kind:'timber-wall',x:2180,y:1020,w:10,h:210,height:82,projectileCover:true},
    {id:'magazine-west-north',kind:'timber-wall',x:1960,y:1020,w:10,h:62,height:82,projectileCover:true},{id:'magazine-west-south',kind:'timber-wall',x:1960,y:1158,w:10,h:72,height:82,projectileCover:true},
    {id:'magazine-south-west',kind:'timber-wall',x:1970,y:1220,w:60,h:10,height:82,projectileCover:true},{id:'magazine-south-east',kind:'timber-wall',x:2110,y:1220,w:80,h:10,height:82,projectileCover:true},
    {id:'powder-shelf',kind:'shelf',x:2130,y:1050,w:30,h:100,height:55,projectileCover:true},{id:'magazine-screen',kind:'crate',x:2020,y:970,w:60,h:20,height:38,projectileCover:true},
    {id:'weighhouse-north',kind:'timber-wall',x:1930,y:1320,w:250,h:10,height:88,projectileCover:true},{id:'weighhouse-east',kind:'timber-wall',x:2170,y:1330,w:10,h:230,height:88,projectileCover:true},
    {id:'weighhouse-west-north',kind:'timber-wall',x:1930,y:1330,w:10,h:65,height:88,projectileCover:true},{id:'weighhouse-west-south',kind:'timber-wall',x:1930,y:1465,w:10,h:95,height:88,projectileCover:true},
    {id:'weighhouse-south-west',kind:'timber-wall',x:1940,y:1550,w:60,h:10,height:88,projectileCover:true},{id:'weighhouse-south-east',kind:'timber-wall',x:2080,y:1550,w:100,h:10,height:88,projectileCover:true},
    {id:'weighhouse-door-cover',kind:'crate',x:2080,y:1478,w:48,h:24,height:38,projectileCover:true},{id:'scale-watch-cover',kind:'scale',x:2200,y:1380,w:35,h:28,height:52,projectileCover:true},
    {id:'shed-north',kind:'timber-wall',x:1110,y:1540,w:180,h:10,height:66,projectileCover:true},{id:'shed-west',kind:'timber-wall',x:1110,y:1550,w:10,h:130,height:66,projectileCover:true},{id:'shed-east',kind:'timber-wall',x:1280,y:1550,w:10,h:130,height:66,projectileCover:true},{id:'shed-south-west',kind:'timber-wall',x:1120,y:1670,w:40,h:10,height:66,projectileCover:true},{id:'shed-south-east',kind:'timber-wall',x:1240,y:1670,w:50,h:10,height:66,projectileCover:true},
    {id:'west-timber-1',kind:'trunk',x:995,y:960,w:26,h:32,height:110,projectileCover:true},{id:'west-timber-2',kind:'trunk',x:1110,y:895,w:24,h:32,height:120,projectileCover:true},{id:'west-timber-3',kind:'trunk',x:1050,y:1150,w:24,h:30,height:115,projectileCover:true},
    {id:'east-timber-1',kind:'trunk',x:2370,y:1170,w:28,h:35,height:115,projectileCover:true},{id:'east-timber-2',kind:'trunk',x:2480,y:1040,w:25,h:33,height:120,projectileCover:true},{id:'reserve-timber',kind:'trunk',x:1825,y:770,w:24,h:32,height:110,projectileCover:true},
    {id:'pulley-rock',kind:'rock',x:1390,y:1880,w:50,h:40,height:42,projectileCover:true},{id:'low-fork-log',kind:'log',x:1015,y:2030,w:75,h:22,height:26,projectileCover:true},{id:'far-fork-boulder',kind:'rock',x:725,y:2190,w:45,h:34,height:50,projectileCover:true},
  ],
  anchors:[{id:'charge-workpoint',x:2070,y:1146,z:0},{id:'yard-crate-staging',x:1840,y:1610,z:0}],
  atmosphere:{sky:'#253849',snow:'#9ab6c5',timber:'#403a32',scale:'#63867b',lantern:'#edc489',fog:.26,wind:{x:-.6,y:.25,speed:.65},powderDust:{x:2070,y:1120,strength:.14}},
  camp:{
    gate:{id:'bellwether-camp-gate',x:800,y:760,z:0},arrival:{x:570,y:1180,z:0},
    argumentRoom:{id:'rival-stove-room',x:485,y:1025,w:180,h:120,height:70,doorway:{x:575,y:1145,z:0},participants:{ruth:{x:540,y:1070,z:0},bastian:{x:575,y:1080,z:0},emmett:{x:545,y:1120,z:0},inez:{x:600,y:1110,z:0},tomas:{x:615,y:1065,z:0},mara:{x:575,y:1120,z:0}},residents:{ada:{x:505,y:1100,z:0},vera:{x:505,y:1120,z:0}}},
    rack:{id:'rival-rack',mountId:'copper',x:545,y:1195,z:26},equipmentHandoff:{mara:{x:545,y:1225,z:0},tomas:{x:575,y:1225,z:0},ruth:{x:515,y:1225,z:0},inez:{x:545,y:1255,z:0}},
    tackRoom:{id:'rival-tack-room',x:730,y:1080,w:180,h:220,height:76},doorway:{id:'rival-tack-doorway',x:820,y:1080,z:0},unload:{x:820,y:1025,z:0},questionPoint:{x:820,y:1160,z:0},holding:{id:'levi-holding-anchor',x:820,y:1240,z:0},
    helpers:{ruth:{x:798,y:1185,z:0},hob:{x:842,y:1185,z:0}},questionParticipants:{della:{x:790,y:1128,z:0},tomas:{x:850,y:1128,z:0},bastian:{x:866,y:1160,z:0},mara:{x:820,y:1130,z:0}},
    deliveryRoute:[{x:820,y:1025,z:0},{x:820,y:1080,z:0},{x:820,y:1120,z:0},{x:820,y:1160,z:0}],holdingRoute:[{x:820,y:1160,z:0},{x:820,y:1200,z:0},{x:820,y:1240,z:0}],
    returnRoute:[{x:800,y:760,z:0},{x:750,y:920,z:0},{x:820,y:1025,z:0}],
    crateStore:{id:'ruth-charge-store',x:750,y:1270,z:0},capStore:{id:'ruth-cap-store',x:750,y:1210,z:24},account:{id:'rival-party-account',x:665,y:1235,z:26},hitch:{id:'rival-camp-hitch',x:610,y:1175,z:0},
    mountParking:{copper:{x:545,y:1195,z:0},'tomas-mount':{x:485,y:1175,z:0},thimble:{x:505,y:1235,z:0},plover:{x:565,y:1175,z:0},cinder:{x:630,y:1175,z:0},button:{x:690,y:1175,z:0},skein:{x:680,y:1280,z:0}},
    homes:{ruth:{x:695,y:1240,z:0},bastian:{x:610,y:1115,z:0},emmett:{x:680,y:1120,z:0},levi:{x:820,y:1240,z:0}},
    interiors:[{id:'rival-stove-room',name:'Cooperative stove room',x:485,y:1025,w:180,h:120,height:70,doors:[{x:575,y:1145,w:80}],roofCutaway:true},{id:'rival-tack-room',name:'Guarded tack room',x:730,y:1080,w:180,h:220,height:76,doors:[{x:820,y:1080,w:90}],roofCutaway:true}],
    obstacles:[{id:'rival-stove-north',kind:'timber-wall',x:475,y:1015,w:200,h:10,height:70},{id:'rival-stove-west',kind:'timber-wall',x:475,y:1025,w:10,h:130,height:70},{id:'rival-stove-east',kind:'timber-wall',x:665,y:1025,w:10,h:130,height:70},{id:'rival-stove-south-west',kind:'timber-wall',x:485,y:1145,w:50,h:10,height:70},{id:'rival-stove-south-east',kind:'timber-wall',x:615,y:1145,w:60,h:10,height:70},{id:'rival-tack-west',kind:'timber-wall',x:720,y:1080,w:10,h:230,height:76},{id:'rival-tack-east',kind:'timber-wall',x:910,y:1080,w:10,h:230,height:76},{id:'rival-tack-south',kind:'timber-wall',x:730,y:1300,w:190,h:10,height:76},{id:'rival-tack-north-west',kind:'timber-wall',x:730,y:1070,w:45,h:10,height:76},{id:'rival-tack-north-east',kind:'timber-wall',x:865,y:1070,w:55,h:10,height:76}],
    props:[{id:'rival-room-stove',kind:'stove',x:505,y:1050,z:0},{id:'rival-camp-hitch',kind:'hitch',x:610,y:1175,z:0},{id:'rival-rack',kind:'weapon-rack',x:545,y:1195,z:26},{id:'rival-tack-doorway',kind:'doorway',x:820,y:1080,z:0},{id:'levi-holding-anchor',kind:'holding-bench',x:820,y:1240,z:0},{id:'levi-water-cup',kind:'cup',x:845,y:1250,z:24},{id:'ruth-charge-store',kind:'charge-store',x:750,y:1270,z:0},{id:'ruth-cap-store',kind:'cap-store',x:750,y:1210,z:24},{id:'rival-party-account',kind:'account',x:665,y:1235,z:26},{id:'bellwether-camp-gate',kind:'waypoint',x:800,y:760,z:0}],
    anchors:[{id:'levi-holding-anchor',x:820,y:1240,z:0}],
  },
};
export const BELLWETHER_WORLD = RIVAL_WORLD;

// Runtime and renderer share these flat action anchors. Rich scene descriptions
// above retain their own routes, inspections and prop identity contracts.
RIVAL_WORLD.observation = RIVAL_WORLD.recon.viewpoint;
RIVAL_WORLD.calderEscape = RIVAL_WORLD.recon.calderEscape;
RIVAL_WORLD.readyCover = RIVAL_WORLD.firstShotCover;
RIVAL_WORLD.mountsPark = RIVAL_WORLD.mountParking;
RIVAL_WORLD.yardCover = RIVAL_WORLD.firstShotCover.partyPositions;
RIVAL_WORLD.patrolRoutes = {west:patrolWest,east:patrolEast,reserve:patrolReserve};
RIVAL_WORLD.searchSites.magazine = {...RIVAL_WORLD.searchSites.chargeCrate,z:0};
RIVAL_WORLD.searchSites.capWagon = {...RIVAL_WORLD.searchSites.capTin,z:0};
RIVAL_WORLD.searchSites.weighhouse = {...RIVAL_WORLD.searchSites.plans,z:0};
RIVAL_WORLD.charge = {...RIVAL_WORLD.searchSites.chargeCrate,z:0};
RIVAL_WORLD.capTin = {...RIVAL_WORLD.searchSites.capTin,z:0};
RIVAL_WORLD.plans = {...RIVAL_WORLD.searchSites.plans,z:0};
RIVAL_WORLD.convoyRoute = returnRoute.slice(0,4);
RIVAL_WORLD.chase.escape = chaseMain.at(-1);
RIVAL_WORLD.camp.briefing = {x:575,y:1120,z:0};
RIVAL_WORLD.camp.holding.id = 'levi-holding';
RIVAL_WORLD.camp.charges = {...RIVAL_WORLD.camp.crateStore,id:'quarry-charge-store'};
RIVAL_WORLD.camp.ledger = {...RIVAL_WORLD.camp.account,z:0};
RIVAL_WORLD.camp.helperRoute = RIVAL_WORLD.camp.holdingRoute;
RIVAL_WORLD.camp.partyParking = RIVAL_WORLD.camp.mountParking;
RIVAL_WORLD.camp.workpoints = {mara:RIVAL_WORLD.camp.questionParticipants.mara,ruth:RIVAL_WORLD.camp.helpers.ruth,hob:RIVAL_WORLD.camp.helpers.hob,della:RIVAL_WORLD.camp.questionParticipants.della,tomas:RIVAL_WORLD.camp.questionParticipants.tomas};
RIVAL_WORLD.camp.crateStore = RIVAL_WORLD.camp.charges;
Object.assign(RIVAL_WORLD.camp.anchors.find(p=>p.id==='levi-holding-anchor'),RIVAL_WORLD.camp.holding);
Object.assign(RIVAL_WORLD.camp.props.find(p=>p.id==='levi-holding-anchor'),RIVAL_WORLD.camp.holding);
Object.assign(RIVAL_WORLD.camp.props.find(p=>p.id==='ruth-charge-store'),RIVAL_WORLD.camp.charges);
RIVAL_WORLD.elevationZones.push({id:'horse-ramp-crest',x:925,y:915,w:220,h:125,z:72});

export const RIVAL_PERFORMANCE = {
  captureWithin:{id:'quick-capture',seconds:55,start:'levi-flight',finish:'levi-bound'},
  focusThree:{id:'three-in-one-focus',count:3,event:'lethal-player-projectile',sameActivation:true},
  operationTime:{id:'operation-time',seconds:1320,start:'accepted-expedition',finish:'party-account-finished'},
  headImpacts:{id:'true-head-impacts',count:15,event:'player-head-impact-kill'},
  noHealing:{id:'no-healing-items',allowed:0,event:'consumed-healing-item'},
  balanceStatus:'original provisional targets; source/retry grading independently unverified',
  clock:'active simulation only; readable dialogue, menus and pause stop optional timers',
  retryPolicy:'checkpoint retry and restart must disclose and reset their own eligibility; never award from restored kills',
};

const line = (speaker,text) => ({speaker,text});
export const RIVAL_DIALOGUE = {
  quarrel:line('Bastian Holt','We wait for a roof to thaw while Calder carts away the rafters. Ruth, you weighed his powder. Tell them what waiting bought.'),
  ruthReply:line('Ruth Arlow','It bought time to get children clear of a blast. You call that timid because you never counted the hands left afterwards.'),
  emmettReply:line('Emmett Rowan','A survey is not surrender. I found the works road because someone kept reading when you wanted to burn the map.'),
  intervene:line('Inez Pike','Take your hand off her. Mara, stand between them while I make him remember where he is.'),
  strikeAfter:line('Ruth Arlow','I can still carry a cap tin. Bastian can carry his apology, if he ever makes one.'),
  residentAda:line('Ada Rusk','A room full of saved people ought to have fewer reasons to duck.'),
  residentVera:line('Vera Holl','I patched that stove so people could warm their hands. Keep your fists away from it.'),
  brief:line('Tomas Reed','Calder is using Bellwether Works to sort the homes he means to take. Six of us can recover his route and the quarry charges. We search for proof; we do not follow him into every wood.'),
  motiveQuestion:line('Mara Vale','If he rides away, do you still want the papers more than him?'),
  motiveAnswer:line('Tomas Reed','I signed the quarry settlement he broke. I want to know whose name he used next. If anger could tell me, I would have no need of you.'),
  accept:line('Mara Vale','Then we bring back what he wrote and keep our people together. Tell Bastian the same bargain.'),
  decline:line('Tomas Reed','We can wait at the stove. Nothing leaves the rack until you agree to the road.'),
  postponed:line('Inez Pike','Finish what needs doing here. The mounts stay hitched, and no one is leaving without you.'),
  carbine:line('Tomas Reed','Seven chambers. It is a Tern, from the cooperative rack, and its number is in Della’s book. Take it from Copper’s saddle when you have chosen what to carry.'),
  cartridges:line('Ruth Arlow','Seven in the tube and forty-two in this counted roll. They fit the Tern; they will not feed the coach gun.'),
  lariat:line('Inez Pike','Throw the loop at a person you can reach. Keep pressure until you can step down and tie a knot. A rope waving nearby has caught nobody.'),
  sightglass:line('Inez Pike','Raise this before we choose a slope. Turn the glass and tighten the view. Seeing a roof is different from guessing what is behind it.'),
  rackRecovery:line('Tomas Reed','The gun you put back is still on Copper’s rack. Retrieve a longarm when you are ready; I will be beside the hitch.'),
  wrongAmmo:line('Ruth Arlow','That pouch belongs to another gun. Check the cartridge before you ask it to do a different chamber’s work.'),
  missingMount:line('Inez Pike','We keep the animal’s own name and condition in the book. We can arrange a real loan, or postpone. A saddle does not make a missing horse return.'),
  departure:line('Emmett Rowan','The south gate, then the cart grooves. Button knows the packed trail, but I would rather he learned it slowly.'),
  cartTracks:line('Emmett Rowan','Green grit in both grooves. Those sleds came from the old scales; the hoofprints are newer and turn back through the trees.'),
  hoofTracks:line('Inez Pike','These horses were walking with riders. No drag marks and no loose tack. A returning patrol, not a runaway.'),
  branchTracks:line('Emmett Rowan','That heel has a survey nail. The works road bends uphill here; the open fork ends at a buried cart.'),
  wrongFork:line('Emmett Rowan','Old marks. Snow lies in the bottom instead of beside the cut. Come back to the birch and we can follow the fresh line.'),
  routeTomas:line('Tomas Reed','He said a settlement would leave the quarry families their houses. I gave him the signatories. He used the list to find their doors.'),
  routeRuth:line('Ruth Arlow','The people who signed needed roofs. Do not make their need the crime because Calder found a use for it.'),
  routeBastian:line('Bastian Holt','We can argue over the list when it is in our hands. The men carrying it will not wait politely.'),
  separation:line('Inez Pike','Keep the last rider in sight. We can take a breath at the next bend; we cannot leave a wounded horse to choose the way alone.'),
  ridge:line('Tomas Reed','Leave the mounts here with Inez and Emmett. Feet and a glass first. The yard has more windows than we have riders.'),
  glassRecovery:line('Emmett Rowan','The viewpoint is above that birch. Raise the sightglass there; I cannot draw what you have not seen.'),
  calderCard:line('Rafe Calder','Your paid total is on the part I am keeping. The remainder is on the part you are still allowed to owe.'),
  leviCard:line('Levi Senn','The seal covered that line yesterday. My mother paid it before the frost.'),
  calderDismissal:line('Rafe Calder','Take the mare to the pulley road. When the patrol comes back, you copy their names without asking which ink they prefer.'),
  observedStrike:line('Mara Vale','He tore the witness line and struck the man holding it. That is the account he wants believed.'),
  observeDeparture:line('Tomas Reed','Calder is taking the north road. Let him. The magazine, the weighhouse and the covered crossing are our business here.'),
  identifyMagazine:line('Ruth Arlow','The small building with the separate shelves is the magazine. Keep firing angles away from its work surface.'),
  identifyWeighhouse:line('Emmett Rowan','Ledger lantern in the low room, screened window above. The account desk is on the ground floor.'),
  identifyEntry:line('Tomas Reed','Below the sled gallery, behind the timber. Ruth and Bastian go west. Inez and Emmett hold the mounts until the east ramp is safe.'),
  descent:line('Tomas Reed','Short steps. Turn across the slope, keep your shoulder under the beam, and wait when the yard man looks this way.'),
  descentRecovery:line('Tomas Reed','The chute stays screened if we stay low. Come back behind the snow wall and choose your footing again.'),
  firstShot:line('Tomas Reed','Everyone has cover. You can open on a clear target, or leave the signal to me. Once it starts, watch the gallery as well as the wheels.'),
  maraOpening:line('Ruth Arlow','Mara’s report. West pair moving; keep the magazine behind us.'),
  tomasOpening:line('Tomas Reed','Now. Wheel wells first, then the high window. Inez, stay with the mount line.'),
  readyReprimand:line('Tomas Reed','We were set, but I had not finished the signal. Make the opening count and keep your people in view.'),
  focusLesson:line('Tomas Reed','Let your aim pass over the targets you can see. The marks follow that sweep. Release the shots when your line is clear; the world is still moving while you take that breath.'),
  focusEmpty:line('Ruth Arlow','A mark does not load a chamber. Put cartridges in the gun before you ask for another sequence.'),
  pavelRecognition:line('Pavel Dune','The coal store again, only a larger yard. I remember who opened the door. I have had time to regret coming through it.'),
  maraPavel:line('Mara Vale','You were released, Pavel. That was a choice you could have carried somewhere else.'),
  disarm:line('Bastian Holt','My revolver! He took it when I went for his wrist. Do not put a second bullet through the grip trying to prove it is yours.'),
  revolverReturned:line('Bastian Holt','The name on that plate is mine. I will remember you returned it even if we disagree about everything else.'),
  revolverClaimed:line('Bastian Holt','So a rescue turns into a claim of its own. Della can write who is holding it; she knows who brought it here.'),
  surrender:line('Quarry shed guard','I kept the scale key so my boys could eat. The gun is down. Search me standing if you must, but let the letter stay readable.'),
  pocketSearch:line('Mara Vale','Cartridges, a little money, and a folded letter. This pocket belonged to someone before it became a way to refill a gun.'),
  letterResponse:line('Ruth Arlow','I knew the writer when the scales weighed our stone. Calder did not invent every person he hired.'),
  patrolWarning:line('Emmett Rowan','West trunks — two sleeves, then rifles. Inez sees the east approach moving too. They were out there when the first shot reached them.'),
  tactics:line('Tomas Reed','We can hold the wheels and cut their angles, or meet the first patrol in the timber before the reserve reaches the gap. Choose where we stand; the men still have to be stopped.'),
  hold:line('Ruth Arlow','I take the low wheel. Tomas watches east, Bastian watches west. Leave an opening behind us for the horses.'),
  advance:line('Bastian Holt','I take the west trees. Tomas, keep the upper gap in sight. Inez and Emmett, the ramp is your side.'),
  reserve:line('Emmett Rowan','Four more through the northern gap. The first coats were only the forward patrol; do not turn your back on the timber yet.'),
  allyWounded:line('Inez Pike','We have a hurt person here. Calling the yard clear will not close that wound. Keep room for me to reach them.'),
  retreat:line('Ruth Arlow','They are taking their own road out. Watch the rifles, but remember which backs have stopped firing.'),
  searches:line('Tomas Reed','Bastian, the weighhouse papers. Ruth, the cap wagon and the charges. Mara, open the magazine crate where she can see what is inside. Inez and Emmett bring the mounts down the east ramp.'),
  crateOpen:line('Ruth Arlow','Four waxed charges. Set each where the cap end can be seen. Hand me one across the bench; keep the rest still.'),
  chargeInspect:line('Ruth Arlow','Seal sound, lead dry, no grit in the socket. This is quarry work kept badly, not spoiled powder. Put this one back in its own cradle.'),
  crateRepack:line('Ruth Arlow','All four are counted and sealed. I carry the crate. The tin is separate, and it stays shut until we have a prepared place.'),
  capTin:line('Ruth Arlow','That is the cap wagon. Bring the copper tin to my hands; an empty wagon is not evidence that we recovered its load.'),
  bastianPapers:line('Bastian Holt','Diagram under the ledger, seizure list inside its cover. Tomas, take both. I searched the room; I did not search the northern road for your commander.'),
  emmettScale:line('Emmett Rowan','Short squares are survey chains. The creek spur takes wagons, not a locomotive. He means to detach the bond coach before the bridge.'),
  papers:line('Tomas Reed','A bond box and the deeds beside it. He can sell the same roof twice if the public ledger never sees this copy.'),
  mountRetrieval:line('Inez Pike','The ramp is clear. Thimble comes first, then the others. Keep the mouths out of the powder dust and let them walk.'),
  convoy:line('Tomas Reed','The charges, the diagram, the list — and six riders going home. Calder thought a few signatures made him untouchable.'),
  challengeInjuries:line('Mara Vale','Six riders can come home hurt. Count the wounds as well as the saddles before you call it clean.'),
  injuriesAnswer:line('Tomas Reed','Then put them in the account. I will not ask Della to erase a cost because I like the result.'),
  huntFirst:line('Ruth Arlow','The kitchen has the venison it counted and the hides have their owners. Juno should get to rest those fingers. This crate does not make anyone less hungry.'),
  rivalFirst:line('Inez Pike','We still owe the kitchen a food journey. Bring this work home, then let Juno choose the quiet trail.'),
  leviRecognition:line('Levi Senn','The yard riders. No — Skein, go. They will call the coat my choice.'),
  chaseStart:line('Tomas Reed','Bring him back alive. He copied the warrant hand; he may know which signatures Calder changed.'),
  chaseRecovery:line('Inez Pike','A missed loop is still rope. Gather it and find a clear line; the trees will catch what the man does not.'),
  ropeCaught:line('Levi Senn','Ease it. I can stop, but the mare cannot tell which way that pull wants her.'),
  ropeSlack:line('Inez Pike','The loop has gone loose. Reach him again before you try a knot; he is not tied because you once touched him.'),
  footCapture:line('Mara Vale','Stop running. Put your hands where I can see them and let me bind them without breaking anything else.'),
  skeinWounded:line('Levi Senn','She pulled my family’s cart before I ever wore this coat. You cannot make that injury part of a clean capture.'),
  skeinDead:line('Inez Pike','Skein is dead. Record her name and how it happened. We bring Levi on foot; no other horse becomes her because we need an easier road.'),
  bind:line('Levi Senn','I copied names. I did not choose the houses. Leave room for my hands to stay warm.'),
  lift:line('Mara Vale','I am lifting you to the saddle. Keep still while I set the strap; a fall helps neither of us.'),
  loadConflict:line('Inez Pike','Copper has one rear place for a large load. Unload what is there into real custody before you try to put a person over it.'),
  strap:line('Inez Pike','Under the blanket fold, clear of his throat. Check both knots. The horse should carry the weight, not the rope around him.'),
  leviName:line('Levi Senn','Levi Senn. Twenty-four. Farrier’s assistant when there is honest work. Calder bought our arrears, then said my writing would pay them.'),
  leviDestination:line('Levi Senn','Where are you taking me? If the answer is a ditch, say it before the mare learns to follow you.'),
  assurance:line('Mara Vale','A guarded room, food if we have it, and a chance to check what you said against the papers. I can promise the checking. I cannot promise everyone will listen easily.'),
  threat:line('Mara Vale','You will answer when we reach the room. Make the answers useful and you will have less to fear.'),
  leviThreat:line('Levi Senn','Useful to which of you? Calder called the copied hand useful too.'),
  bindingsWarning:line('Inez Pike','The rear knot is loosening. Stop where there is room and check him before a frightened movement becomes a fall.'),
  separationWarning:line('Ruth Arlow','The load and the convoy need the same road. We can wait through a short detour; we cannot leave a bound person in weather while you disappear.'),
  doorway:line('Della Wren','Bring him through the wide doorway. The list can wait on the desk; the person cannot wait under the saddle.'),
  cardQuestion:line('Della Wren','Forty-one paid, seventeen written again. That is what his card says, and the same second sum appears on Calder’s list.'),
  signatureQuestion:line('Mara Vale','Five signatures with the same narrow tail. Which are copies, and which did you see someone sign?'),
  signatureAnswer:line('Levi Senn','I copied all five names from a loose sheet. I saw none of those people. The flour stain was on the sheet before I touched it; I can tell you that, not who held the pen first.'),
  identityDenial:line('Levi Senn','The coat was issued with the debt. Calling me a Claimant does not tell you whether I claimed anything.'),
  coercion:line('Bastian Holt','He kept the hand moving while families lost their roofs. Make him feel what that costs before he learns another answer.'),
  objection:line('Mara Vale','Pain can make him agree with the question. It cannot make the witness sheet appear.'),
  temporaryHold:line('Tomas Reed','Guard him until we can check the witness sheet. His debt is not acquittal, and Bastian’s anger is not a verdict.'),
  care:line('Ruth Arlow','One counted meal, one blanket if the cupboard has it, and room beneath the knots. We can guard a person without pretending he has stopped being one.'),
  noStock:line('Della Wren','The cupboard has no spare portion for that promise. Write what we can give now and what still needs fetching; do not subtract an imaginary meal.'),
  deprivation:line('Bastian Holt','Then leave the bowl outside his reach. He can think about copied roofs while he waits.'),
  deprivationResponse:line('Levi Senn','You can make the room smaller. It will not make the sheet I never saw any closer.'),
  helperHandoff:line('Ruth Arlow','Hob, take his other side. Mara, keep the binding clear while we turn. We set him down together, on the holding bench.'),
  hobHandoff:line('Hob Jarrow','Boots first through the turn. I know how a cramped toe feels; I do not need a uniform to tell me.'),
  store:line('Ruth Arlow','Four sealed charges in my store; caps in the separate cupboard. Their next use needs its own preparation. Bringing them home did not prepare a train.'),
  account:line('Della Wren','Money from actual pockets, cartridges remaining, wounds still present. Levi Senn is a name in this account, not a crate beside the powder.'),
  completion:line('Tomas Reed','The route is ours to examine now. We finish the food work too, then decide what preparation the railroad requires. Tonight the people and animals get their places back.'),
  visitFirst:line('Levi Senn','Skein knows a loose nail by the way a hoof lands. If she came home, have someone check the near fore shoe. I can explain the shoe without asking you to trust the signatures.'),
  visitSecond:line('Levi Senn','The copied hand was mine. I can say that without saying the debts were true. Bring the loose sheet when you find it; I want to know whose name Calder made me write first.'),
  readinessPause:line('Della Wren','We have time to visit the hurt, read the account and see what remains at camp. The next road starts when its preparation is real and the people leaving choose it.'),
  failExposure:line('Tomas Reed','The yard saw us before the screened approach was ready. Recover at the last safe position; the party cannot vanish behind a released trigger.'),
  failCaptive:line('Inez Pike','Levi cannot give testimony now. We do not replace a person with another coat and call the same journey finished.'),
  failCharges:line('Ruth Arlow','The essential charges are gone. We cannot rebuild four sealed loads by opening an empty crate. Return to a real checkpoint before that loss.'),
};
