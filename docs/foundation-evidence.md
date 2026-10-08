# Dust & Mercy — foundation verification

Evidence date: 2026-10-08. Milestone: connected playable foundation. The full user goal remains active. This evidence does not establish the representative slice gate or complete source coverage.

## Current implementation

`index.html`, `styles.css` and `src/game.js` now provide the actual executable player flow. `src/simulation.js` governs world movement, ammunition, damage, choices, recovery, law, economy, camp resources, gathering, crafting, relationships, riding, hunting, fishing and saving. `src/world-renderer.js` uses the supplied engine's world projection, painter ordering, rigs, camera, particles and pixel drawing for the visible region. No external visual/audio assets are fetched.

The initial recovered worktree had research, simulation and drawing modules but no launchable game. Connecting and independently exercising that implementation is progress toward the original goal, rather than evidence that the requested full scope is complete.

## State and interaction verification

Twenty Node simulation tests pass. Their actual behaviors cover:

- Investigation, guard combat, three moral branches, valve repair, return and exactly-once mission rewards.
- Conserved ammunition, timed reload, limited focus, collision and the river's bridge-only crossing.
- Horse travel/care, transactions, witnesses, law pursuit and bounty payment.
- Kill/harvest and bite/reel loops, provisions consumption, Copper's real return and live captive delivery proximity.
- Food-dependent recovery, camp ingredients/donations/upgrades, daily resource renewal, Tomas/Fern's distinct requests and a later relationship stage.
- Combat checkpoint restoration, completed-choice preservation, save version 2 round trips, version-1 migration, malformed-save rejection and bounded restored state.
- Immediate ceasefire after surrender, recoverable Copper injury and rain/shelter consequences.

These tests do not prove art quality, source coverage or human input parity by themselves.

`scripts/browser-check.py` exercises mission acceptance, branching dialogue, actual movement, map/satchel/menu, saved position, reload/continue, firearm input/reload and stable modal focus across Chromium, Firefox and WebKit. A 375×667 WebKit phone context additionally exercises mobile layouts, touch-compatible menu activation and the joystick pointer path. An emulated standard Gamepad API device verifies controller navigation before starting, movement, fire, reload, focus and horse calling. Browser reports/captures live at `/tmp/dust-mercy-browser-check`. Native physical touch/controller testing remains separate.

Independent ordinary-control playthroughs completed The Last Water in Chromium and WebKit at 1440×1000. Each started a new journey, accepted Ada's request, walked around the actual town obstacles, learned the route from Silas, inspected the valve, defeated all three pump guards, selected the arrest outcome, repaired the valve, returned to Ada, and manually saved through the menu. Reloading the page and choosing Continue restored the completed journey. Keyboard movement, interaction and the existing J firearm binding plus mouse dialogue/menu choices drove the runs. Read-only camera observation located the player; no runtime state writes, simulation-method calls, injected saves or teleports advanced them.

| Observed result after completion and reload | Chromium | WebKit |
| --- | --- | --- |
| Mission stage / choice | 7 / `arrest-pike` | 7 / `arrest-pike` |
| Water running / reward paid | Both true | Both true |
| Money / honor | $85 / +30 | $85 / +30 |
| Shots / guard kills / deaths | 6 / 3 / 0 | 6 / 3 / 0 |
| Bounty / health | $0 / 100 | $0 / 100 |
| Saved mission, inventory, money and statistics preserved | Yes | Yes |
| Wrench consumed / Gideon arrested / guards defeated | Yes | Yes |
| Page or console errors | 0 | 0 |

The replay is `python3 scripts/playthrough-check.py --output /tmp/dust-mercy-playthrough-fresh`; use `--engine webkit --output /tmp/dust-mercy-playthrough-webkit` for the second engine. Each output directory contains `report.json`, nine stage screenshots and before/after save snapshots. Combat, dialogue, completion and reloaded captures were inspected directly in both engines. The first exploratory run at `/tmp/dust-mercy-playthrough` additionally exercised three combat checkpoint recoveries and restored its final choice and reward after reload. Its deaths and incidental bounty are retained in that evidence rather than mixed with the clean fresh runs. These checks establish this foundation scenario's arrest path and persistence, not all moral branches, controller/touch parity, the Snowbound campaign specification, or complete source coverage.

## Rendered verification

The viewport matrix at `/tmp/dust-mercy-viewports-final` contains 24 clean captures over 14 device/viewport profiles: small/large phones, phone landscape, a foldable, tablets, 4:3, laptop, 16:10, 16:9 and ultrawide. Desktop profiles run in Chromium, Firefox and WebKit. The report has zero overflow, console errors, page errors or failed requests. Captures were inspected directly, including all 14 viewport profiles.

Renderer mechanics checks additionally inspect rain, night, water repair aftermath, fishing, riding, camp upgrades, gathering marks, captive presentation and obstruction transparency. Output is in `/tmp/dust-renderer-checks`. The integrated 1440×900 page uses a 720×450 internal engine buffer; sampled renderer costs were approximately 6 ms Chromium, 17 ms WebKit and 9 ms Firefox. These are sampled observations, not a guaranteed full-game performance budget.

The final mobile Lighthouse accessibility audit at `/tmp/dust-mercy-accessibility-final.json` reached 100 with no failed audits after accessible-name fixes. This supports basic interface checks; it does not prove complete game accessibility. WebKit with iPhone profiles approximates Safari's engine. Real iOS Safari is unavailable on this machine.

## Open production gates

The source inventory contains 679 uniquely identified obligations, including 90 challenge ranks and 21 finite/mission-attached bounty records. It remains open because parent categories, source revisions, reward details, edition boundaries and other source-specific child beats need reconciliation. Counts mix taxonomy parents and individual units and are not a completion percentage.

No source obligation is closed merely because this prototype contains a similar mechanic. The nine-stage Snowbound opening specification, The Last Warm Light, still needs its distinct locations, actors, staging, melee/disarm, mount ownership, rescue/fire, choices, aftermath and acceptance evidence. The Last Water is a foundation scenario, not that campaign mission.

The full campaign/later-life arcs, all regions/interiors, authored side events, cast/item/species catalogs, advanced systems, original art/animation depth, balance and full-game verification remain required. Within the slice, wildlife tracking/quality, carcass carrying, authentic live capture animations, better obstacle-aware companions/foes, deeper schedules, persistent ambient-event variety, accessible alternatives and complete input acceptance remain open. Decorative geometry still exceeds simulation collision in places.

The final boardroom-style report and release audit require measured full-game work and proven whole-scope outcomes. This foundation record cannot substitute for them.
