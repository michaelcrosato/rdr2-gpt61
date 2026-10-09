/** Original train-operation authoring, isolated before runtime integration.
 * Quantities/geometry are working balance proposals. They do not seal source
 * requirements or make the operation available. Existing actors are referenced
 * by identity; their health, weapons, mount history and injuries are retained.
 */
export const TRAIN_ID='snowbound-what-the-line-carries';
export const TRAIN_AUTHORING_STATUS='isolated_original_authoring_runtime_unimplemented';
export const TRAIN_SOURCE_REQUIREMENT='campaign-who-the-hell-is-leviticus-cornwall';
export const TRAIN_PREREQUISITES=['snowbound-a-quiet-table','snowbound-the-names-they-took'];
export const TRAIN_PARTY=[
 {id:'mara',mountId:'copper',assignment:'rear-coach-search',departure:'kiln-party'},
 {id:'tomas',mountId:'tomas-mount',assignment:'cab-after-signal-stop',departure:'kiln-party'},
 {id:'ruth',mountId:'plover',assignment:'turnout-circuit-and-powder',departure:'ahead'},
 {id:'bastian',mountId:'cinder',assignment:'rear-coach-search',departure:'kiln-party'},
 {id:'juno',mountId:'bracken',assignment:'lower-road-lookout',departure:'kiln-party'},
 {id:'emmett',mountId:'button',assignment:'front-opening',departure:'kiln-party'},
 {id:'nell',mountId:'rivet',assignment:'front-opening',departure:'kiln-party'},
];
export const TRAIN_STAGES=[
 'Visit Silas in the shelter. Meet Abel, hear Elin and Fin, and check the actual patient and family care.',
 'Bring the recovered diagram and seizure list to Tomas and Della. Discuss the workers and the deeds; decide whether to prepare.',
 'Inspect the same four quarry charges and the separate cap tin. Count wire and primers, prepare lawful cargo and equipment, and hand over stable and holding duties.',
 'Confirm seven distinct assignments. Let Ruth ride ahead; mount and leave with the other five riders and their own horses.',
 'Ride into the thaw at Brass Cutting. Read the culvert and stockade, hear the injury and earlier-money discussion, and rejoin the actual party.',
 'Dismount at the ridge and reach Ruth. Carry the spool, lay a continuous cable, fasten both terminals, test continuity and return the actual spool.',
 'Rejoin the waiting riders. Wear your own face covering, clear the track and watch the real engine approach.',
 'See the failed terminal and continuing train. Dismount, run to the maintenance shelf and jump onto a reachable moving roof.',
 'Reach Nell’s actual rail grip and pull her up, or let her complete her own climb. Account for Emmett’s visible fall and the party’s recovery route.',
 'Follow Nell into the tool wagon. Resolve the guard’s close struggle through actual intervention or her physical response; cross to the first firing angle.',
 'Choose the forward leader. Reach the angle, fight through the moving cars and preserve real cover, bodies, ammunition and support.',
 'Reach the cab. Resolve Harlan’s actual grapple victim and shovel, then close the regulator and apply the brake at the real controls.',
 'Stay with the decelerating consist. Fight the existing line guards and their lower-road flankers at the actual stopping place.',
 'Wait for the returning mounted party and Emmett. Resolve the injury, misfire recovery and Nell’s actual rescue history before the private coach.',
 'Demand that the three workers leave the locked room. Hear their separate refusals and fire a real warning volley against the safe iron face.',
 'Receive the second and third original charges. Place them at separate hinges, clear every person, light their finite fuses and take real shielding.',
 'Meet Etta, Conrad and Odo as separate neutral people. Hear their names, secure the case and preserve individual surrender and witness records.',
 'Search the private coach’s real compartments. Let Nell and Bastian work the safe; find both letters, the deed packet and numbered certificates, then hand over the actual papers.',
 'Decide each worker’s fate independently. Board, release or restrain reachable people, or account for actual escape or violence before departure.',
 'Reach the cab and restart safely toward the staffed halt. Call Copper, dismount at a real opening, ride home and account for unspent charges, pending securities, injuries and care.',
];

// Only genuinely new residents have spawn templates. An introduction/arrival
// event, rather than reading this array, authorizes their world appearance.
export const TRAIN_NEW_CAST=[
 {id:'nell',name:'Nell Sarto',age:22,kind:'person',role:'roof-sheet riveter and former car-maintenance apprentice',arrivalId:'nell-arrives-with-rivet',regionId:'snowbound',x:950,y:1420,z:0,hp:100,protected:true,faction:'camp',mountId:'rivet',rig:{coat:'#32676a',hat:null,hair:'#30251f',skin:'#ba8763',accessory:'stitched-work-jacket',voiceId:'nell-counts-then-acts'},portrait:{backdrop:'#304f51',accent:'#d1b679'},scheduleId:'nell-rivet-and-roof-tools'},
 {id:'rivet',name:'Rivet',kind:'horse',role:'Nell’s compact seal-brown mare',arrivalId:'nell-arrives-with-rivet',regionId:'snowbound',x:966,y:1448,z:0,hp:100,stamina:100,fear:0,bond:3,ownerId:'nell',owned:true,sex:'mare',coat:'seal-brown',marking:'white-crescent-below-right-eye',pack:{}},
 {id:'abel',name:'Abel Sedge',age:52,kind:'person',role:'itinerant lay chaplain and injured-worker visitor',arrivalId:'abel-asks-to-keep-watch',regionId:'snowbound',x:258,y:1240,z:0,hp:100,protected:true,faction:'camp',rig:{coat:'#484740',hat:'#393e39',hair:'#b5b6a3',skin:'#af886d',accessory:'sea-green-satchel',voiceId:'abel-low-watchful'},portrait:{backdrop:'#394d46',accent:'#a8c4b2'},scheduleId:'abel-patient-watch'},
 {id:'harlan',name:'Harlan Veck',age:46,kind:'rail-worker',role:'cab engineer and shovel assailant',regionId:'brass-cutting',hp:100,hostile:false,protected:false,faction:'morrow-crew',initialSupport:{carId:'morrow-engine',surfaceId:'cab-floor',local:{x:35,y:-10,z:32}},rig:{coat:'#62636a',hat:'#2b3539',hair:'#685347',skin:'#b67a54',accessory:'coal-stained-shovel',voiceId:'harlan-cab-bark'}},
 {id:'etta',name:'Etta Rill',age:34,kind:'rail-worker',role:'travelling wage-account clerk',regionId:'brass-cutting',hp:100,hostile:false,protected:false,faction:'morrow-workers',initialSupport:{carId:'morrow-custody-coach',surfaceId:'private-floor',local:{x:-25,y:-12,z:26}},rig:{coat:'#566452',hat:null,hair:'#342823',skin:'#aa7150',accessory:'green-account-folio',voiceId:'etta-formal-under-pressure'},witnessId:'etta-rill-private-coach'},
 {id:'conrad',name:'Conrad Bale',age:41,kind:'rail-worker',role:'dining-car steward',regionId:'brass-cutting',hp:100,hostile:false,protected:false,faction:'morrow-workers',initialSupport:{carId:'morrow-custody-coach',surfaceId:'private-floor',local:{x:-18,y:16,z:26}},rig:{coat:'#9b9070',hat:null,hair:'#4c3c31',skin:'#c09b75',accessory:'folded-serving-cloth',voiceId:'conrad-fearful-practical'},witnessId:'conrad-bale-private-coach'},
 {id:'odo',name:'Odo Fenn',age:28,kind:'rail-worker',role:'contract messenger guarding the case',regionId:'brass-cutting',hp:100,hostile:false,protected:false,faction:'morrow-workers',initialSupport:{carId:'morrow-custody-coach',surfaceId:'private-floor',local:{x:-47,y:-8,z:26}},rig:{coat:'#704d3e',hat:'#5b4535',hair:'#2e2723',skin:'#ccac87',accessory:'locked-message-case',voiceId:'odo-contract-bound'},witnessId:'odo-fenn-private-coach'},
 {id:'jana',name:'Jana Derr',age:39,kind:'rail-worker',role:'signal-halt inspector and recovery operator',regionId:'brass-cutting',x:5650,y:1430,z:2,hp:100,hostile:false,faction:'railway-staff',rig:{coat:'#324e54',hat:'#2c4248',hair:'#3b3028',skin:'#a67757',accessory:'signal-book'}},
 {id:'faber',name:'Faber Rowe',age:57,kind:'rail-worker',role:'halt mechanic and safe clearing keeper',regionId:'brass-cutting',x:5680,y:1458,z:2,hp:100,hostile:false,faction:'railway-staff',rig:{coat:'#746f52',hat:'#4a4a3c',hair:'#b4aa91',skin:'#bd9573',accessory:'mechanic-oil-case'}},
];

export const TRAIN_CHARGE_REFERENCES=[
 {sourceMissionId:'snowbound-the-names-they-took',objectId:'quarry-sealed-charge-1',role:'wired-turnout-misfire-recovered',standardConsumed:false},
 {sourceMissionId:'snowbound-the-names-they-took',objectId:'quarry-sealed-charge-2',role:'private-hinge-a',standardConsumed:true},
 {sourceMissionId:'snowbound-the-names-they-took',objectId:'quarry-sealed-charge-3',role:'private-hinge-b',standardConsumed:true},
 {sourceMissionId:'snowbound-the-names-they-took',objectId:'quarry-sealed-charge-4',role:'sealed-reserve',standardConsumed:false},
];
export const TRAIN_POWDER_PROPOSAL={capTinReference:{sourceMissionId:'snowbound-the-names-they-took',objectId:'cap-tin'},initialPrimerCount:6,revealOnlyAtActualFirstOpening:true,standardDamagedPrimerCount:1,standardBlastPrimerCount:2,standardReturnedPrimerCount:3,wireLength:280};
export const TRAIN_PERFORMANCE_PROPOSAL={rescue:'actual-supported-pull-before-self-climb',stoppedBattleSeconds:110,noStoppedBattleDamage:true,hostileLethalHeadImpacts:10,noHealingItems:true,cleanAttemptRequiresNoCheckpointRetry:true};

export const TRAIN_MOVING_CREW=[
 {id:'morrow-tool-hatch-guard',name:'Dale Upton',role:'close tool-hatch defender',carId:'morrow-tool-wagon',surfaceId:'tool-floor',local:{x:-45,y:0,z:26},weaponKind:'revolver',loaded:6,reserve:12},
 {id:'morrow-maintenance-sentry',name:'Seth Cress',role:'open-wagon firing angle',carId:'morrow-maintenance-wagon',surfaceId:'maintenance-deck',local:{x:32,y:12,z:26},weaponKind:'carbine',loaded:7,reserve:14},
 {id:'morrow-tool-roof-sentry',name:'Alma Teal',role:'tool-roof sentry',carId:'morrow-tool-wagon',surfaceId:'tool-roof',local:{x:25,y:-15,z:84},weaponKind:'carbine',loaded:7,reserve:14},
 {id:'morrow-stores-door-guard',name:'Len Cass',role:'covered-store doorway defender',carId:'morrow-stores-coach',surfaceId:'stores-floor',local:{x:45,y:0,z:26},weaponKind:'coach-gun',loaded:2,reserve:8},
 {id:'morrow-tender-rifle',name:'Dara Crowe',role:'tender-side rifle guard',carId:'morrow-tender',surfaceId:'tender-walkway',local:{x:28,y:18,z:30},weaponKind:'carbine',loaded:7,reserve:14},
 {id:'morrow-vestibule-runner',name:'Nolan Marr',role:'rushing vestibule defender',carId:'morrow-vestibule-coach',surfaceId:'vestibule-floor',local:{x:30,y:0,z:26},weaponKind:'revolver',loaded:6,reserve:12},
 {id:'morrow-cab-side-rifle',name:'Hal Merren',role:'cab-side rifle cover',carId:'morrow-engine',surfaceId:'cab-floor',local:{x:28,y:14,z:32},weaponKind:'carbine',loaded:7,reserve:14},
 {id:'morrow-custody-step-guard',name:'Sora Wren',role:'private-coach outer-step defender',carId:'morrow-custody-coach',surfaceId:'private-floor',local:{x:62,y:20,z:26},weaponKind:'coach-gun',loaded:2,reserve:8},
];
export const TRAIN_LINE_GUARDS=[
 ['brass-upper-rifle-1','Iden Salk','first','upper-ballast',3520,1270],
 ['brass-upper-rifle-2','Mina Tess','first','upper-ballast',3590,1280],
 ['brass-water-mast-guard','Corin Nale','first','water-mast',3610,1440],
 ['brass-coach-rifle-1','Aven Carr','first','coach-road',3470,1550],
 ['brass-coach-rifle-2','Leda Shore','first','coach-road',3550,1560],
 ['brass-road-crossing-guard','Bram Kerr','first','road-crossing',3630,1590],
 ['brass-lower-flanker-1','Tilda Moss','second','lower-road',3290,1760],
 ['brass-lower-flanker-2','Fen Darrow','second','lower-road',3370,1780],
 ['brass-drainage-rifle-1','Jory Pell','second','drainage-gallery',3210,1580],
 ['brass-drainage-rifle-2','Nela Ward','second','drainage-gallery',3160,1610],
 ['brass-turnout-guard-1','Orin Reeve','second','turnout',3070,1660],
 ['brass-turnout-guard-2','Vela Cross','second','turnout',3110,1710],
 ['brass-halt-rifle-1','Caro Finch','reserve','halt-approach',3880,1230],
 ['brass-halt-rifle-2','Derrin Stock','reserve','halt-approach',3960,1280],
 ['brass-line-reserve-1','Ena Forre','reserve','service-shelf',3910,1480],
 ['brass-line-reserve-2','Milo Varn','reserve','service-shelf',3980,1510],
].map(([id,name,group,routeId,x,y],index)=>({id,name,group,routeId,x,y,z:0,regionId:'brass-cutting',weaponKind:index%5===3?'coach-gun':'carbine',loaded:index%5===3?2:7,reserve:index%5===3?8:14}));

export const TRAIN_DOCUMENTS={
 'morrow-fuel-letter':{id:'morrow-fuel-letter',kind:'business-letter',name:'Dorr & Mere fuel letter',sourceContainerId:'private-fuel-drawer',text:'Madam Morrow, the north kiln owners have refused the new haulage surcharge. Their refusal matters only while the winter road remains open. Hold our wagons at Brass Cutting until the thaw softens the public ford, then quote the cost of the longer route as a condition of carriage. The company can call the delay weather; the enclosed account will call it an advance against their fuel allotment. Kindly return the marked copy. Our clerks should not preserve both descriptions.'},
 'morrow-timber-letter':{id:'morrow-timber-letter',kind:'business-letter',name:'Vell Timber concession letter',sourceContainerId:'private-timber-locker',text:'The survey crews have found occupied cabins inside the east concession. Several residents hold receipts from the quarry cooperative. Calder recommends adding those receipts to the old liability schedule instead of disputing the boundaries in public. We ask your office to name the hearing venue and arrange transport for the witnesses who can afford it. The others may send statements through our agent. Please advise whether “vacant” should remain on the printed prospectus until the houses are removed.'},
 'morrow-original-deeds':{id:'morrow-original-deeds',kind:'community-deed-packet',name:'Original cooperative lot packet',sourceContainerId:'private-map-cabinet',text:'Bellwether Cooperative, lots 18 through 26. The original payment schedule records nine households and two shared work sheds. Witness initials match the quarry ledger. A second transfer on the rear sheet names the same parcels as vacant and repeats the paid amounts as outstanding liability. The conflicting claims require the original receipts and living witnesses; this packet is evidence rather than spendable money.'},
 'morrow-safe-manifests':{id:'morrow-safe-manifests',kind:'account-evidence',name:'Fuel advances and wage manifests',sourceContainerId:'private-safe',text:'The safe contains crew wages charged against a fuel advance, a coast freight schedule and board correspondence about the concession. These are real account records. None is a bearer certificate or a replacement deed packet.'},
};
export const TRAIN_SECURITIES_PROPOSAL=[
 {id:'morrow-certificate-BR-041',serial:'BR-041',issuer:'Morrow Freight & Storage',faceValue:400,maturity:'Late autumn, Year 7',transferRestriction:'Bearer certificate; broker verification required',sourceContainerId:'private-map-cabinet'},
 {id:'morrow-certificate-BR-042',serial:'BR-042',issuer:'Morrow Freight & Storage',faceValue:400,maturity:'Late autumn, Year 7',transferRestriction:'Bearer certificate; broker verification required',sourceContainerId:'private-map-cabinet'},
 {id:'morrow-certificate-BR-047',serial:'BR-047',issuer:'Morrow Freight & Storage',faceValue:200,maturity:'Spring, Year 8',transferRestriction:'Bearer certificate; disputed guarantor record',sourceContainerId:'private-map-cabinet'},
];

// World-space rail distance and speed use world units. Force/mass are SI and
// explicitly converted by rail-consist; existing actor gravity is unchanged.
export const TRAIN_MOTION_PROPOSAL={worldUnitsPerMeter:25,tractionForceN:52000,maxBrakeForceN:90000,rollingResistanceN:4500,brakeResponseSeconds:1.2,gravityMps2:9.81,approachSpeed:85,staffedHaltSpeed:18};
export const TRAIN_TRACK={id:'brass-main-line',arcTolerance:.02,segments:[
 {id:'creek-to-water-mast',kind:'line',from:{x:600,y:2460,z:0},to:{x:2200,y:1760,z:12},maxSpeed:85},
 {id:'cutting-curve',kind:'bezier',from:{x:2200,y:1760,z:12},c1:{x:2520,y:1620,z:14.4},c2:{x:3380,y:1430,z:6},to:{x:3700,y:1420,z:6},maxSpeed:85},
 {id:'brass-straight',kind:'line',from:{x:3700,y:1420,z:6},to:{x:5400,y:1366.875,z:6},maxSpeed:85},
 {id:'staffed-halt-approach',kind:'bezier',from:{x:5400,y:1366.875,z:6},c1:{x:5600,y:1360.625,z:6},c2:{x:5750,y:1360,z:2},to:{x:5920,y:1340,z:2},maxSpeed:30},
]};
const bounds=(x0,y0,z0,x1,y1,z1)=>({min:{x:x0,y:y0,z:z0},max:{x:x1,y:y1,z:z1}});
const surface=(id,length,width,z)=>({id,bounds:bounds(-length/2,-width/2,z,length/2,width/2,z),oneWay:true});
const cover=(id,b,material='timber')=>({id,bounds:b,bodySolid:true,projectileSolid:true,material});
const contact=(id,kind,x,y,z)=>({id,kind,local:{x,y,z}});
const car=(id,length,width,mass,surfaces,cover,contacts)=>({id,length,width,mass,wheelRadius:id==='morrow-engine'?22:id==='morrow-tender'?14:12,couplerGap:8,frontCoupler:{x:length/2,y:0,z:12},rearCoupler:{x:-length/2,y:0,z:12},surfaces,cover,contacts});
const enclosed=(id,length,width,floorZ,roofZ)=>[
 cover(`${id}-left-wall`,bounds(-length/2,-width/2,floorZ,length/2,-width/2+3,roofZ)),
 cover(`${id}-right-wall`,bounds(-length/2,width/2-3,floorZ,length/2,width/2,roofZ)),
 cover(`${id}-roof`,bounds(-length/2,-width/2,roofZ-3,length/2,width/2,roofZ),'roof-tin'),
];
export const TRAIN_CARS=[
 car('morrow-engine',128,62,55000,[{id:'cab-floor',bounds:bounds(4,-24,32,64,24,32),oneWay:true},{id:'cab-roof',bounds:bounds(4,-31,92,64,31,92),oneWay:true}],
  [cover('engine-boiler',bounds(-60,-24,18,2,24,66),'boiler-iron'),cover('engine-cab-left',bounds(4,-31,32,64,-28,92),'steel'),cover('engine-cab-right',bounds(4,28,32,64,31,92),'steel'),cover('engine-cab-roof',bounds(4,-31,89,64,31,92),'roof-tin')],
  [contact('cab-regulator','control',38,-12,62),contact('cab-brake','control',43,12,56),contact('engine-ambush','grapple',20,0,32),contact('engine-safe-seat','rest',52,-19,32),contact('engine-whistle','control',32,-22,76),contact('engine-rear-step','climb',-58,0,26)]),
 car('morrow-tender',108,62,22000,[surface('tender-walkway',108,62,30)],
  [cover('tender-coal-box',bounds(-38,-8,30,38,8,64),'coal'),cover('tender-left-rim',bounds(-54,-31,30,54,-28,46),'steel'),cover('tender-right-rim',bounds(-54,28,30,54,31,46),'steel')],
  [contact('tender-front-gangway','gangway',54,0,30),contact('tender-rear-gangway','gangway',-54,0,30),contact('tender-side-step','climb',0,29,30)]),
 car('morrow-maintenance-wagon',136,66,10000,[surface('maintenance-deck',136,66,26)],
  [cover('maintenance-tool-crate',bounds(-18,-15,26,18,15,51)),cover('maintenance-low-rail',bounds(-68,30,26,68,33,40),'steel')],
  [contact('maintenance-front-gangway','gangway',68,0,26),contact('maintenance-rear-gangway','gangway',-68,0,26),contact('maintenance-ladder','climb',20,-31,26)]),
 car('morrow-tool-wagon',128,66,14000,[surface('tool-floor',128,60,26),surface('tool-roof',128,66,84)],
  [...enclosed('tool',128,66,26,84),cover('tool-workbench',bounds(-12,14,26,28,28,50))],
  [contact('tool-front-opening','gangway',64,0,26),contact('tool-rear-opening','gangway',-64,0,26),contact('tool-rear-roof-step','climb',-58,0,84),contact('nell-near-side-grip','hanging-grip',-20,-33,84),contact('nell-supported-pull','rescue',-20,-21,84),contact('tool-roof-landing','landing',-8,0,84),contact('tool-hatch','climb',-40,0,84)]),
 car('morrow-stores-coach',128,66,13000,[surface('stores-floor',128,60,26),surface('stores-roof',128,66,84)],
  [...enclosed('stores',128,66,26,84),cover('stores-closed-bins',bounds(-28,17,26,30,29,64))],
  [contact('stores-front-opening','gangway',64,0,26),contact('stores-rear-opening','gangway',-64,0,26),contact('stores-roof-ladder','climb',-56,-24,84)]),
 car('morrow-vestibule-coach',118,66,14000,[surface('vestibule-floor',118,60,26),surface('vestibule-roof',118,66,84)],
  [...enclosed('vestibule',118,66,26,84),cover('vestibule-baggage',bounds(-24,-24,26,5,-9,57))],
  [contact('vestibule-front-opening','gangway',59,0,26),contact('vestibule-rear-opening','gangway',-59,0,26),contact('vestibule-side-step','climb',35,32,26)]),
 car('morrow-custody-coach',170,72,22000,[surface('private-floor',170,66,26),surface('private-roof',170,72,88)],
  [...enclosed('private',170,72,26,88),cover('private-iron-door',bounds(82,-32,26,85,32,86),'reinforced-iron'),cover('private-safe-body',bounds(-52,15,26,-32,32,61),'safe-iron'),cover('private-inner-partition',bounds(15,-33,26,18,14,84)),cover('private-map-cabinet-body',bounds(-80,-32,26,-55,-20,58))],
  [contact('private-hinge-a','charge-placement',84,-28,45),contact('private-hinge-b','charge-placement',84,28,70),contact('private-outer-step','climb',76,34,26),contact('private-safe-pry','work',-28,19,26),contact('private-safe-dial','work',-42,10,53),contact('private-map-cabinet','search',-60,-17,46),contact('private-fuel-drawer','search',-12,26,44),contact('private-timber-locker','search',-70,25,56),contact('private-worker-refuge','safe-refuge',-36,0,26),contact('private-worker-door','exit',78,0,26)]),
];

export const TRAIN_WORLD={id:'brass-cutting',name:'Brass Cutting',width:6200,height:2800,trackId:TRAIN_TRACK.id,
 palette:{engine:'#986d3c',roof:'#b7b1a0',privateCoach:'#384d45',lineMarkers:'#447c7e',ballast:'#79796a',wetEarth:'#6b745c',remainingSnow:'#d5dfd4'},
 landmarks:[{id:'thawing-culvert',name:'Thawing culvert',x:1290,y:1810,z:0},{id:'old-timber-stockade',name:'Old timber stockade',x:1600,y:1410,z:0,futureEncounterUnimplemented:true},{id:'brass-water-mast',name:'Brass water mast',x:2210,y:1815,z:12},{id:'staffed-signal-halt',name:'Derr’s signal halt',x:5650,y:1430,z:2}],
 stations:{ridgeMountLine:{id:'brass-ridge-mount-line',x:1980,y:1450,z:94},wireCharge:{id:'turnout-service-plate',x:2150,y:1805,z:12},detonator:{id:'ridge-detonator',x:1930,y:1570,z:48},boardingShelf:{id:'cutting-maintenance-shelf',x:2070,y:1740,z:112},survivableApron:{id:'cutting-maintenance-apron',x:2105,y:1660,z:36},turnoutHut:{id:'turnout-hut',x:2470,y:1830,z:0},brassRecoveryHalt:{id:'brass-staff-handover',x:5640,y:1430,z:2}},
 routes:{thawRide:[{x:450,y:1260,z:0},{x:900,y:1580,z:0},{x:1290,y:1810,z:0},{x:1580,y:1650,z:26},{x:1840,y:1490,z:72},{x:1980,y:1450,z:94}],lowerRecovery:[{x:1980,y:1450,z:94},{x:1860,y:1510,z:72},{x:1830,y:1660,z:36},{x:2105,y:1660,z:36},{x:2390,y:1840,z:0},{x:2820,y:1770,z:0},{x:3300,y:1650,z:0}],upperFootPath:[{x:1980,y:1450,z:94},{x:1900,y:1530,z:62},{x:1930,y:1570,z:48}],boardingRun:[{x:1980,y:1450,z:94},{x:2040,y:1600,z:110},{x:2070,y:1740,z:112}]},
 unresolvedGeometry:['native terrain/ramp collision mesh','three separate physical launch/landing positions','all stopped-battle approach intervals','window/door and safe interior occlusion','accessible culvert and stockade journal geometry','actual staffed-halt clearing route'],
};
