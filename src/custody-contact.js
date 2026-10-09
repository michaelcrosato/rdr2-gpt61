/** Shared read-only contact contract for accepted original game work. Current
 * endpoint checks earn no elapsed work; the physical owner separately proves
 * every accepted interval. No world, movement, stock or custody writes. */
export const CUSTODY_CONTACT_RADIUS=22;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=Number.isFinite;
const keys=(v,names)=>plain(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const point=v=>keys(v,['x','y','z'])&&['x','y','z'].every(k=>finite(v[k]));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function inspectCustodyContactWindow(window,expected){
  if(!keys(expected,['start','finish','actorIds','refs','destinations','fixedContacts'])||!finite(expected.start)||!finite(expected.finish)||expected.finish<expected.start)return null;
  if(!keys(window,['start','finish','sweptClear','actors','sources','destinations','fixedContacts'])||window.start!==expected.start||window.finish!==expected.finish||window.sweptClear!==true)return null;
  if(!Array.isArray(window.actors)||!Array.isArray(window.sources)||!Array.isArray(window.destinations)||!Array.isArray(window.fixedContacts)||window.actors.length!==expected.actorIds.length||window.sources.length!==expected.refs.length||window.destinations.length!==expected.destinations.length||window.fixedContacts.length!==expected.fixedContacts.length)return null;
  const actors=window.actors;
  if(actors.some((actor,index)=>!keys(actor,['id','root','hand','regionId','alive','mounted','handUsable','handFree'])||actor.id!==expected.actorIds[index]||!point(actor.root)||!point(actor.hand)||typeof actor.regionId!=='string'||actor.alive!==true||actor.mounted!==false||actor.handUsable!==true||actor.handFree!==true))return null;
  if(new Set(actors.map(actor=>actor.id)).size!==actors.length||actors.length===0)return null;
  const endpoints=[];
  for(let i=0;i<window.sources.length;i++){
    const source=window.sources[i];
    if(!keys(source,['ref','point','regionId','actorId','maxHandDistance'])||!same(source.ref,expected.refs[i])||!point(source.point)||!finite(source.maxHandDistance)||source.maxHandDistance<0)return null;
    endpoints.push(source);
  }
  for(let i=0;i<window.destinations.length;i++){
    const destination=window.destinations[i];
    if(!keys(destination,['location','point','regionId','actorId','maxHandDistance'])||!same(destination.location,expected.destinations[i])||!point(destination.point)||!finite(destination.maxHandDistance)||destination.maxHandDistance<0)return null;
    endpoints.push(destination);
  }
  for(let i=0;i<window.fixedContacts.length;i++){
    const contact=window.fixedContacts[i],target=expected.fixedContacts[i];
    if(!keys(contact,['id','point','regionId','actorId','maxHandDistance'])||contact.id!==target.id||contact.actorId!==target.actorId||contact.regionId!==target.regionId||!same(contact.point,target.point)||!finite(contact.maxHandDistance)||contact.maxHandDistance<0)return null;
    endpoints.push(contact);
  }
  for(const endpoint of endpoints){
    const actor=actors.find(candidate=>candidate.id===endpoint.actorId);
    if(!actor||endpoint.regionId!==actor.regionId||endpoint.maxHandDistance>CUSTODY_CONTACT_RADIUS||distance(actor.hand,endpoint.point)>endpoint.maxHandDistance+1e-7)return null;
  }
  return{
    actors:actors.map(actor=>({id:actor.id,point:{...actor.root}})),
    sources:window.sources.map(source=>({ref:{...source.ref},point:{...source.point}})),
    destinations:window.destinations.map(destination=>({location:structuredClone(destination.location),point:{...destination.point}})),
  };
}
