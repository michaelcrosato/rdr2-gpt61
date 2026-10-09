"""Read observed campaign Saves without changing any browser or simulation state.

Version 2, 3 and 4 saves contain authoritative registries. These helpers deep-copy parsed
Python data and derive the legacy-style active aliases used by browser drivers.
They are not a game save validator or encoder. Historical checkpoint/entry/replay
bodies stay in their original wire format; normalize one explicitly if needed.
"""
from __future__ import annotations

import copy
import json
from typing import Any



async def wait_for_save_commit(page: Any, expected_commit: str | None = None) -> str | None:
    """Wait for this normal Save's actual matching request/commit, never a delay."""
    current = await page.evaluate("""() => {const e=document.querySelector('#save-status');return {request:e?.dataset.saveRequest,state:e?.dataset.saveState,commit:e?.dataset.saveCommit,text:e?.textContent,backend:e?.dataset.saveBackend};}""")
    if current.get("state") in {"preview", "unsaved"}:
        raise ValueError("The displayed journey has no acknowledged current Save")
    if current.get("request") is None:
        if expected_commit is not None:
            raise ValueError("The expected normal Save request is unavailable")
        if current.get("backend") == "indexeddb" or not str(current.get("text", "")).startswith("Journey saved"):
            raise ValueError("There is no acknowledged current normal Save request")
        return None  # The older synchronous app's literal acknowledgement.
    wanted = str(current["request"] if expected_commit is None else expected_commit)
    if current.get("request") != wanted:
        raise ValueError("The requested normal Save was superseded or its journey changed")
    await page.wait_for_function("""wanted => {const e=document.querySelector('#save-status'),d=e?.dataset;return d&&(d.saveRequest!==wanted||d.saveState==='failed'||d.saveState==='saved'&&d.saveCommit===wanted);}""", arg=wanted, timeout=30000)
    result = await page.evaluate("""() => {const d=document.querySelector('#save-status').dataset;return {request:d.saveRequest,commit:d.saveCommit,state:d.saveState};}""")
    if result.get("request") != wanted:
        raise ValueError("The requested normal Save was superseded or its journey changed")
    if result.get("state") != "saved" or result.get("commit") != wanted:
        raise ValueError("The normal Save failed; prior committed bytes are not a new Save")
    return result["commit"]


async def observed_save_bytes(page: Any, expected_commit: str | None = None) -> str:
    """Read exact committed bytes. No state write, normalization or stale fallback."""
    wanted = await wait_for_save_commit(page, expected_commit=expected_commit)
    raw = await page.evaluate("""async () => {
      const name='dust-mercy.saves',storeName='snapshots',lastKey='last-slot',slots=['dust-mercy.campaign.v1','dust-mercy.mercy.v1'];
      let legacy=null;try{legacy=localStorage.getItem('dust-mercy.journey.v1');}catch{}
      let locator=null;try{locator=JSON.parse(legacy);}catch{}
      const databaseLocator=locator?.format==='dust-mercy-database-reference';
      if(databaseLocator&&(Object.keys(locator).length!==3||locator.database!==name||!slots.includes(locator.slot)))throw new Error('Invalid device database locator');
      let known=document.querySelector('#save-status')?.dataset.saveBackend==='indexeddb'||databaseLocator;
      if(!known&&indexedDB.databases)known=(await indexedDB.databases()).some(db=>db.name===name);
      if(known){
        // Opening a known database never upgrades it; abort any creation race.
        const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(name);request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>request.transaction.abort();request.onsuccess=()=>resolve(request.result);});
        try{return await new Promise((resolve,reject)=>{
          const tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName);let raw=null;
          const last=store.get(lastKey);last.onsuccess=()=>{if(slots.includes(last.result)){const value=store.get(last.result);value.onsuccess=()=>{if(typeof value.result==='string')raw=value.result;};}};
          tx.oncomplete=()=>raw===null?reject(new Error('Committed device journey is unavailable')):resolve(raw);tx.onabort=()=>reject(tx.error||new Error('Device journey read aborted'));
        });}finally{db.close();}
      }
      if(legacy===null)return null;
      if(locator?.format!=='dust-mercy-slot-reference')return legacy;
      if(Object.keys(locator).length!==2||!slots.includes(locator.slot))throw new Error('Invalid legacy slot reference');
      const canonical=localStorage.getItem(locator.slot);if(canonical===null)return null;
      try{if(['dust-mercy-slot-reference','dust-mercy-database-reference'].includes(JSON.parse(canonical)?.format))throw new Error('Chained legacy save reference');}catch(error){if(error.message==='Chained legacy save reference')throw error;}
      return canonical;
    }""")
    if wanted is not None:
        # Database opening and its readonly transaction both yield. The same
        # request must still acknowledge the displayed journey after the read.
        current = await page.evaluate("""() => {const d=document.querySelector('#save-status')?.dataset;return {request:d?.saveRequest,commit:d?.saveCommit,state:d?.saveState};}""")
        if current.get("request") != wanted or current.get("commit") != wanted or current.get("state") != "saved":
            raise ValueError("The requested normal Save was superseded or its journey changed while its bytes were read")
    if raw is None:
        raise ValueError("The normal Save command has no readable committed journey bytes")
    return raw


async def observed_save(page: Any, expected_commit: str | None = None) -> dict[str, Any]:
    """Parse the observed normal Save without fabricating compatibility fields."""
    return json.loads(await observed_save_bytes(page, expected_commit=expected_commit))


def read_campaign_save(raw: str | dict[str, Any]) -> dict[str, Any]:
    """Parse an already observed JSON Save, then derive local compatibility views."""
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    return normalize_campaign_save(parsed)


def normalize_campaign_save(data: dict[str, Any]) -> dict[str, Any]:
    """Return an independent copy with active graph views, or unchanged v1."""
    if not isinstance(data, dict):
        raise ValueError("An observed campaign Save must be a JSON object")
    state = copy.deepcopy(data)
    if state.get("version") == 1:
        return state
    if state.get("version") not in (2, 3, 4):
        raise ValueError("Unsupported observed campaign Save version")

    entities = state.get("entities")
    weapons = state.get("weapons")
    party = state.get("party")
    regions = state.get("regions")
    campaign = state.get("campaign")
    if not all(isinstance(value, dict) for value in (entities, weapons, party, regions, campaign)):
        raise ValueError("Observed graph Save has no complete campaign graph")
    region_id = state.get("region")
    environment = regions.get(region_id)
    missions = campaign.get("missions")
    active = missions.get(campaign.get("activeMissionId")) if isinstance(missions, dict) else None
    if not isinstance(environment, dict) or not isinstance(active, dict):
        raise ValueError("Observed graph Save has no active region or mission")
    player = entities.get(party.get("playerId"))
    horse = entities.get(party.get("mountId"))
    if not isinstance(player, dict) or not isinstance(horse, dict):
        raise ValueError("Observed graph Save has no authoritative player or mount")

    def entity_region(actor: dict[str, Any], visited: frozenset[str] = frozenset()) -> str | None:
        actor_id = actor.get("id")
        if actor_id in visited:
            raise ValueError("Observed graph Save has cyclic attachments")
        attachment = actor.get("attachment")
        if not attachment:
            return actor.get("regionId")
        if not isinstance(attachment, dict):
            raise ValueError("Observed graph Save has an invalid attachment")
        if attachment.get("type") == "rest":
            return attachment.get("regionId") or region_id
        target = entities.get(attachment.get("targetId"))
        if not isinstance(target, dict):
            raise ValueError("Observed graph Save has an absent attachment target")
        return entity_region(target, visited | {actor_id})

    present = [actor for actor in entities.values() if isinstance(actor, dict) and entity_region(actor) == region_id]
    # Cargo is authoritative on the carcass attachment. This is a local reader
    # alias only, matching the game's nonenumerable mount view without adding
    # any independent body or slot to the observed wire registry.
    for actor in entities.values():
        if isinstance(actor, dict) and (actor.get("kind") == "horse" or actor.get("category") == "mount"):
            actor["largeLoad"] = next((body.get("id") for body in entities.values()
                if isinstance(body, dict) and isinstance(body.get("attachment"), dict)
                and body["attachment"].get("type") == "large-load"
                and body["attachment"].get("targetId") == actor.get("id")), None)
    state["player"] = player
    state["horse"] = horse
    selected = weapons.get(player.get("equippedWeaponId"))
    if not isinstance(selected, dict):
        raise ValueError("Observed graph Save has no equipped weapon instance")
    player["ammo"] = selected.get("ammo", 0)
    player["reserve"] = selected.get("reserve", 0)
    state["npcs"] = [actor for actor in present if actor.get("category") == "npc"]
    state["enemies"] = [actor for actor in present if actor.get("category") == "enemy"]
    state["mounts"] = [actor for actor in present if actor.get("category") == "mount" and actor.get("id") != horse.get("id")]
    state["animals"] = [actor for actor in present if actor.get("category") == "animal"]
    if horse.get("id") == "copper" and entity_region(horse) == region_id:
        state["animals"].append(horse)
    for key in ("mission", "flags", "timers", "performance", "traversal", "rescue", "tracks", "predators", "hunt", "bow", "processing", "rival", "scope", "focus", "rope", "captivity"):
        if key in active:
            state[key] = active[key]
    for key in ("worldChanges", "supplies", "dropped"):
        state[key] = environment.get(key)
    checkpoints = state.get("checkpoints", {})
    state["checkpoint"] = checkpoints.get(active.get("checkpointId")) if isinstance(checkpoints, dict) else None
    return state
