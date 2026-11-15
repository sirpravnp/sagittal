// Figure player helpers that need no WebGL: the orientation cue (player/player.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadClassic } from './helpers/loadClassic.mjs';

const { SagittalPlayer } = loadClassic('player/player.js');
const o = (x, y) => SagittalPlayer.orientation([x, y]).text;
const PI = Math.PI;

test('orientation names where the viewer stands and which side is the patient’s right', () => {
  assert.equal(o(0, 0), 'Anterior view · patient’s right on screen left');
  assert.equal(o(0, PI), 'Posterior view · patient’s right on screen right');
  assert.equal(o(0, PI / 2), 'Right lateral view');
  assert.equal(o(0, -PI / 2), 'Left lateral view');
  assert.equal(o(1.4, 0), 'Superior view (from above) · patient\u2019s right on screen left');
  assert.equal(o(-1.4, 0.3), 'Inferior view (from below) · patient\u2019s right on screen left');
  // obliques: the model turned 45 degrees to show its right side from the front, or from behind
  assert.equal(o(0, PI / 4), 'Right anterior oblique view · patient’s right on screen left');
  assert.equal(o(0, 3 * PI / 4), 'Right posterior oblique view · patient’s right on screen right');
  assert.equal(o(0.5, 0), 'Anterior view, from above · patient’s right on screen left');
});
