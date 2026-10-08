# Dust & Mercy

An original western about Mara Vale, a displaced community and a railroad syndicate's control of land and water. Built on the supplied **my-3D2dge AGENT EDITION v0.8.1**: the engine runs the fixed-step loop, input, camera, depth ordering, procedural character rigs, particles and synthesized audio.

This is a **playable foundation build**, not the finished requested game. The complete campaign, regional world and original variations of every source obligation remain the target. The source inventory is open, and no coverage percentage is claimed.

## Run

Use Node.js 20.11 or newer. The game has no runtime dependencies, external assets or network requests.

```sh
npm run dev
```

Open **http://127.0.0.1:4173**. `PORT=8080 npm run dev` changes the local port. The server binds to localhost. Any static web server can serve the project; opening `index.html` as a `file:` URL does not support its ES modules.

## Playable now

- **The Last Water:** talk to Ada, investigate the syndicate's water seizure, fight three guards with projectile obstruction, decide the foreman's fate, repair the valve and return to camp. Decisions change character state, moral reputation and legal consequences. Combat deaths restore the active checkpoint.
- On-foot and mounted travel, sprinting, crouching, a limited focus ability, revolver fire/reloading, horse feeding and calling, and rain travel effects.
- Mercy Crossing's trading post, witnessed crime, law pursuit, bounty payment and a live/dead bounty job with actual captive escort.
- Deer hunting and harvesting, timed fishing, Copper's return, a provisions delivery, gatherable plants/timber and ingredient-based crafting.
- Persistent camp food/medicine/materials, donations, three upgrades and distinct requests from Tomas and Fern, including a later visit.
- Map, journal, satchel, keyboard/mouse controls, touch pointer controls and standard controller bindings.
- Versioned local saves, version-1 migration, reload validation and JSON export/import. Autosaves occur after mission transitions and every 30 seconds of active play. Export a save to move it to another browser/device.

Controls are in the pause menu. Keyboard: WASD/arrows move, E interacts, Shift runs, C crouches, H calls Juniper, mouse aims/click fires, R reloads, Space holds focus, 1/2/3 use tonic/coffee/horse feed. M/L/I open map/journal/satchel; Escape opens or closes the menu. The touch stick moves; the right-hand buttons act; tap the world to set an aim point.

## Checks

```sh
npm run check
npm test
```

The simulation suite verifies substantive mission, economy, save, recovery, resource, relationship and escort behavior. To exercise the running UI, use the machine-wide Python Playwright toolkit with Chromium, Firefox and WebKit installed:

```sh
npm run test:browser
python3 scripts/playthrough-check.py
viewport-matrix 'http://127.0.0.1:4173/?play=1' -o /tmp/dust-mercy-viewports --dpr1
```

Browser artifacts are written under `/tmp`, outside the repository. The browser check accepts `GAME_URL` and `BROWSER_OUTPUT`. `?play=1` enters a saved journey when available or starts a new one, useful for viewport checks. iPhone-profile WebKit is the available automated Safari-engine approximation; real iOS Safari and physical controllers have not been tested here.

## Production scope and evidence

- [Full production plan](docs/production-plan.md)
- [Source research](docs/source-research.md) and [expandable source ledger](content/source-coverage.json)
- [Original campaign opening specification](docs/missions/the-last-warm-light.md)
- [Foundation verification and remaining gates](docs/foundation-evidence.md)
- [Engine attribution and exact MIT license](THIRD_PARTY_NOTICES.md)

The Last Water demonstrates connected foundation systems in Mercy Vale. It does not replace the separately authored Snowbound campaign opening or close the broader campaign ledger. Wildlife tracking/quality, richer AI/navigation, complete interiors, mounting/capture animation, mission replay, source-specific content and full-game balance/polish remain open.
