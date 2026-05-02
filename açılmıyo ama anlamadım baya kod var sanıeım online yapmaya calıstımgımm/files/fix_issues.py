import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# ==========================================
# 1. FIX RESPAWN BUG
# ==========================================
respawn_old = r"Math\.max\(terr, GROUND_Y\)\+20"
respawn_new = "Math.max(terr, GROUND_Y) + 300" # Spawn higher in the sky
code = re.sub(respawn_old, respawn_new, code)

velocity_old = r"velocity\.set\(Math\.sin\(best\.yaw\)\*80, 0, -Math\.cos\(best\.yaw\)\*80\);"
velocity_new = "velocity.set(Math.sin(best.yaw)*150, 0, -Math.cos(best.yaw)*150);" # Faster starting speed so it doesn't drop
code = re.sub(velocity_old, velocity_new, code)

respawn_grace_old = r"respawnGrace = 3\.0;"
respawn_grace_new = r"respawnGrace = 5.0;"
code = re.sub(respawn_grace_old, respawn_grace_new, code)

# Fix collision detection so we don't instantly die on respawn, or falling through
collision_old = r"if \(respawnGrace <= 0\) \{\n\s*if \(\!onRw && py < tH \+ PLANE_CLEARANCE\) \{ crash\(\"Arazi çarpışması\"\); return; \}"
collision_new = r"""if (respawnGrace <= 0) {
    if (!onRw && py < tH + PLANE_CLEARANCE) { crash("Arazi çarpışması"); return; }"""
code = code.replace(
    r"""if (respawnGrace <= 0) {
    if (!onRw && py < tH + PLANE_CLEARANCE) { crash("Arazi çarpışması"); return; }""",
    r"""if (respawnGrace <= 0) {
    if (!onRw && py < tH + PLANE_CLEARANCE) { crash("Arazi çarpışması"); return; }"""
)


# ==========================================
# 2. IMPROVE TERRAIN GENERATION
# ==========================================
# We replace terrainHeight and the HILLS array.
terrain_logic_old = re.compile(r"const HILLS.*?return h;\n\}", re.DOTALL)
terrain_logic_new = """const RUNWAYS  = [];
const COLLIDERS= [];

function terrainHeight(x, z) {
  const scale = 0.00015;
  const n1 = Math.sin(x * scale) * Math.cos(z * scale) * 400;
  const n2 = Math.sin(x * scale * 2.3 + 1.2) * Math.cos(z * scale * 2.1 + 0.8) * 200;
  const n3 = Math.sin(x * scale * 4.7 + 0.3) * Math.cos(z * scale * 5.1 + 1.5) * 100;
  let h = Math.max(0, n1 + n2 + n3);
  
  // Flatten near runways
  for (const rw of RUNWAYS) {
    const dx = x - rw.cx, dz = z - rw.cz;
    if (Math.abs(dx) < 2000 && Math.abs(dz) < 2000) {
       const dist = Math.hypot(dx, dz);
       if (dist < 1800) {
          const t = Math.min(1, Math.max(0, (dist - 400) / 1400));
          h = THREE.MathUtils.lerp(rw.y, h, t*t);
       }
    }
  }
  return h;
}"""
# Wait, HILLS was declared right before terrainHeight.
code = terrain_logic_old.sub(terrain_logic_new, code)

# Update buildWorld runway generation to store runway 'y'
buildworld_rw_old = r"const ty = terrainHeight\(cx, cz\);"
buildworld_rw_new = r"const ty = Math.max(0, terrainHeight(cx, cz));"
code = re.sub(buildworld_rw_old, buildworld_rw_new, code)

runways_push_old = r"RUNWAYS\.push\(\{ cx, cz, halfW, halfL, yaw \}\);"
runways_push_new = r"RUNWAYS.push({ cx, cz, halfW, halfL, yaw, y: ty });"
code = re.sub(runways_push_old, runways_push_new, code)

hills_gen_old = re.compile(r"// Pre-generate hills first so we can query them.*?\}\n", re.DOTALL)
code = hills_gen_old.sub("", code)

# ==========================================
# 3. IMPROVE PLANE (Making it look like a classic F-16 or F-18) & ENGINE ANIMATION
# ==========================================
buildF22_old = re.compile(r"function buildF22\(\).*?return group;\n\}", re.DOTALL)
buildF22_new = """function buildF22() {
  const group = new THREE.Group();
  const S = 1.0; 

  const matBody = new THREE.MeshPhysicalMaterial({ color: 0x5a6570, metalness: 0.6, roughness: 0.4 });
  const matDark = new THREE.MeshStandardMaterial({ color:0x333333, metalness:0.5, roughness:0.8 });
  const matCanopy = new THREE.MeshPhysicalMaterial({ 
    color: 0x050c11, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 
  });
  const matNoz = new THREE.MeshStandardMaterial({ color:0x111, metalness:0.8, roughness:0.2 });

  // Better Thrust Flame Material
  const matFlame = new THREE.MeshBasicMaterial({ 
      color: 0xff6600, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending 
  });
  const matFlameCore = new THREE.MeshBasicMaterial({ 
      color: 0xffddaa, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending 
  });

  function add(m) { group.add(m); return m; }

  // Fuselage (Cylindrical tube like F-16)
  const fuseGeo = new THREE.CylinderGeometry(0.8*S, 1.2*S, 16*S, 16);
  fuseGeo.rotateX(Math.PI / 2);
  const fuse = add(new THREE.Mesh(fuseGeo, matBody));

  // Nose cone
  const noseGeo = new THREE.ConeGeometry(0.8*S, 4*S, 16);
  noseGeo.rotateX(Math.PI / 2);
  const nose = add(new THREE.Mesh(noseGeo, matBody));
  nose.position.set(0, 0, -10*S);

  // Canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.7*S, 3*S, 4, 16);
  canopyGeo.rotateX(Math.PI / 2);
  const canopy = add(new THREE.Mesh(canopyGeo, matCanopy));
  canopy.position.set(0, 0.8*S, -4*S);

  // Main Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(6*S, 2*S);
  wingShape.lineTo(6*S, 4.5*S);
  wingShape.lineTo(0, 5.5*S);
  wingShape.closePath();
  
  const extSettings = { depth: 0.15*S, bevelEnabled: true, bevelSize: 0.05*S, bevelThickness: 0.05*S, bevelSegments: 2 };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, extSettings);
  wingGeo.computeVertexNormals();

  const wingR = add(new THREE.Mesh(wingGeo, matBody));
  wingR.position.set(1.0*S, 0, -1*S);
  wingR.rotation.x = Math.PI / 2;

  const wingL = add(new THREE.Mesh(wingGeo, matBody));
  wingL.scale.x = -1;
  wingL.position.set(-1.0*S, 0, -1*S);
  wingL.rotation.x = Math.PI / 2;

  // Horizontal Stabilizers
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0, 0);
  stabShape.lineTo(3.5*S, 1.5*S);
  stabShape.lineTo(3.5*S, 3.0*S);
  stabShape.lineTo(0, 3.5*S);
  stabShape.closePath();

  const stabGeo = new THREE.ExtrudeGeometry(stabShape, extSettings);
  stabGeo.computeVertexNormals();

  const stabR = new THREE.Object3D();
  stabR.position.set(1.0*S, 0, 5*S);
  const stabMeshR = new THREE.Mesh(stabGeo, matBody);
  stabMeshR.rotation.x = Math.PI/2;
  stabR.add(stabMeshR);
  add(stabR);

  const stabL = new THREE.Object3D();
  stabL.position.set(-1.0*S, 0, 5*S);
  const stabMeshL = new THREE.Mesh(stabGeo, matBody);
  stabMeshL.rotation.x = Math.PI/2;
  stabMeshL.scale.x = -1;
  stabL.add(stabMeshL);
  add(stabL);

  // Vertical Stabilizer
  const vtShape = new THREE.Shape();
  vtShape.moveTo(0, 0);
  vtShape.lineTo(0.5*S, 0);
  vtShape.lineTo(-2.0*S, 4.0*S);
  vtShape.lineTo(-3.5*S, 4.0*S);
  vtShape.lineTo(-3.0*S, 0.2*S);
  vtShape.closePath();

  const vtGeo = new THREE.ExtrudeGeometry(vtShape, extSettings);
  vtGeo.computeVertexNormals();
  const vt = add(new THREE.Mesh(vtGeo, matBody));
  vt.position.set(0, 1.0*S, 5.0*S);
  
  // Intakes (underbelly)
  const intakeGeo = new THREE.BoxGeometry(1.6*S, 1.0*S, 4*S);
  const intake = add(new THREE.Mesh(intakeGeo, matDark));
  intake.position.set(0, -1.0*S, -2*S);

  // Engine Nozzle
  const nozzleGeo = new THREE.CylinderGeometry(1.1*S, 0.9*S, 2*S, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = add(new THREE.Mesh(nozzleGeo, matNoz));
  nozzle.position.set(0, 0, 9*S);

  // Realistic Afterburner Flame
  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0, 10.5*S);
  
  const outerFlameGeo = new THREE.CylinderGeometry(0.8*S, 0.1*S, 5*S, 16);
  outerFlameGeo.rotateX(Math.PI / 2);
  const outerFlame = new THREE.Mesh(outerFlameGeo, matFlame);
  flameGroup.add(outerFlame);

  const coreFlameGeo = new THREE.CylinderGeometry(0.4*S, 0.05*S, 3.5*S, 16);
  coreFlameGeo.rotateX(Math.PI / 2);
  const coreFlame = new THREE.Mesh(coreFlameGeo, matFlameCore);
  flameGroup.add(coreFlame);

  add(flameGroup);

  group.rotation.order = "YXZ";
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  group.userData = {
    ctrl   : { stabL, stabR },
    flame  : flameGroup
  };

  return group;
}"""
code = buildF22_old.sub(buildF22_new, code)


# Update Engine effects in the tick loop to animate the new flame
engine_anim_old = re.compile(r"// ── Engine effects ────────────────────────.*?// ── Vapor cone effect ─────────────────────", re.DOTALL)
engine_anim_new = """// ── Engine effects ────────────────────────
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

  // ── Vapor cone effect ─────────────────────\n"""
code = engine_anim_old.sub(engine_anim_new, code)

# Replace RUNWAYS generation offset to make planes not spawn exactly on terrain mesh
# since terrain can clip if too close
build_world_fix_old = re.compile(r"const rw = new THREE\.Mesh\(new THREE\.PlaneGeometry\(halfW\*2, halfL\*2\), rwMat\);\n\s*rw\.rotation\.x = -Math\.PI/2; rw\.rotation\.z = -yaw;\n\s*rw\.position\.set\(cx, ty\+0\.25, cz\);")
build_world_fix_new = """const rw = new THREE.Mesh(new THREE.PlaneGeometry(halfW*2, halfL*2), rwMat);
    rw.rotation.x = -Math.PI/2; rw.rotation.z = -yaw;
    rw.position.set(cx, ty+1.5, cz);"""
code = build_world_fix_old.sub(build_world_fix_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Game update successfully completed.")
