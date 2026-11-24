// v10: HUD-density leap — police dispatch panel with live callsigns and
// tactics, weapon slots, crew ability cards, NPC dialogue, rank/respect,
// and the radio line, all driven by real game state.
// hud.js — the HUD: health/armor/cash/ammo, wanted stars, the mission
// objective line, speed, toasts, hints, and the canvas 2d minimap
// (roads, player, police, cars, mission marker, harbor, race gates).
import { ROADS } from "./city.js";
import { currentObjective, currentTarget, nearStandHint, currentDialogue } from "./missions.js";
import { weatherLabel } from "./weather.js";

export function createHud(S) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      health: $("healthFill"),
      armor: $("armorFill"),
      cash: $("cash"),
      ammo: $("ammo"),
      stars: $("stars"),
      objective: $("objective"),
      speed: $("speed"),
      toast: $("toast"),
      hint: $("hint"),
      crosshair: $("crosshair"),
      hitmarker: $("hitmarker"),
      flash: $("wantedFlash"),
      map: $("minimap"),
      dispatch: $("dispatch"),
      rankPanel: $("rankPanel"),
      rankTitle: $("rankTitle"),
      respectFill: $("respectFill"),
      respectLabel: $("respectLabel"),
      weapons: $("weapons"),
      crew: $("crew"),
      dialogue: $("dialogue"),
      dlgAvatar: $("dlgAvatar"),
      dlgText: $("dlgText"),
      radio: $("radio"),
      weather: $("weather"),
    },
    mapCtx: $("minimap").getContext("2d"),
    toastTimer: 0,
    hitTimer: 0,
    objectiveText: "",
  };
  S.hud = hud;
  hud.toast = (msg) => {
    hud.el.toast.textContent = msg;
    hud.el.toast.style.opacity = "1";
    hud.toastTimer = 2.6;
  };
  hud.hitmarker = () => {
    hud.el.hitmarker.style.opacity = "1";
    hud.hitTimer = 0.25;
  };
  hud.setObjective = (text) => {
    hud.objectiveText = text;
  };
  return hud;
}

export function updateHud(S, dt) {
  const hud = S.hud;
  const p = S.player;
  hud.el.health.style.width = Math.max(0, p.health) + "%";
  hud.el.armor.style.width = Math.max(0, Math.min(100, p.armor)) + "%";
  hud.el.cash.textContent = "$" + Math.round(p.cash);
  // v9: the ammo line names the weapon currently in hand.
  hud.el.ammo.textContent = p.weapon === "shotgun"
    ? "SHOTGUN — " + p.shells + " / " + p.shellReserve
    : "PISTOL — " + p.ammo + " / " + p.ammoReserve;

  // v10: the dispatch panel, weapon slots, crew cards, dialogue, rank
  // and radio line all read live state every frame.
  updateDispatch(S);
  updateWeapons(S);
  updateCrew(S);
  updateDialogue(S);
  updateRank(S);
  updateRadio(S);
  updateWeatherChip(S);
  // v10: the side panels belong to live play; hide them under menus so
  // the start screen stays clean.
  const showSide = S.mode === "play";
  hud.el.rankPanel.style.display = showSide ? "block" : "none";
  hud.el.weapons.style.display = showSide ? "block" : "none";
  hud.el.crew.style.display = showSide ? "block" : "none";
  hud.el.radio.style.display = showSide ? "block" : "none";

  // Hitmarker fade.
  if (hud.hitTimer > 0) {
    hud.hitTimer -= dt;
    if (hud.hitTimer <= 0) hud.el.hitmarker.style.opacity = "0";
  }

  // Wanted stars: filled gold up to the level, dim beyond it.
  let starRow = "";
  for (let i = 0; i < 5; i++) {
    starRow += i < S.police.wanted ? "★" : '<span class="off">★</span>';
  }
  hud.el.stars.innerHTML = starRow;

  // Objective line: mission text + distance to the marker.
  const obj = currentObjective(S);
  const rangeText = obj.dist > 1 ? " — " + Math.round(obj.dist) + "m" : "";
  hud.el.objective.innerHTML = "<b>" + escapeHtml(obj.text) + "</b>" + rangeText;

  // Speed, only while driving (car or boat).
  if (p.car && !p.onFoot) {
    hud.el.speed.innerHTML = Math.round(Math.abs(p.car.speed) * 3.4) + ' <small>km/h</small>';
  } else if (p.boat && !p.onFoot) {
    hud.el.speed.innerHTML = Math.round(Math.abs(p.boat.speed) * 3.4) + ' <small>kn</small>';
  } else {
    hud.el.speed.textContent = "";
  }

  // Toast fade.
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.el.toast.style.opacity = "0";
  }

  // Context hint at the bottom of the screen.
  let hint = "";
  if (S.mode === "play") {
    if (p.boat) {
      hint = "E step off · W throttle · mind the piers";
    } else if (p.onFoot) {
      let nearestCar = 4.5;
      for (const car of S.cars) {
        if (car.wrecked) continue;
        const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
        if (d < nearestCar) nearestCar = d;
      }
      if (nearestCar < 4.5) hint = "Press E to enter the car";
      else if (p.pos.z > 238) {
        let nearestBoat = 5.5;
        for (const b of S.boats) {
          const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
          if (d < nearestBoat) nearestBoat = d;
        }
        hint = nearestBoat < 5.5 ? "Press E to board the boat" : nearStandHint(S);
      } else hint = nearStandHint(S);
    } else {
      hint = "E exit car · SPACE handbrake · P pause";
    }
  }
  hud.el.hint.textContent = hint;

  // Crosshair on foot, hidden in a car or in menus.
  hud.el.crosshair.style.display = S.mode === "play" && p.onFoot ? "block" : "none";

  // Red edge flash while wanted, pulsing.
  hud.el.flash.style.opacity = S.police.wanted > 0 && S.mode === "play"
    ? String(0.35 + 0.3 * Math.sin(S.time * 5))
    : "0";

  drawMinimap(S);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// v10 rank: real progression points — missions finished, races won,
// deliveries done, cash on hand. Titles climb COURIER → RUNNER →
// FIXER → KING OF SURYA BAY; the bar is progress inside the tier.
const RANKS = [
  { at: 0, title: "COURIER" },
  { at: 100, title: "RUNNER" },
  { at: 250, title: "FIXER" },
  { at: 500, title: "KING OF SURYA BAY" },
];
function rankPoints(S) {
  const p = S.player;
  return S.missions.index * 100 + (p.racesWon || 0) * 40 + (p.deliveriesDone || 0) * 25 + Math.floor(p.cash / 100) * 10;
}
function updateRank(S) {
  const hud = S.hud;
  const pts = rankPoints(S);
  let tier = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (pts >= RANKS[i].at) { tier = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  hud.el.rankTitle.textContent = tier.title;
  const span = next ? next.at - tier.at : 100;
  const into = next ? pts - tier.at : span;
  hud.el.respectFill.style.width = Math.min(100, Math.round((into / span) * 100)) + "%";
  hud.el.respectLabel.textContent = next
    ? "RESPECT " + into + "/" + span + " → " + next.title
    : "RESPECT MAX — " + pts + " PTS";
}

// v10 dispatch panel: one row per live police car. The callsign is
// assigned at spawn; the tactic is computed from the car's real
// position, bearing and whether it is closing on the player.
function policeTactic(S, car) {
  const p = S.player;
  const eff = p.car ? p.car.pos : p.pos;
  const dx = eff.x - car.pos.x;
  const dz = eff.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const closing = car.prevDist !== undefined && dist < car.prevDist - 0.05;
  car.prevDist = dist;
  const fwdX = Math.sin(p.car ? p.car.yaw : p.yaw);
  const fwdZ = Math.cos(p.car ? p.car.yaw : p.yaw);
  // Behind the player = the car sits opposite the player's facing.
  const behind = dist > 0.01 && (-(dx / dist) * fwdX + -(dz / dist) * fwdZ) > 0.5;
  const ahead = dist > 0.01 && (-(dx / dist) * fwdX + -(dz / dist) * fwdZ) < -0.5;
  if (dist < 6 && behind) return "RAMMING";
  if (ahead && dist < 60) return "ROADBLOCK";
  if (!behind && !ahead && closing) return "FLANKING";
  if (closing) return "CLOSING IN";
  return "PURSUIT";
}
function updateDispatch(S) {
  const hud = S.hud;
  const pol = S.police;
  if (pol.wanted === 0 && pol.policeCars.length === 0 && !pol.heli) {
    hud.el.dispatch.style.display = "none";
    return;
  }
  hud.el.dispatch.style.display = "block";
  const p = S.player;
  const eff = p.car ? p.car.pos : p.pos;
  let html = '<div class="dhead">DISPATCH — ' + pol.policeCars.length + ' UNIT' + (pol.policeCars.length === 1 ? '' : 'S') + '</div>';
  for (const car of pol.policeCars) {
    const d = Math.round(Math.hypot(eff.x - car.pos.x, eff.z - car.pos.z));
    html += '<div class="drow"><span>' + escapeHtml(car.callsign || "UNIT") + '</span><span class="tac">' + policeTactic(S, car) + '</span><span>' + d + 'm</span></div>';
  }
  if (pol.heli) {
    const hd = Math.round(Math.hypot(eff.x - pol.heli.pos.x, eff.z - pol.heli.pos.z));
    html += '<div class="drow air"><span>AIR ONE</span><span class="tac">SPOTLIGHT</span><span>' + hd + 'm</span></div>';
  }
  hud.el.dispatch.innerHTML = html;
  // v10: marine units join the dispatch list when they are on the water.
  if (pol.policeBoats.length > 0) {
    let mhtml = '<div class="dhead">MARINE — ' + pol.policeBoats.length + ' BOAT' + (pol.policeBoats.length === 1 ? '' : 'S') + '</div>';
    for (const boat of pol.policeBoats) {
      const d = Math.round(Math.hypot(eff.x - boat.pos.x, eff.z - boat.pos.z));
      mhtml += '<div class="drow"><span>' + escapeHtml(boat.callsign || "MARINE") + '</span><span class="tac">INTERCEPT</span><span>' + d + 'm</span></div>';
    }
    hud.el.dispatch.innerHTML += mhtml;
  }
}

// v10 weapon slots: 1 FISTS, 2 PISTOL and 3 SHOTGUN from real state
// (shotgun LOCKED until picked up at the harbor), 4–7 LOCKED. The
// slot in hand is highlighted; 1/2 keys already switch (player.js).
function updateWeapons(S) {
  const hud = S.hud;
  const p = S.player;
  const rows = [
    { n: 1, name: "FISTS", ammo: "", cur: false },
    { n: 2, name: "PISTOL", ammo: p.ammo + " / " + p.ammoReserve, cur: p.weapon === "pistol" },
    { n: 3, name: "SHOTGUN", ammo: p.hasShotgun ? p.shells + " / " + p.shellReserve : "LOCKED", cur: p.weapon === "shotgun" },
  ];
  for (let n = 4; n <= 7; n++) rows.push({ n, name: "—", ammo: "LOCKED", cur: false });
  let html = '<div class="whead">WEAPONS</div>';
  for (const r of rows) {
    const cls = r.cur ? ' class="wrow cur"' : ' class="wrow"';
    const ammo = r.ammo === "LOCKED" ? '<span class="locked">LOCKED</span>' : "<span>" + r.ammo + "</span>";
    html += "<div" + cls + "><span>" + r.n + " · " + r.name + "</span>" + ammo + "</div>";
  }
  hud.el.weapons.innerHTML = html;
}

// v10 crew cards, each mapped to a real mechanic:
// QUICK FIX = the spray garage ($100, clears the heat on drive-in);
// EYES OUT = the minimap police blips already tracked live;
// AUTOSAVE = the 25 s autosave countdown.
function updateCrew(S) {
  const hud = S.hud;
  const pol = S.police;
  const p = S.player;
  const bay = S.city.sprayBay || S.city.spray;
  const eff = p.car ? p.car.pos : p.pos;
  const bayD = Math.round(Math.hypot(eff.x - bay.x, eff.z - bay.z));
  const fix = pol.sprayCooldown > 0
    ? "COOLDOWN " + Math.ceil(pol.sprayCooldown) + "s"
    : bayD < 8 ? "READY — $100" : bayD + "m AWAY";
  const units = pol.policeCars.length + pol.cops.length;
  const saveIn = Math.max(0, Math.ceil(25 - S.autosaveTimer));
  hud.el.crew.innerHTML =
    '<div class="card"><div class="chead"><span>QUICK FIX</span><span class="key">DRIVE-IN</span></div><div class="cstate">Spray garage · clears heat · ' + fix + "</div></div>" +
    '<div class="card"><div class="chead"><span>EYES OUT</span><span class="key">MAP</span></div><div class="cstate">Police blips live on the minimap · ' + units + " unit" + (units === 1 ? "" : "s") + " tracked</div></div>" +
    '<div class="card"><div class="chead"><span>AUTOSAVE</span><span class="key">AUTO</span></div><div class="cstate">Progress saves itself · next save in ' + saveIn + "s</div></div>";
}

// v10 dialogue box: speaker + line tied to the live mission step.
function updateDialogue(S) {
  const hud = S.hud;
  if (S.mode !== "play") {
    hud.el.dialogue.style.display = "none";
    return;
  }
  const d = currentDialogue(S);
  if (!d) {
    hud.el.dialogue.style.display = "none";
    return;
  }
  hud.el.dialogue.style.display = "flex";
  hud.el.dlgAvatar.textContent = d.speaker.charAt(0);
  hud.el.dlgText.innerHTML = "<b>" + escapeHtml(d.speaker) + ":</b> " + escapeHtml(d.line);
}

// v10 radio line: station + track from the real WebAudio music loop
// (audio.musicStep cycles the chord progression); off air before the
// first Start, muted when M is pressed.
function updateRadio(S) {
  const hud = S.hud;
  const tracks = ["Golden Hour", "Tide Line", "Neon Palms", "Harbor Lights"];
  if (!S.audio.musicTimer) {
    hud.el.radio.innerHTML = "<b>SURYA FM 98.6</b> — off air";
  } else if (S.audio.muted) {
    hud.el.radio.innerHTML = "<b>SURYA FM 98.6</b> — muted";
  } else {
    hud.el.radio.innerHTML = "<b>SURYA FM 98.6</b> — " + tracks[S.audio.musicStep % tracks.length];
  }
}

// v10 weather chip: live weather + tide from the weather module —
// the same values that slick the roads and flood the beach.
function updateWeatherChip(S) {
  const hud = S.hud;
  if (S.mode !== "play") {
    hud.el.weather.style.display = "none";
    return;
  }
  hud.el.weather.style.display = "block";
  hud.el.weather.textContent = weatherLabel(S);
}

function drawMinimap(S) {
  const ctx = S.hud.mapCtx;
  const W = 180;
  const scale = W / 560; // world -280..280 maps to 0..180
  const mx = (x) => (x + 280) * scale;
  const my = (z) => (z + 280) * scale;

  ctx.fillStyle = "#10202e";
  ctx.fillRect(0, 0, W, W);
  // Sea at the south edge, beach above it.
  ctx.fillStyle = "#2e86c1";
  ctx.fillRect(0, my(280), W, W - my(280));
  ctx.fillStyle = "#e8d29a";
  ctx.fillRect(0, my(244), W, my(280) - my(244));
  // Roads.
  ctx.strokeStyle = "#5a636b";
  ctx.lineWidth = 2;
  for (const v of ROADS) {
    ctx.beginPath(); ctx.moveTo(mx(v), 0); ctx.lineTo(mx(v), W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, my(v)); ctx.lineTo(W, my(v)); ctx.stroke();
  }
  // Buildings as dark blocks.
  ctx.fillStyle = "#233140";
  for (const b of S.city.colliders) {
    ctx.fillRect(mx(b.minX), my(b.minZ), Math.max(1, (b.maxX - b.minX) * scale), Math.max(1, (b.maxZ - b.minZ) * scale));
  }
  // Spray garage (the bay ring, not the building) and safehouse.
  ctx.fillStyle = "#2ecc71";
  const sprayAt = S.city.sprayBay || S.city.spray;
  ctx.fillRect(mx(sprayAt.x) - 2, my(sprayAt.z) - 2, 4, 4);
  ctx.fillStyle = "#e67e22";
  ctx.fillRect(mx(S.city.safehouse.x) - 2, my(S.city.safehouse.z) - 2, 4, 4);
  // v9 harbor: piers reaching into the sea, boats as white dots.
  ctx.fillStyle = "#8a6a45";
  for (const pier of S.city.harbor.piers) {
    ctx.fillRect(mx(pier.x - pier.w / 2), my(pier.z0), (pier.w) * scale, (pier.z1 - pier.z0) * scale);
  }
  for (const boat of S.boats) {
    // v10: marine-police boats read red on the map, civilian boats white.
    ctx.fillStyle = boat.kind === "policeBoat" ? "#ff3b30" : "#ffffff";
    ctx.beginPath();
    ctx.arc(mx(boat.pos.x), my(boat.pos.z), boat.kind === "policeBoat" ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // v9 race: the next gate glows pink on the map.
  if (S.missions.race && S.missions.race.active) {
    const gate = S.missions.race.gates[S.missions.race.gate];
    ctx.fillStyle = "#ff5da2";
    ctx.beginPath();
    ctx.arc(mx(gate.x), my(gate.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target.
  const target = currentTarget(S);
  if (target) {
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd23d";
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.z), 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Traffic cars, then pedestrians.
  ctx.fillStyle = "#ffffff";
  for (const car of S.cars) {
    if (car.kind === "traffic" || car.kind === "parked") {
      ctx.fillRect(mx(car.pos.x) - 1, my(car.pos.z) - 1, 2, 2);
    }
  }
  ctx.fillStyle = "#9aa5ad";
  for (const ped of S.peds) {
    if (!ped.down) ctx.fillRect(mx(ped.pos.x) - 1, my(ped.pos.z) - 1, 2, 2);
  }
  // Police cruisers and foot cops.
  ctx.fillStyle = "#ff3b30";
  for (const car of S.police.policeCars) {
    ctx.beginPath();
    ctx.arc(mx(car.pos.x), my(car.pos.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // v10: the heli shows as a bigger red ring with a white centre.
  if (S.police.heli) {
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath();
    ctx.arc(mx(S.police.heli.pos.x), my(S.police.heli.pos.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(mx(S.police.heli.pos.x), my(S.police.heli.pos.z), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of S.police.cops) {
    ctx.fillRect(mx(cop.pos.x) - 1, my(cop.pos.z) - 1, 2, 2);
  }
  // The player: a green triangle pointing where they face.
  const p = S.player;
  const yaw = p.car ? p.car.yaw : p.yaw;
  ctx.fillStyle = "#3ddc5a";
  ctx.save();
  ctx.translate(mx(p.pos.x), my(p.pos.z));
  ctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) + Math.PI);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
