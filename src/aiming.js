/** Map a pointer over an actor's visible body back to its ground-space hit position.
 * The firearm simulation uses ground coordinates; clicking a head must not aim
 * at an unrelated patch of ground north of the actor. Obstruction remains the
 * projectile simulation's responsibility.
 */
export function resolvePointerAim(state, ground, pointer, project) {
  if (!pointer || !ground) return ground;
  const candidates = [];
  for (const [actors, animal] of [[state.enemies || [], false], [state.npcs || [], false], [state.animals || [], true]]) {
    for (const actor of actors) {
      if (!(actor.hp > 0) || actor.hidden || actor.departed || actor.escaped || actor.returned || actor.carried || actor.delivered || state.player?.carrying === actor.id) continue;
      const [x, y] = project(actor.x, actor.y, actor.z || 0);
      const wolf = actor.kind === 'wolf';
      const halfWidth = wolf ? 28 : animal ? 28 : 17, height = wolf ? 30 : animal ? 43 : 62;
      if (Math.abs(pointer.x - x) <= halfWidth && pointer.y >= y - height && pointer.y <= y + 5) {
        candidates.push({ actor, score: Math.hypot(pointer.x - x, (pointer.y - y + height * .48) * .6) });
      }
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates.length ? [candidates[0].actor.x, candidates[0].actor.y] : ground;
}

/** Resolve a visible wildlife aim point to its physical height. Aiming near a
 * body selects its body; only a pointer inside a smaller projected vital zone
 * selects that zone. The projectile still has to reach the moving animal.
 */
export function resolveHuntPointerAim(state, ground, pointer, project, zonesFor) {
  if (!pointer || !ground) return { point: ground, z: 0 };
  const candidates = [];
  for (const actor of state.animals || []) {
    if (actor.kind !== 'deer' || actor.hp <= 0 || actor.hidden || actor.escaped || actor.processed || actor.attachment) continue;
    const zones = zonesFor(actor);
    for (const zone of zones) {
      const center = project(zone.x, zone.y, zone.z);
      const horizontal = project(zone.x + zone.rx, zone.y, zone.z);
      const verticalGround = project(zone.x, zone.y + zone.ry, zone.z);
      const verticalBody = project(zone.x, zone.y, zone.z + zone.height / 2);
      const rx = Math.max(3, Math.abs(horizontal[0] - center[0]) + Math.abs(verticalGround[0] - center[0]));
      const ry = Math.max(3, Math.abs(verticalGround[1] - center[1]) + Math.abs(verticalBody[1] - center[1]));
      const score = ((pointer.x - center[0]) / rx) ** 2 + ((pointer.y - center[1]) / ry) ** 2;
      if (score <= 1) candidates.push({ zone, score, area: rx * ry });
    }
  }
  candidates.sort((a, b) => a.area - b.area || a.score - b.score);
  const selected = candidates[0]?.zone;
  return selected ? { point: [selected.x, selected.y], z: selected.z } : { point: ground, z: 0 };
}
