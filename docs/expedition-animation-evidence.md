# Expedition rendering and animation evidence

Recorded 2026-10-08 on `codex/voice-under-ice`, based on merged opening HEAD `e7d7aa0` plus the working implementation. This records a northern rendering milestone for [A Voice Under Ice](missions/a-voice-under-ice.md). Full source reconciliation, every conditional presentation beat and whole-game acceptance remain open. Public control and save/mission evidence is recorded separately by the integration agents; these injected scenes do not constitute a completed player run.

## Implemented layer

`src/north-cutting-renderer.js` exports `createNorthCuttingRenderer(game)` with `update(dt,state)`, `draw(renderer,state)` and `inspectAnimation()`. It actively uses the unchanged supplied My3D2dge renderer, world projection, drawing queue, `Humanoid` skins, `charView` and `ik3`. No engine file changes are included in this milestone.

The northern terrain uses authored absolute elevations 0/36/72/108. The approach notch, stone ascent strips, alternate carry descents, 44-unit low arch, ice brace wall, rope ring, rest pad, case, dead Lark, river and permanent upper-ice closure follow `content/campaign/north-cutting.js`. Elevation-aware visibility projects the real feet; the renderer never acquires height from a rectangle or advances a mission stage. Permanent closure also reads the authoritative `worldChanges.upperIceClosed` field.

Original supplied-engine humanoids distinguish Mara and Inez from Silas, Elin, Fin, Moss, Vera and Della. Fin uses actual shorter limbs and child proportions. Silas keeps the torn shoulder, wrapped fingers and jaw scar; `coatRepaired` adds a visible stitched patch while retaining the scars and injury presentation. Thimble and Copper have separate saddle sockets and silhouettes; authored dead Lark has a collapsed adult body, saddle and torn mail pouch. Seven stable wolf identities use live predator phases, gait, wounds and accepted bite events.

`src/expedition-animation.js` consumes the existing transient campaign WeakMap stream and each actor’s actual continuous traversal. State/generation changes clear old clips and consume genuine fresh events from sequence zero; nothing is serialized into a save. Shared patient/carrier clips advance once. A fast accepted strap waits for its patient lift, and a subsequent auto-mount remains the strap’s successor. A care gesture likewise waits for a pending bed setdown.

The authored transforms cover native seated legs and stirrups, mount/dismount, ledge climb, wall brace, low-arch crouch, rope contact, stabilization/care, adult lift/setdown, two-person handoff, helper reception, rear-saddle loading/unloading, fastening, mounted passenger, upward signal, diversion, case pickup, mount neck contact and coach-gun aiming/reload posture. Contact roots and joints are temporary draw transforms, restored after each skin draw. Carrier and passenger groups derive residence from the authoritative attachment target, avoiding a second Silas body or a second Inez driver. Handoffs use accepted `sourceId` rather than guessing which nearby person supplied the patient.

The Snowbound integration adds the new camp cast and clinical shelter, excludes conifers through the bed and uses the authored 57-unit north door gap. Rescue clips are isolated from the opening animator; the previously verified opening paths remain in their existing module.

## Native checks

`node --test tests/expedition-animation.test.mjs`: **9 passed**. These instantiate the real supplied engine and check adult/child reach in eight directions; one shared elapsed timeline and first-event recovery after a generation reset; native driver/passenger stirrup endpoints in eight directions; fixed collision-root projection and restored skin joints during climb; both rescuers reaching the midpoint grips on all three authored ascents; attachment residence and cycle rejection; delayed care/strap; auto-mount sequencing; and accepted mount start/safe dismount endpoint.

Module syntax checks passed for the animation, actor and northern renderer modules. Whole repository test counts belong to the integration report, rather than being inferred from these nine checks.

## Injected browser fixtures

Scripts and output are outside the repository under `/tmp`. They load the real supplied engine and actual game modules from the development server, restore a real completed-opening fixture through the version-2 facade, then inject scene positions/attachments and semantic events to isolate rendering. They do not drive ordinary mission controls or prove that an action is offered during play.

- `/tmp/north-render-matrix.py`, `/tmp/north-render-matrix/report.json`, `/tmp/north-render-matrix/index.html`: **279 captures**, 31 scenes across nine Chromium/Firefox/WebKit contexts. Scenes are sampled at 0.65 seconds. Contexts cover 375×667 phones in all three engines, 1440×900 desktops in all three, and WebKit 768×1024 tablet, 667×375 landscape and 2560×1080 ultrawide. DPR is 1 and internal engine limits are minW360/minH400/maxW1600/maxH1200. There were **zero console/page/engine errors and zero duplicated actor IDs**. The 603 recorded full-contact samples had maximum projected error **0 internal pixels** at this sampling time.
- `/tmp/north-render-timed.py`, `/tmp/north-render-timed/report.json`, `/tmp/north-render-timed/index.html`: **222 captures**, 22 timed scenes in WebKit 667×375, with normal and reduced motion. Samples cover action starts, contact, transitions and completion; rapid load→strap→mount extends to 4.1 seconds, and rapid setdown→care to 3.3 seconds. There were **zero console/page/engine errors and zero duplicated actor IDs**. Across 464 full-contact samples the maximum error was **0.186 internal pixels**, a near-end dismount stirrup blend. The formerly observed second-climb midpoint left-hand gap was resolved by choosing a reachable next grip on the actual ascent strip while preserving the feet/collision root.
- `/tmp/north-render-extras.py`, `/tmp/north-render-extras/report.json`: two WebKit phone normal/reduced captures explicitly exercise persistent `upperIceClosed` without the active mission flag. Both draw additional ice rubble across the upper approach without engine/page errors; paired baseline captures and pixel differences confirm the persistent field changes the geometry.

The renderer agent visually inspected **all nine matrix contact sheets and all 22 normal/reduced timed contact sheets**, plus the normal/reduced closure screenshots and their baseline/difference captures. The sheets retain links to full-size frames through their neighboring files. The distinct source and receiver roots at the sampled handoff are separated by about 49–51 internal pixels while their hands support different sections of the same adult body. Clinical-bed captures show the new shelter without the former conifers through Silas. The resting-in-another-region fixture excludes Silas from North rather than redrawing his bed attachment there.

The initial `/tmp/north-render-fixtures/report.json` contains older staging and is **not** the final evidence. The prior 252-capture matrix preceded the standalone dismount socket correction, final passenger diagnostics, auto-mount sequencing and reach selection; the final 279-capture matrix and 222 timed frames supersede it. The persistent-closure fallback was captured separately because the regular matrix does not activate that branch.

Reduced motion stops ambient snow, breathing drift and wind/tail motion. Traversal, actual gait and essential lift/handoff/passenger/action progress still communicate physical movement. The screenshot fixture keeps reloadTimer at a chosen posture; its timed coach-reload row proves that posture remains readable, **not** a full ammunition/reload sequence.

## Sampled render cost

After the scene matrix, each context sampled the engine’s `stats.renderMs` on 50 requestAnimationFrame callbacks in a busy injected seven-wolf scene with both mounts, both drivers and the rear passenger. Terrain is cached; actor groups and contact transforms remain dynamic. Figures are isolated rendering cost on this machine, not mission/simulation/UI frame rate, device Safari results or a 60 Hz guarantee.

| Context | Viewport | Median ms | p95 ms |
| --- | --- | ---: | ---: |
| Chromium phone | 375×667 | 3.15 | 4.5 |
| Chromium desktop | 1440×900 | 3.5 | 4.5 |
| WebKit phone | 375×667 | 10 | 12 |
| WebKit desktop | 1440×900 | 12 | 15 |
| WebKit tablet | 768×1024 | 10 | 12 |
| WebKit landscape | 667×375 | 10 | 11 |
| WebKit ultrawide | 2560×1080 | 17 | 20 |
| Firefox phone | 375×667 | 5 | 6 |
| Firefox desktop | 1440×900 | 6 | 8 |

The ultrawide WebKit sample exceeds a 16.7 ms render budget before gameplay/UI costs. Real iOS Safari was unavailable; WebKit is the closest automated engine check available here.

## Remaining presentation work and limits

The layer is a functional procedural staging milestone. Horses and wolves use authored projected quadruped shapes and screen sockets, rather than full skinned 3D quadruped skeletons with hoof/terrain IK. Hand-to-body measurements are projected contacts; native adult/child humanoid joints and feet are genuine engine transforms. Temporary handoff/contact staging can shift a draw root while the accepted gameplay root stays authoritative. Gameplay accepts an action immediately; render clips do not delay inventory, damage, collision or attachment outcomes, and restoring a save reconstructs its steady pose rather than replaying historical gestures.

Rack retrieval/weapon inspection, eating/companion flask use, dialogue facial performance, family embrace and falling-ice cinematics do not yet have bespoke complete motion sequences. Equipped/slung weapons, a readable reload posture, signal pose, care contacts, family cast and lasting collapsed geometry are present; those features must not be described as accepting the missing sequences. Dialogue/audio and actual public input, collision, save/replay and predator outcome coverage require the separate integration evidence. Source timing/conditional chatter, live source revision reconciliation and full original art/animation acceptance remain open.
