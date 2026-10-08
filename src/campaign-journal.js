/** Original ink drawing recorded by Mara after the northern rescue. */
export function rescueJournalDrawing(state) {
  const record = state.campaign?.missions?.['snowbound-a-voice-under-ice'];
  if (!record?.flags.journalWritten) return '';
  return `<figure class="journal-illustration"><svg viewBox="0 0 580 260" role="img" aria-labelledby="rescue-sketch-title rescue-sketch-description">
    <title id="rescue-sketch-title">Mara’s drawing of Silas’s return</title><desc id="rescue-sketch-description">Three stone arches above a winter creek. Copper and Thimble leave together, with Silas wrapped and strapped behind Inez.</desc>
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 99L58 58l36 20 49-47 53 44 48-55 52 59 50-45 38 38 42-41 47 53 43-25 45 47M22 109l55-32 37 22m88-20 28-26 25 28m167-27 24 20" stroke-width="1" opacity=".45"/>
      <path d="M67 104l391-3 4 19-390 4zM77 122l-2 72h19l2-36q16-44 51-1l2 36h20l2-39q16-43 50-1l1 41h20l1-41q22-44 55-1l1 42h19l2-72M86 113l360-3M322 121l125 2-2 30" stroke-width="2"/>
      <path d="M70 142l22-2m59 2 19-1m57-1 18-1m57 1 18-1M13 222q63-33 128-20t103 7q40 7 63-2t113-5q67 12 143-8M18 231q83-20 130-11t95-2m84-3q66-10 133 4l92-4" stroke-width="1" opacity=".7"/>
      <path d="M357 137l4-42 12 25 16 13-4 15-10-2-4 32-8 28-8 2 3-31-24 2-6 30-8 1 3-40-4-19-13-13 4-3 18 14 29-6zM341 148l18 1-1 13-17 2zM323 153l-10 27-8 12M370 155l9 39-7 12M351 105l12-8 9 4M355 126l21 9" stroke-width="2"/>
      <path d="M341 147l-6-23 5-10 12 1 5 16-5 12 10 26-7 3-13-23M336 112l20-1m-17-5 13-1 3 8m-18 12 20 7 16 3" stroke-width="1.5"/>
      <path d="M470 140l7-43 12 26 16 10-5 15-14-2-2 33-9 28-8 1 5-30-28 2-7 30-8 1 3-40-4-18-12-14 5-2 17 14 30-7zM451 151l23 1-2 12-21 2zM435 156l-11 30-7 11M484 155l10 39-7 13M475 109l10-10 11 5" stroke-width="2"/>
      <path d="M451 149l-4-23 6-13 11 3 4 15-7 15 15 23-7 5-16-23M448 111l19 1m-16-6 13 1 2 6m-17 17 25 8 13-3M425 142l26 0 12 11-33 2zM418 140q4-10 12-4l2 8-9 4zM429 137l24 7 8 13M434 136l-1 20m15-16-1 19" stroke-width="1.5"/>
      <path d="M243 235l9-2m15 3 8-2m11 4 10-2m15 2 7-2m14 3 8-2m15 3 10-1" stroke-width="2" opacity=".55"/>
    </g></svg><figcaption>North Cutting · three arches, two horses, one sling</figcaption><p>His voice came through ice before we saw his face. We brought him home.</p><p>${record.flags.caseCollected ? 'The freight case is dry beside Della’s ledger. The questions can wait for daylight.' : 'The papers stayed beneath the ice. Silas did not.'}</p></figure>`;
}
