/** Explicitly staged art fixtures. Simulation advances real frames/support;
 * setup positions are injected, never mission arrivals, rescue or ownership. */
import * as D from '../proposals/brass-cutting.js';
import {createRailPath,createConsist,advanceConsist,compileCarSpecs} from '../src/rail-foundation/rail-consist.js';
import {worldPoint,worldVector} from '../src/rail-foundation/rigid-frame.js';
import {stepRailBody,validateBodySupport} from '../src/rail-foundation/moving-support.js';
import {createGangwayPlatforms} from '../src/rail-foundation/moving-gangways.js';
import {createTrainRenderer} from '../src/train-native/renderer.js';
import {createAcceptedStepContext} from '../src/rail-foundation/accepted-step-context.js';
const CARS=compileCarSpecs(D.TRAIN_CARS);
const E=globalThis.My3D2dge,P=(x=0,y=0,z=0)=>({x,y,z}),clone=v=>JSON.parse(JSON.stringify(v)),track=createRailPath(D.TRAIN_TRACK),game=new E.Game({canvas:'screen',view:'threequarter',minH:320,minW:320,maxW:1720,maxH:1100,bg:'#788177'});
let renderer,scene,queryContext,caseName,focusId,focusLocal=null,seedCursor,expected=[],walking=false,meeting=null;
function platform(id){return scene.platforms.find(p=>p.id===id);}
function supported(id,carId,surfaceId,local,extra={}){const p=platform(carId),body=new E.Body({...worldPoint(p.frame,local),r:9,height:53,onGround:true});Object.assign(body,{id,hp:100,holstered:true,facing:Math.atan2(p.frame.x.y,p.frame.x.x)+Math.PI,...extra});body.support={carId,surfaceId,local:clone(local),relativeVelocity:P()};return body;}
function control(id){const a=D.TRAIN_OPERATOR_APPROACHES[id],body=supported('mara',a.carId,a.surfaceId,a.local);scene.actors=[body];scene.viewerId=body.id;scene.actions=[{actorId:body.id,contacts:[{carId:a.carId,contactId:id,side:a.hand,kind:id}]}];focusId=body.id;expected=[body.id];}
function updateMeeting(){if(!meeting)return;const p=platform(meeting.carId),target=worldPoint(p.frame,meeting.local);for(const a of scene.actions)for(const c of a.contacts){c.target={...target};c.sourceId='fixture-moving-paper-meeting';}}
const labels={overview:'Actual authored car/crew positions',brake:'Cab brake grip',regulator:'Cab regulator grip',whistle:'Cab whistle grip',entry:'Rear cab handhold · standing pose only',roof:'Nell on the real moving tool roof',papers:'Abel/Nell shared hand target · staged exchange',cast:'Original native inhabitants · staged lineup',mounted:'Nell and her one Rivet mount',gangway:'Native r9 walk across the moving gangway',charge:'Same charge child at authored hinge · no placement action'};
window.probe={game,get scene(){return scene;},get seedCursor(){return seedCursor;},get expected(){return expected;},setup(name,reduced=false){
 caseName=name;walking=false;meeting=null;expected=[];focusLocal=null;focusId=null;seedCursor=name==='gangway'?1200:2400;
 const state=createConsist(track,CARS,{cursor:seedCursor,speed:85}),seed=advanceConsist(track,CARS,state,0,{},D.TRAIN_MOTION_PROPOSAL);
 const seedCars=createAcceptedStepContext(seed.platforms,0);queryContext=createAcceptedStepContext([...seedCars.platforms,...createGangwayPlatforms(seedCars,D.TRAIN_GANGWAYS)],0);
 scene={consist:seed.state,platforms:queryContext.platforms,actors:[],actions:[],objects:[],viewerId:'outside',reduceMotion:reduced};game.reduceMotion=reduced;renderer=createTrainRenderer(E,game,{cars:D.TRAIN_CARS,track});
 if(name==='overview'){const people=[...D.TRAIN_MOVING_CREW,...D.TRAIN_NEW_CAST.filter(a=>a.initialSupport).map(a=>({...a,...a.initialSupport}))];scene.actors=people.map(a=>supported(a.id,a.carId,a.surfaceId,a.local,{name:a.name}));focusLocal={carId:'morrow-maintenance-wagon',local:P()};}
 else if(['brake','regulator','whistle','entry'].includes(name))control({brake:'cab-brake',regulator:'cab-regulator',whistle:'engine-whistle',entry:'engine-entry-handhold'}[name]);
 else if(name==='roof'){scene.actors=[supported('nell','morrow-tool-wagon','tool-roof',P(-8,0,84))];focusId=scene.viewerId='nell';expected=['nell'];}
 else if(name==='papers'){const a=supported('nell','morrow-engine','cab-floor',P(-35,-10,32)),b=supported('abel','morrow-engine','cab-floor',P(-35,10,32));a.facing=Math.atan2(platform('morrow-engine').frame.x.y,platform('morrow-engine').frame.x.x)+Math.PI/2;b.facing=a.facing+Math.PI;scene.actors=[a,b];scene.viewerId='nell';scene.actions=[a,b].map(body=>({actorId:body.id,contacts:[{side:'R',kind:'fixture-paper-touch',target:P(),sourceId:'fixture-moving-paper-meeting'}]}));meeting={carId:'morrow-engine',local:P(-35,0,64)};updateMeeting();focusId='nell';expected=['nell','abel'];}
 else if(name==='cast'){const p=platform('morrow-engine').frame.origin;scene.actors=['nell','abel','etta','conrad','odo','jana','faber','harlan'].map((id,i)=>({id,name:D.TRAIN_NEW_CAST.find(a=>a.id===id).name,x:p.x+(i-3)*38,y:p.y-85,z:0,hp:100,onGround:true,holstered:true,facing:Math.PI/2}));focusId='conrad';expected=['conrad'];}
 else if(name==='mounted'){const p=platform('morrow-engine').frame.origin,horse={id:'rivet',kind:'horse',x:p.x,y:p.y-100,z:0,hp:100,facing:.5,vx:0,vy:0},nell={id:'nell',x:horse.x,y:horse.y,z:0,hp:100,mounted:true,mountId:'rivet',facing:horse.facing,holstered:true};scene.actors=[horse,nell];focusId='nell';expected=['rivet','nell'];}
 else if(name==='gangway'){scene.actors=[supported('mara','morrow-stores-coach','stores-floor',P(55,0,26))];walking=true;focusId=scene.viewerId='mara';expected=['mara'];}
 else if(name==='charge'){scene.actors=[supported('mara','morrow-custody-coach','private-roof',P(60,0,88))];scene.objects=[{id:D.TRAIN_CHARGE_REFERENCES[1].objectId,kind:'sealed-charge',location:{type:'car',carId:'morrow-custody-coach',local:P(84,-28,45)}}];focusId='mara';expected=['mara'];}
 else throw new TypeError('Unknown native rail fixture');
 renderer.update(0,scene);for(const body of scene.actors){const rig=renderer.humanRig(body.id);if(rig){rig.t=.25;rig.update(0,{...body,z:0});}}
 document.getElementById('label').textContent=labels[name]+(reduced?' · reduced motion':' · normal');game.cam.snap=true;
},frame(dt){
 if(!Number.isFinite(dt)||dt<0||dt>2)throw new RangeError('Fixture time outside selected interval');
 for(let t=0;t<dt-1e-10;){const step=Math.min(1/120,dt-t),motion=advanceConsist(track,CARS,scene.consist,step,{},D.TRAIN_MOTION_PROPOSAL);const cars=createAcceptedStepContext(motion.platforms,step);queryContext=createAcceptedStepContext([...cars.platforms,...createGangwayPlatforms(cars,D.TRAIN_GANGWAYS)],step);scene.platforms=queryContext.platforms;
  for(const body of scene.actors)if(body.support||walking){stepRailBody(body,queryContext,step,{relativeVelocity:walking?worldVector(scene.platforms[0].frame,P(60)):P(),inputSpace:walking?'world':'local'});if(!validateBodySupport(body,scene.platforms))throw new TypeError('Fixture lost coherent support');}
  scene.consist=motion.state;updateMeeting();renderer.update(step,scene);t+=step;
 }
 game.cam.snap=true;
},inspect(){return renderer.inspect();},physics(){const result=clone(scene);delete result.reduceMotion;return result;}};
probe.setup('brake');game.start({update(){const focus=focusId?scene.actors.find(a=>a.id===focusId):worldPoint(platform(focusLocal.carId).frame,focusLocal.local);game.focus(focus.x,focus.y,(focus.z||0)+26);},draw(r){renderer.draw(r,scene);}});
