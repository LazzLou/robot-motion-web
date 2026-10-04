import {TAU, defaults, wrap, joints, collides, collisionGrid} from './geometry.js';
const $ = id => document.getElementById(id);
let state = defaults(), frame = 0, pendingMap = false, coarse = false;
const svgNS = 'http://www.w3.org/2000/svg';
const point = p => [240 + p[0] * 100, 240 - p[1] * 100];
function element(tag, attrs, parent) { const el = document.createElementNS(svgNS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value); parent.append(el); return el; }
const obstacleNodes = state.obstacles.map((_, i) => element('circle', {r:12.5, class:'obstacle', tabindex:0, role:'button', 'aria-label':`Obstacle ${i+1}. Drag or use arrow keys to move.`}, $('obstacles')));
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
  state.obstacles.forEach((p,i)=>{const q=point(p); obstacleNodes[i].setAttribute('cx',q[0]);obstacleNodes[i].setAttribute('cy',q[1]);obstacleNodes[i].setAttribute('aria-label',`Obstacle ${i+1}, x ${p[0].toFixed(2)}, y ${p[1].toFixed(2)}. Use arrow keys to move.`);});
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
obstacleNodes.forEach((el,i)=>{
  drag(el,e=>{const p=localPoint($('workspace'),e);state.obstacles[i]=[clamp((p.x-240)/100,-2,2),clamp((240-p.y)/100,-2,2)];update(true,true);},true);
  el.addEventListener('keydown',e=>{const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(!dirs[e.key])return;e.preventDefault();state.obstacles[i]=state.obstacles[i].map((v,j)=>clamp(v+dirs[e.key][j]*(e.shiftKey?.1:.02),-2,2));update(true);});
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
function reset(){state=defaults();update(true,false);}
$('reset').addEventListener('click',reset);
renderPose();renderMap();
const readState=()=>({...structuredClone(state),collision:collides(state.theta1,state.theta2,state.obstacles)});
async function settled(){await new Promise(requestAnimationFrame);return readState();}
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const tools=[
    {name:'read_robot_state',description:'Read robot angles in radians, obstacles, quality and collision status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readState},
    {name:'set_robot_state',description:'Set joint angles in radians, the two obstacle positions, or map quality.',inputSchema:{type:'object',properties:{theta1:{type:'number'},theta2:{type:'number'},obstacles:{type:'array',minItems:2,maxItems:2,items:{type:'array',minItems:2,maxItems:2,items:{type:'number',minimum:-2,maximum:2}}},quality:{type:'integer',minimum:1,maximum:10}},additionalProperties:false},execute:async input=>{
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['theta1','theta2','obstacles','quality'].includes(k)))throw Error('Invalid state fields');
      const next=structuredClone(state);
      for(const k of ['theta1','theta2'])if(k in input){if(typeof input[k]!=='number'||!Number.isFinite(input[k]))throw Error('Angles must be finite numbers');next[k]=wrap(input[k]);}
      if('quality'in input){if(!Number.isInteger(input.quality)||input.quality<1||input.quality>10)throw Error('Quality must be an integer from 1 to 10');next.quality=input.quality;}
      if('obstacles'in input){if(!Array.isArray(input.obstacles)||input.obstacles.length!==2||input.obstacles.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v < -2||v>2)))throw Error('Provide two [x,y] points within -2 to 2');next.obstacles=structuredClone(input.obstacles);}
      state=next;update('obstacles'in input||'quality'in input);return settled();
    }},
    {name:'reset_robot_state',description:'Restore the notebook’s initial robot pose, obstacles and quality.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:async()=>{reset();return settled();}}
  ];
  for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool({...tool,annotations:{readOnlyHint:false,untrustedContentHint:false,...tool.annotations}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
