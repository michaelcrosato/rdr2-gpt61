#!/usr/bin/env python3
"""Isolated injected Bellwether art/contact fixtures, not a mission playthrough.

Run against an existing dev server. Browser screenshots and diagnostic receipts
stay in /tmp. WebKit phone emulation is a Safari-engine approximation.
"""
import argparse, asyncio, base64, hashlib, html, json, math, statistics
from pathlib import Path
from playwright.async_api import async_playwright

HTML=r'''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#354c53}canvas{width:100vw;height:100vh;display:block;image-rendering:pixelated}</style><canvas id="screen"></canvas><script src="/my-3d2dge-agent.js"></script><script type="module">
import {createBellwetherRenderer,createRivalCampPresentation} from '/src/bellwether-renderer.js';
import {createCampaignState,emitCampaignPresentation,getCampaignPresentation} from '/src/campaign.js';
import {RIVAL_ID,RIVAL_CAST,RIVAL_ENEMIES,RIVAL_WORLD as W} from '/content/campaign/bellwether-works.js';
import {HUNT_CAST} from '/content/campaign/willow-run.js';
const E=My3D2dge,game=new E.Game({canvas:'screen',view:'threequarter',minH:400,minW:360,maxW:1600,maxH:1200}),works=createBellwetherRenderer(game),camp=createRivalCampPresentation(game),clone=v=>JSON.parse(JSON.stringify(v));let state,world,focus;
let expectedPairs=[],expectedDrawn=[];
const point=a=>({x:a.x,y:a.y,z:a.z||0});
function emit(kind,actorId,targetId,target,from,sourceId){emitCampaignPresentation(state,kind,target,targetId,from,actorId,{sourceId});}
function attach(type,owner){const body=state.entities.levi;body.attachment={type,targetId:owner.id,regionId:type==='rest'?'snowbound':undefined,strap:true};body.regionId=null;Object.assign(body,point(owner));if(type==='carried')owner.carrying='levi';}
window.probe={game,get state(){return state},get world(){return world},setup(name,reduced=false){
  expectedPairs=[];expectedDrawn=[];state=createCampaignState();state.campaign={activeMissionId:RIVAL_ID,missions:{[RIVAL_ID]:{objects:{},scope:{raised:false,zoom:2,observed:{}},focus:{active:false,marks:[],queue:[]},rope:{phase:'idle'}}}};state.region=name.startsWith('camp')?'snowbound':'bellwether-works';state.dialog=null;state.failure=null;game.reduceMotion=reduced;
  const p=state.player;Object.assign(p,{id:'mara',regionId:state.region,x:1510,y:1490,z:0,facing:-Math.PI/2,mounted:false,crouch:false,carrying:null,coldcoat:true,holstered:true,equippedWeaponId:'tern-carbine',hp:100});
  state.entities=Object.fromEntries([p,...clone(RIVAL_CAST),...clone(RIVAL_ENEMIES),clone(HUNT_CAST.find(a=>a.id==='hob'))].map(a=>[a.id,a]));
  state.entities.copper={id:'copper',kind:'horse',x:1520,y:1530,z:0,hp:100,facing:0,regionId:state.region};state.entities['tomas-mount']={id:'tomas-mount',kind:'horse',x:1580,y:1530,z:0,hp:100,facing:0,regionId:state.region};state.entities.thimble={id:'thimble',kind:'horse',x:1640,y:1530,z:0,hp:100,facing:0,regionId:state.region};
  state.entities.tomas={id:'tomas',x:1550,y:1490,z:0,hp:100,facing:-Math.PI/2,regionId:state.region,mountId:'tomas-mount'};state.entities.inez={id:'inez',x:1600,y:1490,z:0,hp:100,facing:-Math.PI/2,regionId:state.region,mountId:'thimble'};
  const cast=['ruth','bastian','emmett','tomas','inez'];cast.forEach((id,i)=>Object.assign(state.entities[id],{regionId:state.region,x:1470+i*43,y:1510+(i%2)*30,z:0,mounted:false,mountId:{ruth:'plover',bastian:'cinder',emmett:'button',tomas:'tomas-mount',inez:'thimble'}[id]}));
  state.horse=state.entities.copper;state.npcs=Object.values(state.entities).filter(a=>a.kind!=='horse'&&a.id!=='mara');state.mounts=Object.values(state.entities).filter(a=>a.kind==='horse');state.enemies=RIVAL_ENEMIES.map(a=>state.entities[a.id]);state.bullets=[];state.itemInstances={};state.weapons={'tern-carbine':{id:'tern-carbine',kind:'carbine',ammo:7,reserve:42,owner:'mara',location:'carried'},'working-lariat':{id:'working-lariat',kind:'lariat',owner:'mara',location:'carried'}};
  const r=state.campaign.missions[RIVAL_ID],levi=state.entities.levi,ruth=state.entities.ruth,bastian=state.entities.bastian;focus={x:1590,y:1370,z:0};world=state.region==='snowbound'?camp:works;
  // Fixture inhabitants deliberately stay local for canvas inspection; this
  // driver does not award gameplay progress, loot, capture, or save validity.
  for(const id of['calder','levi','skein','grout'])state.entities[id].hidden=!['recon','chase','lariat','bind','carry','lift','load','passenger','unload','handoff','camphandoff','campholding','campcare'].includes(name);
  if(name==='convoy'){const ids=['mara',...cast];ids.forEach((id,i)=>{const a=state.entities[id],h=state.entities[id==='mara'?'copper':a.mountId];Object.assign(h,{x:1220+i*62,y:1750+(i%2)*40,z:0,regionId:state.region,facing:-.7});Object.assign(a,{...point(h),mounted:true,facing:h.facing,mountId:h.id});});focus={x:1370,y:1770,z:0};}
  if(name==='cast'){cast.forEach((id,i)=>Object.assign(state.entities[id],{x:1440+i*58,y:1460,facing:Math.PI/2}));focus={x:1560,y:1460,z:0};}
  if(name==='recon'){r.scope.raised=true;Object.assign(p,{x:1660,y:1240,facing:0});Object.assign(state.entities.calder,{x:1760,y:1240,facing:0});Object.assign(levi,{x:1800,y:1240,facing:Math.PI});focus={x:1790,y:1220,z:0};emit('card-tear','calder','levi',{...point(levi),z:35},state.entities.calder,'calder');}
  if(name==='descent'){Object.assign(p,{x:1110,y:1280,z:36,crouch:true,facing:1.05,traversal:{kind:'descend',progress:.5,from:{x:1055,y:1240,z:48},to:{x:1140,y:1360,z:12}}});Object.assign(state.entities.tomas,{x:1080,y:1280,z:36});focus={x:1110,y:1280,z:36};}
  if(['battle','focus','rifle','crouch','mounted'].includes(name)){p.holstered=false;state.aiming=true;p.facing=-.6;p.crouch=name==='crouch';if(name==='mounted'){p.mounted=true;Object.assign(state.horse,{...point(p),facing:p.facing});}state.enemies.forEach((a,i)=>{a.active=true;if(i<6){a.aiming=true;a.holstered=false;}});if(name==='focus'){r.focus.active=true;r.focus.marks=state.enemies.slice(2,5).map(a=>({targetId:a.id,x:0,y:0,z:42}));}focus=['rifle','crouch','mounted'].includes(name)?point(p):{x:1570,y:1360,z:0};}
  if(['givecarbine','givelariat','givesightglass'].includes(name)){const kind={givecarbine:'give-carbine',givelariat:'give-lariat',givesightglass:'give-sightglass'}[name],giver=state.entities[name==='givecarbine'?'tomas':name==='givelariat'?'inez':'emmett'];Object.assign(state.horse,{x:1470,y:1530,facing:0});Object.assign(giver,{x:1450,y:1510,facing:Math.PI/2});Object.assign(p,{x:1480,y:1510,facing:Math.PI});focus={x:1470,y:1510,z:0};emit(kind,giver.id,name==='givecarbine'?'tern-carbine':name==='givelariat'?'working-lariat':'sightglass',name==='givecarbine'?state.horse:{...point(p),z:35},giver,name==='givecarbine'?'copper':giver.id);}
  if(name==='loot'){Object.assign(p,{x:1450,y:1320,facing:-Math.PI/2});const victim=state.enemies[2];Object.assign(victim,{hp:0,dead:true,x:1450,y:1290});focus=p;emit('loot','mara',victim.id,victim,p,'mara');}
  if(['charges','passcharge','crate'].includes(name)){Object.assign(p,{x:2070,y:1146,facing:-Math.PI/2});Object.assign(ruth,{x:2096,y:1146,facing:Math.PI});focus={x:2070,y:1140,z:0};r.objects['charge-crate']={id:'charge-crate',kind:'sealed-quarry-charges',owner:name==='crate'?'ruth':'quarry-store',location:{type:name==='crate'?'carried':'station',targetId:name==='crate'?'ruth':'charge-crate'}};if(name==='charges')emit('inspect-charge','mara','charge-crate',W.charge,p,'mara');if(name==='passcharge')emit('pass-charge','mara','charge-crate',{...point(ruth),z:32},p,'mara');if(name==='crate')emit('carry-crate','ruth','charge-crate',ruth,W.charge,'charge-crate');}
  if(['loadcrate','packcrate','unloadcrate'].includes(name)){const horse=state.entities.plover;Object.assign(horse,{x:1780,y:1630,z:0,facing:0,regionId:state.region});Object.assign(ruth,{x:1778,y:1610,z:0,facing:Math.PI/2});Object.assign(p,{x:1805,y:1650,z:0});const from=point(ruth);r.objects['charge-crate']={id:'charge-crate',kind:'sealed-quarry-charges',owner:'ruth',location:{type:name==='unloadcrate'?'carried':'saddle',targetId:name==='unloadcrate'?'ruth':'plover'}};if(name!=='unloadcrate'){ruth.mounted=true;Object.assign(ruth,{...point(horse),facing:horse.facing});}if(name==='loadcrate')emit('load-crate','ruth','charge-crate',horse,from,'ruth');if(name==='unloadcrate')emit('unload-crate','ruth','charge-crate',ruth,horse,'plover');focus={x:1780,y:1630,z:0};}
  if(name==='plans'){Object.assign(p,{x:2020,y:1475,facing:-Math.PI/2});Object.assign(bastian,{x:2030,y:1450,facing:-Math.PI/2});Object.assign(state.entities.tomas,{x:2055,y:1450,facing:Math.PI});focus={x:2040,y:1435,z:0};emit('give-plans','bastian','route-diagram',{...point(state.entities.tomas),z:34},bastian,'bastian');}
  if(['chase','lariat','bind','carry','lift','load','passenger','unload','handoff'].includes(name)){Object.assign(p,{x:980,y:2130,z:0,facing:0});Object.assign(state.horse,{x:1020,y:2130,z:0,facing:0});Object.assign(levi,{x:1030,y:2120,z:0,facing:0,regionId:state.region,bound:!['chase','lariat'].includes(name)});Object.assign(state.entities.skein,{x:1080,y:2130,z:0,facing:0,regionId:state.region});focus={x:1040,y:2120,z:0};if(name==='chase'){levi.mounted=true;levi.mountId='skein';Object.assign(levi,point(state.entities.skein));p.mounted=true;Object.assign(state.horse,point(p));}
    if(name==='lariat'){r.rope={phase:'taut',targetId:'levi',x:levi.x,y:levi.y,z:25,tension:.65};p.equippedWeaponId='working-lariat';p.holstered=false;emit('lariat-throw','mara','working-lariat',levi,p,'mara');}
    if(name==='bind')emit('bind','mara','levi',levi,p,'mara');
    if(['carry','lift','unload'].includes(name)){const from=point(levi);attach('carried',p);if(name==='lift')emit('lift','mara','levi',p,from,'levi');if(name==='unload')emit('unload','mara','levi',p,state.horse,'copper');}
    if(['load','passenger'].includes(name)){attach('passenger',state.horse);if(name==='load')emit('load','mara','levi',state.horse,p,'mara');else{p.mounted=true;Object.assign(p,point(state.horse));}}
    if(name==='handoff'){Object.assign(ruth,{x:1010,y:2140,z:0,facing:Math.PI});attach('carried',ruth);emit('handoff','mara','levi',ruth,p,'mara');}
  }
  if(name.startsWith('camp')){Object.assign(p,{x:805,y:1210,z:0,facing:Math.PI/2});Object.assign(levi,{x:820,y:1240,z:0,regionId:'snowbound',bound:true,hidden:false});Object.assign(ruth,{x:835,y:1210,z:0,facing:Math.PI/2});attach('rest',{id:'levi-holding',x:820,y:1240,z:0});focus={x:810,y:1210,z:0};if(name==='camphandoff'){const hob=state.entities.hob;Object.assign(hob,{x:825,y:1220,z:0,regionId:'snowbound',facing:Math.PI});Object.assign(ruth,{x:800,y:1220,facing:0});attach('carried',hob);emit('handoff','ruth','levi',hob,ruth,'ruth');}if(name==='campcare'){levi.blanket=true;emit('care','ruth','levi',{...point(levi),z:18},ruth,'ruth');}if(name==='campstore'){levi.hidden=true;focus={x:750,y:1260,z:0};r.objects['charge-crate']={id:'charge-crate',kind:'sealed-quarry-charges',owner:'ruth',location:{type:'station',targetId:'quarry-charge-store',regionId:'snowbound'}};}}
  // Contract-2 selected manipulation fixtures. Local placement, ownership and
  // events are injected explicitly; none of these earn mission/save progress.
  if(name==='camppacket'){
    levi.hidden=true;
    Object.assign(p,{x:545,y:1225,z:0,facing:Math.PI,holstered:true});Object.assign(ruth,{x:525,y:1225,z:0,facing:0,regionId:state.region,holstered:true});Object.assign(state.horse,{x:545,y:1195,z:0,regionId:state.region});focus={x:535,y:1225,z:0};
    const meeting={x:535,y:1225,z:32};emit('give-cartridges','ruth','mara',meeting,ruth,'ruth');emit('receive-cartridges','mara','ruth',meeting,p,'mara');expectedPairs=[{giver:'ruth',receiver:'mara',giveKind:'give-cartridges',receiveKind:'receive-cartridges',duration:1.1}];expectedDrawn=['mara','ruth'];
  }
  if(name==='captransfer'){
    Object.assign(p,{x:1830,y:1538,z:0,facing:0,holstered:true});Object.assign(ruth,{x:1850,y:1538,z:0,facing:Math.PI,regionId:state.region,holstered:true});focus={x:1840,y:1538,z:0};r.objects['cap-tin']={id:'cap-tin',kind:'cap-tin',owner:'mara',location:{type:'carried',targetId:'mara'}};
    const meeting={x:1840,y:1538,z:32};emit('give-cap','mara','cap-tin',meeting,p,'mara');emit('receive-cap','ruth','cap-tin',meeting,ruth,'ruth');expectedPairs=[{giver:'mara',receiver:'ruth',giveKind:'give-cap',receiveKind:'receive-cap',duration:1.2}];expectedDrawn=['mara','ruth'];
  }
  if(name==='papertransfer'){
    Object.assign(p,{x:1250,y:1470,z:0,holstered:true});Object.assign(bastian,{x:1280,y:1440,z:0,facing:0,holstered:true,regionId:state.region});Object.assign(state.entities.tomas,{x:1300,y:1440,z:0,facing:Math.PI,holstered:true});focus={x:1290,y:1440,z:0};for(const id of['route-diagram','seizure-list'])r.objects[id]={id,kind:'document',owner:'bastian',location:{type:'carried',targetId:'bastian'}};
    const meeting={x:1290,y:1440,z:32};emit('give-plans','bastian','route-diagram',meeting,bastian,'bastian');emit('receive-plans','tomas','route-diagram',meeting,state.entities.tomas,'tomas');expectedPairs=[{giver:'bastian',receiver:'tomas',giveKind:'give-plans',receiveKind:'receive-plans',duration:1.25}];expectedDrawn=['bastian','tomas'];
  }
  if(['campstrike','campintervention'].includes(name)){
    levi.hidden=true;
    Object.assign(p,{x:550,y:1090,z:0,facing:-Math.PI/2,holstered:true});Object.assign(ruth,{x:540,y:1070,z:0,facing:0,regionId:state.region,hp:98});Object.assign(bastian,{x:558,y:1070,z:0,facing:Math.PI,regionId:state.region,holstered:true});Object.assign(state.entities.inez,{x:562,y:1090,z:0,facing:-Math.PI/2,holstered:true});Object.assign(state.entities.tomas,{x:615,y:1065,z:0});Object.assign(state.entities.emmett,{x:545,y:1120,z:0});focus={x:551,y:1090,z:0};
    if(name==='campstrike')emit('strike','bastian','ruth',ruth,bastian,'bastian');else{emit('intervene','inez','bastian',bastian,state.entities.inez,'inez');emit('intervene','mara','bastian',bastian,p,'mara');expectedPairs=[{giver:'inez',receiver:'mara',giveKind:'intervene',receiveKind:'intervene',duration:.7}];}expectedDrawn=['mara','inez','ruth','bastian'];
  }
  if(['strap','passengercheck','passengerresecure','passengersetdown'].includes(name)){
    Object.assign(p,{x:1000,y:2110,z:0,facing:Math.PI/2,holstered:true,mounted:false});Object.assign(state.horse,{x:1020,y:2130,z:0,facing:0,regionId:state.region});Object.assign(levi,{x:1020,y:2130,z:23,hp:94,regionId:null,bound:true,hidden:false,mounted:false,attachment:{type:'passenger',targetId:'copper',strap:name==='passengercheck'}});focus={x:1015,y:2120,z:0};
    if(name==='passengersetdown'){levi.attachment=null;levi.regionId=state.region;Object.assign(levi,{x:985,y:2130,z:0});emit('setdown','mara','levi',levi,p,'mara');}else emit(name==='passengercheck'?'care':'strap','mara','levi',levi,p,'mara');expectedDrawn=['mara','levi','copper'];
  }
  if(['lift','load','passenger','unload','handoff','camphandoff','campholding','campcare'].includes(name))expectedDrawn=['mara','levi'];
  world.update(0,state);game.cam.snap=true;return getCampaignPresentation(state);
},get expectedPairs(){return expectedPairs},get expectedDrawn(){return expectedDrawn},frame(dt){world.update(dt,state);},inspect(){return world.inspectAnimation?world.inspectAnimation():world.inspect();}};
probe.setup('convoy');game.start({update(){game.focus(focus.x,focus.y-game.H*.1/game.view.by,focus.z||0);world.update(0,state);},draw(r){world.draw(r,state);}});
</script>'''

CASES=['convoy','cast','recon','descent','battle','focus','rifle','crouch','mounted','givecarbine','givelariat','givesightglass','loot','charges','passcharge','crate','loadcrate','packcrate','unloadcrate','plans','chase','lariat','bind','carry','lift','load','passenger','unload','handoff','camphandoff','campholding','campcare','campstore','camppacket','captransfer','papertransfer','campstrike','campintervention','strap','passengercheck','passengerresecure','passengersetdown']
CONTEXTS=[('chromium-phone','chromium',375,667),('webkit-phone','webkit',320,568),('firefox-phone','firefox',375,667),('chromium-desktop','chromium',1440,900),('webkit-desktop','webkit',1440,900),('firefox-desktop','firefox',1440,900),('webkit-landscape','webkit',667,375),('webkit-tablet','webkit',768,1024),('chromium-wide','chromium',2560,1080),('chromium-ultrawide','chromium',3440,1440)]

async def sheets(pw,out,captures):
    groups={}
    for row in captures:groups.setdefault(row['context'],[]).append(row)
    browser=await pw.chromium.launch();page=await browser.new_page(viewport={'width':1600,'height':1000});made=[]
    for name,rows in groups.items():
        figures=''.join('<figure><img src="data:image/png;base64,'+base64.b64encode((out/row['image']).read_bytes()).decode()+'"><figcaption>'+html.escape(row['case']+(' REDUCED' if row['reducedMotion'] else ' NORMAL')+f' {row["age"]:.2f}s')+'</figcaption></figure>' for row in rows)
        await page.set_content('<style>body{margin:0;background:#253c43;color:#dacbab;font:12px monospace}main{display:grid;grid-template-columns:repeat(5,320px)}figure{margin:0;height:224px;text-align:center}img{display:block;margin:auto;width:316px;height:200px;object-fit:contain}figcaption{height:24px}</style><main>'+figures+'</main>')
        await page.evaluate('()=>Promise.all([...document.images].map(i=>i.decode()))');target=name+'-all-cases.png';await page.screenshot(path=str(out/target),full_page=True);made.append(target)
    await browser.close();return made

async def main(args):
    out=Path(args.output).resolve()
    if not str(out).startswith('/tmp/'):raise SystemExit('Write render receipts beneath /tmp.')
    out.mkdir(parents=True,exist_ok=True);captures=[];performance=[]
    sources=['my-3d2dge-agent.js','src/expedition-cast.js','src/willow-run-rigs.js','content/campaign/willow-run.js','content/campaign/snowbound.js','src/campaign.js','src/western-animation.js','src/expedition-animation.js','src/rival-rigs.js','src/rival-animation.js','src/rival-actors.js','src/bellwether-renderer.js','content/campaign/bellwether-works.js','src/rival-mission.js','src/rival-transport.js','src/rival-equipment-work.js','src/rival-search-work.js','src/rival-narrative.js','src/rival-questioning.js','src/rival-dialogue-validation.js']
    source_hashes=lambda:{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in sources}
    start_hashes=source_hashes()
    async with async_playwright() as pw:
        for label,engine,width,height in CONTEXTS:
            if engine not in args.engines.split(',') or args.contexts and label not in args.contexts.split(','):continue
            browser=await getattr(pw,engine).launch();page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1);errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
            await page.route('**/__bellwether_fixture',lambda route:route.fulfill(body=HTML,content_type='text/html'))
            await page.goto(args.url.rstrip('/')+'/__bellwether_fixture');await page.wait_for_function('!!window.probe')
            for case in args.cases.split(',') if args.cases else CASES:
                for reduced in [False] if args.normal_only else [False,True]:
                    for age in [float(n) for n in args.times.split(',')]:
                        await page.evaluate('([name,reduced])=>probe.setup(name,reduced)',[case,reduced]);before=await page.evaluate('JSON.stringify(probe.state)');await page.evaluate('dt=>probe.frame(dt)',age)
                        await page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
                        image=f'{label}-{case}-{"reduced" if reduced else "normal"}-{age:.2f}.png';await page.screenshot(path=str(out/image))
                        snap=await page.evaluate('probe.inspect()');contacts=snap['contacts'];drawn=snap['drawn'];finite=all(math.isfinite(n) for c in contacts for key in ('target','hit') for n in c.get(key,[])) and all(math.isfinite(n) for r in snap['roots'] for n in r['root'])
                        after=await page.evaluate('JSON.stringify(probe.state)');expected=await page.evaluate('({pairs:probe.expectedPairs,drawn:probe.expectedDrawn})');pair_checks=[]
                        for pair in expected['pairs']:
                            present=.28<=age/pair['duration']<=.75
                            left=[c for c in contacts if c['actorId']==pair['giver'] and c['kind']==pair['giveKind']]
                            right=[c for c in contacts if c['actorId']==pair['receiver'] and c['kind']==pair['receiveKind']]
                            error=math.dist(left[0]['hit'],right[0]['hit']) if left and right else None
                            pair_checks.append({**pair,'requiredAtThisAge':present,'giverContacts':len(left),'receiverContacts':len(right),'handToHandError':error,'passed':not present or bool(left and right and error<=1.1)})
                        missing=[id for id in expected['drawn'] if drawn.count(id)!=1]
                        captures.append({'context':label,'case':case,'stateUnchanged':before==after,'stateBeforeSha256':hashlib.sha256(before.encode()).hexdigest(),'stateAfterSha256':hashlib.sha256(after.encode()).hexdigest(),'pairedContacts':pair_checks,'missingExpectedActors':missing,'reducedMotion':reduced,'age':age,'image':image,'errors':errors[:],'engineErrors':await page.evaluate('probe.game.errors'),'contacts':contacts,'roots':snap['roots'],'drawn':drawn,'maxContactError':max([c['error'] for c in contacts]+[0]),'duplicateDrawnIds':sorted({id for id in drawn if drawn.count(id)>1}),'finite':finite});errors.clear()
            await page.evaluate("probe.setup('battle')");samples=await page.evaluate('()=>new Promise(resolve=>{const values=[];function sample(){values.push({...probe.game.stats});if(values.length===40)resolve(values);else requestAnimationFrame(sample);}requestAnimationFrame(sample);})')
            performance.append({'context':label,'samples':len(samples),'renderMsMedian':statistics.median(s['renderMs'] for s in samples),'renderMsP95':sorted(s['renderMs'] for s in samples)[37],'maxQueue':max(s['items'] for s in samples)})
            await browser.close();print(f'{label}: {len(captures)} cumulative captures',flush=True)
        contact_sheets=await sheets(pw,out,captures)
    end_hashes=source_hashes();stable=start_hashes==end_hashes
    failures=[r for r in captures if r['errors'] or r['engineErrors'] or r['duplicateDrawnIds'] or not r['finite'] or r['maxContactError']>1.1 or not r['stateUnchanged'] or r['missingExpectedActors'] or any(not p['passed'] for p in r['pairedContacts'])]
    report={'kind':'isolated-injected-native-render-fixtures','ordinaryPlaythrough':False,'realSafari':False,'sourceHashes':start_hashes,'sourceHashesAtEnd':end_hashes,'sourceStable':stable,'fixtureHtmlSha256':hashlib.sha256(HTML.encode()).hexdigest(),'performanceFixture':'battle','captures':captures,'failures':failures,'performance':performance,'contactSheets':contact_sheets}
    (out/'report.json').write_text(json.dumps(report,indent=2));cards=''.join(f'<figure><img src="{html.escape(r["image"])}" loading="lazy"><figcaption>{html.escape(r["context"]+" / "+r["case"])} / {"reduced" if r["reducedMotion"] else "normal"} / {r["age"]:.2f}s</figcaption></figure>' for r in captures)
    (out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width"><title>Bellwether native renderer fixtures</title><style>body{background:#243941;color:#dccfab;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}figure{margin:0}img{width:100%}</style><h1>Injected Bellwether art fixtures</h1><p>Contact and rendering evidence only. These injected scenes are not ordinary gameplay, valid save fixtures or real iOS Safari.</p><a href="report.json">Diagnostics</a><main>'+cards+'</main>')
    print(json.dumps({'output':str(out),'captures':len(captures),'failures':[{'context':r['context'],'case':r['case'],'age':r['age'],'error':r['maxContactError'],'js':r['errors'],'engine':r['engineErrors']} for r in failures],'performance':performance},indent=2))
    return bool(failures) or not stable

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--output',default='/tmp/dust-mercy-rival-native-render');parser.add_argument('--engines',default='chromium,webkit,firefox');parser.add_argument('--contexts',default='');parser.add_argument('--cases',default='');parser.add_argument('--times',default='.65');parser.add_argument('--normal-only',action='store_true');raise SystemExit(asyncio.run(main(parser.parse_args())))
