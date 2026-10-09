/** Shared current dialogue; older saved scenes keep their original wire text. */
export const CURRENT_RIVAL_SPEECH=Object.freeze({
  lariat:'Throw across a clear lane within reach. Keep tension, dismount, approach and bind. A slack loop lets a frightened person regain his feet; be ready to recover the throw.',
  descent:'Ruth and Bastian take the western cover. Inez and Emmett hold the mount line. Mara, come down the screened chute with me. Wait until Ruth and Bastian are under cover before we open the fight.',
  postpone:'We can wait at the kiln. Take the time you need to settle your equipment and speak to the others. Tell me when you are ready to leave.',
  completed:'Every recovered pocket, document, charge and injured person is in the account. Levi’s name is written separately from Calder’s. We need these papers, Juno’s food and a plan of our own before we touch the line.',
});
export function rivalSceneSpeech(record,id,legacy){return record?.rival?.equipment!==undefined?CURRENT_RIVAL_SPEECH[id]||legacy:legacy;}
