# Dust & Mercy — northern rescue implementation evidence

Evidence date: 2026-10-08. Build 0.3.0 adds **A Voice Under Ice**, a ten-stage original rescue following [The Last Warm Light](snowbound-evidence.md). The full production plan remains active. This document records implementation and bounded verification; the open source ledger has zero accepted requirements.

## Playable behavior and persistent campaign

Elin's physical camp meeting starts the search. Tomas and Inez have separate required briefings. Mara inspects a loaned two-shell coach gun on Copper's rack, rides into the separately authored North Cutting with Inez and Thimble, reads the Ash-camp/ford evidence, identifies dead Lark, fires a real signal shot and follows Silas's answer. A sealed one-use cartridge handles an empty revolver without refilling the weapon.

The ascent has three actual timed climbs, a braced ice lip, a low-clearance arch and a rope anchor. Ration, Inez's one-serving flask and sheltered rest are distinct recovery paths. Mara checks breathing, dresses Silas, carries him and makes three timed handoffs across the wider descent. Optional dispatch recovery requires a stabilized, anchored patient attended by Inez. The case is never required for the rescue.

Inez physically carries Silas from the loading spur to Thimble while Mara diverts the first three wolves. Loading and strapping produce one passenger attachment; Inez mounts in front. Two additional pairs pursue along the descent. Seven original wolves have separate phase/target/route/bite/flee state and terrain/projectile collision. Coach-gun pellets share a trigger accuracy credit and stop on a wolf killed by their own volley; firing into a protected person or mount still fails.

Both mounts must traverse at least 180 continuous world units of the return creek, remain within 120 units and leave through the left bank. Premature exit is recoverable. Upper ice closure persists. On returning to Snowbound, Mara unloads Silas and gives him to Moss and Vera, who actually carry him through the shelter doorway to a bed. Elin/Fin, Tomas and Della have separate return interactions. Completion records an original SVG notebook drawing, returns unused borrowed stock and transfers the existing gun's ownership without replenishing it. The next companion hunt and rival investigation remain unavailable obligations.

Silas stays in the bed with scars and a 36-world-hour healing schedule. Six-hour bedside watches, dressing care and one-material coat repair preserve separate clinical/resource transactions. The current ordinary opening supplies do not supply cloth for the coat request; the independent repair test labels its one-material fixture. Healing/injury change with resumed world time and are not frozen by a load.

`src/campaign-journey.js` stores a version-2 entity/weapon/party/region graph with separate historical mission records. Root compatibility views and equipped ammunition are derived. Attachments own carriage, passenger seating and anchored rest; no actor body has two owners. The original version-1 opening validator runs before migration, including each historical checkpoint and replay canonical body. Opening choices, care, station damage, Copper identity/bond/pack and unrelated inventory persist.

Retry restores a whole checkpoint; restart uses the mission entry captured before the loan. Historical mission replay isolates the complete permanent world. Postponing an unused expedition returns only borrowed equipment and preserves unrelated consumption, packs, clock and camp changes. Presentation events and clip queues are transient and excluded from all saved histories.

## Verification recorded so far

`npm run check` and all **158 substantive Node tests** pass. The 94 independent journey/rescue tests cover actual version-1 public-save migration, historical checkpoint ownership, future/malformed graph rejection, equipped ammunition, exact suspended traversal, no duplicate kit grants, both complete case routes, real movement/handoffs/passenger loading/creek/helper delivery, protected fire, drop and abandonment recovery, postponement, clinical care and full canonical replay. A completed, clinically cared rescue survives replay of the older opening and restoration of its permanent world. Wolf positions in the independent projectile tests are explicitly staged fixtures; those tests are separate from ordinary browser combat.

| Evidence | Observed scope | Artifact directory under `/tmp` |
| --- | --- | --- |
| Fresh opening and rescue availability | All nine opening stages through ordinary keyboard/mouse controls; current v2 Save and successful reload | `dust-mercy-journey-opening-chromium-stable` |
| Ordinary recovered-case rescue | Untouched current v2 opening imported through visible file chooser; all ten stages, seven real wolf kills, physical creek/helper return and successful Save/reload | `dust-mercy-rescue-chromium-final` |
| Ordinary omitted-case rescue | Same visible import start; independent full WebKit route without the optional case, successful Save/reload | `dust-mercy-rescue-webkit-omit-final` |
| Ordinary Firefox rescue | Same visible import start; full recovered-case route and successful Save/reload | `dust-mercy-rescue-firefox-final` |
| Phone pointer rescue | Full WebKit iPhone SE route: 271 visible joystick drags, 12 action holds and 159 native touchscreen taps; no keyboard fallback; successful Save/reload | `dust-mercy-rescue-pointer-webkit-se` |
| Controller rescue | Full Chromium route: 264 axis holds, 668 button holds and 70 D-pad/A modal selections; no keyboard/mouse/touch gameplay fallback; successful Save/reload | `dust-mercy-rescue-pad-chromium` |
| Notebook input controls | Separate completed-Save imports; actual Read notebook tap/D-pad+A exposes the entire drawing. Pad right-stick scrolling moves the panel down and back | `dust-mercy-rescue-notebook-pointer-webkit`, `dust-mercy-rescue-notebook-pad-chromium` |
| Actual northern and return UI | 70 captures over ten profiles: phone orientations, Android/foldable, WebKit tablet, all three desktop engines and ultrawide; visible Import, map/satchel, preferences, Save/reload, completed camp and actual Read notebook | `dust-mercy-rescue-ui-final` |
| General integrated viewport matrix | 24 clean captures across 14 phone/foldable/tablet/desktop profiles; inspected PNG contact sheets | `dust-mercy-rescue-integrated-viewports` |
| Held-focus failure regression | Mouse aims at actual Copper from an untouched game-generated combat Save; protected-shot failure stays pending after Space release; explicit Retry restores once in all three engines | `dust-mercy-rescue-held-focus` |

The exploratory ninth rescue report is **false**: its older driver incorrectly required clinical hours/injury to remain frozen during resumed reload frames. Actual ordinary completion/reload occurred, the opening history was unchanged, and the observed clinical drift exactly matched the elapsed world clock. Its result remains preserved. Fresh Chromium, WebKit and Firefox runs with the corrected clock comparison pass; they are the normal completion evidence above. The false exploratory report was not relabeled.

All five full rescue runs ended with seven combat shots, seven successful triggers, seven wolf kills, zero deaths and honor +2. Chromium ended at health 75 with 80 aggregate wolf-bite damage; WebKit ended at health 55 with 100; Firefox ended at health 70 with 80. Pointer and pad routes each recorded 130 aggregate bite damage. The all-wolves/no-bites condition correctly remained false; accuracy passed. Signal fire is excluded from these combat counters. This establishes the observed paths' behavior, not every input/choice combination or a public no-bite run. Import/file-chooser setup is separate from gameplay; the notebook-only reports explicitly do not claim another full mission completion.

The UI check imports real intermediate Saves; it is not a full ordinary-control playthrough. Root inspected all 50 earlier northern UI images through seven contact sheets, 22 new completed-camp/notebook/landscape images through three sheets, the complete opening carry/reload images, and all 24 fresh general viewport captures. Root also inspected both supplementary notebook input screenshots. Landscape objective/status text and joystick no longer overlap. A visible phone crouch toggle supports the low arch without simultaneous pointers. The held-Space regression establishes mouse targeting and failure recovery, not a complete manual-mouse combat route. In the separate keyboard/mouse notebook captures, frame 14 precedes smooth-scroll settling; frame 15 shows the complete drawing after the actual button's scroll settles in all three engines. Those earlier captures remain preserved.

[Expedition animation evidence](expedition-animation-evidence.md) records original terrain/cast, actual engine limb/contact solver diagnostics, timed normal/reduced motion, cross-engine fixture images and isolated renderer timing. These explicitly staged scenes do not replace ordinary play or whole-interface frame-rate measurements.

## Reproduce

Run the local server with `npm run dev`; the scripts use the machine-wide Python Playwright installation. Outputs belong outside the repository.

```sh
npm run check
npm test
python3 scripts/campaign-playthrough.py --engine chromium --output /tmp/opening-proof
python3 scripts/rescue-playthrough.py --engine chromium --source-save /tmp/opening-proof/17-reloaded-state.json --output /tmp/rescue-proof --case recover
python3 scripts/rescue-browser-check.py --source-dir /tmp/rescue-proof --output /tmp/rescue-ui-proof
python3 scripts/rescue-pointer-check.py --source-save /tmp/rescue-proof/07-pack-combat-00.json --output /tmp/rescue-focus-proof
python3 scripts/rescue-input-playthrough.py --mode pointer --engine webkit --source-save /tmp/opening-proof/17-reloaded-state.json --output /tmp/rescue-pointer-proof
python3 scripts/rescue-input-playthrough.py --mode controller --engine chromium --source-save /tmp/opening-proof/17-reloaded-state.json --output /tmp/rescue-pad-proof
python3 scripts/rescue-input-playthrough.py --mode controller --engine chromium --journal-only --source-save /tmp/rescue-pad-proof/11-reloaded-state.json --output /tmp/rescue-notebook-proof
viewport-matrix 'http://127.0.0.1:4173/?play=1' -o /tmp/general-viewport-proof --dpr1
```

The rescue starts through the ordinary Import menu and browser file chooser using an untouched game-generated opening Save. Camera/DOM/normal-menu Save evaluation is read-only. J uses the game's ordinary nearest-hostile aiming helper; it is not proof of precise manual aiming. The pointer path uses joystick mouse drags plus native touchscreen taps, not native multi-touch dragging; the pad path uses a standard-Gamepad fixture, not hardware. WebKit phone/tablet profiles approximate Safari's engine; real iOS Safari is unavailable here.

## Remaining gates

The exact wiki revision/full conditional transcript, minor participants/chatter, exact predator count and scoring, source camp windows, later dependencies and full source-specific acceptance remain open. Some original proposal dialogue/cast details remain authoring references rather than implemented conditional scenes. The hunt and rival-camp requirements still need their own complete implementations. Full input/branch combinations, native touch/physical hardware, accessible alternatives, richer camera/dialogue/audio staging, whole-game performance/balance and the rest of the complete campaign/catalogs remain required. Neither this mission nor its implementation count closes the inventory or establishes the requested final quality.
