// v10: weather + tide — an original Surya Bay system. A deterministic
// cycle runs on S.time (300 s weather, 400 s tide): CLEAR → RAIN →
// STORM → CLEAR, while the tide rises and falls. Both change gameplay
// for real: rain makes roads slick (steering twitchier, longer slides
// in vehicles.js), and at high tide the beach floods — cars bog down
// and wading slows to a crawl. Storm dusk dims the sun and fogs the sky.
// Nothing here is display-only: every value feeds a mechanic.
import * as THREE from "three";

const WEATHER_PERIOD = 300;
const TIDE_PERIOD = 400;

export function phaseAt(t) {
  const u = ((t % WEATHER_PERIOD) + WEATHER_PERIOD) % WEATHER_PERIOD;
  if (u < 150) return "CLEAR";
  if (u < 210) return "RAIN";
  if (u < 260) return "STORM";
  return "CLEAR";
}

export function tideAt(t) {
  return (Math.sin((2 * Math.PI * t) / TIDE_PERIOD) + 1) / 2;
}

export function createWeather(S) {
  // Rain: a Points cloud that rides above the camera and falls.
  const count = 700;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 140;
    pos[i * 3 + 1] = Math.random() * 60;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xbfd8e8, size: 0.6, transparent: true, opacity: 0, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;
  S.scene.add(points);
  S.weather = {
    phase: "CLEAR",
    rain: 0,
    tide: 0,
    slick: false,
    locked: false,
    points,
    pointsMat: mat,
  };
}

export function updateWeather(S, dt) {
  const w = S.weather;
  if (!w.locked) {
    w.phase = phaseAt(S.time);
    w.tide = tideAt(S.time);
    // Rain ramps in over the first 10 s of a wet phase.
    const u = ((S.time % WEATHER_PERIOD) + WEATHER_PERIOD) % WEATHER_PERIOD;
    const wetStart = w.phase === "RAIN" ? 150 : w.phase === "STORM" ? 210 : -1;
    const target = wetStart < 0 ? 0 : Math.min(1, (u - wetStart) / 10);
    w.rain += (target - w.rain) * Math.min(1, dt * 2);
    w.slick = w.phase !== "CLEAR";
  }
  applyWeather(S);
  // Rain falls: each drop drops 42 u/s and wraps to the top of the box.
  if (w.rain > 0.02) {
    const attr = w.points.geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= 42 * dt;
      if (arr[i + 1] < 0) arr[i + 1] = 60;
    }
    attr.needsUpdate = true;
  }
}

function applyWeather(S) {
  const w = S.weather;
  const storm = w.phase === "STORM" ? 1 : w.phase === "RAIN" ? 0.45 : 0;
  // Storm dusk light: dim sun + hemi, thicken the fog, darken its color
  // and the sky dome itself, so a storm reads as dusk, not noon.
  if (S.lights) {
    S.lights.sun.intensity = 1.6 - 1.15 * storm;
    S.lights.hemi.intensity = 0.95 - 0.5 * storm;
  }
  if (S.city.dome) S.city.dome.material.color.setScalar(1 - 0.45 * storm);
  if (S.scene.fog) {
    S.scene.fog.near = 120 - 45 * storm;
    S.scene.fog.far = 520 - 160 * storm;
    S.scene.fog.color.setHex(storm > 0.8 ? 0x5a6a7a : storm > 0 ? 0x8aa0b0 : 0x9fc3dd);
  }
  // The tide lifts the sea plane: at full tide it covers the sand.
  if (S.city.sea) S.city.sea.position.y = 0.03 + w.tide * 1.1;
  // The flood sheet rides the same level over the beach strip, and
  // only renders while the tide is high enough to flood it.
  if (S.city.flood) {
    S.city.flood.visible = w.tide > 0.7;
    S.city.flood.position.y = 0.03 + w.tide * 1.1;
  }
  // Rain cloud follows the camera.
  w.points.visible = w.rain > 0.02;
  w.pointsMat.opacity = 0.7 * w.rain;
  w.points.position.set(S.camera.position.x, 0, S.camera.position.z);
}

// True when the spot is under flood water: high tide + beach strip.
export function flooded(S, x, z) {
  return S.weather.tide > 0.7 && z > 244;
}

export function weatherLabel(S) {
  const w = S.weather;
  const tide = w.tide > 0.7 ? "TIDE HIGH — BEACH FLOODED" : w.tide > 0.4 ? "TIDE RISING" : "TIDE LOW";
  if (w.phase === "STORM") return "STORM — ROADS SLICK · " + tide;
  if (w.phase === "RAIN") return "RAIN — ROADS SLICK · " + tide;
  return "CLEAR — GOLDEN HOUR · " + tide;
}
