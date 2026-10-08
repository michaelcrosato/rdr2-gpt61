/** Route shared player controls to the active authored region. */
import * as Mercy from './simulation.js';
import * as Campaign from './campaign-journey.js';

export const { WORLD, ITEMS, RECIPES, CAMP_UPGRADES, riverX } = Mercy;
export const isCampaign = state => state?.campaignId === 'dust-and-mercy' || state?.region === 'snowbound';
export const worldFor = state => isCampaign(state) ? Campaign.worldForCampaign(state) : WORLD;
export const itemsFor = state => isCampaign(state) ? Campaign.campaignItems : ITEMS;
export const createState = (mode = 'campaign') => mode === 'mercy' ? Mercy.createState() : Campaign.createCampaignState();
export const step = (s, dt, input) => isCampaign(s) ? Campaign.stepCampaign(s, dt, input) : Mercy.step(s, dt, input);
export const getInteraction = s => isCampaign(s) ? Campaign.getCampaignInteraction(s) : Mercy.getInteraction(s);
export const interact = s => isCampaign(s) ? Campaign.interactCampaign(s) : Mercy.interact(s);
export const choose = (s, id) => isCampaign(s) ? Campaign.chooseCampaign(s, id) : Mercy.choose(s, id);
export const reload = s => isCampaign(s) ? Campaign.reloadCampaign(s) : Mercy.reload(s);
export const useItem = (s, id) => isCampaign(s) ? Campaign.useCampaignItem(s, id) : Mercy.useItem(s, id);
export const whistle = s => isCampaign(s) ? Campaign.whistleCampaign(s) : Mercy.whistle(s);
export const serialize = s => isCampaign(s) ? Campaign.serializeCampaign(s) : Mercy.serialize(s);
export function restore(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  return isCampaign(data) ? Campaign.restoreCampaign(data) : Mercy.restore(data);
}
function message(s, text) { s.notices.push({ text, time: 5 }); s.notices = s.notices.slice(-5); return s; }
export function shoot(s, x, y, aim = {}) {
  if (isCampaign(s)) return Campaign.shootCampaign(s, x, y, aim);
  if (s.player.holstered) return message(s, 'Draw your revolver before firing.');
  return Mercy.shoot(s, x, y);
}
export const beginDraw = (s, x, y, aim = {}) => isCampaign(s) ? Campaign.beginCampaignDraw(s, x, y, aim) : s;
export const releaseDraw = (s, x, y, aim = {}) => isCampaign(s) ? Campaign.releaseCampaignDraw(s, x, y, aim) : s;
export const cancelDraw = s => isCampaign(s) ? Campaign.cancelCampaignDraw(s) : s;
export function action(s, id) {
  if (isCampaign(s)) return Campaign.campaignAction(s, id === 'holster' && s.player.holstered ? 'draw' : id);
  if (id === 'holster' && !s.dialog) { s.player.holstered = !s.player.holstered; message(s, s.player.holstered ? 'Revolver holstered.' : 'Revolver drawn.'); }
  return s;
}
export const buy = (s, id) => isCampaign(s) ? s : Mercy.buy(s, id);
export const sell = (s, id) => isCampaign(s) ? s : Mercy.sell(s, id);
export const craft = (s, id) => isCampaign(s) ? s : Mercy.craft(s, id);
export const donate = (s, id, count) => isCampaign(s) ? s : Mercy.donate(s, id, count);
export const upgradeCamp = (s, id) => isCampaign(s) ? s : Mercy.upgradeCamp(s, id);
