import re

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"
with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

buildF22_old = re.compile(r"function buildF22\(\).*?return group;\n\}", re.DOTALL)
buildF22_new = """function buildF22() {
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
  vtShape.lineTo(0.5*S, 0);
  vtShape.lineTo(-2.5*S, 4.5*S);
  vtShape.lineTo(-4.0*S, 4.0*S);
  vtShape.lineTo(-3.5*S, 0.2*S);
  vtShape.closePath();

  const vtGeo = new THREE.ExtrudeGeometry(vtShape, extSettings);
  vtGeo.computeVertexNormals();
  const vt = add(new THREE.Mesh(vtGeo, matBody));
  vt.position.set(0, 1.0*S, 5.5*S);
  
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

  group.userData = {
    ctrl   : { stabL, stabR },
    flame  : flameGroup
  };

  return group;
}"""

code = buildF22_old.sub(buildF22_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Plane v2 patch completed.")
