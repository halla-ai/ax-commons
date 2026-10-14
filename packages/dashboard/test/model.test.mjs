import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCells} from '../public/model.mjs';
test('dashboard rendering boundary never exposes small or malformed cells', () => {
  const cell = {task_type: 'writing', human_reviewed: true, reused: true, skill_id: null, count: 5};
  assert.deepEqual(publicCells([null, {...cell, count: 4}, {...cell, count: '5'}, {...cell, count: -1}, {...cell, human_reviewed: 'yes'}, cell]), [cell]);
  assert.deepEqual(publicCells(null), []);
});
