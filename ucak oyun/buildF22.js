function buildF22() {
  const S = 3.0;
  const group = new THREE.Group();

  const mat = {
    top: new THREE.MeshStandardMaterial({ color: 0x7a848c, metalness: 0.48, roughness: 0.48 }),
    mid: new THREE.MeshStandardMaterial({ color: 0x8a949c, metalness: 0.42, roughness: 0.52 }),
    belly: new THREE.MeshStandardMaterial({ color: 0xa8b0b8, metalness: 0.32, roughness: 0.60 }),
    wing: new THREE.MeshStandardMaterial({ color: 0x8c969e, metalness: 0.40, roughness: 0.50 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2e363e, metalness: 0.50, roughness: 0.55, flatShading: true }),
    intake: new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.72, roughness: 0.30, flatShading: true }),
    edge: new THREE.MeshStandardMaterial({ color: 0x6e7880, metalness: 0.58, roughness: 0.40 }),
    canopy: new THREE.MeshStandardMaterial({
      color: 0xc89840, metalness: 0.92, roughness: 0.08,
      transparent: true, opacity: 0.82, emissive: 0x8a6820, emissiveIntensity: 0.32,
    }),
    eng: new THREE.MeshStandardMaterial({ color: 0x5a636c, metalness: 0.52, roughness: 0.45 }),
    nozzle: new THREE.MeshStandardMaterial({
      color: 0x0a0a0a, metalness: 0.94, roughness: 0.22,
      emissive: 0xff3000, emissiveIntensity: 0,
    }),
    panel: new THREE.MeshStandardMaterial({ color: 0x58626c, metalness: 0.44, roughness: 0.52, flatShading: true }),
    vapor: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  };

  function makeShape(pts) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    return shape;
  }

  function addBox(m, w, h, d, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    if (ry) mesh.rotation.y = ry;
    if (rz) mesh.rotation.z = rz;
    group.add(mesh);
    return mesh;
  }

  // === FUSELAGE (multi-section angular body) ===
  // Forward fuselage
  const fwdShape = makeShape([
    [0, 0.40*S], [0.55*S, 0.12*S], [0.62*S, -0.15*S],
    [0.32*S, -0.48*S], [0, -0.52*S], [-0.32*S, -0.48*S],
    [-0.62*S, -0.15*S], [-0.55*S, 0.12*S],
  ]);
  const fwdGeo = new THREE.ExtrudeGeometry(fwdShape, { depth: 5.5*S, bevelEnabled: false });
  const fwd = new THREE.Mesh(fwdGeo, mat.mid);
  fwd.rotation.x = Math.PI;
  fwd.position.set(0, 0, -2.0*S);
  group.add(fwd);

  // Rear fuselage (narrower)
  const rearShape = makeShape([
    [0, 0.35*S], [0.48*S, 0.10*S], [0.55*S, -0.12*S],
    [0.28*S, -0.42*S], [0, -0.45*S], [-0.28*S, -0.42*S],
    [-0.55*S, -0.12*S], [-0.48*S, 0.10*S],
  ]);
  const rearGeo = new THREE.ExtrudeGeometry(rearShape, { depth: 4.0*S, bevelEnabled: false });
  const rear = new THREE.Mesh(rearGeo, mat.mid);
  rear.rotation.x = Math.PI;
  rear.position.set(0, 0, 3.5*S);
  group.add(rear);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.30*S, 4.0*S, 4), mat.top);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0, -9.5*S);
  group.add(nose);

  // Nose blend
  const noseBlend = new THREE.Mesh(new THREE.CylinderGeometry(0.32*S, 0.50*S, 2.5*S, 6), mat.mid);
  noseBlend.rotation.x = Math.PI / 2;
  noseBlend.position.set(0, 0, -6.3*S);
  group.add(noseBlend);

  // Spine
  addBox(mat.top, 0.35*S, 0.14*S, 11.0*S, 0, 0.40*S, -0.5*S);
  // Belly
  addBox(mat.belly, 1.3*S, 0.06*S, 10.0*S, 0, -0.50*S, -0.2*S);

  // Side panels
  for (let s = -1; s <= 1; s += 2) {
    const sp = addBox(mat.mid, 0.30*S, 0.68*S, 9.0*S, s*0.60*S, -0.06*S, -0.2*S);
    sp.rotation.z = s * 0.10;
  }

  // === CANOPY ===
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.68*S, 18, 14, 0, Math.PI*2, 0, Math.PI*0.42), mat.canopy
  );
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, 0.38*S, -4.5*S);
  canopy.scale.set(0.68, 0.52, 1.25);
  group.add(canopy);

  addBox(mat.dark, 0.90*S, 0.05*S, 0.08*S, 0, 0.40*S, -3.4*S);

  // === CHINES ===
  for (let s = -1; s <= 1; s += 2) {
    addBox(mat.edge, 0.25*S, 0.07*S, 6.5*S, s*0.68*S, 0.06*S, -2.5*S, 0, 0, s*-0.25);
  }

  // === AIR INTAKES ===
  for (let s = -1; s <= 1; s += 2) {
    addBox(mat.dark, 0.70*S, 0.60*S, 3.5*S, s*1.10*S, -0.22*S, -1.0*S);
    addBox(mat.intake, 0.50*S, 0.42*S, 3.3*S, s*1.10*S, -0.18*S, -0.9*S);
    addBox(mat.edge, 0.72*S, 0.62*S, 0.07*S, s*1.10*S, -0.21*S, -2.8*S);
    addBox(mat.panel, 0.60*S, 0.05*S, 2.5*S, s*1.10*S, 0.11*S, -1.3*S, 0.06);
  }

  // === MAIN WINGS ===
  for (let s = -1; s <= 1; s += 2) {
    addBox(mat.wing, 3.5*S, 0.13*S, 4.2*S, s*2.5*S, -0.14*S, 0.5*S);

    const wShape = makeShape([[0,0],[5.0*S,0],[3.3*S,2.8*S],[0,3.6*S]]);
    const wGeo = new THREE.ExtrudeGeometry(wShape, {
      depth: 0.10*S, bevelEnabled: true, bevelThickness: 0.02*S,
      bevelSize: 0.02*S, bevelSegments: 1,
    });
    const wMesh = new THREE.Mesh(wGeo, mat.wing);
    wMesh.rotation.x = -Math.PI / 2;
    wMesh.position.set(s*4.2*S, -0.15*S, -1.2*S);
    if (s < 0) wMesh.scale.x = -1;
    group.add(wMesh);

    // LEX
    const lexSh = makeShape([[0,0],[1.8*S,0],[0.4*S,2.2*S]]);
    const lexGeo = new THREE.ExtrudeGeometry(lexSh, { depth: 0.07*S, bevelEnabled: false });
    const lex = new THREE.Mesh(lexGeo, mat.top);
    lex.rotation.x = -Math.PI / 2;
    lex.position.set(s*0.68*S, -0.05*S, -3.0*S);
    if (s < 0) lex.scale.x = -1;
    group.add(lex);

    addBox(mat.panel, 3.2*S, 0.04*S, 0.70*S, s*5.2*S, -0.16*S, 2.3*S, 0, s*0.14);
    addBox(mat.edge, 0.04*S, 0.08*S, 5.0*S, s*7.0*S, -0.10*S, 0.5*S, 0, s*0.42);

    // Roundel
    const rg = new THREE.Group();
    const d1 = new THREE.Mesh(new THREE.CircleGeometry(0.45*S, 20),
      new THREE.MeshBasicMaterial({ color: 0x1c2e5e, side: THREE.DoubleSide }));
    d1.rotation.x = -Math.PI / 2;
    const d2 = new THREE.Mesh(new THREE.CircleGeometry(0.28*S, 20),
      new THREE.MeshBasicMaterial({ color: 0xd0d4d8, side: THREE.DoubleSide }));
    d2.rotation.x = -Math.PI / 2;
    d2.position.y = 0.01*S;
    rg.add(d1, d2);
    rg.position.set(s*4.8*S, -0.08*S, 1.2*S);
    group.add(rg);
  }

  // === ENGINE NACELLES ===
  const nozzleRefs = [];
  const glowRefs = [];

  for (let s = -1; s <= 1; s += 2) {
    // Nacelle tube
    const nac = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44*S, 0.36*S, 5.0*S, 8), mat.eng
    );
    nac.rotation.x = Math.PI / 2;
    nac.position.set(s*0.70*S, -0.06*S, 4.8*S);
    group.add(nac);

    // Fairing
    addBox(mat.mid, 0.80*S, 0.28*S, 5.0*S, s*0.70*S, 0.18*S, 4.8*S);
    // Bottom panel
    addBox(mat.belly, 0.75*S, 0.06*S, 4.8*S, s*0.70*S, -0.40*S, 4.8*S);

    // Nozzle outer
    const noz = addBox(mat.nozzle, 0.60*S, 0.45*S, 1.1*S, s*0.70*S, -0.06*S, 7.4*S);
    nozzleRefs.push(noz);

    // Nozzle inner
    addBox(mat.dark, 0.42*S, 0.28*S, 0.8*S, s*0.70*S, -0.06*S, 7.6*S);

    // Nozzle petals
    for (let p = 0; p < 4; p++) {
      addBox(mat.nozzle, 0.15*S, 0.04*S, 0.20*S,
        s*0.70*S + (p<2?-0.16:0.16)*S,
        -0.06*S + (p%2===0?0.16:-0.16)*S,
        8.0*S
      );
    }

    // Glow disc
    const gMat = new THREE.MeshBasicMaterial({
      color: 0xff5500, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.20*S, 8), gMat);
    glow.position.set(s*0.70*S, -0.06*S, 8.10*S);
    group.add(glow);
    glowRefs.push(glow);
  }

  // Tail boom
  addBox(mat.dark, 0.45*S, 0.44*S, 5.2*S, 0, 0.14*S, 5.0*S);
  addBox(mat.panel, 1.8*S, 0.08*S, 4.2*S, 0, -0.36*S, 5.2*S);

  // === CANTED VERTICAL STABILIZERS ===
  const rudL = new THREE.Group();
  const rudR = new THREE.Group();

  for (let s = -1; s <= 1; s += 2) {
    const finSh = makeShape([
      [0,0],[0.10*S,0],[0.06*S,2.8*S],[-0.60*S,2.8*S],[-0.16*S,0],
    ]);
    const finGeo = new THREE.ExtrudeGeometry(finSh, {
      depth: 1.4*S, bevelEnabled: true, bevelThickness: 0.02*S,
      bevelSize: 0.02*S, bevelSegments: 1,
    });
    const fin = new THREE.Mesh(finGeo, mat.top);
    fin.position.set(s*1.20*S, 0.12*S, 4.6*S);
    fin.rotation.set(-0.04, s*-0.10, s*0.48);
    group.add(fin);

    addBox(mat.edge, 0.03*S, 2.6*S, 0.04*S, s*1.32*S, 1.55*S, 4.7*S, 0, 0, s*0.48);

    const rm = new THREE.Mesh(new THREE.BoxGeometry(0.07*S, 1.2*S, 0.55*S), mat.panel);
    rm.position.y = 0.60*S;
    const rud = s < 0 ? rudL : rudR;
    rud.add(rm);
    rud.position.set(s*1.48*S, 1.48*S, 6.3*S);
    rud.rotation.set(0, s*-0.10, s*0.48);
    group.add(rud);
  }

  // === HORIZONTAL STABILIZERS ===
  const stabL = new THREE.Group();
  const stabR = new THREE.Group();

  for (let s = -1; s <= 1; s += 2) {
    const tSh = makeShape([[0,0],[3.2*S,0],[2.2*S,1.8*S],[0,1.6*S]]);
    const tGeo = new THREE.ExtrudeGeometry(tSh, {
      depth: 0.07*S, bevelEnabled: true, bevelThickness: 0.02*S,
      bevelSize: 0.02*S, bevelSegments: 1,
    });
    const tm = new THREE.Mesh(tGeo, mat.top);
    tm.rotation.x = -Math.PI / 2;
    tm.position.set(0, 0, -0.8*S);
    if (s < 0) tm.scale.x = -1;
    const stab = s < 0 ? stabL : stabR;
    stab.add(tm);
    stab.position.set(s*0.75*S, 0.02*S, 5.8*S);
    group.add(stab);
  }

  // Bay seams
  for (let i = 0; i < 3; i++) {
    addBox(mat.dark, 1.1*S, 0.02*S, 1.6*S, 0, -0.51*S, -1.8*S + i*2.2*S);
  }

  // Panel lines
  for (let i = 0; i < 10; i++) {
    addBox(mat.dark, 0.02*S, 0.50*S, 0.02*S, (i%2?0.35:-0.35)*S, 0, -4.5*S+i*1.0*S);
  }

  // === VAPOR TRAILS ===
  const vaporL = new THREE.Mesh(new THREE.PlaneGeometry(4.5*S, 3.0*S), mat.vapor);
  vaporL.position.set(-4.2*S, 0.28*S, 0.5*S);
  vaporL.rotation.set(-0.38, Math.PI/2, 0);
  group.add(vaporL);
  const vaporR = vaporL.clone();
  vaporR.position.x *= -1;
  vaporR.rotation.z *= -1;
  group.add(vaporR);
  const vaporC = new THREE.Mesh(new THREE.PlaneGeometry(3.5*S, 2.4*S), mat.vapor.clone());
  vaporC.position.set(0, 0.72*S, -2.5*S);
  vaporC.rotation.x = -0.80;
  group.add(vaporC);

  // === FINALIZE ===
  group.rotation.order = "YXZ";
  group.traverse(function(o) { if (o.isMesh) o.castShadow = true; });

  group.userData = {
    vapor: [vaporL, vaporR, vaporC],
    ctrl: { rudL: rudL, rudR: rudR, stabL: stabL, stabR: stabR },
    nozzles: nozzleRefs,
    glows: glowRefs,
  };

  return group;
}
