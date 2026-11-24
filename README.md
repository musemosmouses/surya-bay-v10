# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/musemosmouses/surya-bay-v10/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/musemosmouses/surya-bay-v10/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Surya Bay v10 — Boat chases, harbor smuggling, tides & storms, 8 missions, street race, shotgun, police dispatch, crew

Surya Bay — an original open-world crime game built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC. Explore a sun-soaked coastal city on foot, by car, and by boat: steal cars, outrun the police at wanted levels 0–5, run 8 chained story missions plus taxi, delivery, and street-race side jobs, fight rival crews in the plaza and at the harbor, and blast away with a pistol or a shotgun.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — WASD to move, mouse to look, E to enter/exit cars and board boats, F to punch, click to shoot, Q to swap pistol/shotgun, R to reload, T for a side job at a stand, P to pause.

## What's in v10

- **Boat chases — the flagship**: Harbor Delivery runs can now carry HOT cargo — picking one up puts 2 stars on you and launches the marine police, patrol boats that chase and ram you on the water (the cruisers can't follow). Same job, same piers; the heat is the twist.
- **Weather + tide, layered on the chase**: a deterministic cycle — CLEAR → RAIN → STORM — with rain that really slicks the roads (twitchier steering, longer slides in the race) and a tide that lifts the sea and floods the beach at high tide (cars bog down, wading slows). Storm dusk dims the sun and fog.
- **HUD-density leap**: a police dispatch panel with a live callsign, tactic (RAMMING / FLANKING / CLOSING IN / ROADBLOCK) and distance for every cruiser — plus a MARINE section when patrol boats are out — and an AIR ONE row when the heli is up.
- **Helicopter air unit**: a real 3D helicopter with a spotlight cone that shadows you from wanted level 3 up, shown on the minimap too.
- **Weapon slots 1–7**: FISTS / PISTOL / SHOTGUN from real state (shotgun LOCKED until the harbor pickup), the rest LOCKED; the slot in hand is highlighted, 1/2 keys switch.
- **Crew ability cards**: QUICK FIX (spray garage, $100, clears the heat — shows distance / READY / cooldown), EYES OUT (live police-blip count on the minimap), AUTOSAVE (25 s countdown).
- **NPC dialogue box**: Mama Lina, Rani, Rico, Dedi and the race announcer speak the live mission step's line, with a portrait initial.
- **Rank / respect + money**: COURIER → RUNNER → FIXER → KING OF SURYA BAY from real progression (missions, races, deliveries, cash), with a respect bar.
- **Radio line**: SURYA FM 98.6 with the track name cycling on the real WebAudio music loop.
- **Busier streets**: three more billboards, lamps and palms down 20th Ave, more beach palms.

## What's in v9

- **Harbor district**: piers, shipping containers, gantry cranes, warehouses, a boardwalk, and 5 moored boats you can drive.
- **8 story missions** (was 5): Harbor Run (smuggle a crate, escape by boat), Sunset Sprint (5-gate street race against the clock), and King of Surya Bay (6-rival turf war finale, $1,500).
- **Street races**: a repeatable timed checkpoint race at the race stand, with a cash prize scaled by time left.
- **Shotgun**: pick it up at the harbor containers — 5-pellet spread, muzzle flash, hitmarker, Q to swap.
- **More life**: 36 pedestrians (was 24), a 4-strong harbor crew that patrols the container yard and jumps you, golden-hour sky with drifting clouds, and billboards.
- **HUD**: mission counter (Mission 3/8), race gate + timer line, weapon name in the ammo readout, hitmarker, boat speed in knots, harbor + boats + race gate on the minimap.

---

<sub>Entered on [make.fun](https://make.fun/?ref=w3zshnah&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
