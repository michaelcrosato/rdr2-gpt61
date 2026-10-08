# Dust & Mercy — Snowbound implementation evidence

Current status (2026-10-08 re-review): this receipt describes the earlier opening build. The northern rescue now has a playable implementation and independent evidence in [rescue-evidence.md](rescue-evidence.md); the subsequent companion hunt is documented in [hunt-evidence.md](hunt-evidence.md). Statements below about unavailable follow-ups describe the recorded build, not the current journey. The full source and quality gates remain open.

Evidence date: 2026-10-08. The original campaign opening, **The Last Warm Light**, has a playable nine-stage runtime. The requested full game remains the target; neither this milestone nor its checks establish complete source coverage or final presentation quality.

This document records the 0.2.0 opening baseline. The [0.2.1 animation and input follow-up](animation-input-evidence.md) adds authored contact motion, safe dismount placement, controller access to map/journal/satchel, eight further tests and complete pointer/controller runs. Baseline partial-input and animation gaps below describe the earlier build; the follow-up states the current evidence and remaining limits.

## Implementation and state

`content/campaign/snowbound.js` authors the winter region, exact interior doors/collision, switchback, cast, seven distinct supply/clue objects and rescue route. `src/campaign.js` implements the following connected stages rather than reusing The Last Water under another title:

| Stage | Required behavior and resulting state |
| --- | --- |
| Find heat | Actual coat/lantern pickups and Tomas's briefing precede departure; the refuge establishes Neri's death and Silas's absence. |
| Follow the wire | Mounted travel traverses six route landmarks with Tomas nearby; inspecting the cut cable and meeting Inez are separate interactions. |
| A company signature | Park the mounts, choose working culvert/winch cover, and signal Tomas. Tomas and Inez physically approach their positions before Voss recognizes the token and threatens them. |
| Hold the boiler yard | Projectile collision, gauge guard, moving flanker and supervisor operate separately. Companions take cover/protect the pen; Voss physically flees and can be captured before escaping. |
| What the station kept | Six essential supply objects require individual pickup and enter inventory once. The optional message log and interior clutter remain distinct. |
| The coal-store bargain | Pavel disarms Mara. Blocking, two shoves, restraint, weapon/token recovery and interrogation precede release/bind/kill. Every branch preserves Silas's essential lead. |
| A name the mare knows | Drawn weapons, gunfire and rushing affect Copper's fear. Holster, speak, calm, pat and physically lead her to the hitch before ownership is assigned. |
| Keep the relay alive | The fuse counts down from ignition. Choose log preservation or Gideon first, release pressure, physically carry Gideon and escort Ada through the west route. Failures restore the rescue checkpoint; the boiler and relay change permanently. |
| A light at the kiln | Return with living people, Copper and actual essentials. Exactly-once inventory delivery consumes stove food/kindling, admits Ada, records Gideon's care needs and remembers Neri. Riding/care/twelve-unit pack storage unlock after return. |

The next mission, `snowbound-a-voice-under-ice`, is an unlock record and an unavailable next story, **not an implemented rescue**. Pavel's later warning/guard responsibility, Voss's future checkpoint and the message log's hearing role are persistent records awaiting the separately authored later content. They are not proof those later events exist.

`src/frontier.js` routes shared player verbs to the active region. `src/game.js` provides keyboard/mouse, touch pointer and standard controller input, visible close-combat actions, fuse/fear/weapon/carry feedback, map, journal, supply/pack menus and checkpoint/replay controls. Campaign and Mercy Vale saves have separate slots with legacy-save recovery. Accessibility preferences persist locally. `src/aiming.js` maps clicking a projected actor's body to its simulated ground position without bypassing projectile obstruction.

Checkpoint snapshots include actor positions/injuries/routes, equipment, picked-up props, mounts, inventory, moral choices, fire/fuse and timers. Strict versioned restore validates these records and reconciles trusted authoring identities in the live state, checkpoints and replay snapshot. Replay preserves a separate canonical world and cannot transfer its choices/items into that world.

## Independent simulation checks

`npm run check` and `npm test` pass: 46 tests, comprising 24 campaign checks, 20 preserved Mercy Vale checks and two pointer-aiming checks. The campaign tests traverse the actual mission verbs, mounted route, projectile fights, individual pickups, mare leading and both evacuation routes. Fixture placement is used for targeted state tests; it is not ordinary-control playthrough evidence.

Coverage includes all six Pavel × rescue combinations; Voss capture/escape; real damage/focus/ammunition; both covers' projectile and movement obstruction; disarm/recovery prerequisites; once-only pickups, supplies and ownership; food consumption without a progression dead end; frightened-mare recovery; all reached checkpoint snapshots after lethal events; protected people and all essential mounts; fuse/fire/abandonment failures; safe saves and an active carry save; malformed nested data; camp care/pack proximity/count conservation; a physical return to the destroyed station; and complete replay/save isolation. These checks support the listed runtime behaviors, not full art or source acceptance.

## Player-control evidence

`scripts/campaign-playthrough.py` starts a new journey and uses ordinary keyboard movement/interaction/firearm/melee inputs and mouse dialogue/menu choices. Evaluation reads the camera and saves created through the normal menu; it does not write state, inject a save, call simulation methods or teleport actors. Its branch parameters are `--pavel release|bind|kill`, `--rescue preserve-log|carry-gideon-first`, and `--voss escape|capture`. Reports, screenshots and before/after save snapshots are written under `/tmp`.

The completed ordinary-control runs below each finish all nine stages and reload the completed world. Each records four shots/four hostile hits, two guard kills, zero deaths, no invented cash reward, all six supply objects, camp food 3/materials 0 and Copper's post-return unlocks. Yard injury correctly fails that optional condition; 100% accuracy passes its separate condition. Branch/camp/world/inventory/performance records survive reload. Mid-carry saves also record Gideon's physical attachment before he is brought through the door.

| Engine | Pavel | Rescue priority | Voss | Final health / honor / camp medicine | Evidence directory under `/tmp` |
| --- | --- | --- | --- | --- | --- |
| Chromium | Kill | Gideon first | Escape | 82 / −20 / 2 | `dust-mercy-campaign-playthrough-chromium-kill-carry-complete` |
| Chromium | Bind | Preserve log | Escape | 82 / 2 / 1 | `dust-mercy-campaign-playthrough-chromium-bind-log-verified` |
| Chromium | Release | Preserve log | Capture | 69 / 5 / 1 | `dust-mercy-campaign-playthrough-chromium-release-log-capture-verified` |
| Chromium | Release | Gideon first | Escape | 82 / 5 / 2 | `dust-mercy-campaign-playthrough-chromium-release-carry-verified` |
| Firefox | Bind | Gideon first | Escape | 82 / 2 / 2 | `dust-mercy-campaign-firefox-bind-carry-final` |
| Firefox | Kill | Preserve log | Escape | 82 / −20 / 1 | `dust-mercy-campaign-playthrough-firefox-kill-log-verified` |
| WebKit | Bind | Preserve log | Escape | 82 / 2 / 1 | `dust-mercy-campaign-webkit-bind-log-complete` |

Together these runs cover all six Pavel × rescue combinations and both Voss outcomes. Combat uses the built-in J keyboard targeting; the runs do not establish precise mouse aiming or full touch/controller completion.

The UI smoke suite at `/tmp/dust-mercy-campaign-browser` covers Chromium/Firefox/WebKit desktop and a 375×667 WebKit phone: preparations, original portrait/dialogue, map/satchel/menu, draw/holster, saves/reload, separate-region preservation, extra-large text and reduced-motion preference persistence. Phone joystick pointer movement and an emulated standard Gamepad API opening/controls/menu also pass, including D-pad navigation to the dialogue text selector, persisted text changes and saving with A. These are partial touch/controller checks, not full nine-stage input parity or physical hardware tests.

The independent UI audit at `/tmp/snowbound-integration-review` uses explicitly labeled valid-save fixtures to verify isolated replay, separate region saves, aim-facing before a shot, controller settings and gradual horse-fear audio. Chromium desktop and WebKit phone also verify the direct failed-replay return saves the permanent journey immediately; the old version-1 two-choice failure migrates to include that return. Completed stove interactions actually withdraw camp oats, and Inez has a reachable branch-dependent aftermath conversation. Such fixtures support those UI/state contracts and are distinct from the public-control playthroughs above.

Earlier exploratory playthrough reports are retained separately. Their driver shortcuts collided with authored door/refuge geometry; the corrected driver follows the actual door and camp approach routes. Those unsuccessful reports are not counted as completed playthroughs.

## Rendered and interface evidence

`src/snowbound-renderer.js` uses the supplied engine's projection, painter ordering, humanoid rigs, pixel primitives, camera and particles. Original winter art includes mountain silhouettes, kiln/tents/stove/memorial, cut wire/red lamp, interiors and seven supply/clue props, distinct cast/costumes, horse rigs/fear/leading rope, snow/breath/steam/fire, an adult carry, a visible service walkway and lasting boiler wreck/relay scorch. `src/cast-portraits.js` supplies original cast portraits. `src/snowbound-audio.js` supplies five original synthesized motifs, indoor/outdoor wind, terrain footsteps/hoofbeats, horse fear, pressure/fuse cues, distant reports and destruction sound; the engine's mute/volume controls govern them.

The final viewport matrix at `/tmp/dust-mercy-snowbound-viewports-final` has 24 clean captures across 14 phone/foldable/tablet/desktop profiles, including Chromium, Firefox and WebKit desktop. `/tmp/dust-mercy-snowbound-intro-final` adds five clean phone title-screen captures. Reports have zero horizontal overflow, page/console errors or failed requests. Small-phone/landscape/desktop and contact sheets were inspected directly; extra-large phone dialogue and normal-control carry/destruction images were also inspected.

`/tmp/snowbound-renderer-final-checks` contains six live phone/desktop engine contexts, ten staged WebKit presentation states and reduced motion, all without console/page/engine errors. Staged states inspect supplies, disarm/block/restraint, fear/leading, carry/escort, fire before/after relief, aftermath and Neri's empty memorial; they are presentation fixtures, not full mission playthroughs. Sampled median render costs were 4–5 ms Chromium, 10–12 ms WebKit and 6–8 ms Firefox, with p95 6–7/14–15/9–11 ms respectively. These samples do not establish a full-game performance budget.

The mobile Lighthouse accessibility audit at `/tmp/dust-mercy-snowbound-accessibility.json` scores 100 with no failed audits. It covers the audited interface state, not complete game accessibility. WebKit phone profiles approximate Safari's engine; real iOS Safari is unavailable here.

## Remaining acceptance and whole-game gates

The source inventory remains open and its live revision is not pinned. This opening's source obligation is **in progress**, not accepted. Incidental participants/responses, full linked source beats and later dependencies still need reconciliation. The full campaign, regions, side content, catalogs, advanced systems and final boardroom report remain required.

The baseline identified saddle mounting/dismounting, wind bracing, cover peeking, Pavel's platform drop/contact disarm/grapple, hand-to-prop contacts and carry lift/set-down as unfinished. The 0.2.1 follow-up implements those authored motions and documents timed checks. Richer escort/relationship expressions, destruction choreography and final scene-level audio/dialogue/camera review remain open; those motion checks alone do not establish the requested final quality.

The follow-up completes one full automated pointer path and one controller path. Native touch dragging, physical hardware checks, all branch input combinations, accessible alternatives and measured balance remain open. Later care/warning/hearing/checkpoint events must be implemented in their actual content. The broader source ledger and full requested game cannot be closed by this opening's green tests or screenshots.
