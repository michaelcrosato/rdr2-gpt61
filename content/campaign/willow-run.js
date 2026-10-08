/** A Quiet Table: complete original hunting world authoring.
 * Coordinates are absolute ground units. Quantities and animal variants are original
 * balancing; the wiki's exact variants, trigger timings and conditional audit remain open.
 */
export const HUNT_ID = 'snowbound-a-quiet-table';
export const HUNT_STAGES = [
  'Speak with Orla, hear Moss and Vera, and ask Juno about the food expedition.',
  'Inspect Juno’s ash bow at Copper’s rack. Equip it, check the arrows, and leave with Juno and Bracken.',
  'Ride the sheltered route to Willow Run. Stop at the bank and learn the wind before dismounting.',
  'Move quietly and inspect hoofprints and cropped stems. Read signs is optional; follow the real continuing trail.',
  'Find the creek doe at the reed pool. Draw, cancel or release the bow; recover a miss or finish a wound humanely.',
  'Cross the shallow creek and follow the cedar buck. Wait for a vital angle or track it to its next patch.',
  'Inspect both bodies and recover reachable arrows. Carry one carcass to Copper; let Juno load Bracken’s separate slot.',
  'Return toward the gorge. Keep both loaded mounts safe, detour around the bear, and speak with Juno on the hillside.',
  'Hitch at the drying shed. Unload Copper, deliver your carcass to the first bench, and see Juno deliver the second.',
  'Take the field knife and skin the first deer with Orla. She processes the second body at its own bench.',
  'Hang the hide, inspect Della’s account, choose retain or donate, and see Orla cook from the recorded meat.',
];
export const HUNT_STAGE_DETAILS = [
  { stage:0,id:'warm-bowl',name:'A bowl left warm',actors:['orla','moss','vera','juno'],required:['talk:orla','talk:moss-hunt','talk:vera-hunt','talk:juno','accept:hunt'],optional:['ask:pantry','ask:juno-hand','decline:hunt'],checkpoint:'accepted-table',minorBeats:['existing pantry read from live stock','two distinct failed-hunter accounts','Juno points to sheltered rests on the flour map','one spiced bean ration given once'] },
  { stage:1,id:'ash-bow',name:'A bow at the hitch',actors:['juno','mara','copper','bracken'],required:['rack:inspect-bow','equip:ash-bow','mount','depart:willow'],optional:['rack:store-bow','ask:bow-again'],checkpoint:'equipment-secured',minorBeats:['owned bow and exactly22 starting arrows','separate revolver/coach ammunition untouched','Juno saddles and mounts Bracken physically','delayed retrieval leaves Juno waiting reliably'] },
  { stage:2,id:'quiet-way',name:'The quiet way upstream',actors:['mara','juno','copper','bracken'],required:['arrive:sheltered-bank','lesson:wind','dismount','hitch:bank'],optional:['rest:bank','eat:quiet-ration'],minorBeats:['culvert shelter versus noisy freight-road fork','companion separation pauses route talk','injured hand limits bow use','wind direction shown before alert punishment'] },
  { stage:3,id:'living-sign',name:'Read what moved',actors:['mara','juno'],required:['inspect:split-hoof','inspect:cropped-stems','confirm:reed-trail'],optional:['read-signs','inspect:false-fork','rack:retrieve-bow'],checkpoint:'reed-trail-confirmed',minorBeats:['quiet crouch instruction','tracking overlay genuinely optional','hooves and stems readable without overlay','wrong fork and stored-bow recovery'] },
  { stage:4,id:'reed-bank',name:'The reed-bank shot',actors:['mara','juno','willow-creek-doe'],required:['kill:willow-creek-doe'],optional:['draw-bow','cancel-draw','track:wound','finish:willow-creek-doe','use:alternate-weapon'],checkpoint:'first-deer-dead',minorBeats:['real draw/hold/release with stamina and overdraw sway','one-arrow history independent from misses','vital/body zone and immediate clean death distinguished','recoverable relocation and blood sign','humane finish changes optional eligibility'] },
  { stage:5,id:'cedar-crossing',name:'Across the creek',actors:['mara','juno','willow-cedar-buck'],required:['inspect:ford-hoof','inspect:cedar-rub','kill:willow-cedar-buck'],optional:['read-signs','wait:head-angle','track:wound','finish:willow-cedar-buck'],minorBeats:['separate prey identity/history/quality','water interrupts ordinary footprints','head/neck pose changes the valid shot','local spook differs from irretrievable escape','gun noise prompts recoverable relocation'] },
  { stage:6,id:'two-loads',name:'Two loads',actors:['mara','juno','copper','bracken'],required:['inspect:doe-body','carry:doe','whistle','load:copper','juno:load-bracken'],optional:['recover:arrow','inspect:buck-body','swap:carcass'],checkpoint:'both-carcasses-loaded',minorBeats:['dead bodies remain animals, never inventory counters','one exclusive rear large-load slot per mount','arrival must precede load','Juno uses healthy shoulder and does not draw or skin','pack/rack/passenger occupancy separate'] },
  { stage:7,id:'gorge-detour',name:'The gorge detour',actors:['mara','juno','copper','bracken','willow-gorge-bear'],required:['see:gorge-bear','ride:hill-detour','talk:juno-return'],optional:['aim:bear','fire:bear-warning'],checkpoint:'safe-hillside',minorBeats:['visible bear across physical rock/channel separation','aim and fire have different warnings/reactions','both mounts show fear and settle through safe travel','no reachable trophy kill objective','order-sensitive discussion of work/fairness/belonging','rival captive stays separate from Pavel'] },
  { stage:8,id:'return-bench',name:'Bring it to the bench',actors:['mara','juno','orla','hob','copper','bracken'],required:['hitch:kitchen','dismount','unload:copper','deliver:bench-mara','juno:deliver-bench','hob:leave'],optional:['drink:cider','talk:orla-return','rest:juno-hand'],checkpoint:'both-bodies-delivered',minorBeats:['two reachable work surfaces and visible walking deliveries','Hob claims credit then physically leaves to avoid cleaning','optional cider independent from completion','Juno rests injured fingers visibly'] },
  { stage:9,id:'whole-hide',name:'Keep the hide whole',actors:['mara','orla','juno'],required:['take:field-knife','skin:bench-mara','orla:skin-bench'],optional:['inspect:knife','ask:skin-again'],minorBeats:['existing knife reused rather than duplicated','readable blade/body contact sequence','Orla assists and processes second carcass separately','two distinct exactly-once yield records','processed body cannot remain whole or yield twice'] },
  { stage:10,id:'fair-account',name:'A meal and a fair account',actors:['mara','orla','della','juno','tomas'],required:['hang:hide','talk:della-yields','choose:hide-owner','cook:broth','finish:hunt'],optional:['retain:hide','donate:hide','talk:tomas-order','take:retained-hide'],minorBeats:['meat community-owned while hide ownership is explicit','Juno gives second hide to community in her own choice','no imaginary sale proceeds','actual starter fuel and meat consumption recorded','bow/remaining arrows persist','injuries and both previous mission states persist','hunt AND rival required for later unauthored heist; no fake mission button'] },
];
export const HUNT_ITEMS = {
  quietRation:{name:'Spiced bean ration',description:'Orla’s single gift, retained or consumed according to actual use.'},
  ashBow:{name:'Juno’s ash bow',description:'A handed-over bow with its own arrow supply and ownership.'},
  arrow:{name:'Field arrow',description:'A real shaft may remain recoverable, break, or become inaccessible.'},
  fieldKnife:{name:'Field skinning knife',description:'Reuse Mara’s existing knife; grant this instance only if none exists.'},
  rawVenison:{name:'Fresh venison portions',description:'Actual portions from one processed carcass, entered in the pantry before cooking.'},
  deerHide:{name:'Deer hide',description:'Each hide has its own quality, owner and ground/rack/carried location.'},
  tableBroth:{name:'Fresh table broth',description:'Cooked from recorded pantry meat and explicitly supplied kitchen fuel.'},
  kitchenStarterFuel:{name:'Dry kitchen splits',description:'Orla’s authored processing fuel, separate from previously recovered kindling.'},
  warmCider:{name:'Warm kitchen cider',description:'An optional offered drink; its actual serving is consumed once.'},
};
export const HUNT_BOW = {id:'juno-ash-bow',name:'Juno’s ash bow',kind:'bow',owner:'mara',ammoType:'arrow',capacity:1,ammo:1,reserve:21,initialArrows:22,condition:1,sourceId:'juno'};
export const HUNT_CAST = [
  {id:'orla',name:'Orla Venn',role:'boardinghouse cook and communal kitchen organizer',x:175,y:1250,z:0,hp:100,faction:'camp',regionId:'snowbound'},
  {id:'juno',name:'Juno Mercier',role:'injured packer, tracker and chosen hunting companion',x:265,y:1170,z:0,hp:100,faction:'camp',regionId:'snowbound',injured:true,handInjury:{side:'right',fingers:2},healthyShoulder:'left'},
  {id:'hob',name:'Hob Jarrow',role:'cobbler and kitchen bystander',x:105,y:1300,z:0,hp:100,faction:'camp',regionId:'snowbound'},
  {id:'bracken',name:'Bracken',kind:'horse',role:'Juno’s dark bay pack horse',x:185,y:1165,z:0,hp:100,stamina:100,fear:0,bond:3,owned:true,ownerId:'juno',hitched:true,pack:{},regionId:'snowbound',largeLoad:null,coat:'dark-bay',marking:'left-front-white-fetlock'},
];
export const HUNT_ANIMALS = [
  {id:'willow-creek-doe',name:'Willow creek doe',kind:'deer',sex:'doe',role:'first required prey',habitatId:'reed-bank',x:1360,y:1060,z:0,facing:-1.95,hp:100,phase:'drink',quality:3,alert:0,processed:false,regionId:'willow-run'},
  {id:'willow-cedar-buck',name:'Willow cedar buck',kind:'deer',sex:'buck',role:'second required prey',habitatId:'cedar-shelf',x:1850,y:760,z:0,facing:2.5,hp:110,phase:'browse',quality:3,alert:0,processed:false,regionId:'willow-run'},
  {id:'willow-gorge-bear',name:'Cinnamon gorge bear',kind:'bear',role:'separated return encounter',habitatId:'bear-bank',x:2050,y:1060,z:0,facing:2.8,hp:360,phase:'forage',alert:0,processed:false,regionId:'willow-run',encounterOnly:true},
];
const stream=[{x:2110,y:190},{x:1890,y:575},{x:1560,y:865},{x:1450,y:1030},{x:1320,y:1100},{x:1210,y:1370},{x:1210,y:1580},{x:1330,y:1870}];
const trail=[{x:260,y:1700},{x:410,y:1550},{x:550,y:1450},{x:700,y:1410},{x:700,y:1350},{x:840,y:1270}];
const returnRoute=[{x:1790,y:850},{x:1850,y:1015},{x:1860,y:1170},{x:1700,y:1270},{x:1480,y:1430},{x:1200,y:1580},{x:920,y:1630},{x:620,y:1660},{x:260,y:1700}];
export const WILLOW_RUN_WORLD = {
  id:'willow-run',width:2400,height:1900,
  entry:{id:'willow-gate',x:260,y:1700,z:0},travelGate:{regionId:'snowbound',x:720,y:760,z:0,name:'Willow branch of the northern trail'},
  places:[{id:'willow-gate',name:'Willow Trail Gate',x:260,y:1700},{id:'thaw-culvert',name:'Thawing Culvert',x:550,y:1450},{id:'freight-road',name:'Freight Road Fork',x:640,y:1360},{id:'sheltered-bank',name:'Sheltered Dismount Bank',x:840,y:1270},{id:'reed-pool',name:'Unfrozen Reed Pool',x:1320,y:1100},{id:'shallow-crossing',name:'Willow Creek Ford',x:1530,y:920},{id:'cedar-shelf',name:'Cedar Feeding Shelf',x:1850,y:760},{id:'bear-gorge',name:'Gorge Shoulder',x:1940,y:1120},{id:'return-hillside',name:'Sheltered Hillside Detour',x:1700,y:1270}],
  trail,returnRoute,searchRoute:[{x:900,y:1228},{x:1050,y:1190},{x:1170,y:1130},{x:1280,y:1130}],
  secondRoute:[{x:1340,y:1050},{x:1460,y:970},{x:1530,y:920},{x:1610,y:875},{x:1690,y:830},{x:1780,y:810}],
  wrongFork:[{x:1050,y:1190},{x:1050,y:1030},{x:930,y:955}],
  terrainZones:[{id:'mud-bank',kind:'mud',x:865,y:1155,w:390,h:155,noise:.65,speed:.9},{id:'reed-snow',kind:'snow',x:1110,y:870,w:485,h:385,noise:.5,speed:.94},{id:'cedar-grass',kind:'grass',x:1630,y:590,w:550,h:390,noise:.38,speed:1},{id:'culvert-shelter',kind:'shelter',x:470,y:1390,w:190,h:140,noise:.4,speed:1},{id:'bank-rest',kind:'shelter',x:760,y:1210,w:200,h:170,noise:.35,speed:1}],
  stream,river:stream,creekWidth:56,pools:[{id:'reed-pool',x:1320,y:1100,rx:88,ry:62,depth:.25}],
  fords:[{id:'creek-ford',x:1480,y:880,w:120,h:95,depth:.16},{id:'return-ford',x:1150,y:1510,w:140,h:150,depth:.18}],
  wind:{x:-.84,y:.3,speed:.55,gust:.22},
  noiseZones:[{id:'freight-road-noise',x:465,y:1260,w:240,h:150,sourceId:'freight-road',strength:.65,period:18}],
  shelter:{id:'bank-rest',x:840,y:1270,z:0},hitch:{id:'bank-hitch',x:840,y:1320,z:0},mountParking:{copper:{x:812,y:1315,z:0},bracken:{x:870,y:1320,z:0}},
  coverZones:[{id:'willow-screen',x:1210,y:1115,w:110,h:105,concealment:.6,scentShelter:.4},{id:'cedar-screen',x:1730,y:785,w:95,h:110,concealment:.65,scentShelter:.3}],
  habitats:[
    {id:'reed-bank',animalId:'willow-creek-doe',bounds:{x:1160,y:860,w:515,h:425},recoverableBounds:{x:1060,y:780,w:790,h:620},routine:[{x:1270,y:1170},{x:1330,y:1130},{x:1360,y:1060},{x:1390,y:1085},{x:1410,y:1140}],relocations:[{x:1490,y:1125},{x:1430,y:955},{x:1580,y:1035}],escapeRoute:[{x:1580,y:1035},{x:1740,y:980},{x:1890,y:885},{x:2170,y:800},{x:2340,y:700}],initialTracks:[{x:975,y:1210},{x:1020,y:1185},{x:1070,y:1165},{x:1120,y:1145},{x:1190,y:1155},{x:1270,y:1170},{x:1295,y:1153},{x:1320,y:1136},{x:1330,y:1115},{x:1345,y:1088},{x:1360,y:1060}],speciesStatus:'original variant; source compendium reconciliation pending'},
    {id:'cedar-shelf',animalId:'willow-cedar-buck',bounds:{x:1610,y:530,w:615,h:480},recoverableBounds:{x:1450,y:410,w:855,h:700},routine:[{x:1570,y:900},{x:1670,y:850},{x:1760,y:815},{x:1850,y:760},{x:1940,y:715}],relocations:[{x:1960,y:660},{x:1760,y:590},{x:2120,y:800}],escapeRoute:[{x:2120,y:800},{x:2240,y:600},{x:2350,y:420}],initialTracks:[{x:1470,y:968},{x:1510,y:945},{x:1550,y:912},{x:1570,y:900},{x:1670,y:850},{x:1740,y:825},{x:1800,y:795},{x:1850,y:760}],speciesStatus:'original variant; source compendium reconciliation pending'},
    {id:'bear-bank',animalId:'willow-gorge-bear',bounds:{x:1990,y:940,w:280,h:390},routine:[{x:2050,y:1060},{x:2140,y:1110},{x:2210,y:1040}],retreatRoute:[{x:2140,y:1110},{x:2190,y:1210},{x:2280,y:1250}],speciesStatus:'cinnamon-colored staged encounter; precise source bear trigger behavior pending'},
  ],
  bearEncounter:{trigger:{x:1810,y:1040,w:120,h:200},viewpoint:{x:1860,y:1170,z:0},bearBank:{x:2050,y:1060,z:0},detour:[{x:1860,y:1170},{x:1800,y:1190},{x:1700,y:1270},{x:1580,y:1330}],physicalSeparation:['gorge-channel','gorge-shoulder'],warningAim:'Juno gestures to the far bank and lowers her wrapped hand. The bear has a way out; so do we.',warningFire:'The report rolls through the gorge. Bracken jumps, and the bear turns into the cedars. Keep riding the hillside.',noTrophyObjective:true,sourceTriggerStatus:'unverified conditional sequence'},
  animalHitZones:{deer:{body:{forward:0,z:19,rx:24,ry:8,height:15},vital:{forward:11,z:23,rx:8,ry:6,height:10},neck:{forward:22,z:30,rx:6,ry:5,height:11},head:{forward:28,z:37,rx:6,ry:4,height:8}},bear:{body:{forward:0,z:25,rx:30,ry:12,height:28}}},
  props:[
    {id:'willow-gate',kind:'trailpost',x:260,y:1700,z:0},{id:'thaw-culvert',kind:'culvert',x:550,y:1450,z:0},{id:'freight-road',kind:'road-sign',x:625,y:1370,z:0},{id:'bank-hitch',kind:'hitch',x:840,y:1320,z:0},{id:'bank-rest',kind:'rest',x:840,y:1270,z:0},{id:'wind-ribbon',kind:'ribbon',x:880,y:1260,z:0},
    {id:'split-hoof',kind:'hoof-sign',x:975,y:1210,z:0,animalId:'willow-creek-doe',terrain:'mud'},{id:'cropped-stems',kind:'browse-sign',x:1120,y:1145,z:0,animalId:'willow-creek-doe'},{id:'false-fork',kind:'old-track',x:1020,y:1035,z:0},{id:'ford-hoof',kind:'hoof-sign',x:1510,y:945,z:0,animalId:'willow-cedar-buck',terrain:'water'},{id:'cedar-rub',kind:'browse-sign',x:1670,y:850,z:0,animalId:'willow-cedar-buck'},
    {id:'gorge-view',kind:'gorge-marker',x:1860,y:1170,z:0},{id:'split-cart',kind:'abandoned-cart',x:615,y:1330,z:0},
  ],
  obstacles:[
    {id:'culvert-north-bank',kind:'stone',x:465,y:1360,w:195,h:24,height:38},{id:'culvert-south-bank',kind:'stone',x:465,y:1535,w:185,h:24,height:35},{id:'shelter-log',kind:'log',x:775,y:1190,w:135,h:22,height:20},
    {id:'pool-root-west',kind:'root',x:1180,y:1050,w:38,h:24,height:18},{id:'cedar-boulder',kind:'rock',x:1700,y:700,w:65,h:42,height:48},
    {id:'gorge-channel',kind:'ravine',x:1940,y:970,w:70,h:380,height:0,impassable:true},{id:'gorge-shoulder',kind:'rock',x:1945,y:980,w:60,h:135,height:88,projectileCover:true},
    {id:'gorge-north-channel',kind:'ravine',x:1940,y:900,w:390,h:70,height:0,impassable:true},
    {id:'gorge-south-channel',kind:'ravine',x:1940,y:1350,w:390,h:60,height:0,impassable:true},
    {id:'gorge-east-wall',kind:'rock',x:2300,y:900,w:30,h:510,height:84,projectileCover:true},
    {id:'bear-bank-root',kind:'root',x:2170,y:990,w:55,h:32,height:23},{id:'return-scree',kind:'rock',x:1720,y:1360,w:105,h:30,height:40},
  ],
  interiors:[],elevationZones:[],anchors:[{id:'bank-rest',x:840,y:1270,z:0}],
  camp:{
    gate:{id:'willow-camp-gate',x:720,y:760,z:0},arrival:{x:270,y:1170,z:0},hitch:{id:'kitchen-hitch',x:215,y:1165,z:0},mountParking:{copper:{x:245,y:1165,z:0},bracken:{x:185,y:1165,z:0}},
    doorway:{x:245,y:1270,z:0},benchMara:{id:'hunt-bench-mara',x:125,y:1245,z:24},benchJuno:{id:'hunt-bench-juno',x:125,y:1295,z:24},knife:{id:'kitchen-knife',x:175,y:1220,z:28},hideRack:{id:'kitchen-hide-rack',x:70,y:1165,z:0},pantry:{id:'kitchen-pantry',x:85,y:1220,z:0},stove:{id:'kitchen-stove',x:85,y:1320,z:0},flourMap:{id:'flour-map',x:190,y:1298,z:24},account:{id:'kitchen-account',x:275,y:1180,z:0},handRest:{id:'juno-hand-rest',x:195,y:1315,z:0},hobExit:{x:290,y:1120,z:0},
    workpoints:{mara:{x:125,y:1259,z:0},orla:{x:125,y:1309,z:0},guide:{x:149,y:1259,z:0},cook:{x:110,y:1320,z:0}},
    deliveryRoute:[{x:270,y:1170,z:0},{x:270,y:1220,z:0},{x:270,y:1270,z:0},{x:205,y:1270,z:0},{x:175,y:1245,z:0}],junoDeliveryRoute:[{x:185,y:1165,z:0},{x:270,y:1185,z:0},{x:270,y:1270,z:0},{x:195,y:1270,z:0},{x:175,y:1295,z:0}],hobDepartureRoute:[{x:105,y:1300,z:0},{x:195,y:1300,z:0},{x:205,y:1270,z:0},{x:270,y:1270,z:0},{x:270,y:1180,z:0},{x:290,y:1120,z:0}],
    interiors:[{id:'drying-shed-kitchen',name:'Orla’s drying-shed kitchen',x:65,y:1200,w:175,h:140,height:64,doors:[{x:240,y:1270,w:64}]}],
    obstacles:[{id:'kitchen-west',kind:'timber-wall',x:57,y:1192,w:8,h:156,height:64},{id:'kitchen-north',kind:'timber-wall',x:65,y:1192,w:183,h:8,height:64},{id:'kitchen-south',kind:'timber-wall',x:65,y:1340,w:183,h:8,height:64},{id:'kitchen-east-north',kind:'timber-wall',x:240,y:1200,w:8,h:38,height:64},{id:'kitchen-east-south',kind:'timber-wall',x:240,y:1302,w:8,h:38,height:64}],
    props:[{id:'kitchen-hitch',kind:'hitch',x:215,y:1165,z:0},{id:'hunt-bench-mara',kind:'processing-bench',x:125,y:1245,z:24},{id:'hunt-bench-juno',kind:'processing-bench',x:125,y:1295,z:24},{id:'kitchen-knife',kind:'knife-station',x:175,y:1220,z:28},{id:'kitchen-hide-rack',kind:'hide-rack',x:70,y:1165,z:0},{id:'kitchen-pantry',kind:'pantry',x:85,y:1220,z:0},{id:'kitchen-stove',kind:'stove',x:85,y:1320,z:0},{id:'flour-map',kind:'flour-map',x:190,y:1298,z:24},{id:'juno-hand-rest',kind:'chair',x:195,y:1315,z:0},{id:'kitchen-account',kind:'account',x:275,y:1180,z:0}],
  },
};
export const WILLOW_WORLD = WILLOW_RUN_WORLD;
// One geometry contract for visible native animal joints, pointer projection and
// independent projectile intersections. Pose belongs to the simulation rather
// than a renderer clock; aiming never makes a hidden target guarantee.
export function huntAnimalHitZones(actor) {
  if (!actor || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) return [];
  const template = WILLOW_RUN_WORLD.animalHitZones[actor.kind];
  if (!template) return [];
  const facing = Number.isFinite(actor.facing) ? actor.facing : 0;
  const c = Math.cos(facing), s = Math.sin(facing), pose = actor.hunt?.pose || actor.phase;
  return Object.entries(template).map(([id, source]) => {
    let forward = source.forward, z = source.z;
    if (actor.kind === 'deer') {
      if (pose === 'drink') {
        if (id === 'neck') { forward = 22; z = 21; }
        if (id === 'head') { forward = 32; z = 12; }
      } else if (pose === 'head-up') {
        if (id === 'neck') { forward = 20; z = 33; }
        if (id === 'head') { forward = 25; z = 43; }
      }
    }
    return { id, name:id, x:actor.x + c * forward, y:actor.y + s * forward,
      z:(actor.z || 0) + z, rx:source.rx, ry:source.ry, height:source.height, facing };
  });
}
export function huntBowHeading(actor,bow) {
  const aim=bow?.aim;
  if(!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return actor.facing||0;
  return Math.atan2(aim.y-actor.y,aim.x-actor.x)+Math.sin(((bow.serial||0)+1)*13.7+(bow.age||0)*9)*(bow.sway||0);
}
export function huntBowGiftStance(horse) {
  const heading=horse.facing||0,c=Math.cos(heading),s=Math.sin(heading);
  return {x:horse.x-26*c+12*s,y:horse.y-26*s-12*c,z:horse.groundZ||0,facing:heading+Math.atan2(4,8)};
}
export const HUNT_DIALOGUE = {
  orlaOpening:{speaker:'Orla Venn',text:'The pantry is not empty. Its ledger says what we have, and I will not make hunger out of an accounting trick. Fresh broth will help the patients and stretch the preserved food for the east road.',choices:[['ask-pantry','Read the actual pantry stock.'],['ask-hunters','What happened to Moss and Vera?'],['ask-juno','Speak with Juno about the route.']]},
  mossAccount:{speaker:'Moss Laird',text:'I set the shovel down. The drift took it, and the sound went clear across the bank. Vera says the tracks were already turning away. I say we both watched the wrong end of the animal.'},
  veraAccount:{speaker:'Vera Holl',text:'His shovel rang against a stone. We followed prints with ice in the bottoms, while the new ones crossed the mud. We were arguing when we should have been looking.'},
  junoInvitation:{speaker:'Juno Mercier',text:'Two fingers are crushed. The rest of me still knows this country. I can read the sign and bring one load; you will make the shots. See these rests on Orla’s flour map? We use them, and we return together.'},
  bowGift:{speaker:'Juno Mercier',text:'Ash bends where it should. Take the bow and these twenty-two arrows; keep your other guns and their rounds separate. I cannot pull this string now, but I can teach you where to stand.'},
  windLesson:{speaker:'Juno Mercier',text:'Watch the ribbon and the reed tips. Let the breeze carry your smell away from the feeding bank. A careful foot is quiet; a frightened horse is not.'},
  signLesson:{speaker:'Juno Mercier',text:'The split print goes through the soft edge. The stem was clipped before the snow settled. Read signs can help, but your eyes can follow what is already on the ground.'},
  wrongFork:{speaker:'Juno Mercier',text:'That ice grew inside an old print. We can return to the last fresh stem. A wrong turn does not have to become a lost animal.'},
  woundRecovery:{speaker:'Juno Mercier',text:'It is hurt, and the dark drops mark where it went. Follow carefully and finish what you began. A clean record matters less than leaving it to suffer.'},
  loadLesson:{speaker:'Juno Mercier',text:'Call Copper, then let her reach you. One whole body goes on her rear rack. I will use my sound shoulder and Bracken’s rack for the other; neither mare carries both.'},
  returnBelonging:{speaker:'Juno Mercier',text:'I have been paid for a trail before, then spoken over when the work was done. If I stay, I want my skill counted and my voice at the table. Orla has already left a place.'},
  returnLosses:{speaker:'Juno Mercier',text:'We leave one place, then another, and the absent seats travel with us. I heard whose name was said at the refuge. I will not use the dead to hurry the living; bring the broth home while it can help.'},
  returnRoad:{speaker:'Juno Mercier',text:'Orla is counting food for an eastward camp, not promising that the road will be kind. I trust her count because she lets Della check it. Trust is work someone can look at again tomorrow.'},
  returnMounts:{speaker:'Juno Mercier',text:'Bracken knows my left shoulder and Copper knows your voice. Those names matter when a noise reaches them before we do. Speak to your mare, leave room for mine, and neither load becomes a reason to forget the animal carrying it.'},
  rivalBefore:{speaker:'Tomas Reed',text:'Let the food settle our breathing before the next search. The freight office and its guards still need their own answers. This hide does not solve that work.'},
  rivalAfter:{speaker:'Tomas Reed',text:'After the freight-office operation, our account must include the person taken there and what we promised. Pavel’s earlier fate remains his own story. We can plan the next road only from the work actually finished.'},
  hobBanter:{speaker:'Hob Jarrow',text:'I told them a willow always knows where water is. Orla says a cobbler ought to know where a broom is. I had best take these boots outside before she proves it.'},
  cider:{speaker:'Orla Venn',text:'There is one warm cider here if you want it. The benches will still need work after the cup. Juno, rest those fingers; showing a route was enough for today.'},
  skinLesson:{speaker:'Orla Venn',text:'Set the edge under the hide, with your other hand lifting it away. Long cuts tear what short careful cuts keep. I will guide the first, then work the other bench while you finish.'},
  account:{speaker:'Della Wren',text:'Meat goes to the table. This first hide can stay yours for later trade, or become a community contribution. Juno has chosen to give hers. The ledger records ownership; explaining a sale does not make money appear.'},
  completion:{speaker:'Orla Venn',text:'The portions were counted before the pot was filled. We used the kitchen’s own dry splits. Silas and Gideon get broth, Juno gets a seat, and we keep what remains for the road.'},
};
