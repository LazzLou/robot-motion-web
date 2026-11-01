// Optional browser regression/profiling harness. See README for setup.
import assert from 'node:assert/strict';
import {writeFile, readFile, lstat} from 'node:fs/promises';
import http from 'node:http';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,chromiumSandbox:true});
const page=await browser.newPage({viewport:{width:1200,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  window.robotTools={};
  Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.robotTools[tool.name]=tool;}}});
  window.metrics={frames:[],maps:[],events:[]};
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>raf(t=>{const start=performance.now();cb(t);window.metrics.frames.push(performance.now()-start);});
  const put=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(...args){window.metrics.maps.push({at:performance.now(),n:this.canvas.width});return put.apply(this,args);};
  for(const name of ['input','pointermove'])document.addEventListener(name,()=>window.metrics.events.push(performance.now()),true);
});
const set=async input=>page.evaluate(input=>window.robotTools.set_robot_state.execute(input),input);
const read=()=>page.evaluate(()=>window.robotTools.read_robot_state.execute());
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const obs=(count,scale)=>Array.from({length:count},(_,i)=>({id:i+1,x:i<2?1.1:-1.1,y:i%2?-1.1:1.1,scale}));
const summaries=[];
const interactionMetrics=()=>page.evaluate(()=>{
  const {frames,maps,events}=window.metrics;
  const latency=events.map(t=>maps.find(m=>m.at>=t)?.at-t).filter(Number.isFinite).sort((a,b)=>a-b);
  const sorted=[...frames].sort((a,b)=>a-b);
  return {mapCount:maps.length,resolutions:[...new Set(maps.map(m=>m.n))],maxCallback:Math.max(...frames),p95Callback:sorted[Math.floor(sorted.length*.95)],p95EventToMap:latency[Math.floor(latency.length*.95)]};
});
let baselineServer;
try {
  const urls=[['full','http://127.0.0.1:4173']];
  if(process.env.BASELINE_DIR){
    // Load only regular app files once; requests cannot traverse the filesystem.
    const baselineFiles=new Map();
    for(const name of ['index.html','app.js','geometry.js','style.css']) {
      const path=`${process.env.BASELINE_DIR}/${name}`;
      assert.ok((await lstat(path)).isFile(), `Baseline ${name} must be a regular file`);
      baselineFiles.set('/'+name,await readFile(path));
    }
    baselineServer=http.createServer((req,res)=>{
      const path=req.url==='/'?'/index.html':req.url;
      if(!baselineFiles.has(path)){res.writeHead(404);res.end('Not found');return;}
      res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
      res.end(baselineFiles.get(path));
    }).listen(4174,'127.0.0.1');
    urls.unshift(['preview','http://127.0.0.1:4174']);
  }
  for(const [mode,url] of (process.env.CHECK_ONLY?[]:urls)){
    await page.goto(url);await page.waitForSelector('.obstacle');
    for(const count of [2,4])for(const scale of [1,3])for(const quality of [1,2,5,10]){
      await set({obstacles:obs(count,scale),quality});
      const computation=await page.evaluate(async({quality,count,scale})=>{
        const {collisionGrid}=await import('./geometry.js');
        const obstacles=window.robotTools.read_robot_state.execute().obstacles;
        const out={};
        for(const factor of [8,32]){const samples=[];for(let i=0;i<23;i++){const t=performance.now();collisionGrid(obstacles,quality*factor);if(i>=3)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);out[factor]={median:samples[10],p95:samples[19]};}return out;
      },{quality,count,scale});
      const box=await page.locator('.obstacle').first().boundingBox();
      await page.evaluate(()=>window.metrics={frames:[],maps:[],events:[]});
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      for(let i=1;i<=24;i++)await page.mouse.move(box.x+box.width/2+i*2,box.y+box.height/2+Math.sin(i/4)*15);
      // Release outside the original obstacle.
      await page.mouse.up();await settle();
      const interaction=await interactionMetrics();
      const sliderInteraction={};
      for (const id of ['obstacle-size-1','quality']) {
        const slider=page.locator('#'+id);await slider.scrollIntoViewIfNeeded();const bounds=await slider.boundingBox();
        await page.evaluate(()=>window.metrics={frames:[],maps:[],events:[]});
        const fraction=id==='quality'?(quality-1)/9:(scale-1)/2;
        const x=bounds.x+7+fraction*(bounds.width-14), y=bounds.y+bounds.height/2;
        await page.mouse.move(x,y);await page.mouse.down();
        for(let step=0;step<6;step++)await page.mouse.move(x+(step%2===0?-1:0)*Math.min(20,x-bounds.x-2)+ (fraction===0&&step%2===0?20:0),y);
        await page.mouse.move(x,y);await page.mouse.up();await settle();
        sliderInteraction[id]=await interactionMetrics();
      }
      await page.locator('#workspace').scrollIntoViewIfNeeded();
      const finalResolution=Number(await page.locator('#map').getAttribute('width'));
      if(mode==='full')assert.equal(finalResolution,32*quality);
      summaries.push({mode,count,scale,quality,finalResolution,computation,interaction,sliderInteraction});
    }
  }
  if(!process.env.CHECK_ONLY)await writeFile('/tmp/robot-performance.json',JSON.stringify(summaries,null,2));
  await page.goto('http://127.0.0.1:4173');await page.waitForSelector('.obstacle');
  // Native keyboard, mouse and final-quality regression checks on the new version.
  await set({quality:10,obstacles:obs(4,3)});
  const quality=page.locator('#quality');
  await quality.focus();await page.keyboard.press('Home');await page.keyboard.press('End');await settle();
  assert.equal((await read()).quality,10);
  for(const id of ['quality','obstacle-size-1']){
    const slider=page.locator('#'+id);await slider.scrollIntoViewIfNeeded();const b=await slider.boundingBox();
    await page.mouse.move(b.x+b.width-3,b.y+b.height/2);await page.mouse.down();
    await page.mouse.move(b.x+3,b.y+b.height/2);await page.mouse.move(b.x+b.width-3,b.y+b.height/2);
    await page.mouse.move(b.x+b.width+70,b.y-50);await page.mouse.up();await settle();
    assert.equal(await page.locator('#map').getAttribute('width'),String((await read()).quality*32));
  }
  // Same-frame rapid inputs, returning to the start, cancellation and focus loss.
  await page.evaluate(()=>{window.metrics={frames:[],maps:[],events:[]};for(const [id,values] of [['quality',[1,5,2,10]],['obstacle-size-1',[1,2,3]]]){const el=document.getElementById(id);for(const value of values){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}el.dispatchEvent(new Event('pointercancel'));el.dispatchEvent(new Event('lostpointercapture'));el.blur();}window.dispatchEvent(new Event('blur'));});
  await settle();assert.equal(await page.locator('#map').getAttribute('width'),'320');
  assert.equal(await page.evaluate(()=>window.metrics.maps.length),1,'batch all same-frame input changes');
  await page.locator('.obstacle').first().focus();const before=await read();await page.keyboard.press('Shift+ArrowLeft');await settle();assert.ok(Math.abs((await read()).obstacles[0].x-before.obstacles[0].x+.1)<1e-10);
  await page.locator('#map-control').focus();const angle=(await read()).theta1;
  const mapsBefore=await page.evaluate(()=>window.metrics.maps.length);
  await page.keyboard.press('ArrowRight');await settle();assert.ok(Math.abs((await read()).theta1-angle-Math.PI/180)<1e-10);
  await page.locator('#theta2').focus();await page.keyboard.press('ArrowRight');
  await page.locator('#theta1-number').fill('264');await page.locator('#theta2-number').fill('83.5');await settle();
  assert.equal(await page.evaluate(()=>window.metrics.maps.length),mapsBefore,'angle controls reuse map');
  await set({quality:1,obstacles:obs(2,1)});
  for(const [theta1,theta2,hit,cell] of [[264,83.5,false,102],[6.5,63,true,255]]){
    await set({theta1:theta1*Math.PI/180,theta2:theta2*Math.PI/180});
    assert.equal((await read()).collision,hit);assert.equal(await page.locator('#status').evaluate(el=>el.classList.contains('colliding')),hit);
    assert.equal(await page.evaluate(({theta1,theta2})=>document.querySelector('#map').getContext('2d').getImageData(Math.floor(theta1/360*32),Math.floor((1-theta2/360)*32),1,1).data[0],{theta1,theta2}),cell);
  }
  await set({theta1:0,theta2:0,obstacles:[{id:1,x:.5,y:.26,scale:1}]});assert.equal((await read()).collision,false);
  await page.locator('#status').click(); // Blur numeric input before programmatic scene changes.
  await set({theta1:21/38*2*Math.PI,theta2:10/19*2*Math.PI});
  for(const width of [1200,375,320]){
    await page.setViewportSize({width,height:1000});await page.locator('#workspace').scrollIntoViewIfNeeded();
    const layout=await page.evaluate(()=>{
      const svg=document.querySelector('#workspace');
      return {overflow:document.documentElement.scrollWidth>innerWidth,ticks:[...svg.querySelectorAll('.x-ticks text,.y-ticks text')].map(el=>({anchor:getComputedStyle(el).textAnchor,x:el.getAttribute('x'),y:el.getAttribute('y'),box:((b)=>({x:b.x,y:b.y,width:b.width,height:b.height}))(el.getBBox())})),arm:parseFloat(getComputedStyle(document.querySelector('.arm-link')).strokeWidth),obstacle:+document.querySelector('.obstacle-circle').getAttribute('r')+parseFloat(getComputedStyle(document.querySelector('.obstacle-circle')).strokeWidth)/2};
    });
    assert.equal(layout.overflow,false);assert.equal(layout.arm,25);assert.equal(layout.obstacle,12.5);
    assert.deepEqual(layout.ticks.map(({x,y})=>[x,y]),[['40','256'],['440','256'],['248','440'],['248','40']]);
    assert.deepEqual(layout.ticks.map(t=>t.anchor),['middle','middle','start','start']);
    // Glyph ink may overhang its anchored advance by a fraction of a unit.
    for(const tick of layout.ticks){if(tick.y==='256')assert.ok(Math.abs(tick.box.x+tick.box.width/2-Number(tick.x))<1,JSON.stringify(tick));else assert.ok(Math.abs(tick.box.y+tick.box.height/2-Number(tick.y))<2);}
    await page.screenshot({path:`/tmp/robot-${width}.png`,fullPage:true});
  }
  for(const scale of [1,1.7,2,3]) {
    await set({obstacles:[{id:1,x:.5,y:.26,scale}]});
    await page.locator('.obstacle').focus();
    assert.equal(await page.locator('.obstacle-circle').evaluate(el=>+el.getAttribute('r')+parseFloat(getComputedStyle(el).strokeWidth)/2),12.5*scale);
  }
  await page.locator('#workspace').scrollIntoViewIfNeeded();
  const obstacleBox=await page.locator('.obstacle').boundingBox();
  await page.mouse.move(obstacleBox.x+obstacleBox.width/2,obstacleBox.y+obstacleBox.height/2);
  await page.mouse.down();await page.mouse.move(obstacleBox.x+100,obstacleBox.y+100);await page.mouse.up();await settle();
  const mapBox=await page.locator('#map-control').boundingBox();
  const mapCount=await page.evaluate(()=>window.metrics.maps.length);
  await page.mouse.move(mapBox.x+mapBox.width/2,mapBox.y+mapBox.height/2);await page.mouse.down();await page.mouse.move(mapBox.x+mapBox.width/3,mapBox.y+mapBox.height/3);await page.mouse.up();await settle();
  assert.equal(await page.evaluate(()=>window.metrics.maps.length),mapCount,'map pointer uses existing collision map');
  assert.equal(await page.evaluate(async()=>{
    const {collisionGrid}=await import('./geometry.js');const s=window.robotTools.read_robot_state.execute();
    const canvas=document.querySelector('#map'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    return collisionGrid(s.obstacles,32*s.quality).every((hit,i)=>pixels[i*4]===(hit?102:255));
  }),true,'final map matches final obstacle state');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',scenarios:summaries.length,measurements:'/tmp/robot-performance.json',summaries}));
} finally {await browser.close();baselineServer?.close();}
