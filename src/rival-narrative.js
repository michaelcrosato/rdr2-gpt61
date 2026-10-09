/** Original, witnessed narrative work. Empty records belong to fresh histories;
 * old earned Saves without this record do not acquire invented conversations. */
import {RIVAL_ID,RIVAL_WORLD as W,RIVAL_DIALOGUE as D} from '../content/campaign/bellwether-works.js';
import {clearLine,followActor} from './campaign-navigation.js';
const OPENING='snowbound-the-last-warm-light',HUNT='snowbound-a-quiet-table';
const people=['tomas','inez','ruth','bastian','emmett'],mounts=['tomas-mount','thimble','plover','cinder','button'];
const rec=s=>s.campaign.missions[RIVAL_ID],narr=s=>rec(s).rival.narrative;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),point=a=>({x:a.x,y:a.y,z:a.z||0});
const distance=(a,b)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y):Infinity;
const near=(a,b,r)=>a&&b&&Math.abs((a.z||0)-(b.z||0))<8&&distance(a,b)<=r;
export const hasRivalNarrative=s=>rec(s).rival.contractVersion===2&&rec(s).rival.narrativeVersion===1&&object(narr(s));
export function createRivalNarrative(){return{schema:1,opening:{phase:'unstarted',activeSeconds:0,strike:null,intervention:null},speech:[],branch:{startedAt:null,activeSeconds:0,observedAt:null,position:null},travel:{index:0,activeSeconds:0,paused:false},pavel:{recognitionAt:null,replyAt:null},firstShot:{mode:null,reprimand:null},convoy:null};}
export function initializeUnstartedNarrative(s){const r=rec(s);if(r.rival.contractVersion===2&&r.rival.narrative===undefined&&r.mission.stage===0&&!['intervened','ruthHeard','emmettHeard','bastianHeard','inezHeard','accepted'].some(k=>r.flags[k])){r.rival.narrativeVersion=1;r.rival.narrative=createRivalNarrative();}}
function goal(a,p){a.goal=point(p);a.route=[];delete a.routeTarget;}
function stop(a){delete a.goal;a.route=[];delete a.routeTarget;a.vx=0;a.vy=0;}
function heard(s,id,key,actorId){const n=narr(s);if(!n.speech.some(e=>e.id===id))n.speech.push({id,key,actorId,at:s.elapsed,from:point(s.entities[actorId]),listener:point(s.player)});}
function talk(s,ctx,id,key,actorId,choices=[['leave','Continue.']]){heard(s,id,key,actorId);ctx.talk(s,`rival-${id}`,D[key].speaker,D[key].text,choices);}
function subtitle(s,ctx,id,key,actorId){heard(s,id,key,actorId);ctx.notice(s,`${D[key].speaker}: “${D[key].text}”`);ctx.log(s,`${D[key].speaker}: ${D[key].text}`);}
const argumentChoices=[['intervene','Stand beside Ruth and stop the quarrel.'],['leave','Return when you are ready.']];
const invitationChoices=[['accept-rival','Take the separate quarry expedition.'],['ask-motive','Question Tomas’s motive.'],['leave','Wait at the kiln.']];
const keys={argument:['quarrel','bastian'],ruth:['ruthReply','ruth'],emmett:['emmettReply','emmett'],bastian:['routeBastian','bastian'],inez:['intervene','inez'],invitation:['brief','tomas'],motive:['motiveAnswer','tomas']};
export function openingReady(s){return !hasRivalNarrative(s)||narr(s).opening.phase==='resolved';}
export function openingVoiceAvailable(s,id){if(!hasRivalNarrative(s))return true;const phase=narr(s).opening.phase;return phase!=='unstarted'&&(id!=='inez'||phase==='struck'&&narr(s).opening.activeSeconds>=.55||['blocking','resolved'].includes(phase));}
export function narrativeOffers(s){if(!hasRivalNarrative(s))return[];const r=rec(s),n=narr(s),out=[];
 if(r.mission.stage===0&&n.opening.phase==='struck'&&r.flags.inezHeard)out.push({id:'narrative:interpose',label:'Step beside Ruth and help Inez stop Bastian',target:{x:(s.entities.ruth.x+s.entities.bastian.x)/2,y:(s.entities.ruth.y+s.entities.bastian.y)/2,z:s.entities.ruth.z||0},radius:30});
 if(r.mission.stage===0&&n.opening.phase==='resolved')for(const [id,key]of [['ada','residentAda'],['vera','residentVera']])if(s.entities[id]?.hp>0&&s.entities[id].regionId===s.region&&!n.speech.some(e=>e.id===key))out.push({id:`narrative:${key}`,label:`Hear ${s.entities[id].name}’s reaction`,target:s.entities[id],radius:65});
 if(r.mission.stage===2&&n.branch.observedAt===null)out.push({id:'inspect:branch-trail',label:'Inspect Emmett’s survey-nail trail at the branch',target:W.props.find(p=>p.id==='branch-trail'),radius:55});
 if([5,6,8].includes(r.mission.stage)&&releasedPavel(s)&&s.entities.pavel.hp>0&&n.pavel.replyAt===null)out.push({id:'narrative:pavel',label:'Recognize Pavel and answer his account of release',target:s.entities.pavel,radius:65});
 return out;
}
export function releasedPavel(s){return rec(s).rival.pavelReturned&&s.campaign.missions[OPENING]?.flags.pavelChoice==='release'&&s.entities.pavel?.id==='pavel'&&s.entities.pavel.name==='Pavel Dune'&&s.entities.pavel.regionId===W.id;}
export function interactNarrative(s,id,ctx){if(!hasRivalNarrative(s))return false;const r=rec(s),n=narr(s);
 if(id==='rival:briefing'){talk(s,ctx,'argument','quarrel','bastian',argumentChoices);return true;}
 if(id.startsWith('talk:')&&keys[id.slice(5)]){const who=id.slice(5);r.flags[`${who}Heard`]=true;talk(s,ctx,who,...keys[who]);return true;}
 if(id==='rival:accept'){talk(s,ctx,'invitation','brief','tomas',invitationChoices);return true;}
 if(id==='narrative:interpose'){n.opening.phase='blocking';n.opening.activeSeconds=0;s.player.holstered=true;s.player.armed=false;s.entities.inez.holstered=true;s.entities.inez.aiming=false;goal(s.entities.inez,{x:s.player.x+12,y:s.player.y,z:s.player.z||0});ctx.notice(s,'Stand beside Ruth while Inez comes between her and Bastian.');return true;}
 if(id==='inspect:branch-trail'){n.branch.startedAt??=s.elapsed;n.branch.activeSeconds=0;ctx.present(s,'inspect-track',W.props.find(p=>p.id==='branch-trail'),'branch-trail',point(s.player),'mara',{sourceId:'mara'});return true;}
 if(id==='narrative:pavel'){n.pavel.recognitionAt??=s.elapsed;talk(s,ctx,'narrative-pavel','pavelRecognition','pavel',[['narrative-pavel-reply','Answer Pavel about the release.'],['leave','Leave his account unanswered.']]);return true;}
 const resident=id.slice(10);if(['residentAda','residentVera'].includes(resident)){talk(s,ctx,`narrative-${resident}`,resident,resident==='residentAda'?'ada':'vera');return true;}
 return false;
}
export function chooseNarrative(s,id,ctx){if(!hasRivalNarrative(s))return false;const r=rec(s),n=narr(s),d=s.dialog;
 if(d?.id==='rival-argument'&&id==='intervene'){if(!ctx.startMission(s,RIVAL_ID))return true;s.dialog=null;n.opening.phase='dispute';goal(s.entities.inez,W.camp.argumentRoom.participants.inez);goal(s.entities.tomas,W.camp.argumentRoom.participants.tomas);ctx.notice(s,'Hear Ruth and Emmett answer Bastian. Stay near them in the stove room.');ctx.checkpoint(s,'stove-quarrel','Quarrel entered before equipment or intervention');return true;}
 if(id==='ask-motive'){talk(s,ctx,'motive','motiveAnswer','tomas');return true;}
 if(d?.id==='rival-narrative-pavel'&&id==='narrative-pavel-reply'){n.pavel.replyAt=s.elapsed;talk(s,ctx,'narrative-pavel-reply','maraPavel','mara');return true;}
 if(d?.id==='rival-convoy'){
  if(id==='challenge-injuries'){n.convoy.challengeAt=s.elapsed;talk(s,ctx,'narrative-injuries','challengeInjuries','mara');ctx.log(s,`Mara counts the injured by name: ${n.convoy.wounds.map(w=>w.name).join(', ')}.`);return true;}
  if(id==='leave'){talk(s,ctx,'narrative-food-order',r.rival.huntAtEntry?'huntFirst':'rivalFirst',r.rival.huntAtEntry?'ruth':'inez');return true;}
 }
 if(d?.id==='rival-narrative-injuries'&&id==='leave'){talk(s,ctx,'narrative-injuries-answer','injuriesAnswer','tomas');return true;}
 if(d?.id==='rival-narrative-injuries-answer'&&id==='leave'){convoyTalk(s,ctx);return true;}
 if(d?.id==='rival-narrative-food-order'&&id==='leave'){n.convoy.orderHeardAt=s.elapsed;n.convoy.closedAt=s.elapsed;s.dialog=null;return true;}
 return false;
}
function contact(s,ctx,kind,actor,target){ctx.present(s,kind,s.entities[target],target,{...point(s.entities[actor]),facing:s.entities[actor].facing||0},actor,{sourceId:actor});}
function openingStep(s,dt,ctx,world){const r=rec(s),n=narr(s),o=n.opening,b=s.entities.bastian,u=s.entities.ruth,i=s.entities.inez,p=s.player;
 if(o.phase==='dispute'&&['ruth','emmett','bastian'].every(id=>r.flags[`${id}Heard`])){o.phase='approaching';goal(b,{x:u.x+18,y:u.y,z:u.z||0});}
 if(o.phase==='approaching'&&near(b,u,26)&&near(p,u,110)&&clearLine(world,b,u,2,false)){stop(b);b.holstered=true;b.aiming=false;contact(s,ctx,'strike','bastian','ruth');o.phase='struck';o.strike={at:s.elapsed,from:point(b),to:point(u),hpBefore:u.hp,hpAfter:Math.max(1,u.hp-2)};u.hp=o.strike.hpAfter;u.bruised=true;ctx.notice(s,'Bastian strikes Ruth’s shoulder. Inez calls for Mara to stand beside her.');}
 if(o.phase==='struck')o.activeSeconds=Math.min(.55,o.activeSeconds+dt);
 if(o.phase==='blocking'){if(!p.holstered||p.shotTimer>0||p.reloadTimer>0||p.weaponAction||!near(p,u,38)||!near(i,p,22)||!near(p,b,38)||!near(i,b,38)){o.activeSeconds=0;return;}if(o.activeSeconds===0){contact(s,ctx,'intervene','inez','bastian');contact(s,ctx,'intervene','mara','bastian');}o.activeSeconds=Math.min(.7,o.activeSeconds+dt);if(o.activeSeconds>=.7){stop(i);stop(b);o.phase='resolved';o.intervention={at:s.elapsed,mara:point(p),inez:point(i),ruth:point(u),bastian:point(b)};r.flags.intervened=true;s.companions.ruth.trust++;subtitle(s,ctx,'strike-after','strikeAfter','ruth');}}
}
export function trailNarrativeReady(s){return !hasRivalNarrative(s)||narr(s).branch.observedAt!==null&&narr(s).travel.index===3;}
function trailStep(s,dt,ctx){const r=rec(s),n=narr(s),branch=W.props.find(p=>p.id==='branch-trail'),p=s.player;
 if(n.branch.startedAt!==null&&n.branch.observedAt===null){if(near(p,branch,55)&&distance(p,s.entities.emmett)<=180){n.branch.activeSeconds=Math.min(.8,n.branch.activeSeconds+dt);if(n.branch.activeSeconds>=.8){n.branch.observedAt=s.elapsed;n.branch.position=point(p);subtitle(s,ctx,'branch-trail','branchTracks','emmett');}}else n.branch.activeSeconds=0;}
 const t=n.travel;if(t.index>=3||r.rival.trailIndex<2)return;const speaker=people[[0,2,3][t.index]],cohesive=people.every(id=>distance(p,s.entities[id])<=170)&&s.entities[speaker]?.regionId===W.id;
 if(!cohesive){t.paused=true;return;}const key=['routeTomas','routeRuth','routeBastian'][t.index],id=`trail-${t.index}`;
 if(!n.speech.some(e=>e.id===id)||t.paused)subtitle(s,ctx,id,key,speaker);t.paused=false;t.activeSeconds=Math.min(4,t.activeSeconds+dt);if(t.activeSeconds>=4){t.index++;t.activeSeconds=0;}
}
export function setNarrativeFirstShot(s,mode){if(hasRivalNarrative(s))narr(s).firstShot.mode=mode;}
export function narrativeShot(s,ctx){if(!hasRivalNarrative(s))return;const r=rec(s),n=narr(s);if(n.firstShot.mode==='unprompted'&&!n.firstShot.reprimand&&r.rival.yardOpening?.firedAt!==null){n.firstShot.reprimand={serial:r.rival.yardOpening.shotSerial,at:s.elapsed};subtitle(s,ctx,'ready-reprimand','readyReprimand','tomas');}}
export function startNarrativeConvoy(s,ctx){if(!hasRivalNarrative(s))return false;const r=rec(s),n=narr(s);n.convoy={startedAt:s.elapsed,order:r.choices.order,wounds:['mara',...people,s.horse.id,...mounts].map(id=>s.entities[id]).filter(a=>a.hp<100).map(a=>({id:a.id,name:a.name,hp:a.hp})),challengeAt:null,orderHeardAt:null,closedAt:null};convoyTalk(s,ctx);return true;}
function convoyTalk(s,ctx){const n=narr(s);talk(s,ctx,'convoy','convoy','tomas',[...(n.convoy.wounds.length&&n.convoy.challengeAt===null?[['challenge-injuries','Count the injured people and mounts by name.']]:[]),['leave','Continue.']]);}
export function convoyNarrativeReady(s){return !hasRivalNarrative(s)||narr(s).convoy?.closedAt!==null;}
export function stepRivalNarrative(s,dt,ctx,world){if(!hasRivalNarrative(s))return;const stage=rec(s).mission.stage;if(stage===0)openingStep(s,dt,ctx,world);if(stage===2)trailStep(s,dt,ctx);if(stage===5&&releasedPavel(s)&&s.entities.pavel.hp>0&&narr(s).pavel.recognitionAt===null&&distance(s.player,s.entities.pavel)<=560&&clearLine(world,{...s.player,z:(s.player.z||0)+29},{...s.entities.pavel,z:(s.entities.pavel.z||0)+44})){narr(s).pavel.recognitionAt=s.elapsed;subtitle(s,ctx,'narrative-pavel','pavelRecognition','pavel');}}

const exactChoices=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every((c,i)=>c.id===expected[i][0]&&c.label===expected[i][1]);
export function validateNarrativeDialog(s){if(!hasRivalNarrative(s))return null;const d=s.dialog,r=rec(s),n=narr(s);if(!d)return null;const id=d.id.slice(6);let key,actor,choices=[['leave','Continue.']],gate;
 if(keys[id]){[key,actor]=keys[id];gate=r.mission.stage===0&&s.region==='snowbound'&&near(s.player,s.entities[actor],id==='motive'?110:65);if(id==='argument'){choices=argumentChoices;gate=near(s.player,W.camp.briefing,65)&&n.opening.phase==='unstarted';}else if(id==='invitation'){choices=invitationChoices;gate&&=openingReady(s)&&['ruth','emmett','bastian','inez'].every(id=>r.flags[`${id}Heard`]);}else if(['ruth','emmett','bastian','inez'].includes(id))gate&&=r.flags[`${id}Heard`]&&openingVoiceAvailable(s,id);}
 else if(id==='convoy'){key='convoy';actor='tomas';choices=[...(n.convoy?.wounds.length&&n.convoy.challengeAt===null?[['challenge-injuries','Count the injured people and mounts by name.']]:[]),['leave','Continue.']];gate=r.mission.stage===9&&!!n.convoy&&n.convoy.closedAt===null&&near(s.player,s.entities.tomas,90);}
 else if(id==='narrative-pavel'||id==='narrative-pavel-reply'){key=id==='narrative-pavel'?'pavelRecognition':'maraPavel';actor=id==='narrative-pavel'?'pavel':'mara';choices=id==='narrative-pavel'?[['narrative-pavel-reply','Answer Pavel about the release.'],['leave','Leave his account unanswered.']]:choices;gate=[5,6,8].includes(r.mission.stage)&&releasedPavel(s)&&s.entities.pavel.hp>0&&near(s.player,s.entities.pavel,65)&&n.pavel.recognitionAt!==null&&(id==='narrative-pavel'||n.pavel.replyAt!==null);}
 else if(id==='narrative-food-order'||id==='narrative-injuries'||id==='narrative-injuries-answer'){key=id==='narrative-food-order'?(n.convoy?.order==='hunt-first'?'huntFirst':'rivalFirst'):id==='narrative-injuries'?'challengeInjuries':'injuriesAnswer';actor=id==='narrative-food-order'?(n.convoy?.order==='hunt-first'?'ruth':'inez'):id==='narrative-injuries'?'mara':'tomas';gate=r.mission.stage===9&&n.convoy?.closedAt===null&&n.convoy?.order===(r.rival.huntAtEntry?'hunt-first':'rival-first')&&(id==='narrative-food-order'||n.convoy.challengeAt!==null&&n.convoy.wounds.length>0)&&distance(s.player,s.entities[actor])<=210;}
 else if(['narrative-residentAda','narrative-residentVera'].includes(id)){key=id.slice(10);actor=key==='residentAda'?'ada':'vera';gate=r.mission.stage===0&&openingReady(s)&&near(s.player,s.entities[actor],65);}
 else return null;
 return !!gate&&s.entities[actor]?.hp>0&&s.entities[actor].regionId===s.region&&d.speaker===D[key].speaker&&d.text===D[key].text&&exactChoices(d.choices,choices)&&n.speech.some(e=>e.id===id&&e.key===key&&e.actorId===actor);
}
export function validateRivalNarrative(s){const r=rec(s),n=narr(s);if(n===undefined)return r.rival.narrativeVersion===undefined;if(r.rival.narrativeVersion!==1||r.rival.contractVersion!==2||!object(n)||Object.keys(n).length!==8||n.schema!==1||!Array.isArray(n.speech)||n.speech.length>25||new Set(n.speech.map(e=>e.id)).size!==n.speech.length)return false;const time=v=>Number.isFinite(v)&&v>=0&&v<=s.elapsed,position=p=>object(p)&&Object.keys(p).length===3&&['x','y','z'].every(k=>Number.isFinite(p[k]))&&p.x>=0&&p.x<=W.width&&p.y>=0&&p.y<=W.height&&p.z>=0&&p.z<=160,spoken=id=>n.speech.some(e=>e.id===id);
 const speechSpecs={...keys,'strike-after':['strikeAfter','ruth'],'branch-trail':['branchTracks','emmett'],'trail-0':['routeTomas','tomas'],'trail-1':['routeRuth','ruth'],'trail-2':['routeBastian','bastian'],'narrative-pavel':['pavelRecognition','pavel'],'narrative-pavel-reply':['maraPavel','mara'],'ready-reprimand':['readyReprimand','tomas'],convoy:['convoy','tomas'],'narrative-injuries':['challengeInjuries','mara'],'narrative-injuries-answer':['injuriesAnswer','tomas'],'narrative-food-order':[n.convoy?.order==='hunt-first'?'huntFirst':'rivalFirst',n.convoy?.order==='hunt-first'?'ruth':'inez'],'narrative-residentAda':['residentAda','ada'],'narrative-residentVera':['residentVera','vera']};
 if(n.speech.some(e=>!object(e)||Object.keys(e).length!==6||!D[e.key]||speechSpecs[e.id]?.[0]!==e.key||speechSpecs[e.id]?.[1]!==e.actorId||!s.entities[e.actorId]||D[e.key].speaker!==s.entities[e.actorId].name||!time(e.at)||!position(e.from)||!position(e.listener)||distance(e.from,e.listener)>600))return false;
 const o=n.opening;if(!object(o)||Object.keys(o).length!==4||!['unstarted','dispute','approaching','struck','blocking','resolved'].includes(o.phase)||!Number.isFinite(o.activeSeconds)||o.activeSeconds<0||o.activeSeconds>.7)return false;
 if(['struck','blocking','resolved'].includes(o.phase)!==!!o.strike||!!o.intervention!==(o.phase==='resolved')||r.flags.intervened!==(o.phase==='resolved'))return false;
 if(o.strike&&(!object(o.strike)||Object.keys(o.strike).length!==5||!Number.isFinite(o.strike.hpBefore)||!Number.isFinite(o.strike.hpAfter)||!time(o.strike.at)||!position(o.strike.from)||!position(o.strike.to)||!near(o.strike.from,o.strike.to,26)||o.strike.hpBefore-o.strike.hpAfter!==2||o.strike.hpAfter<=0||!['ruth','emmett','bastian'].every(spoken)))return false;
 if(o.intervention&&(!object(o.intervention)||Object.keys(o.intervention).length!==5||!time(o.intervention.at)||o.intervention.at<o.strike.at+.7-1e-8||!['mara','inez','ruth','bastian'].every(id=>position(o.intervention[id]))||!near(o.intervention.mara,o.intervention.ruth,38)||!near(o.intervention.mara,o.intervention.inez,22)||!near(o.intervention.mara,o.intervention.bastian,38)||!near(o.intervention.inez,o.intervention.bastian,38)||!spoken('inez')||o.activeSeconds!==.7))return false;
 for(const id of['ruth','emmett','bastian','inez'])if(r.flags[`${id}Heard`]!==spoken(id))return false;
 if(r.mission.stage>=1&&!openingReady(s))return false;
 const b=n.branch,t=n.travel;if(!object(b)||Object.keys(b).length!==4||!Number.isFinite(b.activeSeconds)||b.activeSeconds<0||b.activeSeconds>.8||b.startedAt!==null&&!time(b.startedAt)||b.observedAt!==null&&(!time(b.observedAt)||b.startedAt===null||b.observedAt<b.startedAt+.8-1e-8||!near(b.position,W.props.find(p=>p.id==='branch-trail'),55)||b.activeSeconds!==.8||!spoken('branch-trail'))||b.observedAt===null&&b.position!==null)return false;
 if(!object(t)||Object.keys(t).length!==3||!Number.isInteger(t.index)||t.index<0||t.index>3||!Number.isFinite(t.activeSeconds)||t.activeSeconds<0||t.activeSeconds>4||typeof t.paused!=='boolean'||[0,1,2].some(i=>i<t.index&&!spoken(`trail-${i}`)))return false;
 if(r.mission.stage>=3&&!trailNarrativeReady(s))return false;
 const p=n.pavel;if(!object(p)||Object.keys(p).length!==2||[p.recognitionAt,p.replyAt].some(v=>v!==null&&!time(v))||p.recognitionAt!==null&&(!r.rival.pavelReturned||s.campaign.missions[OPENING]?.flags.pavelChoice!=='release'||!spoken('narrative-pavel'))||p.replyAt!==null&&(p.recognitionAt===null||p.replyAt<p.recognitionAt||!spoken('narrative-pavel-reply')))return false;
 const f=n.firstShot;if(!object(f)||Object.keys(f).length!==2||![null,'player','tomas','unprompted'].includes(f.mode)||r.mission.stage>=5&&f.mode===null||f.mode==='tomas'&&r.choices.firstShot!=='tomas'||['player','unprompted'].includes(f.mode)&&r.choices.firstShot!=='player'||f.reprimand&&(!time(f.reprimand.at)||f.mode!=='unprompted'||f.reprimand.serial!==r.rival.yardOpening?.shotSerial||!spoken('ready-reprimand')))return false;
 if(f.mode==='unprompted'&&r.rival.yardOpening?.firedAt!==null&&r.rival.yardOpening?.firedAt!==undefined&&!f.reprimand)return false;
 const c=n.convoy;if(c!==null){if(!object(c)||Object.keys(c).length!==6||!time(c.startedAt)||c.order!==r.choices.order||!Array.isArray(c.wounds)||new Set(c.wounds.map(w=>w.id)).size!==c.wounds.length||c.wounds.some(w=>!s.entities[w.id]||s.entities[w.id].name!==w.name||!Number.isFinite(w.hp)||w.hp<=0||w.hp>=100)||[c.challengeAt,c.orderHeardAt,c.closedAt].some(v=>v!==null&&(!time(v)||v<c.startedAt))||c.challengeAt!==null&&(!c.wounds.length||!spoken('narrative-injuries'))||c.closedAt!==null&&(c.orderHeardAt===null||!spoken('narrative-food-order')))return false;if(s.dialog?.id?.includes('convoy')&&c.wounds.some(w=>s.entities[w.id].hp!==w.hp))return false;}
 if(r.mission.stage>=9&&c===null||r.mission.stage>=10&&!convoyNarrativeReady(s))return false;
 return validateNarrativeDialog(s)!==false;
}
