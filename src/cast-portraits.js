// Hand-authored portrait silhouettes share the winter cast's costume colors.
const CAST = [
  ['Tomas Reed', '#a68a6b', '#ada58a', '#675a45', '#7c7a5b', 'beard'],
  ['Inez Pike', '#a28a65', '#342f28', '#657856', '#8c8060', 'braid'],
  ['Ada Rusk', '#bba17f', '#7f6951', '#617d87', '#8e727f', 'scarf'],
  ['Gideon Rusk', '#bba17f', '#b2afa0', '#6f7770', null, 'beard'],
  ['Ansel Voss', '#bba17f', '#473d32', '#344950', '#465454', 'mustache'],
  ['Pavel Dune', '#bba17f', '#514533', '#965f48', '#a29276', 'scar'],
];
export function castPortrait(speaker, state) {
  const cast = CAST.find(c => speaker.startsWith(c[0]));
  if (!cast) return '✦';
  const [name, skin, hair, coat, hat, detail] = cast;
  const tense = state.failure || state.mission.stage === 3 || state.mission.stage === 5 || state.mission.stage === 7;
  const brows = tense ? '<path d="m23 28 6 2m8 0 6-2"/>' : '<path d="m23 29 6-1m8 0 6 1"/>';
  return `<svg viewBox="0 0 64 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="80" fill="#25383f"/><path d="M0 72Q13 50 26 51h12Q54 50 64 72v8H0" fill="${coat}"/><path d="m24 51 8 14 8-14" fill="#c6b48c"/><path d="M17 29Q16 9 32 10t15 20v21H17" fill="${hair}"/><path d="M21 23q11-10 23 0v16q-1 12-12 14-11-2-11-14Z" fill="${skin}"/><path d="m31 31-3 10h6" fill="none" stroke="#80684f" stroke-width="1.5"/><g fill="none" stroke="#302e29" stroke-width="2">${brows}<path d="M24 33h4m10 0h4m-14 13h9"/></g>${detail === 'beard' ? `<path d="M21 38q5 13 11 14 8-2 12-14v9q-12 16-23 0Z" fill="${hair}"/>` : ''}${detail === 'mustache' ? `<path d="m24 42 8-4 9 4-9 2Z" fill="${hair}"/>` : ''}${detail === 'braid' ? `<path d="M44 38v24" stroke="${hair}" stroke-width="7"/><path d="m41 44 6 4m-6 4 6 4m-6 4 6 4" stroke="#726147" stroke-width="1"/>` : ''}${detail === 'scarf' ? '<path d="m18 51 26 2 6 10-19-3-10 14-3-23" fill="#8e727f"/>' : ''}${detail === 'scar' ? '<path d="m41 32-5 9" stroke="#7e4b3e" stroke-width="1.5"/>' : ''}${hat ? `<path d="M18 20 21 5h22l4 15Z" fill="${hat}"/><path d="M8 19h48v5H8" fill="${hat}"/><path d="M20 16h24" stroke="#302e29" stroke-width="3"/>` : ''}<path d="M3 77h58" stroke="#c6b48c" opacity=".4"/></svg>`;
}
