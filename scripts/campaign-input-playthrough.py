#!/usr/bin/env python3
"""Complete the opening with visible phone pointers or an emulated Gamepad.

Pointer mode drags the visible joystick through Playwright's mouse pointer API
in a coarse/touch phone context. Menus and choices use actual touchscreen taps.
WebKit exposes no public touch-drag API; this is not native touch-drag or iOS
hardware evidence. The visible Fire control uses its normal hostile targeting.

Controller mode writes only an isolated standard-Gamepad input fixture, polled
by the normal game input path. It moves with axes, uses buttons, and selects
modal controls through D-pad/A. It never falls back to keyboard/mouse/touch and
is not physical-controller evidence.

Observers read camera/UI and saves produced through the ordinary Save journey
menu. Neither mode writes simulation objects or saves, calls simulation verbs,
or teleports actors. Artifacts go to /tmp by default.
"""
import argparse
import asyncio
import json
import math
import os
from pathlib import Path

os.environ.setdefault("PLAYWRIGHT_HOST_PLATFORM_OVERRIDE", "ubuntu24.04-x64")
from playwright.async_api import async_playwright
from campaign_save import normalize_campaign_save


async def run(url, output, engine, pavel_outcome="bind", rescue_priority="carry-gideon-first", voss_outcome="escape", device="iPhone SE (3rd gen)", mode="pointer"):
    output.mkdir(parents=True, exist_ok=True)
    errors, events = [], []
    result = {"passed": False, "browser": engine, "url": url, "events": events, "errors": errors}
    async with async_playwright() as playwright:
        browser = await getattr(playwright, engine).launch(headless=True)
        if mode == "pointer":
            assert engine != "firefox", "Use Chromium or WebKit for a mobile touch profile"
            profile = playwright.devices[device]
            assert profile["has_touch"], "Choose a touch-device profile"
            context = await browser.new_context(**profile)
            result["device"] = device
            result["viewport"] = profile["viewport"]
            result["caveat"] = "Mouse pointer drag on visible coarse-media joystick; touchscreen taps on menus/dialog. No native touch-drag or hardware proof."
        else:
            context = await browser.new_context(viewport={"width": 1440, "height": 1000})
            result["device"] = "Desktop with emulated standard Gamepad"
            result["viewport"] = {"width": 1440, "height": 1000}
            result["caveat"] = "Only the standard-Gamepad input fixture is written. No simulation mutation, keyboard/mouse/touch fallback, or physical-controller proof."
        page = await context.new_page()
        action_counts = {"joystick_drags": 0, "visible_action_holds": 0, "touchscreen_taps": 0,
            "gamepad_axis_holds": 0, "gamepad_button_holds": 0, "controller_modal_selections": 0, "keyboard_events": 0}
        result["mode"] = mode
        result["inputEvidence"] = action_counts
        if mode == "controller":
            await page.add_init_script("""
                window.campaignInputPad={index:0,id:'Automated standard Gamepad input fixture',mapping:'standard',connected:true,
                    axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
                Object.defineProperty(navigator,'getGamepads',{value:()=>[campaignInputPad]});
            """)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

        async def observe():
            return await page.evaluate("""() => {
                const g = My3D2dge.current;
                return {x:g.cam.tx,y:g.cam.ty+g.H*.1/g.view.by,
                    stage:document.querySelector('#mission-count').textContent,
                    objective:document.querySelector('#objective-text').textContent,
                    health:document.querySelector('#health-ring').getAttribute('aria-valuenow'),
                    interaction:document.querySelector('#interact').hidden ? null : document.querySelector('#interaction-label').textContent,
                    dialog:document.querySelector('#conversation').open,
                    choices:[...document.querySelectorAll('[data-choice]')].map(el=>el.dataset.choice),
                    engineErrors:g.errors};
            }""")

        async def pad_button(index, milliseconds=100):
            await page.evaluate("i=>campaignInputPad.buttons[i]={pressed:true,value:1}", index)
            await page.wait_for_timeout(milliseconds)
            await page.evaluate("i=>campaignInputPad.buttons[i]={pressed:false,value:0}", index)
            await page.wait_for_timeout(160)
            action_counts["gamepad_button_holds"] += 1

        async def tap(selector, timeout=18000):
            if mode == "controller":
                await page.locator(selector).wait_for(state="visible", timeout=timeout)
                for _ in range(40):
                    if await page.evaluate("sel=>document.activeElement?.matches(sel)", selector):
                        await pad_button(0)
                        action_counts["controller_modal_selections"] += 1
                        return
                    await pad_button(13)
                raise AssertionError(f"Gamepad cannot navigate to {selector}")
            await page.locator(selector).tap(timeout=timeout)
            action_counts["touchscreen_taps"] += 1

        async def open_menu():
            if mode == "controller":
                await pad_button(8)
            else:
                await tap('[data-panel="menu"]')
            await page.wait_for_timeout(100)

        async def start_or_continue(continuing=False):
            if mode == "controller":
                if continuing:
                    await open_menu()
                    await tap('[data-command="load"]')
                else:
                    await pad_button(9)
            else:
                await tap('#continue-game' if continuing else '#new-game')

        async def pointer_hold(selector, milliseconds=90):
            locator = page.locator(selector)
            await locator.wait_for(state="visible")
            rect = await locator.bounding_box()
            assert rect, selector
            cx, cy = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
            await page.mouse.move(cx, cy)
            await page.mouse.down()
            await page.wait_for_timeout(milliseconds)
            await page.mouse.up()
            await page.wait_for_timeout(70)
            action_counts["visible_action_holds"] += 1

        async def move_direction(direction, milliseconds):
            if mode == "controller":
                axis, value = {"up": (1,-1), "left": (0,-1), "down": (1,1), "right": (0,1)}[direction]
                await page.evaluate("([axis,value])=>campaignInputPad.axes[axis]=value", [axis, value])
                await page.wait_for_timeout(milliseconds)
                await page.evaluate("axis=>campaignInputPad.axes[axis]=0", axis)
                await page.wait_for_timeout(65)
                action_counts["gamepad_axis_holds"] += 1
                return
            rect = await page.locator("#joystick").bounding_box()
            assert rect, "Visible joystick missing"
            cx, cy = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
            radius = rect["width"] / 2 - 14
            dx, dy = {"up": (0,-1), "left": (-1,0), "down": (0,1), "right": (1,0)}[direction]
            await page.mouse.move(cx, cy)
            await page.mouse.down()
            await page.mouse.move(cx + dx * radius, cy + dy * radius, steps=3)
            await page.wait_for_timeout(milliseconds)
            await page.mouse.move(cx, cy, steps=3)
            await page.mouse.up()
            await page.wait_for_timeout(65)
            action_counts["joystick_drags"] += 1

        async def action(name, milliseconds=90):
            if mode == "controller":
                if name == "tonic":
                    await open_menu()
                    await tap('[data-command="panel"][data-id="satchel"]')
                    await tap('[data-command="use"][data-id="tonic"]')
                    await pad_button(8)
                    return
                buttons = {"fire": 7, "reload": 2, "block": 4, "shove": 0, "restrain": 0, "holster": 3}
                await pad_button(buttons[name], milliseconds)
                return
            if name == "tonic":
                await tap('[data-panel="satchel"]')
                await tap('[data-command="use"][data-id="tonic"]')
                await tap('#close-panel')
                await page.wait_for_timeout(100)
                return
            selectors = {"fire": '[data-action="shoot"]', "reload": "#reload",
                "block": '[data-story-action="block"]', "shove": '[data-story-action="shove"]',
                "restrain": '[data-story-action="restrain"]', "holster": '[data-story-action="holster"]'}
            await pointer_hold(selectors[name], milliseconds)

        async def interact():
            await page.wait_for_timeout(150)
            if mode == "controller":
                await pad_button(0)
            else:
                await tap("#interact", timeout=5000)
            await page.wait_for_timeout(160)

        async def choose(identifier):
            await tap(f'[data-choice="{identifier}"]')
            await page.wait_for_timeout(180)

        async def record(label):
            event = {"label": label, **await observe(), "screenshot": f"{label}.png"}
            await page.screenshot(path=str(output / event["screenshot"]))
            events.append(event)
            print(json.dumps(event), flush=True)

        async def save(label):
            observed = await observe()
            assert not observed["dialog"], observed
            assert not observed["engineErrors"], observed["engineErrors"]
            await open_menu()
            await tap('[data-command="save"]')
            snapshot = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
            (output / f"{label}.json").write_text(json.dumps(snapshot, indent=2) + "\n")
            snapshot = normalize_campaign_save(snapshot)
            await tap('[data-command="resume"]')
            await page.wait_for_timeout(80)
            assert snapshot["region"] == "snowbound"
            assert not snapshot["failure"], snapshot["failure"]
            return snapshot

        async def walk(route, speed=76, tolerance=10):
            for target_x, target_y in route:
                stuck = 0
                for _ in range(100):
                    before = await observe()
                    assert not before["dialog"], before
                    assert not before["engineErrors"], before["engineErrors"]
                    dx, dy = target_x - before["x"], target_y - before["y"]
                    if math.hypot(dx, dy) < tolerance:
                        break
                    horizontal = abs(dx) > abs(dy)
                    direction = ("right" if dx > 0 else "left") if horizontal else ("down" if dy > 0 else "up")
                    amount = abs(dx) if horizontal else abs(dy)
                    await move_direction(direction, min(650, max(50, amount / speed * 1000)))
                    after = await observe()
                    stuck = stuck + 1 if math.hypot(after["x"]-before["x"], after["y"]-before["y"]) < 0.5 else 0
                    if stuck >= 5:
                        raise AssertionError(f"Route blocked toward {target_x},{target_y}: {after}")
                else:
                    raise AssertionError(f"Route did not reach {target_x},{target_y}: {await observe()}")

        async def fire_once():
            # Fire/RT follows the game's normal hostile targeting without a world aim tap.
            await action("fire")
            await page.wait_for_timeout(400)

        async def expect_stage(number):
            observed = await observe()
            assert observed["stage"] == f"{number:02d} / 09", observed

        try:
            await page.goto(url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await start_or_continue()
            await page.wait_for_timeout(250)
            await record("01-cold-refuge")
            for number, point in enumerate([(350, 1075), (375, 1080), (305, 1115)]):
                await walk([point])
                await page.wait_for_timeout(160)
                await interact()
                if number < 2:
                    await save(f"01-preparation-{number + 1}-state")
            await choose("accept-journey")
            await expect_stage(2)
            await walk([(375, 1155)])
            await interact()
            departure = await save("02-departure-state")
            assert departure["player"]["mounted"] and departure["player"]["coldcoat"] and departure["player"]["lantern"]
            await record("02-mounted-departure")
            await walk([(375, 1025), (465, 1025), (465, 1000), (610, 920), (760, 780)], speed=125)
            await interact(); await interact(); await choose("join-inez")
            await record("03-inez-wire")
            await walk([(875, 710), (970, 640), (1100, 565)], speed=125)
            await expect_stage(3)
            await interact()
            await walk([(1170, 605), (1230, 605)])
            await interact(); await interact(); await choose("company-message")
            await record("04-company-approach")
            await choose("stand-ground")
            await expect_stage(4)
            await record("05-yard-combat")
            if voss_outcome == "capture":
                # Defeat the flanker first, then approach the gauge guard beside
                # Voss. This leaves Mara close enough to intercept his retreat.
                await walk([(1170, 660), (1200, 660)])
                for shot in range(8):
                    await fire_once()
                    combat = await save(f"05-flanker-shot-{shot + 1}")
                    if next(enemy for enemy in combat["enemies"] if enemy["id"] == "chute-flanker")["hp"] == 0:
                        break
                    if combat["player"]["ammo"] == 0:
                        await action("reload"); await page.wait_for_timeout(1850)
                else:
                    raise AssertionError("The flanker survived the capture approach")
                if combat["player"]["hp"] < 70:
                    await action("tonic")
                await walk([(1170, 660), (1170, 540), (1385, 540), (1385, 475), (1338, 475)])
                if combat["player"]["ammo"] < 2:
                    await action("reload"); await page.wait_for_timeout(1850)
                await fire_once(); await fire_once()
                await expect_stage(5)
                assert "Restrain Ansel Voss" in ((await observe())["interaction"] or ""), await observe()
                await interact(); await record("06-voss-captured")
            else:
                await walk([(1170, 605), (1170, 510)])
                await fire_once(); await fire_once()
                await walk([(1170, 645)])
                for shot in range(7):
                    if (await observe())["stage"] == "05 / 09":
                        break
                    if shot == 3:
                        await action("reload"); await page.wait_for_timeout(1850)
                    await fire_once()
            await expect_stage(5)
            yard = await save("06-yard-cleared-state")
            assert all(enemy["hp"] == 0 for enemy in yard["enemies"] if enemy["id"] in ["gauge-guard", "chute-flanker"])
            if voss_outcome == "capture":
                assert next(enemy for enemy in yard["enemies"] if enemy["id"] == "voss")["captured"]
            await record("06-yard-cleared")

            # Enter the relay through the authored west service doorway.
            await walk([(1170, 510), (1255, 510), (1255, 345), (1335, 345)])
            for point in [(1330, 280), (1430, 260), (1515, 285), (1515, 380), (1420, 370), (1330, 385)]:
                await walk([point]); await interact()
            supplies = await save("07-six-supplies-state")
            assert all(item["collected"] for item in supplies["supplies"] if item["id"] != "logbook"), "A supply pickup was missed"
            await record("07-relay-supplies")
            await walk([(1335, 345), (1255, 345), (1170, 345), (1170, 680), (1180, 760)])
            await interact()
            await expect_stage(6)
            await record("08-coal-disarm")
            await action("block", 1300)
            await action("shove"); await page.wait_for_timeout(400); await action("shove"); await action("restrain")
            ambush = await save("09-pavel-subdued-state")
            assert ambush["flags"]["pavelSubdued"]
            for item in ["weapon", "token"]:
                dropped = ambush["dropped"][item]
                await walk([(dropped["x"], dropped["y"])])
                await interact()
            pavel = next(actor for actor in ambush["npcs"] if actor["id"] == "pavel")
            await walk([(pavel["x"], pavel["y"])])
            await interact(); await record("09-pavel-interrogation"); await choose(f"{pavel_outcome}-pavel")
            await expect_stage(7)

            # Exit the coal store through its north door, then reach the pen gate.
            await walk([(1180, 760), (1180, 680), (1320, 680), (1320, 735), (1465, 735), (1465, 615), (1505, 615)])
            if await page.locator('#holster-label').inner_text() == 'Holster':
                await action("holster")
            await interact()
            for _ in range(5):
                current = await observe()
                if current["interaction"] != "Calm Copper":
                    break
                await interact()
            await walk([(1530, 615)])
            await interact(); await interact()
            await record("10-copper-leading")
            await walk([(1450, 615), (1465, 615), (1465, 735), (1320, 735), (1320, 650), (1160, 650), (1100, 565)])
            await page.wait_for_timeout(1500)
            await interact(); await record("11-copper-assignment"); await choose("accept-copper")
            await expect_stage(8)
            copper = await save("11-copper-owned-state")
            assert copper["horse"]["id"] == "copper" and copper["horse"]["owned"]
            assert not copper["horse"]["ridingUnlocked"]

            await walk([(1170, 510), (1270, 490), (1280, 445)])
            await interact(); await record("12-ada-alarm"); await choose(rescue_priority)
            await walk([(1270, 490)]); await interact()
            async def escort_ada():
                # The log promise starts inside the relay room; Gideon-first
                # starts outside on the safe walkway and uses the west door.
                # Approach Ada from her north side, outside Gideon’s overlapping
                # higher-priority carry radius, so E addresses the shown offer.
                route = [(1360, 345), (1390, 270)] if rescue_priority == "preserve-log" else [(1255, 345), (1360, 345), (1390, 270)]
                await walk(route)
                assert "Guide Ada" in ((await observe())["interaction"] or ""), await observe()
                await interact()
                # Wait at the route corners so the escort stays physically close.
                for point in [(1360, 345), (1260, 345), (1220, 430), (1130, 430)]:
                    await walk([point]); await page.wait_for_timeout(600)
                await page.wait_for_timeout(1400)
                escorted = await save("13-ada-safe-state")
                assert escorted["flags"]["adaSafe"]
                await record("13-ada-service-walkway")

            async def carry_gideon():
                await walk([(1255, 345), (1360, 345), (1430, 325)])
                await interact()
                await record("14-gideon-carry")
                carried = await save("14-gideon-carried-state")
                assert carried["player"]["carrying"] == "gideon"
                assert next(actor for actor in carried["npcs"] if actor["id"] == "gideon")["carried"]
                await walk([(1360, 345), (1260, 345), (1220, 430), (1130, 430)], speed=48)

            if rescue_priority == "preserve-log":
                await walk([(1255, 345), (1360, 345), (1480, 325)])
                await interact()
                await escort_ada()
                await carry_gideon()
            else:
                await carry_gideon()
                await escort_ada()
            await expect_stage(9)
            rescued = await save("15-rusks-safe-state")
            assert rescued["flags"]["adaSafe"] and rescued["flags"]["gideonSafe"]
            assert rescued["worldChanges"]["boilerDestroyed"] and rescued["worldChanges"]["relayCircuitOff"]
            await record("15-relay-destruction")
            await walk([(1100, 650), (1045, 650), (1000, 780), (600, 970), (375, 970), (375, 1140), (350, 1140)])
            await page.wait_for_timeout(2200)
            await interact()
            before = await save("16-complete-state")
            assert before["mission"]["completed"] and before["mission"]["rewardPaid"]
            assert before["flags"]["suppliesDeposited"] and before["camp"]["stoveLit"]
            assert before["sideQuests"]["silas"]["unlocked"] and not before["sideQuests"]["silas"]["complete"]
            assert before["horse"]["ridingUnlocked"] and before["horse"]["storageUnlocked"]
            await record("16-light-at-kiln")
            await page.reload()
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await start_or_continue(continuing=True)
            await page.wait_for_timeout(300)
            after = await save("17-reloaded-state")
            for key in ["mission", "inventory", "supplies", "flags", "worldChanges", "camp", "companions", "performance", "sideQuests", "wanted", "dropped"]:
                assert after[key] == before[key], f"reloaded {key} differs"
            # Residents may continue walking toward their camp homes after load.
            # Their persistent identity, life, ownership and branch state must match.
            actor_fields = ["id", "name", "kind", "hp", "owned", "captured", "escaped", "bound", "released",
                "hidden", "carried", "mounted", "hitched", "leading", "fear", "bond"]
            def persistent_actors(snapshot, collection):
                return sorted([{key: actor.get(key) for key in actor_fields} for actor in snapshot[collection]], key=lambda actor: actor["id"])
            for collection in ["npcs", "enemies", "animals", "mounts"]:
                assert persistent_actors(after, collection) == persistent_actors(before, collection), f"reloaded {collection} persistent state differs"
            for key in ["id", "name", "hp", "owned", "bond", "pack", "careUnlocked", "ridingUnlocked", "storageUnlocked"]:
                assert after["horse"].get(key) == before["horse"].get(key), f"reloaded horse {key} differs"
            for key in ["hp", "mounted", "ammo", "reserve", "carrying", "weaponOwned", "holstered", "coldcoat", "lantern", "money"]:
                assert after["player"][key] == before["player"][key], f"reloaded player {key} differs"
            assert after["stats"] == before["stats"], "reloaded statistics differ"
            assert after["stats"]["shots"] == before["stats"]["shots"]
            assert after["stats"]["deaths"] == before["stats"]["deaths"] == 0
            assert after["honor"] == before["honor"] == {"release": 5, "bind": 2, "kill": -20}[pavel_outcome]
            assert after["flags"]["pavelChoice"] == pavel_outcome
            assert after["flags"]["rescuePriority"] == rescue_priority
            assert after["worldChanges"]["logRecovered"] == (rescue_priority == "preserve-log")
            assert after["companions"]["gideon"]["severity"] == (2 if rescue_priority == "preserve-log" else 1)
            assert after["camp"]["pavelGuarded"] == (pavel_outcome == "bind")
            voss = next(enemy for enemy in after["enemies"] if enemy["id"] == "voss")
            assert voss["captured"] == (voss_outcome == "capture")
            assert voss["escaped"] == (voss_outcome == "escape")
            assert after["worldChanges"]["vossFutureCheckpoint"] == (voss_outcome == "escape")
            assert not errors, errors
            assert not (await observe())["engineErrors"]
            await record("17-reloaded-complete")
            result.update(passed=True, method=("emulated standard Gamepad axes/buttons; D-pad/A choices and ordinary menu Save/Load; no keyboard/mouse/touch" if mode == "controller" else "visible joystick mouse-pointer drags, action-button holds, touchscreen menu/dialog taps; no keyboard"), stats=after["stats"], performance=after["performance"], vitals={"health": after["player"]["hp"], "honor": after["honor"], "bounty": after["wanted"]["bounty"], "money": after["player"]["money"]}, camp=after["camp"], mission=after["mission"], choices={"pavel": after["flags"]["pavelChoice"], "rescue": after["flags"]["rescuePriority"], "voss": voss_outcome})
        except Exception as error:
            result["failure"] = str(error)
            result["last_observation"] = await observe()
            await page.screenshot(path=str(output / "failure.png"))
            raise
        finally:
            (output / "report.json").write_text(json.dumps(result, indent=2) + "\n")
            await browser.close()
        print(json.dumps({"passed": True, "report": str(output / "report.json")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", default="http://127.0.0.1:4173")
    parser.add_argument("--engine", choices=["chromium", "firefox", "webkit"], default="webkit")
    parser.add_argument("--mode", choices=["pointer", "controller"], default="pointer")
    parser.add_argument("--device", default="iPhone SE (3rd gen)")
    parser.add_argument("--output", type=Path, default=Path("/tmp/dust-mercy-campaign-input-playthrough"))
    parser.add_argument("--pavel", choices=["release", "bind", "kill"], default="bind")
    parser.add_argument("--rescue", choices=["preserve-log", "carry-gideon-first"], default="carry-gideon-first")
    parser.add_argument("--voss", choices=["escape", "capture"], default="escape")
    options = parser.parse_args()
    asyncio.run(run(options.url, options.output, options.engine, options.pavel, options.rescue, options.voss, options.device, options.mode))
