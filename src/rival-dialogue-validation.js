/** Dialogue/save contracts for the original Bellwether operation.
 * This validates the currently authored runtime scenes, not source completeness.
 * A dialogue freezes simulation. Its action point and resulting custody must
 * still exist in the saved graph; goals may have been assigned but not walked.
 */
import {RIVAL_ID,RIVAL_WORLD as W,RIVAL_ENEMIES,RIVAL_CARBINE} from '../content/campaign/bellwether-works.js';
import {validateHolding} from './rival-aftermath.js';
import {rivalSceneSpeech} from './rival-scene-speech.js';
import {equipmentContract,CARBINE_INSPECTION_TEXT} from './rival-equipment-work.js';
import {usesQuestioningContract,validateQuestioningDialog,questioningVisitText} from './rival-questioning.js';
import {validateNarrativeDialog} from './rival-narrative.js';

const RESCUE='snowbound-a-voice-under-ice',HUNT='snowbound-a-quiet-table';
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const names={tomas:'Tomas Reed',inez:'Inez Pike',ruth:'Ruth Arlow',bastian:'Bastian Holt',emmett:'Emmett Rowan',levi:'Levi Senn',della:'Della Wren'};
const party=['tomas','inez','ruth','bastian','emmett'];
const mounts={'tomas':'tomas-mount',inez:'thimble',ruth:'plover',bastian:'cinder',emmett:'button'};
const single=[['leave','Continue.']];
const text={
  argument:'Bastian calls the careful frightened. He has just struck the shoulder that carried the powder ledger. Inez steps between us. A raid needs reasons as well as cartridges.',
  ruth:'The quarry families signed for a fair settlement. Calder used their names to choose the houses his men would empty. We recover the account; we do not blame the signatories.',
  emmett:'Tracks tell us who has passed, not whether an accusation is true. I will keep the horses above the works until I can name a safe ramp.',
  bastian:'A direct blow might finally make Calder listen. I hear Ruth’s objection. I will take the western cover she chooses, and I will search the weighhouse.',
  inez:'I stopped the second blow. My work is the mount line: Copper, Moth, Thimble and the three new partners come home as themselves.',
  invitation:'Calder turned a settlement into a seizure list. I want the quarry papers and the sealed powder crate. Ask whether I can leave my anger here, then decide whether to come.',
  motive:'I trusted Calder with a quarry settlement. He turned those names into a seizure list. Anger brought me to this room; whether evidence or revenge takes us out is a question you can keep asking.',
  carbine:'Seven chambers in the tube. The spare cartridges belong to this gun; a coach shell or field arrow will not fit. Bring your sidearm too. Inspect the action before you take it.',
  lariat:'Throw across a clear lane within reach. Keep tension, dismount, approach and bind. Slack lets a frightened person regain his feet; it does not give you a second body.',
  postpone:'We can wait at the kiln. Your issued equipment remains individually owned and counted; waiting will not issue it twice.',
  ridge:'The magazine is beyond the traverser. The account room sits downhill. Watch before you choose a way through; Tomas’s failed agreement did not make every worker his enemy.',
  descent:'Ruth and Bastian take the western cover. Inez and Emmett hold the mount line. Mara, come down the screened chute with me; wait until all our positions are real before the first shot.',
  'first-shot':'The cover is held. Will you make the first shot, or wait for my signal?',
  tactics:'The scouts are moving through both tree lanes. Hold the wheels and stop the flankers, or advance into the screen before the reserve reaches the gate?',
  powder:'The wrapper is dry and the seal is sound. Keep its cap separate until a real plan needs it. Return this one to the same crate; we count four, not five.',
  plans:'The scale shows the bend at the pulley creek. Calder plans to divert a bond-and-deed train and sell the same holdings twice. This paper proves a route, not a promise that our next plan will work.',
  'levi-road':'My name is Levi Senn. Calder bought my family’s arrears and made me copy the warrants. Am I being taken to a judge, or another man who wants a uniform to blame?',
  'levi-evidence':'His torn payment card gives Levi’s own name. The seizure list carries copied signatures; it cannot tell us whether he copied them willingly. Bastian asks for punishment. Tomas orders a guarded hold while this account is checked.',
  completed:'Every recovered pocket, document, charge and injured person is in the account. Levi’s name is written separately from Calder’s. The next train operation still requires its own authored preparation.',
};
const convoyText={
  'hunt-first':'Juno’s food is counted and her hand is resting. We have recovered the quarry papers too. Della must still account for every injury.',
  'rival-first':'The quarry papers are recovered. Orla’s separate food expedition is still needed before the next train plan. We cannot eat a seizure list.',
};
const visitText={
  care:'The blanket stayed, and so did the guard. I can name the copied warrants. Checking them does not make this a free room.',
  deprive:'I am still cold under guard. The account records what was withheld as well as what was recovered.',
};
function regionOf(s,a,seen=new Set()) {
  if(!a||seen.has(a.id))return null;
  if(!a.attachment)return a.regionId;
  if(a.attachment.type==='rest')return a.attachment.regionId||s.region;
  seen.add(a.id);return regionOf(s,s.entities?.[a.attachment.targetId],seen);
}
function distance(a,b){return a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;}
function near(a,b,radius){return a&&b&&Number.isFinite(a.x+a.y+(a.z||0)+b.x+b.y+(b.z||0))&&Math.abs((a.z||0)-(b.z||0))<8&&distance(a,b)<=radius;}
function point(s,id){return s.entities?.[id];}
function player(s){return point(s,s.party?.playerId||'mara')||s.player;}
function horse(s){return point(s,s.party?.mountId)||s.horse;}
function person(s,id){const a=point(s,id);return !!a&&a.id===id&&a.name===names[id]&&a.hp>0&&regionOf(s,a)===s.region;}
function at(s,target,radius){return near(player(s),target,radius);}
function withActor(s,id,radius){return person(s,id)&&at(s,point(s,id),radius);}
function stage(s,r,n,region){return s.campaign?.activeMissionId===RIVAL_ID&&r.status==='active'&&!r.mission.completed&&r.mission.stage===n&&s.region===region;}
function allVoices(f){return ['ruth','emmett','bastian','inez'].every(id=>f[`${id}Heard`]===true);}
function prelude(s,r){return r.mission.stage===0&&!r.flags.accepted&&!r.flags.carbineGranted&&!r.flags.lariatGranted&&!r.flags.sightglassGranted&&!s.weapons?.[RIVAL_CARBINE.id]&&!s.weapons?.['working-lariat']&&s.region==='snowbound'&&s.campaign?.missions?.[RESCUE]?.mission.completed===true&&(r.status==='unstarted'&&s.campaign.activeMissionId!==RIVAL_ID&&s.campaign.missions[s.campaign.activeMissionId]?.mission.completed===true||stage(s,r,0,'snowbound'));}
function issued(s,r){return r.flags.accepted&&r.flags.carbineGranted&&s.weapons?.[RIVAL_CARBINE.id]?.owner==='mara';}
function fieldReady(s,r){return issued(s,r)&&r.flags.entered&&r.flags.lariatGranted&&r.flags.sightglassGranted;}
function owned(r,id,owner){const o=r.objects?.[id];return !!o&&o.id===id&&o.owner===owner&&o.location?.type==='carried'&&o.location.targetId===owner;}
function papers(r,owner,station=false){return ['route-diagram','seizure-list'].every(id=>owned(r,id,owner)||station&&r.objects?.[id]?.owner===owner&&r.objects[id].location?.type==='station'&&r.objects[id].location.targetId===W.plans.id);}
function held(s,r){const a=point(s,'levi');return r.flags.bound&&r.flags.held&&a?.bound===true&&a.hp>0&&a.attachment?.type==='rest'&&a.attachment.targetId===W.camp.holding.id&&regionOf(s,a)==='snowbound';}
function passenger(s,r){const a=point(s,'levi'),h=horse(s);return r.flags.bound&&r.flags.loaded&&r.flags.strapped&&a?.bound===true&&a.hp>0&&h?.hp>0&&a.attachment?.type==='passenger'&&a.attachment.targetId===h.id&&a.attachment.strap===true&&regionOf(s,a)===s.region&&regionOf(s,h)===s.region&&distance(a,h)<1&&Math.abs((a.z||0)-(h.z||0)-23)<1&&distance(player(s),h)<=65;}
function yardResolved(s){return RIVAL_ENEMIES.filter(a=>a.wave==='yard').every(a=>{const e=point(s,a.id);return e&&(e.hp<=0||e.surrendered||e.escaped);});}
function coverHeld(s){return ['tomas','ruth','bastian'].every(id=>person(s,id)&&near(point(s,id),W.yardCover[id],110));}
function exactChoices(d,expected){return Array.isArray(d.choices)&&d.choices.length===expected.length&&d.choices.every((choice,i)=>object(choice)&&choice.id===expected[i][0]&&choice.label===expected[i][1]);}

// Keys are individual runtime scene IDs. Choices cannot migrate between scenes.
const scenes={
  argument:{actor:'ruth',choices:[['intervene','Stand beside Ruth and stop the quarrel.'],['ask-motive','Ask Tomas why this cooperative matters.'],['leave','Return when you are ready.']],gate:(s,r)=>prelude(s,r)&&r.flags.intervened&&at(s,W.camp.briefing,65)},
  motive:{actor:'tomas',gate:(s,r)=>prelude(s,r)&&r.flags.intervened&&(stage(s,r,0,'snowbound')&&allVoices(r.flags)?withActor(s,'tomas',65):at(s,W.camp.briefing,65))},
  ruth:{actor:'ruth',gate:(s,r)=>stage(s,r,0,'snowbound')&&r.flags.intervened&&r.flags.ruthHeard&&withActor(s,'ruth',65)},
  emmett:{actor:'emmett',gate:(s,r)=>stage(s,r,0,'snowbound')&&r.flags.intervened&&r.flags.emmettHeard&&withActor(s,'emmett',65)},
  bastian:{actor:'bastian',gate:(s,r)=>stage(s,r,0,'snowbound')&&r.flags.intervened&&r.flags.bastianHeard&&withActor(s,'bastian',65)},
  inez:{actor:'inez',gate:(s,r)=>stage(s,r,0,'snowbound')&&r.flags.intervened&&r.flags.inezHeard&&withActor(s,'inez',65)},
  invitation:{actor:'tomas',choices:[['accept-rival','Take the separate quarry expedition.'],['ask-motive','Question Tomas’s motive.'],['leave','Wait at the kiln.']],gate:(s,r)=>stage(s,r,0,'snowbound')&&prelude(s,r)&&r.flags.intervened&&allVoices(r.flags)&&withActor(s,'tomas',65)},
  carbine:{actor:'tomas',gate:(s,r)=>stage(s,r,1,'snowbound')&&issued(s,r)&&r.flags.carbineInspected&&at(s,horse(s),58)},
  lariat:{actor:'inez',gate:(s,r)=>stage(s,r,1,'snowbound')&&r.flags.accepted&&r.flags.lariatGranted&&s.weapons?.['working-lariat']?.owner==='mara'&&withActor(s,'inez',55)},
  postpone:{actor:'tomas',gate:(s,r)=>stage(s,r,1,'snowbound')&&r.flags.accepted&&withActor(s,'tomas',65)},
  ridge:{actor:'ruth',gate:(s,r)=>stage(s,r,3,W.id)&&fieldReady(s,r)&&r.flags.groovesRead&&r.flags.hoovesRead&&r.flags.ridgeBriefed&&r.rival.trailIndex===W.trail.length&&!player(s).mounted&&at(s,W.observation,75)},
  descent:{actor:'tomas',gate:(s,r)=>stage(s,r,4,W.id)&&fieldReady(s,r)&&r.flags.reconComplete&&r.scope.raised===false&&Object.values(r.scope.observed||{}).length===5&&Object.values(r.scope.observed).every(v=>v===true)&&withActor(s,'tomas',75)},
  'first-shot':{actor:'tomas',choices:[['player-first','Mara opens the yard battle.'],['tomas-first','Let Tomas give the first shot.']],gate:(s,r)=>stage(s,r,4,W.id)&&fieldReady(s,r)&&r.flags.reconComplete&&r.flags.approachReady&&r.choices.firstShot===null&&r.rival.descentIndex===W.descent.length&&coverHeld(s)&&at(s,W.readyCover,60)},
  tactics:{actor:'tomas',choices:[['hold-yard','Hold the traverser and its cover.'],['advance-trees','Advance into the two wooded approaches.']],gate:(s,r)=>stage(s,r,6,W.id)&&fieldReady(s,r)&&r.flags.yardSafe&&r.flags.pocketSearched&&r.flags.patrolWarned&&r.choices.tactic===null&&yardResolved(s)&&withActor(s,'tomas',80)},
  powder:{actor:'ruth',gate:(s,r)=>stage(s,r,8,W.id)&&fieldReady(s,r)&&r.flags.patrolSafe&&r.flags.magazineRead&&r.flags.chargeInspected&&r.flags.chargePassed&&r.objects?.['charge-crate']?.count===4&&r.objects['charge-crate'].location?.type==='station'&&r.objects['charge-crate'].location.targetId===W.charge.id&&withActor(s,'ruth',48)&&at(s,W.charge,90)},
  plans:{actor:'emmett',gate:(s,r)=>stage(s,r,8,W.id)&&fieldReady(s,r)&&r.flags.patrolSafe&&r.flags.weighhouseRead&&r.flags.plansRead&&papers(r,'bastian',true)&&person(s,'bastian')&&near(point(s,'bastian'),W.plans,55)&&at(s,W.plans,45)},
  convoy:{actor:'tomas',gate:(s,r)=>stage(s,r,9,W.id)&&fieldReady(s,r)&&r.flags.crateTaken&&r.flags.plansDelivered&&r.flags.horsesRetrieved&&r.flags.convoyDeparted&&owned(r,'charge-crate','ruth')&&r.objects['charge-crate'].count===4&&owned(r,'cap-tin','ruth')&&papers(r,'tomas')&&r.choices.order===(r.rival.huntAtEntry?'hunt-first':'rival-first')&&r.rival.huntAtEntry===!!s.campaign.missions[HUNT]?.mission.completed&&player(s).mounted&&party.every(id=>point(s,id)?.mounted===true&&point(s,id).mountId===mounts[id])&&withActor(s,'tomas',90)},
  'levi-road':{actor:'levi',choices:[['offer-assurance','Promise food and a checked account, without promising release.'],['threaten','Threaten punishment if he refuses to speak.']],gate:(s,r)=>stage(s,r,11,W.id)&&fieldReady(s,r)&&r.flags.chaseStarted&&r.choices.assurance===null&&r.captivity.state==='loaded'&&passenger(s,r)},
  'levi-evidence':{actor:'della',choices:[['care-levi','Give food, a blanket and less cruel restraints from the actual camp stock.'],['deprive-levi','Withhold provisions and tighten the hold.']],gate:(s,r)=>stage(s,r,12,'snowbound')&&r.flags.campReturned&&r.flags.delivered&&r.flags.questioned&&held(s,r)&&r.captivity.questions?.card===true&&r.captivity.questions.signatures===true&&r.choices.care===null&&papers(r,'tomas')&&at(s,W.camp.holding,65)},
  completed:{actor:'della',gate:(s,r)=>s.campaign.activeMissionId===RIVAL_ID&&r.status==='completed'&&r.mission.completed&&r.mission.rewardPaid&&r.mission.stage===13&&s.region==='snowbound'&&r.flags.chargesStored&&r.flags.accounted&&r.flags.questioned&&held(s,r)&&r.aftermath?.captiveId==='levi'&&['care','deprive'].includes(r.choices.care)&&['charge-crate','cap-tin'].every(id=>r.objects?.[id]?.location?.type==='station'&&r.objects[id].location.targetId===W.camp.charges.id)&&at(s,W.camp.ledger,65)&&party.every(id=>person(s,id)&&distance(player(s),point(s,id))<500)},
  visit:{actor:'levi',gate:(s,r)=>r.status==='completed'&&r.mission.completed&&r.mission.stage===13&&s.region==='snowbound'&&held(s,r)&&['care','deprive'].includes(r.choices.care)&&at(s,W.camp.holding,65)},
};

export function validateRivalDialog(s) {
  const d=s?.dialog;if(!d)return true;
  if(!object(d)||typeof d.id!=='string')return false;
  const active=s.campaign?.activeMissionId===RIVAL_ID,r=s.campaign?.missions?.[RIVAL_ID];
  if(d.id==='mission-failed'&&active){
    const choices=[['retry','Retry the latest checkpoint.'],['restart','Restart this mission.'],...(s.replayCanonical?[['finish-replay','Return to the permanent journey.']]:[])];
    return object(r)&&object(s.failure)&&typeof s.failure.reason==='string'&&d.text===s.failure.reason&&d.speaker==='The Names They Took · Checkpoint'&&exactChoices(d,choices);
  }
  if(!d.id.startsWith('rival-'))return true;
  if(d.id.startsWith('rival-holding-'))return validateHolding(s);
  if(d.id.startsWith('rival-questioning-'))return validateQuestioningDialog(s);
  if(d.id==='rival-levi-evidence'&&usesQuestioningContract(r))return false;
  if(!object(r)||!object(r.mission)||!object(r.flags)||!object(r.choices)||!object(r.rival)||!object(r.captivity)||s.failure||r.status==='locked')return false;
  const narrative=validateNarrativeDialog(s);if(narrative!==null)return narrative;
  const id=d.id.slice(6),scene=scenes[id];
  if(!scene||!person(s,scene.actor)||d.speaker!==names[scene.actor]||!exactChoices(d,scene.choices||single))return false;
  const expected=id==='carbine'&&equipmentContract(s)?CARBINE_INSPECTION_TEXT:id==='convoy'?convoyText[r.choices.order]:id==='visit'?(questioningVisitText(r)||visitText[r.choices.care]):text[id];
  const earlierVisitWire=id==='visit'&&d.text===questioningVisitText(r,{legacyDeprivationText:true});
  if(typeof expected!=='string'||d.text!==rivalSceneSpeech(r,id,expected)&&!earlierVisitWire)return false;
  try{return !!scene.gate(s,r);}catch{return false;}
}
