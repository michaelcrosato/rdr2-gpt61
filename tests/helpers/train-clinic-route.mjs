import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import '../../my-3d2dge-agent.js';
import * as Journey from '../../src/campaign-journey.js';
import {blockedAt} from '../../src/campaign-navigation.js';
import {TRAIN_ID} from '../../content/campaign/brass-cutting.js';
export {Journey};
export const trainRecord=s=>s.campaign.missions[TRAIN_ID];
export const originalBytes=name=>gunzipSync(readFileSync(new URL(`../fixtures/${name}.json.gz`,import.meta.url))).toString();
export function moveNative(s,target){
  const world=Journey.worldForCampaign(s),size=20,cols=Math.ceil(world.width/size),rows=Math.ceil(world.height/size),point=id=>({x:id%cols*size+10,y:Math.floor(id/cols)*size+10}),cell=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size),start=cell(s.player),end=cell(target),queue=[start],previous=new Map([[start,null]]);
  for(let i=0;i<queue.length&&!previous.has(end);i++)for(const offset of [1,-1,cols,-cols]){const id=queue[i]+offset,p=point(id),old=point(queue[i]);if(id<0||id>=cols*rows||Math.abs(p.x-old.x)>size+1||previous.has(id)||blockedAt(world,p.x,p.y,9))continue;previous.set(id,queue[i]);queue.push(id);}
  assert.ok(previous.has(end),'actual world route exists');const route=[target];for(let id=end;id!==start;id=previous.get(id))route.push(point(id));
  for(const p of route.reverse()){for(let frame=0;frame<1200&&Math.hypot(s.player.x-p.x,s.player.y-p.y)>3;frame++){const d=Math.hypot(s.player.x-p.x,s.player.y-p.y);Journey.stepCampaign(s,.05,{mx:(p.x-s.player.x)/d,my:(p.y-s.player.y)/d});assert.equal(s.failure,null);}assert.ok(Math.hypot(s.player.x-p.x,s.player.y-p.y)<=3);}
}
export function interactNative(s,id){assert.ok(Journey.getCampaignInteractions(s).some(action=>action.id===id),`${id} actually offered`);Journey.interactCampaign(s,id);}
export function chooseNative(s,id){assert.ok(s.dialog?.choices.some(choice=>choice.id===id),`${id} actually present in ${s.dialog?.id}`);Journey.chooseCampaign(s,id);}
export function exchangeNative(s,id,choice='train-speech-next'){interactNative(s,id);for(let i=0;s.dialog&&i<30;i++)chooseNative(s,choice);assert.equal(s.dialog,null);}
export function clinicCompleteNative(name='journey-v4-rival-webkit-current-reloaded'){
  const s=Journey.restoreCampaign(originalBytes(name));assert.ok(s);moveNative(s,{x:385,y:1270});assert.equal(Journey.beginCampaignTrainClinic(s),true);
  for(let i=0;i<250&&trainRecord(s).train.prelude.arrivals.abel.arrivedAt===null;i++)Journey.stepCampaign(s,.05);
  exchangeNative(s,'train:bedside');for(let i=0;i<300&&trainRecord(s).train.prelude.bottleWork.finishedAt===null;i++)Journey.stepCampaign(s,.05);
  assert.ok(trainRecord(s).train.prelude.bottleWork.finishedAt!==null);exchangeNative(s,'train:silas');moveNative(s,{x:410,y:1270});exchangeNative(s,'train:family');Journey.stepCampaign(s,.05);assert.equal(trainRecord(s).mission.stage,1);assert.ok(Journey.restoreCampaign(Journey.serializeCampaign(s)));return s;
}
