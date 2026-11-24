// v10: the heli air unit — a real 3D helicopter with a spotlight cone
// that shadows the player from wanted 3 up. Callsigns cycle so every
// cruiser has a name on the dispatch panel.
// police.js — the wanted system: stars rise with crime, police cruisers
// spawn and chase the player's effective position (the car when driving,
// the feet when on foot), foot cops chase and shove, stars decay when
// the player stays hidden, and the spray garage wipes the record for cash.
import * as THREE from "three";
import { createCar, createBoat } from "./vehicles.js";
import { hurtPlayer } from "./player.js";
import { makeRng } from "./random.js";

const CALLSIGNS = ["SURYA-12", "BAY-04", "SURYA-07", "BAY-21", "SURYA-33", "BAY-09"];
const MARINE_CALLSIGNS = ["MARINE-1", "MARINE-2"];

export function createPolice(S) {
  S.police = {
    wanted: 0,
    policeCars: [],
    cops: [],
    policeBoats: [],
    heli: null,
    nextCallsign: 0,
    lastCrime: -100,
    decayTimer: 0,
    rng: makeRng(S.seed + 303),
    sprayCooldown: 0,
    addWanted: (n, reason) => addWanted(S, n, reason),
  };
}

export function addWanted(S, n, reason) {
  const pol = S.police;
  if (n > 0) {
    pol.wanted = Math.min(5, pol.wanted + n);
    pol.lastCrime = S.time;
    pol.decayTimer = 0;
  }
  syncPoliceCars(S);
  syncCops(S);
  syncHeli(S);
  syncMarine(S);
}

function syncPoliceCars(S) {
  const pol = S.police;
  const wantedCount = pol.wanted;
  // Add cruisers until the count matches the wanted level.
  while (pol.policeCars.length < wantedCount) {
    const car = spawnPoliceCar(S);
    if (!car) break;
    pol.policeCars.push(car);
  }
  // Too many cruisers: the extras give up and drive off.
  while (pol.policeCars.length > wantedCount) {
    const car = pol.policeCars.pop();
    car.givingUp = true;
    car.giveUpTimer = 6;
  }
}

function spawnPoliceCar(S) {
  const pol = S.police;
  const p = S.player;
  const eff = p.car ? p.car.pos : p.pos;
  // Spawn on a road 60-90 units from the player.
  for (let tries = 0; tries < 8; tries++) {
    const angle = pol.rng.next() * Math.PI * 2;
    const dist = 60 + pol.rng.next() * 30;
    const x = Math.max(-220, Math.min(220, eff.x + Math.cos(angle) * dist));
    const z = Math.max(-220, Math.min(220, eff.z + Math.sin(angle) * dist));
    const car = createCar(S, x, z, Math.atan2(eff.x - x, eff.z - z), "police", 0x1a252f);
    car.callsign = CALLSIGNS[pol.nextCallsign % CALLSIGNS.length];
    pol.nextCallsign += 1;
    // Light bar on the roof: red and blue.
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd23c3c, emissive: 0x550000 })
    );
    red.position.set(-0.4, 1.55, -0.2);
    car.group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2471ff, emissive: 0x000055 })
    );
    blue.position.set(0.4, 1.55, -0.2);
    car.group.add(blue);
    car.ramCooldown = 0;
    car.health = 100;
    return car;
  }
  return null;
}

// v10 heli: up at wanted 3+, gone below it. Body + tail + spinning
// main rotor, a translucent spotlight cone under it and a real
// SpotLight aimed at the player. It hovers ahead-above the player so
// it reads in the chase camera.
function syncHeli(S) {
  const pol = S.police;
  if (pol.wanted >= 3 && !pol.heli) {
    const p = S.player;
    const eff = p.car ? p.car.pos : p.pos;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a252f });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 1.6), bodyMat);
    body.position.y = 0;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 4.2), bodyMat);
    tail.position.set(0, 0.2, 2.6);
    group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.9), bodyMat);
    fin.position.set(0, 0.8, 4.5);
    group.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    rotor.position.y = 1.0;
    rotor.name = "rotor";
    group.add(rotor);
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    for (const dx of [-0.8, 0.8]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.2), skidMat);
      skid.position.set(dx, -1.0, 0);
      group.add(skid);
    }
    // Spotlight cone: open cone, additive-looking pale yellow, pointing down.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(7, 18, 16, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    // Default cone: apex up by the heli, wide base down at the street.
    cone.position.y = -9;
    cone.name = "cone";
    group.add(cone);
    const light = new THREE.SpotLight(0xfff2c0, 60, 120, 0.32, 0.5, 1.2);
    light.position.set(0, 0, 0);
    group.add(light);
    // Hover offset is relative to the player's facing: 65 ahead, 14 to
    // the side, so the heli sits in front of the chase camera whichever
    // way the player is driving. Altitude 16 keeps it inside the
    // camera's vertical view (at 22 it projected just off the top edge).
    // The side offset puts it over the sea side of the harbor road, not
    // behind the building line where it was occluded.
    const yaw = p.car ? p.car.yaw : p.yaw;
    group.position.set(
      eff.x + Math.sin(yaw) * 65 - Math.cos(yaw) * 14,
      16,
      eff.z + Math.cos(yaw) * 65 + Math.sin(yaw) * 14
    );
    S.scene.add(group);
    light.target.position.set(eff.x, 0, eff.z);
    S.scene.add(light.target);
    pol.heli = { group, pos: group.position, rotor, light, target: light.target };
  } else if (pol.wanted < 3 && pol.heli) {
    S.scene.remove(pol.heli.group);
    S.scene.remove(pol.heli.target);
    pol.heli = null;
  }
}

function updateHeli(S, dt) {
  const pol = S.police;
  const heli = pol.heli;
  if (!heli) return;
  const p = S.player;
  const eff = p.car ? p.car.pos : p.pos;
  // Hover ahead-above the player (in front of the chase camera), so
  // the air unit is visible in the frame, not hidden behind the car.
  // Altitude 16 and 65 ahead keeps it inside the chase camera's view;
  // the offset follows the player's facing, not fixed world axes.
  const yaw = p.car ? p.car.yaw : p.yaw;
  const tx = eff.x + Math.sin(yaw) * 65 - Math.cos(yaw) * 14;
  const tz = eff.z + Math.cos(yaw) * 65 + Math.sin(yaw) * 14;
  heli.pos.x += (tx - heli.pos.x) * Math.min(1, 1.2 * dt);
  heli.pos.z += (tz - heli.pos.z) * Math.min(1, 1.2 * dt);
  heli.pos.y = 16 + Math.sin(S.time * 0.8) * 1.0;
  heli.rotor.rotation.y += dt * 18;
  heli.group.rotation.y = Math.atan2(eff.x - heli.pos.x, eff.z - heli.pos.z);
  heli.target.position.set(eff.x, 0, eff.z);
}

// v10 marine police: when the player is wanted on a boat, patrol boats
// launch from the harbor and chase on the water — the cruisers can't
// follow, so the sea is no longer a free escape.
function syncMarine(S) {
  const pol = S.police;
  const p = S.player;
  const want = p.boat && pol.wanted > 0 ? Math.min(2, pol.wanted) : 0;
  while (pol.policeBoats.length < want) {
    const boat = spawnMarineBoat(S);
    if (!boat) break;
    pol.policeBoats.push(boat);
  }
  while (pol.policeBoats.length > want) {
    const boat = pol.policeBoats.pop();
    boat.givingUp = true;
    boat.giveUpTimer = 6;
  }
}

function spawnMarineBoat(S) {
  const pol = S.police;
  const p = S.player;
  const eff = p.boat ? p.boat.pos : p.pos;
  for (let tries = 0; tries < 8; tries++) {
    const angle = pol.rng.next() * Math.PI * 2;
    const dist = 55 + pol.rng.next() * 25;
    const x = Math.max(-250, Math.min(250, eff.x + Math.cos(angle) * dist));
    const z = Math.max(252, Math.min(410, eff.z + Math.sin(angle) * dist));
    const boat = createBoat(S, x, z, Math.atan2(eff.x - x, eff.z - z), 0x1a252f);
    boat.kind = "policeBoat";
    boat.callsign = MARINE_CALLSIGNS[pol.policeBoats.length % MARINE_CALLSIGNS.length];
    boat.ramCooldown = 0;
    boat.health = 100;
    // Light bar on the deck: red and blue.
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xd23c3c, emissive: 0x550000 })
    );
    red.position.set(-0.4, 1.55, -0.2);
    boat.group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2471ff, emissive: 0x000055 })
    );
    blue.position.set(0.4, 1.55, -0.2);
    boat.group.add(blue);
    return boat;
  }
  return null;
}

function updateMarineBoats(S, dt) {
  const pol = S.police;
  const p = S.player;
  const eff = p.boat ? p.boat.pos : null;
  for (let i = pol.policeBoats.length - 1; i >= 0; i--) {
    const boat = pol.policeBoats[i];
    boat.ramCooldown = Math.max(0, (boat.ramCooldown || 0) - dt);
    if (boat.givingUp || !eff) {
      // Sail off and despawn.
      boat.giveUpTimer -= dt;
      boat.speed = Math.max(0, boat.speed - 6 * dt);
      boat.pos.x += Math.sin(boat.yaw) * boat.speed * dt;
      boat.pos.z += Math.cos(boat.yaw) * boat.speed * dt;
      boat.group.position.set(boat.pos.x, 0.4, boat.pos.z);
      const d = eff ? Math.hypot(boat.pos.x - eff.x, boat.pos.z - eff.z) : 999;
      if (boat.giveUpTimer <= 0 || d > 220) {
        S.scene.remove(boat.group);
        const idx = S.boats.indexOf(boat);
        if (idx >= 0) S.boats.splice(idx, 1);
        pol.policeBoats.splice(i, 1);
      }
      continue;
    }
    const dx = eff.x - boat.pos.x;
    const dz = eff.z - boat.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - boat.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    boat.yaw += Math.max(-2.0 * dt, Math.min(2.0 * dt, diff));
    const targetSpeed = dist > 25 ? 24 : 20;
    boat.speed += (targetSpeed - boat.speed) * Math.min(1, 1.8 * dt);
    boat.pos.x += Math.sin(boat.yaw) * boat.speed * dt;
    boat.pos.z += Math.cos(boat.yaw) * boat.speed * dt;
    boat.pos.x = Math.max(-270, Math.min(270, boat.pos.x));
    boat.pos.z = Math.max(248, Math.min(420, boat.pos.z));
    boat.bobPhase += dt * 2;
    boat.group.position.set(boat.pos.x, 0.4 + Math.sin(boat.bobPhase) * 0.15, boat.pos.z);
    boat.group.rotation.y = boat.yaw;
    // Ram: slow the player's boat and hurt them on contact.
    if (dist < 5.5 && boat.ramCooldown <= 0) {
      boat.ramCooldown = 1.2;
      S.audio.crash();
      if (p.boat) p.boat.speed *= 0.5;
      hurtPlayer(S, 6, "rammed by marine police");
      S.hud.toast("Marine police rammed your boat!");
    }
  }
}

function syncCops(S) {
  const pol = S.police;
  const want = S.player.onFoot && pol.wanted >= 2 ? Math.min(2, pol.wanted - 1) : 0;
  while (pol.cops.length < want) {
    const p = S.player;
    const a = pol.rng.next() * Math.PI * 2;
    const cop = makeCop(S, p.pos.x + Math.cos(a) * 25, p.pos.z + Math.sin(a) * 25);
    pol.cops.push(cop);
  }
  while (pol.cops.length > want) {
    const cop = pol.cops.pop();
    cop.leaving = true;
  }
}

function makeCop(S, x, z) {
  const group = new THREE.Group();
  const uniform = new THREE.MeshLambertMaterial({ color: 0x1a2f4a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b48a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), uniform);
  body.position.y = 1.1;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
  head.position.y = 1.85;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), uniform);
  cap.position.y = 2.1;
  group.add(cap);
  group.position.set(x, 0, z);
  S.scene.add(group);
  return {
    group,
    pos: new THREE.Vector3(x, 0, z),
    yaw: 0,
    health: 100,
    down: false,
    kind: "cop",
    leaving: false,
    walkPhase: 0,
  };
}

export function updatePolice(S, dt) {
  const pol = S.police;
  const p = S.player;
  // v10: the heli follows the wanted level even when it falls by decay
  // or the spray garage, not only when addWanted runs.
  syncHeli(S);
  syncMarine(S);
  updateHeli(S, dt);
  updateMarineBoats(S, dt);
  // v9: a player on a boat is out of reach — cruisers wait at the
  // shoreline instead of driving into the sea after them.
  const eff = p.boat ? { x: p.boat.pos.x, z: 238 } : p.car ? p.car.pos : p.pos;
  pol.sprayCooldown = Math.max(0, pol.sprayCooldown - dt);

  // Cruisers chase the effective position and ram on contact.
  for (let i = pol.policeCars.length - 1; i >= 0; i--) {
    const car = pol.policeCars[i];
    if (car.wrecked) continue;
    car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    const dx = eff.x - car.pos.x;
    const dz = eff.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (car.givingUp) {
      car.giveUpTimer -= dt;
      car.speed = Math.max(0, car.speed - 8 * dt);
      car.pos.x += Math.sin(car.yaw) * car.speed * dt;
      car.pos.z += Math.cos(car.yaw) * car.speed * dt;
      car.group.position.set(car.pos.x, 0, car.pos.z);
      if (car.giveUpTimer <= 0 || dist > 200) {
        S.scene.remove(car.group);
        const idx = S.cars.indexOf(car);
        if (idx >= 0) S.cars.splice(idx, 1);
        pol.policeCars.splice(i, 1);
      }
      continue;
    }
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const targetSpeed = dist > 30 ? 24 : 19;
    car.speed += (targetSpeed - car.speed) * Math.min(1, 1.8 * dt);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    car.group.position.set(car.pos.x, 0, car.pos.z);
    car.group.rotation.y = car.yaw;
    // Too far away: reposition closer so the chase never dies out.
    if (dist > 260) {
      const a = pol.rng.next() * Math.PI * 2;
      car.pos.x = Math.max(-220, Math.min(220, eff.x + Math.cos(a) * 80));
      car.pos.z = Math.max(-220, Math.min(220, eff.z + Math.sin(a) * 80));
      car.group.position.set(car.pos.x, 0, car.pos.z);
    }
    // Ram: damage the player (or their car) on contact.
    if (dist < 4.6 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.2;
      S.audio.crash();
      if (p.onFoot) {
        hurtPlayer(S, 12, "rammed");
      } else if (p.car) {
        p.car.speed *= 0.4;
        hurtPlayer(S, 6, "rammed");
        S.hud.toast("Police rammed your car!");
      }
    }
  }

  // Foot cops chase the player and shove on contact.
  for (let i = pol.cops.length - 1; i >= 0; i--) {
    const cop = pol.cops[i];
    if (cop.down) continue;
    const dx = eff.x - cop.pos.x;
    const dz = eff.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    if (cop.leaving || pol.wanted === 0) {
      // Walk away and despawn once far off.
      cop.pos.x += Math.sin(cop.yaw) * 3 * dt;
      cop.pos.z += Math.cos(cop.yaw) * 3 * dt;
      cop.group.position.set(cop.pos.x, 0, cop.pos.z);
      if (dist > 120 || cop.leaving) {
        S.scene.remove(cop.group);
        pol.cops.splice(i, 1);
      }
      continue;
    }
    cop.yaw = Math.atan2(dx, dz);
    const step = 5.5 * dt;
    if (dist > 1.7) {
      cop.pos.x += (dx / dist) * step;
      cop.pos.z += (dz / dist) * step;
    } else if (p.onFoot) {
      // Shove: gated by the player's own hurt cooldown (0.5 s).
      hurtPlayer(S, 8, "shoved by a cop");
    }
    cop.walkPhase += dt * 9;
    cop.group.position.set(cop.pos.x, 0, cop.pos.z);
    cop.group.rotation.y = cop.yaw;
  }

  // Wanted decay: hidden from every cruiser for a while, stars fall.
  if (pol.wanted > 0 && S.time - pol.lastCrime > 10) {
    let closest = Infinity;
    for (const car of pol.policeCars) {
      const d = Math.hypot(car.pos.x - eff.x, car.pos.z - eff.z);
      if (d < closest) closest = d;
    }
    if (closest > 60 || pol.policeCars.length === 0) {
      pol.decayTimer += dt;
      if (pol.decayTimer >= 10) {
        pol.decayTimer = 0;
        pol.wanted = Math.max(0, pol.wanted - 1);
        syncPoliceCars(S);
        syncCops(S);
        if (pol.wanted === 0) S.hud.toast("You lost the heat.");
      }
    } else {
      pol.decayTimer = 0;
    }
  }

  // Pay-and-spray: drive into the bay with cash and the record is wiped.
  if (p.car && pol.wanted > 0 && pol.sprayCooldown <= 0) {
    const bay = S.city.sprayBay || S.city.spray;
    const d = Math.hypot(p.car.pos.x - bay.x, p.car.pos.z - bay.z);
    if (d < 8 && p.cash >= 100) {
      p.cash -= 100;
      pol.wanted = 0;
      pol.sprayCooldown = 5;
      for (const car of pol.policeCars) {
        S.scene.remove(car.group);
        const idx = S.cars.indexOf(car);
        if (idx >= 0) S.cars.splice(idx, 1);
      }
      pol.policeCars = [];
      for (const cop of pol.cops) S.scene.remove(cop.group);
      pol.cops = [];
      S.hud.toast("Spray shop: clean ride, clean record — $100");
      S.audio.cash();
    }
  }

  S.audio.siren(pol.wanted >= 1);
}
