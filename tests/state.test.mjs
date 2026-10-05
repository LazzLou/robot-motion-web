import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TAU,defaults,addObstacle,removeObstacle,resetConfiguration,configureState,collisionGrid} from '../dist/geometry.js';

test('adding stops at four and reuses the first available numbered position',()=>{
  let state=defaults();
  state=addObstacle(addObstacle(state));
  assert.deepEqual(state.obstacles.map(obstacle=>obstacle.id),[1,2,3,4]);
  assert.strictEqual(addObstacle(state),state);
  state=removeObstacle(state,2);
  state=addObstacle(state);
  assert.deepEqual(state.obstacles.at(-1),{id:2,x:1.1,y:-1.1,scale:1});
});
test('all obstacles can be removed and numbering starts over when adding',()=>{
  let state=defaults();
  for(const id of [1,2])state=removeObstacle(state,id);
  assert.deepEqual(state.obstacles,[]);
  assert.ok(collisionGrid(state.obstacles,16).every(value=>value===0));
  assert.deepEqual(addObstacle(state).obstacles,[{id:1,x:1.1,y:1.1,scale:1}]);
});
test('Reset restores arm and initial obstacles while retaining every quality setting',()=>{
  for(let quality=1;quality<=10;quality++){
    const state={theta1:0,theta2:1,quality,obstacles:[{id:4,x:-.2,y:.5,scale:3}]};
    const copy=structuredClone(state);
    assert.deepEqual(resetConfiguration(state),{...defaults(),quality});
    assert.deepEqual(state,copy);
  }
  const state={...defaults(),quality:7,obstacles:[]};
  assert.deepEqual(resetConfiguration(state).obstacles,defaults().obstacles);
});
test('automation supports zero or four individually sized obstacles and wrapped angles',()=>{
  const state=defaults();
  const updated=configureState(state,{theta1:-.5,theta2:TAU,obstacles:[],quality:8});
  assert.equal(updated.theta1,TAU-.5);
  assert.equal(updated.theta2,0);
  assert.equal(updated.quality,8);
  assert.deepEqual(updated.obstacles,[]);
  const obstacles=Array.from({length:4},(_,i)=>({id:i+1,x:0,y:0,scale:i%2?3:1}));
  const result=configureState(updated,{obstacles});
  assert.deepEqual(result.obstacles,obstacles);
  obstacles[0].scale=2;
  assert.equal(result.obstacles[0].scale,1);
  assert.deepEqual(state,defaults());
});
test('invalid automation input fails without partially changing state',()=>{
  const state=defaults(),copy=structuredClone(state);
  const valid={id:1,x:0,y:0,scale:1};
  const invalid=[
    {obstacles:Array(5).fill(valid)},
    {obstacles:[valid,valid]},
    {obstacles:[{...valid,id:5}]},
    {obstacles:[{...valid,scale:.5}]},
    {obstacles:[{...valid,scale:3.1}]},
    {obstacles:[{...valid,scale:NaN}]},
    {obstacles:[{...valid,x:2.01}]},
    {obstacles:[{...valid,y:Infinity}]},
    {obstacles:[{id:1,x:0,y:0}]},
    {obstacles:[[1,1]]},
    {theta1:1,quality:11},
    {theta1:NaN},
    {quality:2.5},
    {unknown:1},
  ];
  for(const input of invalid){assert.throws(()=>configureState(state,input));assert.deepEqual(state,copy);}
});
