# Dust & Mercy — opening animation and input evidence

Evidence date: 2026-10-08. Build 0.2.1 follows the [nine-stage Snowbound opening](snowbound-evidence.md). It adds authored motion and completes two automated input paths. The requested full game and its open source ledger remain required; this update does not establish full source, presentation or input acceptance.

## Accepted actions and motion

`src/campaign.js` records accepted interactions in a bounded, transient WeakMap queue. Frozen source/target positions preserve the approach to a prop, saddle or person. Unavailable actions emit nothing. Retry, restart and replay invalidate clips; loading starts with an empty queue. No presentation events enter a save, checkpoint or replay's permanent-world snapshot. A held block starts one clip rather than restarting one every frame.

`src/western-animation.js` authors joint tracks after the supplied engine's humanoid pose and uses its actual `ik3` solver. Character and world projection are reconciled at visible contact sockets. `src/snowbound-renderer.js` supplies saddle, stirrup, reins and mare-neck sockets; valve-wheel and partner contacts; retained pickup props; Pavel's platform drop, wrist grab and falling gun/token; and an adult body during lifting, carrying and lowering. Exposed travel braces against wind; taking cover and aiming changes the peek posture. These temporary joints/draw roots are restored after drawing and cannot move an authoritative actor or grant an item.

Mounting targets the accepted saddle position, including a collision-adjusted saddle. Dismounting searches nearby safe ground and moves Mara there. A blocked landing leaves her mounted with a readable instruction; the animation targets the actual accepted ground position. Tomas's mounted draw ordering also keeps him above his horse.

`npm run check` and `npm test` pass with 54 tests: 24 campaign, 20 Mercy Vale, two pointer aiming, two presentation-state and six animation math/event checks. New checks cover rejected events, pre-action targets, save/retry isolation, bounded history, safe dismount distance, adjusted mount targets, eight facings/three cast sizes, reachable limb endpoints, pose restoration, the first event after initialization/retry and separate Pavel/Voss clips, and shared close-combat clip timing/expiration. Targeted placement and animation fixtures are distinct from ordinary-control completion evidence.

## Complete input paths

`scripts/campaign-input-playthrough.py` follows the actual doors, trail, cover, pickups, mare-leading and rescue route. Both runs start a new journey, complete all nine stages, save through the normal menu and reload. Evaluations read camera/DOM/manual-save data; controller mode also writes an isolated standard-Gamepad input fixture. Neither mode injects a save, changes simulation state, teleports actors or calls a simulation action directly.

| Input path | Engine / viewport | Observed inputs | Evidence directory under `/tmp` |
| --- | --- | --- | --- |
| Visible phone pointer controls | WebKit, iPhone SE third-generation profile, 375×667 | 214 joystick mouse drags, eight visible action holds, 74 touchscreen menu/dialogue taps; zero keyboard or pad inputs | `dust-mercy-input-pointer-webkit-se375-complete` |
| Controller-only controls and menus | Chromium, 1440×1000 | 203 axis holds, 267 button holds, 32 D-pad/A modal selections; zero keyboard, mouse or touchscreen inputs | `dust-mercy-input-controller-chromium-complete` |

Both runs bind Pavel, carry Gideon first and allow Voss to escape. Each ends with health 82, honor +2, money/bounty zero, four shots/four hits, two guard kills, zero deaths and all six essential supply objects. The optional logbook remains separate. Final camp food is 3, medicine 2, blankets 1 and oil 1. Completion/reward flags, mission/world/choice/inventory/supply/side-quest/wanted/dropped-item records, player health/mount state, durable actor life/ownership/capture/carry state, horse care/storage, equipment/ammunition and all statistics survive reload. Autonomous camp actor positions may advance after loading and are excluded from durable actor equality checks. Reports contain no console, page or engine errors. Supply, carry and reload screenshots were inspected.

The pointer route uses mouse pointer dragging on the visible joystick in a coarse/touch context and native touchscreen taps for menus. Playwright WebKit does not provide a native touch-drag API here. This verifies the on-screen pointer path, not native touch dragging or iOS hardware. Controller evidence verifies the standard Gamepad polling path through a fixture, not a physical controller. The earlier keyboard/mouse runs cover all six Pavel × rescue combinations and both Voss outcomes; these two new paths cover one combination each.

The pause menu now exposes map, journal and satchel to D-pad/A navigation. `/tmp/dust-mercy-animation-browser/report.json` passes Chromium/Firefox/WebKit desktop, a WebKit phone and the emulated-controller UI regression, including all three panels, persisted text preferences, Save/Load and preservation of separate region saves. Extra-large menu text was also inspected on 375×667 and 756×352 WebKit phone viewports with internal scrolling, visible settings and reachable satchel controls.

## Visual checks and limits

`/tmp/dust-mercy-animation-viewports/report.json` records 24 clean captures across 14 phone, foldable, tablet and desktop profiles, including WebKit iOS profiles and Chromium/Firefox/WebKit desktop. All captures were visually inspected through contact sheets. No horizontal overflow or console/JavaScript errors were reported.

`/tmp/snowbound-animation-proof/report.json` exercises the supplied engine's actual limb solver and projection at eight facings in Chromium, Firefox and WebKit. The reachable hand contacts agree with their visible targets to the report's precision. Its two-arm microbenchmark is an isolated solver measurement and makes no frame-rate claim.

`/tmp/snowbound-animation-scenes/report.json` records twelve explicitly staged WebKit scenes at five times each: mount, dismount, pickup, valve, pat, lift, set-down, platform drop/disarm, shove, restraint, wind and cover. These use accepted runtime actions from positioned fixtures to inspect motion/contact; they do not prove an ordinary-control playthrough. Timed frames confirm shared shove/restraint clips advance once per elapsed interval. Scene contact sheets were inspected, with full-size contact/carry samples.

`/tmp/snowbound-animation-cross-browser/report.json` adds 84 accepted-action captures in seven contexts: Chromium, Firefox and WebKit phone/desktop, plus WebKit tablet. Reports have no page/console/engine errors; the images were visually inspected. Sampled full-contact grips and both riders' seated feet agree with sockets to report precision; Pavel's wrist contact is within 0.001 pixels and the lift transition within 0.1 pixels. These are authored fixture poses, not claims about every possible gameplay position.

| Engine | Phone median / p95 | Desktop median / p95 | Tablet median / p95 |
| --- | --- | --- | --- |
| Chromium | 6.2 / 6.6 ms | 7.2 / 7.7 ms | — |
| WebKit | 16 / 17 ms | 18 / 18 ms | 15 / 15 ms |
| Firefox | 9 / 10 ms | 10 / 11 ms | — |

These are fixture carry-area renderer samples at 375×667 phone, 1440×900 desktop and 768×1024 tablet. They exclude the complete UI/update loop, are not full-interface frame-rate measurements and do not establish the full-game performance budget. WebKit's sampled renderer costs also leave performance work open.

`/tmp/snowbound-animation-supplies/report.json` separately checks all six essential supplies and the optional logbook on WebKit phone with normal and reduced motion: fourteen contact samples and 28 captures, no errors and zero reported grip error. A final narrow boiler overlap fade keeps Mara and held oats visible behind the chimney. Fresh normal/reduced oats contact/held images were inspected after that change. The 84 cross-browser captures, 60 timed frames and timing table precede this fade, which was inactive in their staged poses; they remain pre-fade measurements.

The source inventory remains open, with zero accepted requirements. The next rescue has a [proposed specification](missions/a-voice-under-ice.md) and no playable implementation in this build. Full incidental source reconciliation, later dependencies, richer relationship/escort expressions, destruction choreography, final audio/dialogue/camera staging, native touch and physical hardware, all input/branch combinations, accessible alternatives and full-game performance/balance remain open. WebKit phone profiles approximate Safari's engine; real iOS Safari is unavailable on this machine.
