// Right knee ligaments and menisci on real Z-Anatomy anatomy (meshes/knee.js, CC BY-SA 4.0):
// femur, tibia, fibula, patella, ACL, PCL, tibial (medial) and fibular (lateral) collateral ligaments,
// medial and lateral menisci and the transverse ligament. Tears are made by splitting the real
// ligament meshes along a plane and pulling the stumps apart; the tibia (with the menisci) is moved
// as one block for the drawer / sag / valgus signs. The patellar ligament is a drawn band (Z-Anatomy
// has only its attachment areas). Mesh frame: cm, +x patient left (= medial for the right knee),
// +y superior, +z anterior.
(function () {
  var S = 0.36;                       // cm -> scene units
  var C = [-7.6, 42.6, -2.6];         // knee centre (cm)
  var JL = 43.2;                      // joint line height (tibial plateau)

  function T(kind, opts) {
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (o.clearcoat === undefined) o.clearcoat = 0.3;
    return Kit.tissue(kind, o);
  }
  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
  // Triangles of a baked part for which keep(centroid) is true (cm); the rest are dropped.
  var KM = null; // per build: part -> drawn meshes (labels anchor on their visible surface)
  function keepM(part, me) { if (KM) (KM[part] = KM[part] || []).push(me); return me; }
  function piece(parent, part, m, keep) {
    var me = keepM(part, Kit.meshPart(parent, 'knee', part, m));
    var src = me.geometry, pos = src.attributes.position, idx = src.index.array, out = [];
    var a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (var i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(pos, idx[i]); b.fromBufferAttribute(pos, idx[i + 1]); c.fromBufferAttribute(pos, idx[i + 2]);
      a.add(b).add(c).multiplyScalar(1 / 3);
      if (keep(a)) out.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.array.slice(), 3));
    geo.setIndex(out); geo.computeVertexNormals();
    me.geometry = geo;
    return me;
  }
  function side(p0, n) { var P0 = V3(p0), N = V3(n).normalize(); return function (v) { return v.clone().sub(P0).dot(N) > 0; }; }
  function bboxC(part) { var b = Kit.meshInfo('knee').bbox[part]; return [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]; }

  Kit.register({
    id: 'knee',
    meshes: ['knee'],
    center: [0, 0, 0],
    zoom: 9,
    rot: [0.12, 0],
    controls: [{ k: 'v', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal knee'],
      ['triad', 'Unhappy triad (ACL + MCL + medial meniscus)'],
      ['pcl', 'PCL tear (dashboard injury)'],
    ] }],
    build: function (g, st) {
      var v = st.v, h = Kit.helpers;
      KM = {};
      // per-variant view: front (slightly anteromedial) for the triad; from the medial side for the PCL sag
      var yaw = { norm: -0.3, triad: -0.45, pcl: -1.35 }[v];
      var K = new THREE.Group(); K.rotation.y = yaw; g.add(K);
      var body = new THREE.Group(); body.scale.setScalar(S); body.position.set(-C[0] * S, -C[1] * S, -C[2] * S); K.add(body);
      K.updateMatrixWorld(true);
      function P(x, y, z) { var p = new THREE.Vector3(x, y, z); body.localToWorld(p); g.worldToLocal(p); return [p.x, p.y, p.z]; }

      var lig = function (o) { return T('cartilage', Object.assign({ color: 0xf4f1e8, roughness: 0.4, emissive: 0x2a2620, emissiveIntensity: 1 }, o || {})); };
      var torn = T('highlight', { color: 0xff3b2f, emissive: 0xff3b2f, emissiveIntensity: 0.7 });
      var menC = 0x9fc4c8;

      // ---- femur and patella (stay put) ----
      keepM('femur', Kit.meshPart(body, 'knee', 'femur', T('bone', { color: 0xe2cfa8, opacity: 0.4, depthWrite: false, side: THREE.FrontSide })));
      keepM('patella', Kit.meshPart(body, 'knee', 'patella', T('bone', { color: 0xe2cfa8, opacity: 0.45, depthWrite: false, side: THREE.FrontSide })));

      // ---- leg block: tibia, fibula, menisci (moved for drawer / sag / valgus) ----
      var leg = new THREE.Group(); body.add(leg);
      var pivot = [-11.2, JL, -2.4];                 // lateral joint line: valgus opens the medial side
      leg.position.set(pivot[0], pivot[1], pivot[2]);
      var legIn = new THREE.Group(); legIn.position.set(-pivot[0], -pivot[1], -pivot[2]); leg.add(legIn);
      if (v === 'triad') {
        leg.rotation.z = -0.075;      // valgus: medial joint space opens
        leg.position.z += 0.8;        // anterior drawer / Lachman: tibia slides forward
      }
      if (v === 'pcl') leg.position.z -= 1.3; // posterior sag / drawer
      body.updateMatrixWorld(true);
      function legB(p) { var q = V3(p); legIn.localToWorld(q); body.worldToLocal(q); return [q.x, q.y, q.z]; }
      keepM('tibia', Kit.meshPart(legIn, 'knee', 'tibia', T('bone', { color: 0xe2cfa8, opacity: 0.4, depthWrite: false, side: THREE.FrontSide })));
      if (v !== 'norm') Kit.meshPart(body, 'knee', 'tibia', T('bone', { color: 0x6fa8d8, opacity: 0.16, depthWrite: false })); // normal position
      keepM('fibula', Kit.meshPart(legIn, 'knee', 'fibula', T('bone', { color: 0xe2cfa8, opacity: 0.5, depthWrite: false, side: THREE.FrontSide })));
      keepM('lat_meniscus', Kit.meshPart(legIn, 'knee', 'lat_meniscus', T('cartilage', { color: menC })));
      var mm = bboxC('med_meniscus');
      if (v === 'triad') {
        // longitudinal (bucket-handle) tear: the inner rim splits off and flips toward the notch
        var mb = Kit.meshInfo('knee').bbox.med_meniscus, hx = (mb[3] - mb[0]) / 2, hz = (mb[5] - mb[2]) / 2;
        var inner = function (q) { var a = (q.x - mm[0]) / hx, c = (q.z - mm[2]) / hz; return a * a + c * c < 0.42; };
        piece(legIn, 'med_meniscus', T('cartilage', { color: menC }), function (q) { return !inner(q); });
        var hb = new THREE.Group(); legIn.add(hb); hb.position.set(-0.7, 0.2, 0);
        piece(hb, 'med_meniscus', T('cartilage', { color: 0xff8a70, emissive: 0xc0301a, emissiveIntensity: 0.6 }), inner);
      } else {
        keepM('med_meniscus', Kit.meshPart(legIn, 'knee', 'med_meniscus', T('cartilage', { color: menC })));
      }
      // patellar ligament (drawn): patellar apex -> tibial tuberosity
      var tt = legB([-7.9, 38.4, 0.9]);
      h.tube(body, [[-8.3, 42.9, 1.3], [(tt[0] - 8.3) / 2, (tt[1] + 42.9) / 2, (tt[2] + 1.3) / 2 + 0.1], tt], 0.4, lig({ opacity: 0.35, depthWrite: false }));

      // ---- cruciates ----
      var acl = bboxC('acl'), pcl = bboxC('pcl');
      var aclN = [0.15, 1, -0.75], pclN = [0, 1, 0.45];
      if (v === 'triad') {
        var a1 = new THREE.Group(); body.add(a1); a1.position.set(0, 0.35, -0.1);
        piece(a1, 'acl', lig(), side(acl, aclN));                                   // femoral stump
        piece(legIn, 'acl', lig(), function (q) { return !side(acl, aclN)(q); });   // tibial stump
        h.dot(a1, [acl[0], acl[1] + 0.35, acl[2] - 0.2], 0xff3b2f, 0.32).material = torn;
        h.dot(legIn, [acl[0], acl[1] - 0.35, acl[2] + 0.1], 0xff3b2f, 0.32).material = torn;
      } else {
        keepM('acl', Kit.meshPart(legIn, 'knee', 'acl', lig()));
      }
      if (v === 'pcl') {
        var p1 = new THREE.Group(); body.add(p1); p1.position.set(0, 0.35, 0);
        piece(p1, 'pcl', lig(), side(pcl, pclN));
        piece(legIn, 'pcl', lig(), function (q) { return !side(pcl, pclN)(q); });
        h.dot(p1, [pcl[0], pcl[1] + 0.3, pcl[2]], 0xff3b2f, 0.32).material = torn;
        h.dot(legIn, [pcl[0], pcl[1] - 0.4, pcl[2]], 0xff3b2f, 0.32).material = torn;
      } else {
        keepM('pcl', Kit.meshPart(legIn, 'knee', 'pcl', lig({ color: 0xd9d2bd })));
      }

      // ---- collaterals ----
      if (v === 'triad') { // MCL torn across the joint line
        var mclCut = [-4.9, JL + 0.6, -2.4], mclN = [0, 1, 0.1];
        var m1 = new THREE.Group(); body.add(m1); m1.position.set(0.1, 0.3, 0);
        piece(m1, 'mcl_sup', lig(), side(mclCut, mclN));
        piece(m1, 'mcl_deep', lig({ color: 0xcfc7b0 }), side(mclCut, mclN));
        piece(legIn, 'mcl_sup', lig(), function (q) { return !side(mclCut, mclN)(q); });
        piece(legIn, 'mcl_deep', lig({ color: 0xcfc7b0 }), function (q) { return !side(mclCut, mclN)(q); });
        h.dot(body, [-3.2, JL + 0.45, -2.2], 0xff3b2f, 0.32).material = torn;
      } else {
        keepM('mcl_sup', Kit.meshPart(legIn, 'knee', 'mcl_sup', lig()));
        keepM('mcl_deep', Kit.meshPart(legIn, 'knee', 'mcl_deep', lig({ color: 0xcfc7b0 })));
      }
      keepM('lcl', Kit.meshPart(legIn, 'knee', 'lcl', lig()));

      // ---- the injury: force arrows and the resulting laxity ----
      if (v === 'triad') {
        h.arrow(g, P(-19, 44.5, -2.4), P(-12.6, 44.5, -2.4), 0xffd23f);     // lateral blow to the planted knee
        h.arrow(g, P(-2.4, 41.4, -1.0), P(-2.4, 41.4, 4.4), 0x7fd0ff);          // anterior translation of the proximal tibia (medial side, so it reads in this view)
      }
      if (v === 'pcl') {
        h.arrow(g, P(-7.8, 39.5, 6.8), P(-7.8, 39.5, 1.6), 0xffd23f);       // dashboard strikes the proximal tibia
      }

      // ---- labels ----
      var L = [];
      function lab(t, p, on) { L.push(on ? { t: t, p: P(p[0], p[1], p[2]), on: on } : { t: t, p: P(p[0], p[1], p[2]) }); }
      function legP(p) { var q = V3(p); legIn.localToWorld(q); body.worldToLocal(q); return [q.x, q.y, q.z]; }
      body.updateMatrixWorld(true);
      lab('Femur', [-8.5, 51, -2]);
      lab('Patella', [-8.4, 45.2, 1.8]);
      lab('Tibia', legP([-6.5, 37, -1]));
      if (v !== 'pcl') lab('Fibula', legP([-11.6, 38.5, -4]));
      lab(v === 'triad' ? 'ACL tear' : 'ACL', v === 'triad' ? [acl[0], acl[1] + 0.4, acl[2]] : legP(acl), v === 'triad' ? null : KM.acl);
      lab(v === 'pcl' ? 'PCL tear' : 'PCL', v === 'pcl' ? [pcl[0], pcl[1] + 0.5, pcl[2]] : legP(pcl), v === 'pcl' ? null : KM.pcl);
      lab(v === 'triad' ? 'MCL (tibial collateral) tear' : 'MCL (tibial collateral)', v === 'triad' ? [-3.2, JL + 0.5, -2.2] : legP([-3.4, 41, -2.2]), v === 'triad' ? null : KM.mcl_sup);
      if (v !== 'pcl') lab('LCL (fibular collateral)', legP([-11.9, 44.2, -4]), KM.lcl);
      lab(v === 'triad' ? 'Medial meniscus tear' : 'Medial meniscus', legP([mm[0] + 0.6, mm[1], mm[2] + 1.2]), v === 'triad' ? null : KM.med_meniscus);
      lab('Lateral meniscus', legP([-10.3, 43.2, -1.5]), KM.lat_meniscus);
      if (v === 'triad') {
        lab('Lateral blow (valgus force)', [-16.5, 44.5, -2.4]); // on the arrow
        lab('Anterior drawer / Lachman +', [-2.4, 41.4, 4.2]);
      }
      if (v === 'pcl') {
        lab('Dashboard blow: force pushes the tibia back', [-7.8, 39.5, 5.0]); // on the arrow
        lab('Posterior sag / drawer +', legP([-7.8, 35.5, 0]));
      }
      var info = {
        norm: '<ul><li><b>ACL</b>: anterior tibia → posteromedial lateral femoral condyle; stops anterior tibial translation (Lachman, anterior drawer).</li><li><b>PCL</b>: posterior tibia → medial femoral condyle; stops posterior translation (posterior drawer, sag).</li><li><b>MCL</b> resists valgus; <b>LCL</b> resists varus. The medial meniscus is attached to the MCL, so it tears more often.</li></ul>',
        triad: '<ul><li><b>Unhappy triad</b>: a lateral blow to the planted knee (valgus + rotation) tears the <b>ACL</b>, <b>MCL</b> and <b>medial meniscus</b> (some series: lateral meniscus more often).</li><li>Exam: positive Lachman / anterior drawer, valgus laxity, joint-line tenderness or locking. MRI confirms.</li></ul>',
        pcl: '<ul><li><b>PCL tear</b>: a posterior force on the proximal tibia with the knee flexed (dashboard injury) or a fall on the flexed knee.</li><li>Exam: posterior drawer and posterior sag of the tibia.</li></ul>',
      };
      return { labels: L, info: info[v] };
    },
  });
})();
