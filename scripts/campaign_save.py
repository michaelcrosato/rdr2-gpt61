"""Read observed campaign Saves without changing any browser or simulation state.

Version 2 saves contain authoritative registries. These helpers deep-copy parsed
Python data and derive the legacy-style active aliases used by browser drivers.
They are not a game save validator or encoder. Historical checkpoint/entry/replay
bodies stay in their original wire format; normalize one explicitly if needed.
"""
from __future__ import annotations

import copy
import json
from typing import Any


def read_campaign_save(raw: str | dict[str, Any]) -> dict[str, Any]:
    """Parse an already observed JSON Save, then derive local compatibility views."""
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    return normalize_campaign_save(parsed)


def normalize_campaign_save(data: dict[str, Any]) -> dict[str, Any]:
    """Return an independent local copy with active v2 root views, or unchanged v1."""
    if not isinstance(data, dict):
        raise ValueError("An observed campaign Save must be a JSON object")
    state = copy.deepcopy(data)
    if state.get("version") == 1:
        return state
    if state.get("version") != 2:
        raise ValueError("Unsupported observed campaign Save version")

    entities = state.get("entities")
    weapons = state.get("weapons")
    party = state.get("party")
    regions = state.get("regions")
    campaign = state.get("campaign")
    if not all(isinstance(value, dict) for value in (entities, weapons, party, regions, campaign)):
        raise ValueError("Observed v2 Save has no complete campaign graph")
    region_id = state.get("region")
    environment = regions.get(region_id)
    missions = campaign.get("missions")
    active = missions.get(campaign.get("activeMissionId")) if isinstance(missions, dict) else None
    if not isinstance(environment, dict) or not isinstance(active, dict):
        raise ValueError("Observed v2 Save has no active region or mission")
    player = entities.get(party.get("playerId"))
    horse = entities.get(party.get("mountId"))
    if not isinstance(player, dict) or not isinstance(horse, dict):
        raise ValueError("Observed v2 Save has no authoritative player or mount")

    def entity_region(actor: dict[str, Any], visited: frozenset[str] = frozenset()) -> str | None:
        actor_id = actor.get("id")
        if actor_id in visited:
            raise ValueError("Observed v2 Save has cyclic attachments")
        attachment = actor.get("attachment")
        if not attachment:
            return actor.get("regionId")
        if not isinstance(attachment, dict):
            raise ValueError("Observed v2 Save has an invalid attachment")
        if attachment.get("type") == "rest":
            return attachment.get("regionId") or region_id
        target = entities.get(attachment.get("targetId"))
        if not isinstance(target, dict):
            raise ValueError("Observed v2 Save has an absent attachment target")
        return entity_region(target, visited | {actor_id})

    present = [actor for actor in entities.values() if isinstance(actor, dict) and entity_region(actor) == region_id]
    state["player"] = player
    state["horse"] = horse
    selected = weapons.get(player.get("equippedWeaponId"))
    if not isinstance(selected, dict):
        raise ValueError("Observed v2 Save has no equipped weapon instance")
    player["ammo"] = selected.get("ammo", 0)
    player["reserve"] = selected.get("reserve", 0)
    state["npcs"] = [actor for actor in present if actor.get("category") == "npc"]
    state["enemies"] = [actor for actor in present if actor.get("category") == "enemy"]
    state["mounts"] = [actor for actor in present if actor.get("category") == "mount" and actor.get("id") != horse.get("id")]
    state["animals"] = [actor for actor in present if actor.get("category") == "animal"]
    if horse.get("id") == "copper" and entity_region(horse) == region_id:
        state["animals"].append(horse)
    for key in ("mission", "flags", "timers", "performance", "traversal", "rescue", "tracks", "predators"):
        if key in active:
            state[key] = active[key]
    for key in ("worldChanges", "supplies", "dropped"):
        state[key] = environment.get(key)
    checkpoints = state.get("checkpoints", {})
    state["checkpoint"] = checkpoints.get(active.get("checkpointId")) if isinstance(checkpoints, dict) else None
    return state
