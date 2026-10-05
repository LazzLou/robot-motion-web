import {TAU, RADIUS, MAX_OBSTACLES, defaults, wrap, joints, collides, collisionGrid, resetConfiguration, addObstacle, removeObstacle, configureState} from './geometry.js';
const $ = id => document.getElementById(id);
let state = defaults(), frame = 0, pendingMap = false, coarse = false;
const svgNS = 'http://www.w3.org/2000/svg';
const point = p => [240 + p[0] * 100, 240 - p[1] * 100];
function element(tag, attrs, parent) { const el = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); parent.append(el); return el; }
const obstacleNodes = new Map();
function htmlElement(tag, attrs, parent, text) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  parent.append(el);
  return el;
}
function createObstacleControls(id) {
  const group = element('g', {class:'obstacle', tabindex:0, role:'group'}, $('obstacles'));
  const circle = element('circle', {class:'obstacle-circle'}, group);
  const number = element('text', {class:'obstacle-number', 'text-anchor':'middle', dy:4, 'aria-hidden':'true'}, group);
  number.textContent = id;
  const row = htmlElement('div', {class:'obstacle-row'}, $('obstacle-controls'));
  const label = htmlElement('label', {for:`obstacle-size-${id}`}, row, `Obstacle ${id}`);
  const output = htmlElement('output', {for:`obstacle-size-${id}`}, label);
  const slider = htmlElement('input', {id:`obstacle-size-${id}`, type:'range', min:1, max:3, step:0.1, value:1, 'aria-label':`Obstacle ${id} size multiplier`}, row);
  const remove = htmlElement('button', {type:'button', 'aria-label':`Remove obstacle ${id}`}, row, 'Remove');
  slider.addEventListener('input', () => {
    const obstacle = state.obstacles.find(obstacle => obstacle.id === id);
    if (!obstacle) return;
    obstacle.scale = Number(slider.value);
    update(true, true);
  });
  slider.addEventListener('change', () => update(true, false));
  slider.addEventListener('pointercancel', () => update(true, false));
  slider.addEventListener('blur', () => { if (coarse) update(true, false); });
  remove.addEventListener('click', () => {
    state = removeObstacle(state, id);
    update(true, false);
    $('add-obstacle').focus();
  });
  drag(group, event => {
    const obstacle = state.obstacles.find(obstacle => obstacle.id === id);
    if (!obstacle) return;
    const p = localPoint($('workspace'), event);
    obstacle.x = clamp((p.x - 240) / 100, -2, 2);
    obstacle.y = clamp((240 - p.y) / 100, -2, 2);
    update(true, true);
  }, true);
  group.addEventListener('keydown', event => {
    const directions = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,1], ArrowDown:[0,-1]};
    const direction = directions[event.key];
    const obstacle = state.obstacles.find(obstacle => obstacle.id === id);
    if (!direction || !obstacle) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.02;
    obstacle.x = clamp(obstacle.x + direction[0] * step, -2, 2);
    obstacle.y = clamp(obstacle.y + direction[1] * step, -2, 2);
    update(true, false);
  });
  return {group, circle, row, slider, output};
}
function syncObstacles() {
  const ids = new Set(state.obstacles.map(obstacle => obstacle.id));
  for (const [id, nodes] of obstacleNodes) if (!ids.has(id)) {
    nodes.group.remove();
    nodes.row.remove();
    obstacleNodes.delete(id);
  }
  for (const obstacle of state.obstacles) {
    let nodes = obstacleNodes.get(obstacle.id);
    if (!nodes) {
      nodes = createObstacleControls(obstacle.id);
      obstacleNodes.set(obstacle.id, nodes);
    }
    const p = point([obstacle.x, obstacle.y]);
    nodes.group.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    nodes.group.setAttribute('aria-label', `Obstacle ${obstacle.id}, x ${obstacle.x.toFixed(2)}, y ${obstacle.y.toFixed(2)}, size ${obstacle.scale.toFixed(1)} times. Use arrow keys to move.`);
    nodes.circle.setAttribute('r', RADIUS * obstacle.scale * 100);
    nodes.slider.value = obstacle.scale;
    nodes.slider.setAttribute('aria-valuetext', `${obstacle.scale.toFixed(1)} times original size`);
    nodes.output.value = `${obstacle.scale.toFixed(1)}×`;
  }
  const count = state.obstacles.length;
  $('add-obstacle').disabled = count >= MAX_OBSTACLES;
  const text = count === 0 ? 'No obstacles. Add an obstacle to explore collisions.' : `${count} of ${MAX_OBSTACLES} obstacles${count === MAX_OBSTACLES ? ' · limit reached' : ''}`;
  if ($('obstacle-count').textContent !== text) $('obstacle-count').textContent = text;
}
function drawArc(center, start, angle, label) {
  if (angle < .02) return;
  const r = 34, pts = [];
  for(let i=0;i<=48;i++){ const a=start+angle*i/48; pts.push(`${center[0]+r*Math.cos(a)},${center[1]-r*Math.sin(a)}`); }
  element('polyline',{points:pts.join(' '),class:'angle-arc'},$('arcs'));
  if(angle>Math.PI/4){ const a=start+angle/2; const t=element('text',{x:center[0]+48*Math.cos(a),y:center[1]-48*Math.sin(a),'text-anchor':'middle',class:'angle-label'},$('arcs')); t.textContent=label; }
}
function renderPose() {
  const hit=collides(state.theta1,state.theta2,state.obstacles), pts=joints(state.theta1,state.theta2).map(point);
  $('arm').replaceChildren(); $('arcs').replaceChildren();
  for(let i=0;i<2;i++){
    const attrs={d:`M${pts[i].join(' ')}L${pts[i+1].join(' ')}`};
    const edge=element('path',{...attrs,class:'arm-link'},$('arm')); if(hit)edge.style.stroke='#b0322d';
    element('path',{...attrs,class:'arm-inner'},$('arm'));
  }
  for(const p of pts)element('circle',{cx:p[0],cy:p[1],r:4,class:'joint'},$('arm'));
  drawArc(pts[0],0,state.theta1,'θ₁'); drawArc(pts[1],state.theta1,state.theta2,'θ₂');
  syncObstacles();
  $('locator').setAttribute('transform',`translate(${state.theta1/TAU*400} ${400-state.theta2/TAU*400})`);
  $('locator').classList.toggle('colliding',hit); $('status').classList.toggle('colliding',hit);
  $('status-text').textContent=hit?'Collision detected':'Collision-free configuration';
  for(const key of ['theta1','theta2']){const deg=(state[key]/TAU*360).toFixed(1);$(key).value=deg;if(document.activeElement!==$(key+'-number'))$(key+'-number').value=deg;}
  $('quality').value=state.quality; $('quality-value').value=state.quality;
}
function renderMap(){
  const n=state.quality*(coarse?8:32), grid=collisionGrid(state.obstacles,n), canvas=$('map');canvas.width=n;canvas.height=n;
  const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(n,n);
  grid.forEach((hit,i)=>{pixels.data.set(hit?[102,113,123,255]:[255,255,255,255],i*4);});ctx.putImageData(pixels,0,0);
  $('resolution').textContent=`${n} × ${n} samples${coarse?' · preview':''}`;
}
function update(map=false, low=false){pendingMap ||= map;if(map)coarse=low;if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderPose();if(pendingMap){renderMap();pendingMap=false;}});}
function localPoint(svg,event){const p=new DOMPoint(event.clientX,event.clientY);return p.matrixTransform(svg.getScreenCTM().inverse());}
function drag(el, move, refine){let active=null;el.addEventListener('pointerdown',e=>{if(e.button!==0)return;active=e.pointerId;el.setPointerCapture(active);el.focus();move(e);e.preventDefault();});el.addEventListener('pointermove',e=>{if(e.pointerId===active)move(e);});const end=e=>{if(e.pointerId!==active)return;active=null;if(refine)update(true,false);};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
$('add-obstacle').addEventListener('click', () => {
  const previous = state;
  state = addObstacle(state);
  if (state !== previous) update(true, false);
});
drag($('map-control'),e=>{const p=localPoint($('map-control'),e);state.theta1=wrap(clamp(p.x,0,400)/400*TAU);state.theta2=wrap((1-clamp(p.y,0,400)/400)*TAU);update();},false);
$('map-control').addEventListener('keydown',e=>{const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(!dirs[e.key])return;e.preventDefault();const step=(e.shiftKey?10:1)*TAU/360;state.theta1=wrap(state.theta1+dirs[e.key][0]*step);state.theta2=wrap(state.theta2+dirs[e.key][1]*step);update();});
for(const key of ['theta1','theta2']){
  $(key).addEventListener('input',e=>{state[key]=wrap(Number(e.target.value)*TAU/360);update();});
  $(key+'-number').addEventListener('input',e=>{if(e.target.value===''||!e.target.validity.valid)return;state[key]=wrap(Number(e.target.value)*TAU/360);update();});
  $(key+'-number').addEventListener('blur',()=>{renderPose();});
}
$('quality').addEventListener('input',e=>{state.quality=Number(e.target.value);update(true,true);});
$('quality').addEventListener('change',()=>update(true,false));
function reset(){state=resetConfiguration(state);update(true,false);}
$('reset').addEventListener('click',reset);
renderPose();renderMap();
const readState=()=>({...structuredClone(state),collision:collides(state.theta1,state.theta2,state.obstacles)});
async function settled(){await new Promise(requestAnimationFrame);return readState();}
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_robot_state',description:'Read robot angles in radians, numbered obstacles with x/y positions and size multipliers, quality and collision status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readState},
    {name:'set_robot_state',description:'Set joint angles in radians, zero to four numbered obstacles with size multipliers from 1 to 3, or map quality.',inputSchema:{type:'object',properties:{theta1:{type:'number'},theta2:{type:'number'},obstacles:{type:'array',minItems:0,maxItems:4,items:{type:'object',properties:{id:{type:'integer',minimum:1,maximum:4},x:{type:'number',minimum:-2,maximum:2},y:{type:'number',minimum:-2,maximum:2},scale:{type:'number',minimum:1,maximum:3}},required:['id','x','y','scale'],additionalProperties:false}},quality:{type:'integer',minimum:1,maximum:10}},additionalProperties:false},execute:async input=>{
      state=configureState(state,input);update('obstacles'in input||'quality'in input);return settled();
    }},
    {name:'reset_robot_state',description:'Restore the initial robot pose and two original obstacles at 1 times size, preserving map quality.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>{reset();return settled();}}
  ];
  for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool({...tool,annotations:{readOnlyHint:false,untrustedContentHint:false,...tool.annotations}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
