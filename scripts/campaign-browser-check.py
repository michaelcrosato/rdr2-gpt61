"""Check public Snowbound UI flows across desktop engines and a WebKit phone.

Nine-stage keyboard/mouse playthroughs run separately in campaign-playthrough.py.
Artifacts stay outside the repository. No runtime state globals are modified.
"""

from campaign_save import observed_save, wait_for_save_commit
import asyncio
import json
import os
import math
from pathlib import Path
from playwright.async_api import async_playwright
from campaign_save import normalize_campaign_save

URL = os.environ.get('CAMPAIGN_URL', 'http://127.0.0.1:4173')
OUTPUT = Path(os.environ.get('CAMPAIGN_BROWSER_OUTPUT', '/tmp/dust-mercy-campaign-browser'))
OUTPUT.mkdir(parents=True, exist_ok=True)

async def check(engine, name, mobile=False):
    browser = await engine.launch()
    page = await browser.new_page(viewport={'width': 375, 'height': 667} if mobile else {'width': 1440, 'height': 900}, has_touch=mobile, is_mobile=mobile)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    async def click(locator):
        await locator.tap() if mobile else await locator.click()
    await page.goto(URL)
    await page.wait_for_function('globalThis.My3D2dge?.current?._running')
    assert await page.locator('#welcome-place').inner_text() == 'SNOWBOUND, 1893'
    await click(page.locator('#new-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.locator('#mission-name').inner_text() == 'The Last Warm Light'
    assert await page.locator('#mission-count').inner_text() == '01 / 09'
    if mobile:
        await click(page.locator('[data-panel="menu"]'))
        await page.locator('#text-size').select_option('1.4')
        await click(page.locator('[data-command="resume"]'))
    async def walk_to(x, y):
        for _ in range(40):
            position = await page.evaluate('({x:My3D2dge.current.cam.tx,y:My3D2dge.current.cam.ty+My3D2dge.current.H*.1/My3D2dge.current.view.by})')
            dx, dy = x-position['x'], y-position['y']
            if math.hypot(dx, dy)<7:
                return
            horizontal = abs(dx)>abs(dy)
            key = ('d' if dx>0 else 'a') if horizontal else ('s' if dy>0 else 'w')
            await page.keyboard.down(key)
            await page.wait_for_timeout(min(450,max(60,(abs(dx) if horizontal else abs(dy))*12)))
            await page.keyboard.up(key)
            await page.wait_for_timeout(50)
        raise AssertionError(f'Opening movement cannot reach {x},{y}')
    # Collect distinct starter props and meet Tomas through real movement/offers.
    for x,y in [(350,1075),(375,1080),(305,1115)]:
        await walk_to(x,y)
        await click(page.locator('#interact'))
        await page.wait_for_timeout(200)
    assert await page.locator('#conversation').evaluate('(el)=>el.open'), 'Opening conversation is reachable'
    assert 'Tomas Reed' in await page.locator('#speaker').inner_text()
    assert await page.locator('.dialogue-portrait svg').count() == 1
    await page.screenshot(path=str(OUTPUT / f'{name}-tomas-dialogue.png'))
    await click(page.locator('[data-choice="accept-journey"]'))
    await page.wait_for_function('document.querySelector("#mission-count").textContent==="02 / 09"')
    assert await page.locator('#mission-count').inner_text() == '02 / 09', 'Coat, lantern and Tomas are required before the trail'
    await click(page.locator('[data-panel="menu"]'))
    await click(page.locator('[data-command="save"]'))
    await wait_for_save_commit(page)
    saved = normalize_campaign_save(await observed_save(page))
    assert saved['region'] == 'snowbound' and saved['mission']['stage'] == 1
    await click(page.locator('[data-command="resume"]'))
    if mobile:
        before = await page.evaluate('My3D2dge.current.cam.tx')
        stick = await page.locator('#joystick').bounding_box()
        x, y = stick['x'] + stick['width'] / 2, stick['y'] + stick['height'] / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 25, y)
        await page.wait_for_timeout(450)
        await page.mouse.up()
        after = await page.evaluate('My3D2dge.current.cam.tx')
        assert after > before + 10, 'Joystick pointer path moves the actual player'
    await click(page.locator('[data-story-action="holster"]'))
    assert await page.locator('#holster-label').inner_text() == 'Holster', 'Holstered revolver can be drawn'
    await click(page.locator('[data-story-action="holster"]'))
    assert await page.locator('#holster-label').inner_text() == 'Draw', 'Drawn revolver can be holstered'
    await click(page.locator('[data-panel="map"]'))
    assert await page.locator('#panel-title').inner_text() == 'Snowbound'
    assert await page.locator('.snow-map').is_visible()
    await click(page.locator('#close-panel'))
    await click(page.locator('[data-panel="satchel"]'))
    assert await page.locator('#panel-body').get_by_text('The kiln community', exact=True).is_visible()
    await click(page.locator('#close-panel'))
    await click(page.locator('[data-panel="menu"]'))
    await page.locator('#text-size').select_option('1.4')
    await page.locator('#reduce-motion').check()
    assert await page.evaluate('document.documentElement.style.getPropertyValue("--dialogue-scale")') == '1.4'
    await click(page.locator('[data-command="save"]'))
    await wait_for_save_commit(page)
    await click(page.locator('[data-command="resume"]'))
    await page.reload()
    await click(page.locator('#continue-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.evaluate('document.documentElement.style.getPropertyValue("--dialogue-scale")') == '1.4'
    assert await page.evaluate('My3D2dge.current.reduceMotion'), 'Accessibility preferences survive reload'
    assert await page.locator('#mission-count').inner_text() == '02 / 09'
    assert await page.locator('#mission-name').inner_text() == 'The Last Warm Light'
    # Exploring the earlier foundation region must preserve the story save.
    await click(page.locator('.wordmark'))
    await page.locator('#welcome').wait_for(state='visible')
    await click(page.locator('#mercy-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.locator('#mission-name').inner_text() == 'The Last Water'
    await click(page.locator('[data-panel="menu"]'))
    await click(page.locator('[data-command="save"]'))
    await wait_for_save_commit(page)
    mercy = await observed_save(page)
    await page.reload()
    await click(page.locator('#continue-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.locator('#mission-name').inner_text() == 'The Last Warm Light'
    assert await page.locator('#mission-count').inner_text() == '02 / 09'
    await click(page.locator('[data-panel="menu"]'))
    await click(page.locator('[data-command="save"]'))
    await wait_for_save_commit(page)
    await page.goto(URL + ('&' if '?' in URL else '?') + 'mode=mercy')
    await click(page.locator('#continue-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.locator('#mission-name').inner_text() == 'The Last Water'
    await click(page.locator('[data-panel="menu"]'))
    await click(page.locator('[data-command="save"]'))
    await wait_for_save_commit(page)
    restored_mercy = await observed_save(page)
    for key in ['mission', 'inventory', 'horse', 'honor']:
        assert restored_mercy[key] == mercy[key], f'Campaign save preserves Mercy {key}'
    await page.goto(URL)
    await click(page.locator('#continue-game'))
    await page.locator('#welcome').wait_for(state='hidden')
    assert await page.locator('#mission-name').inner_text() == 'The Last Warm Light'
    assert not await page.evaluate('My3D2dge.current.errors')
    assert not errors, errors
    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
    await page.screenshot(path=str(OUTPUT / f'{name}.png'))
    result = {'engine': name, 'mobile': mobile, 'opening_prerequisites': True, 'map_satchel_menu': True, 'campaign_save_reload': True, 'mercy_exploration_preserves_story': True, 'text_size': True, 'draw_holster': True, 'joystick_pointer': mobile, 'errors': errors}
    await browser.close()
    return result

async def main():
    async with async_playwright() as p:
        result = await asyncio.gather(check(p.chromium, 'chromium'), check(p.firefox, 'firefox'), check(p.webkit, 'webkit'), check(p.webkit, 'webkit-phone', True))
        result.append(await check_controller(p.chromium))
        (OUTPUT / 'report.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result, indent=2))

async def check_controller(engine):
    browser = await engine.launch()
    page = await browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    await page.add_init_script('''
      window.campaignPad = {index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.campaignPad]});
    ''')
    await page.goto(URL)
    await page.wait_for_function('globalThis.My3D2dge?.current?._running')
    async def press(index):
        await page.evaluate('(i)=>campaignPad.buttons[i]={pressed:true,value:1}', index)
        await page.wait_for_timeout(100)
        await page.evaluate('(i)=>campaignPad.buttons[i]={pressed:false,value:0}', index)
        await page.wait_for_timeout(150)
    await press(9)
    await page.locator('#welcome').wait_for(state='hidden')
    for _ in range(3):
        await press(0)
    assert 'Tomas Reed' in await page.locator('#speaker').inner_text()
    await press(0)
    assert await page.locator('#mission-count').inner_text() == '02 / 09', 'Controller accepts the required preparations and briefing'
    await press(3)
    assert await page.locator('#holster-label').inner_text() == 'Holster'
    await press(3)
    assert await page.locator('#holster-label').inner_text() == 'Draw'
    before = await page.evaluate('My3D2dge.current.cam.tx')
    await page.evaluate('campaignPad.axes[0]=1')
    await page.wait_for_timeout(400)
    await page.evaluate('campaignPad.axes[0]=0')
    assert await page.evaluate('My3D2dge.current.cam.tx') > before + 10
    await press(1)
    await press(8)
    assert await page.locator('#panel').evaluate('(el)=>el.open')
    # Navigate every control with the D-pad, including the native text selector.
    for _ in range(16):
        if await page.evaluate('document.activeElement?.id') == 'text-size':
            break
        await press(13)
    else:
        raise AssertionError('Controller cannot reach the dialogue text selector')
    await press(15)
    assert await page.locator('#text-size').input_value() == '1.2'
    preferences = await page.evaluate('JSON.parse(localStorage.getItem("dust-mercy.preferences.v1"))')
    assert preferences['textScale'] == '1.2', 'Controller text choice persists'
    for _ in range(16):
        command = await page.evaluate('document.activeElement?.dataset.command')
        if command == 'save':
            break
        await press(13)
    else:
        raise AssertionError('Controller cannot reach Save journey')
    await press(0)
    await wait_for_save_commit(page)
    saved = normalize_campaign_save(await observed_save(page))
    assert saved['horse']['follow'] and saved['mission']['stage'] == 1
    for name in ['map', 'journal', 'satchel']:
        selector = f'[data-command="panel"][data-id="{name}"]'
        for _ in range(20):
            if await page.evaluate('(selector)=>document.activeElement?.matches(selector)', selector):
                break
            await press(13)
        else:
            raise AssertionError(f'Controller cannot reach {name} from the pause menu')
        await press(0)
        assert await page.locator('#panel').evaluate('(el)=>el.open')
        assert not await page.locator('[data-command="panel"]').count(), f'{name} replaces the menu'
        if name == 'map':
            assert await page.locator('.snow-map').is_visible()
        if name == 'satchel':
            assert await page.locator('[data-command="use"][data-id="tonic"]').is_visible()
        await press(8)
        if name != 'satchel':
            await press(8)
    assert not errors, errors
    assert not await page.evaluate('My3D2dge.current.errors')
    await page.screenshot(path=str(OUTPUT / 'controller-input.png'))
    await browser.close()
    return {'engine': 'chromium', 'input': 'emulated standard Gamepad API', 'opening_preparations_dialogue': True, 'move_draw_holster_call_menu': True, 'dpad_text_size_and_save': True, 'controller_map_journal_satchel': True, 'errors': errors}

asyncio.run(main())
