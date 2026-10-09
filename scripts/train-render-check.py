#!/usr/bin/env python3
"""Targeted isolated native rail art fixtures. Not gameplay or valid Saves.
Run only after Root grants a browser resource window. Output stays under /tmp.
WebKit phone profiles approximate Safari's engine; no real iOS Safari claim.
"""
import argparse,asyncio,base64,hashlib,html,json,math,re,statistics
from pathlib import Path
from playwright.async_api import async_playwright
CASES=['overview','brake','regulator','whistle','entry','roof','papers','cast','mounted','gangway','charge']
CONTEXTS=[('webkit-phone','webkit',320,568),('webkit-tablet','webkit',768,1024),('chromium-desktop','chromium',1440,900),('chromium-ultrawide','chromium',3440,1440)]
def sources():
    root=Path.cwd().resolve();pending=[root/'my-3d2dge-agent.js',root/'fixtures/train-native.html',root/'fixtures/train-native.js'];seen=set()
    while pending:
        p=pending.pop().resolve()
        if p in seen:continue
        if not p.is_relative_to(root):raise ValueError('Fixture import leaves isolated source root')
        seen.add(p)
        if p.suffix not in ['.js','.mjs']:continue
        for ref in re.findall(r'''(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"]([^'"]+)['"]''',p.read_text()):
            if ref.startswith('.'):pending.append((p.parent/ref).resolve())
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(seen)}
async def contact_sheets(pw,out,rows):
    browser=await pw.chromium.launch();page=await browser.new_page(viewport={'width':1440,'height':900});made=[]
    for label,_,_,_ in CONTEXTS:
        group=[r for r in rows if r['context']==label]
        if not group:continue
        cards=''.join('<figure><img src="data:image/png;base64,'+base64.b64encode((out/r['image']).read_bytes()).decode()+'"><figcaption>'+html.escape(r['case']+(' REDUCED' if r['reducedMotion'] else ' NORMAL'))+'</figcaption></figure>' for r in group)
        await page.set_content('<style>body{margin:0;background:#263d3d;color:#dfd1ac;font:12px monospace}main{display:grid;grid-template-columns:repeat(4,360px)}figure{margin:0;height:270px;text-align:center}img{display:block;margin:auto;width:354px;height:244px;object-fit:contain}</style><main>'+cards+'</main>')
        await page.evaluate('()=>Promise.all([...document.images].map(i=>i.decode()))');name=label+'-sheet.png';await page.screenshot(path=str(out/name),full_page=True);made.append(name)
    await browser.close();return made
async def main(args):
    out=Path(args.output).resolve()
    if not str(out).startswith('/tmp/'):raise SystemExit('Write proof artifacts under /tmp.')
    out.mkdir(parents=True,exist_ok=True);start=sources();rows=[];perf=[];paired={}
    async with async_playwright() as pw:
        for label,engine,w,h in CONTEXTS:
            if args.contexts and label not in args.contexts.split(','):continue
            browser=await getattr(pw,engine).launch();page=await browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            await page.goto(args.url.rstrip('/')+'/fixtures/train-native.html');await page.wait_for_function('!!window.probe')
            for case in args.cases.split(',') if args.cases else CASES:
                for reduced in [False,True]:
                    await page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference');await page.evaluate('([name,reduced])=>probe.setup(name,reduced)',[case,reduced]);await page.evaluate('t=>probe.frame(t)',args.age)
                    await page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');before=await page.evaluate('JSON.stringify(probe.scene)')
                    name=label+'-'+case+('-reduced' if reduced else '-normal')+'.png';await page.screenshot(path=str(out/name));snap=await page.evaluate('probe.inspect()');after=await page.evaluate('JSON.stringify(probe.scene)');physical=await page.evaluate('JSON.stringify(probe.physics())');digest=hashlib.sha256(physical.encode()).hexdigest();key=(label,case)
                    if not reduced:paired[key]=digest
                    contacts=snap['contacts'];drawn=[a['id'] for a in snap['actors']];expected=await page.evaluate('probe.expected');finite=all(math.isfinite(n) for c in contacts for v in [c['target'],c['hit']] for n in v.values());missing=[id for id in expected if drawn.count(id)!=1];same_motion=not reduced or digest==paired.get(key)
                    row={'context':label,'engine':engine,'viewport':[w,h],'case':case,'age':args.age,'reducedMotion':reduced,'image':name,'errors':errors[:],'engineErrors':await page.evaluate('probe.game.errors'),'stateUnchangedDuringRendering':before==after,'physicsSHA256':digest,'samePhysicsNormalReduced':same_motion,'contacts':contacts,'maxContactError':max([c['error'] for c in contacts]+[0]),'finite':finite,'drawn':drawn,'duplicateActors':len(drawn)!=len(set(drawn)),'missingExpectedActors':missing,'snapshot':snap,'cursorAdvance':await page.evaluate('probe.scene.consist.cursor-probe.seedCursor')};rows.append(row);errors.clear()
            await page.evaluate("probe.setup('overview')");samples=await page.evaluate('()=>new Promise(resolve=>{const a=[];function tick(){a.push({...probe.game.stats});if(a.length===40)resolve(a);else requestAnimationFrame(tick);}requestAnimationFrame(tick);})');perf.append({'context':label,'samples':40,'renderMsMedian':statistics.median(s['renderMs'] for s in samples),'renderMsP95':sorted(s['renderMs'] for s in samples)[37],'maxQueue':max(s['items'] for s in samples)})
            await browser.close();print(label+': '+str(len(rows))+' cumulative captures',flush=True)
        sheets=await contact_sheets(pw,out,rows)
    end=sources();failed=[r for r in rows if r['errors'] or r['engineErrors'] or r['duplicateActors'] or r['missingExpectedActors'] or not r['stateUnchangedDuringRendering'] or not r['samePhysicsNormalReduced'] or not r['finite'] or r['maxContactError']>1e-5 or r['snapshot']['errors'] or r['cursorAdvance']<=0]
    report={'kind':'isolated-injected-train-native-render-fixtures','productionProof':False,'ordinaryGameplay':False,'validSave':False,'realSafari':False,'sourceHashes':start,'sourceHashesAtEnd':end,'sourceStable':start==end,'captures':rows,'failures':[{'context':r['context'],'case':r['case'],'reducedMotion':r['reducedMotion'],'errors':r['errors'],'diagnosticErrors':r['snapshot']['errors'],'missing':r['missingExpectedActors'],'maxError':r['maxContactError'],'samePhysics':r['samePhysicsNormalReduced']} for r in failed],'performance':perf,'contactSheets':sheets,'limits':['Positions and selected contacts are explicitly staged, not earned arrivals/rescues/operations/ownership.','Frames and the gangway walk advance actual generic physics; rendering must preserve the input graph.','Opaque sidewalls remain actual collision; no decorative windows/fire openings.','Different-height crossings, actual roof/cab climbs, exterior charge placement, firearm battles, native input/full20scenes and source acceptance remain open.']}
    (out/'report.json').write_text(json.dumps(report,indent=2));cards=''.join('<figure><img src="'+html.escape(r['image'])+'" loading="lazy"><figcaption>'+html.escape(r['context']+' / '+r['case']+(' / reduced' if r['reducedMotion'] else ' / normal'))+'</figcaption></figure>' for r in rows);(out/'index.html').write_text('<!doctype html><meta name="viewport" content="width=device-width"><title>Isolated train native art</title><style>body{background:#263d3d;color:#dfd1ac;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}figure{margin:0}img{width:100%}</style><h1>Injected native train fixtures</h1><p>Isolated staged art/contact checks. No gameplay, Save, source acceptance or real Safari claim.</p><a href="report.json">Diagnostic receipt</a><main>'+cards+'</main>');print(json.dumps({'output':str(out),'captures':len(rows),'contacts':sum(len(r['contacts']) for r in rows),'failures':report['failures'],'sourceStable':start==end,'performance':perf},indent=2));return bool(failed) or start!=end
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--url',default='http://127.0.0.1:4261');p.add_argument('--output',default='/tmp/dust-mercy-train-native-art');p.add_argument('--contexts',default='');p.add_argument('--cases',default='');p.add_argument('--age',type=float,default=.55);raise SystemExit(asyncio.run(main(p.parse_args())))
