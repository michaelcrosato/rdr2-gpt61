import { RIVAL_CAST } from '../content/campaign/bellwether-works.js';
import { rivalPortrait } from './rival-portraits.js';
import { trainPortrait } from './train-portraits.js';
// Hand-authored portrait silhouettes share the winter cast's costume colors.
const CAST = [
  ['Tomas Reed', '#a68a6b', '#ada58a', '#675a45', '#7c7a5b', 'beard'],
  ['Inez Pike', '#a28a65', '#342f28', '#657856', '#8c8060', 'braid'],
  ['Ada Rusk', '#bba17f', '#7f6951', '#617d87', '#8e727f', 'scarf'],
  ['Gideon Rusk', '#bba17f', '#b2afa0', '#6f7770', null, 'beard'],
  ['Ansel Voss', '#bba17f', '#473d32', '#344950', '#465454', 'mustache'],
  ['Pavel Dune', '#bba17f', '#514533', '#965f48', '#a29276', 'scar'],
  ['Silas Orr', '#b7987d', '#634c3d', '#8a504d', null, 'courier'],
  ['Elin Orr', '#b99b7c', '#7e5e46', '#805f78', null, 'bonnet'],
  ['Fin Orr', '#c5a68b', '#795441', '#c19457', null, 'child'],
  ['Moss Laird', '#a68b6e', '#5b493d', '#59675c', '#696a5c', 'beard'],
  ['Vera Holl', '#b99e82', '#a37b4e', '#435f78', '#8c9f9f', 'braid'],
  ['Della Wren', '#ad947c', '#554e4a', '#665466', '#575867', 'ledger'],
  ['Orla Venn', '#b8a181', '#928570', '#5e7562', null, 'cook'],
  ['Juno Mercier', '#a18b6f', '#302e29', '#364f66', '#374d57', 'packer'],
  ['Hob Jarrow', '#b99b7d', '#75624c', '#6d4350', '#765744', 'cobbler'],
];
export function castPortrait(speaker, state) {
  const clinic=trainPortrait(speaker,state);if(clinic)return clinic;
  const original=rivalPortrait(speaker,state);if(original)return original;
  const added = RIVAL_CAST.filter(a=>a.rig&&a.kind!=='horse').map(a=>[a.name,a.rig.skin,a.rig.hair,a.rig.coat,a.rig.hat,a.id==='calder'?'mustache':a.id==='levi'?'scar':'scarf']);
  const cast = [...CAST,...added].find(c => speaker.startsWith(c[0]));
  if (!cast) return '✦';
  const [name, skin, hair, coat, hat, detail] = cast;
  const opening = state.mission.id === 'snowbound-the-last-warm-light';
  const hunt = state.mission.id === 'snowbound-a-quiet-table';
  const tense = state.failure || opening && [3, 5, 7].includes(state.mission.stage) || hunt && state.mission.stage === 7 || !opening && !hunt && [6, 7, 8].includes(state.mission.stage);
  const brows = tense ? '<path d="m23 28 6 2m8 0 6-2"/>' : '<path d="m23 29 6-1m8 0 6 1"/>';
  const extra = detail === 'courier' ? '<path d="m42 36-5 8m1-3 5 4" stroke="#945d52" stroke-width="1.5"/><path d="m17 53 28 2 4 9-21-5-10 14Z" fill="#c5bfa1"/><path d="m7 63 10 4-3 12H4" fill="#c2b7a0"/><path d="m5 69 11 3m-11 3 10 3" stroke="#766c62"/>' : detail === 'bonnet' ? '<path d="M15 29Q11 3 32 4q22 0 18 26l-7-7q-11-11-23 0Z" fill="#beaead"/><path d="m15 27 4 26 13 6 15-6 4-26" fill="none" stroke="#d3c6a7" stroke-width="3"/>' : detail === 'child' ? '<path d="M15 23Q12 7 31 7q20 0 19 16Z" fill="#658499"/><path d="M14 23h37" stroke="#9fb6ba" stroke-width="5"/><circle cx="33" cy="5" r="5" fill="#cfba8d"/><path d="m18 53 29 1-5 9-11-3-6 13Z" fill="#9e6553"/>' : detail === 'ledger' ? '<g fill="none" stroke="#b6b2a1" stroke-width="1.5"><rect x="20" y="29" width="11" height="9" rx="3"/><rect x="34" y="29" width="11" height="9" rx="3"/><path d="M31 32h3"/></g><path d="m19 56 22 2 3 7-23-3Z" fill="#d1b987"/><path d="M42 65h17v15H42Z" fill="#79604e"/><path d="M44 68h12m-12 5h11m-11 4h8" stroke="#d7c29d"/>' : '';
  const huntExtra = detail === 'cook' ? '<path d="M16 19Q18 3 32 3t16 16Z" fill="#bfbba4"/><path d="m20 53 24 0 5 27H15Z" fill="#c4b894"/><path d="m23 58 18 0m-19 8 20 0" stroke="#8a826a"/>' : detail === 'packer' ? '<path d="m16 52 13 5 25 23h-8L20 57Z" fill="#a58a63"/><path d="m44 63 9-2 8 17-11 2Z" fill="#c8bea0"/><path d="m47 68 9-2m-7 7 10-2" stroke="#8c8068"/><path d="m20 51 24 2-4 8-16-3Z" fill="#b06349"/>' : detail === 'cobbler' ? '<g fill="none" stroke="#b7b5a2" stroke-width="1.5"><rect x="20" y="29" width="11" height="9" rx="3"/><rect x="34" y="29" width="11" height="9" rx="3"/><path d="M31 32h3"/></g><path d="m21 56 22 0 5 24H16Z" fill="#9d7856"/>' : '';
  return `<svg viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="80" fill="#25383f"/><path d="M0 72Q13 50 26 51h12Q54 50 64 72v8H0" fill="${coat}"/><path d="m24 51 8 14 8-14" fill="#c6b48c"/><path d="M17 29Q16 9 32 10t15 20v21H17" fill="${hair}"/><path d="M21 23q11-10 23 0v16q-1 12-12 14-11-2-11-14Z" fill="${skin}"/><path d="m31 31-3 10h6" fill="none" stroke="#80684f" stroke-width="1.5"/><g fill="none" stroke="#302e29" stroke-width="2">${brows}<path d="M24 33h4m10 0h4m-14 13h9"/></g>${detail === 'beard' ? `<path d="M21 38q5 13 11 14 8-2 12-14v9q-12 16-23 0Z" fill="${hair}"/>` : ''}${detail === 'mustache' ? `<path d="m24 42 8-4 9 4-9 2Z" fill="${hair}"/>` : ''}${detail === 'braid' ? `<path d="M44 38v24" stroke="${hair}" stroke-width="7"/><path d="m41 44 6 4m-6 4 6 4m-6 4 6 4" stroke="#726147" stroke-width="1"/>` : ''}${detail === 'scarf' ? '<path d="m18 51 26 2 6 10-19-3-10 14-3-23" fill="#8e727f"/>' : ''}${detail === 'scar' ? '<path d="m41 32-5 9" stroke="#7e4b3e" stroke-width="1.5"/>' : ''}${hat ? `<path d="M18 20 21 5h22l4 15Z" fill="${hat}"/><path d="M8 19h48v5H8" fill="${hat}"/><path d="M20 16h24" stroke="#302e29" stroke-width="3"/>` : ''}${extra}${huntExtra}<path d="M3 77h58" stroke="#c6b48c" opacity=".4"/></svg>`;
}
