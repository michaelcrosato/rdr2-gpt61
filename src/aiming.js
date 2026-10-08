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
