import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update G-force limits
code = code.replace("const G_WARN         = 7.2;", "const G_WARN         = 9.5;")
code = code.replace("const G_STRESS_SOFT  = 7.8;", "const G_STRESS_SOFT  = 11.0;")
code = code.replace("const G_STRESS_HARD  = 9.0;", "const G_STRESS_HARD  = 14.0;")
code = code.replace("const STRESS_BUILD_S = 6;", "const STRESS_BUILD_S = 2;")
code = code.replace("const STRESS_BUILD_H = 22;", "const STRESS_BUILD_H = 6;")
# update safe aero limit
code = code.replace("gInst < 6.0 &&", "gInst < 9.0 &&")

# 2. Update Roll / Yaw logic
roll_logic_old = re.compile(r"  const rollCmd  = \(keys\.e \? 1:0\) - \(keys\.q \? 1:0\)\n                 \+ \(keys\.d \? 0\.5:0\) - \(keys\.a \? 0\.5:0\);  // A/D partially rolls\n  const yawCmd   = \(keys\.d \? 1:0\) - \(keys\.a \? 1:0\);.*?plane\.rotation\.z = THREE\.MathUtils\.lerp\(\n    plane\.rotation\.z,\n    -rollAngle \* 0\.9,\n    1 - Math\.exp\(-4 \* dt\)\n  \);", re.DOTALL)

roll_logic_new = """  // Pure roll keys (Q/E) accumulate actual barrel roll
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
  );"""

code = roll_logic_old.sub(roll_logic_new, code)

# 3. Reduce vapor cone sensitivity as well to match new G limits
vapor_old = re.compile(r"const vaporG = Math\.max\(0, gSmooth-2\.0\);")
vapor_new = r"const vaporG = Math.max(0, gSmooth-4.5);"
code = vapor_old.sub(vapor_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("G-force limits and roll logic updated.")
