/** Original vector portraits for the existing clinic residents. Unknown
 * introduction labels reveal a face, never a name/arrival/relationship flag. */
import {TRAIN_PROFILES} from './train-native/rigs.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function identity(speaker,state){
 if(/^Abel Sedge/.test(speaker))return'abel';if(/^Nell Sarto/.test(speaker))return'nell';if(/^Rivet(?:\s|$)/.test(speaker))return'rivet';
 if(speaker==='A visitor at the shelter'&&state?.dialog?.id==='train-prelude-bedside'&&state.entities?.abel)return'abel';
 if(speaker==='A rider from the south road'&&state?.dialog?.id==='train-prelude-nell'&&state.entities?.nell)return'nell';
 return null;
}
export function trainPortrait(speaker,state){
 const id=identity(speaker,state);if(!id)return null;
 const label=esc(speaker+' portrait');
 if(id==='rivet')return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 96" role="img" aria-label="${label}" data-train-portrait="rivet"><rect width="80" height="96" fill="#304541"/><path d="M9 96Q8 63 25 49L24 13l10 15 22-1 11-18-2 37Q77 59 62 79L50 96Z" fill="#3d2d29"/><path d="m34 29 20 1 13 31-8 19-21 2-15-25Z" fill="#705043"/><path d="m25 13 4 34 8-17M63 15l-4 29-7-15" fill="#242b29"/><path d="M33 30q-12 23-10 43" fill="none" stroke="#242b29" stroke-width="7"/><ellipse cx="55" cy="59" rx="4" ry="3" fill="#172721"/><path d="m53 65-1 5 5 1" fill="none" stroke="#e0d4b5" stroke-width="2.5" data-mark="right-eye-crescent"/><path d="m39 79 19 0 4 8-25 0Z" fill="#352d29"/><path d="m26 54 38 14M27 55l1 31 24 8" fill="none" stroke="#b79b6a" stroke-width="3"/></svg>`;
 const p=TRAIN_PROFILES[id],abel=id==='abel',coat=p.coat,skin=p.skin,hair=p.hair;
 const detail=abel?`<path d="M18 28 23 9h32l6 19Z" fill="${p.hat}"/><path d="M10 27h60v6H10" fill="${p.hat}"/><path d="m23 22 32 0" stroke="#68694e" stroke-width="3"/><path d="m26 45 7-2m14 0 7 2m-25 9 4 1m15-1 5-1" stroke="#806a54" stroke-width="1"/><path d="m23 69 18 7 16-6-8 10-11-1-7 10Z" fill="#c6c5af"/><path d="m14 72 44 22" stroke="#83988d" stroke-width="6"/><path d="M51 82h23v14H51Z" fill="#527d72"/><path d="M54 86h17" stroke="#a9b5a0" stroke-width="2"/>`:`<path d="M19 38Q14 12 38 13q27-3 25 30L52 26 26 32Z" fill="${hair}"/><path d="m20 75 40 17" stroke="#d1b679" stroke-width="4"/><path d="m21 73 4 5m3-3 4 6m3-2 4 5m3-1 4 5" stroke="#e5cf96" stroke-width="1"/><path d="M48 83h12v13H48Z" fill="#8f7350"/><path d="m27 53 2 1m22-2 2 1m-18 6 2 1" stroke="#996b53" stroke-width="1"/>`;
 return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 96" role="img" aria-label="${label}" data-train-portrait="${id}"><rect width="80" height="96" fill="${abel?'#394d46':'#304f51'}"/><path d="M0 96Q7 68 30 65h20q22 3 30 31Z" fill="${coat}"/><path d="M23 31q17-17 35 0v21Q56 68 41 71 25 66 23 52Z" fill="${skin}"/><path d="M21 40Q17 13 40 13q25 0 23 29l-9-13-26 2Z" fill="${hair}"/><path d="m31 43 7-2m10 0 7 2" fill="none" stroke="#302b27" stroke-width="2"/><path d="m31 47 5 0m12 0 5 0m-13 2-3 9 6 0m-11 5 14 0" fill="none" stroke="#463d31" stroke-width="1.8"/>${detail}<path d="M4 92h72" stroke="#c6b48c" opacity=".45"/></svg>`;
}
