#!/usr/bin/env python3
"""Complete The Last Warm Light with public keyboard/mouse controls.

The only browser evaluation reads the camera, UI and saves produced by the
ordinary Save journey menu. It never writes runtime objects or saves, calls
simulation functions, or teleports actors. Screenshots/state evidence goes to
/tmp by default. State tests cover alternative branches separately.
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


async def run(url, output, engine, pavel_outcome="bind", rescue_priority="preserve-log", voss_outcome="escape"):
    output.mkdir(parents=True, exist_ok=True)
    errors, events = [], []
    result = {"passed": False, "browser": engine, "url": url, "events": events, "errors": errors}
    async with async_playwright() as playwright:
        browser = await getattr(playwright, engine).launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 1000})
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

        async def hold(keys, milliseconds=70):
            for key in keys:
                await page.keyboard.down(key)
            await page.wait_for_timeout(milliseconds)
            for key in keys:
                await page.keyboard.up(key)
            await page.wait_for_timeout(65)

        async def interact():
            await hold(["e"])
            await page.wait_for_timeout(130)

        async def choose(identifier):
            await page.locator(f'[data-choice="{identifier}"]').click(timeout=18000)
            await page.wait_for_timeout(180)

        async def record(label):
            event = {"label": label, **await observe(), "screenshot": f"{label}.png"}
            await page.screenshot(path=str(output / event["screenshot"]))
            events.append(event)
            print(json.dumps(event), flush=True)

        async def save(label):
            assert not (await observe())["dialog"], await observe()
            await hold(["Escape"])
            await page.locator('[data-command="save"]').click()
            snapshot = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
            (output / f"{label}.json").write_text(json.dumps(snapshot, indent=2) + "\n")
            snapshot = normalize_campaign_save(snapshot)
            await page.locator('[data-command="resume"]').click()
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
                    dx, dy = target_x - before["x"], target_y - before["y"]
                    if math.hypot(dx, dy) < tolerance:
                        break
                    horizontal = abs(dx) > abs(dy)
                    key = ("d" if dx > 0 else "a") if horizontal else ("s" if dy > 0 else "w")
                    amount = abs(dx) if horizontal else abs(dy)
                    await hold([key], min(650, max(50, amount / speed * 1000)))
                    after = await observe()
                    stuck = stuck + 1 if math.hypot(after["x"]-before["x"], after["y"]-before["y"]) < 0.5 else 0
                    if stuck >= 5:
                        raise AssertionError(f"Route blocked toward {target_x},{target_y}: {after}")
                else:
                    raise AssertionError(f"Route did not reach {target_x},{target_y}: {await observe()}")

        async def fire_once():
            # J uses the game's normal nearest-hostile keyboard aiming action.
            await hold(["j"])
            await page.wait_for_timeout(400)

        async def expect_stage(number):
            observed = await observe()
            assert observed["stage"] == f"{number:02d} / 09", observed

        try:
            await page.goto(url)
            await page.wait_for_function('globalThis.My3D2dge?.current?._running')
            await page.locator('#new-game').click()
            await page.wait_for_timeout(250)
            await record("01-cold-refuge")
            for point in [(350, 1075), (375, 1080), (305, 1115)]:
                await walk([point]); await interact()
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
                        await hold(["r"]); await page.wait_for_timeout(1850)
                else:
                    raise AssertionError("The flanker survived the capture approach")
                if combat["player"]["hp"] < 70:
                    await hold(["1"])
                await walk([(1170, 660), (1170, 540), (1385, 540), (1385, 475), (1338, 475)])
                if combat["player"]["ammo"] < 2:
                    await hold(["r"]); await page.wait_for_timeout(1850)
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
                        await hold(["r"]); await page.wait_for_timeout(1850)
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
            assert all(item["collected"] for item in supplies["supplies"] if item["essential"])
            await record("07-relay-supplies")
            await walk([(1335, 345), (1255, 345), (1170, 345), (1170, 680), (1180, 760)])
            await interact()
            await expect_stage(6)
            await record("08-coal-disarm")
            await hold(["f"], 1300)
            await hold(["v"]); await page.wait_for_timeout(400); await hold(["v"]); await hold(["b"])
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
                await hold(["q"])
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
            await walk([(1100, 650), (1000, 780), (600, 970), (375, 970), (375, 1140), (350, 1140)])
            await page.wait_for_timeout(2200)
            await interact()
            before = await save("16-complete-state")
            assert before["mission"]["completed"] and before["mission"]["rewardPaid"]
            assert before["flags"]["suppliesDeposited"] and before["camp"]["stoveLit"]
            assert before["sideQuests"]["silas"]["unlocked"] and not before["sideQuests"]["silas"]["complete"]
            assert before["horse"]["ridingUnlocked"] and before["horse"]["storageUnlocked"]
            await record("16-light-at-kiln")
            await page.reload(); await page.locator('#continue-game').click(); await page.wait_for_timeout(300)
            after = await save("17-reloaded-state")
            for key in ["mission", "inventory", "supplies", "flags", "worldChanges", "camp", "companions", "performance"]:
                assert after[key] == before[key], f"reloaded {key} differs"
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
            result.update(passed=True, method="public keyboard/mouse; read-only camera and ordinary manual-save inspection", stats=after["stats"], performance=after["performance"], camp=after["camp"], mission=after["mission"], choices={"pavel": after["flags"]["pavelChoice"], "rescue": after["flags"]["rescuePriority"], "voss": voss_outcome})
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
    parser.add_argument("--engine", choices=["chromium", "firefox", "webkit"], default="chromium")
    parser.add_argument("--output", type=Path, default=Path("/tmp/dust-mercy-campaign-playthrough"))
    parser.add_argument("--pavel", choices=["release", "bind", "kill"], default="bind")
    parser.add_argument("--rescue", choices=["preserve-log", "carry-gideon-first"], default="preserve-log")
    parser.add_argument("--voss", choices=["escape", "capture"], default="escape")
    options = parser.parse_args()
    asyncio.run(run(options.url, options.output, options.engine, options.pavel, options.rescue, options.voss))
