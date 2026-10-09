/** Exact serialized saves occupy one canonical slot per world. The legacy key
 * remains a small, strictly whitelisted reference; old plain JSON still reads.
 */
export const LEGACY_SAVE_KEY='dust-mercy.journey.v1';
export const CAMPAIGN_SAVE_KEY='dust-mercy.campaign.v1';
export const MERCY_SAVE_KEY='dust-mercy.mercy.v1';
const REFERENCE_FORMAT='dust-mercy-slot-reference';
const canonicalSlots=new Set([CAMPAIGN_SAVE_KEY,MERCY_SAVE_KEY]);
export function saveSlotFor(mode){
  if(mode==='campaign')return CAMPAIGN_SAVE_KEY;
  if(mode==='mercy')return MERCY_SAVE_KEY;
  throw new TypeError('Unknown journey mode.');
}
function reference(raw){
  let value;try{value=JSON.parse(raw);}catch{return {kind:'plain'};}
  if(!value||typeof value!=='object'||value.format!==REFERENCE_FORMAT)return {kind:'plain'};
  if(Array.isArray(value)||Object.keys(value).length!==2||!canonicalSlots.has(value.slot))return {kind:'invalid'};
  return {kind:'reference',slot:value.slot};
}
function canonicalBytes(storage,slot){
  const raw=storage.getItem(slot);
  return raw!==null&&reference(raw).kind==='plain'?raw:null;
}
export function readLegacySave(storage){
  const raw=storage.getItem(LEGACY_SAVE_KEY);if(raw===null)return null;
  const parsed=reference(raw);
  if(parsed.kind==='invalid')return null;
  return parsed.kind==='reference'?canonicalBytes(storage,parsed.slot):raw;
}
export function savedSlotCandidates(storage,mode){
  return [...new Set([canonicalBytes(storage,saveSlotFor(mode)),readLegacySave(storage)].filter(raw=>raw!==null))];
}
function restoreSlot(storage,key,previous){
  if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);
}
export function writeSaveSlot(storage,slot,serialized,archive=null){
  if(!canonicalSlots.has(slot)||typeof serialized!=='string'||reference(serialized).kind!=='plain')throw new TypeError('Invalid canonical save slot or bytes.');
  if(archive&&(!canonicalSlots.has(archive.slot)||archive.slot===slot||typeof archive.serialized!=='string'||reference(archive.serialized).kind!=='plain'))throw new TypeError('Invalid other-world archive.');
  const previousLegacy=storage.getItem(LEGACY_SAVE_KEY),previousArchive=archive?storage.getItem(archive.slot):null;
  let referenced=false,archived=false;
  try{
    // Release an old full duplicate before attempting either full graph write.
    storage.setItem(LEGACY_SAVE_KEY,JSON.stringify({format:REFERENCE_FORMAT,slot}));referenced=true;
    if(archive){storage.setItem(archive.slot,archive.serialized);archived=true;}
    // A failed setItem is atomic: the previous canonical save remains intact.
    storage.setItem(slot,serialized);return true;
  }catch(error){
    try{if(archived)restoreSlot(storage,archive.slot,previousArchive);}
    finally{if(referenced)restoreSlot(storage,LEGACY_SAVE_KEY,previousLegacy);}
    throw error;
  }
}
