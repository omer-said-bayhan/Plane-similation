/* global THREE */
const canvas = document.querySelector("#c");
const elSpeed = document.querySelector("#speed");
const elAlt = document.querySelector("#altitude");
const elPitch = document.querySelector("#pitch");
const elHeading = document.querySelector("#heading");
const elG = document.querySelector("#gforce");
const elWind = document.querySelector("#wind");
const elAoA = document.querySelector("#aoa");
const elDynPress = document.querySelector("#dynpress");
const elStress = document.querySelector("#stress");
const elGWarn = document.querySelector("#g-warn");
const elCrash = document.querySelector("#crash-msg");


const WORLD = 80000;
const GROUND_Y = 0;

const GRAVITY = 9.80665;
const RHO0 = 1.225;
const SCALE_ALT = 8500;
const MAX_SPEED = 400;
const THRUST_ACCEL_MAX = 24;
const BRAKE_ACCEL = 16;
const YAW_SPEED = 0.52;
const PITCH_SPEED = 0.42;
const ORBIT_ROT_SENS = 0.0042;
const TANK_DRAG_MULT = 1.45;
const TANK_MASS_MULT = 1.55;

const K_DRAG = 3.2e-5;
const K_LIFT = 0.095;
const STALL_SPEED = 32;
const AOA_STALL = 0.55;

const G_WARN = 7.2;
const G_STRESS_SOFT = 7.8;
const G_STRESS_HARD = 9.6;
const Q_LIMIT_PA = 108000;
const AOA_BREAK_DEG = 38;
const STRESS_DECAY = 32;
const STRESS_BUILD_SOFT = 5.5;
const STRESS_BUILD_HARD = 18;
const PLANE_CLEARANCE = 11;
const PLANE_HIT_HALF = 13;

const keys = {
  w: false,
  s: false,
  a: false,
  d: false,
  ArrowUp: false,
  ArrowDown: false,
};

const HILLS = [];
const RUNWAYS = [];
const COLLIDERS = [];

window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in keys) keys[k] = true;
  if (["ArrowUp", "ArrowDown"].includes(e.key)) keys[e.key] = true;
  if (e.code === "KeyF") respawnAtNearestRunway();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in keys) keys[k] = false;
  if (["ArrowUp", "ArrowDown"].includes(e.key)) keys[e.key] = false;
});

let orbitTheta = 0.55;
let orbitPhi = Math.PI * 0.38;
let orbitRadius = 155;
let mouseDragActive = false;

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) canvas.requestPointerLock();
  if (e.button === 2 || e.button === 1) mouseDragActive = true;
});
canvas.addEventListener("mouseup", () => {
  mouseDragActive = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas) {
    orbitTheta -= e.movementX * ORBIT_ROT_SENS;
    orbitPhi -= e.movementY * ORBIT_ROT_SENS;
    orbitPhi = THREE.MathUtils.clamp(orbitPhi, 0.012, Math.PI - 0.012);
  } else if (mouseDragActive) {
    orbitTheta -= e.movementX * ORBIT_ROT_SENS * 0.85;
    orbitPhi -= e.movementY * ORBIT_ROT_SENS * 0.85;
    orbitPhi = THREE.MathUtils.clamp(orbitPhi, 0.012, Math.PI - 0.012);
  }
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  orbitRadius += e.deltaY * 0.14;
  orbitRadius = THREE.MathUtils.clamp(orbitRadius, 48, 420);
}, { passive: false });

function airDensity(altitude) {
  return RHO0 * Math.exp(-Math.max(0, altitude) / SCALE_ALT);
}

function terrainHeight(x, z) {
  let h = GROUND_Y;
  for (const hill of HILLS) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d < hill.r) {
      const coneH = hill.h * (1 - d / hill.r);
      if (coneH > h) h = coneH;
    }
  }
  return h;
}

function pointOnRunway(px, py, pz) {
  for (const rw of RUNWAYS) {
    const dx = px - rw.cx;
    const dz = pz - rw.cz;
    const c = Math.cos(-rw.yaw);
    const s = Math.sin(-rw.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const th = terrainHeight(px, pz);
    if (
      Math.abs(lx) < rw.halfW - 2 &&
      Math.abs(lz) < rw.halfL - 2 &&
      py < th + 28
    ) {
      return true;
    }
  }
  return false;
}

function xzNearRunway(px, pz, expand = 110) {
  for (const rw of RUNWAYS) {
    const dx = px - rw.cx;
    const dz = pz - rw.cz;
    const c = Math.cos(-rw.yaw);
    const s = Math.sin(-rw.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < rw.halfW + expand && Math.abs(lz) < rw.halfL + expand) {
      return true;
    }
  }
  return false;
}

function boxHit(px, py, pz, pad = PLANE_HIT_HALF) {
  const r2 = pad * pad;
  for (const b of COLLIDERS) {
    const cx = THREE.MathUtils.clamp(px, b.minX, b.maxX);
    const cy = THREE.MathUtils.clamp(py, b.minY, b.maxY);
    const cz = THREE.MathUtils.clamp(pz, b.minZ, b.maxZ);
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    if (dx * dx + dy * dy + dz * dz < r2) return true;
  }
  return false;
}

function rnd(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildF22() {
  const group = new THREE.Group();
  const S = 1.35;

  const M = {
    top:  new THREE.MeshStandardMaterial({ color: 0x68747c, metalness: 0.6, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x38444c, metalness: 0.6, roughness: 0.5 }),
    can:  new THREE.MeshStandardMaterial({ color: 0xcca434, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x9a6010, emissiveIntensity: 0.2 }),
    noz:  new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2, emissive: 0xff3800, emissiveIntensity: 0 }),
    vap:  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  };

  function H(m) { group.add(m); return m; }

  // 1. THE UNIFIED SILHOUETTE (A single massive shape for the entire plane)
  // This guarantees there are NO seams, NO disconnected parts. Complete unity.
  const sh = new THREE.Shape();
  sh.moveTo(0, -10.5*S);         // Nose
  sh.lineTo(1.2*S, -5.5*S);      // Chine 
  sh.lineTo(7.5*S, 1.5*S);       // Wing LE Tip
  sh.lineTo(7.0*S, 4.0*S);       // Wing TE Tip
  sh.lineTo(2.2*S, 5.5*S);       // Wing Root TE
  sh.lineTo(4.4*S, 8.5*S);       // Taileron LE Tip
  sh.lineTo(4.4*S, 10.5*S);      // Taileron TE Tip
  sh.lineTo(1.2*S, 10.5*S);      // Taileron Root TE
  sh.lineTo(0.9*S, 11.0*S);      // Engine Right
  sh.lineTo(0, 10.6*S);          // Engine Center
  // Mirror for left side
  sh.lineTo(-0.9*S, 11.0*S);
  sh.lineTo(-1.2*S, 10.5*S);
  sh.lineTo(-4.4*S, 10.5*S);
  sh.lineTo(-4.4*S, 8.5*S);
  sh.lineTo(-2.2*S, 5.5*S);
  sh.lineTo(-7.0*S, 4.0*S);
  sh.lineTo(-7.5*S, 1.5*S);
  sh.lineTo(-1.2*S, -5.5*S);
  sh.closePath();

  // The bevel seamlessly rounds the entire aircraft edge, making it look incredibly aerodynamic & stealthy
  const bodyGeo = new THREE.ExtrudeGeometry(sh, {
    depth: 0.3*S,            // base thickness
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.3*S,        // outward curve
    bevelThickness: 0.3*S    // vertical curve
  });
  const body = new THREE.Mesh(bodyGeo, M.top);
  body.rotation.x = Math.PI / 2; // Flat on the XZ plane
  body.position.y = 0.45*S;      // Center vertically 
  H(body);

  // 2. CENTRAL FUSELAGE VOLUME
  // A smooth cylinder merging seamlessly into the center to give the body 3D volume
  const fuseInfo = new THREE.Mesh(new THREE.CylinderGeometry(1.4*S, 1.4*S, 14*S, 16), M.top);
  fuseInfo.scale.set(1.0, 0.45, 1.0); // Flattened oval
  fuseInfo.rotation.x = Math.PI / 2;
  fuseInfo.position.set(0, 0, 1.5*S);
  H(fuseInfo);

  // 3. CANOPY (Cockpit)
  const can = new THREE.Mesh(new THREE.SphereGeometry(1.2*S, 20, 16), M.can);
  can.scale.set(0.65, 0.45, 1.9);
  can.position.set(0, 0.75*S, -4.5*S);
  H(can);

  // 4. CANTED VERTICAL FINS
  const finSh = new THREE.Shape();
  finSh.moveTo(0,0);
  finSh.lineTo(0.6*S, 0);
  finSh.lineTo(0.3*S, 3.8*S);
  finSh.lineTo(-2.2*S, 3.8*S);
  finSh.lineTo(-1.6*S, 0);
  finSh.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finSh, { depth: 0.15*S, bevelEnabled: true, bevelSize: 0.06*S, bevelThickness: 0.08*S });

  for(let s=-1; s<=1; s+=2) {
    const fin = new THREE.Mesh(finGeo, M.top);
    fin.position.set(s * 1.8*S, 0.5*S, 8.5*S);
    fin.rotation.set(-0.05, s * -0.1, s * 0.45); // Sweep back and 25-deg cant
    if (s < 0) fin.scale.x = -1;
    H(fin);
  }

  // 5. ENGINE NOZZLES & GLOW
  const nozzleRefs = [], glowRefs = [];
  for(let s=-1; s<=1; s+=2) {
    // 2D TVC dark nozzle box
    const noz = new THREE.Mesh(new THREE.BoxGeometry(1.6*S, 0.8*S, 1.8*S), M.noz);
    noz.position.set(s * 0.9*S, 0, 11.2*S);
    H(noz);
    nozzleRefs.push(noz);
    
    // AB Glow
    const g1 = new THREE.Mesh(new THREE.CircleGeometry(0.6*S, 16), new THREE.MeshBasicMaterial({color:0xff6600, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false}));
    g1.position.set(s * 0.9*S, 0, 12.2*S);
    H(g1);
    glowRefs.push(g1);
  }

  // 6. INTAKE HOUSINGS (Dark Side Boxes)
  for(let s=-1; s<=1; s+=2) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(1.2*S, 1.2*S, 4.0*S), M.dark);
    intake.position.set(s * 1.6*S, -0.4*S, -2.5*S);
    H(intake);
  }

  // 7. USAF ROUNDELS
  for(let s=-1; s<=1; s+=2){
    const rg = new THREE.Group();
    const r1 = new THREE.Mesh(new THREE.CircleGeometry(0.8*S,16), new THREE.MeshBasicMaterial({color:0x1c2e5e}));
    r1.rotation.x = -Math.PI/2;
    const r2 = new THREE.Mesh(new THREE.CircleGeometry(0.5*S,16), new THREE.MeshBasicMaterial({color:0xd8dce2}));
    r2.rotation.x = -Math.PI/2; r2.position.y = 0.05;
    rg.add(r1, r2);
    rg.position.set(s*4.5*S, 0.65*S, 2.0*S);
    H(rg);
  }

  // 8. VAPOR TRAILS
  const vGeo = new THREE.PlaneGeometry(8*S, 8*S);
  const vL = new THREE.Mesh(vGeo, M.vap);
  vL.position.set(-7*S, 0.5*S, 5*S); vL.rotation.x = -Math.PI/2; H(vL);
  const vR = new THREE.Mesh(vGeo, M.vap.clone());
  vR.position.set(7*S, 0.5*S, 5*S); vR.rotation.x = -Math.PI/2; H(vR);
  const vC = new THREE.Mesh(vGeo, M.vap.clone());
  vC.position.set(0, 1.5*S, -8*S); vC.rotation.x = -0.7; H(vC);

  // 9. FINALIZE
  group.rotation.order = "YXZ";
  group.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // Dummy controls since wings are 1 solid piece
  const dummy = new THREE.Object3D();
  group.userData = { 
    vapor: [vL, vR, vC], 
    ctrl: { rudL: dummy, rudR: dummy, stabL: dummy, stabR: dummy }, 
    nozzles: nozzleRefs, 
    glows: glowRefs 
  };
  return group;
}
function buildWorld(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD, 80, 80),
    new THREE.MeshStandardMaterial({
      color: 0x2a4838,
      metalness: 0.05,
      roughness: 0.93,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y - 0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Simple procedural terrain and runways
  for (let i = 0; i < 450; i++) {
    const rx = (Math.random() - 0.5) * WORLD * 0.9;
    const rz = (Math.random() - 0.5) * WORLD * 0.9;
    const r = 200 + Math.random() * 2500;
    const h = 50 + Math.random() * 850;
    HILLS.push({ x: rx, z: rz, r, h });
  }

  for (let i = 0; i < 8; i++) {
    const cx = (Math.random() - 0.5) * 40000;
    const cz = (Math.random() - 0.5) * 40000;
    const halfW = 45;
    const halfL = 600;
    const yaw = Math.random() * Math.PI;

    const rwM = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, halfL * 2),
      new THREE.MeshStandardMaterial({
        color: 0x181a1c,
        metalness: 0.1,
        roughness: 0.8,
      })
    );
    rwM.rotation.x = -Math.PI / 2;
    rwM.rotation.z = -yaw;
    const ty = terrainHeight(cx, cz);
    rwM.position.set(cx, ty + 0.2, cz);
    scene.add(rwM);

    RUNWAYS.push({ cx, cz, halfW, halfL, yaw });
  }

  // Boxes
  const cMat = new THREE.MeshStandardMaterial({ color: 0x80858a });
  const cGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 600; i++) {
    const cx = (Math.random() - 0.5) * 50000;
    const cz = (Math.random() - 0.5) * 50000;
    if (xzNearRunway(cx, cz)) continue;
    const ty = terrainHeight(cx, cz);
    const hw = 12 + Math.random() * 25;
    const hh = 15 + Math.random() * 60;
    const hd = 12 + Math.random() * 25;

    const m = new THREE.Mesh(cGeo, cMat);
    m.scale.set(hw * 2, hh * 2, hd * 2);
    m.position.set(cx, ty + hh, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);

    COLLIDERS.push({
      minX: cx - hw, maxX: cx + hw,
      minY: ty, maxY: ty + hh * 2,
      minZ: cz - hd, maxZ: cz + hd,
    });
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6eb8ff);
scene.fog = new THREE.Fog(0xa8d4ff, 2400, 32000);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 120000);
camera.position.set(0, 220, 620);

const hemi = new THREE.HemisphereLight(0xc8e8ff, 0x3d5c48, 0.88);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.08);
sun.position.set(4000, 9000, 2000);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 100;
sun.shadow.camera.far = 28000;
const sc = 14000;
sun.shadow.camera.left = -sc;
sun.shadow.camera.right = sc;
sun.shadow.camera.top = sc;
sun.shadow.camera.bottom = -sc;
scene.add(sun);

const plane = buildF22();
plane.position.set(0, 520, 0);
scene.add(plane);

buildWorld(scene);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const WIND = new THREE.Vector3(11, 0.5, -9);
const velocity = new THREE.Vector3(0, 0, -95);
const tmpFwd = new THREE.Vector3();
const noseDir = new THREE.Vector3();
const camPos = new THREE.Vector3();
const accel = new THREE.Vector3();
const relWind = new THREE.Vector3();
const relN = new THREE.Vector3();
const prevVel = new THREE.Vector3();
const liftDir = new THREE.Vector3();
const sideDir = new THREE.Vector3();
const tmpA = new THREE.Vector3();
const camOffset = new THREE.Vector3();

let gSmooth = 1;
let aoaDeg = 0;
let throttle01 = 0.35;
let dynPressurePa = 0;
let structuralStress = 0;
let flightAlive = true;
let respawnGrace = 0;
const clock = new THREE.Clock();

const debrisMeshes = [];
const debrisGeom = new THREE.BoxGeometry(4, 2, 5);
const debrisMat = new THREE.MeshStandardMaterial({
  color: 0x3a4048,
  metalness: 0.4,
  roughness: 0.65,
});

function clearDebris() {
  for (const m of debrisMeshes) scene.remove(m);
  debrisMeshes.length = 0;
}

function spawnDebris(at) {
  clearDebris();
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(debrisGeom, debrisMat);
    m.position.copy(at);
    m.position.add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 18
      )
    );
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      25 + Math.random() * 55,
      (Math.random() - 0.5) * 80
    );
    m.userData.av = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4
    );
    scene.add(m);
    debrisMeshes.push(m);
  }
}

function crash(reason) {
  if (!flightAlive) return;
  flightAlive = false;
  throttle01 = 0;
  spawnDebris(plane.position);
  plane.visible = false;
  elCrash.textContent = `Yapı / çarpışma: ${reason}. Pistte yeniden doğmak için F tuşuna bas.`;
  elCrash.classList.add("visible");
}

function respawnAtNearestRunway() {
  if (flightAlive) return;
  let best = RUNWAYS[0];
  let bestD = Infinity;
  const px = plane.position.x;
  const pz = plane.position.z;
  for (const rw of RUNWAYS) {
    const d = Math.hypot(px - rw.cx, pz - rw.cz);
    if (d < bestD) {
      bestD = d;
      best = rw;
    }
  }
  if (!best) return;

  clearDebris();
  flightAlive = true;
  plane.visible = true;

  const terr = terrainHeight(best.cx, best.cz);
  const startAlong = -best.halfL * 0.55;
  const c = Math.cos(best.yaw);
  const s = Math.sin(best.yaw);
  plane.position.set(
    best.cx + s * startAlong,
    Math.max(terr, GROUND_Y) + 18,
    best.cz + c * startAlong
  );

  plane.rotation.set(0, best.yaw, 0);
  velocity.set(
    Math.sin(best.yaw) * 72,
    0,
    -Math.cos(best.yaw) * 72
  );
  throttle01 = 0.50;
  gSmooth = 1;
  structuralStress = 0;
  respawnGrace = 3.0;
  orbitTheta = 0.6;
  orbitPhi = Math.PI * 0.36;
  orbitRadius = 145;

  elCrash.classList.remove("visible");
}

function updateFlight(dt) {
  if (!flightAlive) {
    for (const m of debrisMeshes) {
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.vel.y -= GRAVITY * dt;
      m.rotation.x += m.userData.av.x * dt;
      m.rotation.y += m.userData.av.y * dt;
      m.rotation.z += m.userData.av.z * dt;
    }
    return;
  }

  const rho = airDensity(plane.position.y - GROUND_Y);
  const dragMult = TANK_DRAG_MULT;

  if (keys.w) throttle01 += 0.28 * dt;
  if (keys.s) throttle01 -= 0.40 * dt;
  throttle01 = THREE.MathUtils.clamp(throttle01, 0, 1);

  if (keys.a) plane.rotation.y += YAW_SPEED * dt;
  if (keys.d) plane.rotation.y -= YAW_SPEED * dt;

  if (keys.ArrowUp) plane.rotation.x -= PITCH_SPEED * dt;
  if (keys.ArrowDown) plane.rotation.x += PITCH_SPEED * dt;

  const maxPitch = Math.PI / 2 - 0.06;
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -maxPitch, maxPitch);

  const yawRate = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  plane.rotation.z = THREE.MathUtils.lerp(
    plane.rotation.z,
    -yawRate * 0.32 * Math.min(velocity.length() / 140, 1.0),
    1 - Math.exp(-2.5 * dt)
  );

  plane.getWorldDirection(tmpFwd);
  noseDir.copy(tmpFwd).negate();

  prevVel.copy(velocity);

  relWind.copy(velocity).sub(WIND);
  const V = relWind.length();
  if (V > 0.05) relN.copy(relWind).divideScalar(V);
  else relN.set(0, 0, 0);

  dynPressurePa = 0.5 * rho * V * V;

  let aoa = 0;
  if (V > 1) {
    const cosAoA = THREE.MathUtils.clamp(noseDir.dot(relN), -1, 1);
    aoa = Math.acos(cosAoA);
    if (aoa > AOA_STALL) aoa = AOA_STALL + (aoa - AOA_STALL) * 0.15;
  }
  aoaDeg = (aoa * 180) / Math.PI;

  accel.set(0, 0, 0);
  accel.addScaledVector(noseDir, THRUST_ACCEL_MAX * throttle01);
  if (keys.s) accel.addScaledVector(noseDir, -BRAKE_ACCEL);

  accel.y -= GRAVITY;

  if (V > 0.4) {
    const q = dynPressurePa;
    const dragMag = K_DRAG * q * dragMult * (1 + 0.35 * Math.abs(plane.rotation.z));
    accel.addScaledVector(relN, -dragMag);

    const stall = THREE.MathUtils.smoothstep(
      V,
      STALL_SPEED * 0.65,
      STALL_SPEED * 1.4
    );
    sideDir.crossVectors(noseDir, relN);
    if (sideDir.lengthSq() > 1e-10) {
      sideDir.normalize();
      liftDir.crossVectors(relN, sideDir).normalize();
      const liftMag =
        K_LIFT *
        q *
        Math.sin(aoa * 2) *
        stall *
        Math.max(0, 1 - (aoa / AOA_STALL) * 0.35);
      accel.addScaledVector(liftDir, liftMag);
    }
  }

  accel.divideScalar(TANK_MASS_MULT);
  velocity.addScaledVector(accel, dt);

  const spd = velocity.length();
  if (spd > MAX_SPEED) velocity.multiplyScalar(MAX_SPEED / spd);

  plane.position.addScaledVector(velocity, dt);

  tmpA.copy(velocity).sub(prevVel).divideScalar(Math.max(dt, 1e-4));
  const gInst = tmpA.length() / GRAVITY;
  gSmooth = THREE.MathUtils.lerp(gSmooth, gInst, 1 - Math.exp(-12 * dt));

  if (respawnGrace > 0) respawnGrace -= dt;

  const px = plane.position.x;
  const py = plane.position.y;
  const pz = plane.position.z;
  const tH = terrainHeight(px, pz);
  const onRw = pointOnRunway(px, py, pz);

  if (respawnGrace <= 0) {
    if (!onRw && py < tH + PLANE_CLEARANCE) {
      crash("araziye çarpışma");
      return;
    }

    if (boxHit(px, py, pz)) {
      crash("bina / yerleşim");
      return;
    }
  }

  let stressIn = 0;
  if (gInst > G_STRESS_HARD) {
    stressIn += (gInst - G_STRESS_HARD) * STRESS_BUILD_HARD;
  } else if (gInst > G_STRESS_SOFT) {
    stressIn += (gInst - G_STRESS_SOFT) * STRESS_BUILD_SOFT;
  }
  const qNorm = dynPressurePa / Q_LIMIT_PA;
  const aoNorm = aoaDeg / Math.max(AOA_BREAK_DEG, 1);
  if (qNorm > 0.8 && aoNorm > 0.8) {
    stressIn += (qNorm - 0.8) * (aoNorm - 0.8) * 160;
  }
  if (dynPressurePa > Q_LIMIT_PA * 1.1) {
    stressIn += ((dynPressurePa - Q_LIMIT_PA * 1.1) / (Q_LIMIT_PA * 0.35)) * 14;
  }
  const safeAero = gInst < 6.3 && dynPressurePa < Q_LIMIT_PA * 0.7 && aoaDeg < 30;
  if (safeAero) {
    structuralStress -= STRESS_DECAY * dt;
  } else if (stressIn < 0.5 && gInst < G_STRESS_SOFT) {
    structuralStress -= STRESS_DECAY * 0.45 * dt;
  }
  structuralStress += stressIn * dt;
  structuralStress = THREE.MathUtils.clamp(structuralStress, 0, 100);

  if (structuralStress >= 99.2) {
    crash("yapı dayanımı aşıldı (G / basınç / AoA birikimi)");
    return;
  }

  if (onRw && py < tH + 4) {
    plane.position.y = tH + 5.5;
    if (velocity.y < -5) velocity.y *= -0.2;
  }

  const ud = plane.userData;
  const now = performance.now() * 0.001;

  if (ud.ctrl) {
    const pitchCmd = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    const yawCmd   = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
    const rollLean  = plane.rotation.z;
    const lerpRate  = 1 - Math.exp(-8 * dt);
    const stabLtgt = pitchCmd * 0.38 + rollLean * 0.18;
    const stabRtgt = pitchCmd * 0.38 - rollLean * 0.18;
    ud.ctrl.stabL.rotation.x = THREE.MathUtils.lerp(ud.ctrl.stabL.rotation.x, stabLtgt, lerpRate);
    ud.ctrl.stabR.rotation.x = THREE.MathUtils.lerp(ud.ctrl.stabR.rotation.x, stabRtgt, lerpRate);
    ud.ctrl.rudL.rotation.y  = THREE.MathUtils.lerp(ud.ctrl.rudL.rotation.y,  yawCmd * 0.28, lerpRate);
    ud.ctrl.rudR.rotation.y  = THREE.MathUtils.lerp(ud.ctrl.rudR.rotation.y, -yawCmd * 0.28, lerpRate);
  }

  const heat    = throttle01 * throttle01;
  const abOn    = keys.w;
  const shimmer = 0.88 + 0.12 * Math.sin(now * 38.0) + 0.06 * Math.sin(now * 73.0);
  const abBoost = abOn ? 0.55 : 0.0;
  const nozInt  = heat * 2.2 * shimmer + abBoost;

  if (ud.nozzles) {
    ud.nozzles.forEach((n) => {
      n.material.emissiveIntensity = nozInt;
      const t = THREE.MathUtils.clamp(heat, 0, 1);
      n.material.emissive.setRGB(1.0, 0.12 + 0.32 * t, 0.0);
    });
  }
  if (ud.glows) {
    ud.glows.forEach((g, i) => {
      const freq  = i % 2 === 0 ? 29.0 : 17.0;
      const flick = 0.80 + 0.20 * Math.sin(now * freq);
      const base  = i % 2 === 0 ? 0.80 : 0.38;
      g.material.opacity = (heat * base + abBoost * 0.5) * flick;
    });
  }

  const vaporG = Math.max(0, gSmooth - 2.5);
  const vaporV = THREE.MathUtils.smoothstep(spd, 48, 130);
  const pitching = (keys.ArrowUp || keys.ArrowDown) ? 1 : 0;
  const vaporA = Math.min(0.55,
    vaporG * 0.10 * vaporV
    + pitching * 0.10 * vaporV
    + Math.max(0, aoaDeg - 8) * 0.008 * vaporV
  );
  if (ud.vapor) {
    ud.vapor.forEach((m) => {
      const pulse = 0.82 + 0.18 * Math.sin(now * 4.5);
      m.material.opacity = vaporA * pulse;
    });
  }
}

function updateCamera(dt) {
  const target = plane.position;
  camOffset.set(
    orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
    orbitRadius * Math.cos(orbitPhi),
    orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
  );
  camPos.copy(target).add(camOffset);

  camera.position.lerp(camPos, 1 - Math.exp(-6 * dt));

  camera.lookAt(target);
}

function hud() {
  if (!flightAlive) {
    elGWarn.classList.remove("visible");
    elGWarn.textContent = "";
    elSpeed.textContent = "—";
    elStress.textContent = "—";
    return;
  }

  elStress.textContent = Math.round(structuralStress);

  if (gSmooth > G_WARN || structuralStress > 62) {
    const parts = [];
    if (gSmooth > G_WARN) {
      parts.push(`G ${gSmooth.toFixed(1)}`);
    }
    if (structuralStress > 62) {
      parts.push(`yapı %${Math.round(structuralStress)}`);
    }
    elGWarn.textContent = `UYARI — ${parts.join(" · ")}`;
    elGWarn.classList.add("visible");
  } else {
    elGWarn.classList.remove("visible");
    elGWarn.textContent = "";
  }

  const spd = velocity.length();
  elSpeed.textContent = Math.round(spd * 3.6);
  elAlt.textContent = Math.round(plane.position.y - GROUND_Y);
  elPitch.textContent = Math.round((-plane.rotation.x * 180) / Math.PI);
  let h = (-plane.rotation.y * 180) / Math.PI;
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  elHeading.textContent = Math.round(h);
  elG.textContent = gSmooth.toFixed(1);
  elAoA.textContent = Math.round(aoaDeg);
  elDynPress.textContent = Math.round(dynPressurePa / 1000);
  const w = WIND.length();
  elWind.textContent = `${Math.round(w * 3.6)} @ ${Math.round(
    (Math.atan2(WIND.x, WIND.z) * 180) / Math.PI + 180
  )}°`;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateFlight(dt);
  updateCamera(dt);
  hud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

tick();
