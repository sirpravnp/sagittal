import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/loadClassic.mjs';

const win = loadClassic(new URL('../site/kit/labels.js', import.meta.url).pathname);
const { layoutLabels } = win.KitLabels;

const overlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const rects = (anchors, pos) => anchors.map((a, i) => ({ x: pos[i].x, y: pos[i].y, w: a.w, h: a.h }));

function assertNoOverlap(rs) {
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++)
      assert.ok(!overlap(rs[i], rs[j]), `rects ${i} and ${j} overlap`);
}

function assertInside(rs, b) {
  for (const r of rs) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= b.w && r.y + r.h <= b.h, 'rect outside bounds');
  }
}

test('two anchors at the same point do not overlap', () => {
  const anchors = [{ x: 100, y: 100, w: 60, h: 16 }, { x: 100, y: 100, w: 60, h: 16 }];
  const pos = layoutLabels(anchors, { w: 400, h: 300 });
  assert.equal(pos.length, 2);
  assertNoOverlap(rects(anchors, pos));
});

test('anchor beyond the right edge is clamped inside bounds', () => {
  const anchors = [{ x: 390, y: 50, w: 60, h: 16 }];
  const bounds = { w: 400, h: 300 };
  const pos = layoutLabels(anchors, bounds);
  assertInside(rects(anchors, pos), bounds);
});

test('isolated anchor is returned unchanged', () => {
  const pos = layoutLabels([{ x: 50, y: 60, w: 40, h: 12 }], { w: 400, h: 300 });
  assert.deepEqual(JSON.parse(JSON.stringify(pos)), [{ x: 50, y: 60 }]); // JSON: result comes from another vm realm
});

test('30 anchors in 300x500 do not overlap and stay inside', () => {
  const bounds = { w: 300, h: 500 };
  const anchors = [];
  for (let i = 0; i < 30; i++) anchors.push({ x: 100 + (i % 3) * 5, y: 200 + (i % 7) * 3, w: 80, h: 16 });
  const pos = layoutLabels(anchors, bounds);
  assert.equal(pos.length, 30);
  const rs = rects(anchors, pos);
  assertNoOverlap(rs);
  assertInside(rs, bounds);
});

test('returns positions in input order', () => {
  const anchors = [{ x: 10, y: 200, w: 40, h: 12 }, { x: 10, y: 20, w: 40, h: 12 }];
  const pos = layoutLabels(anchors, { w: 400, h: 300 });
  assert.deepEqual(JSON.parse(JSON.stringify(pos)), [{ x: 10, y: 200 }, { x: 10, y: 20 }]);
});

test('impossible fit still returns positions clamped inside bounds', () => {
  const bounds = { w: 100, h: 40 };
  const anchors = [];
  for (let i = 0; i < 10; i++) anchors.push({ x: 0, y: 0, w: 100, h: 20 });
  const pos = layoutLabels(anchors, bounds);
  assertInside(rects(anchors, pos), bounds);
});

test('labels never cover an obstacle (anchor dot) when there is room', () => {
  const bounds = { w: 400, h: 300 };
  const dot = { x: 96, y: 96, w: 9, h: 9 };
  const anchors = [{ x: 90, y: 92, w: 60, h: 16 }];
  const pos = layoutLabels(anchors, bounds, [dot]);
  const r = rects(anchors, pos)[0];
  assert.ok(!overlap(r, dot), 'label covers the obstacle');
  assertInside([r], bounds);
});

test('a label flips to the other side of its dot when the preferred side is taken', () => {
  const bounds = { w: 300, h: 300 };
  // a full-height label occupies the space right of the second anchor's dot (at x 200)
  const anchors = [{ x: 216, y: 0, w: 80, h: 300 }, { x: 216, y: 100, w: 60, h: 16, lx: 124 }];
  const pos = layoutLabels(anchors, bounds, [{ x: 196, y: 104, w: 9, h: 9 }]);
  const rs = rects(anchors, pos);
  assertNoOverlap(rs);
  assert.ok(pos[1].x + 60 <= 196, 'label moved to the left of its dot');
  assert.equal(pos[1].y, 100);
});

test('obstacles are optional and do not change the default result', () => {
  const anchors = [{ x: 50, y: 60, w: 40, h: 12 }];
  assert.deepEqual(JSON.parse(JSON.stringify(layoutLabels(anchors, { w: 400, h: 300 }, []))), [{ x: 50, y: 60 }]);
});
