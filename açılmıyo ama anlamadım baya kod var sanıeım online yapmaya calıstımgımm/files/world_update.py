import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"

with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

# Replace ground material
gmat_regex = re.compile(r"const gMat = new THREE\.MeshStandardMaterial\(\{(.*?)\}\);", re.DOTALL)
gmat_new = r"const gMat = new THREE.MeshStandardMaterial({\1});\n  // Add detail to terrain\n  gMat.flatShading = true;" # Actually, let's keep it smooth but adjust roughness.
code = gmat_regex.sub(r"const gMat = new THREE.MeshStandardMaterial({\n    vertexColors: true, metalness: 0.1, roughness: 0.8, flatShading: false\n  });", code)

# Replace water material
water_regex = re.compile(r"const waterMat = new THREE\.MeshStandardMaterial\(\{.*?\}\);", re.DOTALL)
water_new   = """const waterMat = new THREE.MeshPhysicalMaterial({
    color:0x113355, 
    metalness:0.9, 
    roughness:0.1, 
    transparent:true, 
    opacity:0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });"""
code = water_regex.sub(water_new, code)

# Replace skybox and fog
sky_regex = re.compile(r"scene\.background = new THREE\.Color\(0x4a90d9\);\n\n// Layered fog — realistic atmospheric depth\nscene\.fog = new THREE\.FogExp2\(0x9bbde0, 0\.000038\);", re.DOTALL)
sky_new = """scene.background = new THREE.Color(0x3a7ab9); // richer sky
scene.fog = new THREE.FogExp2(0x8abce0, 0.000030); // less dense fog for better visibility"""
code = sky_regex.sub(sky_new, code)

# Replace Hemisphere light
hemi_regex = re.compile(r"const hemi = new THREE\.HemisphereLight\(0x7ec8ff, 0x3a5c32, 0\.75\);")
hemi_new = """const hemi = new THREE.HemisphereLight(0x9fd8ff, 0x4a6c42, 0.85);"""
code = hemi_regex.sub(hemi_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("World update script completed.")
