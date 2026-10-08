#!/usr/bin/env python3
"""Play The Last Water through public controls and inspect a manually saved journey.

Requires the machine-wide Python Playwright installation. Screenshots and JSON
evidence default to /tmp so browser artifacts are never written into the repo.
This script reads the engine camera and localStorage; it does not modify game
objects, call simulation methods, teleport actors, or inject saved state.
"""

import argparse
import asyncio
import json
import math
import os
from pathlib import Path

os.environ.setdefault("PLAYWRIGHT_HOST_PLATFORM_OVERRIDE", "ubuntu24.04-x64")
from playwright.async_api import async_playwright


async def run(url, output, engine):
    output.mkdir(parents=True, exist_ok=True)
    events, errors = [], []
    async with async_playwright() as playwright:
        browser = await getattr(playwright, engine).launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

        async def observe():
            return await page.evaluate("""() => {
                const g = My3D2dge.current;
                return {
                    x:g.cam.tx, y:g.cam.ty + g.H*.1/g.view.by,
                    objective:document.querySelector('#objective-text').textContent,
                    stage:document.querySelector('#mission-count').textContent,
                    health:document.querySelector('#health-ring').getAttribute('aria-valuenow'),
                    ammo:document.querySelector('#ammo').textContent
                };
            }""")

        async def record(label, screenshot=True):
            event = {"label": label, **await observe()}
            if screenshot:
                event["screenshot"] = f"{label}.png"
                await page.screenshot(path=str(output / event["screenshot"]))
            events.append(event)
            print(json.dumps(event), flush=True)

        async def hold(keys, milliseconds):
            for key in keys:
                await page.keyboard.down(key)
            await page.wait_for_timeout(milliseconds)
            for key in keys:
                await page.keyboard.up(key)
            await page.wait_for_timeout(80)

        async def interact():
            await hold(["e"], 80)
            await page.wait_for_timeout(150)

        async def choose(identifier):
            await page.locator(f'[data-choice="{identifier}"]').click()
            await page.wait_for_timeout(180)

        async def walk(route, sprint=False):
            for target_x, target_y in route:
                for _ in range(45):
                    position = await observe()
                    dx, dy = target_x - position["x"], target_y - position["y"]
                    if math.hypot(dx, dy) < 12:
                        break
                    horizontal = abs(dx) > abs(dy)
                    key = ("d" if dx > 0 else "a") if horizontal else ("s" if dy > 0 else "w")
                    distance = abs(dx) if horizontal else abs(dy)
                    await hold([key] + (["Shift"] if sprint else []), min(700, max(60, distance / (123 if sprint else 78) * 1000)))
                else:
                    raise AssertionError(f"Walking route blocked: {position} toward {(target_x, target_y)}")

        async def fire_once():
            # J is the game's existing keyboard fire action with its normal
            # nearest-enemy targeting. Waiting allows the projectile to land
            # before choosing the next target and prevents automatic overshoot.
            await hold(["j"], 80)
            await page.wait_for_timeout(450)

        async def manually_save(label):
            await hold(["Escape"], 70)
            await page.locator('[data-command="save"]').click()
            snapshot = await page.evaluate("JSON.parse(localStorage.getItem('dust-mercy.journey.v1'))")
            (output / f"{label}.json").write_text(json.dumps(snapshot, indent=2) + "\n")
            await page.locator('[data-command="resume"]').click()
            return snapshot

        try:
            await page.goto(url)
            await page.locator('#new-game').click()
            await page.wait_for_timeout(300)
            await record("01-start")
            await interact()
            await record("02-ada-dialogue")
            await choose("accept-water")
            await walk([(820, 680), (820, 535), (990, 535)])
            await interact()
            await record("03-silas-dialogue")
            await choose("follow-water")
            await walk([(1045, 535), (1045, 850)])
            await interact()
            await record("04-valve-evidence")
            await choose("break-chain")

            for _ in range(4):
                await fire_once()
            # The foreman stands between the southwest approach and the rear
            # guard. Changing the firing angle prevents friendly interception.
            await walk([(1045, 785)])
            for _ in range(2):
                await fire_once()
            await page.wait_for_timeout(300)
            assert (await observe())["stage"] == "05 / 07", await observe()
            await record("05-guards-cleared")
            await walk([(1170, 785), (1170, 877)])
            await interact()
            await record("06-gideon-choice")
            await choose("arrest-pike")
            await walk([(1167, 853), (1103, 853)])
            await interact()
            assert (await observe())["stage"] == "07 / 07", await observe()
            await record("07-water-restored")
            await walk([(1040, 853), (1040, 680), (720, 680), (720, 700)], sprint=True)
            await interact()
            await choose("finish-water")
            await record("08-complete")
            before = await manually_save("08-complete-state")

            await page.reload()
            await page.locator('#continue-game').click()
            await page.wait_for_timeout(300)
            await record("09-reloaded-complete")
            after = await manually_save("09-reloaded-state")
            assert after["mission"]["completed"] and after["mission"]["stage"] == 7
            assert after["mission"]["waterRunning"] and after["mission"]["rewardPaid"]
            assert after["mission"]["choice"] == "arrest-pike"
            assert after["inventory"]["wrench"] == 0
            assert all(enemy["hp"] == 0 for enemy in after["enemies"] if enemy["id"].startswith("pump-"))
            assert next(npc for npc in after["npcs"] if npc["id"] == "gideon")["arrested"]
            assert after["mission"] == before["mission"]
            assert after["inventory"] == before["inventory"]
            assert after["player"]["money"] == before["player"]["money"] == 85
            assert after["stats"] == before["stats"]
            assert after["stats"]["distance"] > 1000
            assert after["stats"]["shots"] == 6
            assert after["stats"]["kills"] == 3
            assert after["stats"]["deaths"] == 0
            assert after["wanted"]["bounty"] == 0
            assert after["honor"] == 30
            assert not errors, errors
            result = {"passed": True, "browser": engine, "url": url, "method": "public keyboard/mouse controls; read-only camera and manual-save inspection", "events": events, "errors": errors, "completed_mission": after["mission"], "money": after["player"]["money"], "stats": after["stats"]}
        except Exception as error:
            await page.screenshot(path=str(output / "failure.png"))
            result = {"passed": False, "browser": engine, "url": url, "events": events, "errors": errors, "failure": str(error)}
            raise
        finally:
            (output / "report.json").write_text(json.dumps(result, indent=2) + "\n")
            await browser.close()
        print(json.dumps({"passed": True, "report": str(output / "report.json")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", default="http://127.0.0.1:4173")
    parser.add_argument("--output", type=Path, default=Path("/tmp/dust-mercy-playthrough-check"))
    parser.add_argument("--engine", choices=["chromium", "firefox", "webkit"], default="chromium")
    options = parser.parse_args()
    asyncio.run(run(options.url, options.output, options.engine))
