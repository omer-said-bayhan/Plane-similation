import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add z and x to keys
keys_old = re.compile(r"const keys = \{.*?\};")
keys_new = r"const keys = { w:false, s:false, a:false, d:false, ArrowUp:false, ArrowDown:false, q:false, e:false, z:false, x:false };"
code = keys_old.sub(keys_new, code)

# Fix keydown to handle debounce for z and x
keydown_old = re.compile(r"if \(k in keys\) \{ keys\[k\] = true; e\.preventDefault\(\); \}")
keydown_new = """if (k in keys) {
    if (k === 'z' || k === 'x') {
      if (!keys[k]) { keys[k] = true; } // edge detection handled in tick
    } else {
      keys[k] = true;
    }
    e.preventDefault();
  }"""
code = keydown_old.sub(keydown_new, code)

# 2. Add missiles and reticle to buildF22
buildF22_old = re.compile(r"group\.userData = \{")
buildF22_new = """  // 10. Under-wing missiles
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

  group.userData = {"""
code = buildF22_old.sub(buildF22_new, code)


# 3. Globals for radar and missiles
globals_insert = """let activeTarget = null;
let detectedTargets = [];
const activeMissiles = [];
const missileGeo = new THREE.CylinderGeometry(0.15*3.5, 0.15*3.5, 3*3.5, 8);
missileGeo.rotateX(Math.PI/2);
const missileMat = new THREE.MeshStandardMaterial({color:0xffffff, metalness:0.8, roughness:0.2});

// ─────────────────────────────────────────────
//  DEBRIS"""
code = code.replace("// ─────────────────────────────────────────────\n//  DEBRIS", globals_insert)


# 4. Weapons and Radar logic in updateFlight
anim_old = re.compile(r"  // ── Engine effects ────────────────────────")
anim_new = """  // ── Radar & Targeting ─────────────────────
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

  // ── Engine effects ────────────────────────"""
code = anim_old.sub(anim_new, code)


with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Targeting and weapons added.")
