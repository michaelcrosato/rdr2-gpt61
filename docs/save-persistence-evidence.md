# Complete-history persistence evidence

Updated 2026-10-09. This verifies bounded save behavior, not source acceptance or a finished game.

## Storage and migration

`src/save-database.js` stores each complete campaign/Mercy raw string in IndexedDB. Slot data, the last-slot pointer and necessary prior-world/recovery archival share one transaction. Save acknowledges commit; enqueue/request/callback errors abort. FIFO jobs capture bytes at request time. The owning codec validates data without re-encoding its original bytes.

Valid old local saves migrate into missing slots. Only byte-identical migrated copies are removed. Different valid histories remain available through **Other saved journeys**, with exact original Export and paused review. Every automatic save path is suppressed during review. Explicit manual adoption preserves the displaced committed history for recovery. Request and journey-generation guards clear stale status and prevent delayed completions from acknowledging another world, retry or replay.

Graph schema 4 and full raw Import/Export remain intact. Histories, actors, checkpoints and canonical replay worlds are retained. Async pagehide is best-effort; explicit acknowledged Save/Export remains the reliable player action. Browser/device eviction and future capacity remain practical limits.

## Genuine large histories and failure checks

Two checked-in native earned-route fixtures contain all four stories and an ordinary Opening replay retaining their canonical world. Their provenance explicitly retains initial camp proximity fixtures and native simulation/API inputs; they are not fresh public four-story playthroughs. Their original bytes and hashes are preserved in `tests/fixtures/save-database-native-provenance.json` and lossless gzip files.

- Four-story completion: 3,513,245 bytes / 3,509,851 UTF-16 units, approximately 7.02 MB of local-storage payload.
- Opening replay with that canonical history: 3,758,421 bytes / 3,754,821 UTF-16 units, approximately 7.51 MB.

The old production WebKit failure is preserved at `/tmp/dust-mercy-old-large-storage-failure/report.json`: visible Import/manual Save of the unchanged larger history fails quota, the prior smaller Save remains exact and Continue restores it, while ordinary Export retains the full larger graph. This is a failed old-build save receipt.

The isolated API receipt `/tmp/dust-mercy-indexeddb-storage-browser-final/report.json` passes twelve cases in each of Chromium, Firefox and WebKit. It verifies exact two-world/legacy migration, conflicting-history preservation/adoption, FIFO, fresh connections, actual request errors, explicit abort, synchronous second-write failure, archival/migration callback failure, closed connections and future-schema open failure. The same valid graph that triggers real WebKit localStorage quota failure commits to IndexedDB. The integrated database module matches that tested hash.

## Integrated frontend checks

`/tmp/dust-mercy-production-storage-ui-20261009/report.json` passes seven cases: normal visible Import, exact committed Save/Export, Continue and both-world preservation across WebKit320/375/tablet, Chromium desktop/ultrawide and Firefox, plus a real unsupported-database Save failure and reader refusal. Images were inspected; gameplay state/API writes do not produce the positive UI results.

`/tmp/dust-mercy-production-storage-recovery-20261009/report.json` passes Chromium, WebKit phone and Firefox. Exact native/public-byte storage fixtures establish the conflict; subsequent visible Load/review/Export/manual adoption/replay/new-world actions verify both genuine histories remain recoverable. A native transaction lock delays persistence without changing gameplay values. The current strict-helper probe at `/tmp/dust-mercy-production-save-supersession-20261009/report.json` rejects a captured request superseded by another Save or invalidated by a new journey, then accepts only the actual matching commit.

The separate headful Chromium receipt observed one real blur with preview still unadopted. Automated tab changes did not produce visibilitychange, so actual hidden-page suspension is not claimed. WebKit approximates Safari’s engine; physical hardware and real iOS are not established.

The integrated persistence-build syntax/native receipt passes **402/402** at `/tmp/dust-mercy-rival-indexeddb-integrated-suite.log`. The subsequent optional-visit wording and guard-validation source copy passes **404/404** at `/tmp/dust-mercy-rival-visit-guard-isolated-suite.log`; Root verified matching production import-graph files and production syntax. Dialogue/tool UI passes 45 inspected phone/tablet/wide captures, supplemented by twelve current optional-visit captures with stable hashes. Full mission routes and baseline application synchronization retain their separate gates in [Rival evidence](rival-evidence.md).

Reusable checks are `scripts/save-database-{browser,ui,recovery}-check.py`; README gives commands. Reports and screenshots stay outside the repository. Exact original-byte fixtures/provenance are deliberately checked in. Direct owning-codec candidate validation of the approximately 3.75-MB graph measured 86–117 ms in the isolated harness; this is menu/load work, not complete gameplay or hardware performance.


## Read-only observer identity during asynchronous reads

After the terminal WebKit full-route pass, independent review found that the original read helper checked the normal Save acknowledgment before the asynchronous database read without checking it afterward. Paused sequential public-route callers exclude concurrent UI changes, so their original receipts retain their recorded scope. The old-reader reproduction at `/home/micha/.local/state/dust-mercy/artifacts-20261009/save-observer-original-post-read-contract-failure/report.json` demonstrates the failed contract: an actual new unsaved journey is displayed while the old reader returns prior committed Rescue bytes. This remains `passed:false`.

The integrated helper accepts an optional caller-bound request and rechecks the exact same request, commit and saved state after fetching bytes. The public Rival driver carries its original manual/actual-item request through both waits and reads. The new `scripts/save-observer-browser-check.py` passes Chromium, WebKit and Firefox at `/home/micha/.local/state/dust-mercy/artifacts-20261009/save-observer-post-read-proposed/report.json`: post-ack Save supersession, default-API new-journey invalidation and explicit original-request binding all refuse stale acknowledgment; prior stored bytes remain exact. A real no-write transaction lock delays the readonly read, and an enqueue-only wrapper observes timing without fabricating data or gameplay state. The exact three tested script hashes match production. No game runtime changed and no full mission rerun is claimed for this observer refinement.
