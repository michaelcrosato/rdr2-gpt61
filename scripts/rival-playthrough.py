#!/usr/bin/env python3
"""Public keyboard/mouse The Names They Took continuation.

Imports an actual ordinary-menu Save through the visible file chooser. Browser
JavaScript reads only camera/render projection, UI and ordinary-menu Save bytes.
No game API/simulation calls, injected Saves, runtime writes or teleports. Aiming
is geometry-guided automation and still requires real projectile/rope collision;
it is not freehand recognition, native touch, real controller or iOS evidence.
"""
import argparse
import asyncio
import copy
import hashlib
import json
import math
import os
import traceback
import subprocess
from collections import deque
from pathlib import Path
from campaign_save import observed_save_bytes, wait_for_save_commit

os.environ.setdefault("PLAYWRIGHT_HOST_PLATFORM_OVERRIDE", "ubuntu24.04-x64")
from playwright.async_api import async_playwright

OPENING = "snowbound-the-last-warm-light"
RESCUE = "snowbound-a-voice-under-ice"
HUNT = "snowbound-a-quiet-table"
RIVAL = "snowbound-the-names-they-took"


def view(raw):
    """Pure local aliases over an independently copied observed graph."""
    result = copy.deepcopy(raw)
    active = result["campaign"]["missions"][result["campaign"]["activeMissionId"]]
    result["player"] = result["entities"][result["party"]["playerId"]]
    result["horse"] = result["entities"][result["party"]["mountId"]]
    for key in ("mission", "flags", "timers", "performance", "rival", "scope", "focus", "rope", "captivity", "transactions", "choices"):
        if key in active:
            result[key] = active[key]
    return result


def freeze_hunt_after_rival_activation(before, after):
    """Observe lawful pre-invitation footprint aging without rewriting any Save.

    The completed Hunt remains the active world during the physical approach to
    the Rival invitation. Only its existing footprint ages may advance then;
    after Rival activates, preserve that actually observed Hunt record exactly.
    """
    assert after['campaign']['activeMissionId']==RIVAL
    old=before['campaign']['missions'][HUNT]
    actual=after['campaign']['missions'][HUNT]
    compared=copy.deepcopy(actual)
    budget=after['elapsed']-before['elapsed']
    assert math.isfinite(budget) and budget>=0
    old_samples=old['tracks']['samples'];new_samples=compared['tracks']['samples']
    assert old_samples.keys()==new_samples.keys(),'Pre-Rival approach changed Hunt track identities'
    deltas=[]
    for identity, samples in old_samples.items():
        assert len(samples)==len(new_samples[identity]),'Pre-Rival approach changed Hunt sample count'
        for prior, observed in zip(samples,new_samples[identity]):
            assert 'age' in prior and 'age' in observed
            delta=observed['age']-prior['age']
            assert math.isfinite(delta) and 0<=delta<=budget+1e-6,'Hunt footprint age did not follow actual accepted elapsed time'
            deltas.append(delta)
            observed['age']=prior['age']  # Local comparison copy only.
    assert not deltas or max(deltas)-min(deltas)<1e-6,'Existing Hunt tracks aged on different clocks'
    assert compared==old,'Pre-Rival approach changed unrelated completed Hunt history'
    return copy.deepcopy(actual),{'sampleCount':len(deltas),'ageAdvance':deltas[0] if deltas else 0,'elapsedBefore':before['elapsed'],'elapsedAtActivation':after['elapsed'],'onlyNaturalFootprintAgesChanged':True}


def observed_hostiles(snapshot, population):
    """Current observed bodies, including the genuinely returned hostile Pavel."""
    returned=snapshot['rival'].get('pavelReturned',False)
    return [a for a in snapshot['entities'].values()
            if a.get('regionId')=='bellwether-works' and a.get('hp',0)>0
            and not a.get('surrendered') and not a.get('escaped')
            and ((population=='yard' and (a.get('wave')=='yard' or a['id']=='pavel' and returned))
                 or population=='patrol' and a.get('wave') in ['west','east','reserve'])]


def observed_firing_threats(snapshot, horizon=1.2):
    """Read activation/timer/live-round authority, never blueprint ammunition."""
    stage=snapshot['mission']['stage']
    if stage not in [5,7]:return []
    opening=snapshot['rival'].get('yardOpening')
    if stage==5 and opening and opening.get('firedAt') is None:return []
    threats=[]
    for actor in observed_hostiles(snapshot,'yard' if stage==5 else 'patrol'):
        if not actor.get('active'):continue
        if actor.get('wave')=='reserve' and snapshot['timers']['patrol']<12:continue
        if actor.get('hp',0)<18 and actor.get('role') in ['runner','surrender-capable']:continue
        custody=snapshot['rival'].get('weaponCustody') or {}
        if actor['id']=='bellwether-revolver-thief' and custody.get('phase') in ['disarming','pursuing','grappling','dropped']:continue
        registered=snapshot['weapons'].get(actor.get('equippedWeaponId'))
        if registered and registered.get('owner')==actor['id'] and registered.get('location')=='carried':
            weapon,stock=registered,registered
        elif actor.get('weapon') and not actor['weapon'].get('registryOwned') and not actor.get('gunDisarmed'):
            weapon,stock=actor['weapon'],actor
        else:continue
        ammo=stock.get('ammo',0);reserve=stock.get('reserve',0)
        if ammo<=0 and reserve<=0:continue
        delay=max(actor.get('fireTimer',0),actor.get('reloadTimer',0))
        if ammo<=0:delay=max(delay,3)
        if delay>horizon:continue
        targets=[snapshot['entities'][key] for key in ['mara','tomas','ruth','bastian'] if snapshot['entities'].get(key,{}).get('hp',0)>0]
        targets=[a for a in targets if math.hypot(actor['x']-a['x'],actor['y']-a['y'])<650]
        if not targets:continue
        target=min(targets,key=lambda a:math.hypot(actor['x']-a['x'],actor['y']-a['y']))
        threats.append({'actor':actor,'delay':delay,'ammo':ammo,'reserve':reserve,'weaponId':weapon['id'],'currentTargetId':target['id'],'weight':1/(.25+delay)})
    return threats


def cover_ray_clear(region, source, target):
    """Read-only owning four-unit world ray sampling; actors are not shields."""
    length=math.hypot(target['x']-source['x'],target['y']-source['y'])
    steps=max(1,math.ceil(length/4))
    for step in range(1,steps+1):
        t=step/steps;x=source['x']+(target['x']-source['x'])*t;y=source['y']+(target['y']-source['y'])*t;z=source['z']+(target['z']-source['z'])*t
        if any(not o.get('impassable') and o['x']-1+1e-7<x<o['x']+o['w']+1-1e-7 and o['y']-1+1e-7<y<o['y']+o['h']+1-1e-7 and z<=o.get('z',0)+(o.get('height') or 35) for o in region['obstacles']):return False
    return True


def cover_ground_clear(region, source, target, radius=13):
    length=math.hypot(target['x']-source['x'],target['y']-source['y'])
    for step in range(1,max(1,math.ceil(length/3))+1):
        t=step/max(1,math.ceil(length/3));x=source['x']+(target['x']-source['x'])*t;y=source['y']+(target['y']-source['y'])*t
        if not radius<x<region['width']-radius or not radius<y<region['height']-radius:return False
        if any(o['x']-radius<x<o['x']+o['w']+radius and o['y']-radius<y<o['y']+o['h']+radius for o in region['obstacles']):return False
    return True


def observed_reload_cover(snapshot, region):
    """Choose a physical protected stance and ordered cardinal route to it."""
    p=snapshot['player'];threats=observed_firing_threats(snapshot,2.5)
    if not threats:return None
    candidates=[]
    for obstacle in region['obstacles']:
        if not obstacle.get('projectileCover') or obstacle.get('height',0)<30:continue
        x,y,w,h=obstacle['x'],obstacle['y'],obstacle['w'],obstacle['h']
        for px,py in [(x+w/2,y-20),(x+w/2,y+h+20),(x-20,y+h/2),(x+w+20,y+h/2)]:
            if math.hypot(px-p['x'],py-p['y'])>250:continue
            z=next((zone['z'] for zone in region.get('elevationZones',[]) if zone['x']<px<zone['x']+zone['w'] and zone['y']<py<zone['y']+zone['h']),0)
            if abs(z-p.get('z',0))>8:continue
            dest={'x':px,'y':py,'z':z};body={**dest,'z':z+28}
            blocked=[t for t in threats if not cover_ray_clear(region,{**t['actor'],'z':t['actor'].get('z',0)+32},body)]
            if not blocked:continue
            for corner in [{'x':px,'y':p['y']},{'x':p['x'],'y':py}]:
                if not cover_ground_clear(region,p,corner) or not cover_ground_clear(region,corner,dest):continue
                route=[corner,dest];length=math.hypot(corner['x']-p['x'],corner['y']-p['y'])+math.hypot(px-corner['x'],py-corner['y'])
                first=corner if math.hypot(corner['x']-p['x'],corner['y']-p['y'])>1 else dest
                dx,dy=first['x']-p['x'],first['y']-p['y'];move_length=max(1,math.hypot(dx,dy))
                lateral=sum(t['weight']*abs((t['actor']['x']-p['x'])*dy-(t['actor']['y']-p['y'])*dx)/(max(1,math.hypot(t['actor']['x']-p['x'],t['actor']['y']-p['y']))*move_length) for t in threats)
                score=sum(t['weight'] for t in blocked)*20+lateral*4-length*.04
                candidates.append({'score':score,'coverId':obstacle['id'],'destination':dest,'route':route,'blockedThreatIds':[t['actor']['id'] for t in blocked],'threatIds':[t['actor']['id'] for t in threats]})
    return max(candidates,key=lambda x:x['score']) if candidates else None


def observed_dodge_plan(snapshot, region, milliseconds, fallback):
    if not math.isfinite(milliseconds) or milliseconds<=0:return None
    p=snapshot['player'];threats=observed_firing_threats(snapshot,max(1.2,milliseconds/1000+.4))
    if not threats:threats=[{'actor':fallback,'weight':1,'delay':fallback.get('fireTimer',0)}]
    total=sum(t['weight'] for t in threats)
    sprint=p['stamina']>1.5+8*milliseconds/1000;speed=160 if sprint else 105;travel=speed*milliseconds/1000
    options=[]
    for ux,uy in [(1,0),(-1,0),(0,1),(0,-1)]:
        clear=0
        for step in range(1,math.ceil(travel/4)+1):
            moved=min(travel,step*4);dest={'x':p['x']+ux*moved,'y':p['y']+uy*moved}
            if not cover_ground_clear(region,p,dest):break
            clear=moved
        perpendicular=away=blocked=0
        destination={'x':p['x']+ux*clear,'y':p['y']+uy*clear,'z':p.get('z',0)+28}
        for t in threats:
            a=t['actor'];dx=a['x']-p['x'];dy=a['y']-p['y'];distance=max(1,math.hypot(dx,dy));weight=t['weight']
            perpendicular+=weight*abs(dx*uy-dy*ux)/distance;away-=weight*(dx*ux+dy*uy)/distance
            if not cover_ray_clear(region,{**a,'z':a.get('z',0)+32},destination):blocked+=weight
        options.append({'score':clear/max(1,travel)*4+perpendicular/total*4+blocked/total*5+away/total*.25,'clear':clear,'worldVector':[ux,uy]})
    best=max(options,key=lambda x:x['score'])
    if best['clear']<=min(8,max(1.5,travel*.5)):return None
    return {**best,'sprint':sprint,'milliseconds':min(milliseconds,max(45,(best['clear']-2)/speed*1000)),'threatIds':[t['actor']['id'] for t in threats],'threatDelays':[t['delay'] for t in threats]}


async def public_covered_reload(label, *, page, save, observe, hold, report, world):
    plan=None;route=[];moves=[];requested=False
    for step in range(50):
        snapshot=await save(f'{label}-cover-{step:02d}',resume_wait=0,resume=False)
        p=snapshot['player'];gun=snapshot['weapons'][p['equippedWeaponId']]
        if gun['ammo']==0 and gun['reserve']<=0:
            await page.locator('[data-command="resume"]').click();return False
        threats=observed_firing_threats(snapshot,2.5)
        safe=all(not cover_ray_clear(world,{**t['actor'],'z':t['actor'].get('z',0)+32},{**p,'z':p.get('z',0)+28}) for t in threats)
        if plan is None:
            plan=observed_reload_cover(snapshot,world)
            if plan is None:
                await page.locator('[data-command="resume"]').click();return False
            route=[dict(node) for node in plan['route']]
        else:
            destination=plan['destination']
            remains_safe=all(not cover_ray_clear(world,{**t['actor'],'z':t['actor'].get('z',0)+32},{**destination,'z':destination.get('z',0)+28}) for t in threats)
            if not remains_safe:
                revised=observed_reload_cover(snapshot,world)
                if revised:
                    plan=revised;route=[dict(node) for node in plan['route']]
        while route and math.hypot(route[0]['x']-p['x'],route[0]['y']-p['y'])<7:route.pop(0)
        if not route and gun['ammo']>0 and not p['reloadTimer']:
            receipt={'cover':plan,'actual':{'x':p['x'],'y':p['y'],'hp':p['hp'],'stamina':p['stamina'],'weaponId':gun['id'],'ammo':gun['ammo'],'reserve':gun['reserve']},'currentThreatIds':[t['actor']['id'] for t in threats],'allCurrentFiringLinesBlocked':safe,'movement':moves,'actualReloadRequested':requested}
            report.setdefault('publicCoveredReloads',[]).append(receipt)
            await page.locator('[data-command="resume"]').click();return safe or not threats
        if route:
            target=route[0]
            if not cover_ground_clear(world,p,target):
                await page.locator('[data-command="resume"]').click();return False
            dx,dy=target['x']-p['x'],target['y']-p['y'];horizontal=abs(dx)>abs(dy)
            key=('d' if dx>0 else 'a') if horizontal else ('s' if dy>0 else 'w')
            duration=min(220,max(45,(abs(dx) if horizontal else abs(dy))/105*1000))
            sprint=p['stamina']>1.5+8*duration/1000
            if sprint:duration=min(220,max(45,(abs(dx) if horizontal else abs(dy))/160*1000))
            keys=(['Shift'] if sprint else [])+[key]
        else:
            if not safe:
                await page.locator('[data-command="resume"]').click();return False
            keys=[];duration=min(180,max(45,p['reloadTimer']*1000+20))
        if not p['reloadTimer'] and gun['ammo']==0:
            keys+=['r'];requested=True
        focus=p['focus']>2
        await page.locator('[data-command="resume"]').click()
        if focus:await page.keyboard.down('Space')
        before=await observe();await hold(keys,duration,after=0);after=await observe()
        if focus:await page.keyboard.up('Space')
        moves.append({'keys':keys,'milliseconds':duration,'start':{'x':before['x'],'y':before['y']},'end':{'x':after['x'],'y':after['y']},'threatIds':[t['actor']['id'] for t in threats]})
    raise AssertionError('Physical covered reload did not finish through bounded public controls')


async def run(args):
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    geometry = json.loads(subprocess.check_output([
        'node','--input-type=module','-e',
        "import * as B from './content/campaign/bellwether-works.js';import {QUARRY_POCKET_OBJECTS as P} from './content/campaign/quarry-papers.js';import {SNOWBOUND_WORLD as S} from './content/campaign/snowbound.js';import {NORTH_CUTTING_WORLD as N} from './content/campaign/north-cutting.js';import {WILLOW_RUN_WORLD as H} from './content/campaign/willow-run.js';console.log(JSON.stringify({world:B.RIVAL_WORLD,party:B.RIVAL_PARTY,enemies:B.RIVAL_ENEMIES,papers:P,dialogue:B.RIVAL_DIALOGUE,carbine:B.RIVAL_CARBINE.id,snowbound:{...S,obstacles:[...S.obstacles,...N.camp.obstacles,...H.camp.obstacles,...B.RIVAL_WORLD.camp.obstacles]}}))"
    ],cwd=Path(__file__).resolve().parent.parent,text=True))
    world, party = geometry['world'], geometry['party']
    repo=Path(__file__).resolve().parent.parent
    source_files=['index.html','styles.css','my-3d2dge-agent.js','scripts/campaign_save.py']+[str(path.relative_to(repo)) for folder in ['src','content'] for path in sorted((repo/folder).rglob('*.js'))]
    source_hashes=lambda:{name:hashlib.sha256((repo/name).read_bytes()).hexdigest() for name in source_files}
    initial_hashes=source_hashes()
    driver_bytes=Path(__file__).read_bytes()
    driver_hash=hashlib.sha256(driver_bytes).hexdigest()
    (output/'public-driver.py').write_bytes(driver_bytes)
    (output/'observed-save-reader.py').write_bytes((repo/'scripts/campaign_save.py').read_bytes())
    errors, events = [], []
    source_bytes = args.source_save.read_bytes()
    report = {
        "passed": False, "browser": args.engine, "url": args.url,
        "sourceSave": str(args.source_save.resolve()),
        "sourceSHA256": hashlib.sha256(source_bytes).hexdigest(),
        "sourceVersion": json.loads(source_bytes)["version"],
        "startMode": "Visible Import save file menu and browser file chooser",
        "inputMode": "Public keyboard/mouse movement, proximity actions, choices, physical mouse aiming and lariat",
        "caveat": "Imported actual authored-game continuation. Read-only observed geometry guides automation; no fresh connected full journey, freehand visual recognition, physical controller/native touch or real iOS claim.",
        "artifactScope": "Partial continuation from a genuine public field Save" if args.continue_field or args.continue_chase else "Full genuine imported completed-Rescue/Hunt continuation to Rival completion/reload",
        "firstShot": args.first_shot, "tactics": args.tactics, "capture": args.capture,
        "treatment": args.treatment, "capSearch":args.cap_search, "useOwnedQuietRation":args.use_quiet_ration, "rationTiming":args.ration_timing, "sourceHashesAtStart": initial_hashes,
        "driverSHA256AtStart":driver_hash, "driverSourceArtifact":"public-driver.py", "saveReaderSourceArtifact":"observed-save-reader.py",
        "events": events, "errors": errors,
    }
    async with async_playwright() as playwright:
        browser = await getattr(playwright, args.engine).launch(headless=True)
        page = await browser.new_page(viewport={"width":1440,"height":1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type=="error" else None)

        async def observe():
            return await page.evaluate("""() => {
              const g=My3D2dge.current;
              return {x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by,z:g.cam.tz,
                stage:document.querySelector('#mission-count').textContent,
                mission:document.querySelector('#mission-name').textContent,
                objective:document.querySelector('#objective-text').textContent,
                interaction:document.querySelector('#interact').hidden?null:document.querySelector('#interaction-label').textContent,
                dialog:document.querySelector('#conversation').open,speaker:document.querySelector('#speaker').textContent,dialogueText:document.querySelector('#dialogue-text').textContent,
                choices:[...document.querySelectorAll('[data-choice]')].map(el=>el.dataset.choice),
                notices:document.querySelector('#notices').textContent,engineErrors:g.errors};
            }""")

        async def hold(keys, milliseconds=65, after=55):
            for key in keys:
                await page.keyboard.down(key)
            await page.wait_for_timeout(milliseconds)
            for key in keys:
                await page.keyboard.up(key)
            await page.wait_for_timeout(after)

        async def choose(identifier="leave"):
            observed=await observe()
            if observed['dialog']:
                report.setdefault('publicDialogueReceipts',[]).append({'speaker':observed['speaker'],'text':observed['dialogueText'],'offeredChoices':observed['choices'],'chosen':identifier})
            await page.locator(f'[data-choice="{identifier}"]').click(timeout=15000)
            await page.wait_for_timeout(110)

        async def action(identifier):
            # A visible nearby-actions menu preserves the actual offered verb.
            await page.locator('[data-story-action="nearby-actions"]').click()
            await page.locator(f'[data-command="nearby"][data-id="{identifier}"]').click(timeout=5000)
            await page.wait_for_timeout(110)

        async def wait_action(identifier,label,seconds=30):
            for attempt in range(math.ceil(seconds/.45)):
                assert not (await observe())['dialog'],f'Unexpected modal while waiting for {identifier}'
                await page.locator('[data-story-action="nearby-actions"]').click()
                command=page.locator(f'[data-command="nearby"][data-id="{identifier}"]')
                if await command.count():
                    await command.click();await page.wait_for_timeout(110);return
                await page.locator('#close-panel').click();await page.wait_for_timeout(450)
            raise AssertionError(f'Actual offered action never became available: {label} ({identifier})')

        async def dialogue(label,key=None):
            observed=await observe();assert observed['dialog'],f'No actual displayed exchange for {label}'
            if key:
                definition=geometry['dialogue'][key]
                assert observed['speaker']==definition['speaker'] and observed['dialogueText']==definition['text'],f'Wrong actual speaker/text for {key}'
            await page.screenshot(path=str(output/f'{label}.png'))
            report.setdefault('publicDisplayedExchanges',[]).append({'label':label,'expectedLine':key,'speaker':observed['speaker'],'text':observed['dialogueText'],'choices':observed['choices'],'screenshot':f'{label}.png'})
            return observed

        async def wait_dialog(label,seconds=90):
            for _ in range(math.ceil(seconds/.2)):
                observed=await observe()
                if observed['dialog']:
                    assert observed['choices']!=['retry','restart'],observed
                    return observed
                await page.wait_for_timeout(200)
            raise AssertionError(f'Actual speakers did not open {label}')

        async def interact(expected=None):
            if expected:
                await page.wait_for_function("text=>!document.querySelector('#interact').hidden&&document.querySelector('#interaction-label').textContent.toLowerCase().includes(text)",arg=expected.lower(),timeout=6000)
            await hold(["e"]);await page.wait_for_timeout(110)

        async def save(label, allow_dialog=False, resume_wait=55, resume=True):
            observed=await observe()
            assert allow_dialog or not observed["dialog"],observed
            if not observed["dialog"]:
                await hold(["Escape"])
            else:
                await page.locator('[data-panel="menu"]').click()
            current=await observe()
            if current['dialog'] and set(current['choices'])=={'retry','restart'}:
                raise AssertionError(f"Public mission failure before Save: {current['notices']}")
            await page.locator('[data-command="save"]').click()
            save_status=page.locator('#save-status')
            request=await save_status.get_attribute('data-save-request')
            # The shared reader waits on committed authority; additionally pin
            # this driver's exact manual request instead of accepting a later
            # automatic Save acknowledgement.
            try:
                acknowledged=await wait_for_save_commit(page,expected_commit=request)
            except Exception as error:
                raise AssertionError(f'Normal Save request {request} did not commit: {await save_status.inner_text()} ({error})') from error
            status=await save_status.inner_text()
            assert status=='Journey saved on this device.',f'Normal Save did not report success: {status}'
            commit=await save_status.get_attribute('data-save-commit')
            current_request=await save_status.get_attribute('data-save-request')
            assert request is None or current_request==request and commit==request and acknowledged==request,f'Normal Save read an unrelated commit: requested {request}, current {current_request}, committed {commit}, acknowledged {acknowledged}'
            raw=await observed_save_bytes(page,expected_commit=request)
            (output/f"{label}.json").write_text(raw)
            snapshot=view(json.loads(raw))
            paused=await observe()
            expected_stage='COMPLETE' if snapshot['mission']['completed'] else f'{snapshot["mission"]["stage"]+1:02d} / {snapshot["mission"]["stageCount"]:02d}'
            assert paused['mission']==snapshot['mission']['name'] and paused['stage']==expected_stage,f'Save does not match paused mission/stage: {label}'
            camera_body=snapshot['scope']['camera'] if snapshot.get('scope',{}).get('raised') else snapshot['player']
            assert math.hypot(paused['x']-camera_body['x'],paused['y']-camera_body['y'])<.25,f'Save does not match paused body/scope coordinates: {label}'
            report.setdefault('publicSaveReceipts',[]).append({'label':label,'status':status,'stage':paused['stage'],'pausedUIAndSaveAgree':True,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'requestId':request,'commitId':commit,'storageBackend':await save_status.get_attribute('data-save-backend')})
            if resume:
                await page.locator('[data-command="resume"]').click()
                await page.wait_for_timeout(resume_wait)
            assert not snapshot["failure"],snapshot["failure"]
            return snapshot

        async def record(label):
            observed={"label":label,**await observe(),"screenshot":f"{label}.png"}
            if observed['stage']=='11 / 14':
                observed['screenshot']=None
                observed['captureNote']='Critical active pursuit: no screenshot delay; ordinary-menu Save is the receipt.'
            else:
                await page.screenshot(path=str(output/observed["screenshot"]))
            events.append(observed);print(json.dumps(observed),flush=True)

        async def walk(route,speed=90,tolerance=9,crouch=False,stop_at_chase=False):
            for target_x,target_y in route:
                stuck=0
                for _ in range(220):
                    before=await observe();assert not before["dialog"],before
                    if stop_at_chase and before['stage']=='11 / 14':return
                    dx,dy=target_x-before["x"],target_y-before["y"]
                    if math.hypot(dx,dy)<tolerance:
                        break
                    horizontal=abs(dx)>abs(dy)
                    key=("d" if dx>0 else "a") if horizontal else ("s" if dy>0 else "w")
                    amount=abs(dx) if horizontal else abs(dy)
                    await hold((["c"] if crouch else [])+[key],min(450,max(45,amount/speed*1000)))
                    after=await observe()
                    stuck=stuck+1 if math.hypot(after["x"]-before["x"],after["y"]-before["y"])<.5 else 0
                    if stuck>=2:
                        other=target_y-after["y"] if horizontal else target_x-after["x"]
                        if abs(other)>tolerance:
                            alternate=("s" if other>0 else "w") if horizontal else ("d" if other>0 else "a")
                            await hold((["c"] if crouch else [])+[alternate],min(160,max(45,abs(other)/speed*1000)))
                            shifted=await observe()
                            if math.hypot(shifted["x"]-after["x"],shifted["y"]-after["y"])>.5:stuck=0
                    if stuck>=5:raise AssertionError(f"Actual route blocked toward {target_x},{target_y}: {after}")
                else:raise AssertionError(f"Actual route did not reach {target_x},{target_y}: {await observe()}")

        async def aim(target):
            pointer=await page.evaluate("""target=>{const g=My3D2dge.current,p=g.r.w(target.x,target.y,target.z),b=document.querySelector('#screen').getBoundingClientRect(),s=g.screen;return {x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr};}""",target)
            assert 0<pointer["x"]<1440 and 0<pointer["y"]<1000,pointer
            await page.mouse.move(pointer["x"],pointer["y"])
            return pointer

        async def scope_aim(target):
            # Pan the held tool through normal keys. Mara stays at the ridge;
            # camera observations are never substituted for her body position.
            for attempt in range(30):
                pointer=await page.evaluate("""target=>{const g=My3D2dge.current,p=g.r.w(target.x,target.y,0),b=document.querySelector('#screen').getBoundingClientRect(),s=g.screen;return {x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr,lens:((p[0]-g.r.bw/2)/Math.min(g.r.bw*.43,230))**2+((p[1]-g.r.bh/2)/Math.min(g.r.bh*.4,145))**2};}""",target)
                if 35<pointer['x']<1405 and 75<pointer['y']<925 and pointer['lens']<.65:
                    await page.mouse.move(pointer['x'],pointer['y']);await page.wait_for_timeout(1100);return
                snapshot=await save(f'04-pan-{attempt:02d}-{int(target["x"])}')
                center=snapshot['scope']['camera'];dx,dy=target['x']-center['x'],target['y']-center['y']
                key=('d' if dx>0 else 'a') if abs(dx)>abs(dy) else ('s' if dy>0 else 'w')
                await hold([key],min(700,max(90,max(abs(dx),abs(dy))/180*1000)))
                await page.wait_for_timeout(180)
            raise AssertionError(f'Public scope panning did not expose {target}')

        async def scope_witness(event,actor_ids):
            for attempt in range(80):
                snapshot=await save(f'04-witness-{event}-{attempt:02d}')
                if any(receipt['id']==event for receipt in snapshot['rival'].get('reconWitness',{}).get('receipts',[])):return snapshot
                actors=[snapshot['entities'][identifier] for identifier in actor_ids]
                target={'x':sum(a['x'] for a in actors)/len(actors),'y':sum(a['y'] for a in actors)/len(actors),'z':0}
                await scope_aim(target)
                visible=await page.evaluate("""actors=>{const g=My3D2dge.current,rx=Math.min(g.r.bw*.43,230),ry=Math.min(g.r.bh*.4,145);return actors.map(a=>{const p=g.r.w(a.x,a.y,(a.z||0)+(a.kind==='horse'?25:a.mounted?65:30));return {id:a.id,lens:((p[0]-g.r.bw/2)/rx)**2+((p[1]-g.r.bh/2)/ry)**2};});}""",actors)
                report.setdefault('publicReconFrames',[]).append({'event':event,'attempt':attempt,'projectedActors':visible,'aim':target})
                await page.screenshot(path=str(output/f'04-witness-{event}-{attempt:02d}.png'))
            raise AssertionError(f'The actual held lens never witnessed {event}')

        async def wait_camera_player():
            # The ordinary pause menu keeps the simulation paused while the
            # render camera finishes its visible follow motion. No camera or
            # runtime writes are evaluated.
            await save('04-lowered-camera-body',resume=False)
            for _ in range(30):
                settled=await page.evaluate("() => {const c=My3D2dge.current.cam;return c.moving!==true&&Math.hypot(c.vx||0,c.vy||0)<.8;}")
                if settled:
                    await page.locator('[data-command="resume"]').click()
                    await page.wait_for_timeout(20)
                    return
                await page.wait_for_timeout(120)
            raise AssertionError('Camera did not return to Mara after lowering the sightglass')

        async def equip(identifier):
            await page.locator('[data-panel="satchel"]').click()
            await page.locator(f'[data-command="equipment"][data-id="equip:{identifier}"]').click()
            await page.locator('#close-panel').click()

        async def use_owned_quiet_ration(expected_history):
            label='07-owned-ration' if args.ration_timing=='after-yard' else '08-reload-ration' if args.ration_timing=='reload-danger' else '08-owned-ration'
            before=await save(label+'-before')
            hunt_before=before['campaign']['missions'][HUNT]
            assert hunt_before==expected_history,'Completed Hunt changed after Rival activation and before the actual ration use'
            transaction_id=f'{HUNT}:use:quiet-ration'
            assert hunt_before['mission']['completed'] and before['inventory'].get('quietRation',0)==1
            assert not hunt_before['flags']['rationUsed'] and transaction_id not in hunt_before['transactions']
            assert 0<before['player']['hp']<100,'Owned ration proof requires an actual living wounded Mara'
            await page.locator('[data-panel="satchel"]').click()
            button=page.locator('[data-command="use"][data-id="quietRation"]')
            await button.scroll_into_view_if_needed()
            ui_before=None
            if args.ration_timing=='reload-danger':
                await page.wait_for_timeout(150)
                ui_before={'health':int(await page.locator('#health-ring').get_attribute('aria-valuenow')),'stamina':int(await page.locator('#stamina-ring').get_attribute('aria-valuenow'))}
            await page.screenshot(path=str(output/(label+'-offered.png')))
            await button.click();await page.wait_for_timeout(110)
            if ui_before is not None:
                # The actual Use action commits while this real satchel modal
                # pauses the battle. Read its exact native stored bytes, not a
                # game API or a manufactured pre/post health value.
                request=await page.locator('#save-status').get_attribute('data-save-request')
                committed=await wait_for_save_commit(page,expected_commit=request)
                assert committed==request
                raw=await observed_save_bytes(page,expected_commit=request);(output/(label+'-after.json')).write_text(raw)
                after=view(json.loads(raw))
                ui_after={'health':int(await page.locator('#health-ring').get_attribute('aria-valuenow')),'stamina':int(await page.locator('#stamina-ring').get_attribute('aria-valuenow'))}
                assert ui_after['health']==min(100,ui_before['health']+8) and ui_after['stamina']==min(100,ui_before['stamina']+70)
                assert after['player']['hp']==ui_after['health'] and math.floor(after['player']['stamina']+.5)==ui_after['stamina']
                report.setdefault('publicItemCommitReceipts',[]).append({'label':label,'mode':'Actual Use-action automatic commit while paused in satchel','requestId':request,'commitId':committed,'sha256':hashlib.sha256(raw.encode()).hexdigest(),'uiVitalsBefore':ui_before,'uiVitalsAfter':ui_after})
                await page.locator('#close-panel').click()
            else:
                await page.locator('#close-panel').click()
                after=await save(label+'-after')
            hunt_after=after['campaign']['missions'][HUNT]
            assert after['inventory'].get('quietRation',0)==0
            assert after['player']['hp']==min(100,(ui_before['health'] if ui_before else before['player']['hp'])+8)
            elapsed=after['elapsed']-before['elapsed']
            assert elapsed>=0 and not before['player']['carrying'] and not after['player']['carrying']
            expected_stamina=min(100,before['player']['stamina']+70+5*elapsed)
            assert abs(after['player']['stamina']-expected_stamina)<1e-5,'Owned ration stamina did not match its capped gain plus actual idle recovery'
            assert after['performance']['healingUses']==before['performance']['healingUses']+1 and not after['performance']['noHealingItems']
            assert hunt_after['flags']['rationUsed'] and hunt_after['transactions'][transaction_id]['completed']
            expected=copy.deepcopy(hunt_before)
            expected['flags']['rationUsed']=True
            expected['transactions'][transaction_id]=hunt_after['transactions'][transaction_id]
            assert hunt_after==expected,'Owned ration changed unrelated completed Hunt history'
            report['publicOwnedQuietRation']={'item':'quietRation','timing':args.ration_timing,'countBefore':1,'countAfter':0,'healthBefore':ui_before['health'] if ui_before else before['player']['hp'],'healthBeforeManualSave':before['player']['hp'],'healthAfter':after['player']['hp'],'staminaBefore':before['player']['stamina'],'staminaAfter':after['player']['stamina'],'acceptedIdleSeconds':elapsed,'idleRecovery':5*elapsed,'cappedStaminaExpected':expected_stamina,'huntTransactionId':transaction_id,'huntTransaction':hunt_after['transactions'][transaction_id],'huntRationUsedBefore':False,'huntRationUsedAfter':True,'rivalHealingUsesBefore':before['performance']['healingUses'],'rivalHealingUsesAfter':after['performance']['healingUses'],'noHealingItemsAfter':False,'screenshot':label+'-offered.png','saveBefore':label+'-before.json','saveAfter':label+'-after.json'}
            if ui_before is not None:report['publicOwnedQuietRation']['pausedUIVitalsBefore']=ui_before
            return copy.deepcopy(hunt_after)

        async def wait_predicate(label,predicate,seconds=40):
            for attempt in range(math.ceil(seconds/.6)):
                observed=await observe()
                if observed['dialog']:
                    assert observed['choices']==['leave'],f'Unexpected decision while waiting for {label}: {observed}'
                    await choose()
                snapshot=await save(f'{label}-{attempt:02d}')
                if predicate(snapshot):return snapshot
                await page.wait_for_timeout(450)
            raise AssertionError(f'Physical state did not reach {label}')

        def solid(region,x,y,radius=10):
            return x<radius or y<radius or x>region['width']-radius or y>region['height']-radius or any(
                obstacle['x']-radius<x<obstacle['x']+obstacle['w']+radius and obstacle['y']-radius<y<obstacle['y']+obstacle['h']+radius
                for obstacle in region['obstacles'])

        def ground_clear(start,end,radius=1):
            steps=max(1,math.ceil(math.hypot(end['x']-start['x'],end['y']-start['y'])/4))
            return all(not solid(world,start['x']+(end['x']-start['x'])*step/steps,start['y']+(end['y']-start['y'])*step/steps,radius) for step in range(1,steps+1))

        chase_grid=None
        def chase_path(start,target):
            # Pure radius-13 geometry; no NPC navigation or simulation call.
            nonlocal chase_grid
            if ground_clear(start,target,13):return [dict(target)]
            size=20;cols=math.ceil(world['width']/size);rows=math.ceil(world['height']/size)
            point=lambda identifier:{'x':identifier%cols*size+10,'y':identifier//cols*size+10}
            if chase_grid is None:chase_grid=[not solid(world,point(i)['x'],point(i)['y'],13) for i in range(cols*rows)]
            def closest(value):
                column=max(0,min(cols-1,math.floor(value['x']/size)));row=max(0,min(rows-1,math.floor(value['y']/size)));identifier=row*cols+column
                if chase_grid[identifier]:return identifier
                candidates=[(dx*dx+dy*dy,(row+dy)*cols+column+dx) for dy in range(-4,5) for dx in range(-4,5) if 0<=column+dx<cols and 0<=row+dy<rows and chase_grid[(row+dy)*cols+column+dx]]
                assert candidates,f'No observed mount navigation cell for {value}'
                return min(candidates)[1]
            first,last=closest(start),closest(target);queue=deque([first]);previous={first:None}
            while queue and last not in previous:
                current=queue.popleft();column=current%cols;row=current//cols
                for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                    if not (0<=column+dx<cols and 0<=row+dy<rows):continue
                    identifier=(row+dy)*cols+column+dx
                    if chase_grid[identifier] and identifier not in previous:previous[identifier]=current;queue.append(identifier)
            assert last in previous,f'No actual mount path to observed chase point {target}'
            nodes=[];identifier=last
            while identifier!=first:nodes.append(point(identifier));identifier=previous[identifier]
            nodes.reverse()
            if ground_clear(nodes[-1] if nodes else start,target,13):nodes.append(dict(target))
            return nodes or [point(last)]

        def prediction_path(snapshot):
            levi=snapshot['entities']['levi'];actor=snapshot['entities']['skein'] if levi.get('mounted') else levi
            points=[{'x':actor['x'],'y':actor['y']}]
            existing=[{'x':p['x'],'y':p['y']} for p in actor.get('route',[]) if math.hypot(p['x']-points[0]['x'],p['y']-points[0]['y'])>1]
            index=snapshot['rival']['leviIndex'];future=world['chase']['route'][index:]
            def append_route(nodes,canonical=None):
                for node in nodes:
                    # Saved route waypoints change at six units; the authored
                    # chase node itself changes at twelve. Prediction must not
                    # spend fictitious time touching every grid-center corner.
                    tolerance=12 if canonical and math.hypot(node['x']-canonical['x'],node['y']-canonical['y'])<1 else 6
                    start=points[-1];length=math.hypot(node['x']-start['x'],node['y']-start['y'])
                    if length<=tolerance:continue
                    points.append({'x':node['x']+(start['x']-node['x'])*tolerance/length,'y':node['y']+(start['y']-node['y'])*tolerance/length})
            if existing:
                matches=bool(future and math.hypot(existing[-1]['x']-future[0]['x'],existing[-1]['y']-future[0]['y'])<1)
                append_route(existing,future[0] if matches else None)
                if matches:future=future[1:]
            total=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(points,points[1:]))
            for node in future:
                if total>260:break
                extra=chase_path(points[-1],node)
                old=len(points);append_route(extra,node)
                total+=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(points[max(0,old-1):],points[old:]))
            return points,175 if levi.get('mounted') else 92

        def future_point(points,speed,seconds):
            remaining=speed*seconds
            for start,end in zip(points,points[1:]):
                length=math.hypot(end['x']-start['x'],end['y']-start['y'])
                if length>=remaining and length:return {'x':start['x']+(end['x']-start['x'])*remaining/length,'y':start['y']+(end['y']-start['y'])*remaining/length}
                remaining-=length
            return dict(points[-1])

        def reachable_loop(snapshot,points,speed):
            player=snapshot['player'];previous=.005
            # A small observed-input allowance covers Resume, pointer and click
            # delivery. It changes this local prediction, never the runtime.
            input_allowance=.035
            residual=lambda t:math.hypot(future_point(points,speed,t+input_allowance)['x']-player['x'],future_point(points,speed,t+input_allowance)['y']-player['y'])-430*t
            for step in range(1,35):
                current=step*.01
                if residual(current)<=0:
                    low,high=previous,current
                    for _ in range(12):
                        middle=(low+high)/2
                        if residual(middle)>0:low=middle
                        else:high=middle
                    return high,future_point(points,speed,high+input_allowance)
                previous=current
            return None

        def first_dismount(snapshot):
            horse=snapshot['horse']
            for radius in [27,35,44]:
                for angle in [math.pi/2,-math.pi/2,math.pi,0]:
                    candidate={'x':horse['x']+math.cos(horse['facing']+angle)*radius,'y':horse['y']+math.sin(horse['facing']+angle)*radius}
                    if not solid(world,candidate['x'],candidate['y'],9):return candidate
            return None

        async def lariat_plan(snapshot,points,speed):
            if snapshot['rope']['phase']!='idle':return None
            reach=reachable_loop(snapshot,points,speed)
            if reach is None:return None
            flight,catch=reach;player=snapshot['player'];levi=snapshot['entities']['levi'];post={'x':catch['x']+(24 if levi.get('mounted') else 0),'y':catch['y']}
            if not (20<math.hypot(post['x']-player['x'],post['y']-player['y'])<150) or not ground_clear(player,catch) or not ground_clear(player,post):return None
            dismount=first_dismount(snapshot)
            if not dismount or not ground_clear(dismount,post) or not (12<math.hypot(dismount['x']-post['x'],dismount['y']-post['y'])<155):return None
            dx,dy=levi['x']-player['x'],levi['y']-player['y'];distance=max(1,math.hypot(dx,dy));perpendicular=abs((catch['x']-player['x'])*dy-(catch['y']-player['y'])*dx)/distance
            torso={'x':levi['x'],'y':levi['y'],'z':(levi.get('z') or 0)+(65 if levi.get('mounted') else 30)}
            if distance<45 and perpendicular<5 and await target_on_canvas(torso):return {'mode':'current visible torso','aim':torso,'flight':flight,'predictedCatch':catch,'predictedDismount':dismount}
            if not levi.get('mounted'):return None
            # The public resolver maps empty-canvas pointers to ground/z30.
            # Extend that actual ground ray so its height at the predicted
            # mounted intersection remains inside the 40..88 collision band.
            for factor in [1.8,2,1.7,1.5,2.2]:
                target={'x':player['x']+(catch['x']-player['x'])*factor,'y':player['y']+(catch['y']-player['y'])*factor,'z':0}
                if not await target_on_canvas(target):continue
                overlaps=await page.evaluate("""data=>{
                  const g=My3D2dge.current,q=g.r.w(data.target.x,data.target.y,0);
                  return data.actors.some(actor=>[[(actor.z||0)+(actor.mounted?78:46),12],[(actor.z||0)+(actor.mounted?65:30),24]].some(([height,radius])=>{const p=g.r.w(actor.x,actor.y,height);return Math.hypot(q[0]-p[0],q[1]-p[1])<radius+3;}));
                }""",{'target':target,'actors':[a for a in snapshot['entities'].values() if a['id']!='mara' and a['hp']>0 and not a.get('hidden') and not a.get('departed') and not a.get('escaped') and a.get('regionId')==snapshot['region']]})
                if not overlaps:return {'mode':'extended public ground ray','aim':target,'factor':factor,'flight':flight,'heightAtCatch':64-34/factor,'predictedCatch':catch,'predictedDismount':dismount}
            return None

        async def pursue_step(snapshot,points,speed,attempt):
            player=snapshot['player'];destination=future_point(points,speed,.24);path=chase_path(player,destination)
            reachable=[(index,p) for index,p in enumerate(path) if ground_clear(player,p,13)]
            assert reachable,'Observed pursuit path has no clear actual first segment'
            _,goal=max(reachable,key=lambda item:item[0]);dx,dy=goal['x']-player['x'],goal['y']-player['y'];length=max(1,math.hypot(dx,dy))
            inverse=await page.evaluate('() => [...My3D2dge.current.view.inv]')
            milliseconds=min(260,max(80,length/230*1000));travel=230*milliseconds/1000;options=[]
            for key_x,key_y in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                wx=inverse[0]*key_x+inverse[1]*key_y;wy=inverse[2]*key_x+inverse[3]*key_y;normal=max(1e-9,math.hypot(wx,wy));ux,uy=wx/normal,wy/normal
                end={'x':player['x']+ux*travel,'y':player['y']+uy*travel}
                if not ground_clear(player,end,13):continue
                options.append(((dx*ux+dy*uy)/length,key_x,key_y))
            if not options:
                milliseconds=80;travel=230*.08
                for key_x,key_y in [(1,0),(-1,0),(0,1),(0,-1)]:
                    end={'x':player['x']+key_x*travel,'y':player['y']+key_y*travel}
                    if ground_clear(player,end,13):options.append(((dx*key_x+dy*key_y)/length,key_x,key_y))
            assert options,f'No actual pursuit lane around observed obstacle at {player["x"]},{player["y"]}'
            _,key_x,key_y=max(options);keys=['Shift']+(['d' if key_x>0 else 'a'] if key_x else [])+(['s' if key_y>0 else 'w'] if key_y else [])
            await page.locator('[data-command="resume"]').click();before=await observe();await hold(keys,milliseconds,after=0);after=await observe()
            moved=math.hypot(after['x']-before['x'],after['y']-before['y'])
            report.setdefault('publicPursuitMotion',[]).append({'attempt':attempt,'keys':keys,'milliseconds':milliseconds,'observedDistance':moved,'plannedGoal':goal,'start':{'x':before['x'],'y':before['y']},'end':{'x':after['x'],'y':after['y']}})
            assert moved>5 or after['dialog'],f'Actual public pursuit stopped against an obstacle: {after}'

        async def approach_roped_mount(snapshot,attempt):
            player=snapshot['player'];levi=snapshot['entities']['levi'];dx=levi['x']-player['x'];dy=levi['y']-player['y'];distance=max(1,math.hypot(dx,dy))
            inverse=await page.evaluate('() => [...My3D2dge.current.view.inv]')
            mounted=player['mounted'];radius=13 if mounted else 9
            speed=(230 if snapshot['horse']['stamina']>1 else 160) if mounted else (160 if player['stamina']>1 else 105)
            milliseconds=min(160,max(60,(distance-28)/speed*1000));travel=speed*milliseconds/1000;options=[]
            for key_x,key_y in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
                wx=inverse[0]*key_x+inverse[1]*key_y;wy=inverse[2]*key_x+inverse[3]*key_y;normal=max(1e-9,math.hypot(wx,wy));ux,uy=wx/normal,wy/normal
                end={'x':player['x']+ux*travel,'y':player['y']+uy*travel}
                if not ground_clear(player,end,radius):continue
                steps=max(1,math.ceil(travel/4));safe=True
                for step in range(1,steps+1):
                    point={'x':player['x']+(end['x']-player['x'])*step/steps,'y':player['y']+(end['y']-player['y'])*step/steps}
                    length=math.hypot(point['x']-levi['x'],point['y']-levi['y'])
                    if not ((25 if mounted else 18)<length<150) or not ground_clear(point,levi):safe=False;break
                if safe:options.append((distance-math.hypot(end['x']-levi['x'],end['y']-levi['y']),key_x,key_y))
            assert options,'No actual approach preserves the observed taut rope and body clearance'
            _,key_x,key_y=max(options);keys=['Shift']+(['d' if key_x>0 else 'a'] if key_x else [])+(['s' if key_y>0 else 'w'] if key_y else [])
            await page.locator('[data-command="resume"]').click();await hold(keys,milliseconds,after=0)
            report.setdefault('publicRopeApproach',[]).append({'attempt':attempt,'mounted':mounted,'keys':keys,'milliseconds':milliseconds,'from':{'x':player['x'],'y':player['y']},'target':{'x':levi['x'],'y':levi['y']}})

        async def route_walk(snapshot,target,speed=105,crouch=False,stop_at_chase=False):
            region=world if snapshot['region']=='bellwether-works' else geometry['snowbound']
            size=20;width=math.ceil(region['width']/size);height=math.ceil(region['height']/size)
            cell=lambda point:math.floor(point['y']/size)*width+math.floor(point['x']/size)
            point=lambda identifier:(identifier%width*size+10,identifier//width*size+10)
            start,end=cell(snapshot['player']),cell(target)
            clearance=25 if snapshot['player'].get('mounted') else 20
            if solid(region,*point(end),clearance):
                candidates=[identifier for identifier in range(max(0,end-width*2-2),min(width*height,end+width*2+3))
                    if math.hypot(point(identifier)[0]-target['x'],point(identifier)[1]-target['y'])<=35 and not solid(region,*point(identifier),clearance)]
                assert candidates,f'No conservative nearby endpoint for {target}'
                end=min(candidates,key=lambda identifier:math.hypot(point(identifier)[0]-target['x'],point(identifier)[1]-target['y']))
            queue=deque([start]);previous={start:None}
            while queue and end not in previous:
                current=queue.popleft();cx,cy=point(current)
                for offset in [1,-1,width,-width]:
                    identifier=current+offset;x,y=point(identifier)
                    if identifier<0 or identifier>=width*height or abs(x-cx)>size+1 or identifier in previous or solid(region,x,y,25 if snapshot['player'].get('mounted') else 20):continue
                    previous[identifier]=current;queue.append(identifier)
            assert end in previous,f'No authored path to {target}'
            nodes=[(target['x'],target['y'])];identifier=end
            while identifier!=start:
                nodes.append(point(identifier));identifier=previous[identifier]
            nodes.reverse();simplified=[]
            for index,node in enumerate(nodes):
                if index==0 or index==len(nodes)-1 or (nodes[index-1][0]==node[0])!=(node[0]==nodes[index+1][0]):simplified.append(node)
            await walk(simplified,speed=speed,crouch=crouch,tolerance=7,stop_at_chase=stop_at_chase)

        def visible_shot(region,player,target,actors):
            distance=max(1,math.hypot(player['x']-target['x'],player['y']-target['y']))
            height=player.get('z',0)+(64 if player.get('mounted') else 29)
            start={'x':player['x']+(target['x']-player['x'])/distance*16,'y':player['y']+(target['y']-player['y'])/distance*16,'z':height}
            finish={**target,'z':target['z']-(target['z']-height)*16/distance}
            for index in range(1,math.ceil(distance/4)+1):
                fraction=index/math.ceil(distance/4);x=start['x']+(finish['x']-start['x'])*fraction;y=start['y']+(finish['y']-start['y'])*fraction;z=start['z']+(finish['z']-start['z'])*fraction
                if any(obstacle['x']-3<x<obstacle['x']+obstacle['w']+3 and obstacle['y']-3<y<obstacle['y']+obstacle['h']+3 and not obstacle.get('impassable') and z<=obstacle.get('z',0)+obstacle.get('height',35) for obstacle in region['obstacles']):return False
            dx,dy=finish['x']-start['x'],finish['y']-start['y'];total=dx*dx+dy*dy
            for actor in actors.values():
                if actor['id'] in ['mara',target.get('id')] or actor.get('category')=='enemy' or actor['hp']<=0 or actor.get('hidden') or actor.get('regionId')!='bellwether-works':continue
                fraction=max(0,min(1,((actor['x']-start['x'])*dx+(actor['y']-start['y'])*dy)/(total or 1)))
                x,y,z=start['x']+dx*fraction,start['y']+dy*fraction,start['z']+(finish['z']-start['z'])*fraction
                if math.hypot(x-actor['x'],y-actor['y'])<(24 if actor.get('kind')=='horse' else 15) and actor.get('z',0)+5<z<actor.get('z',0)+(63 if actor.get('kind')=='horse' else 91 if actor.get('mounted') else 56):return False
            return True

        async def focus_sweep():
            # Plan a real walking stance from the current ordinary-menu graph.
            # Pure projection predicts camera-follow translation; no evaluated
            # code changes the camera, bodies, marks, weapons or simulation.
            targets=None
            for attempt in range(12):
                snapshot=await save(f'05-focus-plan-{attempt:02d}')
                opening=snapshot['rival'].get('yardOpening')
                poised=snapshot['mission']['stage']==5 and opening is not None and opening.get('firedAt') is None
                living=[actor for actor in snapshot['entities'].values() if actor.get('wave')=='yard' and actor['hp']>0 and (actor.get('active') or poised) and not actor.get('surrendered') and not actor.get('escaped')]
                assert len(living)>=3,'Fewer than three real living yard targets remain'
                points=[{'id':actor['id'],'x':actor['x'],'y':actor['y'],'z':actor.get('z',0)+46} for actor in living]
                candidates=[]
                for x in range(1260,1841,30):
                    for y in range(1210,1521,25):
                        if solid(world,x,y,20):continue
                        z=next((zone['z'] for zone in world['elevationZones'] if zone['x']<x<zone['x']+zone['w'] and zone['y']<y<zone['y']+zone['h']),0)
                        place={'x':x,'y':y,'z':z}
                        eligible=[point['id'] for point in points if math.hypot(x-point['x'],y-point['y'])<540 and visible_shot(world,place,point,snapshot['entities'])]
                        if len(eligible)>=3:candidates.append({**place,'eligible':eligible})
                projections=await page.evaluate("""data=>{
                  const g=My3D2dge.current,s=g.screen,b=document.querySelector('#screen').getBoundingClientRect();
                  const screen=p=>({x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr});
                  const source=screen(g.r.w(data.player.x,data.player.y,data.player.z||0));
                  const obstacles=[...document.querySelectorAll('.objective,.topbar,#notices,[data-story-action],#interact')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
                  const targets=data.points.map(point=>({...point,screen:screen(g.r.w(point.x,point.y,point.z))}));
                  return data.candidates.map(candidate=>{
                    const destination=screen(g.r.w(candidate.x,candidate.y,candidate.z));const dx=source.x-destination.x,dy=source.y-destination.y;
                    const visible=targets.filter(target=>candidate.eligible.includes(target.id)).filter(target=>{
                      const x=target.screen.x+dx,y=target.screen.y+dy;
                      return x>50&&x<1390&&y>85&&y<855&&!obstacles.some(r=>x>r.left-15&&x<r.right+15&&y>r.top-15&&y<r.bottom+15);
                    }).map(target=>target.id);
                    return {...candidate,visible};
                  }).filter(candidate=>candidate.visible.length>=3);
                }""",{'player':snapshot['player'],'points':points,'candidates':candidates})
                assert projections,'No real walking stance shows three clear hostile silhouettes outside the HUD'
                destination=min(projections,key=lambda point:math.hypot(point['x']-snapshot['player']['x'],point['y']-snapshot['player']['y']))
                await page.keyboard.down('Shift');await route_walk(snapshot,destination,speed=160);await page.keyboard.up('Shift')
                await wait_camera_player()
                snapshot=await save(f'05-focus-stance-{attempt:02d}')
                targets=[]
                for identifier in destination['visible']:
                    actor=snapshot['entities'][identifier]
                    if actor['hp']<=0:continue
                    target={'x':actor['x'],'y':actor['y'],'z':actor.get('z',0)+46}
                    pointer=await page.evaluate("""target=>{const g=My3D2dge.current,p=g.r.w(target.x,target.y,target.z),s=g.screen,b=document.querySelector('#screen').getBoundingClientRect();return {x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr};}""",target)
                    if 50<pointer['x']<1390 and 85<pointer['y']<855 and visible_shot(world,snapshot['player'],{'id':identifier,**target},snapshot['entities']):targets.append(identifier)
                if len(targets)>=3:
                    targets=targets[:3];break
            else:raise AssertionError('Moving actors never provided three actual visible focus targets')
            before=snapshot
            await page.keyboard.down('Space')
            for identifier in targets:
                actor=before['entities'][identifier]
                pointer=await aim({'x':actor['x'],'y':actor['y'],'z':actor.get('z',0)+46})
                await page.wait_for_timeout(180)
            await page.screenshot(path=str(output/'05-public-focus-marks.png'))
            await page.mouse.click(pointer['x'],pointer['y']);await page.wait_for_timeout(3600);await page.keyboard.up('Space')
            after=await save('05-public-focus-shots-state')
            assert after['performance']['threeFocusKills'],'Public reticle sweep did not earn three real lethal intersections'
            assert after['stats']['shots']-before['stats']['shots']==3,'The public three-mark release did not emit exactly three actual shots'
            if args.first_shot=='player':
                assert before['rival']['yardOpening']['firedAt'] is None and before['rival']['yardOpening']['shotSerial'] is None
                opening=after['rival']['yardOpening']
                assert opening['firedAt'] is not None and opening['shotSerial']==opening['shotsBefore']+1
                assert after['rival']['shots'][opening['shotSerial']-1]['serial']==opening['shotSerial']
                report['publicOpeningShot']={'gunsPoisedUntilActualPlayerShot':True,'receipt':opening}
            report['publicFocusSweep']={'targets':targets,'shotsDelta':after['stats']['shots']-before['stats']['shots'],'sameActivationKillsVerified':True,'stance':{'x':before['player']['x'],'y':before['player']['y']}}
            await record('05-public-focus-shots')

        async def planned_shot_stance(snapshot,enemy,excluded=()):
            target={'id':enemy['id'],'x':enemy['x'],'y':enemy['y'],'z':enemy.get('z',0)+46}
            candidates=[]
            for radius in [80,120,180,250,380]:
                for index in range(24):
                    angle=index*math.pi/12;x=enemy['x']+math.cos(angle)*radius;y=enemy['y']+math.sin(angle)*radius
                    if solid(world,x,y,20):continue
                    if any(math.hypot(x-point['x'],y-point['y'])<35 for point in excluded):continue
                    z=next((zone['z'] for zone in world['elevationZones'] if zone['x']<x<zone['x']+zone['w'] and zone['y']<y<zone['y']+zone['h']),0)
                    place={'x':x,'y':y,'z':z}
                    if visible_shot(world,place,target,snapshot['entities']):candidates.append(place)
            projections=await page.evaluate("""data=>{
              const g=My3D2dge.current,s=g.screen,b=document.querySelector('#screen').getBoundingClientRect();
              const screen=p=>({x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr});
              const from=screen(g.r.w(data.player.x,data.player.y,data.player.z||0)),target=screen(g.r.w(data.target.x,data.target.y,data.target.z));
              const obstacles=[...document.querySelectorAll('.objective,.topbar,#notices,[data-story-action],#interact')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
              return data.candidates.filter(candidate=>{
                const to=screen(g.r.w(candidate.x,candidate.y,candidate.z));const x=target.x+from.x-to.x,y=target.y+from.y-to.y;
                // Leave room for the actual walking endpoint tolerance,
                // camera pixels and proximity controls that appear on arrival.
                return x>85&&x<1355&&y>125&&y<800&&!obstacles.some(r=>x>r.left-40&&x<r.right+40&&y>r.top-40&&y<r.bottom+40);
              });
            }""",{'player':snapshot['player'],'target':target,'candidates':candidates})
            assert projections,f'No real clear visible firing stance for {enemy["id"]}'
            return min(projections,key=lambda point:math.hypot(point['x']-snapshot['player']['x'],point['y']-snapshot['player']['y']))

        async def target_visibility(target):
            return await page.evaluate("""target=>{
              const g=My3D2dge.current,p=g.r.w(target.x,target.y,target.z),s=g.screen,b=document.querySelector('#screen').getBoundingClientRect();
              const x=b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y=b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr;
              const blockedBy=[...document.querySelectorAll('.objective,.topbar,#notices,[data-story-action],#interact')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none').map(el=>({element:el.id||el.dataset.storyAction||el.className,rect:el.getBoundingClientRect()})).filter(({rect:r})=>r.width&&r.height&&x>r.left-12&&x<r.right+12&&y>r.top-12&&y<r.bottom+12).map(({element,rect:r})=>({element,left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
              const inside=x>50&&x<1390&&y>85&&y<850;
              return {visible:inside&&!blockedBy.length,x,y,inside,blockedBy,scale:s.S,dpr:s.dpr};
            }""",target)

        async def target_on_canvas(target):
            return (await target_visibility(target))['visible']

        async def dodge(snapshot,enemy,milliseconds,label):
            # Choose public movement from the observed geometry. A fixed A
            # strafe previously stopped against the chute wall and exposed Mara
            # to a genuine four-gun volley; nothing here changes those guns.
            plan=observed_dodge_plan(snapshot,world,milliseconds,enemy)
            assert plan,f'No actual public dodge lane remained at {snapshot["player"]["x"]},{snapshot["player"]["y"]}'
            key_x,key_y=plan['worldVector'];sprint=plan['sprint'];milliseconds=plan['milliseconds']
            keys=(['Shift'] if sprint else [])+(['d' if key_x>0 else 'a'] if key_x else [])+(['s' if key_y>0 else 'w'] if key_y else [])
            before=await observe();await hold(keys,milliseconds,after=0);after=await observe()
            moved=math.hypot(after['x']-before['x'],after['y']-before['y'])
            report.setdefault('publicCombatMotion',[]).append({'label':label,'keys':keys,'milliseconds':milliseconds,'observedDistance':moved,'threatIds':plan['threatIds'],'threatDelays':plan['threatDelays'],'plannedClearDistance':plan['clear'],'start':{'x':before['x'],'y':before['y']},'end':{'x':after['x'],'y':after['y']}})
            assert moved>1 or after['dialog'],f'Actual public dodge stopped before moving: {after}'

        async def covered_reload(label):
            return await public_covered_reload(label,page=page,save=save,observe=observe,hold=hold,report=report,world=world)

        async def fight(population,stage,label):
            nonlocal expected_hunt_history
            failed_stances={}
            for attempt in range(90):
                snapshot=await save(f'{label}-shot-{attempt:02d}-before')
                if snapshot['mission']['stage']>stage:break
                current_gun=snapshot['weapons'][snapshot['player']['equippedWeaponId']]
                if population=='patrol' and args.use_quiet_ration and args.ration_timing=='reload-danger' and snapshot['inventory'].get('quietRation',0)>0 and snapshot['player']['stamina']<35 and current_gun['ammo']<=2:
                    expected_hunt_history=await use_owned_quiet_ration(expected_hunt_history)
                    snapshot=await save(f'{label}-shot-{attempt:02d}-actual-ration')
                enemies=observed_hostiles(snapshot,population)
                if not enemies:
                    await page.wait_for_timeout(200);continue
                firing_ids={t['actor']['id'] for t in observed_firing_threats(snapshot,2.5)}
                ordered=sorted(enemies,key=lambda actor:(actor['id'] not in firing_ids,math.hypot(actor['x']-snapshot['player']['x'],actor['y']-snapshot['player']['y'])))
                visible=[]
                for candidate in ordered:
                    head={'id':candidate['id'],'x':candidate['x'],'y':candidate['y'],'z':candidate.get('z',0)+46}
                    if math.hypot(candidate['x']-snapshot['player']['x'],candidate['y']-snapshot['player']['y'])<=450 and visible_shot(world,snapshot['player'],head,snapshot['entities']) and await target_on_canvas(head):visible.append(candidate)
                # Keep a real usable covered firing position whenever any
                # eligible body is visibly reachable from it.
                enemy=visible[0] if visible else ordered[0]
                target={'id':enemy['id'],'x':enemy['x'],'y':enemy['y'],'z':enemy.get('z',0)+46}
                if math.hypot(target['x']-snapshot['player']['x'],target['y']-snapshot['player']['y'])>450 or not visible_shot(world,snapshot['player'],target,snapshot['entities']) or not await target_on_canvas(target):
                    destination=await planned_shot_stance(snapshot,enemy,failed_stances.get(enemy['id'],[]))
                    await page.keyboard.down('Shift');await page.keyboard.down('Space')
                    await route_walk(snapshot,destination,speed=160)
                    await page.keyboard.up('Space');await page.keyboard.up('Shift')
                    await wait_camera_player()
                    snapshot=await save(f'{label}-shot-{attempt:02d}-position');enemy=snapshot['entities'][enemy['id']]
                    if enemy['hp']<=0 or enemy.get('surrendered') or enemy.get('escaped'):continue
                    target={'id':enemy['id'],'x':enemy['x'],'y':enemy['y'],'z':enemy.get('z',0)+46}
                gun=snapshot['weapons'][snapshot['player']['equippedWeaponId']]
                if snapshot['player']['focus']<45 and snapshot['inventory'].get('coffee',0)>0:
                    await hold(['2']);snapshot=await save(f'{label}-shot-{attempt:02d}-coffee')
                if gun['ammo']==0:
                    protected=await covered_reload(f'{label}-shot-{attempt:02d}-reload')
                    if not protected:
                        snapshot=await save(f'{label}-shot-{attempt:02d}-reload-uncovered',resume_wait=0)
                        if not snapshot['player']['reloadTimer'] and snapshot['weapons'][snapshot['player']['equippedWeaponId']]['ammo']==0:await hold(['r'])
                        for reload_step in range(24):
                            snapshot=await save(f'{label}-shot-{attempt:02d}-reload-{reload_step:02d}',resume_wait=0)
                            if not snapshot['player']['reloadTimer']:break
                            enemy=snapshot['entities'][enemy['id']]
                            defensive=snapshot['player']['focus']>2
                            if defensive:await page.keyboard.down('Space')
                            await dodge(snapshot,enemy,min(220,max(45,snapshot['player']['reloadTimer']*1000+20)),f'{label}-reload-{attempt}-{reload_step}')
                            if defensive:await page.keyboard.up('Space')
                        else:raise AssertionError('Actual reload did not complete while moving through available lanes')
                    snapshot=await save(f'{label}-shot-{attempt:02d}-reload');enemy=snapshot['entities'][enemy['id']];target={'id':enemy['id'],'x':enemy['x'],'y':enemy['y'],'z':enemy.get('z',0)+46}
                    if enemy['hp']<=0 or enemy.get('surrendered') or enemy.get('escaped'):continue
                if not await target_on_canvas(target):
                    failed_stances.setdefault(enemy['id'],[]).append({'x':snapshot['player']['x'],'y':snapshot['player']['y']})
                    (output/f'{label}-invisible-{attempt:02d}.json').write_text(json.dumps({'target':target,'player':snapshot['player'],'camera':await page.evaluate('() => ({...My3D2dge.current.cam})'),'visibility':await target_visibility(target),'destination':locals().get('destination')},indent=2)+'\n')
                    continue
                use_focus=snapshot['player']['focus']>2
                if use_focus:await page.keyboard.down('Space')
                pointer=await aim(target);await page.wait_for_timeout(75 if use_focus else 25);await page.mouse.click(pointer['x'],pointer['y'])
                flight=math.hypot(enemy['x']-snapshot['player']['x'],enemy['y']-snapshot['player']['y'])/720
                await dodge(snapshot,enemy,max(220,min(1700,flight/(.3 if use_focus else 1)*1000+220)),f'{label}-shot-{attempt}')
                if use_focus:await page.keyboard.up('Space')
            else:raise AssertionError(f'Finite {population} encounter did not resolve through public fire')
            final=await save(f'{label}-resolved-state');assert final['mission']['stage']==stage+1
            await record(label+'-resolved')

        async def read_personal_belonging():
            snapshot=await save('09-personal-belonging-before')
            papers=sorted(geometry['papers'],key=lambda paper:paper['lootId']!='quarry-letter')
            owned=snapshot['campaign']['missions'][RIVAL]['objects']
            paper=next((paper for paper in papers if paper['id'] in owned or (
                (body:=snapshot['entities'].get(paper['sourceEntityId'])) is not None
                and (body['hp']<=0 or body.get('surrendered')) and not body.get('looted') and not body.get('escaped'))),None)
            assert paper,'No actual available named pocket belonging remained after the patrol'
            if paper['id'] not in owned:
                body=snapshot['entities'][paper['sourceEntityId']]
                await route_walk(snapshot,{'x':body['x']-20,'y':body['y']})
                await action(('search-surrendered:' if body.get('surrendered') else 'loot:')+body['id'])
            snapshot=await save('09-personal-belonging-state')
            item=snapshot['campaign']['missions'][RIVAL]['objects'][paper['id']]
            assert item['owner']=='mara' and item['sourceEntityId']==paper['sourceEntityId'] and item['location']=={'type':'carried','targetId':'mara'}
            stock=snapshot['rival']['loot'][paper['sourceEntityId']]
            assert paper['id'] in stock['transferredObjectIds'] and not stock['objects'] and stock['keepsake'] is None
            await page.locator('[data-panel="satchel"]').click()
            article=page.locator(f'[data-pocket-object="{paper["id"]}"]')
            await article.wait_for(state='visible')
            panel=await page.locator('#panel').bounding_box()
            await page.mouse.move(panel['x']+panel['width']*.65,panel['y']+panel['height']*.7)
            for _ in range(12):
                box=await article.bounding_box();panel=await page.locator('#panel').bounding_box();heading=await page.locator('.panel-heading').bounding_box()
                visible_top=max(panel['y']+20,heading['y']+heading['height']+8)
                if box['y']>=visible_top and box['y']+box['height']<=panel['y']+panel['height']-20:break
                await page.mouse.wheel(0,500 if box['y']+box['height']>panel['y']+panel['height']-20 else -300)
                await page.wait_for_timeout(110)
            else:raise AssertionError('Owned personal belonging did not become readable through public satchel scrolling')
            text=' '.join((await article.inner_text()).split())
            assert ' '.join(paper['text'].split()) in text and paper['name'] in text
            await page.screenshot(path=str(output/'09-personal-belonging.png'))
            report['publicPocketRead']={'id':paper['id'],'sourceEntityId':paper['sourceEntityId'],'ownedFiniteTransferVerified':True,'text':text,'screenshot':'09-personal-belonging.png'}
            await hold(['Escape'])

        try:
            await page.goto(args.url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await page.locator('[data-panel="menu"]').click()
            async with page.expect_file_chooser() as chooser:
                await page.locator('[data-command="import"]').click()
            await (await chooser.value).set_files(str(args.source_save.resolve()))
            await page.locator('#welcome').wait_for(state="hidden")
            if args.retry_at_start:
                assert args.continue_chase,'The debugging retry is explicitly limited to a genuine chase continuation'
                await hold(['Escape']);await page.locator('[data-command="story"][data-id="retry"]').click()
                report['checkpointRetryAtStart']=True
                report['optionalRecordsEligible']=False
            baseline=await save("00-imported-state")
            expected_hunt_history=copy.deepcopy(baseline['campaign']['missions'][HUNT])
            assert baseline["campaign"]["missions"][RESCUE]["mission"]["completed"]
            report['sourceCompletedHuntAtImport']=baseline['campaign']['missions'][HUNT]['mission']['completed']
            if not args.continue_field and not args.continue_chase:
                report['artifactScope']='Full genuine imported completed-'+('Hunt' if report['sourceCompletedHuntAtImport'] else 'Rescue')+' continuation to Rival completion/reload'
            if not args.continue_field and not args.continue_chase:
                assert baseline["campaign"]["missions"][RIVAL]["status"]=="unstarted"
                await record("00-imported")
                await route_walk(baseline,world['camp']['briefing'])
                await action('rival:briefing');await choose('intervene')
                activated=await save('01-rival-activation-state')
                expected_hunt_history,aging=freeze_hunt_after_rival_activation(baseline,activated)
                report['publicPreRivalHuntAging']={**aging,'observedSave':'01-rival-activation-state.json'}
                for who in ['ruth','emmett','bastian']:
                    snapshot=await save(f'01-{who}-position')
                    await route_walk(snapshot,snapshot['entities'][who])
                    await action(f'talk:{who}');await choose()
                snapshot=await save('01-performed-strike-before')
                if snapshot['rival'].get('narrative'):
                    await route_walk(snapshot,snapshot['entities']['ruth'])
                    await wait_predicate('01-actual-strike',lambda state: state['rival']['narrative']['opening']['phase']=='struck' and state['rival']['narrative']['opening']['activeSeconds']>=.55,seconds=40)
                    await record('01-bastian-strike')
                snapshot=await save('01-inez-position');await route_walk(snapshot,snapshot['entities']['inez']);await action('talk:inez');await choose()
                snapshot=await save('01-intervention-before')
                if snapshot['rival'].get('narrative'):
                    await route_walk(snapshot,snapshot['entities']['ruth']);await action('narrative:interpose')
                    performed=await wait_predicate('01-performed-intervention',lambda state: state['flags']['intervened'],seconds=35)
                    assert performed['rival']['narrative']['opening']['strike'] and performed['rival']['narrative']['opening']['intervention']
                    report['publicPerformedOpening']=performed['rival']['narrative']['opening'];await record('01-inez-mara-intervention')
                    for who,key in [('ada','residentAda'),('vera','residentVera')]:
                        if performed['entities'].get(who,{}).get('hp',0)>0 and performed['entities'][who].get('regionId')==performed['region']:
                            snapshot=await save('01-resident-'+who);await route_walk(snapshot,snapshot['entities'][who]);await action('narrative:'+key);await choose()
                snapshot=await save('01-expedition-invitation')
                await route_walk(snapshot,snapshot['entities']['tomas']);await action('rival:accept')
                await choose('ask-motive');await choose();await action('rival:accept');await choose('accept-rival')
                accepted=await save('01-accepted-state');assert accepted['mission']['stage']==1 and not accepted['weapons'].get(geometry['carbine'])
                await record('01-accepted')
                snapshot=await wait_predicate('02-carbine-delivery',lambda state: geometry['carbine'] in state['weapons'])
                await route_walk(snapshot,snapshot['horse']);await action('rack:inspect-carbine');await choose();await action('rack:carbine')
                snapshot=await save('02-separate-ammunition-before')
                if snapshot['rival'].get('equipment'):
                    assert snapshot['weapons'][geometry['carbine']]['reserve']==0,'Spare rounds must not arrive with the rack gun'
                    await route_walk(snapshot,snapshot['entities']['ruth']);await action('gear:cartridges')
                    issued=await wait_predicate('02-actual-cartridge-contact',lambda state: state['rival']['equipment']['issued']==42,seconds=35)
                    assert issued['rival']['equipment']['receipt']['count']==42 and issued['weapons'][geometry['carbine']]['ammo']+issued['weapons'][geometry['carbine']]['reserve']==49
                    report['publicSpareCartridgeHandoff']=issued['rival']['equipment']['receipt']
                    if issued['player']['holstered']:await hold(['q'])
                for who,identifier in [('inez','gear:lariat'),('emmett','gear:sightglass')]:
                    snapshot=await save(f'02-{who}-position');await route_walk(snapshot,snapshot['entities'][who]);await action(identifier)
                    if (await observe())['dialog']:await choose()
                    await wait_predicate('02-receipt-'+who,lambda state: state['flags']['lariatGranted' if who=='inez' else 'sightglassGranted'])
                snapshot=await wait_predicate('02-mounted-party',lambda state: all(state['entities'][member['actorId']].get('mounted') for member in party))
                await route_walk(snapshot,snapshot['horse']);await action('mount')
                await route_walk(await save('02-departure-path'),world['travelGate'],speed=160)
                snapshot=await wait_predicate('02-gate-party',lambda state: all(math.hypot(state['player']['x']-state['entities'][member['actorId']]['x'],state['player']['y']-state['entities'][member['actorId']]['y'])<210 for member in party))
                await action('depart:bellwether');await record('02-six-riders')
                for index,node in enumerate(world['trail']):
                    snapshot=await save(f'03-trail-{index}-before');await route_walk(snapshot,node,speed=160)
                    await wait_predicate(f'03-trail-{index}',lambda state: state['rival']['trailIndex']>=index+1)
                    if index==2:
                        snapshot=await save('03-grooves-before');await route_walk(snapshot,next(prop for prop in world['props'] if prop['id']=='wagon-grooves'));await action('inspect:wagon-grooves')
                    if index==3:
                        snapshot=await save('03-hooves-before');await route_walk(snapshot,next(prop for prop in world['props'] if prop['id']=='patrol-hooves'));await action('inspect:patrol-hooves')
                    if index==4:
                        snapshot=await save('03-branch-before')
                        if snapshot['rival'].get('narrative'):
                            await route_walk(snapshot,next(prop for prop in world['props'] if prop['id']=='branch-trail'));await action('inspect:branch-trail')
                            await wait_predicate('03-actual-branch-contact',lambda state: state['rival']['narrative']['branch']['observedAt'] is not None,seconds=20)
                snapshot=await save('03-voices-before-ridge')
                if snapshot['rival'].get('narrative'):
                    for voice_attempt in range(60):
                        snapshot=await save(f'03-actual-travel-voices-{voice_attempt:02d}')
                        if snapshot['rival']['narrative']['travel']['index']==3:break
                        farthest=max((snapshot['entities'][member['actorId']] for member in party),key=lambda actor:math.hypot(actor['x']-snapshot['player']['x'],actor['y']-snapshot['player']['y']))
                        gap=math.hypot(farthest['x']-snapshot['player']['x'],farthest['y']-snapshot['player']['y'])
                        if gap>169:
                            await route_walk(snapshot,{'x':snapshot['player']['x']+(farthest['x']-snapshot['player']['x'])*.065,'y':snapshot['player']['y']+(farthest['y']-snapshot['player']['y'])*.065},speed=160)
                        else:await page.wait_for_timeout(500)
                    else:raise AssertionError('Actual named travel speakers never completed their cohesive exchanges')
                    report['publicTrailNarrative']={'branch':snapshot['rival']['narrative']['branch'],'speech':[entry for entry in snapshot['rival']['narrative']['speech'] if entry['id'].startswith('trail-')]}
                await route_walk(await save('03-ridge-position'),world['observation'],speed=160);await action('lesson:ridge');await choose()
                await record('03-ridge')
                await route_walk(await save('04-viewpoint-position'),world['observation']);await action('sightglass:raise')
                for identifier,target in [('calder',None)]:
                    for attempt in range(16):
                        snapshot=await save(f'04-first-identity-{attempt:02d}')
                        if snapshot['scope']['observed'][identifier]:break
                        actor=snapshot['entities'][identifier];await scope_aim({'x':actor['x'],'y':actor['y'],'z':0})
                    else:raise AssertionError('The actual commander was not identified through the held glass')
                snapshot=await save('04-witness-contract-check')
                if snapshot['rival'].get('contractVersion')==2:
                    for event,ids in [('card',['calder','levi']),('strike',['calder','levi']),('departure',['calder','grout']),('dismissal',['levi','skein'])]:await scope_witness(event,ids)
                for identifier,target in [('calder',None),('levi',None),('magazine',world['searchSites']['magazine']),('weighhouse',world['searchSites']['weighhouse']),('entry',world['readyCover'])]:
                    for attempt in range(12):
                        snapshot=await save(f'04-view-{identifier}-{attempt:02d}')
                        if snapshot['scope']['observed'][identifier]:break
                        actual_target=target or snapshot['entities'][identifier]
                        await scope_aim({'x':actual_target['x'],'y':actual_target['y'],'z':0})
                    else:raise AssertionError(f'Public held sightglass never observed the moving {identifier}')
                await wait_predicate('04-acted-recon',lambda state: state['flags']['reconComplete'])
                snapshot=await save('04-observations-state');assert all(snapshot['scope']['observed'].values())
                if snapshot['rival'].get('contractVersion')==2:
                    assert {entry['id'] for entry in snapshot['rival']['reconWitness']['receipts']}=={'card','strike','departure','dismissal'} and snapshot['entities']['calder']['departed']
                    report['publicReconWitness']=snapshot['rival']['reconWitness']
                await action('sightglass:raise');await wait_camera_player();await route_walk(snapshot,snapshot['entities']['tomas']);await action('recon:plan');await choose()
                await record('04-observed-plan')
                for index,node in enumerate(world['descent']):
                    await route_walk(await save(f'05-descent-{index}-before'),node,speed=60,crouch=True)
                await wait_predicate('05-ready',lambda state: state['flags']['approachReady'])
                await action('choose-first');await choose(f'{args.first_shot}-first')
                await record('05-first-shot')
                await focus_sweep()
            else:
                assert baseline["campaign"]["activeMissionId"]==RIVAL and baseline["mission"]["stage"]==(10 if args.continue_chase else 5), "Partial debugging accepts only an unchanged genuine public Save at the selected boundary"
                await record("00-public-field-continuation")
            if not args.continue_chase:
                await fight('yard',5,'06-yard')
                if args.use_quiet_ration and args.ration_timing=='after-yard':
                    expected_hunt_history=await use_owned_quiet_ration(expected_hunt_history)
                snapshot=await save('07-pockets-before')
                pocket=next(state for state in snapshot['entities'].values() if state.get('wave')=='yard' and state['hp']<=0 and not state.get('looted'))
                await route_walk(snapshot,{'x':pocket['x']-20,'y':pocket['y']});await action('loot:'+pocket['id'])
                snapshot=await save('07-before-patrol-reload')
                gun=snapshot['weapons'][snapshot['player']['equippedWeaponId']]
                if gun['ammo']<gun['capacity'] and gun['reserve']>0:
                    await hold(['r'])
                    await wait_predicate('07-actual-carbine-reload',lambda state: not state['player']['reloadTimer'] and state['weapons'][state['player']['equippedWeaponId']]['ammo']>gun['ammo'],seconds=10)
                snapshot=await wait_predicate('07-patrol-warning',lambda state: state['flags']['patrolWarned'],seconds=85)
                await route_walk(snapshot,snapshot['entities']['tomas']);await action('battle:tactics');await choose('hold-yard' if args.tactics=='hold' else 'advance-trees')
                await record('07-pockets-and-warning')
                await fight('patrol',7,'08-patrol')
                if args.use_quiet_ration and args.ration_timing=='after-patrol':
                    expected_hunt_history=await use_owned_quiet_ration(expected_hunt_history)
                await read_personal_belonging()
                await route_walk(await save('09-magazine-before'),world['searchSites']['magazine']);await action('search:magazine')
                await route_walk(await save('09-cap-wagon-before'),world['searchSites']['capWagon'])
                if args.cap_search=='mara':
                    await action('search:cap-self')
                    found=await wait_predicate('09-mara-cap-contact',lambda state: state['campaign']['missions'][RIVAL]['objects'].get('cap-tin',{}).get('owner')=='mara',seconds=25)
                    # Ruth is already walking to Mara's actual search stance.
                    # Remain there so two moving actors do not pass one another
                    # on the way to an obsolete observed recipient position.
                    await wait_predicate('09-ruth-cap-approach',lambda state: math.hypot(state['player']['x']-state['entities']['ruth']['x'],state['player']['y']-state['entities']['ruth']['y'])<=22 and abs(state['player'].get('z',0)-state['entities']['ruth'].get('z',0))<8 and not state['entities']['ruth']['mounted'],seconds=65)
                    await wait_action('handoff:cap-tin','actual close Mara-to-Ruth tin contact',seconds=30)
                    await wait_predicate('09-cap-handoff',lambda state: state['rival']['searchWork']['cap']['phase']=='transferred',seconds=15)
                else:
                    await action('search:cap-wagon')
                    await wait_predicate('09-ruth-cap-contact',lambda state: state['campaign']['missions'][RIVAL]['objects'].get('cap-tin',{}).get('owner')=='ruth',seconds=65)
                await route_walk(await save('09-weighhouse-before'),world['searchSites']['weighhouse']);await action('search:weighhouse')
                await wait_predicate('09-bastian-paper-contact',lambda state: state['campaign']['missions'][RIVAL]['objects'].get('route-diagram',{}).get('owner')=='bastian' and state['rival'].get('searchWork',{}).get('papers',{}).get('phase')=='found',seconds=65)
                await route_walk(await save('09-charges-before'),world['charge']);await action('inspect:charges')
                snapshot=await wait_predicate('09-ruth-inspection',lambda state: math.hypot(state['player']['x']-state['entities']['ruth']['x'],state['player']['y']-state['entities']['ruth']['y'])<46)
                await action('pass:charge');await choose();await action('repack:charges');await action('take:crate')
                await route_walk(await save('09-plans-before'),world['plans']);await action('read:plans');await choose()
                snapshot=await wait_predicate('09-search-work',lambda state: state['flags']['plansDelivered'] and state['flags']['horsesRetrieved'],seconds=100)
                if snapshot['rival'].get('searchWork'):
                    assert snapshot['rival']['searchWork']['papers']['handoff']['finishedAt'] is not None
                    report['publicPhysicalSearches']=snapshot['rival']['searchWork']
                await route_walk(snapshot,snapshot['horse']);await action('mount')
                snapshot=await wait_predicate('09-remounted',lambda state: all(state['entities'][member['actorId']].get('mounted') for member in party))
                await route_walk(snapshot,snapshot['entities']['tomas'],speed=160);await action('convoy:depart')
                observed=await observe()
                if 'challenge-injuries' in observed['choices']:
                    await dialogue('09-convoy-actual-wounds','convoy');await choose('challenge-injuries');await dialogue('09-mara-counts-wounds','challengeInjuries');await choose();await dialogue('09-tomas-injury-answer','injuriesAnswer');await choose()
                await choose()
                if (await observe())['dialog']:
                    await dialogue('09-convoy-sibling-order','huntFirst' if report['sourceCompletedHuntAtImport'] else 'rivalFirst');await choose()
                closed=await save('09-convoy-actual-exchanges')
                if closed['rival'].get('narrative'):report['publicConvoyExchanges']=closed['rival']['narrative']['convoy']
                await record('09-three-searches')
                await equip('working-lariat')
                for index,node in enumerate(world['convoyRoute']):
                    await route_walk(await save(f'10-convoy-{index}-before'),node,speed=160,stop_at_chase=True)
                    await wait_predicate(f'10-convoy-{index}',lambda state: state['rival']['convoyIndex']>=index+1 or state['mission']['stage']>=10)
                await wait_predicate('10-flight',lambda state: state['mission']['stage']==10)
                await record('10-levi-flight')
            selected=await save('11-equipped-check',resume_wait=0)
            if selected['player']['equippedWeaponId']!='working-lariat':await equip('working-lariat')
            for attempt in range(64):
                snapshot=await save(f'11-pursuit-{attempt}',resume_wait=0,resume=False)
                assert snapshot['player']['mounted'] and snapshot['horse']['hp']>0 and snapshot['horse']['stamina']>1,'Observed pursuit needs the living mounted Copper and actual sprint stamina'
                if snapshot['captivity']['state']=='roped':
                    await page.locator('[data-command="resume"]').click();break
                if snapshot['rope']['phase']=='flying':
                    await page.locator('[data-command="resume"]').click();await page.wait_for_timeout(80);continue
                points,speed=prediction_path(snapshot);plan=await lariat_plan(snapshot,points,speed)
                if plan:
                    report.setdefault('publicLariatAttempts',[]).append({'attempt':attempt,**plan})
                    await page.locator('[data-command="resume"]').click()
                    visible=await target_visibility(plan['aim']);pointer=await aim(plan['aim'])
                    hit=await page.evaluate("point=>{const el=document.elementFromPoint(point.x,point.y);return el?{id:el.id,tag:el.tagName}:null;}",pointer)
                    if not visible['visible'] or not hit or hit['id']!='screen':
                        report['publicLariatAttempts'][-1].update({'throwAttempted':False,'clickBlockedBy':hit,'visibilityAfterResume':visible});continue
                    report['publicLariatAttempts'][-1]['throwAttempted']=True
                    await page.mouse.click(pointer['x'],pointer['y'])
                    await page.wait_for_timeout(400)
                    actual=await save(f'11-throw-{attempt}-receipt',resume_wait=0)
                    report['publicLariatAttempts'][-1]['actualRope']=actual['rope']
                    report['publicLariatAttempts'][-1]['actualCaptivity']=actual['captivity']['state']
                    if actual['captivity']['state']=='roped':break
                else:await pursue_step(snapshot,points,speed,attempt)
            else:raise AssertionError('Public moving lariat never caught Levi')
            for approach in range(10):
                snapshot=await save(f'11-actual-catch-approach-{approach}',resume_wait=0,resume=False)
                assert snapshot['captivity']['state']=='roped' and snapshot['player']['mounted'],'Actual captured rope or mounted player was lost before dismount'
                foot=first_dismount(snapshot);levi=snapshot['entities']['levi']
                if foot and ground_clear(foot,levi) and 12<math.hypot(foot['x']-levi['x'],foot['y']-levi['y'])<150:
                    report['actualDismountValidated']={'foot':foot,'levi':{'x':levi['x'],'y':levi['y']},'groundlineClear':True}
                    await page.locator('[data-command="resume"]').click();break
                await approach_roped_mount(snapshot,approach)
            else:raise AssertionError('Actual taut capture never reached a safe public dismount position')
            await action('dismount');snapshot=await save('11-roped-state');levi=snapshot['entities']['levi']
            for approach in range(20):
                snapshot=await save(f'11-foot-approach-{approach}',resume_wait=0,resume=False);levi=snapshot['entities']['levi']
                assert snapshot['captivity']['state']=='roped' and not snapshot['player']['mounted'],'Actual taut rope was lost during physical foot approach'
                if math.hypot(snapshot['player']['x']-levi['x'],snapshot['player']['y']-levi['y'])<32:
                    await page.locator('[data-command="resume"]').click();break
                await approach_roped_mount(snapshot,approach)
            else:raise AssertionError('Physical taut foot approach did not reach the actual binding range')
            if args.capture=='tackle':
                await page.locator('[data-story-action="cancel-rope"]').click();await action('tackle:levi')
            await action('bind:levi');await wait_predicate('11-binding',lambda state: state['mission']['stage']==11)
            await record('11-bound')
            await action('carry:levi');await hold(['h'])
            await wait_predicate('12-copper-pickup',lambda state: math.hypot(state['player']['x']-state['horse']['x'],state['player']['y']-state['horse']['y'])<50)
            await action('load:levi');await wait_action('strap:levi','stopped unmounted first passenger strap',seconds=12)
            snapshot=await save('12-actual-strapped-load')
            if snapshot['rival'].get('transportVersion')==1:
                await wait_action('transport:check','hands-on stopped passenger check',seconds=12)
                await wait_predicate('12-actual-check',lambda state: state['rival']['transport']['checkCount']>=1 and not state['rival']['transport']['checkRemaining'],seconds=8)
            await action('talk:levi-road');await choose('offer-assurance');await action('mount')
            for index,node in enumerate(world['returnRoute']):
                await route_walk(await save(f'12-return-{index}-before'),node,speed=129)
                snapshot=await wait_predicate(f'12-return-{index}',lambda state: state['rival']['returnIndex']>=index+1)
                if snapshot['rival'].get('transportVersion')==1 and (snapshot['rival']['transport']['strapQuality']<.9 or snapshot['rival']['transport']['weatherWarned'] and snapshot['rival']['transport']['resecureCount']==0):
                    await action('dismount');await wait_action('transport:check','real stopped pressure check',seconds=12)
                    checked=await wait_predicate(f'12-pressure-check-{index}',lambda state: not state['rival']['transport']['checkRemaining'] and state['rival']['transport']['lastCheckAt'] is not None,seconds=8)
                    await wait_action('transport:resecure','checked rear strap resecure',seconds=10)
                    repaired=await wait_predicate(f'12-pressure-resecure-{index}',lambda state: not state['rival']['transport']['resecureRemaining'] and state['rival']['transport']['strapQuality']>=.999,seconds=8)
                    report.setdefault('publicTransportChecks',[]).append({'node':index,'checkCount':repaired['rival']['transport']['checkCount'],'resecureCount':repaired['rival']['transport']['resecureCount'],'strapQuality':repaired['rival']['transport']['strapQuality']})
                    await action('mount')
            await action('return:kiln');await record('12-captive-home')
            await route_walk(await save('13-tack-before'),world['camp']['arrival'],speed=137);await action('hitch:tack');await action('unload:levi')
            await route_walk(await save('13-doorway-before'),world['camp']['doorway'],speed=50);await action('deliver:levi')
            snapshot=await wait_predicate('13-ruth-handoff',lambda state: math.hypot(state['player']['x']-state['entities']['ruth']['x'],state['player']['y']-state['entities']['ruth']['y'])<46)
            if not snapshot['flags']['delivered']:await action('deliver:levi')
            snapshot=await wait_predicate('13-guarded-hold',lambda state: state['flags']['held'])
            await route_walk(snapshot,world['camp']['holding']);await action('talk:levi-evidence');await wait_dialog('the actual assembled holding-room council')
            for key in ['cardQuestion','leviCard','signatureQuestion','signatureAnswer','identityDenial','coercion','objection','temporaryHold']:
                await dialogue('13-spoken-'+key,key)
                await choose('question:object' if key=='coercion' else 'question:continue')
            await dialogue('13-actual-care-menu','care')
            if args.treatment=='harsh':
                await choose('deprive-levi');await dialogue('13-chosen-deprivation','deprivation');await choose('question:continue');await dialogue('13-levi-deprivation-response','deprivationResponse');await choose('question:continue')
            else:
                await choose('care-levi')
                if (await observe())['dialog']:
                    observed=await dialogue('13-actual-no-stock')
                    if 'care:partial' in observed['choices']:await choose('care:partial')
                    elif 'care:assure' in observed['choices']:
                        await choose('care:assure');await dialogue('13-no-stock-assurance','assurance');await choose('question:continue')
                    else:raise AssertionError(f'Actual no-stock modal offered no lawful available care: {observed}')
            question=await save('13-actual-questioning-care-state')
            assert [entry['lineId'] for entry in question['rival']['questioning']['seen']]==['cardQuestion','leviCard','signatureQuestion','signatureAnswer','identityDenial','coercion','objection','temporaryHold']
            report['publicQuestioning']=question['rival']['questioning'];assert question['mission']['stage']==13
            await record('13-questioning-and-care')
            await route_walk(await save('14-store-before'),world['camp']['charges'])
            for attempt in range(100):
                snapshot=await save(f'14-custody-{attempt:02d}')
                if snapshot['flags']['chargesStored']:break
                await action('deposit:charges');await page.wait_for_timeout(450)
            else:raise AssertionError('Ruth did not retrieve the actual Plover crate and deposit it')
            await route_walk(snapshot,world['camp']['ledger']);await action('finish:rival');await choose()
            completed=await save('14-complete-state');assert completed['mission']['completed'] and completed['flags']['accounted']
            assert completed['choices']['order']==('hunt-first' if report['sourceCompletedHuntAtImport'] else 'rival-first')
            assert completed['entities']['levi']['attachment']['targetId']==world['camp']['holding']['id']
            assert completed['campaign']['missions'][OPENING]==baseline['campaign']['missions'][OPENING]
            assert completed['campaign']['missions'][HUNT]==expected_hunt_history
            assert completed['entities']['silas']['attachment']['targetId']=='silas-bed' and completed['entities']['lark']['hp']==0
            await record('14-complete')
            await page.reload();await page.locator('#continue-game').click();await page.locator('#welcome').wait_for(state='hidden');reloaded=await save('15-reloaded-state')
            for key in ['inventory','weapons','itemInstances','camp','companions','regions','checkpoints','missionEntries']:
                assert reloaded[key]==completed[key],f'Reload changed durable {key}'
            for key in ['mission','flags','performance','transactions','objects','rival','scope','focus','rope']:
                assert reloaded['campaign']['missions'][RIVAL][key]==completed['campaign']['missions'][RIVAL][key],f'Reload changed Rival {key}'
            for key in ['money','equippedWeaponId','holstered','mounted']:
                assert reloaded['player'][key]==completed['player'][key],f'Reload changed Mara {key}'
            assert reloaded['entities']['levi']['attachment']==completed['entities']['levi']['attachment']
            for key in ['state','trust','cruelty','injury','questions','restraint','care']:
                assert reloaded['captivity'][key]==completed['captivity'][key],f'Reload changed captive {key}'
            assert reloaded['campaign']['missions'][RIVAL]['choices']==completed['campaign']['missions'][RIVAL]['choices']
            if report.get('publicPocketRead'):
                paper_id=report['publicPocketRead']['id']
                assert reloaded['campaign']['missions'][RIVAL]['objects'][paper_id]==completed['campaign']['missions'][RIVAL]['objects'][paper_id]
                report['publicPocketRead']['saveReloadPreserved']=True
            if report.get('publicOwnedQuietRation'):
                assert reloaded['campaign']['missions'][HUNT]==expected_hunt_history and reloaded['inventory'].get('quietRation',0)==0
                assert reloaded['performance']['healingUses']>=1 and not reloaded['performance']['noHealingItems']
                report['publicOwnedQuietRation']['saveReloadPreserved']=True
            await record('15-reloaded');assert not errors and not (await observe())['engineErrors']
            report.update({'passed':True,'final':await observe(),'performance':completed['performance'],'saveReloadPreserved':True})
        except Exception as error:
            report["failure"]=str(error) or type(error).__name__
            report["traceback"]=traceback.format_exc()
            try:
                report["final"]=await observe();await page.screenshot(path=str(output/"failure.png"))
            except Exception as observation_error:
                report["observationFailure"]=str(observation_error)
        finally:
            report["sourceHashesAtEnd"]=source_hashes()
            report["sourceFilesStableDuringRun"]=report["sourceHashesAtEnd"]==initial_hashes
            report["driverSHA256AtEnd"]=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
            report["driverStableDuringRun"]=report["driverSHA256AtEnd"]==driver_hash
            report["sourceSaveUnchangedDuringRun"]=hashlib.sha256(args.source_save.read_bytes()).hexdigest()==report['sourceSHA256']
            unstable=[key for key in ['sourceFilesStableDuringRun','driverStableDuringRun','sourceSaveUnchangedDuringRun'] if not report[key]]
            if unstable:
                report['passed']=False
                report['provenanceFailure']='Receipt changed during the run: '+', '.join(unstable)
                report.setdefault('failure',report['provenanceFailure'])
            (output/"report.json").write_text(json.dumps(report,indent=2)+"\n")
            print(json.dumps(report),flush=True)
            await browser.close()
    return report["passed"]


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",default="http://127.0.0.1:4173")
    parser.add_argument("--output",type=Path,default=Path("/tmp/dust-mercy-rival-playthrough"))
    parser.add_argument("--engine",choices=["chromium","firefox","webkit"],default="chromium")
    parser.add_argument("--source-save",type=Path,default=Path("/tmp/dust-mercy-hunt-webkit-rereview-corrected/00-imported-rescue-state.json"))
    parser.add_argument("--retry-at-start",action="store_true",help="Use the actual visible retry button at a genuine saved chase boundary; explicitly ineligible optional records")
    parser.add_argument("--continue-chase",action="store_true",help="Debug transport from an unchanged genuine public chase-start Save; partial proof only")
    parser.add_argument("--continue-field",action="store_true",help="Debug remaining stages from an unchanged genuine public first-battle Save; partial proof only")
    parser.add_argument("--first-shot",choices=["player","tomas"],default="player")
    parser.add_argument("--tactics",choices=["hold","advance"],default="hold")
    parser.add_argument("--capture",choices=["lariat","tackle"],default="lariat")
    parser.add_argument("--treatment",choices=["care","harsh"],default="care")
    parser.add_argument("--cap-search",choices=["ruth","mara"],default="ruth")
    parser.add_argument("--use-quiet-ration",action="store_true",help="After actual battle wounds, visibly consume the one genuinely owned Hunt ration; records the original once-only ledger and disqualifies no-healing")
    parser.add_argument("--ration-timing",choices=["after-patrol","after-yard","reload-danger"],default="after-patrol",help="Choose actual ration timing; reload-danger waits for observed low patrol stamina and a nearly empty magazine")
    raise SystemExit(0 if asyncio.run(run(parser.parse_args())) else 1)
