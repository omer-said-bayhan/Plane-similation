import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Flatten the terrain completely
terrainHeight_old = re.compile(r"function terrainHeight\(x, z\) \{.*?return h;\n\}", re.DOTALL)
terrainHeight_new = """function terrainHeight(x, z) {
  return 0; // Completely flat
}"""
code = terrainHeight_old.sub(terrainHeight_new, code)

# Fix the gradient in buildWorld so everything is flat green
gcol_old = re.compile(r"// Color gradient: deep green → rock → snow by altitude.*?col\[i\*3\]=r; col\[i\*3\+1\]=g; col\[i\*3\+2\]=b;", re.DOTALL)
gcol_new = """// Flat green terrain
    const r=0.18, g=0.30, b=0.14;
    col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b;"""
code = gcol_old.sub(gcol_new, code)

# 2. Add randomly flying AI planes identical to the player
# We'll spawn these planes after plane generation. Let's find: `const plane = buildF22();`
plane_init_old = re.compile(r"const plane = buildF22\(\);\nplane\.position\.set\(0, 550, 0\);\nscene\.add\(plane\);")
plane_init_new = """const plane = buildF22();
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
}"""
code = plane_init_old.sub(plane_init_new, code)

# Update AI planes in tick loop. Let's place it in `function updateFlight(dt)` at the end
update_old = re.compile(r"// ── Dynamic sky color with altitude ───────.*?scene\.fog\.color\.copy\(skyColor\)\.lerp\(new THREE\.Color\(0xaaccee\), 0\.4\);\n\}", re.DOTALL)
update_new = """// ── Dynamic sky color with altitude ───────
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
}"""
code = update_old.sub(update_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Patching complete for AI planes & flat terrain.")
