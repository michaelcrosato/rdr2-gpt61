#!/usr/bin/env python3
"""Isolated native-render fixtures, not a mission playthrough or save validator.

Requires an existing dev server and machine-wide Playwright browsers. Captures
in /tmp only. Fixture state/processing progress are injected deliberately; the
ordinary controls and saved journey are verified by separate hunt drivers.
"""
import argparse, asyncio, hashlib, html, json, math, statistics, time
from pathlib import Path
from playwright.async_api import async_playwright

HTML=r"""<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#354c43}canvas{width:100vw;height:100vh;display:block;image-rendering:pixelated}</style><canvas id="screen"></canvas><script src="/my-3d2dge-agent.js"></script><script type="module">
import {createWillowRunRenderer} from '/src/willow-run-renderer.js';import {createSnowboundRenderer} from '/src/snowbound-renderer.js';import * as O from '/src/campaign.js';import {HUNT_ID,HUNT_CAST,HUNT_ANIMALS,HUNT_BOW,WILLOW_RUN_WORLD as W,huntBowGiftStance} from '/content/campaign/willow-run.js';import {RESCUE_CAST} from '/content/campaign/north-cutting.js';
const E=My3D2dge,game=new E.Game({canvas:'screen',view:'threequarter',minH:400,minW:360,maxW:1600,maxH:1200}),willow=createWillowRunRenderer(game),camp=createSnowboundRenderer(game);let state,world,focus;
const clone=v=>JSON.parse(JSON.stringify(v));
function emit(kind,actor,targetId,target,from,sourceId){O.emitCampaignPresentation(state,kind,target,targetId,from,actor,{sourceId});}
function attach(body,type,target){body.attachment={type,targetId:target.id,...(type==='rest'?{regionId:'snowbound'}:{})};body.regionId=null;body.x=target.x;body.y=target.y;body.z=(target.z||0)+(type==='carried'?18:type==='large-load'?16:0);if(type==='carried')target.carrying=body.id;}
window.probe={game,get state(){return state},get world(){return world},setup(name,reduced=false){
state=O.createCampaignState();state.campaign={activeMissionId:HUNT_ID};state.dialog=null;state.failure=null;state.region=(name.startsWith('camp')||name.startsWith('cam'))?'snowbound':'willow-run';game.reduceMotion=reduced;state.player.id='mara';state.player.regionId=state.region;state.player.z=0;state.player.coldcoat=true;state.player.lantern=true;state.player.mounted=false;state.player.carrying=null;state.player.holstered=true;state.mission.stage=5;
const h=state.animals.find(a=>a.id==='copper')||state.horse;state.horse=Object.assign(clone(h),{id:'copper',kind:'horse',hp:100,regionId:state.region,x:870,y:1260,z:0,facing:0});state.entities=Object.fromEntries([state.player,state.horse,...state.npcs,...state.enemies,...clone(RESCUE_CAST),...clone(HUNT_CAST),...clone(HUNT_ANIMALS)].map(a=>[a.id,a]));state.entities.copper=state.horse;state.animals=HUNT_ANIMALS.map(a=>state.entities[a.id]);state.mounts=[state.entities.bracken];state.npcs=Object.values(state.entities).filter(a=>!a.kind&&a.id!=='mara');state.npcs.forEach(a=>{a.regionId='snowbound';a.z=a.z||0});state.entities.neri.hp=0;state.worldChanges.neriRemembered=true;
for(const id of['juno','bracken'])state.entities[id].regionId=state.region;
state.weapons={'juno-ash-bow':clone(HUNT_BOW),'mara-revolver':{kind:'revolver',ammo:6,reserve:18}};state.player.equippedWeaponId='juno-ash-bow';state.weapons['juno-ash-bow'].owner='mara';state.weapons['juno-ash-bow'].location='carried';state.bow={drawing:false,age:0,charge:0,aim:{x:1360,y:1060,z:23},sway:0,arrows:[]};state.processing={player:null,orla:null};state.itemInstances={};state.hunt={};state.tracks={};const p=state.player,j=state.entities.juno,b=state.entities.bracken,d=state.entities['willow-creek-doe'],buck=state.entities['willow-cedar-buck'];j.mounted=false;j.carrying=null;d.hunt={pose:'drink',life:'alive',arrowImpacts:0};buck.hunt={pose:'browse',life:'alive'};Object.assign(p,{x:1260,y:1140,z:0,facing:Math.atan2(d.y-1140,d.x-1260)});Object.assign(j,{x:p.x-40,y:p.y+35,z:0,facing:p.facing});Object.assign(b,{x:870,y:1300,z:0,facing:0});focus=p;world=state.region==='snowbound'?camp:willow;
const kill=a=>Object.assign(a,{hp:0,dead:true,phase:'dead',hunt:{...a.hunt,life:'dead',arrowImpacts:1}});
if(name==='camgivebow'){state.mission.stage=1;Object.assign(p,{x:320,y:1205,facing:Math.PI,equippedWeaponId:'mara-revolver'});Object.assign(state.horse,{x:245,y:1165,z:0,facing:0});Object.assign(j,huntBowGiftStance(state.horse));Object.assign(b,{x:185,y:1165,z:0,facing:0});Object.assign(state.weapons['juno-ash-bow'],{location:'saddle',rackMountId:'copper'});focus={x:250,y:1190,z:0};emit('give-bow','juno','juno-ash-bow',state.horse,j,'copper');}
else if(name==='windlesson'){state.mission.stage=2;Object.assign(p,{x:805,y:1300,z:0,mounted:true,facing:0});Object.assign(state.horse,{x:p.x,y:p.y,z:0,facing:p.facing});Object.assign(j,{x:860,y:1300,z:0,mounted:true,facing:0});Object.assign(b,{x:j.x,y:j.y,z:0,facing:j.facing});focus={x:860,y:1280,z:0};emit('wind-lesson','juno','wind-ribbon',W.props.find(prop=>prop.id==='wind-ribbon'),j,'juno');}
else if(name==='deerdrink'||name==='deerheadup'||name==='deerbrowse'){focus=d;Object.assign(p,{x:1310,y:1120,facing:-.8});if(name==='deerheadup')d.hunt.pose='head-up';if(name==='deerbrowse')d.hunt.pose='browse';}
else if(name==='buck'){focus=buck;Object.assign(p,{x:1790,y:825,facing:-.6});Object.assign(j,{x:1760,y:855});}
else if(name.startsWith('bow')){state.aiming=true;state.bow.drawing=true;state.bow.charge=name==='bowrelaxed'?0:1;state.bow.age=name==='bowoverdraw'?4:1;state.bow.sway=name==='bowoverdraw'?.12:0;if(name==='bowcrouch'){p.crouch=true;p.pose='crouch';}if(name==='bowmounted'){p.mounted=true;Object.assign(state.horse,{x:p.x,y:p.y,facing:p.facing});}if(name==='bowrelease'){state.bow.drawing=false;emit('release-bow','mara','willow-creek-doe',d,p,'mara');state.bow.arrows=[{id:'hunt-arrow-1',x:p.x+35,y:p.y-28,z:35,vx:200,vy:-140,vz:20,phase:'flying'}];}}
else if(name==='lift'||name==='carry'||name==='junocarry'){kill(d);Object.assign(d,{x:1280,y:1130,facing:0});Object.assign(p,{x:1275,y:1145,facing:0});if(name==='junocarry'){Object.assign(j,{x:1275,y:1145,facing:0});attach(d,'carried',j);focus=j;}else{const from={...d};attach(d,'carried',p);if(name==='lift')emit('lift','mara',d.id,p,from,d.id);}}
else if(name==='load'||name==='loads'||name==='unload'){kill(d);kill(buck);Object.assign(p,{x:900,y:1300,facing:0});Object.assign(state.horse,{x:915,y:1300,facing:0});Object.assign(j,{x:850,y:1310,facing:0});Object.assign(b,{x:850,y:1330,facing:0});attach(buck,'large-load',b);if(name==='unload'){attach(d,'carried',p);emit('unload','mara',d.id,p,state.horse,'copper');}else{attach(d,'large-load',state.horse);if(name==='load')emit('load','mara',d.id,state.horse,p,'mara');}if(name==='loads'){p.mounted=true;p.x=state.horse.x;p.y=state.horse.y;j.mounted=true;j.x=b.x;j.y=b.y;}}
else if(name==='bear'){const a=state.entities['willow-gorge-bear'];Object.assign(p,{x:1860,y:1170,mounted:true,facing:.3});Object.assign(state.horse,{x:p.x,y:p.y,fear:80});Object.assign(j,{x:1820,y:1220,mounted:true});Object.assign(b,{x:j.x,y:j.y,fear:65});focus={x:1960,y:1140,z:0};a.phase='retreat';}
else if(name==='mount'||name==='dismount'){Object.assign(state.horse,{x:840,y:1270,facing:0});Object.assign(p,{x:name==='mount'?840:875,y:1270,mounted:name==='mount',facing:0});emit(name,'mara','copper',name==='mount'?state.horse:p,{x:name==='mount'?812:840,y:1270,z:name==='mount'?0:23},'mara');}
else if(name.startsWith('camp')||name.startsWith('cam')){Object.assign(p,{x:125,y:1259,facing:-Math.PI/2});Object.assign(j,{x:175,y:1295,facing:Math.PI});Object.assign(state.horse,{x:245,y:1165,z:0,facing:0});Object.assign(b,{x:185,y:1165,z:0,facing:0});focus={x:180,y:1245,z:0};kill(d);kill(buck);attach(d,'rest',W.camp.benchMara);attach(buck,'rest',W.camp.benchJuno);Object.assign(state.entities.orla,{x:125,y:1309,facing:-Math.PI/2});if(name==='campdelivery'){attach(d,'carried',p);const from={...p};attach(d,'rest',W.camp.benchMara);p.carrying=null;emit('deliver','mara',d.id,W.camp.benchMara,from,'mara');}if(name==='campskin'||name==='campskinapproach'){state.processing.player={kind:'skin',actorId:'mara',targetId:d.id,benchId:W.camp.benchMara.id,phase:'working',progress:.5,age:3.2,duration:6.4};state.processing.orla={kind:'skin',actorId:'orla',targetId:buck.id,benchId:W.camp.benchJuno.id,phase:'working',progress:.4,age:2.8,duration:7};}if(name==='campskinapproach'){state.processing.player.phase='approach';state.processing.orla=null;}if(name==='campguide'){Object.assign(state.entities.orla,{x:149,y:1259,facing:-Math.PI/2});state.processing.player={kind:'skin',actorId:'mara',targetId:d.id,benchId:W.camp.benchMara.id,phase:'working',age:.6,duration:6.4,progress:.1};}if(name==='campcook'){Object.assign(state.entities.orla,{x:110,y:1320,facing:Math.PI});state.processing.cook={kind:'cook',actorId:'orla',targetId:'kitchen-stove',age:2.5,duration:5,progress:.5};}if(name==='camphides'){d.processed=true;d.hunt.life='processed';buck.processed=true;buck.hunt.life='processed';state.itemInstances={'hunt-hide-doe':{kind:'deer-hide',owner:'mara',location:{type:'drying-rack',targetId:'kitchen-hide-rack'}},'hunt-hide-buck':{kind:'deer-hide',owner:'community',location:{type:'drying-rack',targetId:'kitchen-hide-rack'}}};state.flags.cooked=true;}if(name==='camphob'){focus=state.entities.hob;p.x=200;p.y=1300;}}

if(name==='corpse'||name==='corpsearrow'||name.startsWith('corpsefacing')){kill(d);if(name.startsWith('corpsefacing'))d.facing=Number(name.match(/(\d+)$/)[1])*Math.PI/4;focus=d;Object.assign(p,{x:d.x-50,y:d.y+55});if(name==='corpsearrow')state.bow.arrows=[{id:'hunt-arrow-1',phase:'embedded',targetId:d.id,targetZone:'vital',x:d.x,y:d.y,z:19,vx:210,vy:-150,vz:0,regionId:state.region}];}
if(name==='collapse'){kill(d);focus=d;Object.assign(p,{x:d.x-50,y:d.y+55});emit('animal-collapse',d.id,d.id,d,d,d.id);}
if(name.startsWith('bowfacing')||name.startsWith('bowmountedfacing')){const i=Number(name.match(/(\d+)$/)[1]),angle=i*Math.PI/4;p.facing=angle;state.bow.aim={x:p.x+Math.cos(angle)*100,y:p.y+Math.sin(angle)*100,z:23};state.bow.sway=0;if(name.startsWith('bowmounted')){p.mounted=true;Object.assign(state.horse,{x:p.x,y:p.y,facing:angle});}}
if(name==='nock'){state.aiming=false;state.bow.drawing=false;state.bow.charge=0;state.player.holstered=false;emit('nock-arrow','mara','juno-ash-bow',p,p,'mara');}
if(name==='trackoverlay'){state.tracks={overlay:true,samples:Object.fromEntries(W.habitats.filter(h=>h.animalId.includes('doe')||h.animalId.includes('buck')).map(h=>[h.animalId,h.initialTracks]))};Object.assign(p,{x:1100,y:1170});focus=p;}
if(name==='camequip'||name==='camstorebow'){Object.assign(p,{x:220,y:1180,facing:-Math.PI/2});focus={x:200,y:1180,z:0};if(name==='camstorebow')Object.assign(state.weapons['juno-ash-bow'],{location:'saddle',rackMountId:'copper'});emit(name==='camequip'?'equip':'store-bow','mara','juno-ash-bow',state.horse,p,name==='camequip'?'copper':'mara');}
if(name==='camptakeknife'){Object.assign(p,{x:175,y:1245,facing:-Math.PI/2});state.flags.knifeSecured=true;emit('take-knife','mara','field-knife',W.camp.knife,p,'mara');}
if(['camplifthide','camphanghide','campstorehide','campcarriedhide'].includes(name)){d.processed=true;d.hunt.life='processed';state.itemInstances={'hunt-hide-doe':{id:'hunt-hide-doe',kind:'deer-hide',owner:'mara',quality:3,location:{type:'carried',targetId:'mara',regionId:'snowbound'}}};const h=state.itemInstances['hunt-hide-doe'];if(name==='camplifthide'){emit('lift-hide','mara',h.id,p,W.camp.benchMara,W.camp.benchMara.id);}if(name==='camphanghide'){Object.assign(p,{x:85,y:1180,facing:Math.PI});h.location={type:'drying-rack',targetId:W.camp.hideRack.id,regionId:'snowbound'};emit('hang-hide','mara',h.id,W.camp.hideRack,p,'mara');focus={x:125,y:1180,z:0};}if(name==='campstorehide'){Object.assign(p,{x:220,y:1180,facing:0});h.location={type:'saddle',targetId:'copper'};emit('store-hide','mara',h.id,state.horse,p,'mara');focus={x:200,y:1180,z:0};}}
if(name==='busy'){kill(d);kill(buck);Object.assign(p,{x:1855,y:1160,mounted:true,facing:.5});Object.assign(state.horse,{x:p.x,y:p.y,facing:.5,fear:75});Object.assign(j,{x:1825,y:1225,mounted:true,facing:.5});Object.assign(b,{x:j.x,y:j.y,facing:.5,fear:80});attach(d,'large-load',state.horse);attach(buck,'large-load',b);focus={x:1920,y:1160,z:0};}
world.update(0,state);game.cam.snap=true;return O.getCampaignPresentation(state)},frame(dt){world.update(dt,state);return world.inspectAnimation()},processing(progress){for(const p of Object.values(state.processing))if(p){p.progress=progress;p.age=progress*p.duration;}},camera(){return {width:game.W,height:game.H}},scene(){return{region:state.region,player:{x:state.player.x,y:state.player.y,z:state.player.z,facing:state.player.facing,mounted:state.player.mounted,crouch:state.player.crouch},juno:state.entities.juno,mounts:{copper:state.horse,bracken:state.entities.bracken},weapons:state.weapons,presentation:O.getCampaignPresentation(state),bow:state.bow,processing:state.processing,animals:Object.fromEntries(['willow-creek-doe','willow-cedar-buck','willow-gorge-bear'].map(id=>[id,state.entities[id]]))}}};
probe.setup('bowdraw');game.start({update(){game.focus(focus.x,focus.y-game.H*.1/game.view.by,focus.z||0);world.update(0,state)},draw(r){world.draw(r,state)}});
</script>"""
MATRIX_CASES=['deerdrink','deerheadup','deerbrowse','buck','corpsearrow','bowdraw','bowcrouch','bowmounted','bowoverdraw','lift','carry','junocarry','loads','bear','mount','dismount','trackoverlay','campcast','campskinapproach','campskin','campguide','campcook','camphides','camphob','camgivebow','windlesson']
CONTACT_CASES=['lift','load','unload','mount','dismount','campdelivery','camplifthide','camphanghide','campstorehide','camequip','camstorebow','camptakeknife','nock','collapse','bowrelease']
TIMES=[0,.15,.35,.65,1.05,1.65,2.1]
CONTEXTS=[('chromium-phone','chromium',375,667),('webkit-phone','webkit',375,667),('firefox-phone','firefox',375,667),('chromium-desktop','chromium',1440,900),('webkit-desktop','webkit',1440,900),('firefox-desktop','firefox',1440,900),('webkit-landscape','webkit',667,375),('webkit-tablet','webkit',768,1024),('chromium-ultrawide','chromium',2560,1080)]

def diagnostic(snapshot):
    contacts=snapshot.get('contacts',[]);drawn=snapshot.get('drawn',[])
    finite=all(math.isfinite(n) for c in contacts for key in ('target','hit') for n in c.get(key,[])) and all(math.isfinite(n) for r in snapshot.get('roots',[]) for n in r['root'])
    return {'maxContactError':max([c.get('error',0) for c in contacts]+[0]),'contactCount':len(contacts),'duplicateDrawnIds':sorted({i for i in drawn if drawn.count(i)>1}),'finite':finite}

async def capture(page,out,label,case,reduced,age,records,errors,group):
    await page.evaluate('([c,r])=>probe.setup(c,r)',[case,reduced])
    await page.evaluate('t=>probe.frame(t)',age)
    await page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    name=f'{label}-{case}-{"reduced" if reduced else "normal"}-{age:.2f}.png'
    await page.screenshot(path=str(out/name))
    snapshot=await page.evaluate('probe.world.inspectAnimation()')
    scene=await page.evaluate('probe.scene()');scene_failures=[]
    if case.startswith('corpse') and (scene['animals']['willow-creek-doe']['hp']!=0 or not scene['animals']['willow-creek-doe'].get('dead')):scene_failures.append('corpse fixture did not contain a dead doe')
    if case.startswith('corpsefacing'):
        expected=int(case[-1])*math.pi/4
        if abs(scene['animals']['willow-creek-doe']['facing']-expected)>1e-8:scene_failures.append('corpse heading differs from fixture heading')
    if case.startswith('bowmountedfacing') and not scene['player']['mounted']:scene_failures.append('mounted bow fixture is on foot')
    if case.startswith('bowfacing') or case.startswith('bowmountedfacing'):
        expected=int(case[-1])*math.pi/4
        if abs(scene['player']['facing']-expected)>1e-8:scene_failures.append('bow heading differs from fixture heading')
    if case=='campskinapproach' and any(c['kind']=='skinning-contact' for c in snapshot['contacts']):scene_failures.append('knife contact during approach')
    if case=='camgivebow':
        gift=next((event for event in scene['presentation']['events'] if event['kind']=='give-bow'),None)
        if not gift or gift['actorId']!='juno' or gift['sourceId']!='copper' or gift['targetId']!='juno-ash-bow':scene_failures.append('bow gift is not an accepted Juno-to-Copper rack event')
        if scene['weapons']['juno-ash-bow']['location']!='saddle' or scene['weapons']['juno-ash-bow']['rackMountId']!='copper':scene_failures.append('gifted bow has no Copper saddle location')
        if scene['juno']['mounted']:scene_failures.append('bow giver should be on foot')
        if .3<=age<=.95 and not any(c['actorId']=='juno' and c['kind']=='give-bow' and c['side']=='L' for c in snapshot['contacts']):scene_failures.append('healthy hand does not contact the rack during handoff')
    if case=='windlesson':
        lesson=next((event for event in scene['presentation']['events'] if event['kind']=='wind-lesson'),None)
        if not lesson or lesson['actorId']!='juno' or lesson['targetId']!='wind-ribbon':scene_failures.append('wind lesson does not target the actual ribbon')
        if not scene['juno']['mounted']:scene_failures.append('wind instructor should remain mounted on Bracken')
        if len([c for c in snapshot['contacts'] if c['actorId']=='juno' and c['kind']=='driver-seat'])!=2:scene_failures.append('mounted instructor does not retain both stirrup contacts')
    records.append({'group':group,'context':label,'case':case,'reducedMotion':reduced,'age':age,'image':name,'errors':errors[:],'engineErrors':await page.evaluate('probe.game.errors'),'sceneFailures':scene_failures,'scene':scene,'canvas':await page.evaluate('probe.camera()'),'animation':snapshot,**diagnostic(snapshot)})
    errors.clear()

async def measure(page,label):
    await page.evaluate("probe.setup('busy')")
    await page.wait_for_timeout(150)
    samples=await page.evaluate('''()=>new Promise(resolve=>{let values=[];function sample(){values.push({...probe.game.stats});if(values.length>=60)resolve(values);else requestAnimationFrame(sample)}requestAnimationFrame(sample)})''')
    def stats(key):
        values=sorted(x[key] for x in samples);return {'median':statistics.median(values),'p95':values[math.ceil(len(values)*.95)-1],'max':max(values)}
    return {'context':label,'scene':'injected-busy-two-drivers-two-rear-carcasses-bear','samples':len(samples),'renderMs':stats('renderMs'),'updateMs':stats('updateMs'),'frameMs':stats('frameMs'),'maxQueueItems':max(x['items'] for x in samples)}

def sheets(out,records):
    try:
        from PIL import Image,ImageDraw
    except ImportError:
        return []
    made=[];groups={}
    for r in records:
        if r['group']=='matrix':key=r['context']
        elif r['group']=='facings':key=r['context']+'-eight-facings'
        else:key='timed-'+r['case']
        groups.setdefault(key,[]).append(r)
    for key,rows in groups.items():
        width=320;height=220;columns=4;sheet=Image.new('RGB',(columns*width,math.ceil(len(rows)/columns)*height),'#283d36');draw=ImageDraw.Draw(sheet)
        for i,r in enumerate(rows):
            im=Image.open(out/r['image']).convert('RGB');im.thumbnail((width,height-25));x=(i%columns)*width;y=(i//columns)*height;sheet.paste(im,(x+(width-im.width)//2,y));draw.text((x+5,y+height-23),f"{r['context']} {r['case']} {'R' if r['reducedMotion'] else 'N'} {r['age']:.2f}",fill='#e5dcc1')
        target=key+'-contact.png';sheet.save(out/target);made.append(target)
    return made

async def main(args):
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    if not str(out).startswith('/tmp/'):
        raise SystemExit('Render artifacts must be written beneath /tmp.')
    records=[];performance=[];contexts=[c for c in CONTEXTS if c[1] in args.engines.split(',') and (not args.contexts or c[0] in args.contexts.split(','))];started=time.time()
    async with async_playwright() as pw:
        for label,engine,width,height in contexts:
            browser=await getattr(pw,engine).launch();page=await browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            await page.route('**/__willow_fixture',lambda route:route.fulfill(body=HTML,content_type='text/html'))
            await page.goto(args.url.rstrip('/')+'/__willow_fixture');await page.wait_for_function('!!window.probe')
            modes=[False,True] if not args.normal_only else [False]
            for case in args.cases.split(',') if args.cases else MATRIX_CASES:
                for reduced in modes:
                    for age in [float(value) for value in args.times.split(',')] if args.times else [.65]:await capture(page,out,label,case,reduced,age,records,errors,'matrix')
            if label.endswith('desktop') and not args.skip_contacts:
                for case in [f'{prefix}{i}' for prefix in ('bowfacing','bowmountedfacing','corpsefacing') for i in range(8)]:
                    for reduced in modes:await capture(page,out,label,case,reduced,.65,records,errors,'facings')
                if engine=='webkit':
                    for case in CONTACT_CASES:
                        for reduced in modes:
                            for age in TIMES:await capture(page,out,label,case,reduced,age,records,errors,'timed')
            performance.append(await measure(page,label))
            await browser.close();print(f'{label}: {len(records)} cumulative captures',flush=True)
    source_files=['content/campaign/willow-run.js','src/willow-run-rigs.js','src/willow-run-actors.js','src/willow-run-animation.js','src/willow-run-renderer.js','src/snowbound-renderer.js']
    report={'kind':'isolated-injected-native-render-fixtures','ordinaryPlaythrough':False,'processingProgressInjected':True,'realSafari':False,'sourceHashes':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in source_files},'contexts':contexts,'elapsedSeconds':time.time()-started,'captures':records,'performance':performance}
    report['failures']=[{'context':r['context'],'case':r['case'],'age':r['age'],'errors':r['errors'],'engineErrors':r['engineErrors'],'sceneFailures':r['sceneFailures'],'duplicates':r['duplicateDrawnIds'],'finite':r['finite'],'contactError':r['maxContactError']}for r in records if r['errors'] or r['engineErrors'] or r['sceneFailures'] or r['duplicateDrawnIds'] or not r['finite'] or r['maxContactError']>1.1]
    report['contactSheets']=sheets(out,records)
    (out/'report.json').write_text(json.dumps(report,indent=2))
    imgs=''.join(f'<figure><a href="{html.escape(r["image"])}"><img src="{html.escape(r["image"])}" loading="lazy"></a><figcaption>{html.escape(r["context"]+" / "+r["case"])} / {"reduced" if r["reducedMotion"] else "normal"} / {r["age"]:.2f}s</figcaption></figure>'for r in records)
    (out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width"><title>Willow isolated native render fixtures</title><style>body{background:#253b32;color:#dfd7b9;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px}figure{margin:0}img{width:100%}</style><h1>Injected native renderer fixtures</h1><p>These scenes inspect renderer contacts. They are not ordinary mission playthroughs, legal save fixtures, or real Safari tests.</p><a href="report.json">Full diagnostics and sampled performance</a><main>'+imgs+'</main>')
    print(json.dumps({'output':str(out),'captures':len(records),'failures':report['failures'],'performance':performance},indent=2))
    return bool(report['failures'])

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:4173');parser.add_argument('--output',default='/tmp/dust-mercy-hunt-native-render');parser.add_argument('--engines',default='chromium,webkit,firefox');parser.add_argument('--contexts',default='');parser.add_argument('--cases',default='');parser.add_argument('--times',default='',help='Comma-separated clip ages for the selected matrix cases; default 0.65 seconds.');parser.add_argument('--normal-only',action='store_true');parser.add_argument('--skip-contacts',action='store_true');args=parser.parse_args();raise SystemExit(asyncio.run(main(args)))
