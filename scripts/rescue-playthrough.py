#!/usr/bin/env python3
"""Play A Voice Under Ice through public keyboard/mouse controls.

Start through the visible Import save file menu using a documented game-generated
v1 completed-opening artifact. This is an import/continuation proof, not a fresh
connected two-mission journey. Evaluations read only camera/UI and normal-menu
Saves. No runtime writes, teleports, injected saves or simulation calls. J is the
game's ordinary nearest-hostile keyboard aiming action; report that limitation.
"""
import argparse
import asyncio
import copy
import json
import math
import os
from pathlib import Path

os.environ.setdefault("PLAYWRIGHT_HOST_PLATFORM_OVERRIDE", "ubuntu24.04-x64")
from playwright.async_api import async_playwright
from campaign_save import normalize_campaign_save

RESCUE = "snowbound-a-voice-under-ice"
OPENING = "snowbound-the-last-warm-light"


async def run(url, output, engine, source_save, case="recover"):
    output.mkdir(parents=True, exist_ok=True)
    errors, events = [], []
    result = {"passed": False, "browser": engine, "url": url, "events": events, "errors": errors,
        "sourceSave": str(source_save.resolve()), "sourceVersion": json.loads(source_save.read_text())["version"],
        "startMode": "Visible Import save file menu and browser file chooser",
        "inputMode": "Public keyboard/mouse movement, E/context actions, menus/dialog choices and J nearest-hostile firing",
        "caveat": "Continues an imported game-generated opening Save; no fresh connected journey or physical hardware proof. J uses the game's normal hostile aiming helper.",
        "case": case}
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
            await page.wait_for_function("text => document.querySelector('#mission-count').textContent === text", arg=f"{number:02d} / 10", timeout=5000)
            seen = await observe()
            assert seen["stage"] == f"{number:02d} / 10", seen

        async def fight(wave, label):
            for turn in range(26):
                assert not (await observe())["dialog"], "Combat opened a dialogue or checkpoint failure before Save"
                snapshot = await save(f"{label}-combat-{turn:02d}")
                assert snapshot["mission"]["stage"] in [7,8], snapshot["mission"]
                assert snapshot["flags"]["loadingHandoff"], "Combat unexpectedly reset the loading checkpoint"
                enemies = [snapshot["entities"][wolf["id"]] for wolf in snapshot["predators"] if wolf["wave"]==wave]
                remaining = [wolf for wolf in snapshot["predators"] if wolf["wave"]==wave and wolf["phase"] not in ["dead", "fled"]]
                if not remaining:
                    return snapshot
                if snapshot["player"]["hp"] < 55 and snapshot["inventory"].get("tonic", 0):
                    await hold(["1"])
                if snapshot["player"]["ammo"] == 0:
                    if snapshot["player"]["reserve"]:
                        await hold(["r"])
                        await page.wait_for_timeout(1900)
                    else:
                        await hold(["i"])
                        await page.locator('[data-command="equipment"][data-id="equip:mara-revolver"]').click()
                        await hold(["Escape"])
                    continue
                await hold(["j"], 85)
                await page.wait_for_timeout(700)
                assert not (await observe())["dialog"], "Shot opened a checkpoint failure; driver stops without retrying"
            raise AssertionError(f"Wolf wave {wave} remained unresolved: {await observe()}")

        try:
            await page.goto(url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await page.locator('[data-panel="menu"]').click()
            async with page.expect_file_chooser() as chooser_info:
                await page.locator('[data-command="import"]').click()
            await (await chooser_info.value).set_files(str(source_save.resolve()))
            await page.locator('#welcome').wait_for(state="hidden")
            await page.wait_for_timeout(180)
            imported = await save("00-imported-opening-state")
            assert imported["mission"]["completed"]
            historical_opening = copy.deepcopy(imported["campaign"]["missions"][OPENING])
            await record("00-imported-opening")
            await walk([(425, 1230)])
            await interact("Elin"); await choose("accept-rescue"); await stage(2)
            prepared = await save("01-rescue-kit-state")
            await walk([(380,1230),(380,1180)])
            await near_actor(prepared, "tomas"); await interact("Tomas"); await choose()
            prepared = await save("01-after-tomas-state")
            await near_actor(prepared, "inez"); await interact("Inez"); await choose()
            prepared = await save("01-prepared-state")
            await walk([(prepared["horse"]["x"], prepared["horse"]["y"])])
            await interact("Inspect")
            await interact("Mount Copper")
            await walk([(375, 970), (600, 970), (720, 760)], speed=135)
            for _ in range(40):
                if "northern trail" in ((await observe())["interaction"] or "").lower():
                    break
                await page.wait_for_timeout(150)
            await interact("northern trail"); await stage(3); await record("02-northern-departure")
            await walk([(390,1450),(530,1350),(600,1350),(650,1190),(760,1080)], speed=135)
            await interact("Dismount")
            for point, label in [((760,1080),"embers"),((792,1070),"bootprints"),((735,1095),"wrapper")]:
                await walk([point]); await interact(label)
            await stage(4); await record("03-ash-trail")
            ash = await save("03-ash-trail-state")
            await walk([(ash["horse"]["x"],ash["horse"]["y"])])
            await interact("Mount")
            await walk([(850,1080),(975,1100),(1040,1080)], speed=135)
            await interact("Dismount"); await interact("scrape"); await hold(["h"])
            await walk([(1160,1080),(1150,975)]); await interact("hoofprints"); await stage(5)
            ford = await save("04-ford-state")
            await walk([(ford["horse"]["x"],ford["horse"]["y"])])
            await interact("Mount")
            await walk([(1280,875),(1450,750),(1550,730)], speed=135)
            await interact("Dismount"); await walk([(1550,730)]); await interact("Lark"); await choose()
            await interact("signal"); await page.wait_for_timeout(2250); await record("05-signal-answer")
            await hold(["h"]); await walk([(1450,730),(1460,620)])
            await interact("Hitch"); await page.wait_for_timeout(2250); await stage(6)
            await interact("Retrieve"); await walk([(1540,590)])
            await interact("Climb"); await page.wait_for_timeout(2350)
            await hold(["i"])
            await page.locator('[data-command="use"][data-id="warmRation"]').click()
            await hold(["Escape"])
            await interact("Climb"); await page.wait_for_timeout(2650)
            await interact("Brace"); await page.wait_for_timeout(2550)
            await interact("Crouch"); await page.wait_for_timeout(1950)
            await interact("rope")
            await walk([(1760,430)], speed=55, crouch=True)
            await interact("Climb"); await page.wait_for_timeout(2950); await stage(7)
            await walk([(1900,365)])
            # The normal context prioritizes the breathing check over optional talk.
            await interact("breathing"); await interact("Dress")
            await record("06-silas-stabilized")
            stabilized = await save("06-silas-stabilized-state")
            await interact("Lift")
            if case == "recover":
                await walk([(1860,420)], speed=48)
                for _ in range(60):
                    if "Lower Silas" in ((await observe())["interaction"] or ""):
                        await interact("Lower Silas")
                        lowered = await save("06-rest-pad-state")
                        if lowered["player"]["carrying"] is None:
                            break
                    await page.wait_for_timeout(180)
                else:
                    raise AssertionError("Inez never reached the sheltered pad")
                # The case and sheltered patient are close together; approach
                # the case from the west outside Silas's lifting radius.
                await walk([(1815,432)], tolerance=5)
                if "Listen to Silas" in ((await observe())["interaction"] or ""):
                    await interact("Listen"); await choose()
                await interact("dispatch case")
                await record("06-secured-dispatch-case")
                await walk([(1860,420)])
                await interact("Lift")
            await walk([(1810,490)], speed=48)
            for number, duration in [(1,3350),(2,3150),(3,3150)]:
                await interact("Hand Silas")
                await page.wait_for_timeout(duration)
                await interact("Climb down")
                await page.wait_for_timeout(duration)
                await interact("Receive Silas")
                await record(f"06-handoff-{number}")
            await stage(8)
            await interact("loading spur")
            await walk([(1400,650),(1400,745),(1320,745)])
            await interact("Call the wolves")
            await walk([(1400,790),(1640,790)])
            await fight(0,"07-pack")
            loading = await save("07-loading-state")
            await near_actor(loading,"thimble"); await interact("lift Silas")
            await interact("strap"); await record("07-strapped-passenger")
            mounted = await save("07-passenger-state")
            await walk([(mounted["horse"]["x"],mounted["horse"]["y"])])
            await interact("Mount")
            await page.wait_for_timeout(150); await stage(9)
            await walk([(1380,750)], speed=135)
            await fight(1,"08-first-pursuit")
            await walk([(1240,875)], speed=135)
            await fight(2,"08-second-pursuit")
            await walk([(1150,1020),(1080,1100)], speed=120)
            await record("08-enter-return-creek")
            # Inez leads the water route; keep pace and wait at authored bends.
            for point in [(1080,1100),(925,1190),(790,1275),(650,1340)]:
                await follow_line(point)
                await page.wait_for_timeout(750)
            concealed = await save("08-concealed-trail-state")
            assert concealed["flags"]["creekConcealed"], concealed["tracks"]["creek"]
            assert concealed["tracks"]["creek"]["copper"]>=180 and concealed["tracks"]["creek"]["thimble"]>=180
            await record("08-both-mounts-concealed")
            await walk([(620,1380)], speed=100); await interact("left bank")
            await walk([(420,1460),(250,1560)], speed=135); await interact("Return to the kiln")
            await stage(10); await record("09-kiln-return")
            await walk([(600,970),(375,970),(375,1160)],speed=130)
            await interact("Dismount")
            await page.wait_for_timeout(1000)
            await interact("Lift Silas from Thimble")
            await walk([(380,1160)],speed=48)
            await interact("Moss and Vera")
            await walk([(380,1200),(380,1235),(365,1270)])
            await page.wait_for_timeout(3000)
            await interact("Elin and Fin"); await choose()
            home = await save("09-family-state")
            await walk([(380,1235),(380,1200),(380,1180)])
            await near_actor(home,"tomas"); await interact("Tomas"); await choose()
            home = await save("09-thanks-state")
            await near_actor(home,"della"); await interact("Della"); await choose()
            await interact("journal")
            completed = await save("10-complete-state")
            assert completed["mission"]["completed"]
            assert completed["campaign"]["missions"][OPENING]==historical_opening
            assert completed["entities"]["silas"]["attachment"]["targetId"]=="silas-bed"
            assert completed["weapons"]["coach-gun"]["owner"]=="mara"
            assert completed["weapons"]["coach-gun"]["loanMissionId"] is None
            assert completed["flags"]["caseCollected"]==(case=="recover")
            await record("10-voice-home")
            await page.reload(); await page.locator('#continue-game').click()
            reloaded = await save("11-reloaded-state")
            # Ordinary Resume/Continue lets the world clock advance. Verify its
            # authored bedside healing exactly, then compare all other graph
            # fields instead of treating legitimate recovery as lost state.
            elapsed = reloaded["elapsed"]-completed["elapsed"]
            assert 0<=elapsed<10, f"unexpected reload observation interval {elapsed}"
            after_campaign = copy.deepcopy(reloaded["campaign"])
            before_clinic = completed["campaign"]["missions"][RESCUE]["rescue"]["silas"]
            after_clinic = after_campaign["missions"][RESCUE]["rescue"]["silas"]
            for key,rate in [("healingHours",80),("injury",80*18)]:
                assert abs(after_clinic[key]-max(0,before_clinic[key]-elapsed/rate))<1e-7, f"scheduled {key} changed incorrectly"
                after_clinic[key]=before_clinic[key]
            assert after_campaign==completed["campaign"], "durable mission records changed on normal reload"
            for key in ["inventory","weapons","camp","companions","sideQuests","wanted","honor","stats","regions"]:
                assert reloaded[key]==completed[key], f"durable {key} changed on normal reload"
            for identifier, before in completed["entities"].items():
                after = reloaded["entities"][identifier]
                for key in ["id","category","regionId","attachment","owned","ownerId","pack","equippedWeaponId","money","mounted","carrying","coldcoat","lantern","scars","injured","coatRepaired"]:
                    assert after.get(key)==before.get(key), f"durable {identifier}.{key} changed on reload"
                expected_hp=min(100,before["hp"]+elapsed/160) if identifier=="silas" else before["hp"]
                assert abs(after["hp"]-expected_hp)<1e-7, f"durable {identifier}.hp changed outside scheduled healing"
            await record("11-reloaded-home")
            await hold(["l"])
            await page.locator('.journal-illustration svg').wait_for(state="visible")
            assert "Silas" in await page.locator('.journal-illustration svg title').text_content()
            await page.locator('[data-command="notebook"]').click()
            await page.wait_for_function("""() => {
              const panel=document.querySelector('#panel').getBoundingClientRect();
              const drawing=document.querySelector('.journal-illustration svg').getBoundingClientRect();
              return drawing.top>=panel.top && drawing.bottom<=panel.bottom;
            }""", timeout=4000)
            await record("12-notebook-drawing")
            await hold(["Escape"])
            final = await observe()
            assert not errors and not final["engineErrors"], {"errors":errors,"engineErrors":final["engineErrors"]}
            result.update({"passed":True,"final":final,"performance":completed["performance"],"stats":completed["stats"],"camp":completed["camp"],"honor":completed["honor"],"saveReloadPreserved":True})
        except Exception as error:
            result["failure"]=str(error)
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
    parser.add_argument("--output",type=Path,default=Path("/tmp/dust-mercy-rescue-playthrough"))
    parser.add_argument("--engine",choices=["chromium","firefox","webkit"],default="chromium")
    parser.add_argument("--source-save",type=Path,default=Path(__file__).resolve().parent.parent/"tests/fixtures/opening-v1-complete.json")
    parser.add_argument("--case",choices=["recover","omit"],default="recover")
    args=parser.parse_args()
    raise SystemExit(0 if asyncio.run(run(args.url,args.output,args.engine,args.source_save,args.case)) else 1)
