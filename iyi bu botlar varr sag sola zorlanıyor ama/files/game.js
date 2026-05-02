/* global THREE */
"use strict";

// ─────────────────────────────────────────────
//  DOM
// ─────────────────────────────────────────────
const canvas      = document.querySelector("#c");
const elSpeed     = document.querySelector("#speed");
const elAlt       = document.querySelector("#altitude");
const elPitch     = document.querySelector("#pitch");
const elHeading   = document.querySelector("#heading");
const elG         = document.querySelector("#gforce");
const elWind      = document.querySelector("#wind");
const elAoA       = document.querySelector("#aoa");
const elDynPress  = document.querySelector("#dynpress");
const elStress    = document.querySelector("#stress");
const elGWarn     = document.querySelector("#g-warn");
const elCrash     = document.querySelector("#crash-msg");
const elMach      = document.getElementById("mach");
const elThrottle  = document.getElementById("throttle");
const elRoll      = document.getElementById("roll");

// ─────────────────────────────────────────────
//  WORLD CONSTANTS
// ─────────────────────────────────────────────
const WORLD        = 80000;
const GROUND_Y     = 0;

// ─────────────────────────────────────────────
//  PHYSICS CONSTANTS  (realistic F-22 envelope)
// ─────────────────────────────────────────────
const GRAVITY        = 9.80665;      // m/s²
const RHO0           = 1.225;        // kg/m³ sea-level density
const SCALE_ALT      = 8500;         // density scale height (m)
const SPEED_OF_SOUND = 340.29;       // m/s at sea level

// F-22 aerodynamic params
const WING_AREA      = 78.0;         // m²
const AIRCRAFT_MASS  = 19700;        // kg (combat weight)
const CL_ALPHA       = 4.8;          // lift curve slope (per rad)
const CD0            = 0.016;        // zero-lift drag coefficient
const K_IND          = 0.13;         // induced drag factor (1/πARe)
const CL_MAX         = 1.65;         // max lift coefficient (before stall)
const AOA_STALL_RAD  = 0.38;         // stall AoA ≈ 22°
const AOA_CRIT_RAD   = 0.55;         // structural AoA limit ≈ 31°

// F-22 Raptor dual F119 engines: ~311 kN total thrust (AB), ~156 kN dry
const THRUST_MAX_AB  = 311000;       // N (afterburner)
const THRUST_MAX_DRY = 156000;       // N (dry)
const THRUST_MIN     = 6000;         // N (idle)

// Control limits
const PITCH_RATE     = 1.4;          // rad/s max pitch rate
const ROLL_RATE      = 3.0;          // rad/s max roll rate (F-22 is extremely agile)
const YAW_RATE       = 0.35;         // rad/s max yaw rate
const SIDESLIP_DAMP  = 2.2;          // sideslip damping factor

// Structural limits
const G_LIMIT_POS    = 9.0;          // +G limit
const G_LIMIT_NEG    = -3.0;         // -G limit
const Q_LIMIT_PA     = 120000;       // dynamic pressure limit (Pa)
const AOA_BREAK_DEG  = 36;
const G_WARN         = 9.5;
const G_STRESS_SOFT  = 11.0;
const G_STRESS_HARD  = 14.0;
const STRESS_DECAY   = 28;
const STRESS_BUILD_S = 2;
const STRESS_BUILD_H = 6;
const PLANE_CLEARANCE= 11;
const PLANE_HIT_HALF = 14;

// Camera
const ORBIT_ROT_SENS = 0.0042;

// ─────────────────────────────────────────────
//  INPUT STATE
// ─────────────────────────────────────────────
const keys = { w:false, s:false, a:false, d:false, ArrowUp:false, ArrowDown:false, q:false, e:false, z:false, x:false };

// ─────────────────────────────────────────────
//  SCREEN RECORDING
// ─────────────────────────────────────────────
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

const recIndicator = document.createElement('div');
recIndicator.innerHTML = '&#9209; REC';
recIndicator.style.cssText = 'position:fixed; top:22px; right:22px; color:#ff2222; font-family:"Courier New", monospace; font-size:18px; font-weight:bold; display:none; z-index:100; text-shadow: 0 0 10px #ff2222;';
document.body.appendChild(recIndicator);

window.addEventListener("keydown", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in keys) {
    if (k === 'z' || k === 'x') {
      if (!keys[k]) { keys[k] = true; } // edge detection handled in tick
    } else {
      keys[k] = true;
    }
    e.preventDefault();
  }
  if (e.code === "KeyF") respawnAtNearestRunway();
  
  if (k === 'r') {
      if (!isRecording) {
          const stream = canvas.captureStream(60);
          const options = { mimeType: 'video/webm; codecs=vp9' };
          try {
              mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
          } catch(e) {
              mediaRecorder = new MediaRecorder(stream);
          }
          mediaRecorder.ondataavailable = function(event) {
              if (event.data.size > 0) recordedChunks.push(event.data);
          };
          mediaRecorder.onstop = function() {
              const blob = new Blob(recordedChunks, { type: 'video/webm' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'f22_flight_record_' + Date.now() + '.webm';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              recordedChunks = [];
          };
          mediaRecorder.start();
          isRecording = true;
          recIndicator.style.display = 'block';
          
          recIndicator.blinkInterval = setInterval(() => {
              recIndicator.style.opacity = recIndicator.style.opacity === '0' ? '1' : '0';
          }, 500);
      } else {
          mediaRecorder.stop();
          isRecording = false;
          recIndicator.style.display = 'none';
          recIndicator.style.opacity = '1';
          clearInterval(recIndicator.blinkInterval);
      }
  }
});
window.addEventListener("keyup", e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in keys) keys[k] = false;
});

// ─────────────────────────────────────────────
//  CAMERA ORBIT
// ─────────────────────────────────────────────
let orbitTheta = 0.55, orbitPhi = Math.PI * 0.38, orbitRadius = 155;
let mouseDragActive = false;

canvas.addEventListener("mousedown", e => {
  if (e.button === 0) canvas.requestPointerLock();
  if (e.button === 2 || e.button === 1) mouseDragActive = true;
});
canvas.addEventListener("mouseup", () => { mouseDragActive = false; });
canvas.addEventListener("contextmenu", e => e.preventDefault());

document.addEventListener("mousemove", e => {
  const locked = document.pointerLockElement === canvas;
  if (locked || mouseDragActive) {
    const s = locked ? ORBIT_ROT_SENS : ORBIT_ROT_SENS * 0.85;
    orbitTheta -= e.movementX * s;
    orbitPhi   -= e.movementY * s;
    orbitPhi    = THREE.MathUtils.clamp(orbitPhi, 0.012, Math.PI - 0.012);
  }
});
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  orbitRadius += e.deltaY * 0.14;
  orbitRadius  = THREE.MathUtils.clamp(orbitRadius, 30, 500);
}, { passive: false });

// ─────────────────────────────────────────────
//  ATMOSPHERE MODEL (ISA)
// ─────────────────────────────────────────────
function airDensity(alt) {
  const h = Math.max(0, alt);
  if (h < 11000) {
    // troposphere
    const T = 288.15 - 0.0065 * h;
    return 1.225 * Math.pow(T / 288.15, 4.256);
  } else {
    // stratosphere
    return 0.3639 * Math.exp(-(h - 11000) / 6341.6);
  }
}

function speedOfSound(alt) {
  const h = Math.max(0, alt);
  if (h < 11000) {
    const T = 288.15 - 0.0065 * h;
    return 331.3 * Math.sqrt(T / 273.15);
  }
  return 295.0; // constant in stratosphere
}

// ─────────────────────────────────────────────
//  TERRAIN
// ─────────────────────────────────────────────
const RUNWAYS  = [];
const COLLIDERS= [];

function terrainHeight(x, z) {
  return 0; // Completely flat
}

function pointOnRunway(px, py, pz) {
  for (const rw of RUNWAYS) {
    const dx = px - rw.cx, dz = pz - rw.cz;
    const c = Math.cos(-rw.yaw), s = Math.sin(-rw.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const th = terrainHeight(px, pz);
    if (Math.abs(lx) < rw.halfW - 2 && Math.abs(lz) < rw.halfL - 2 && py < th + 28) return true;
  }
  return false;
}

function xzNearRunway(px, pz, expand = 110) {
  for (const rw of RUNWAYS) {
    const dx = px - rw.cx, dz = pz - rw.cz;
    const c = Math.cos(-rw.yaw), s = Math.sin(-rw.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < rw.halfW + expand && Math.abs(lz) < rw.halfL + expand) return true;
  }
  return false;
}

function boxHit(px, py, pz) {
  const r2 = PLANE_HIT_HALF * PLANE_HIT_HALF;
  for (const b of COLLIDERS) {
    const cx = THREE.MathUtils.clamp(px, b.minX, b.maxX);
    const cy = THREE.MathUtils.clamp(py, b.minY, b.maxY);
    const cz = THREE.MathUtils.clamp(pz, b.minZ, b.maxZ);
    const dx = px-cx, dy = py-cy, dz = pz-cz;
    if (dx*dx+dy*dy+dz*dz < r2) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
//  F-22 RAPTOR 3D MODEL  (accurate silhouette)
// ─────────────────────────────────────────────
function buildF22() {
  const group = new THREE.Group();
  const S = 3.5; // SCALED UP SIGNIFICANTLY

  const matBody = new THREE.MeshPhysicalMaterial({ color: 0x5a6570, metalness: 0.65, roughness: 0.35, clearcoat: 0.3 });
  const matDark = new THREE.MeshStandardMaterial({ color:0x333333, metalness:0.5, roughness:0.8 });
  const matCanopy = new THREE.MeshPhysicalMaterial({ 
    color: 0x050c11, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.85, envMapIntensity: 2.0 
  });
  const matNoz = new THREE.MeshStandardMaterial({ color:0x111, metalness:0.8, roughness:0.2 });

  // Thrust Flame
  const matFlame = new THREE.MeshBasicMaterial({ 
      color: 0xff4400, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending 
  });
  const matFlameCore = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending 
  });

  function add(m) { group.add(m); return m; }

  // 1. Sleeker Fuselage (tapered)
  // Three.js CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
  const fuseGeo = new THREE.CylinderGeometry(0.8*S, 1.1*S, 14*S, 24);
  fuseGeo.rotateX(Math.PI / 2); // points along Z, but Y becomes Z. Default cylinder goes along Y.
  // After rotateX(PI/2): +Y points to -Z. So radiusTop is at -Z (front), radiusBottom is at +Z (back).
  const fuse = add(new THREE.Mesh(fuseGeo, matBody));
  
  // 2. Corrected Nose Cone (Facing forward, -Z)
  const noseGeo = new THREE.ConeGeometry(0.8*S, 4.5*S, 24);
  // Default cone faces +Y. We want it to point to -Z. Rotate by -Math.PI / 2
  noseGeo.rotateX(-Math.PI / 2);
  const nose = add(new THREE.Mesh(noseGeo, matBody));
  // Positioned at the front of the fuselage (-7*S) minus half the nose height (-2.25*S)
  nose.position.set(0, 0, -9.25*S);

  // 3. Realistic Canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.65*S, 3.5*S, 4, 16);
  canopyGeo.rotateX(Math.PI / 2);
  const canopy = add(new THREE.Mesh(canopyGeo, matCanopy));
  canopy.position.set(0, 0.8*S, -4*S);

  // 4. Realistic Main Wings (Larger wingspan)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1*S);
  wingShape.lineTo(7.5*S, 3.5*S);  // WIDER
  wingShape.lineTo(7.5*S, 6.0*S);
  wingShape.lineTo(0, 6.5*S);
  wingShape.closePath();
  
  const extSettings = { depth: 0.15*S, bevelEnabled: true, bevelSize: 0.05*S, bevelThickness: 0.05*S, bevelSegments: 3 };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extSettings);
  wingGeo.computeVertexNormals();

  const wingR = add(new THREE.Mesh(wingGeo, matBody));
  wingR.position.set(0.9*S, 0, -2*S);
  wingR.rotation.x = Math.PI / 2;

  const wingL = add(new THREE.Mesh(wingGeo, matBody));
  wingL.scale.x = -1;
  wingL.position.set(-0.9*S, 0, -2*S);
  wingL.rotation.x = Math.PI / 2;

  // 5. Horizontal Stabilizers
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0, 0);
  stabShape.lineTo(4.0*S, 2.0*S);
  stabShape.lineTo(4.0*S, 3.5*S);
  stabShape.lineTo(0, 4.0*S);
  stabShape.closePath();

  const stabGeo = new THREE.ExtrudeGeometry(stabShape, extSettings);
  stabGeo.computeVertexNormals();

  const stabR = new THREE.Object3D();
  stabR.position.set(0.9*S, -0.2*S, 5.5*S);
  const stabMeshR = new THREE.Mesh(stabGeo, matBody);
  stabMeshR.rotation.x = Math.PI/2;
  stabR.add(stabMeshR);
  add(stabR);

  const stabL = new THREE.Object3D();
  stabL.position.set(-0.9*S, -0.2*S, 5.5*S);
  const stabMeshL = new THREE.Mesh(stabGeo, matBody);
  stabMeshL.rotation.x = Math.PI/2;
  stabMeshL.scale.x = -1;
  stabL.add(stabMeshL);
  add(stabL);

  // 6. Vertical Stabilizer (Taller, distinct sweep)
  const vtShape = new THREE.Shape();
  vtShape.moveTo(0, 0);
  vtShape.lineTo(3.5*S, 0);
  vtShape.lineTo(4.0*S, 4.0*S);
  vtShape.lineTo(2.5*S, 4.0*S);
  vtShape.closePath();

  const vtGeo = new THREE.ExtrudeGeometry(vtShape, extSettings);
  vtGeo.translate(0, 0, -0.075*S); // center the depth so it's flush at x=0
  vtGeo.computeVertexNormals();
  const vt = add(new THREE.Mesh(vtGeo, matBody));
  vt.rotation.y = -Math.PI / 2; // align along Z axis
  vt.position.set(0, 0.8*S, 4.5*S);
  
  // 7. Underside Intakes
  const intakeGeo = new THREE.BoxGeometry(1.4*S, 1.0*S, 5*S);
  const intake = add(new THREE.Mesh(intakeGeo, matDark));
  intake.position.set(0, -1.0*S, -1*S);

  // 8. Tapered Engine Nozzle
  const nozzleGeo = new THREE.CylinderGeometry(1.1*S, 0.95*S, 2.5*S, 24);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = add(new THREE.Mesh(nozzleGeo, matNoz));
  // Positioned at the very end of the fuselage (7*S) + half height (1.25*S)
  nozzle.position.set(0, 0, 8.25*S);

  // 9. Realistic Afterburner Flame
  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0, 9.5*S);
  
  // Outer flame
  const outerFlameGeo = new THREE.CylinderGeometry(0.9*S, 0.1*S, 8*S, 16);
  outerFlameGeo.rotateX(Math.PI / 2);
  const outerFlame = new THREE.Mesh(outerFlameGeo, matFlame);
  // Default cylinder center is 0, offset Z so it starts at 0
  outerFlameGeo.translate(0, 0, 4*S);
  flameGroup.add(outerFlame);

  // Inner core
  const coreFlameGeo = new THREE.CylinderGeometry(0.5*S, 0.05*S, 5*S, 16);
  coreFlameGeo.rotateX(Math.PI / 2);
  coreFlameGeo.translate(0, 0, 2.5*S);
  const coreFlame = new THREE.Mesh(coreFlameGeo, matFlameCore);
  flameGroup.add(coreFlame);

  add(flameGroup);

  group.rotation.order = "YXZ";
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // 10. Under-wing missiles
  const misGeo = new THREE.CylinderGeometry(0.15*S, 0.15*S, 3*S, 8);
  misGeo.rotateX(Math.PI/2);
  const matMis = new THREE.MeshStandardMaterial({color:0xffffff, metalness:0.8, roughness:0.2});
  const m1 = new THREE.Mesh(misGeo, matMis); m1.position.set(3*S, -0.6*S, 0); m1.name = "missile"; add(m1);
  const m2 = new THREE.Mesh(misGeo, matMis); m2.position.set(-3*S, -0.6*S, 0); m2.name = "missile"; add(m2);

  // 11. Target reticle for radar
  const retBox = new THREE.BoxGeometry(18*S, 18*S, 18*S);
  const retMat = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true, transparent:true, opacity:0});
  const reticle = new THREE.Mesh(retBox, retMat);
  reticle.name = "reticle";
  add(reticle);

  group.userData = {
    ctrl   : { stabL, stabR },
    flame  : flameGroup
  };

  return group;
}

// ─────────────────────────────────────────────
//  WORLD BUILDING
// ─────────────────────────────────────────────
function buildWorld(scene) {
  // ── Ground with vertex-color elevation ──
  const gRes = 128;
  const gGeo = new THREE.PlaneGeometry(WORLD, WORLD, gRes, gRes);
  gGeo.rotateX(-Math.PI / 2);

  // Apply height to vertices + color by height
  const pos = gGeo.attributes.position;
  const col = new Float32Array(pos.count * 3);

  
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);

    // Flat green terrain
    const r=0.18, g=0.30, b=0.14;
    col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b;
  }
  gGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  gGeo.computeVertexNormals();

  const gMat = new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.1, roughness: 0.8, flatShading: false
  });
  const ground = new THREE.Mesh(gGeo, gMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // ── Water plane (low-lying areas) ────────
  const waterGeo = new THREE.PlaneGeometry(WORLD, WORLD);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color:0x113355, 
    metalness:0.9, 
    roughness:0.1, 
    transparent:true, 
    opacity:0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI/2;
  water.position.y = 1.5;
  scene.add(water);

  // ── Runways ───────────────────────────────
  const rwMat = new THREE.MeshStandardMaterial({ color:0x1a1c1e, metalness:0.08, roughness:0.85 });
  const stripeMat = new THREE.MeshStandardMaterial({ color:0xffffff, metalness:0.0, roughness:0.9 });

  for (let i = 0; i < 8; i++) {
    const cx = (Math.random()-0.5)*38000;
    const cz = (Math.random()-0.5)*38000;
    const halfW=44, halfL=600;
    const yaw = Math.random()*Math.PI;
    const ty = Math.max(0, terrainHeight(cx, cz));

    const rw = new THREE.Mesh(new THREE.PlaneGeometry(halfW*2, halfL*2), rwMat);
    rw.rotation.x = -Math.PI/2; rw.rotation.z = -yaw;
    rw.position.set(cx, ty+1.5, cz);
    rw.receiveShadow = true;
    scene.add(rw);

    // Center-line stripes
    for (let j = -5; j <= 5; j++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 40), stripeMat);
      stripe.rotation.x = -Math.PI/2; stripe.rotation.z = -yaw;
      const along = j * 90;
      stripe.position.set(
        cx + Math.sin(yaw)*along,
        ty+0.35,
        cz + Math.cos(yaw)*along
      );
      scene.add(stripe);
    }

    // Threshold markings
    for (let side = -1; side <= 1; side += 2) {
      const thresh = new THREE.Mesh(new THREE.PlaneGeometry(halfW*2-4, 8), stripeMat);
      thresh.rotation.x = -Math.PI/2; thresh.rotation.z = -yaw;
      thresh.position.set(
        cx + Math.sin(yaw)*side*(halfL-20),
        ty+0.35,
        cz + Math.cos(yaw)*side*(halfL-20)
      );
      scene.add(thresh);
    }

    RUNWAYS.push({ cx, cz, halfW, halfL, yaw, y: ty });
  }

  // ── Buildings (cities / military base) ───
  const bMat = new THREE.MeshStandardMaterial({ color:0x6a7078, metalness:0.2, roughness:0.75 });
  const bGeo = new THREE.BoxGeometry(1,1,1);

  for (let i = 0; i < 700; i++) {
    const cx = (Math.random()-0.5)*52000;
    const cz = (Math.random()-0.5)*52000;
    if (xzNearRunway(cx, cz)) continue;
    const ty = Math.max(0, terrainHeight(cx, cz));
    if (ty > 300) continue; // no buildings on mountain tops
    const hw=10+Math.random()*28, hh=14+Math.random()*80, hd=10+Math.random()*28;
    const m = new THREE.Mesh(bGeo, bMat);
    m.scale.set(hw*2, hh*2, hd*2);
    m.position.set(cx, ty+hh, cz);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    COLLIDERS.push({ minX:cx-hw, maxX:cx+hw, minY:ty, maxY:ty+hh*2, minZ:cz-hd, maxZ:cz+hd });
  }

  // ── Volumetric cloud layer ────────────────
  const cloudMat = new THREE.MeshStandardMaterial({
    color:0xffffff, transparent:true, opacity:0.72,
    metalness:0, roughness:1.0, depthWrite:false,
  });
  const cGeo = new THREE.SphereGeometry(1, 7, 5);
  for (let i = 0; i < 220; i++) {
    const cg = new THREE.Group();
    const cx = (Math.random()-0.5)*WORLD*0.8;
    const cz = (Math.random()-0.5)*WORLD*0.8;
    const cy = 1800 + Math.random()*2200;
    const nr = 4 + Math.floor(Math.random()*6);
    for (let j = 0; j < nr; j++) {
      const cm = new THREE.Mesh(cGeo, cloudMat);
      const rx = (Math.random()-0.5)*600, rz = (Math.random()-0.5)*400;
      const rs = 100+Math.random()*350;
      cm.position.set(rx, (Math.random()-0.5)*60, rz);
      cm.scale.setScalar(rs);
      cm.castShadow = false;
      cg.add(cm);
    }
    cg.position.set(cx, cy, cz);
    scene.add(cg);
  }
}

// ─────────────────────────────────────────────
//  SCENE SETUP
// ─────────────────────────────────────────────
const scene = new THREE.Scene();

// Sky gradient — deeper blue at top, horizon haze
scene.background = new THREE.Color(0x3a7ab9); // richer sky
scene.fog = new THREE.FogExp2(0x8abce0, 0.000030); // less dense fog for better visibility

const camera = new THREE.PerspectiveCamera(55, innerWidth/innerHeight, 0.5, 150000);
camera.position.set(0, 250, 600);

// ── Lighting ─────────────────────────────────
// Sun (directional, golden afternoon)
const sun = new THREE.DirectionalLight(0xfffaee, 2.0); // Brighter sun
sun.position.set(6000, 12000, 3000);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); // Optimize shadow map size for VSM
sun.shadow.camera.near = 100;
sun.shadow.camera.far  = 35000;
sun.shadow.bias = -0.0001;
sun.shadow.blurSamples = 4;
sun.shadow.radius = 3;
const sc = 20000;
sun.shadow.camera.left   = -sc;
sun.shadow.camera.right  =  sc;
sun.shadow.camera.top    =  sc;
sun.shadow.camera.bottom = -sc;
scene.add(sun);

// Sky hemisphere (sky↔ground ambient)
const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x4a6c42, 0.85);
scene.add(hemi);

// Subtle fill light (bounce from ground)
const fill = new THREE.DirectionalLight(0x88bbdd, 0.28);
fill.position.set(-3000, 500, -4000);
scene.add(fill);

// ── Renderer ─────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:"high-performance", logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0)); // optimize a bit
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // Softer, better shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25; // Brighter
renderer.outputColorSpace = THREE.SRGBColorSpace || "srgb";

// ── Aircraft ──────────────────────────────────
const plane = buildF22();
plane.position.set(0, 550, 0);
scene.add(plane);

// Spawn AI Planes
const aiPlanes = [];
for (let i = 0; i < 15; i++) {
  const aiPlane = buildF22();
  aiPlane.position.set((Math.random()-0.5)*20000, 300 + Math.random()*2000, (Math.random()-0.5)*20000);
  aiPlane.userData.targetPos = new THREE.Vector3((Math.random()-0.5)*20000, 300 + Math.random()*2000, (Math.random()-0.5)*20000);
  aiPlane.userData.isAI = true;
  aiPlane.rotation.set((Math.random()-0.5), (Math.random()-0.5)*Math.PI*2, (Math.random()-0.5));
  scene.add(aiPlane);
  aiPlanes.push(aiPlane);
}

buildWorld(scene);

// ─────────────────────────────────────────────
//  FLIGHT STATE
// ─────────────────────────────────────────────
const WIND        = new THREE.Vector3(8, 0.3, -7);   // m/s ambient wind
const velocity    = new THREE.Vector3(0, 0, -110);   // initial airspeed m/s (~400 km/h)

// Vectors (reused)
const tmpFwd   = new THREE.Vector3();
const noseDir  = new THREE.Vector3();
const camPos   = new THREE.Vector3();
const accel    = new THREE.Vector3();
const relWind  = new THREE.Vector3();
const relN     = new THREE.Vector3();
const prevVel  = new THREE.Vector3();
const liftDir  = new THREE.Vector3();
const sideDir  = new THREE.Vector3();
const upDir    = new THREE.Vector3();
const tmpA     = new THREE.Vector3();
const camOffset= new THREE.Vector3();

let throttle01     = 0.35;
let gSmooth        = 1.0;
let aoaDeg         = 0;
let dynPressurePa  = 0;
let machNumber     = 0;
let structuralStress = 0;
let rollAngle      = 0;     // actual bank angle
let flightAlive    = true;
let respawnGrace   = 0;
const clock = new THREE.Clock();

let activeTarget = null;
let detectedTargets = [];
const activeMissiles = [];
const missileGeo = new THREE.CylinderGeometry(0.15*3.5, 0.15*3.5, 3*3.5, 8);
missileGeo.rotateX(Math.PI/2);
const missileMat = new THREE.MeshStandardMaterial({color:0xffffff, metalness:0.8, roughness:0.2});

// ─────────────────────────────────────────────
//  DEBRIS
// ─────────────────────────────────────────────
const debrisMeshes = [];
const debrisGeo = new THREE.BoxGeometry(4,2,5);
const debrisMat = new THREE.MeshStandardMaterial({ color:0x3a4048, metalness:0.4, roughness:0.65 });

function clearDebris() {
  for (const m of debrisMeshes) scene.remove(m);
  debrisMeshes.length = 0;
}

function spawnDebris(at) {
  clearDebris();
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(debrisGeo, debrisMat);
    m.position.copy(at).add(new THREE.Vector3(
      (Math.random()-0.5)*22, (Math.random()-0.5)*12, (Math.random()-0.5)*22
    ));
    m.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
    m.userData.vel = new THREE.Vector3(
      (Math.random()-0.5)*120, 30+Math.random()*70, (Math.random()-0.5)*120
    );
    m.userData.av = new THREE.Vector3(
      (Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5
    );
    scene.add(m);
    debrisMeshes.push(m);
  }
}

function crash(reason) {
  if (!flightAlive) return;
  flightAlive = false;
  throttle01  = 0;
  spawnDebris(plane.position);
  plane.visible = false;
  elCrash.textContent = `⚠ Kaza: ${reason}. Piste dönmek için F tuşuna bas.`;
  elCrash.classList.add("visible");
}

function respawnAtNearestRunway() {
  if (flightAlive) return;
  let best=RUNWAYS[0], bestD=Infinity;
  for (const rw of RUNWAYS) {
    const d = Math.hypot(plane.position.x-rw.cx, plane.position.z-rw.cz);
    if (d < bestD) { bestD=d; best=rw; }
  }
  if (!best) return;
  clearDebris();
  flightAlive = true;
  plane.visible = true;
  const terr = terrainHeight(best.cx, best.cz);
  const startAlong = -best.halfL*0.55;
  plane.position.set(
    best.cx + Math.sin(best.yaw)*startAlong,
    Math.max(terr, GROUND_Y) + 300,
    best.cz + Math.cos(best.yaw)*startAlong
  );
  plane.rotation.set(0, best.yaw, 0);
  velocity.set(Math.sin(best.yaw)*150, 0, -Math.cos(best.yaw)*150);
  throttle01 = 0.50; gSmooth = 1; structuralStress = 0;
  respawnGrace = 5.0;
  orbitTheta = 0.6; orbitPhi = Math.PI*0.36; orbitRadius = 145;
  elCrash.classList.remove("visible");
}

// ─────────────────────────────────────────────
//  FLIGHT PHYSICS  (high-fidelity 6-DOF model)
// ─────────────────────────────────────────────
function updateFlight(dt) {
  if (!flightAlive) {
    for (const m of debrisMeshes) {
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.vel.y -= GRAVITY*dt;
      m.rotation.x += m.userData.av.x*dt;
      m.rotation.y += m.userData.av.y*dt;
      m.rotation.z += m.userData.av.z*dt;
    }
    return;
  }

  const alt = plane.position.y - GROUND_Y;
  const rho = airDensity(alt);
  const sos = speedOfSound(alt);

  // ── Throttle & Thrust ──────────────────────
  const throttleRate = 0.22;
  if (keys.w) throttle01 = Math.min(1, throttle01 + throttleRate*dt);
  if (keys.s) throttle01 = Math.max(0, throttle01 - throttleRate*0.85*dt);

  // AB kicks in above 85% throttle
  const abOn = throttle01 > 0.85;
  const thrustN = abOn
    ? THREE.MathUtils.lerp(THRUST_MAX_DRY, THRUST_MAX_AB, (throttle01-0.85)/0.15)
    : THREE.MathUtils.lerp(THRUST_MIN, THRUST_MAX_DRY, throttle01/0.85);

  // ── Control inputs → angular rates ────────
  // Pitch: Arrow keys
  // Roll: Q/E or A/D (A/D also yaw)
  // Yaw: coupled with roll (adverse/proverse yaw)
  const pitchCmd = (keys.ArrowUp   ? 1:0) - (keys.ArrowDown ? 1:0);
  // Pure roll keys (Q/E) accumulate actual barrel roll
  const pureRollCmd = (keys.e ? 1:0) - (keys.q ? 1:0);
  const yawCmd      = (keys.d ? 1:0) - (keys.a ? 1:0);

  // Control effectiveness scales with dynamic pressure (q)
  const spd = velocity.length();
  machNumber = spd / sos;
  dynPressurePa = 0.5 * rho * spd * spd;
  const qNorm = Math.min(1.0, dynPressurePa / 40000); // effectiveness ramp

  // Apply rotations
  plane.rotation.x += pitchCmd * PITCH_RATE * qNorm * dt;
  const maxPitch = Math.PI/2 - 0.04;
  plane.rotation.x = THREE.MathUtils.clamp(plane.rotation.x, -maxPitch, maxPitch);

  // Roll
  rollAngle += pureRollCmd * ROLL_RATE * qNorm * dt;
  
  // A/D add temporary visual bank, Q/E add permanent roll angle
  const visualBank = yawCmd * 1.1 * qNorm; 
  plane.rotation.z = THREE.MathUtils.lerp(
    plane.rotation.z,
    -rollAngle - visualBank,
    1 - Math.exp(-4 * dt)
  );

  // Yaw with adverse yaw coupling (realistic)
  const adverseYaw = -pureRollCmd * 0.15 * qNorm;
  plane.rotation.y += (yawCmd * YAW_RATE + adverseYaw) * qNorm * dt;

  // ── Aerodynamic force calculation ─────────
  plane.getWorldDirection(tmpFwd);
  noseDir.copy(tmpFwd).negate();        // aircraft forward = -Z in local space
  upDir.set(0,1,0).applyQuaternion(plane.quaternion); // aircraft up vector

  prevVel.copy(velocity);

  // Relative wind = velocity - ambient wind
  relWind.copy(velocity).sub(WIND);
  const V = relWind.length();

  if (V > 0.05) relN.copy(relWind).divideScalar(V);
  else relN.set(0,0,0);

  // Angle of Attack
  let aoa = 0;
  if (V > 1) {
    const cosA = THREE.MathUtils.clamp(noseDir.dot(relN), -1, 1);
    aoa = Math.acos(cosA);
    // Post-stall lift degradation
    if (aoa > AOA_STALL_RAD) {
      aoa = AOA_STALL_RAD + (aoa - AOA_STALL_RAD) * 0.08;
    }
  }
  aoaDeg = aoa * 180 / Math.PI;

  // Sideslip angle (for lateral forces & rudder effectiveness)
  const rightDir = new THREE.Vector3().crossVectors(noseDir, upDir).normalize();
  const sideslip = V > 1 ? relN.dot(rightDir) : 0;

  // CL (lift coefficient) — based on AoA
  const stallFactor = THREE.MathUtils.smoothstep(V, 28, 55); // stall below 28 m/s
  const CL = Math.min(CL_MAX, CL_ALPHA * Math.sin(aoa * 2)) * stallFactor;

  // CD (drag coefficient) — polar equation: CD = CD0 + K*CL²
  const CD = CD0
    + K_IND * CL * CL
    + 0.08 * Math.abs(sideslip)           // sideslip drag
    + (machNumber > 0.95 ? (machNumber-0.95)*0.8 : 0) // wave drag transonic
    + (keys.s ? 0.12 : 0);                // airbrake drag

  const q     = dynPressurePa;
  const liftN = CL * q * WING_AREA;
  const dragN = CD * q * WING_AREA;

  accel.set(0,0,0);

  // Thrust along nose direction
  accel.addScaledVector(noseDir, thrustN / AIRCRAFT_MASS);

  // Gravity
  accel.y -= GRAVITY;

  if (V > 0.4) {
    // Drag — opposing relative wind
    accel.addScaledVector(relN, -dragN / AIRCRAFT_MASS);

    // Lift — perpendicular to relative wind, in the plane's up-plane
    sideDir.crossVectors(noseDir, relN);
    if (sideDir.lengthSq() > 1e-10) {
      sideDir.normalize();
      liftDir.crossVectors(relN, sideDir).normalize();
      accel.addScaledVector(liftDir, liftN / AIRCRAFT_MASS);
    }

    // Sideslip restoring force (dihedral effect)
    accel.addScaledVector(rightDir, -sideslip * SIDESLIP_DAMP);
  }

  velocity.addScaledVector(accel, dt);

  // Speed of sound dependent max (no hard cap — drag naturally limits)
  // But cap at ~Mach 2.25 (F-22 Vmax)
  const spdMax = 2.25 * sos;
  const spdNow = velocity.length();
  if (spdNow > spdMax) velocity.multiplyScalar(spdMax / spdNow);

  plane.position.addScaledVector(velocity, dt);

  // ── G-force computation ───────────────────
  tmpA.copy(velocity).sub(prevVel).divideScalar(Math.max(dt, 1e-4));
  const gInst = tmpA.length() / GRAVITY;
  gSmooth = THREE.MathUtils.lerp(gSmooth, gInst, 1 - Math.exp(-10*dt));

  // ── Collision detection ───────────────────
  if (respawnGrace > 0) { respawnGrace -= dt; }

  const px=plane.position.x, py=plane.position.y, pz=plane.position.z;
  const tH = terrainHeight(px, pz);
  const onRw = pointOnRunway(px, py, pz);

  if (respawnGrace <= 0) {
    if (!onRw && py < tH + PLANE_CLEARANCE) { crash("Arazi çarpışması"); return; }
    if (boxHit(px, py, pz)) { crash("Bina çarpışması"); return; }
  }

  // ── Structural stress model ───────────────
  let stressIn = 0;
  if (gInst > G_STRESS_HARD)       stressIn += (gInst-G_STRESS_HARD)*STRESS_BUILD_H;
  else if (gInst > G_STRESS_SOFT)  stressIn += (gInst-G_STRESS_SOFT)*STRESS_BUILD_S;

  const qN = dynPressurePa/Q_LIMIT_PA;
  const aN = aoaDeg/Math.max(AOA_BREAK_DEG,1);
  if (qN > 0.8 && aN > 0.8) stressIn += (qN-0.8)*(aN-0.8)*180;
  if (dynPressurePa > Q_LIMIT_PA*1.05)
    stressIn += ((dynPressurePa-Q_LIMIT_PA*1.05)/(Q_LIMIT_PA*0.4))*16;

  const safeAero = gInst < 9.0 && dynPressurePa < Q_LIMIT_PA*0.65 && aoaDeg < 28;
  if (safeAero) structuralStress -= STRESS_DECAY*dt;
  else if (stressIn < 0.4 && gInst < G_STRESS_SOFT) structuralStress -= STRESS_DECAY*0.4*dt;
  structuralStress += stressIn*dt;
  structuralStress = THREE.MathUtils.clamp(structuralStress, 0, 100);

  if (structuralStress >= 99.5) { crash("Yapısal hasar — G/basınç/AoA aşımı"); return; }

  // Landing gear / runway ground contact
  if (onRw && py < tH+5) {
    plane.position.y = tH+6;
    if (velocity.y < -4) velocity.y *= -0.15;
    velocity.x *= 0.97; velocity.z *= 0.97; // rolling friction
  }

  // ── Control surface animations ────────────
  const ud = plane.userData;
  const now = performance.now()*0.001;
  const lr = 1 - Math.exp(-10*dt);

  if (ud.ctrl) {
    const pitchDef = pitchCmd * 0.42 + (rollAngle % (Math.PI*2)) * 0.10;
    const rollDiff  = pureRollCmd * 0.30 + yawCmd * 0.15;
    ud.ctrl.stabL.children[0].rotation.x = THREE.MathUtils.lerp(
      ud.ctrl.stabL.children[0].rotation.x, Math.PI/2 - (pitchDef + rollDiff), lr
    );
    ud.ctrl.stabR.children[0].rotation.x = THREE.MathUtils.lerp(
      ud.ctrl.stabR.children[0].rotation.x, Math.PI/2 - (pitchDef - rollDiff), lr
    );
  }

  // ── Radar & Targeting ─────────────────────
  if (keys.z) {
     detectedTargets = [];
     let closestDist = 2000; // Scaled to 2000 to represent "200m" effectively in game space
     activeTarget = null;
     for(const p of aiPlanes) {
        if(!p.visible) continue;
        const d = plane.position.distanceTo(p.position);
        if (d < 2000) {
           detectedTargets.push(p);
           if (d < closestDist) {
               closestDist = d;
               activeTarget = p;
           }
        }
     }
     keys.z = false; // fire once per press
  }

  // Update reticles
  for(const p of aiPlanes) {
     const ret = p.children.find(c => c.name === "reticle");
     if(ret) {
         if (!p.visible) { ret.material.opacity = 0; }
         else if (p === activeTarget) { ret.material.color.setHex(0xff0000); ret.material.opacity = 1; }
         else if (detectedTargets.includes(p)) { ret.material.color.setHex(0x00ff00); ret.material.opacity = 1; }
         else { ret.material.opacity = 0; }
     }
  }

  // ── Missiles Firing ───────────────────────
  if (keys.x) {
     if (activeTarget && activeTarget.visible) {
         const m = new THREE.Mesh(missileGeo, missileMat);
         m.position.copy(plane.position);
         m.position.y -= 5;
         m.quaternion.copy(plane.quaternion);
         
         const flameGeo = new THREE.CylinderGeometry(0.3, 0.1, 3, 8);
         flameGeo.rotateX(Math.PI/2);
         flameGeo.translate(0,0,3);
         const flameMat = new THREE.MeshBasicMaterial({color:0xffaa00, blending:THREE.AdditiveBlending});
         m.add(new THREE.Mesh(flameGeo, flameMat));
         
         m.userData = { target: activeTarget, speed: velocity.length() + 300, alive: true };
         scene.add(m);
         activeMissiles.push(m);
     }
     keys.x = false;
  }

  // Update flying missiles
  for (let i = activeMissiles.length -1; i>=0; i--) {
      const m = activeMissiles[i];
      if (!m.userData.alive) continue;
      
      const t = m.userData.target;
      if (!t.visible) { m.visible = false; m.userData.alive = false; continue; }
      
      const dir = new THREE.Vector3().subVectors(t.position, m.position).normalize();
      const targetQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1), dir);
      m.quaternion.slerp(targetQ, 3.0 * dt);
      
      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(m.quaternion);
      m.position.addScaledVector(fwd, m.userData.speed * dt); 
      
      if (m.position.distanceTo(t.position) < 30) {
         t.visible = false;
         spawnDebris(t.position);
         m.visible = false;
         m.userData.alive = false;
         if (t === activeTarget) activeTarget = null;
      }
  }

  // ── Engine effects ────────────────────────
  const heat = throttle01 * throttle01;
  const abBoost = abOn ? 0.7 : 0.0;
  
  if (ud.flame) {
    if (heat < 0.1) {
       ud.flame.visible = false;
    } else {
       ud.flame.visible = true;
       // Pulsate fire
       const flick = 0.9 + 0.1 * Math.sin(now * 50);
       const lengthScale = (heat * 0.8 + abBoost * 1.5) * flick;
       ud.flame.scale.set(1.0 + abBoost*0.2, 1.0 + abBoost*0.2, lengthScale);
       ud.flame.children[0].material.opacity = (0.4 + abBoost * 0.4) * flick;
       ud.flame.children[1].material.opacity = (0.6 + abBoost * 0.4) * flick;
    }
  }

  // ── Vapor cone effect ─────────────────────

  const vaporG = Math.max(0, gSmooth-4.5);
  const vaporV = THREE.MathUtils.smoothstep(spd, 50, 140);
  const pitching = (keys.ArrowUp||keys.ArrowDown) ? 1:0;
  const vaporA = Math.min(0.65,
    vaporG*0.12*vaporV
    + pitching*0.12*vaporV
    + Math.max(0,aoaDeg-7)*0.010*vaporV
    + (machNumber>0.92 ? (machNumber-0.92)*0.4*vaporV : 0)
  );
  if (ud.vapor) {
    ud.vapor.forEach(m => {
      m.material.opacity = vaporA*(0.80+0.20*Math.sin(now*5.2));
    });
  }

  // ── Dynamic sky color with altitude ───────
  const t_alt = THREE.MathUtils.clamp(alt/12000, 0, 1);
  const skyColor = new THREE.Color().lerpColors(
    new THREE.Color(0x7bbce8),  // low alt: lighter blue
    new THREE.Color(0x0a1a3a),  // high alt: dark space blue
    t_alt*t_alt
  );
  scene.background = skyColor;
  scene.fog.color.copy(skyColor).lerp(new THREE.Color(0xaaccee), 0.4);
  
  // ── Update AI Planes ──────────────────────
  const aiSpeed = 220;
  for (const p of aiPlanes) {
    const d = p.position.distanceTo(p.userData.targetPos);
    if (d < 400) {
      p.userData.targetPos.set((Math.random()-0.5)*30000, 200 + Math.random()*3000, (Math.random()-0.5)*30000);
    }
    
    // Direction vector to target
    const dir = new THREE.Vector3().subVectors(p.userData.targetPos, p.position).normalize();
    const targetQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1), dir);
    
    // Smooth rotation towards target
    p.quaternion.slerp(targetQ, 0.8 * dt);
    
    // Move forward locally
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(p.quaternion);
    p.position.addScaledVector(fwd, aiSpeed * dt);
    
    // AI engine flame effect
    if (p.userData.flame) {
       p.userData.flame.visible = true;
       p.userData.flame.scale.set(1.1, 1.1, 1.2 + 0.2*Math.random());
       p.userData.flame.children[0].material.opacity = 0.5;
       p.userData.flame.children[1].material.opacity = 0.8;
       // Make them red for enemy vibe or normal for friend
    }
  }
}

// ─────────────────────────────────────────────
//  CAMERA
// ─────────────────────────────────────────────
function updateCamera(dt) {
  const target = plane.position;
  camOffset.set(
    orbitRadius * Math.sin(orbitPhi)*Math.sin(orbitTheta),
    orbitRadius * Math.cos(orbitPhi),
    orbitRadius * Math.sin(orbitPhi)*Math.cos(orbitTheta)
  );
  camPos.copy(target).add(camOffset);
  camera.position.lerp(camPos, 1-Math.exp(-7*dt));
  camera.lookAt(target);
}

// ─────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────
function hud() {
  if (!flightAlive) {
    elGWarn.classList.remove("visible");
    elSpeed.textContent = "—";
    elStress.textContent = "—";
    if (elMach) elMach.textContent = "—";
    return;
  }

  elStress.textContent = Math.round(structuralStress);
  if (elMach) elMach.textContent = machNumber.toFixed(2);
  if (elThrottle) elThrottle.textContent = Math.round(throttle01*100);
  if (elRoll) elRoll.textContent = Math.round(rollAngle * 180 / Math.PI % 360);

  if (gSmooth > G_WARN || structuralStress > 62) {
    const parts = [];
    if (gSmooth > G_WARN) parts.push(`G ${gSmooth.toFixed(1)}`);
    if (structuralStress > 62) parts.push(`Yapı %${Math.round(structuralStress)}`);
    elGWarn.textContent = `⚠ UYARI — ${parts.join(" · ")}`;
    elGWarn.classList.add("visible");
  } else {
    elGWarn.classList.remove("visible");
    elGWarn.textContent = "";
  }

  const spd = velocity.length();
  elSpeed.textContent   = Math.round(spd*3.6);
  elAlt.textContent     = Math.round(plane.position.y - GROUND_Y);
  elPitch.textContent   = Math.round(-plane.rotation.x*180/Math.PI);
  let h = -plane.rotation.y*180/Math.PI;
  while(h<0) h+=360; while(h>=360) h-=360;
  elHeading.textContent = Math.round(h);
  elG.textContent       = gSmooth.toFixed(1);
  elAoA.textContent     = Math.round(aoaDeg);
  elDynPress.textContent= Math.round(dynPressurePa/1000);
  const w = WIND.length();
  elWind.textContent    = `${Math.round(w*3.6)} @ ${Math.round((Math.atan2(WIND.x,WIND.z)*180/Math.PI+180))}°`;
}

// ─────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateFlight(dt);
  updateCamera(dt);
  hud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

tick();
