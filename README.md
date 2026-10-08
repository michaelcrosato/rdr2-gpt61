# Dust & Mercy

An original western about Mara Vale, a displaced community and a railroad syndicate's control of land and water. Built on the supplied **my-3D2dge AGENT EDITION v0.8.1**: the engine runs the fixed-step loop, input, camera, depth ordering, procedural character rigs, particles and synthesized audio.

This is a **campaign work in progress**, not the finished requested game. The complete campaign, regional world and original variations of every source obligation remain the target. The source inventory is open, and no coverage percentage is claimed.

## Run

Use Node.js 20.11 or newer. The game has no runtime dependencies, external assets or network requests.

```sh
npm run dev
```

Open **http://127.0.0.1:4173** to begin in Snowbound. The title screen also opens the earlier Mercy Vale region; its saves preserve the campaign journey. `PORT=8080 npm run dev` changes the local port. The server binds to localhost. Any static web server can serve the project; opening `index.html` as a `file:` URL does not support its ES modules.

## Playable now

- **The Last Warm Light:** a distinct nine-stage campaign opening. Prepare at the frozen refuge, ride the wire trail with Tomas and Inez, negotiate at Copperglass, fight the boiler-yard guards, collect six separate supplies, survive Pavel's disarming ambush, choose his fate, calm and lead Copper, rescue Ada and Gideon through the service doorway, then return with actual supplies. Both rescue priorities and all three Pavel outcomes write lasting consequences; the destroyed boiler, recovered log and captured/escaped Voss persist.
- Snowbound checkpoint retries restore people, equipment, pickups, mounts and fuse timers. Protected participants and abandonment have readable failures. Optional performance records track injury, supplies and actual shooting accuracy. Mission replay keeps the permanent world in a separate snapshot.
- **A Voice Under Ice:** a ten-stage rescue unlocked by the completed opening. Meet Elin, prepare separate loaned equipment, ride with Inez into North Cutting, inspect the trail, signal Silas, climb/brace/crouch/rope through actual height bands, stabilize and carry him across three handoffs, divert seven predators while Inez loads a real passenger, conceal both mounts in the return creek, then return him through two helpers to a clinical bed. The secured dispatch case is optional. Silas keeps scars, a healing schedule, bedside care and a material-backed coat request; the loaned gun becomes Mara's own weapon. The companion hunt and rival-camp investigation remain unavailable.
- Copper's riding, feeding and twelve-unit pack unlock after the opening. Actual transfers, ammunition, ownership, historical choices and both regions persist in the version-2 campaign graph. Valid original version-1 opening saves migrate, including independent checkpoint and replay histories. Rescue retry/restart, unused-loan postponement and historical replay preserve their complete state contracts.
- Original winter terrain, door-aligned interiors, distinct cast rigs and portraits, snow/breath/steam/fire, authored saddle mounting/dismounting, hand-to-prop contacts, Pavel's drop and close combat, mare calming, adult lift/carry/set-down, wind bracing and cover peeking. Five original synthesized music motifs accompany the opening; the rescue adds northern search, ledge, predator and care motifs, distinct cast/portraits, live carrier/passenger contacts and an original illustrated notebook entry.

Mercy Vale remains a separate foundation region rather than the campaign's next chapter:

- **The Last Water:** talk to Ada, investigate the syndicate's water seizure, fight three guards with projectile obstruction, decide the foreman's fate, repair the valve and return to camp. Decisions change character state, moral reputation and legal consequences. Combat deaths restore the active checkpoint.
- On-foot and mounted travel, sprinting, crouching, a limited focus ability, revolver fire/reloading, horse feeding and calling, and rain travel effects.
- Mercy Crossing's trading post, witnessed crime, law pursuit, bounty payment and a live/dead bounty job with actual captive escort.
- Deer hunting and harvesting, timed fishing, Copper's return, a provisions delivery, gatherable plants/timber and ingredient-based crafting.
- Persistent camp food/medicine/materials, donations, three upgrades and distinct requests from Tomas and Fern, including a later visit.
- Map, journal, satchel, keyboard/mouse controls, touch pointer controls and standard controller bindings.
- Versioned local saves, version-1 migration, reload validation and JSON export/import. Autosaves occur after mission transitions and every 30 seconds of active play. Export a save to move it to another browser/device.

Controls are in the pause menu. Keyboard: WASD/arrows move, E interacts, Shift runs, C crouches, H calls your horse, Q draws/holsters, F blocks, V shoves, B restrains, mouse aims/click fires, R reloads, Space holds focus, 1/2/3 use tonic/coffee/horse feed. M/L/I open map/journal/satchel; Escape opens or closes the menu. The touch stick moves; the right-hand buttons act; tap the world to set an aim point. On phones, tap Crouch to lower your stance, move with the stick, then tap again to stand.

## Checks

```sh
npm run check
npm test
```

The simulation suite verifies substantive mission, economy, save, recovery, resource, relationship and escort behavior. To exercise the running UI, use the machine-wide Python Playwright toolkit with Chromium, Firefox and WebKit installed:

```sh
npm run test:browser
python3 scripts/playthrough-check.py
python3 scripts/campaign-playthrough.py --engine chromium --output /tmp/dust-mercy-campaign-playthrough-chromium
python3 scripts/campaign-playthrough.py --engine webkit --output /tmp/dust-mercy-campaign-playthrough-webkit
python3 scripts/campaign-input-playthrough.py --mode pointer --engine webkit --output /tmp/dust-mercy-pointer
python3 scripts/campaign-input-playthrough.py --mode controller --engine chromium --output /tmp/dust-mercy-controller
python3 scripts/rescue-playthrough.py --engine chromium --source-save /tmp/dust-mercy-campaign-playthrough-chromium/17-reloaded-state.json --output /tmp/dust-mercy-rescue --case recover
python3 scripts/rescue-input-playthrough.py --mode pointer --engine webkit --source-save /tmp/dust-mercy-campaign-playthrough-chromium/17-reloaded-state.json --output /tmp/dust-mercy-rescue-pointer
python3 scripts/rescue-input-playthrough.py --mode controller --engine chromium --source-save /tmp/dust-mercy-campaign-playthrough-chromium/17-reloaded-state.json --output /tmp/dust-mercy-rescue-controller
viewport-matrix 'http://127.0.0.1:4173/?play=1' -o /tmp/dust-mercy-viewports --dpr1
```

Browser artifacts are written under `/tmp`, outside the repository. The Mercy Vale browser check accepts `GAME_URL` and `BROWSER_OUTPUT`; the campaign check accepts `CAMPAIGN_URL` and `CAMPAIGN_BROWSER_OUTPUT`. `?play=1` enters a saved journey when available or starts a new one, useful for viewport checks. iPhone-profile WebKit is the available automated Safari-engine approximation; real iOS Safari and physical controllers have not been tested here.

The input playthrough uses the visible phone joystick with mouse pointer drags and touchscreen menu taps, or an isolated standard-Gamepad fixture with controller-only movement and menus. It does not write simulation state. These automated paths have completed the opening and, in separate imported continuations, all ten rescue stages. Native touch dragging, physical controllers and one fresh connected two-mission run remain unverified. The pause menu exposes map, journal and satchel to controller navigation; the right stick scrolls open panels, and Read notebook brings the illustration into view.

## Production scope and evidence

- [Full production plan](docs/production-plan.md)
- [Source research](docs/source-research.md) and [expandable source ledger](content/source-coverage.json)
- [Original campaign opening specification](docs/missions/the-last-warm-light.md)
- [Snowbound implementation, verification and remaining gates](docs/snowbound-evidence.md)
- [Opening animation and complete pointer/controller run evidence](docs/animation-input-evidence.md)
- [Original northern rescue specification](docs/missions/a-voice-under-ice.md)
- [Rescue implementation and verification gates](docs/rescue-evidence.md)
- [Expedition motion and fixture evidence](docs/expedition-animation-evidence.md)
- [Foundation verification and remaining gates](docs/foundation-evidence.md)
- [Engine attribution and exact MIT license](THIRD_PARTY_NOTICES.md)

The Last Water demonstrates foundation systems in Mercy Vale; The Last Warm Light supplies the separately authored opening. Neither closes the full source ledger. Later missions, remaining regions/catalogs, general wildlife tracking/quality, deeper AI/schedules, further bespoke animation/staging, complete input parity, source reconciliation and full-game balance/polish remain open. A state test or screenshot alone cannot establish the requested final quality.
