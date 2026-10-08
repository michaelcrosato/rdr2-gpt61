"""Exercise the actual UI on Chromium, Firefox and WebKit; artifacts stay outside the repository.

Requires the machine-wide Python Playwright toolkit and a running npm run dev server.
No game-state globals or injected saves are used to advance these flows.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

BASE_URL = os.environ.get('GAME_URL', 'http://127.0.0.1:4173/?mode=mercy')
OUTPUT = Path(os.environ.get('BROWSER_OUTPUT', '/tmp/dust-mercy-browser-check'))
OUTPUT.mkdir(parents=True, exist_ok=True)

async def check(engine, name, mobile=False):
    browser = await engine.launch()
    context = await browser.new_context(viewport={'width': 375, 'height': 667} if mobile else {'width': 1280, 'height': 800}, has_touch=mobile, is_mobile=mobile)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    await page.goto(BASE_URL)
    await page.locator('#new-game').tap() if mobile else await page.locator('#new-game').click()
    await page.wait_for_timeout(200)
    assert await page.locator('#mission-name').is_visible()
    assert await page.locator('#interaction-label').inner_text() == 'Speak with Ada Reed'
    await page.locator('#interact').click() if mobile else await page.keyboard.press('e')
    await page.wait_for_function('document.querySelector("#conversation").open')
    await page.locator('[data-choice="ask-ada"]').click()
    assert 'buy debts' in await page.locator('#dialogue-text').inner_text()
    await page.locator('[data-choice="accept-water"]').click()
    await page.wait_for_function('!document.querySelector("#conversation").open')
    assert 'Silas Venn' in await page.locator('#objective-text').inner_text()
    saved = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
    assert saved['mission']['stage'] == 1
    if mobile:
        stick = await page.locator('#joystick').bounding_box()
        x, y = stick['x'] + stick['width'] / 2, stick['y'] + stick['height'] / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 25, y)
        await page.wait_for_timeout(400)
        await page.mouse.up()
    else:
        await page.keyboard.down('d')
        await page.wait_for_timeout(400)
        await page.keyboard.up('d')
    await page.locator('[data-panel="map"]').click()
    assert await page.locator('#panel-title').inner_text() == 'Mercy Vale'
    assert await page.locator('.map-art').is_visible()
    await page.locator('#close-panel').click()
    await page.locator('[data-panel="satchel"]').click()
    assert await page.locator('#panel-title').inner_text() == 'Your satchel'
    assert await page.locator('#panel-body').get_by_text('Reed Camp', exact=True).is_visible()
    await page.locator('#close-panel').click()
    await page.locator('[data-panel="menu"]').click()
    await page.locator('[data-command="save"]').click()
    after_move = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
    assert after_move['player']['x'] > saved['player']['x'] + 10, 'Movement must change saved world position'
    await page.locator('[data-command="resume"]').click()
    await page.reload()
    await page.locator('#continue-game').click()
    assert 'Silas Venn' in await page.locator('#objective-text').inner_text()
    await page.locator('[data-panel="menu"]').click()
    await page.locator('[data-command="export"]').focus()
    await page.wait_for_timeout(300)
    assert await page.locator('[data-command="export"]').evaluate('(el)=>el===document.activeElement')
    await page.locator('#close-panel').click()
    if not mobile:
        await page.keyboard.press('r')
        await page.keyboard.press('j')
        await page.wait_for_timeout(300)
        assert await page.locator('#ammo').inner_text() == '5'
        await page.keyboard.press('r')
        await page.wait_for_timeout(2100)
        assert await page.locator('#ammo').inner_text() == '6'
    overflow = await page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not overflow, 'Horizontal page overflow'
    engine_errors = await page.evaluate('My3D2dge.current.errors')
    assert not engine_errors, engine_errors
    assert not errors, errors
    await page.screenshot(path=str(OUTPUT / f'{name}.png'))
    result = {'engine': name, 'mobile': mobile, 'mission_acceptance': True, 'movement': True, 'map_satchel_menu': True, 'save_reload': True, 'errors': errors, 'overflow': overflow}
    await browser.close()
    return result

async def check_controller(engine):
    browser = await engine.launch()
    page = await browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    # Supply a standard Gamepad API input device; no simulation state is patched.
    await page.add_init_script('''
      window.inputFixturePad = {index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.inputFixturePad]});
    ''')
    await page.goto(BASE_URL)
    async def press(index):
        await page.evaluate('(i)=>inputFixturePad.buttons[i]={pressed:true,value:1}', index)
        await page.wait_for_timeout(100)
        await page.evaluate('(i)=>inputFixturePad.buttons[i]={pressed:false,value:0}', index)
        await page.wait_for_timeout(120)
    await press(8)
    assert await page.locator('#panel').evaluate('(e)=>e.open')
    await press(13)
    await press(13)
    assert await page.locator('[data-command="new"]').evaluate('(e)=>e===document.activeElement'), 'Controller navigates the pre-start menu'
    await press(0)
    assert await page.locator('#mission-name').is_visible()
    await page.evaluate('inputFixturePad.axes[0]=1')
    await page.wait_for_timeout(400)
    await page.evaluate('inputFixturePad.axes[0]=0')
    await press(7)
    assert await page.locator('#ammo').inner_text() == '5'
    await press(2)
    await page.wait_for_timeout(2100)
    assert await page.locator('#ammo').inner_text() == '6'
    await page.evaluate('inputFixturePad.buttons[5]={pressed:true,value:1}')
    await page.wait_for_timeout(600)
    await page.evaluate('inputFixturePad.buttons[5]={pressed:false,value:0}')
    assert int(await page.locator('#focus-ring').get_attribute('aria-valuenow')) < 95
    await press(1)
    await press(8)
    await page.locator('[data-command="save"]').click()
    saved = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.journey.v1"))')
    assert saved['player']['x'] > 730
    assert saved['horse']['follow']
    assert not errors, errors
    assert not await page.evaluate('My3D2dge.current.errors')
    await page.screenshot(path=str(OUTPUT / 'controller-input.png'))
    await browser.close()
    return {'engine': 'chromium', 'input': 'emulated standard Gamepad API', 'pre_start_menu': True, 'movement_fire_reload_focus_whistle': True, 'errors': errors}

async def main():
    async with async_playwright() as p:
        results = await asyncio.gather(check(p.chromium, 'chromium'), check(p.firefox, 'firefox'), check(p.webkit, 'webkit'), check(p.webkit, 'webkit-phone', True))
        results.append(await check_controller(p.chromium))
        (OUTPUT / 'report.json').write_text(json.dumps(results, indent=2))
        print(json.dumps(results, indent=2))

asyncio.run(main())
