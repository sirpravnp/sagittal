// Biliary tree. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, mat = h.mat, add = h.add, ell = h.ell, tube = h.tube, dot = h.dot;

  Kit.register({
    id: 'bil',
    center: [0.3, -0.3, 0],
    zoom: 9.5,
    rot: [-0.1, 0.2],
    controls: [{ k: 'p', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal anatomy'],
      ['gb', 'Cholelithiasis (gallbladder stones)'],
      ['cbd', 'Choledocholithiasis / cholangitis'],
      ['pan', 'Gallstone pancreatitis (ampulla)'],
      ['mir', 'Mirizzi syndrome'],
      ['cou', 'Courvoisier sign (pancreatic head mass)'],
    ] }],
    build: function (g, st) {
      var p = st.p, dil = (p === 'cbd' || p === 'pan' || p === 'cou');
      var duct = mat(0x2fa84f, 0.95);
      ell(g, 0x8a5a3a, 0.3, [-1.5, 1.1, -0.1], [1.9, 1.2, 0.6]); ell(g, 0x8a5a3a, 0.3, [1, 1.4, -0.1], [1.1, 0.7, 0.5]);
      ell(g, 0x4f9a3a, 0.9, [-0.9, -0.4, 0.2], [0.35, 0.7, 0.3]); ell(g, 0x4f9a3a, 0.9, [-0.7, 0.1, 0.2], [0.24, 0.24, 0.24]);
      var cdR = dil ? 0.15 : 0.09, chdR = p === 'mir' ? 0.05 : 0.09;
      tube(g, [[-1.1, 1.6, 0], [-0.6, 1.2, 0], [-0.2, 1, 0], [-0.2, 1, 0]], 0.07, duct, 16);
      tube(g, [[0.8, 1.4, 0], [0.3, 1.2, 0], [-0.2, 1, 0]], 0.07, duct, 16);
      tube(g, [[-0.2, 1, 0], [-0.15, 0.8, 0], [-0.1, 0.6, 0]], chdR, duct, 12);
      tube(g, [[-0.7, 0.1, 0.2], [-0.45, 0.3, 0.1], [-0.1, 0.6, 0]], 0.06, duct, 12);
      tube(g, [[-0.1, 0.6, 0], [0, -0.4, 0], [0.4, -1, 0], [0.8, -1.5, 0]], cdR, duct, 30);
      tube(g, [[-0.3, -0.6, -0.1], [0.2, -0.8, -0.1], [0.9, -1.2, -0.1], [0.9, -2, -0.1], [0.2, -2.3, -0.1]], 0.17, mat(0xe0b0a0, 0.6), 30);
      ell(g, 0xd9a05a, 0.5, [0.45, -1.55, -0.15], [0.5, 0.55, 0.3]);
      tube(g, [[2, -1.1, -0.1], [1.4, -1.35, -0.1], [0.8, -1.5, 0]], 0.05, mat(0xe2d83a), 20);
      add(g, new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.1, 0.6), new THREE.Vector2(-0.55, 0.3), new THREE.Vector2(-0.4, 0.95)])), mat(0xffd23f, 0.45, { emissive: 0xffd23f, emissiveIntensity: 0.25 }), [0, 0, 0.02]);
      tube(g, [[-0.4, 1, 0.05], [-0.5, 0.6, 0.1], [-0.55, 0.3, 0.1]], 0.025, mat(0xe23b3b), 12);
      dot(g, [0.8, -1.5, 0], 0xff7a3f, 0.07);
      if (p === 'gb' || p === 'mir') { [[-0.9, -0.55], [-0.85, -0.3], [-0.95, -0.7]].forEach(function (q) { dot(g, [q[0], q[1], 0.3], 0xf5e6a8, 0.1); }); }
      if (p === 'mir') dot(g, [-0.7, 0.1, 0.3], 0xf5e6a8, 0.16);
      if (p === 'cbd') dot(g, [0.3, -0.85, 0], 0xf5e6a8, 0.14);
      if (p === 'pan') dot(g, [0.75, -1.45, 0.05], 0xf5e6a8, 0.12);
      if (p === 'cou') ell(g, 0xd9a05a, 0.8, [0.45, -1.55, -0.15], [0.8, 0.8, 0.45]);
      var L = [
        { t: 'Liver', p: [-2.9, 1.6, 0] }, { t: 'Gallbladder', p: [-1.7, -0.8, 0.3] }, { t: 'Hartmann pouch / neck', p: [-1.5, 0.15, 0.3] },
        { t: 'Cystic duct', p: [-1.6, 0.65, 0.2] }, { t: 'Common hepatic duct', p: [0.2, 0.85, 0] }, { t: 'Common bile duct', p: [0.6, -0.2, 0] },
        { t: 'Right / left hepatic ducts', p: [-0.9, 1.7, 0] }, { t: 'Calot triangle', p: [-0.45, 0.9, 0.05] }, { t: 'Cystic artery', p: [-0.95, 0.6, 0.1] },
        { t: 'Duodenum', p: [1.3, -2.1, -0.1] }, { t: 'Pancreatic head', p: [1.3, -1.1, -0.1] }, { t: 'Ampulla of Vater', p: [1.2, -1.75, 0] },
        { t: 'Pancreatic duct', p: [2.1, -0.9, -0.1] },
      ];
      var infos = {
        norm: '<ul><li>Bile flows: hepatic ducts → common hepatic duct → (cystic duct to gallbladder) → common bile duct → ampulla of Vater (sphincter of Oddi) → duodenum.</li><li><b>Calot triangle</b>: cystic duct, common hepatic duct and inferior liver edge; contains the cystic artery. Key landmark in cholecystectomy.</li></ul>',
        gb: '<ul><li><b>Cholelithiasis</b>: often silent; biliary colic after fatty meals (RUQ pain, 30 min to hours).</li><li>If the stone impacts the cystic duct and inflammation follows: acute cholecystitis (fever, Murphy sign, ↑WBC).</li></ul>',
        cbd: '<ul><li><b>Choledocholithiasis</b>: duct dilates; ↑ALP, ↑direct bilirubin.</li><li>If infected: <b>cholangitis</b> with Charcot triad (fever, jaundice, RUQ pain); add shock and confusion for Reynold pentad.</li><li>Management: broad-spectrum antibiotics, urgent biliary decompression (ERCP).</li></ul>',
        pan: '<ul><li>A stone at the <b>ampulla of Vater</b> blocks the pancreatic duct and bile duct → <b>gallstone pancreatitis</b> (the most common cause with alcohol).</li><li>Epigastric pain radiating to the back, ↑lipase; often with ↑ALT.</li></ul>',
        mir: '<ul><li><b>Mirizzi syndrome</b>: a stone in the Hartmann pouch/cystic duct compresses the common hepatic duct (note the narrowed CHD).</li><li>Obstructive jaundice with a gallbladder source; diagnosed on imaging/ERCP.</li></ul>',
        cou: '<ul><li><b>Courvoisier sign</b>: painless jaundice plus a palpable, non-tender gallbladder suggests malignant obstruction (e.g. pancreatic head cancer), not stones.</li><li>The mass blocks the distal common bile duct, which dilates, as does the gallbladder.</li></ul>',
      };
      return { labels: L, info: infos[p] };
    },
  });
})();
