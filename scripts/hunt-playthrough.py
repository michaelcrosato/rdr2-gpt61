#!/usr/bin/env python3
"""Play A Quiet Table through public keyboard/mouse controls.

Start through the visible Import save file menu using a documented game-generated
v2/v3 completed-rescue artifact. This is an import/continuation proof, not a fresh
connected two-mission journey. Evaluations read only camera/UI and normal-menu
Saves. No runtime writes, teleports, injected saves or simulation calls. Wildlife shots use ordinary mouse aim, hold and release against observed
projected geometry; the arrow still has to intersect the animal. No J aiming.
"""
import argparse
import asyncio
import copy
import json
import math
import os
import traceback
from pathlib import Path

os.environ.setdefault("PLAYWRIGHT_HOST_PLATFORM_OVERRIDE", "ubuntu24.04-x64")
from playwright.async_api import async_playwright
from campaign_save import normalize_campaign_save

HUNT = "snowbound-a-quiet-table"
RESCUE = "snowbound-a-voice-under-ice"
OPENING = "snowbound-the-last-warm-light"


def verify_reload(before, after):
    """Verify observed local Save copies; never access or mutate browser state."""
    elapsed=after["elapsed"]-before["elapsed"]
    assert 0<=elapsed<10, f"unexpected normal reload clock delta {elapsed}"
    after_campaign=copy.deepcopy(after["campaign"])
    before_clinic=before["campaign"]["missions"][RESCUE]["rescue"]["silas"]
    after_clinic=after_campaign["missions"][RESCUE]["rescue"]["silas"]
    for key,rate in [("healingHours",80),("injury",80*18)]:
        assert abs(after_clinic[key]-max(0,before_clinic[key]-elapsed/rate))<1e-7,key
        after_clinic[key]=before_clinic[key]
    # The active Hunt ground tracks continue aging with ordinary world time.
    # Validate exactly rather than discarding their consequential history.
    count=0
    for identifier,samples in before["campaign"]["missions"][HUNT]["tracks"]["samples"].items():
        actual=after_campaign["missions"][HUNT]["tracks"]["samples"][identifier]
        assert len(actual)==len(samples),"reload changed the ground track history"
        for expected,observed in zip(samples,actual):
            assert abs(observed["age"]-expected["age"]-elapsed)<1e-7,"track age did not follow actual world elapsed time"
            observed["age"]=expected["age"]
            count+=1
    assert after_campaign==before["campaign"],"durable mission records changed outside exact bedside/ground-track clocks"
    for key in ["inventory","weapons","itemInstances","camp","companions","sideQuests","wanted","honor","stats","regions","checkpoints","missionEntries","dropped"]:
        assert after[key]==before[key],f"durable {key} changed on normal reload"
    for identifier,expected in before["entities"].items():
        actual=after["entities"][identifier]
        for key in ["id","category","regionId","attachment","owned","ownerId","pack","equippedWeaponId","money","mounted","carrying","coldcoat","lantern","scars","injured","coatRepaired","hunt","processed","dead"]:
            assert actual.get(key)==expected.get(key),f"durable {identifier}.{key} changed"
        expected_hp=min(100,expected["hp"]+elapsed/160) if identifier=="silas" else expected["hp"]
        assert abs(actual["hp"]-expected_hp)<1e-7,f"{identifier}.hp changed outside clinical schedule"
    return {"observedSeconds":elapsed,"trackSamplesAgedExactly":count,"durableFieldsPreserved":True}


async def run(url, output, engine, source_save, hide="retain"):
    output.mkdir(parents=True, exist_ok=True)
    errors, events = [], []
    result = {"passed": False, "browser": engine, "url": url, "events": events, "errors": errors,
        "sourceSave": str(source_save.resolve()), "sourceVersion": json.loads(source_save.read_text())["version"],
        "startMode": "Visible Import save file menu and browser file chooser",
        "inputMode": "Public keyboard/mouse movement, E/context actions, menus/dialog choices; normal mouse bow aim, hold and release",
        "caveat": "Continues an imported actual completed-rescue Save; no fresh connected journey, real hardware or freehand visual target recognition claim. Mouse points are projected from ordinary menu-observed Save geometry; actual projectile intersection is required.",
        "hide": hide}
    async with async_playwright() as playwright:
        browser = await getattr(playwright, engine).launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

        async def observe():
            return await page.evaluate("""() => {
              const g=My3D2dge.current;
              return {x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by,z:g.cam.tz,
                stage:document.querySelector('#mission-count').textContent,
                mission:document.querySelector('#mission-name').textContent,
                objective:document.querySelector('#objective-text').textContent,
                health:Number(document.querySelector('#health-ring').getAttribute('aria-valuenow')),
                interaction:document.querySelector('#interact').hidden?null:document.querySelector('#interaction-label').textContent,
                dialog:document.querySelector('#conversation').open,
                choices:[...document.querySelectorAll('[data-choice]')].map(el=>el.dataset.choice),
                notices:document.querySelector('#notices').textContent,
                engineErrors:g.errors};
            }""")

        async def hold(keys, milliseconds=65):
            for key in keys:
                await page.keyboard.down(key)
            await page.wait_for_timeout(milliseconds)
            for key in keys:
                await page.keyboard.up(key)
            await page.wait_for_timeout(65)

        async def choose(identifier="leave"):
            await page.locator(f'[data-choice="{identifier}"]').click(timeout=15000)
            await page.wait_for_timeout(120)

        async def interact(expected=None):
            if expected:
                await page.wait_for_function("text => { const b=document.querySelector('#interact'); return !b.hidden && document.querySelector('#interaction-label').textContent.toLowerCase().includes(text); }", arg=expected.lower(), timeout=4000)
            state = await observe()
            if expected:
                assert expected.lower() in (state["interaction"] or "").lower(), state
            await hold(["e"])
            await page.wait_for_timeout(110)

        async def record(label):
            event = {"label": label, **await observe(), "screenshot": f"{label}.png"}
            await page.screenshot(path=str(output / event["screenshot"]))
            events.append(event)
            print(json.dumps(event), flush=True)

        async def save(label):
            assert not (await observe())["dialog"], await observe()
            await hold(["Escape"])
            await page.locator('[data-command="save"]').click()
            raw = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
            (output / f"{label}.json").write_text(json.dumps(raw, indent=2) + "\n")
            snapshot = normalize_campaign_save(raw)
            await page.locator('[data-command="resume"]').click()
            await page.wait_for_timeout(65)
            assert not snapshot["failure"], snapshot["failure"]
            return snapshot

        async def walk(route, speed=90, tolerance=9, crouch=False):
            for target_x, target_y in route:
                stuck = 0
                for _ in range(140):
                    before = await observe()
                    assert not before["dialog"], before
                    dx, dy = target_x-before["x"], target_y-before["y"]
                    if math.hypot(dx, dy) < tolerance:
                        break
                    horizontal = abs(dx) > abs(dy)
                    key = ("d" if dx>0 else "a") if horizontal else ("s" if dy>0 else "w")
                    amount = abs(dx) if horizontal else abs(dy)
                    await hold((["c"] if crouch else [])+[key], min(550, max(45, amount/speed*1000)))
                    after = await observe()
                    stuck = stuck+1 if math.hypot(after["x"]-before["x"], after["y"]-before["y"]) < .5 else 0
                    if stuck >= 2:
                        # Slide along a wall through actual movement input when
                        # the other axis still approaches the requested point.
                        other = target_y-after["y"] if horizontal else target_x-after["x"]
                        if abs(other) > tolerance:
                            alternate = ("s" if other>0 else "w") if horizontal else ("d" if other>0 else "a")
                            await hold((["c"] if crouch else [])+[alternate], min(200,max(45,abs(other)/speed*1000)))
                            shifted = await observe()
                            if math.hypot(shifted["x"]-after["x"],shifted["y"]-after["y"])>.5:
                                stuck = 0
                    if stuck >= 5:
                        raise AssertionError(f"Route blocked toward {target_x},{target_y}: {after}")
                else:
                    raise AssertionError(f"Route did not reach {target_x},{target_y}: {await observe()}")

        async def near_actor(snapshot, identifier, speed=90):
            actor = snapshot["entities"][identifier]
            await walk([(actor["x"], actor["y"])], speed=speed, tolerance=20)

        async def follow_line(target, speed=120):
            start = await observe()
            dx, dy = target[0]-start["x"], target[1]-start["y"]
            steps = max(1, math.ceil(math.hypot(dx,dy)/12))
            for index in range(1,steps+1):
                await walk([(start["x"]+dx*index/steps,start["y"]+dy*index/steps)], speed=speed, tolerance=5)

        async def stage(number):
            await page.wait_for_function("text => document.querySelector('#mission-count').textContent === text", arg=f"{number:02d} / 11", timeout=5000)
            seen = await observe()
            assert seen["stage"] == f"{number:02d} / 11", seen

        async def wait_offer(text, seconds=25):
            await page.wait_for_function("text => !document.querySelector('#interact').hidden && document.querySelector('#interaction-label').textContent.toLowerCase().includes(text)",arg=text.lower(),timeout=seconds*1000)

        async def wait_stage(number, seconds=25):
            await page.wait_for_function("text => document.querySelector('#mission-count').textContent===text",arg=f"{number:02d} / 11",timeout=seconds*1000)

        async def bow_shot(identifier, label):
            # Read normal-menu Saves until the physical animal is stationary in
            # a feeding/drinking pose with enough time left for a real draw.
            for attempt in range(24):
                snapshot=await save(f"{label}-aim-{attempt:02d}-state")
                actor=snapshot["entities"][identifier]
                assert actor["hp"]>0 and actor["hunt"]["life"]=="alive",actor
                timer=actor["hunt"]["poseTimer"]
                if actor["hunt"]["pose"] in ["drink","browse"] and timer%8<5.5:
                    break
                await page.wait_for_timeout(550)
            else:
                raise AssertionError("No steady ordinary bow sight found")
            target={"x":actor["x"]+math.cos(actor["facing"])*11,"y":actor["y"]+math.sin(actor["facing"])*11,"z":actor.get("z",0)+23}
            # Pure renderer projection. The evaluated function only reads the
            # camera and its world-to-screen transform; it never accesses state.
            pointer=await page.evaluate("""target=>{const g=My3D2dge.current,p=g.r.w(target.x,target.y,target.z),b=document.querySelector('#screen').getBoundingClientRect();const s=g.screen;return {x:b.x+(p[0]*s.S+s.OX-Math.round(s.fx*s.S))/s.dpr,y:b.y+(p[1]*s.S+s.OY-Math.round(s.fy*s.S))/s.dpr};}""",target)
            assert 0<pointer["x"]<1440 and 0<pointer["y"]<1000,pointer
            await page.mouse.move(pointer["x"],pointer["y"])
            await page.keyboard.down("c")
            await page.mouse.down()
            # Wait for the public draw meter. A wall-clock delay can release a
            # partly drawn arrow when a loaded WebKit run advances fewer frames.
            await page.wait_for_function("document.querySelector('#weapon-status').textContent.startsWith('Draw 100%')", timeout=10000)
            await page.mouse.up()
            await page.keyboard.up("c")
            await page.wait_for_timeout(850)
            assert not (await observe())["dialog"],"Physical shot opened failure; driver stops without retry"
            shot=await save(f"{label}-state")
            actual=shot["entities"][identifier]
            assert actual["hp"]==0 and actual["hunt"]["deathMethod"]=="arrow",{"actor":actual,"arrows":shot["bow"]["arrows"],"pointer":pointer}
            assert shot["bow"]["arrows"][-1]["targetId"]==identifier
            await record(label)
            return shot

        try:
            await page.goto(url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await page.locator('[data-panel="menu"]').click()
            async with page.expect_file_chooser() as chooser_info:
                await page.locator('[data-command="import"]').click()
            await (await chooser_info.value).set_files(str(source_save.resolve()))
            await page.locator('#welcome').wait_for(state="hidden")
            baseline=await save("00-imported-rescue-state")
            assert baseline["campaign"]["missions"][RESCUE]["mission"]["completed"]
            assert baseline["campaign"]["missions"][HUNT]["status"]=="unstarted"
            opening=copy.deepcopy(baseline["campaign"]["missions"][OPENING])
            await record("00-imported-rescue")
            await walk([(270,1220),(270,1270),(205,1270),(175,1250)])
            await interact("Orla");await choose("ask-hunters")
            await walk([(205,1270),(270,1270),(270,1170),(380,1170),(380,1230),(355,1250)])
            await interact("Moss");await choose()
            await walk([(390,1250)]);await interact("Vera");await choose()
            await walk([(380,1230),(380,1170),(270,1170)])
            await interact("Juno");await choose("accept-hunt")
            prelude=await save("01-invitation-state");assert prelude["mission"]["stage"]==0 and not prelude["weapons"].get("juno-ash-bow")
            await record("01-invitation")
            await walk([(270,1270),(205,1298)])
            await interact("flour map");await wait_stage(2)
            await walk([(205,1270),(270,1270),(270,1170)])
            prepared=await save("02-map-state")
            horse=prepared["horse"]
            await walk([(horse["x"]-25,horse["y"])])
            await wait_offer("Inspect Juno");await interact("Inspect Juno");await choose()
            await interact("Retrieve and equip")
            equipped=await save("02-equipped-state")
            assert equipped["weapons"]["juno-ash-bow"]["ammo"]+equipped["weapons"]["juno-ash-bow"]["reserve"]==22
            await record("02-equipped")
            await interact("Mount Copper")
            await walk([(375,1140),(375,970),(600,970),(720,760)],speed=150)
            await wait_offer("Willow branch");await interact("Willow branch");await wait_stage(3)
            await record("03-willow-entry")
            await walk([(260,1700),(410,1550),(550,1450),(700,1410),(700,1350),(840,1270)],speed=145)
            await interact("breeze");await choose();await interact("Dismount")
            await walk([(840,1320)]);await interact("Park Copper")
            await wait_stage(4);await choose()
            await save("04-bank-state");await record("04-bank")
            await walk([(900,1228),(975,1210)],speed=58,crouch=True);await interact("split hoof")
            await walk([(1050,1190),(1170,1130),(1120,1145)],speed=58,crouch=True);await interact("cropped")
            await walk([(1280,1130)],speed=58,crouch=True);await interact("fresh sign");await wait_stage(5)
            await bow_shot("willow-creek-doe","05-first-arrow")
            await wait_stage(6)
            await walk([(1340,1050),(1460,970),(1530,920),(1510,945)],speed=58,crouch=True);await interact("hoofprints")
            await walk([(1610,875),(1690,830),(1670,850)],speed=58,crouch=True);await interact("cedar rubbing")
            await walk([(1780,810)],speed=58,crouch=True)
            bodies=await bow_shot("willow-cedar-buck","06-second-arrow");await wait_stage(7)
            buck=bodies["entities"]["willow-cedar-buck"]
            await walk([(buck["x"]-30,buck["y"])],crouch=True,speed=58)
            # Recover the reachable embedded arrow before Inspect becomes the
            # ordinary default interaction, then inspect its whole-body quality.
            await interact("Recover");await interact("Inspect the buck")
            here=await save("07-juno-approach-state");await near_actor(here,"juno")
            await interact("Ask Juno to carry");await choose()
            doe=bodies["entities"]["willow-creek-doe"]
            await walk([(1690,830),(1610,875),(1530,920),(1460,970),(1340,1050),(doe["x"]-30,doe["y"])])
            await interact("Recover");await interact("Inspect the doe");await interact("Lift the doe")
            carried=await save("07-carried-state");assert carried["player"]["carrying"]=="willow-creek-doe"
            await hold(["h"]);await wait_offer("Secure this carcass");await interact("Secure this carcass")
            await wait_stage(8)
            loaded=await save("07-loaded-state")
            assert loaded["entities"]["willow-creek-doe"]["attachment"]["targetId"]=="copper"
            assert loaded["entities"]["willow-cedar-buck"]["attachment"]["targetId"]=="bracken"
            assert loaded["hunt"]["junoCarryDistance"]>20
            await record("07-loaded")
            await interact("Mount Copper");await page.wait_for_timeout(1200)
            await walk([(1790,850),(1850,1015),(1860,1170)],speed=145)
            await save("08-bear-state");await record("08-bear")
            # Both mounts must traverse each gate together. Stop at each actual
            # point and observe ordinary menu Saves while Bracken catches up;
            # riding past an unaccepted gate cannot be repaired by waiting at
            # the final point.
            for index,point in enumerate([(1860,1170),(1800,1190),(1700,1270),(1580,1330)]):
                await walk([point],speed=145)
                for attempt in range(25):
                    detour=await save(f"08-detour-{index+1}-{attempt:02d}-state")
                    if detour["campaign"]["missions"][HUNT]["flags"]["detourIndex"]>=index+1:
                        break
                    await page.wait_for_timeout(500)
                else:
                    raise AssertionError({"unacceptedDetourGate":index+1,"point":point,"flags":detour["campaign"]["missions"][HUNT]["flags"],"bracken":detour["entities"]["bracken"]})
            await wait_offer("sheltered hillside");await interact("sheltered hillside");await choose()
            await walk([(1580,1430),(1480,1430),(1200,1580),(920,1630),(620,1660),(260,1700)],speed=145)
            await wait_offer("Return to Orla");await interact("Return to Orla");await wait_stage(9)
            await save("09-returned-state");await record("09-returned")
            await walk([(600,970),(375,970),(375,1160),(270,1165)],speed=145)
            await interact("Hitch the loaded");await wait_offer("Lift Copper")
            await interact("Lift Copper")
            await walk([(270,1170),(270,1220),(270,1270),(205,1270),(160,1245)],speed=48)
            await interact("first bench")
            await walk([(135,1270)],speed=90);await interact("Hob");await choose()
            await wait_stage(10)
            await save("10-benches-state");await record("10-benches")
            await walk([(175,1220)]);await interact("field skinning knife")
            await walk([(160,1245)]);await interact("Skin your deer")
            await page.wait_for_timeout(1600);await record("10-skinning")
            await wait_stage(11)
            processed=await save("11-processed-state")
            assert processed["camp"]["pantry"]["rawVenison"]==12
            await record("11-processed")
            await walk([(160,1245)]);await interact("Lift your finished hide")
            await walk([(205,1270),(270,1270),(270,1165),(70,1165)]);await interact("drying rack")
            await walk([(260,1160)]);await interact("Della");await choose(f"{hide}-hide")
            await walk([(270,1165),(270,1270),(205,1270),(120,1320)])
            await interact("Begin broth")
            await wait_offer("Share the meal");await interact("Share the meal");await choose()
            completed=await save("12-complete-state")
            assert completed["mission"]["completed"] and completed["flags"]["completedNarrative"]
            assert completed["campaign"]["missions"][OPENING]==opening
            assert completed["camp"]["food"]==baseline["camp"]["food"]+12
            assert completed["camp"]["pantry"]["rawVenison"]==10 and completed["camp"]["pantry"]["tableBroth"]==2
            assert completed["itemInstances"]["hunt-hide-doe"]["owner"]==("mara" if hide=="retain" else "community")
            assert completed["entities"]["silas"]["attachment"]["targetId"]=="silas-bed"
            assert completed["weapons"]["coach-gun"]["owner"]=="mara"
            assert completed["performance"]["deerKilled"]==2
            await record("12-complete")
            await page.reload();await page.locator('#continue-game').click()
            reloaded=await save("13-reloaded-state")
            reload_validation=verify_reload(completed,reloaded)
            await record("13-reloaded")
            final=await observe()
            assert not errors and not final["engineErrors"],{"errors":errors,"engineErrors":final["engineErrors"]}
            result.update({"passed":True,"final":final,"performance":completed["performance"],"stats":completed["stats"],"camp":completed["camp"],"honor":completed["honor"],"saveReloadPreserved":True,"reloadValidation":reload_validation})
        except Exception as error:
            result["failure"]=str(error) or type(error).__name__
            result["traceback"]=traceback.format_exc()
            try:
                result["final"]=await observe(); await page.screenshot(path=str(output/"failure.png"))
            except Exception as observation_error:
                result["observationFailure"]=str(observation_error)
        finally:
            (output/"report.json").write_text(json.dumps(result,indent=2)+"\n")
            print(json.dumps(result),flush=True)
            await browser.close()
    return result["passed"]


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",default="http://127.0.0.1:4173")
    parser.add_argument("--output",type=Path,default=Path("/tmp/dust-mercy-hunt-playthrough"))
    parser.add_argument("--engine",choices=["chromium","firefox","webkit"],default="chromium")
    parser.add_argument("--source-save",type=Path,default=Path("/tmp/dust-mercy-rescue-chromium-final/11-reloaded-state.json"))
    parser.add_argument("--hide",choices=["retain","donate"],default="retain")
    args=parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.url,args.output,args.engine,args.source_save,args.hide)) else 1)
