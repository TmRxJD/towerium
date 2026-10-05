import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistAim} from '../scripts/aim-assist.mjs';
const state={view_extent:650,range:360,enemies:[[1,0,100,0,2,2,0]],drops:[]};
test('touch snap is limited to a small screen-space neighborhood and leaves raw aim intact',()=>{
  const aim=[140,0];assert.deepEqual(assistAim(state,aim,14,320),[100,0]);assert.deepEqual(aim,[140,0]);
  assert.deepEqual(assistAim(state,[170,0],14,320),[170,0]);
  assert.deepEqual(assistAim(state,aim,0,320),aim);
});
test('snap excludes dead enemies and targets outside Light Speed range',()=>{
  const beyond={...state,enemies:[[1,0,400,0,2,2,0],[2,0,405,0,0,2,0]]};
  assert.deepEqual(assistAim(beyond,[410,0],14,320,1),[410,0]);
  assert.deepEqual(assistAim(beyond,[410,0],14,320,0),[400,0]);
});
test('powerups can be deliberately collected with the same bounded snap',()=>{
  const drop={...state,enemies:[],drops:[[1,0,100,0,10]]};
  assert.deepEqual(assistAim(drop,[140,0],14,320),[100,0]);
});
