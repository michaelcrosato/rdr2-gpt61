# Dust & Mercy

An original western about Mara Vale, a displaced community and a railroad syndicate's control of land and water. Built on the supplied **my-3D2dge AGENT EDITION v0.8.1**: the engine runs the fixed-step loop, input, camera, depth ordering, procedural character rigs, particles and synthesized audio.

This is a **campaign work in progress**, not the finished requested game. The complete campaign, regional world and original variations of every source obligation remain the target. The source inventory is open, and no coverage percentage is claimed.

## Run

Use Node.js 20.11 or newer. The game has no runtime dependencies, external assets or network requests.

```sh
npm run dev
```

Open **http://127.0.0.1:4173** to begin in Snowbound. The title screen also opens the earlier Mercy Vale region; its saves preserve the campaign journey. `PORT=8080 npm run dev` changes the local port. The server binds to localhost. Any static web server can serve the project; opening `index.html` as a `file:` URL does not support its ES modules.

For the optimized inspection build, run `npm ci --ignore-scripts`, `npm run build`, then `npm run preview`. The build emits only the game into `dist/`, with minified, hashed engine/game/CSS assets and a build provenance file. Vercel uses the checked-in configuration to build this directory; hashed assets have immutable caching while the entry page revalidates. Test fixtures, saved journeys, source documentation and development tools are excluded from the published output. Saves remain in the browser's IndexedDB for the current site origin; Export/Import moves a journey between local and hosted builds.

## Playable now

- **The Last Warm Light:** a distinct nine-stage campaign opening. Prepare at the frozen refuge, ride the wire trail with Tomas and Inez, negotiate at Copperglass, fight the boiler-yard guards, collect six separate supplies, survive Pavel's disarming ambush, choose his fate, calm and lead Copper, rescue Ada and Gideon through the service doorway, then return with actual supplies. Both rescue priorities and all three Pavel outcomes write lasting consequences; the destroyed boiler, recovered log and captured/escaped Voss persist.
- Snowbound checkpoint retries restore people, equipment, pickups, mounts and fuse timers. Protected participants and abandonment have readable failures. Optional performance records track injury, supplies and actual shooting accuracy. Mission replay keeps the permanent world in a separate snapshot.
- **A Voice Under Ice:** a ten-stage rescue unlocked by the completed opening. Meet Elin, prepare separate loaned equipment, ride with Inez into North Cutting, inspect the trail, signal Silas, climb/brace/crouch/rope through actual height bands, stabilize and carry him across three handoffs, divert seven predators while Inez loads a real passenger, conceal both mounts in the return creek, then return him through two helpers to a clinical bed. The secured dispatch case is optional. Silas keeps scars, a healing schedule, bedside care and a material-backed coat request; the loaned gun becomes Mara's own weapon. His completed rescue opens Orla's food expedition.
- **A Quiet Table:** an eleven-stage companion hunt. Hear Orla, Moss, Vera and Juno separately; confirm the kitchen map, receive Juno's bow and 22 arrows at Copper's actual rack, then ride with her and Bracken into Willow Run. Follow physical signs, learn the wind and draw/release real arrows against moving prey. Wounds, blood trails, relocation, clean kills and hide quality have consequences. Mara and Juno shoulder separate bodies and load one carcass on each mount, pass a bear gorge, and bring both bodies through the kitchen doorway. Timed skinning produces counted meat and two individually owned hides; cooking consumes actual pantry meat and kitchen fuel. Retain or donate Mara's hide.
- **The Names They Took:** a separate fourteen-stage rival investigation unlocked by the rescue. Hear the separate stove-room voices, intervene in the performed strike, receive and inspect the Tern carbine, collect Ruth’s counted spare cartridges and separate tools, then ride with five companions and their distinct mounts into Bellwether Works. Pan and magnify the sightglass to identify people and buildings and witness the card tear, strike and departures, descend behind cover and choose who opens the battle. Two finite enemy groups, alternative patrol tactics, queued focus shots, individual pockets and three separate searches lead to recovered papers and four individually identified quarry charges. Pursue Levi on Skein with a moving lariat or a lawful close tackle, bind and carry him, secure a real rear passenger and return through two camp helpers to a guarded holding room. Stop beside Copper to secure and check the same passenger; weather and loose straps affect the ride. Eight separate holding-room exchanges precede resource-backed care, partial care, reassurance or voluntary deprivation. The papers, captive, mount fate and sibling mission order persist. An optional disarm/theft encounter conserves Bastian's single engraved revolver and its ammunition. Two later holding visits distinguish evidence from pressured testimony. The Hunt and Rival can be played in either order; their joint prerequisite is recorded, while the subsequent heist remains unavailable.
- Copper's riding, feeding and twelve-unit pack unlock after the opening. Actual transfers, ammunition, ownership, historical choices and campaign regions persist in the version-5 campaign graph. Authentic version-1 through version-4 Saves validate under their own codecs before migration, including independent checkpoint and replay histories. Retry/restart and historical replay preserve their complete state contracts; the rescue also supports returning an unused loan and postponing departure.
- Original winter terrain, door-aligned interiors, distinct cast rigs and portraits, snow/breath/steam/fire, authored saddle mounting/dismounting, hand-to-prop contacts, Pavel's drop and close combat, mare calming, adult lift/carry/set-down, wind bracing and cover peeking. Five original synthesized music motifs accompany the opening; the rescue adds northern search, ledge, predator and care motifs, distinct cast/portraits, live carrier/passenger contacts and an original illustrated notebook entry.

Mercy Vale remains a separate foundation region rather than the campaign's next chapter:

- **The Last Water:** talk to Ada, investigate the syndicate's water seizure, fight three guards with projectile obstruction, decide the foreman's fate, repair the valve and return to camp. Decisions change character state, moral reputation and legal consequences. Combat deaths restore the active checkpoint.
- On-foot and mounted travel, sprinting, crouching, a limited focus ability, revolver fire/reloading, horse feeding and calling, and rain travel effects.
- Mercy Crossing's trading post, witnessed crime, law pursuit, bounty payment and a live/dead bounty job with actual captive escort.
- Deer hunting and harvesting, timed fishing, Copper's return, a provisions delivery, gatherable plants/timber and ingredient-based crafting.
- Persistent camp food/medicine/materials, donations, three upgrades and distinct requests from Tomas and Fern, including a later visit.
- Map, journal, satchel, keyboard/mouse controls, touch pointer controls and standard controller bindings.
- Versioned local saves, version-1 migration, reload validation and JSON export/import. Autosaves occur after mission transitions and every 30 seconds of active play. Export a save to move it to another browser/device.

Each world keeps its complete Save in transactional IndexedDB, including checkpoint and replay histories. Save success appears after the captured journey commits. Earlier local Saves migrate without re-encoding; distinct histories remain available under Other saved journeys for paused review and original Export. Ordinary Export/Import retains the full raw graph.

Controls are in the pause menu. Keyboard: WASD/arrows move, E interacts, Shift runs, C crouches, H calls your horse, Q draws/holsters, F blocks, V shoves, B restrains, mouse aims/click fires, R reloads, Space holds focus, 1/2/3 use tonic/coffee/horse feed. With the bow, hold Fire to draw and release to loose; X or Cancel draw keeps the arrow unspent. The controller's right stick moves a manual bow cursor, RT holds/releases, and X cancels. M/L/I open map/journal/satchel; Escape opens or closes the menu. The touch stick moves; the right-hand buttons act; tap the world to set an aim point. On phones, tap Crouch to lower your stance, move with the stick, then tap again to stand.

Nearby actions lists the verbs actually available at Mara's position. While the sightglass is raised, movement controls pan its view while Mara stays still; Zoom in and Zoom out change magnification. Select the working lariat in the satchel, aim at the moving fugitive and fire to throw it; maintain a clear, close line before dismounting and binding.

## Checks

```sh
npm run check
npm test
```

Device saves keep each complete raw journey in IndexedDB. Saving confirms only a committed transaction; old browser saves migrate without re-encoding their bytes. Distinct valid browser copies remain available under **Other saved journeys**. A recovery loads paused with automatic saving disabled; an explicit Save makes it current and retains the previous committed journey for recovery. Export always remains available. Browser/device eviction or abrupt shutdown can still affect device storage; the last frame is not guaranteed saved by `pagehide`.

The storage regression companions use unchanged, earned native four-story/replay fixtures with explicitly documented initial camp proximity limits. They run in fresh browser contexts and write screenshots/reports outside the project:

```sh
python3 scripts/save-database-browser-check.py --url http://127.0.0.1:4173 --output /tmp/dust-mercy-storage-api
python3 scripts/save-database-ui-check.py --url http://127.0.0.1:4173 --output /tmp/dust-mercy-storage-ui
python3 scripts/save-database-recovery-check.py --url http://127.0.0.1:4173 --output /tmp/dust-mercy-storage-recovery
python3 scripts/save-observer-browser-check.py --url http://127.0.0.1:4173 --output /tmp/dust-mercy-save-observer
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
python3 scripts/hunt-playthrough.py --engine chromium --source-save /tmp/dust-mercy-rescue/11-reloaded-state.json --output /tmp/dust-mercy-hunt
python3 scripts/hunt-playthrough.py --engine webkit --hide donate --source-save /tmp/dust-mercy-rescue/11-reloaded-state.json --output /tmp/dust-mercy-hunt-webkit
python3 scripts/hunt-browser-check.py --source-save /tmp/dust-mercy-rescue/11-reloaded-state.json --output /tmp/dust-mercy-hunt-prelude
python3 scripts/hunt-field-ui-check.py --source-dir /tmp/dust-mercy-hunt --output /tmp/dust-mercy-hunt-field-ui
python3 scripts/rival-playthrough.py --engine chromium --source-save /tmp/dust-mercy-rescue/11-reloaded-state.json --output /tmp/dust-mercy-rival
python3 scripts/rival-ui-check.py --source-dir /tmp/dust-mercy-rival --output /tmp/dust-mercy-rival-ui
python3 scripts/rival-render-check.py --output /tmp/dust-mercy-rival-render
viewport-matrix 'http://127.0.0.1:4173/?play=1' -o /tmp/dust-mercy-viewports --dpr1
```

Browser artifacts are written under `/tmp`, outside the repository. The Mercy Vale browser check accepts `GAME_URL` and `BROWSER_OUTPUT`; the campaign check accepts `CAMPAIGN_URL` and `CAMPAIGN_BROWSER_OUTPUT`. `?play=1` enters a saved journey when available or starts a new one, useful for viewport checks. iPhone-profile WebKit is the available automated Safari-engine approximation; real iOS Safari and physical controllers have not been tested here.

The input playthrough uses the visible phone joystick with mouse pointer drags and touchscreen menu taps, or an isolated standard-Gamepad fixture with controller-only movement and menus. It does not write simulation state. These automated paths have completed the opening and, in separate imported continuations, all ten rescue stages. A Quiet Table also has complete imported keyboard/mouse continuations in Chromium, Firefox and WebKit. The Rival has independent causal state routes, bounded public UI checks and explicitly injected native rendering fixtures. Complete imported keyboard/mouse continuations and normal reload pass in Chromium and Hunt-first Firefox on the persistence build; targeted current checks cover the later optional-visit wording and guard validation. The current full Hunt-first WebKit continuation also passes, including normal Save/Continue and counted ration use with voluntary-deprivation history preserved. Failed exploratory reports and partial field/chase continuations remain separately labelled. The Rival renderer script inspects injected art/contact scenes and supplies no gameplay or valid-save proof. Full Hunt/Rival pointer and controller paths, native touch dragging, physical controllers and one fresh connected four-mission run remain unverified. The pause menu exposes map, journal, satchel and nearby actions to controller navigation; the right stick scrolls open panels, and Read notebook brings the illustration into view.

## Production scope and evidence

- [Full production plan](docs/production-plan.md) and [context-recovery record](docs/continuation.md)
- [Source research](docs/source-research.md) and [expandable source ledger](content/source-coverage.json)
- [Original campaign opening specification](docs/missions/the-last-warm-light.md)
- [Snowbound implementation, verification and remaining gates](docs/snowbound-evidence.md)
- [Opening animation and complete pointer/controller run evidence](docs/animation-input-evidence.md)
- [Original northern rescue specification](docs/missions/a-voice-under-ice.md)
- [Rescue implementation and verification gates](docs/rescue-evidence.md)
- [Expedition motion and fixture evidence](docs/expedition-animation-evidence.md)
- [Original companion hunt specification](docs/missions/a-quiet-table.md)
- [Hunt source, state and player-control verification gates](docs/hunt-evidence.md)
- [Rival operation: The Names They Took — implementation and verification in progress](docs/missions/the-names-they-took.md)
- [Rival state, migration and player-control verification gates](docs/rival-evidence.md)
- [Train operation: What the Line Carries — full specification, unavailable](docs/missions/what-the-line-carries.md)
- [Partial native Train camp prefix and component evidence](docs/train-evidence.md)
- [Train source child obligations and unresolved variants](docs/train-source-audit.md)
- [Relocation: Where the River Widens — authoring only, unavailable](docs/missions/where-the-river-widens.md)
- [Foundation verification and remaining gates](docs/foundation-evidence.md)
- [Engine attribution and exact MIT license](THIRD_PARTY_NOTICES.md)

The Last Water demonstrates foundation systems in Mercy Vale; the four Snowbound stories add distinct authored campaign work. The full source ledger remains open, with no accepted requirements. Later missions, remaining regions/catalogs, free travel between completed expedition regions, general weapon/tracking/skinning access outside the owning mission, deeper AI/schedules, further bespoke animation/staging, complete input parity, source reconciliation and full-game balance/polish remain open. A state test or screenshot alone cannot establish the requested final quality.
