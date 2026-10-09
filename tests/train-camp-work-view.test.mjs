import test from 'node:test';import assert from 'node:assert/strict';
import {Journey,clinicCompleteNative,moveNative,trainRecord,interactNative} from './helpers/train-clinic-route.mjs';
import {TRAIN_BRIEFING_APPROACHES,TRAIN_BRIEFING_HANDOFF_APPROACH} from '../content/campaign/train-camp.js';
import {trainCampWorkContext,frameTrainCampWork,campWorkLogicalRect,createTrainCampWorkView} from '../src/train-camp-work-view.js';
import {getTrainCampWorkPose} from '../src/train-camp-work.js';
const E=globalThis.My3D2dge;
function wait(s,predicate){for(let i=0;!predicate()&&i<800;i++)Journey.stepCampaign(s,.05);assert.ok(predicate());}
function setup(name){const s=clinicCompleteNative(name);moveNative(s,TRAIN_BRIEFING_APPROACHES.mara);Journey.campaignAction(s,'holster');interactNative(s,'train:brief-call');wait(s,()=>trainRecord(s).train.briefing.setup.acceptedSeconds>=.2);return s;}
function assertFramed(context,frame,view,w,h){assert.equal(frame.fits,true);const projectedFocus=view.p(frame.focus.x,frame.focus.y,frame.focus.z);for(const point of context.points){const p=view.p(point.x,point.y,point.z),x=p[0]-projectedFocus[0]+w/2,y=p[1]-projectedFocus[1]+h/2;assert.ok(x>=frame.safeRect.left-1e-7&&x<=frame.safeRect.right+1e-7&&y>=frame.safeRect.top-1e-7&&y<=frame.safeRect.bottom+1e-7);}}

test('actual accepted setup, original participant roots and native contacts fit measured phone/tablet/wide work areas without any world mutation',()=>{
 const s=setup(),before=JSON.stringify(s),context=trainCampWorkContext(s);assert.equal(context.phase,'setup');assert.deepEqual(context.actorIds,['mara','tomas','della']);
 for(const id of ['tomas','della']){const target=getTrainCampWorkPose(s,id).contact;assert.ok(context.points.some(p=>Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z)<1e-7));}
 for(const[width,height,safeRect]of [[320,568,{left:12,right:204,top:204,bottom:378}],[384,512,{left:12,right:372,top:130,bottom:390}],[720,500,{left:12,right:708,top:110,bottom:430}]]){const frame=frameTrainCampWork(context,{view:E.VIEWS.threequarter,width,height,safeRect});assertFramed(context,frame,E.VIEWS.threequarter,width,height);}
 assert.equal(JSON.stringify(s),before);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)));
 const tiny=frameTrainCampWork(context,{view:E.VIEWS.threequarter,width:320,height:568,safeRect:{left:12,right:20,top:204,bottom:210}});assert.equal(tiny.fits,false,'an insufficient screen cannot be relabelled as fitted');
});

test('no uncalled work view, remote work framing or camera facts are invented by import or ordinary phase-one clinic',()=>{
 const s=clinicCompleteNative();assert.equal(trainCampWorkContext(s),null);assert.equal(trainRecord(s).train.briefingVersion,undefined);
 const active=setup();wait(active,()=>trainRecord(active).train.briefing.setup.finishedAt!==null);moveNative(active,{x:820,y:1205});assert.equal(trainCampWorkContext(active),null,'actual departure from the room restores ordinary follow');
});

test('actual borrowed handoff frame includes the same current shared grip, without moving or replacing either participant',()=>{
 const s=setup('train-briefing-borrowed-prerequisites-v4-native');wait(s,()=>trainRecord(s).train.briefing.setup.finishedAt!==null);moveNative(s,{x:650,y:TRAIN_BRIEFING_HANDOFF_APPROACH.y});moveNative(s,TRAIN_BRIEFING_HANDOFF_APPROACH);const t=s.entities.tomas,d=Math.hypot(t.x-s.player.x,t.y-s.player.y);Journey.stepCampaign(s,.01,{mx:(t.x-s.player.x)/d,my:(t.y-s.player.y)/d});interactNative(s,'train:brief-return-papers');wait(s,()=>trainRecord(s).train.powder.pending.some(w=>w.kind==='return-papers'&&w.acceptedSeconds>=.2));
 const before=JSON.stringify(s),context=trainCampWorkContext(s);assert.equal(context.phase,'handoff');for(const id of ['mara','tomas']){const grip=getTrainCampWorkPose(s,id).contact;assert.ok(context.points.some(p=>Math.hypot(p.x-grip.x,p.y-grip.y,p.z-grip.z)<1e-7));}assertFramed(context,frameTrainCampWork(context,{view:E.VIEWS.threequarter,width:320,height:568,safeRect:{left:12,right:204,top:204,bottom:378}}),E.VIEWS.threequarter,320,568);assert.equal(JSON.stringify(s),before);
});

test('HUD measurement respects actual device pixels, engine scale and letterbox offset',()=>{
 const screen={S:2,dpr:3,OX:60,OY:30,W:320,H:400,canvas:{getBoundingClientRect:()=>({left:10,top:20})}};
 assert.deepEqual(campWorkLogicalRect(screen,{left:50,right:90,top:40,bottom:100}),{left:30,right:90,top:15,bottom:105});assert.equal(campWorkLogicalRect(screen,{left:0,right:0,top:0,bottom:0}),null);
});

test('normal accessible objective toggle retains full text, fits beside side controls and resets across owning restore without state writes',()=>{
 const s=setup(),before=JSON.stringify(s),classes=new Set(),elements=new Map();
 const element=(rect={left:0,right:0,top:0,bottom:0})=>({hidden:false,attributes:{},listeners:{},children:[],setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.listeners[k]=v;},append(...els){this.children.push(...els);for(const el of els)elements.set('#'+el.id,el);},closest:()=>null,getBoundingClientRect:()=>rect});
 for(const[selector,rect]of Object.entries({'.objective':{left:20,right:204,top:105,bottom:192},'.topbar':{left:20,right:302,top:15,bottom:86},'#campaign-controls':{left:216,right:302,top:105,bottom:237},'.bottom-hud':{left:0,right:320,top:508,bottom:568},'#joystick':{left:0,right:110,top:400,bottom:480},'.touch-actions':{left:210,right:310,top:390,bottom:470}}))elements.set(selector,element(rect));
 const doc={querySelector:selector=>elements.get(selector)||null,createElement:()=>element(),body:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}}},screen={W:320,H:568,S:1,dpr:1,OX:0,OY:0,canvas:{getBoundingClientRect:()=>({left:0,top:0})}},view=createTrainCampWorkView(doc);view.sync(s,{screen});const frame=view.frame(s,{view:E.VIEWS.threequarter,screen});assertFramed(trainCampWorkContext(s),frame,E.VIEWS.threequarter,320,568);assert.equal(frame.safeRect.right,204,'work fits beside actual right-side controls');
 const toggle=elements.get('#camp-objective-toggle');assert.equal(toggle.type,'button');assert.equal(toggle.attributes['aria-expanded'],'false');assert.equal(toggle.attributes['aria-controls'],'objective-text mission-detail mission-progress');toggle.listeners.click();assert.equal(toggle.attributes['aria-expanded'],'true');assert.ok(classes.has('camp-work-expanded'));assert.equal(JSON.stringify(s),before);
 const restored=Journey.restoreCampaign(Journey.serializeCampaign(s));assert.ok(restored);view.sync(restored,{screen});assert.equal(toggle.attributes['aria-expanded'],'false');assert.equal(JSON.stringify(s),before);
});
