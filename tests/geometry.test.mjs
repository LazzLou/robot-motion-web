import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TAU,defaults,wrap,joints,segmentDistance,collides,collisionGrid} from '../dist/geometry.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const obstacle=(x,y,scale=1,id=1)=>({id,x,y,scale});
test('kinematics and relative elbow angle',()=>{assert.deepEqual(joints(0,0),[[0,0],[1,0],[2,0]]);const p=joints(Math.PI/2,-Math.PI/2);near(p[2][0],1);near(p[2][1],1);});
test('segment distances clamp to endpoints and handle zero length',()=>{near(segmentDistance([2,1],[0,0],[1,0]),Math.SQRT2);near(segmentDistance([.5,1],[0,0],[1,0]),1);near(segmentDistance([-1,0],[0,0],[1,0]),1);near(segmentDistance([3,4],[0,0],[0,0]),5);});
test('inclusive collision threshold and both links',()=>{assert.equal(collides(0,0,[obstacle(.5,.25)]),true);assert.equal(collides(0,0,[obstacle(.5,.249)]),true);assert.equal(collides(0,0,[obstacle(1.5,0)]),true);assert.equal(collides(Math.PI/2,0,[obstacle(1.5,0)]),false);assert.equal(collides(0,0,[obstacle(0,0)]),true);});
test('periodicity and defaults',()=>{near(wrap(-.2),TAU-.2);near(wrap(TAU),0);const d=defaults();near(d.theta1,21*Math.PI/19);near(d.theta2,20*Math.PI/19);assert.equal(d.quality,2);for(let a=0;a<TAU;a+=.1)assert.equal(collides(a,.7,d.obstacles),collides(a+TAU,.7+TAU,d.obstacles));});
test('grid uses centered samples with theta2 increasing upward',()=>{const obs=[obstacle(1.4,.5),obstacle(-.8,-.6)],n=32,g=collisionGrid(obs,n);assert.equal(g.length,n*n);for(let r=0;r<n;r++)for(let c=0;c<n;c++)assert.equal(g[r*n+c],+collides(TAU*(c+.5)/n,TAU*(1-(r+.5)/n),obs));assert.notDeepEqual([...g.slice(0,n)],[...g.slice(-n)]);});
test('unreachable obstacles leave grid clear, base obstacle blocks all',()=>{assert.ok(collisionGrid([obstacle(2,2),obstacle(-2,-2)],16).every(v=>v===0));assert.ok(collisionGrid([obstacle(0,0),obstacle(2,2)],16).every(v=>v===1));});
test('resized obstacles include arm half-width and include contact boundaries',()=>{
  assert.equal(collides(0,0,[obstacle(.5,.375,1)]),false);
  assert.equal(collides(0,0,[obstacle(.5,.375,2)]),true);
  assert.equal(collides(0,0,[obstacle(.5,.374,2)]),true);
  assert.equal(collides(0,0,[obstacle(1.5,.5,3)]),true);
  assert.equal(collides(0,0,[obstacle(1.5,.499,3)]),true);
  assert.equal(collides(0,0,[obstacle(2.4,0,3)]),true);
});
test('zero to four obstacles and increased sizes produce consistent collision maps',()=>{
  assert.equal(collides(0,0,[]),false);
  assert.ok(collisionGrid([],16).every(value=>value===0));
  const all=[obstacle(1.1,1.1,1,1),obstacle(1.1,-1.1,1,2),obstacle(-1.1,1.1,1,3),obstacle(-1.1,-1.1,1,4)];
  let previous=new Uint8Array(32*32);
  for(let count=1;count<=4;count++){
    const grid=collisionGrid(all.slice(0,count),32);
    grid.forEach((value,index)=>assert.ok(value>=previous[index]));
    previous=grid;
  }
  const enlarged=collisionGrid(all.map(obstacle=>({...obstacle,scale:3})),32);
  enlarged.forEach((value,index)=>assert.ok(value>=previous[index]));
  assert.ok(enlarged.reduce((sum,value)=>sum+value,0)>previous.reduce((sum,value)=>sum+value,0));
});

test('contact, separation and overlap on both links and rounded caps at every scale',()=>{
  for (const scale of [1, 1.7, 2, 3]) {
    const radius=.125*(1+scale);
    // First link side, second link side, base cap, tip cap and bent elbow cap.
    for (const [a,b,x,y,nx,ny] of [[0,0,.5,0,0,1],[0,0,1.5,0,0,-1],
      [0,0,0,0,-1,0],[0,0,2,0,1,0],[0,Math.PI/2,1,0,Math.SQRT1_2,-Math.SQRT1_2]]) {
      for (const [delta,expected] of [[0,true],[-1e-7,true],[1e-7,false]]) {
        assert.equal(collides(a,b,[obstacle(x+nx*(radius+delta),y+ny*(radius+delta),scale)]),expected);
      }
    }
  }
  assert.equal(collides(0,0,[obstacle(.5,.26)]),false);
});
test('exact poses can disagree with sampled cells in either direction',()=>{
  const obstacles=defaults().obstacles,n=32,grid=collisionGrid(obstacles,n);
  for(const [a,b,hit,cell] of [[264,83.5,false,1],[6.5,63,true,0]]) {
    assert.equal(collides(a*TAU/360,b*TAU/360,obstacles),hit);
    assert.equal(grid[Math.floor((1-b/360)*n)*n+Math.floor(a/360*n)],cell);
  }
});
test('optimized sampling agrees with exact collision across qualities and sizes',()=>{
  for(const n of [32,64,160,320]) {
    const obstacles=[obstacle(1.1,1.1,3),obstacle(1.1,-1.1,1.7,2),obstacle(-1.1,1.1,2,3),obstacle(-1.1,-1.1,1,4)];
    const grid=collisionGrid(obstacles,n);
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)assert.equal(grid[r*n+c],+collides(TAU*(c+.5)/n,TAU*(1-(r+.5)/n),obstacles));
  }
});
test('sampled poses include boundary contact just like exact poses',()=>{
  const n=32,col=3,row=7,a=TAU*(col+.5)/n,b=TAU*(1-(row+.5)/n);
  const [,elbow,tip]=joints(a,b);
  const dx=tip[0]-elbow[0],dy=tip[1]-elbow[1];
  for(const scale of [1,2,3]){
    const clearance=.125*(1+scale);
    const obstacles=[obstacle(tip[0]+dx*clearance,tip[1]+dy*clearance,scale)];
    assert.equal(collides(a,b,obstacles),true);
    assert.equal(collisionGrid(obstacles,n)[row*n+col],1);
  }
});
