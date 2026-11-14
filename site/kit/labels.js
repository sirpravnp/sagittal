// Label collision layout. Classic script: assigns window.KitLabels = { layoutLabels }.
(function () {
  var GAP = 2;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // anchors: [{x,y,w,h}] (top-left + size); bounds: {w,h}.
  // Returns [{x,y}] in the same order. Greedy, top-to-bottom: each label takes the
  // free in-bounds position nearest its (clamped) anchor, chosen from the anchor itself
  // and from positions just above/below/beside already-placed labels (O(n^2) overall).
  // If nothing is free (total area too large), the clamped anchor is used.
  function layoutLabels(anchors, bounds) {
    var n = anchors.length;
    var out = new Array(n);
    var px = new Array(n), py = new Array(n), pw = new Array(n), ph = new Array(n);
    var placed = 0;
    var order = new Array(n);
    var i, j, k;
    // current label state, shared with the helpers below
    var w = 0, h = 0, maxX = 0, maxY = 0, ax = 0, ay = 0;
    var best = 0, bx = 0, by = 0;

    for (i = 0; i < n; i++) order[i] = i;
    order.sort(function (a, b) { return anchors[a].y - anchors[b].y || a - b; });

    function collides(x, y) {
      for (var m = 0; m < placed; m++) {
        if (x < px[m] + pw[m] && px[m] < x + w && y < py[m] + ph[m] && py[m] < y + h) return true;
      }
      return false;
    }

    function tryCand(x, y) {
      if (x < 0 || y < 0 || x > maxX || y > maxY) return;
      var dx = x - ax, dy = y - ay;
      var d = dx * dx + dy * dy;
      if (d >= best || collides(x, y)) return;
      best = d; bx = x; by = y;
    }

    for (k = 0; k < n; k++) {
      i = order[k];
      var a = anchors[i];
      w = a.w; h = a.h;
      maxX = Math.max(0, bounds.w - w);
      maxY = Math.max(0, bounds.h - h);
      ax = clamp(a.x, 0, maxX);
      ay = clamp(a.y, 0, maxY);
      bx = ax; by = ay;

      if (collides(ax, ay)) {
        best = Infinity;
        var fx = ax, fy = ay; // fallback: clamped anchor
        for (j = 0; j < placed; j++) {
          tryCand(ax, py[j] + ph[j] + GAP);
          tryCand(ax, py[j] - h - GAP);
          tryCand(px[j] + pw[j] + GAP, ay);
          tryCand(px[j] - w - GAP, ay);
          tryCand(px[j] + pw[j] + GAP, py[j] + ph[j] + GAP);
          tryCand(px[j] - w - GAP, py[j] - h - GAP);
          tryCand(px[j] + pw[j] + GAP, py[j] - h - GAP);
          tryCand(px[j] - w - GAP, py[j] + ph[j] + GAP);
        }
        if (best === Infinity) { bx = fx; by = fy; }
      }

      out[i] = { x: bx, y: by };
      px[placed] = bx; py[placed] = by; pw[placed] = w; ph[placed] = h;
      placed++;
    }
    return out;
  }

  window.KitLabels = { layoutLabels: layoutLabels };
})();
