import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Remove the old offline AI planes completely.
ai_spawn_old = re.compile(r"// Spawn AI Planes\nconst aiPlanes = \[\];\nfor \(let i = 0; i < 15; i\+\+\) \{.*?aiPlanes\.push\(aiPlane\);\n\}", re.DOTALL)
code = ai_spawn_old.sub("", code)

ai_update_old = re.compile(r"// ── Update AI Planes ──────────────────────\n  const aiSpeed = 220;\n  for \(const p of aiPlanes\) \{.*?\n  \}", re.DOTALL)
code = ai_update_old.sub("", code)

# 2. Add Networking Socket globals
net_globals = """
// ── MULTIPLAYER NETWORKING ──────────────────
let myPlayerId = null;
const otherPlayers = {}; // id -> Mesh
const socket = new WebSocket("ws://" + location.hostname + ":8765");

socket.addEventListener("open", () => {
    console.log("Sunucuya bağlandı!");
});

socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === "init") {
        myPlayerId = data.id;
    } 
    else if (data.type === "state") {
        let op = otherPlayers[data.id];
        if (!op) {
            // Spawn new remote player
            op = buildF22();
            scene.add(op);
            otherPlayers[data.id] = op;
            op.userData.targetPos = new THREE.Vector3();
            op.userData.targetQuat = new THREE.Quaternion();
            op.userData.engineHeat = 0;
            // Reticle is inside buildF22
        }
        // Save network target data
        op.userData.targetPos.fromArray(data.state.pos);
        op.userData.targetQuat.fromArray(data.state.quat);
        op.userData.engineHeat = data.state.heat;
    }
    else if (data.type === "leave" || data.type === "die") {
        let op = otherPlayers[data.id];
        if (op) {
            scene.remove(op);
            if (data.type === "die") spawnDebris(op.position, true); // large explosion effect
            delete otherPlayers[data.id];
            
            // clear radar lock if tracking
            if (activeTarget === op) activeTarget = null;
            detectedTargets = detectedTargets.filter(t => t !== op);
        }
    }
    else if (data.type === "fire") {
        let op = otherPlayers[data.id];
        if (op) {
            // Spawn visual missile coming from them straight ahead
            const m = new THREE.Mesh(missileGeo, missileMat);
            m.position.copy(op.position);
            m.position.y -= 5;
            m.quaternion.copy(op.quaternion);
            
            const flameGeo = new THREE.CylinderGeometry(0.3, 0.1, 3, 8);
            flameGeo.rotateX(Math.PI/2);
            flameGeo.translate(0,0,3);
            const flameMat = new THREE.MeshBasicMaterial({color:0xffaa00, blending:THREE.AdditiveBlending});
            m.add(new THREE.Mesh(flameGeo, flameMat));
            
            // Dumb unguided missile straight ahead
            m.userData = { isDumb: true, speed: 600, alive: true };
            scene.add(m);
            activeMissiles.push(m);
        }
    }
});
"""

code = code.replace("// ─────────────────────────────────────────────\n//  FLIGHT PHYSICS", net_globals + "\n// ─────────────────────────────────────────────\n//  FLIGHT PHYSICS")

# 3. Handle interpolation of remote players in updateFlight instead of offline AI
interpolation_logic = """
  // ── Interpolate Remote Players ──────────────
  Object.values(otherPlayers).forEach(op => {
      // Smoothly move position and rotation
      op.position.lerp(op.userData.targetPos, 0.4);
      op.quaternion.slerp(op.userData.targetQuat, 0.4);
      
      if (op.userData.flame) {
          if (op.userData.engineHeat > 0.1) {
              op.userData.flame.visible = true;
              const flick = 0.9 + 0.1 * Math.sin(performance.now() * 0.05);
              const ls = op.userData.engineHeat * 2.0 * flick;
              op.userData.flame.scale.set(1.1, 1.1, ls);
              op.userData.flame.children[0].material.opacity = 0.5;
              op.userData.flame.children[1].material.opacity = 0.8;
          } else {
              op.userData.flame.visible = false;
          }
      }
  });

  // ── Send our network state ──────────────────
  if (socket.readyState === WebSocket.OPEN && flightAlive) {
      if (!window.netTimer) window.netTimer = 0;
      window.netTimer += dt;
      if (window.netTimer > 0.05) { // 20 times per second
          window.netTimer = 0;
          socket.send(JSON.stringify({
              type: "update",
              state: {
                  pos: plane.position.toArray(),
                  quat: plane.quaternion.toArray(),
                  heat: throttle01
              }
          }));
      }
  }
"""

# Inject interpolation right after `const t_alt = THREE.MathUtils.clamp... \n scene.fog...`
scene_fog = r"scene\.fog\.color\.copy\(skyColor\)\.lerp\(new THREE\.Color\(0xaaccee\), 0\.4\);"
code = code.replace(scene_fog, scene_fog + interpolation_logic)

# 4. Fix Target Radar to track actual players instead of AI
radar_old = re.compile(r"for\(const p of aiPlanes\) \{")
radar_new = r"for(const p of Object.values(otherPlayers)) {"
code = radar_old.sub(radar_new, code)

# 5. Fix Radar wireframe target updating
ret_old = re.compile(r"for\(const p of aiPlanes\) \{\n\s*const ret = p\.children\.find.*?\}")
ret_new = """for(const p of Object.values(otherPlayers)) {
     const ret = p.children.find(c => c.name === "reticle");
     if(ret) {
         if (!p.visible) { ret.material.opacity = 0; }
         else if (p === activeTarget) { ret.material.color.setHex(0xff0000); ret.material.opacity = 0.8; }
         else if (detectedTargets.includes(p)) { ret.material.color.setHex(0x00ff00); ret.material.opacity = 0.8; }
         else { ret.material.opacity = 0; }
     }
  }"""
code = ret_old.sub(ret_new, code)

# 6. Inform server when firing X missile
missile_fire_old = "scene.add(m);\n         activeMissiles.push(m);"
missile_fire_new = """scene.add(m);
         activeMissiles.push(m);
         if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type: "fire"}));"""
code = code.replace(missile_fire_old, missile_fire_new)

# 7. Add hit logic and sync deaths
hit_old = re.compile(r"t\.visible = false;\n\s*spawnDebris\(t\.position\);\n\s*m\.visible = false;\n\s*m\.userData\.alive = false;")
hit_new = """t.visible = false;
         spawnDebris(t.position);
         m.visible = false;
         m.userData.alive = false;
         // Note: If t === activeTarget, it is a remote player. Our client just calculates physical local hits.
         // If a remote player crashes physically into terrain, THEY will broadcast 'die'.
         // Here, our local missile hit THEM locally."""
code = hit_old.sub(hit_new, code)

missile_dumb_logic = """
      if (m.userData.isDumb) {
          const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(m.quaternion);
          m.position.addScaledVector(fwd, m.userData.speed * dt);
          if (flightAlive && m.position.distanceTo(plane.position) < 30) {
              crash("Düşman füzesi tarafından vuruldun!");
          }
          continue;
      }
"""
missile_loop = r"const t = m\.userData\.target;"
code = code.replace(missile_loop, missile_dumb_logic + "\n      " + missile_loop)

# 8. Broadcast death to server in crash()
crash_old = "flightAlive = false;"
crash_new = "flightAlive = false;\n  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type: 'die'}));"
code = code.replace(crash_old, crash_new)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Multiplayer socket logic injected into game.js")
