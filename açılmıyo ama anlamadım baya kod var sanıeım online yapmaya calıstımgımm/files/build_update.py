import re
import os

target_file = r"c:\Users\HP\Desktop\ömer said\plane simulation\clude versiyon\files\game.js"

with open(target_file, "r", encoding="utf-8") as f:
    code = f.read()

new_f22 = """function buildF22() {
  const group = new THREE.Group();
  const S = 1.0; // scale unit

  // ── Materials ──────────────────────────────
  // Use MeshPhysicalMaterial for higher quality rendering
  const matBody = new THREE.MeshPhysicalMaterial({ 
    color: 0x4a5056, 
    metalness: 0.85, 
    roughness: 0.35,
    clearcoat: 0.1,
    clearcoatRoughness: 0.2
  });
  const matDark = new THREE.MeshStandardMaterial({ color:0x1c2024, metalness:0.7, roughness:0.6 });
  const matVentral = new THREE.MeshPhysicalMaterial({ color:0x7a8289, metalness:0.6, roughness:0.4 });
  const matCanopy = new THREE.MeshPhysicalMaterial({ 
    color: 0x11161a, 
    metalness: 1.0, 
    roughness: 0.05, 
    transparent: true, 
    opacity: 0.85,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.5
  });
  const matNoz = new THREE.MeshStandardMaterial({ color:0x0a0c0e, metalness:0.95, roughness:0.15, emissive:0xff3000, emissiveIntensity:0 });
  
  // Bloom glow proxy materials
  const matGlow = new THREE.MeshBasicMaterial({ color:0xff5500, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending });
  const matVapor = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide });
  const matRed = new THREE.MeshBasicMaterial({ color:0xff0000, blending:THREE.AdditiveBlending });
  const matGreen = new THREE.MeshBasicMaterial({ color:0x00ff88, blending:THREE.AdditiveBlending });

  function add(m) { group.add(m); return m; }

  // ── 1. FUSELAGE — Higher detail chined body ──────
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,  0.1, -20*S),  // Sleeker nose tip
    new THREE.Vector3(0,  0.2, -16*S),
    new THREE.Vector3(0,  0.68, -11*S), // Cockpit dome
    new THREE.Vector3(0,  0.65,  -5*S),
    new THREE.Vector3(0,  0.35,   3*S), 
    new THREE.Vector3(0,  0.15,  11*S),
    new THREE.Vector3(0, -0.05,  16*S), 
    new THREE.Vector3(0, -0.15,  19*S), 
  ]);

  const fuseShape = new THREE.Shape();
  fuseShape.moveTo(0, 1.1*S);
  fuseShape.lineTo(1.4*S, 0.6*S);
  fuseShape.lineTo(2.4*S, 0.2*S); // sharp chine
  fuseShape.lineTo(1.6*S, -0.6*S);
  fuseShape.lineTo(0.5*S, -0.9*S);
  fuseShape.lineTo(0, -1.0*S);
  fuseShape.lineTo(-0.5*S, -0.9*S);
  fuseShape.lineTo(-1.6*S, -0.6*S);
  fuseShape.lineTo(-2.4*S, 0.2*S);
  fuseShape.lineTo(-1.4*S, 0.6*S);
  fuseShape.closePath();

  const extSettings = {
    steps: 48, // Double the segments for smoothness
    bevelEnabled: false,
    extrudePath: path,
  };
  const fuseGeo = new THREE.ExtrudeGeometry(fuseShape, extSettings);
  fuseGeo.computeVertexNormals();
  const fuse = add(new THREE.Mesh(fuseGeo, matBody));
  fuse.rotation.y = Math.PI;

  // ── 2. DELTA WINGS (refine shape) ─
  const wingShapeR = new THREE.Shape();
  wingShapeR.moveTo(0, 0);
  wingShapeR.lineTo(0, -3.8*S);      // forward strake
  wingShapeR.lineTo(11.0*S, 2.5*S);  // wingtip LE
  wingShapeR.lineTo(10.7*S, 4.8*S);  // wingtip TE
  wingShapeR.lineTo(1.5*S, 8.0*S);   // wing root TE
  wingShapeR.closePath();

  const wingGeoR = new THREE.ExtrudeGeometry(wingShapeR, {
    depth: 0.16*S, bevelEnabled:true, bevelSize:0.15*S, bevelThickness:0.1*S, bevelSegments:4
  });
  const wingR = add(new THREE.Mesh(wingGeoR, matBody));
  wingR.position.set(1.9*S, -0.2*S, -5.5*S);
  wingR.rotation.x = Math.PI / 2;
  // slight anhedral
  wingR.rotation.y = -0.04;

  const wingL = wingR.clone();
  wingL.scale.x = -1;
  wingL.rotation.y = 0.04; // mirror anhedral
  add(wingL);

  // ── 3. HORIZONTAL STABILATORS ─
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0, 0);
  stabShape.lineTo(0, -1.8*S);
  stabShape.lineTo(6.2*S, 1.2*S);
  stabShape.lineTo(5.8*S, 3.5*S);
  stabShape.lineTo(0.8*S, 3.8*S);
  stabShape.closePath();

  const stabGeo = new THREE.ExtrudeGeometry(stabShape, {
    depth:0.1*S, bevelEnabled:true, bevelSize:0.1*S, bevelThickness:0.06*S, bevelSegments:3
  });

  const stabR = new THREE.Object3D();
  stabR.position.set(1.6*S, -0.4*S, 8.8*S);
  const stabMeshR = new THREE.Mesh(stabGeo, matBody);
  stabMeshR.rotation.x = Math.PI/2;
  stabMeshR.rotation.y = -0.05; // slight anhedral down
  stabR.add(stabMeshR);
  add(stabR);

  const stabL = new THREE.Object3D();
  stabL.position.set(-1.6*S, -0.4*S, 8.8*S);
  const stabMeshL = new THREE.Mesh(stabGeo, matBody);
  stabMeshL.rotation.x = Math.PI/2;
  stabMeshL.scale.x = -1;
  stabMeshL.rotation.y = 0.05;
  stabL.add(stabMeshL);
  add(stabL);

  // ── 4. CANTED VERTICAL TAILS ─
  const vtShape = new THREE.Shape();
  vtShape.moveTo(0, 0);
  vtShape.lineTo(1.0*S, 0);
  vtShape.lineTo(-1.8*S, 6.0*S);
  vtShape.lineTo(-3.6*S, 5.8*S);
  vtShape.lineTo(-3.0*S, 0.2*S);
  vtShape.closePath();

  const vtGeo = new THREE.ExtrudeGeometry(vtShape, {
    depth:0.12*S, bevelEnabled:true, bevelSize:0.08*S, bevelThickness:0.06*S, bevelSegments:3
  });

  for (let si = -1; si <= 1; si += 2) {
    const vt = add(new THREE.Mesh(vtGeo, matBody));
    vt.position.set(si * 1.5*S, 0.2*S, 8.2*S);
    vt.rotation.set(-0.08, si * 0.08, si * 0.48); // 27.5 deg outward
    if (si < 0) vt.scale.x = -1;
  }

  // ── 5. DSI INTAKES ─
  for (let si = -1; si <= 1; si += 2) {
    const intakeGroup = new THREE.Group();
    const intakeDuct = new THREE.Mesh(
      new THREE.BoxGeometry(2.4*S, 1.4*S, 7.0*S),
      matDark
    );
    intakeDuct.position.set(0, 0.1*S, 0);
    const pos = intakeDuct.geometry.attributes.position;
    for(let i=0; i<pos.count; i++) {
        if(pos.getZ(i) < 0 && pos.getY(i) > 0) pos.setZ(i, pos.getZ(i) + 0.8);
    }
    intakeDuct.geometry.computeVertexNormals();
    intakeGroup.add(intakeDuct);

    const bumpGeo = new THREE.SphereGeometry(1.1*S, 16, 12);
    bumpGeo.scale(1.0, 0.5, 2.0);
    const bump = new THREE.Mesh(bumpGeo, matVentral);
    bump.position.set(si*0.2, 0.65*S, -1.2*S);
    intakeGroup.add(bump);

    intakeGroup.position.set(si * 2.3*S, -0.4*S, -4.5*S);
    add(intakeGroup);
  }

  // ── 6. COCKPIT / CANOPY (gold-tinted stealth glass) ─
  const canopyGeo = new THREE.SphereGeometry(1.6*S, 32, 24);
  canopyGeo.scale(0.68, 0.50, 2.5);
  const canopyBase = new THREE.Mesh(canopyGeo, matCanopy);
  canopyBase.position.set(0, 1.08*S, -11.0*S);
  const cPos = canopyBase.geometry.attributes.position;
  for(let i=0; i<cPos.count; i++) {
      let z = cPos.getZ(i);
      if(z > 0) { // rear part tapers more
          cPos.setY(i, cPos.getY(i) * (1.0 - (z/2.5)*0.5));
          cPos.setX(i, cPos.getX(i) * (1.0 - (z/2.5)*0.2));
      }
  }
  canopyBase.geometry.computeVertexNormals();
  add(canopyBase);

  // ── 7. TVC NOZZLES ──
  const nozzleRefs = [], glowRefs = [];
  for (let si = -1; si <= 1; si += 2) {
    const nozOuterGeo = new THREE.BoxGeometry(2.1*S, 1.1*S, 2.5*S);
    const nozOuter = new THREE.Mesh(nozOuterGeo, matDark);
    nozOuter.position.set(si * 1.25*S, -0.05*S, 16.5*S);
    add(nozOuter);

    const nozInnerGeo = new THREE.BoxGeometry(1.7*S, 0.8*S, 0.4*S);
    const nozInner = new THREE.Mesh(nozInnerGeo, matNoz.clone());
    nozInner.position.set(si * 1.25*S, -0.05*S, 17.8*S);
    add(nozInner);
    nozzleRefs.push(nozInner);

    const g1 = new THREE.Mesh(new THREE.PlaneGeometry(1.5*S, 0.9*S), matGlow.clone());
    g1.position.set(si * 1.25*S, -0.05*S, 18.1*S);
    add(g1);
    glowRefs.push(g1);

    const g2 = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4*S, 1.4*S),
      new THREE.MeshBasicMaterial({ color:0xff8800, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide })
    );
    g2.position.set(si * 1.25*S, -0.05*S, 19.8*S);
    add(g2);
    glowRefs.push(g2);
  }

  // ── 8. LIGHTS & VAPOR ──
  const navL = add(new THREE.Mesh(new THREE.SphereGeometry(0.2*S, 12, 8), matRed));
  navL.position.set(-11.0*S, 0.2*S, 2.5*S);
  
  const navR = add(new THREE.Mesh(new THREE.SphereGeometry(0.2*S, 12, 8), matGreen));
  navR.position.set(11.0*S, 0.2*S, 2.5*S);

  const vaporRefs = [];
  const vGeo = new THREE.PlaneGeometry(14*S, 12*S);
  for (const [x, y, z] of [[-10.5*S, 0.1*S, 4.5*S], [10.5*S, 0.1*S, 4.5*S], [0, 1.0*S, -8*S]]) {
    const vm = new THREE.Mesh(vGeo, matVapor.clone());
    vm.position.set(x, y, z);
    vm.rotation.x = -Math.PI / 2;
    add(vm);
    vaporRefs.push(vm);
  }

  group.rotation.order = "YXZ";
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  group.userData = {
    vapor  : vaporRefs,
    nozzles: nozzleRefs,
    glows  : glowRefs,
    ctrl   : { stabL, stabR },
  };

  return group;
}"""

render_new = """const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:"high-performance", logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0)); // optimize a bit
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // Softer, better shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25; // Brighter
renderer.outputColorSpace = THREE.SRGBColorSpace || "srgb";"""

sun_new = """const sun = new THREE.DirectionalLight(0xfffaee, 2.0); // Brighter sun
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
scene.add(sun);"""

pat_f22 = re.compile(r"function buildF22\(\) \{.*?return group;\n\}", re.DOTALL)
pat_renderer = re.compile(r"const renderer = new THREE\.WebGLRenderer\(.*?renderer\.outputColorSpace\s*=\s*THREE\.SRGBColorSpace\s*\|\|\s*\"srgb\";", re.DOTALL)
pat_sun = re.compile(r"const sun = new THREE\.DirectionalLight\(.*scene\.add\(sun\);", re.DOTALL)

code = pat_f22.sub(new_f22, code)
code = pat_renderer.sub(render_new, code)
code = pat_sun.sub(sun_new, code)

with open(target_file, "w", encoding="utf-8") as f:
    f.write(code)

print("Python update script completed.")
