// Label collision layout. Classic script: assigns window.KitLabels = { layoutLabels }.
(function () {
  var GAP = 2;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // anchors: [{x,y,w,h,lx?}] (top-left + size; lx: optional alternative x, e.g. the label
  // mirrored to the other side of its anchor dot); bounds: {w,h}.
  // obstacles (optional): [{x,y,w,h}] rects no label may cover (e.g. leader anchor dots).
  // Returns [{x,y}] in the same order. Greedy, top-to-bottom: each label takes the
  // free in-bounds position nearest its (clamped) anchor, chosen from the anchor itself,
  // its alternative side and positions just above/below/beside already-placed labels and
  // obstacles (O(n^2) overall). If nothing is free (total area too large), the clamped
  // anchor is used.
  function layoutLabels(anchors, bounds, obstacles) {
    var n = anchors.length;
    obstacles = obstacles || [];
    var out = new Array(n);
    var px = [], py = [], pw = [], ph = [];
    var placed = 0;
    for (var o = 0; o < obstacles.length; o++) {
      px[placed] = obstacles[o].x; py[placed] = obstacles[o].y; pw[placed] = obstacles[o].w; ph[placed] = obstacles[o].h;
      placed++;
    }
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
        if (a.lx !== undefined) {
          var lx = clamp(a.lx, 0, maxX);
          tryCand(lx, ay);
          for (j = 0; j < placed; j++) { tryCand(lx, py[j] + ph[j] + GAP); tryCand(lx, py[j] - h - GAP); }
        }
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
