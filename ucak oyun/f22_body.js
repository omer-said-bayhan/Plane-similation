function buildF22() {
  const S = 4.0;
  const group = new THREE.Group();

  /* ─── Materials ─────────────────────────────── */
  const mTop   = new THREE.MeshStandardMaterial({ color: 0x6a7580, metalness: 0.55, roughness: 0.40 });
  const mSide  = new THREE.MeshStandardMaterial({ color: 0x7c8890, metalness: 0.48, roughness: 0.46 });
  const mBelly = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.30, roughness: 0.62 });
  const mDark  = new THREE.MeshStandardMaterial({ color: 0x303c48, metalness: 0.52, roughness: 0.52, flatShading: true });
  const mIn    = new THREE.MeshStandardMaterial({ color: 0x080c12, metalness: 0.78, roughness: 0.22, flatShading: true });
  const mEdge  = new THREE.MeshStandardMaterial({ color: 0x50606c, metalness: 0.66, roughness: 0.34 });
  const mCan   = new THREE.MeshStandardMaterial({ color: 0xd4a030, metalness: 0.94, roughness: 0.05,
    transparent: true, opacity: 0.78, emissive: 0x9a6010, emissiveIntensity: 0.30 });
  const mEng   = new THREE.MeshStandardMaterial({ color: 0x56666e, metalness: 0.55, roughness: 0.42 });
  const mNoz   = new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0.96, roughness: 0.16,
    emissive: 0xff3800, emissiveIntensity: 0 });
  const mCtrl  = new THREE.MeshStandardMaterial({ color: 0x5e6c76, metalness: 0.46, roughness: 0.52 });
  const mVap   = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });

  /* ─── Helpers ────────────────────────────────── */
  function add(m) { group.add(m); return m; }

  function sh(pts) {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  }

  // Extrude a 2D shape along Z. rx/ry/rz in radians.
  function mkExt(shape, depth, mat, px, py, pz, rx, ry, rz, sx) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    if (sx !== undefined) m.scale.x = sx;
    return add(m);
  }

  function bx(mat, w, h, d, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    return add(m);
  }

  /* ════════════════════════════════════════════
     FUSELAGE  — diamond cross-section, 3 zones
     The cross-section is defined in the XY plane
     and extruded along +Z. We flip with rotation.x=PI
     so it extrudes in -Z (nose direction).
  ════════════════════════════════════════════ */

  // Cross-section shape for forward fuselage (narrow)
  const fwdXS = sh([
    [ 0,       0.38*S],   // top center
    [ 0.52*S,  0.12*S],   // top right
    [ 0.60*S, -0.06*S],   // right
    [ 0.32*S, -0.42*S],   // bot right
    [ 0,      -0.48*S],   // bottom center
    [-0.32*S, -0.42*S],   // bot left
    [-0.60*S, -0.06*S],   // left
    [-0.52*S,  0.12*S],   // top left
  ]);

  // Cross-section for mid/engine fuselage (wider)
  const midXS = sh([
    [ 0,       0.42*S],
    [ 0.64*S,  0.14*S],
    [ 0.72*S, -0.08*S],
    [ 0.38*S, -0.48*S],
    [ 0,      -0.54*S],
    [-0.38*S, -0.48*S],
    [-0.72*S, -0.08*S],
    [-0.64*S,  0.14*S],
  ]);

  // Forward fuselage (cockpit to wing root) — 10*S long, nose faces -Z
  mkExt(fwdXS, 10*S, mSide,  0, 0,  -2*S,  Math.PI, 0, 0);

  // Mid+rear fuselage (wing root to nozzle) — 12*S long
  mkExt(midXS, 12*S, mSide,  0, 0,   8*S,  Math.PI, 0, 0);

  // Belly RAM panel (flat dark underside, not black — use mBelly)
  bx(mBelly, 4.2*S, 0.14*S, 22*S,  0, -0.54*S, -1*S);

  /* ════════════════════════════════════════════
     NOSE CONE (sharp 4-sided stealth radome)
  ════════════════════════════════════════════ */
  const noseCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.52*S, 5.0*S, 4), mDark
  );
  noseCone.rotation.x = Math.PI / 2;
  noseCone.rotation.y = Math.PI / 4;
  noseCone.position.set(0, -0.05*S, -14.5*S);
  add(noseCone);

  // Radome transition
  bx(mSide, 1.1*S, 0.90*S, 3.5*S,  0, 0.02*S, -11.0*S);

  /* ════════════════════════════════════════════
     CANOPY (gold-amber F-22 coating)
  ════════════════════════════════════════════ */
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(2.8*S, 22, 14, 0, Math.PI*2, 0, Math.PI*0.44), mCan
  );
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.set(0, 0.38*S, -3.5*S);
  canopy.scale.set(0.58, 0.46, 1.28);
  add(canopy);
  // Rear frame sill
  bx(mDark, 2.8*S, 0.14*S, 0.25*S,  0, 0.42*S, -1.2*S);

  /* ════════════════════════════════════════════
     CHINE / FOREBODY STRAKES
  ════════════════════════════════════════════ */
  bx(mEdge, 0.65*S, 0.20*S, 16*S,   2.0*S, 0.20*S, -4*S,  0, 0, -0.24);
  bx(mEdge, 0.65*S, 0.20*S, 16*S,  -2.0*S, 0.20*S, -4*S,  0, 0,  0.24);

  /* ════════════════════════════════════════════
     AIR INTAKES  (caret / trapezoidal)
     Real F-22: side-mounted below chine,
     angled slightly down and outward
  ════════════════════════════════════════════ */
  for (let s = -1; s <= 1; s += 2) {
    // Intake shape (trapezoid looking at it from front)
    const inSh = sh([
      [0, 0], [2.2*S, 0],
      [1.85*S, 1.6*S], [0.15*S, 1.6*S],
    ]);
    // Extrude forward 9*S (intake depth)
    mkExt(inSh, 9*S, mDark,
      s > 0 ? 0.80*S : -3.0*S,
      -1.62*S, -5.5*S,
      -Math.PI/2, 0, s > 0 ? 0 : 0,
      s < 0 ? -1 : 1
    );
    // Inner dark duct
    const dSh = sh([
      [0.12*S, 0.12*S], [1.95*S, 0.12*S],
      [1.62*S, 1.38*S], [0.28*S, 1.38*S],
    ]);
    mkExt(dSh, 8.6*S, mIn,
      s > 0 ? 0.80*S : -3.0*S,
      -1.62*S, -5.3*S,
      -Math.PI/2, 0, 0,
      s < 0 ? -1 : 1
    );
    // Front lip chrome edge
    bx(mEdge, 2.25*S, 1.65*S, 0.20*S,  s*2.9*S, -0.82*S, -5.6*S);
    // Intake top ramp
    bx(mCtrl, 2.0*S,  0.16*S, 7.5*S,   s*2.9*S,  0.04*S, -2.0*S, 0.06);
  }

  /* ════════════════════════════════════════════
     MAIN WINGS  (swept delta, proper planform)
     Planform defined in XY, rotated -90° to XZ,
     extruded in Y (downward) for thickness.
  ════════════════════════════════════════════ */
  for (let s = -1; s <= 1; s += 2) {
    // Wing planform shape (looking down from above)
    // X = spanwise, Y = chord (front-back)
    const wSh = sh([
      [0,      0     ],   // root leading edge
      [13*S,   4.5*S ],   // tip leading edge
      [13*S,   10*S  ],   // tip trailing edge
      [1.5*S,  9.5*S ],   // root trailing edge taper
      [0,      8.5*S ],   // root trailing edge
    ]);
    // Extrude 0.36*S for airfoil thickness
    mkExt(wSh, 0.36*S, mSide,
      s > 0 ? 0.72*S : -0.72*S,
      -0.16*S,
      s > 0 ? -2.0*S : 9.5*S,    // trailing edge position
      -Math.PI/2, s > 0 ? Math.PI : 0, 0,
      s < 0 ? -1 : 1
    );
    // Wing root thick box (blends with fuselage)
    bx(mSide, 8*S, 0.46*S, 9.5*S,   s*4.5*S, -0.18*S, 2.5*S);
    // Top surface (slightly lighter)
    bx(mTop,  7.5*S, 0.12*S, 9*S,   s*4.4*S,  0.06*S, 2.5*S);

    // LEX (leading edge extension)
    const lSh = sh([[0,0],[5.5*S,0],[1.2*S, 6.5*S]]);
    mkExt(lSh, 0.20*S, mTop,
      s > 0 ? 0.70*S : -0.70*S,
      -0.08*S,
      s > 0 ? -2.2*S : 5.0*S,
      -Math.PI/2, s > 0 ? Math.PI : 0, 0,
      s < 0 ? -1 : 1
    );

    // Flaperon (trailing edge control surface)
    bx(mCtrl, 9*S, 0.18*S, 2.2*S,   s*8*S, -0.22*S, 7.5*S, 0, s*0.12);
    // Wing leading edge strip
    bx(mEdge, 0.14*S, 0.30*S, 13.5*S,  s*14.5*S, -0.08*S, 1.5*S, 0, s*0.44);
    // Wingtip
    bx(mTop, 0.25*S, 0.34*S, 9*S,   s*19*S, -0.08*S, 2.5*S);

    // USAF roundel
    const rg = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.CircleGeometry(1.50*S, 24),
      new THREE.MeshBasicMaterial({ color: 0x1c2e5e, side: THREE.DoubleSide }));
    c1.rotation.x = -Math.PI/2;
    const c2 = new THREE.Mesh(new THREE.CircleGeometry(0.95*S, 24),
      new THREE.MeshBasicMaterial({ color: 0xd8dce0, side: THREE.DoubleSide }));
    c2.rotation.x = -Math.PI/2; c2.position.y = 0.07*S;
    rg.add(c1, c2);
    rg.position.set(s*11*S, -0.10*S, 2*S);
    add(rg);
  }

  /* ════════════════════════════════════════════
     ENGINE NACELLES  (rectangular cross-section)
     Real F-22 nacelles are blended into fuselage
     with rectangular-ish inlets
  ════════════════════════════════════════════ */
  const nozzleRefs = [];
  const glowRefs = [];

  for (let s = -1; s <= 1; s += 2) {
    // Nacelle body (rectangular cross-section extruded along Z)
    const nacSh = sh([
      [-1.0*S,  0.85*S],
      [ 1.0*S,  0.85*S],
      [ 1.05*S,-0.85*S],
      [-1.05*S,-0.85*S],
    ]);
    mkExt(nacSh, 14*S, mEng,
      s*2.2*S, -0.20*S, 2.0*S,
      0, 0, 0
    );

    // Top fairing
    bx(mSide, 2.1*S, 0.92*S, 14*S,   s*2.2*S,  0.98*S, 9*S);
    // Bottom panel
    bx(mBelly, 2.0*S, 0.24*S, 13*S,  s*2.2*S, -1.10*S, 9*S);

    // Nozzle outer box (2D TVC nozzle)
    const noz = bx(mNoz, 2.14*S, 1.74*S, 4.0*S,  s*2.2*S, -0.14*S, 18.5*S);
    nozzleRefs.push(noz);
    // Nozzle inner cavity
    bx(mIn, 1.44*S, 0.96*S, 3.8*S,   s*2.2*S, -0.14*S, 18.7*S);
    // Nozzle lips
    bx(mNoz, 2.2*S,  0.22*S, 0.55*S,  s*2.2*S,  0.76*S, 21.2*S);
    bx(mNoz, 2.2*S,  0.22*S, 0.55*S,  s*2.2*S, -1.04*S, 21.2*S);
    bx(mNoz, 0.22*S, 1.76*S, 0.55*S,  s*2.2*S + s*1.18*S, -0.14*S, 21.2*S);
    bx(mNoz, 0.22*S, 1.76*S, 0.55*S,  s*2.2*S - s*1.18*S, -0.14*S, 21.2*S);
    // Serrated petals
    for (let p = 0; p < 5; p++) {
      const px = s*2.2*S + (p - 2) * 0.46*S;
      bx(mNoz, 0.38*S, 0.15*S, 0.75*S,  px,  0.65*S, 22.0*S);
      bx(mNoz, 0.38*S, 0.15*S, 0.75*S,  px, -0.92*S, 22.0*S);
    }

    // Afterburner inner glow
    const gm1 = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const g1 = new THREE.Mesh(new THREE.CircleGeometry(0.78*S, 10), gm1);
    g1.position.set(s*2.2*S, -0.14*S, 22.5*S);
    add(g1); glowRefs.push(g1);

    // Afterburner outer haze
    const gm2 = new THREE.MeshBasicMaterial({
      color: 0xff3300, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const g2 = new THREE.Mesh(new THREE.CircleGeometry(1.20*S, 10), gm2);
    g2.position.set(s*2.2*S, -0.14*S, 23.8*S);
    add(g2); glowRefs.push(g2);
  }

  // Centre spine boom between nacelles
  bx(mDark, 1.5*S, 1.5*S, 14*S,  0,  0.58*S, 9*S);
  bx(mCtrl, 5.2*S, 0.24*S, 13*S,  0, -1.15*S, 9*S);

  /* ════════════════════════════════════════════
     CANTED VERTICAL STABILIZERS (~28° outward)
  ════════════════════════════════════════════ */
  const rudL = new THREE.Group();
  const rudR = new THREE.Group();

  for (let s = -1; s <= 1; s += 2) {
    // Fin planform (side view: chord along Y, height along... extruded Z for thickness)
    const fSh = sh([
      [0,      0     ],
      [0.40*S, 0     ],
      [0.26*S, 9.0*S ],
      [-2.1*S, 9.0*S ],
      [-0.52*S,0     ],
    ]);
    mkExt(fSh, 5.0*S, mTop,
      s > 0 ? 3.6*S : -8.6*S,
      0.50*S, 10.5*S,
      -0.04, s*-0.08, s*0.48,
      s < 0 ? -1 : 1
    );
    // Leading edge accent
    bx(mEdge, 0.12*S, 9.0*S, 0.14*S,  s*4.1*S, 5.2*S, 10.6*S, 0, 0, s*0.48);

    // Rudder (movable part)
    const rm = new THREE.Mesh(new THREE.BoxGeometry(0.24*S, 4.2*S, 1.90*S), mCtrl);
    rm.position.y = 2.1*S;
    const rud = s < 0 ? rudL : rudR;
    rud.add(rm);
    rud.position.set(s*4.65*S, 4.8*S, 17.5*S);
    rud.rotation.set(0, s*-0.08, s*0.48);
    add(rud);
  }

  /* ════════════════════════════════════════════
     HORIZONTAL STABILIZERS (all-moving tailerons)
  ════════════════════════════════════════════ */
  const stabL = new THREE.Group();
  const stabR = new THREE.Group();

  for (let s = -1; s <= 1; s += 2) {
    // Stabilizer planform
    const tSh = sh([[0,0],[11*S,0],[7.5*S,7.0*S],[0,6.5*S]]);
    const tm = mkExt(tSh, 0.26*S, mTop,
      0, 0, -3.2*S,
      -Math.PI/2, 0, 0,
      s < 0 ? -1 : 1
    );
    const stab = s < 0 ? stabL : stabR;
    stab.add(tm);
    stab.position.set(s*2.6*S, -0.52*S, 15.5*S);
    add(stab);
  }

  /* ════════════════════════════════════════════
     DETAIL WORK
  ════════════════════════════════════════════ */
  // Weapons bay seam lines
  for (let i = 0; i < 3; i++) bx(mIn, 3.8*S, 0.06*S, 5.8*S,  0, -0.54*S, -6.0*S + i*7.5*S);
  // Panel lines
  for (let i = 0; i < 10; i++) bx(mDark, 0.06*S, 1.7*S, 0.06*S,  (i%2?1.5:-1.5)*S, 0.0, -12*S + i*3.2*S);

  /* ════════════════════════════════════════════
     VAPOR TRAILS
  ════════════════════════════════════════════ */
  const vaporL = new THREE.Mesh(new THREE.PlaneGeometry(16*S, 10*S), mVap);
  vaporL.position.set(-14*S, 1.0*S, 2.0*S);
  vaporL.rotation.set(-0.35, Math.PI/2, 0);
  add(vaporL);
  const vaporR = vaporL.clone();
  vaporR.position.x *= -1; vaporR.rotation.z *= -1;
  add(vaporR);
  const vaporC = new THREE.Mesh(new THREE.PlaneGeometry(13*S, 8*S), mVap.clone());
  vaporC.position.set(0, 2.2*S, -9.0*S);
  vaporC.rotation.x = -0.80;
  add(vaporC);

  /* ════════════════════════════════════════════
     FINALIZE
  ════════════════════════════════════════════ */
  group.rotation.order = "YXZ";
  group.traverse(function(o) { if (o.isMesh) o.castShadow = true; });

  group.userData = {
    vapor: [vaporL, vaporR, vaporC],
    ctrl: { rudL, rudR, stabL, stabR },
    nozzles: nozzleRefs,
    glows: glowRefs,
  };

  return group;
}
