# Dust & Mercy — full production plan

## Product target and governing scope

Build a finished original western game around Mara Vale and a community threatened by a railroad syndicate, using the supplied `my-3d2dge-agent.js` as the foundation. Preserve the scope of the supplied RDR2 wiki: every described mission, battle, side quest, character, item, activity, progression feature, animal and other authored beat needs a functional original variation. The project remains active until that entire target is built and verified.

The [source research](source-research.md) and [machine-readable coverage ledger](../content/source-coverage.json) identify current obligations and unknowns. The ledger is open. Its current rows are a research baseline, not a capped production backlog. Any newly identified source obligation adds work; it does not get folded into a generic parent to preserve a convenient count.

A playable prototype demonstrates an implementation direction. A vertical slice demonstrates representative final quality and interconnected feature behavior. The full game supplies all required content at that quality. These are three different milestones.

## Original identity and design principles

Dust & Mercy treats western life as a network of obligations: a horse is a partner and carrying capacity; a camp is a community with needs; money buys food and also creates dependencies; violence changes witnesses and relationships; distance, terrain and weather shape a plan. The campaign's central pressure comes from a railroad syndicate's control over land, freight and public authority. Mara must decide whom to protect, what resources to risk and which compromises become permanent.

Use each source obligation to identify the experience it contributes—learning through companionship, a tense negotiation, a risky convoy assault, a morally difficult debt, a quiet fishing friendship, an extended rescue, civic corruption, an escalating mystery, or a changed home—and author a different event with its own causal structure. Preserve the distinct experience and all functional stages without reproducing source dialogue, names, maps, mission scripts or visual assets.

Do not equate originality with renaming. An original counterpart needs a different situation, people, staging and consequence while retaining the relevant breadth and depth. Several source personalities cannot be satisfied by one stock merchant or by merging their roles. Several battles cannot be satisfied by reusing one clearing with a different title.

The desired visual character is grounded western atmosphere: warm arid light, cold mountain exposure, damp river country, expansive skies, readable silhouettes, worn interiors, deliberate camera staging and animated everyday life. The engine's procedural drawing is an implementation medium. It does not waive the brief's art, animation, polish or source-inspired look-and-feel requirements. Review art direction against playable scenes and movement before declaring quality achieved.

Improve unclear prompts, cumbersome input, opaque tracking and brittle mission recovery where useful. Provide readable objectives, accessible alternatives, reliable checkpoint recovery, and transparent records of what the player has done. Those improvements preserve the mechanics, content and choices they serve.

## Engine foundation and architecture

The supplied v0.8.1 engine manual establishes world x/y/z coordinates, fixed-step updates, projected views, tile maps and collision, flow-field pathfinding, procedural actor rigs, sprites, pixel-aware rendering, camera following, dialogue, menus, particles, music and sound synthesis. These are useful starting components, not a complete western simulation.

Keep game logic in world units and update it through the engine's fixed step. Render depth-sorted world objects through its renderer and readable UI through its overlay layer. Maintain the engine's actual contribution visibly in the running game; merely retaining the file beside an unrelated renderer does not satisfy the foundation requirement.

Build or extend these responsibilities as production requires:

- A deterministic simulation clock for schedules, weather, travel, encounters and saves.
- World regions with travel networks, collision, interiors, habitats, visible landmarks and population limits.
- Actor state machines for navigation, observation, suspicion, conversation, combat, fleeing, capture, care and daily work.
- A companion layer for relationships, schedules, requests, activities, shared missions and changed-world outcomes.
- Mount rigs and riding physics for gait, turning, mounting, dismounting, fear, care, storage and injury.
- Weapon handling for ammunition, reloads, recoil, spread, reach, projectiles, line of sight, wear, familiarity, customization, dual wielding and animations.
- Wildlife behaviors, species identification, tracks, damage/quality, carcasses, storage, decomposition and field study.
- Rules for health, stamina and focus reserves, underlying condition, food, rest, climate and equipment effects.
- Witness and law state distinct from moral consequences and local relationship state.
- Data-driven authored missions with prerequisites, stages, participant roles, objectives, conditions, branches, checkpoints, failures, rewards and aftermath.
- Inventory and economy with stable item identifiers, transactions, ingredients, recipes, equipment, services and ownership.
- Versioned saves and migration logic covering the world, actors, missions, inventory, mounts, economies, discoveries, choices and later chapters.
- Input parity for keyboard/mouse, touch and controllers, plus responsive and accessible menus.
- An asset and animation library supporting distinctive characters, animals, places, props, weather, action and everyday behavior.

Separate authoring data from generic simulation code. A mission should reference tested verbs and actor behaviors but still own its route, dialogue, staging, decision structure and consequences. Data reuse improves production reliability; authored variety remains a content gate.

## Phase 1 — source reconciliation and full authoring specifications

Expand every pending parent in the ledger into final units. Traverse linked story-mode sources and record article URLs, evidence dates, chapter/edition tags and uncertainties. Pin source revisions or document why the available evidence cannot be pinned.

Campaign work must decompose every title into meetings, movement, investigations, conflicts, battles, choices, companion relationships, cutscenes, failure cases, medal conditions and lasting outcomes. Reconcile grouped numbered parts, debtor variants, cinematic-only entries and cross-chapter availability without inventing a total.

Expand stranger meetings and branches, camp events and companion item requests, finite bounties, home and business robberies, coach tips, hideouts, ambient events and named repeat encounter characters. Expand every challenge rank and its counters/rewards. Expand wildlife to compendium species, horse coats and named mounts; expand locations to all relevant interiors, small localities and landmarks; expand the full cast and item/recipe/clothing catalogs.

For each source unit, author an original specification containing:

1. A stable source requirement ID and links.
2. The experience being preserved and the original situation.
3. Unique original cast, locations and assets.
4. Playable stages, rules, dialogue, choices and participant behaviors.
5. Prerequisites, availability windows, reward/economy effects and aftermath.
6. Appropriate success, failure, recovery and replay behavior.
7. Runtime acceptance evidence that can demonstrate the requirement.

Exit gate: the inventory is explicitly sealed with no unexplained parent, edition, pagination or unresearched source-category gaps. Authoring specifications are complete enough for implementation. This phase can run alongside foundation work, but unresolved inventory prevents a full-completion claim.

## Phase 2 — connected simulation and presentation foundation

Implement movement, camera, collision, controls, saving and mission stage orchestration first. Add riding, combat, capture, interaction, camp, survival, wildlife, gathering, crafting, transactions, moral state and law state as connected systems.

A system passes this phase when it changes world state correctly, exposes readable feedback, saves and reloads, handles its relevant failure cases and is usable through supported inputs. A HUD meter without a governing mechanic is unfinished. A shop list without transactions is unfinished. A horse-shaped drawing without ownership, riding and care is unfinished.

Build meaningful checks for high-impact state: mission transitions and branches, prerequisite resolution, save/restore, ownership/inventory transactions, witness identity, capture delivery, ingredient consumption, combat ranges and projectile obstruction. Add tests when they verify these independent behaviors; avoid tests that merely repeat the implementation.

Exit gate: the foundational loops work together in one persistent region, supported by original visual and audio direction. Remaining advanced variants stay explicitly open.

## Phase 3 — representative vertical slice

Author a connected portion of the intended game that demonstrates final quality in a living region. It should give the player room to travel, prepare, interact and choose, rather than presenting all mechanics as disconnected menu demonstrations.

The slice must connect:

- Mara, a distinct companion group and a community camp with supplies, requests, upgrade choices and changing dialogue.
- On-foot and mounted travel, horse care, carrying equipment and a terrain/weather consequence.
- A staged railroad-related mission with authored setup, investigation or preparation, multiple conflict roles, at least one meaningful alternative, checkpoint recovery, and visible aftermath.
- Firearm handling, cover/obstruction, melee or capture, and focus progression behavior appropriate to that campaign stage.
- A witnessed crime and an escape/payment/surrender consequence, distinct from the moral result of the player's action.
- A hunt with tracking, species recognition, clean-kill/quality consequences, carcass handling and use or sale.
- A fishing outing, a gathering/crafting loop, and a service transaction integrated into the community's needs.
- A stranger relationship that returns for a distinct later stage, and an ambient event whose outcome persists.
- A journal/discovery record and a versioned save that restore the complete slice.
- Original character, mount and wildlife animation; staged lighting/weather; responsive sound and music; clear objective and interaction UI.
- Keyboard/mouse, controller and touch operation with small-screen layouts and real browser testing.

These are minimum representative quality gates, not a full-content cap. A prototype lacking them must remain labeled as foundation/prototype work. A successful slice still leaves the rest of the source ledger active.

Exit gate: play the complete slice normally across inputs and supported browsers, inspect captures, verify all consequential state, and record acceptance evidence. The slice must demonstrate the same authoring model and presentation quality that the full content will use.

## Phase 4 — full regional world and campaign

Expand the world into original equivalents of every source locality and environmental function, including remote mountain country, plains and ranches, wooded river country, wetlands, an industrial city, the western frontier, arid late-game country and an offshore chapter setting. Keep smaller settlements, interiors, encounter sites, collectible locations and authored scenery in the scope ledger.

Build the full campaign and both later-life arcs using the reconciled mission graph. The proposed chapter sequence is Snowbound, Dustwater, The Orchard Wars, Gilded Harbor, The Salt Exile, The Price of Mercy, Honest Ground and A Home Worth Keeping. These names are provisional authoring destinations, not proof of completed chapters.

Each campaign counterpart must provide its unique gameplay, cast participation, dramatic turn, battle staging and persistent world effects. Later chapters must introduce the appropriate expanded abilities, pressures and consequences. The final acts and later-life arcs need independent playable authored content and changed-world relationships; a credits screen after the slice does not supply them.

Exit gate: every campaign requirement and its child beats has an implemented original counterpart and runtime evidence. Full start-to-end playthroughs exercise all branches and intended alternative orders; post-story state remains playable and consistent.

## Phase 5 — all side content and everyday life

Complete every stranger strand and all meetings/branches, including collectibles, correspondent rewards, altered later encounters and epilogue-only outcomes. Complete companion activities, timed requests, camp conversations, celebrations, arguments and chores. Complete every finite bounty and crime/robbery family, including live-delivery conditions, service-area differences and follow-up consequences.

Complete every ambient encounter and named repeat character sequence, using region/time/world-state gates where appropriate. Complete the minigames as real games with rules, opponents, persistence and economic consequences. Complete all treasure chains, collection sets, landmarks, journals, shacks and other discoverable content.

Exit gate: every side-content child record closes individually. Shared verbs can be reused, but a random encounter generator does not substitute for the original variations of all authored source events.

## Phase 6 — complete catalogs, progression and economy

Finish all weapons and unique variants, combat animations, ammunition and customization options. Finish equipment, clothing, weather suitability, stolen/unique hats, provisions, tonics, valuables, documents, recipes, pamphlets, bait/lures, satchels, tack, talismans and trinkets with distinct acquisition, use and visible identity.

Finish every animal species and required variation, fish behavior and exceptional storyline, horse breed/coat/named-mount obligation, and plant species with habitats, discovery records, behavior, art, animation and loot/ingredient uses.

Finish all challenge ranks, attribute progression, targeting abilities, equipment unlocks, services, commerce and reward dependencies. Balance money, supplies, travel risk, care and crafting through full-game play. Use tracking that covers the entire requested source scope rather than inheriting the narrower source 100% threshold.

Exit gate: every catalog item and progression state is functional, discoverable, persistent and tested through its acquisition/use loop. Names and icons alone cannot close entries.

## Phase 7 — complete-game polish and verification

Review pacing, travel distances, animations, story transitions, combat readability, camera obstruction, objectives, conversation flow, AI behavior, ecology, economy and interface accessibility across the whole game. Polish original art, audio and cinematic staging to the slice's intended quality.

Use the machine's [testing toolkit](/home/micha/dev/TESTING-TOOLKIT.md) instructions where applicable. UI changes require small phones, foldables, tablets, wide screens and Chromium, Firefox and WebKit. Run viewport captures outside the repository, inspect the PNGs, and resolve overflow and JavaScript errors. WebKit with iPhone profiles is the automated Safari-engine check available here; it is not real iOS Safari.

Verification must include ordinary interactive play through the full player flows, source-unit-specific acceptance evidence, meaningful state tests, save migrations and recovery, alternate mission orders, moral outcomes, later-world state, and performance under demanding actor/world conditions. Browser smoke tests and manifest checks are supporting evidence, not substitutes for whole-game gameplay verification.

Exit gate: no unresolved source coverage, implementation, presentation, accessibility, functional or release-blocking defects remain. The final audit proves every explicit brief requirement against current files and runtime evidence.

## Phase 8 — release, repository integration and final presentation

Package the completed game with reproducible launch/build instructions and all required original assets. Preserve source and engine attribution, record final version/build identities, and verify that the delivered build matches the audited one.

The user authorized commit, push and merge together, with automatic cleanup of merged pull-request branches. Repository integration should follow that instruction after relevant checks pass. No separate review permission is needed for work already authorized by the session. Pull requests are closed by merging; the host may retain their historical records.

Write the requested boardroom-style final report only from measured work and proven outcomes. Explain:

- The full product identity and why its variations preserve the source experiences.
- The strongest examples of authored missions, characters, systems, art and animation.
- How real effort was allocated among source research, foundation, authoring, assets, integration, balancing and verification, supported by work records instead of an invented schedule.
- The engine's actual contribution, extensions, constraints and production tradeoffs.
- Technology choices and how they support the completed player's experience.
- Full coverage reconciliation, gameplay evidence, test results, delivery artifacts and any material limitations.

Exit gate: the user has the finished complete game and its report, repository changes are integrated under the standing instruction, and the final requirement-by-requirement completion audit passes.

## Status discipline

Track source research, original design, implementation, presentation polish and acceptance evidence independently. “Designed” does not imply implemented; “implemented” does not imply tested; “tested” does not imply full source coverage. Parent categories are not allowed to hide missing children.

The completion decision must be conservative about evidence and ambitious about scope. Uncertain or missing evidence keeps the relevant requirement open. Work can continue through many milestones without changing the requested full end state.
