import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/STLLoader.js';
import * as T from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js';

export function createScene(canvas, path, pads, build, zoomIn, zoomOut, loadingManager, rotateLeft, rotateRight, cathedralRoutes=null) {
  const renderer = new T.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new T.Scene();
  const sky=document.createElement('canvas');
  sky.width=768;
  sky.height=512;
  const skyPaint=sky.getContext('2d');
  const night=skyPaint.createLinearGradient(0,0,0,sky.height);
  night.addColorStop(0,'#080c1c');
  night.addColorStop(.57,'#202c48');
  night.addColorStop(1,'#151e33');
  skyPaint.fillStyle=night;
  skyPaint.fillRect(0,0,sky.width,sky.height);

  let seed=142;
  const random=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  for(let i=0;i<95;i++){
    skyPaint.fillStyle='rgba(195,212,249,'+(.12+random()*.4)+')';
    skyPaint.fillRect(random()*sky.width,random()*190,1,1);
  }
  for(let i=0;i<105;i++){
    const x=random()*sky.width,y=140+random()*390;
    const width=65+random()*230,height=10+random()*38;
    skyPaint.save();
    skyPaint.translate(x,y);
    skyPaint.scale(width,height);
    const mist=skyPaint.createRadialGradient(0,0,0,0,0,1);
    mist.addColorStop(0,'rgba(127,150,193,'+(.035+random()*.095)+')');
    mist.addColorStop(.5,'rgba(106,132,178,.035)');
    mist.addColorStop(1,'rgba(106,132,178,0)');
    skyPaint.fillStyle=mist;
    skyPaint.fillRect(-1,-1,2,2);
    skyPaint.restore();
  }
  const skyTexture=new T.CanvasTexture(sky);
  skyTexture.colorSpace=T.SRGBColorSpace;
  scene.background=skyTexture;
  scene.fog = new T.FogExp2(0x344767, .008);
  const camera = new T.PerspectiveCamera(38, 900/430, .1, 250);
  camera.position.set(3, 66, 65);
  camera.lookAt(0, 0, 0);

  const focus = new T.Vector3();
  const orbit = new T.Spherical().setFromVector3(camera.position);
  let drag = null;
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 2 || drag) return;
    drag = { id: event.pointerId, x: event.clientX };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (!(event.buttons & 2)) {
      canvas.releasePointerCapture(event.pointerId);
      return;
    }
    orbit.theta -= (event.clientX - drag.x) * .008;
    drag.x = event.clientX;
    camera.position.setFromSpherical(orbit).add(focus);
    camera.lookAt(focus);
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    canvas.style.cursor = '';
  });

  function zoomBy(factor) {
    camera.zoom = T.MathUtils.clamp(camera.zoom * factor, .75, 5);
    camera.updateProjectionMatrix();
    zoomIn.disabled = camera.zoom >= 5;
    zoomOut.disabled = camera.zoom <= .75;
  }
  function rotateMap(angle){
    orbit.theta+=angle;
    camera.position.setFromSpherical(orbit).add(focus);
    camera.lookAt(focus);
  }
  rotateLeft.onclick=()=>rotateMap(-Math.PI/12);
  rotateRight.onclick=()=>rotateMap(Math.PI/12);
  zoomIn.onclick = () => zoomBy(1.15);
  zoomOut.onclick = () => zoomBy(1 / 1.15);
  canvas.addEventListener('wheel', event => {
    if (!event.deltaY) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, {passive: false});
  scene.add(new T.HemisphereLight(0xdceaff, 0x968199, cathedralRoutes ? .65 : 3.0));
  const moon = new T.DirectionalLight(0xc4dbff, cathedralRoutes ? .85 : 2.6);
  moon.position.set(-15, 32, -15);
  scene.add(moon);
  const pos = (x,y,h=0) => new T.Vector3((x-450)/13,h,(y-215)/13);
  const box = new T.BoxGeometry(1,1,1);
  const ball = new T.IcosahedronGeometry(1,0);
  const cone = new T.ConeGeometry(1,1,5);
  const cylinder = new T.CylinderGeometry(1,1,1,12);
  const materials = new Map();
  // Shared, repeatable patterns keep the scenery textured without extra downloads.
  function pattern(base, grain, paint) {
    const tile=document.createElement('canvas');
    tile.width=tile.height=128;
    const ctx=tile.getContext('2d');
    let seed=741;
    const random=()=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    };
    ctx.fillStyle=base;
    ctx.fillRect(0,0,128,128);
    if(paint) paint(ctx,random);
    for(let i=0;i<3500;i++){
      ctx.fillStyle=random()<.5?'#000':'#fff';
      ctx.globalAlpha=random()*grain;
      const size=1+random()*3;
      ctx.fillRect(random()*128,random()*128,size,size);
    }
    const texture=new T.CanvasTexture(tile);
    texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const soil=pattern('#aaa8a0',.25,(ctx,random)=>{
    for(let i=0;i<210;i++){
      ctx.fillStyle=['#858578','#9b9c8c','#beb9ad'][i%3];
      ctx.fillRect(random()*128,random()*128,2+random()*7,1+random()*4);
    }
  });
  const masonry=(rows,columns)=>pattern('#545460',.19,(ctx,random)=>{
    const w=128/columns,h=128/rows;
    for(let row=0;row<rows;row++){
      for(let col=-1;col<columns;col++){
        const x=(col+(row%2)*.5)*w,y=row*h;
        const light=57+random()*18;
        ctx.fillStyle='hsl(225 8% '+light+'%)';
        ctx.fillRect(x+1,y+1,w-2,h-2);
        ctx.fillStyle='#c2c0c2';
        ctx.fillRect(x+2,y+1,w-4,1);
      }
    }
  });
  const paving=masonry(5,5);
  const stone=pattern('#41434b',.28,(ctx,random)=>{
    const w=128/3,h=128/5;
    for(let row=0;row<5;row++){
      for(let col=-1;col<3;col++){
        const x=(col+(row%2)*.5)*w,y=row*h;
        const shade=49+random()*23;
        const face=ctx.createLinearGradient(x,y,x+w,y+h);
        face.addColorStop(0,'hsl(224 9% '+(shade+12)+'%)');
        face.addColorStop(.3,'hsl(224 9% '+shade+'%)');
        face.addColorStop(1,'hsl(224 9% '+(shade-10)+'%)');
        ctx.fillStyle=face;
        ctx.beginPath();
        ctx.moveTo(x+1,y+4);
        ctx.lineTo(x+5,y+1);
        ctx.lineTo(x+w-4,y+1);
        ctx.lineTo(x+w-1,y+4);
        ctx.lineTo(x+w-1,y+h-4);
        ctx.lineTo(x+w-5,y+h-1);
        ctx.lineTo(x+3,y+h-2);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        for(let i=0;i<70;i++){
          ctx.fillStyle=random()<.5?'#11131a33':'#e1e3e326';
          ctx.fillRect(x+random()*w,y+random()*h,1+random()*5,1+random()*2);
        }
        ctx.restore();
      }
    }
  });
  const needles=pattern('#939d91',.24,(ctx,random)=>{
    ctx.strokeStyle='#606f61';
    ctx.beginPath();
    for(let i=0;i<420;i++){
      const x=random()*128,y=random()*128;
      ctx.moveTo(x,y);
      ctx.lineTo(x+(random()-.5)*10,y-3-random()*5);
    }
    ctx.stroke();
  });
  const bark=pattern('#a39a91',.22,(ctx,random)=>{
    ctx.fillStyle='#665b54';
    for(let i=0;i<23;i++) ctx.fillRect(random()*128,0,1+random()*3,128);
  });
  const wood=pattern('#a47c57',.2,(ctx,random)=>{
    for(let i=0;i<150;i++){
      ctx.fillStyle=i%3?'#8f6748':'#bc9269';
      ctx.fillRect(random()*128,random()*128,12+random()*60,1);
    }
  });
  const current=pattern('#698fa4',.1,(ctx,random)=>{
    for(let i=0;i<180;i++){
      ctx.fillStyle=i%4?'#779eac':'#b1ccd2';
      ctx.fillRect(random()*128,random()*128,1+random()*2,5+random()*24);
    }
  });
  const caveStone=pattern('#777581',.24,(ctx,random)=>{
    for(let i=0;i<9;i++){
      let x=random()*128,y=random()*128;
      ctx.beginPath();
      ctx.moveTo(x,y);
      for(let j=0;j<5;j++){
        x+=(random()-.5)*25;
        y+=5+random()*12;
        ctx.lineTo(x,y);
      }
      ctx.strokeStyle='#a09ba5';
      ctx.lineWidth=3;
      ctx.stroke();
      ctx.strokeStyle='#302b38';
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
  });
  const groundTexture=new T.TextureLoader(loadingManager).load(new URL('./assets/grama-noturna.png', import.meta.url).href);
  groundTexture.colorSpace=T.SRGBColorSpace;
  groundTexture.wrapS=groundTexture.wrapT=T.RepeatWrapping;
  groundTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const surfaces=new Map([
    [0x84674f,[soil]],
    [0x51596b,[caveStone]], [0x41495a,[caveStone]],
    [0x586174,[caveStone]], [0x454d60,[caveStone]],
    [0x927452,[wood,2]], [0x427b94,[current,3]],
    [0x46546a,[groundTexture,4]], [0x89869a,[paving,3]], [0x68758d,[stone,3]],
    [0x58627b,[stone,3]], [0x454861,[stone,3]], [0x343a50,[stone,3]],
    [0x5b6275,[stone,3]], [0x202c41,[needles]], [0x29374a,[needles]],
    [0x514641,[bark]]
  ]);
  function mesh(parent, shape, color, x,y,z, w,h,d, glow=false) {
    const [map,tileSize] = surfaces.get(color) || [];
    const key = color + ':' + glow;
    if(!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
      color:color===0x46546a ? 0x818e7c : color, map:map || null, bumpMap:map===current ? null : map || null, bumpScale:map===stone ? .055 : .028, roughness:map===current ? .38 : .94, flatShading:true, emissive:glow ? color : 0, emissiveIntensity:.85
    }));
    let geometry=shape;
    if(tileSize && shape===box){
      geometry=shape.clone();
      const uv=geometry.attributes.uv;
      const sizes=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
      sizes.forEach(([u,v],face)=>{
        for(let i=face*4;i<face*4+4;i++) uv.setXY(i,uv.getX(i)*u/tileSize,uv.getY(i)*v/tileSize);
      });
    }
    const m = new T.Mesh(geometry,materials.get(key));
    m.position.set(x,y,z); m.scale.set(w,h,d); parent.add(m);
    return m;
  }
  const bridgeScenery=new T.Group();
  scene.add(bridgeScenery);
  bridgeScenery.visible=!cathedralRoutes;
  const riverX=pos(577,0).x;
  const bankLeft=riverX-2,bankRight=riverX+2;
  const rampLength=1.25, rise=.78;
  const bridgeZ=pos(0,275).z;
  for(const [left,right] of [[-42,bankLeft],[bankRight,42]]){
    mesh(bridgeScenery,box,0x46546a,(left+right)/2,-.8,0,right-left,1.5,37);
  }
  mesh(bridgeScenery,box,0x427b94,riverX,-.85,0,4,.12,37);
  function bridgeHeight(x,y){
    if(cathedralRoutes)return 0;
    if(Math.abs(y-bridgeZ)>1.65) return 0;
    return rise*T.MathUtils.clamp((2+rampLength-Math.abs(x-riverX))/rampLength,0,1);
  }
  const road = path.map(([x,y])=>pos(x,y));
  const centerline=new T.Path();
  centerline.moveTo(road[0].x-1.8,road[0].z);
  centerline.lineTo(road[0].x,road[0].z);
  for(let i=1;i<road.length-1;i++){
    const corner=road[i];
    const entry=corner.clone().lerp(road[i-1],2.1/corner.distanceTo(road[i-1]));
    const exit=corner.clone().lerp(road[i+1],2.1/corner.distanceTo(road[i+1]));
    centerline.lineTo(entry.x,entry.z);
    centerline.quadraticCurveTo(corner.x,corner.z,exit.x,exit.z);
  }
  const last=road.at(-1);
  centerline.lineTo(last.x,last.z);
  centerline.lineTo(last.x+.8,last.z);
  const points=centerline.getPoints(10);
  function pave(section,color=0x89869a,flat=false){
    const edge=side=>section.map((point,i)=>{
      const tangent=section[Math.min(i+1,section.length-1)].clone()
        .sub(section[Math.max(0,i-1)]).normalize();
      return new T.Vector2(point.x-tangent.y*1.55*side,point.y+tangent.x*1.55*side);
    });
    const outline=new T.Shape([...edge(1),...edge(-1).reverse()]);
    const surface=flat ? new T.ShapeGeometry(outline) : new T.ExtrudeGeometry(outline,{
      depth:.12,bevelEnabled:true,bevelThickness:.055,bevelSize:.095,bevelSegments:3
    });
    const uv=surface.attributes.uv;
    for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);
    const roadway=mesh(bridgeScenery,surface,color,0,flat ? -.035 : .15,0,1,1,1);
    roadway.rotation.x=Math.PI/2;
    if(flat) roadway.material.side=T.DoubleSide;
  }
  const leftJoin=bankLeft-rampLength,rightJoin=bankRight+rampLength;
  pave([...points.filter(point=>point.x<leftJoin),new T.Vector2(leftJoin+.25,bridgeZ)],0x84674f,true);
  pave([new T.Vector2(rightJoin-.25,bridgeZ),...points.filter(point=>point.x>rightJoin)]);

  const segments=[[leftJoin,bankLeft,0,rise],[bankLeft,bankRight,rise,rise],
    [bankRight,rightJoin,rise,0]];
  for(const [start,end,low,high] of segments){
    const angle=Math.atan2(high-low,end-start);
    const length=Math.hypot(end-start,high-low);
    const boards=Math.ceil(length/.35);
    for(let i=0;i<boards;i++){
      const t=(i+.5)/boards;
      const plank=mesh(bridgeScenery,box,0x927452,T.MathUtils.lerp(start,end,t),
        .06+T.MathUtils.lerp(low,high,t),bridgeZ,length/boards-.012,.18,3.1);
      plank.rotation.z=angle;
    }
    for(const side of [-1,1]){
      const rail=mesh(bridgeScenery,box,0x927452,(start+end)/2,.62+(low+high)/2,
        bridgeZ+side*1.48,length+.05,.15,.15);
      rail.rotation.z=angle;
    }
  }
  for(const x of [leftJoin,bankLeft,riverX,bankRight,rightJoin]){
    for(const side of [-1,1]){
      mesh(bridgeScenery,box,0x927452,x,.38+bridgeHeight(x,bridgeZ),bridgeZ+side*1.48,.16,.7,.16);
    }
  }
  const bloodStain=new T.MeshStandardMaterial({color:0x480c1b,roughness:.32,side:T.DoubleSide});
  const bloodWet=new T.MeshStandardMaterial({color:0x681125,roughness:.22,side:T.DoubleSide});
  for(const [segment,t,offset,radius] of [
    [0,.38,.63,.53],[0,.75,-2.18,.68],[1,.55,-.75,.41],[2,.32,.72,.55],
    [2,.73,2.2,.66],[3,.48,-.64,.48],[5,.67,-.65,.43],[5,.55,2.22,.55]
  ]){
    const a=road[segment],b=road[segment+1];
    const center=a.clone().lerp(b,t);
    const tangent=b.clone().sub(a).normalize();
    center.x-=tangent.z*offset;
    center.z+=tangent.x*offset;
    const height=segment===5&&Math.abs(offset)<1 ? .157 : -.029;
    const outline=new T.Shape();
    for(let i=0;i<18;i++){
      const angle=i*Math.PI/9;
      const edge=radius*(1+.15*Math.sin(i*2.4+t*9)+.1*Math.cos(i*1.1));
      const x=Math.cos(angle)*edge,z=Math.sin(angle)*edge*.65;
      if(i===0)outline.moveTo(x,z);
      else outline.lineTo(x,z);
    }
    outline.closePath();
    const pool=new T.Mesh(new T.ShapeGeometry(outline),bloodStain);
    pool.rotation.x=-Math.PI/2;
    pool.position.set(center.x,height,center.z);
    bridgeScenery.add(pool);
    const wet=new T.Mesh(pool.geometry,bloodWet);
    wet.scale.set(.71,.68,1);
    wet.position.z=.001;
    pool.add(wet);
  }
  const entrance=road[0];
  new GLTFLoader(loadingManager).load(new URL('./assets/caverna.glb', import.meta.url).href,({scene:model})=>{
    const cave=new T.Group();
    cave.add(model);
    cave.rotation.y=Math.PI/2;
    const bounds=new T.Box3().setFromObject(cave);
    const size=bounds.getSize(new T.Vector3());
    const center=bounds.getCenter(new T.Vector3());
    const scale=6.4/size.z;
    if(!Number.isFinite(scale)||scale<=0) return;
    cave.scale.setScalar(scale);
    cave.position.set(entrance.x+.18-bounds.max.x*scale,-.05-bounds.min.y*scale,
      entrance.z-center.z*scale);
    bridgeScenery.add(cave);
  },undefined,error=>console.warn('Falha ao carregar a caverna.',error));
  const portal=new T.Group();
  portal.position.set(entrance.x-.85,1.27,entrance.z);
  portal.rotation.y=Math.PI/2;
  portal.scale.set(2.12,1.62,1);
  portal.position.y=1.53;
  bridgeScenery.add(portal);
  const vortex=new T.ShaderMaterial({
    transparent:true,
    side:T.DoubleSide,
    uniforms:{time:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:[
      'varying vec2 vUv;',
      'uniform float time;',
      'void main(){',
      '  vec2 p=vUv*2.0-1.0;',
      '  float r=length(p);',
      '  float angle=atan(p.y,p.x);',
      '  float phase=angle*4.0-r*24.0+time*2.7;',
      '  float spiral=pow(0.5+0.5*cos(phase),13.0);',
      '  float bands=smoothstep(0.34,0.52,r)*(1.0-smoothstep(0.88,1.0,r));',
      '  float ring=exp(-90.0*abs(r-0.53-0.02*sin(angle*3.0-time)));',
      '  vec3 color=vec3(0.035,0.008,0.058);',
      '  color+=vec3(0.56,0.035,0.67)*spiral*bands;',
      '  color+=vec3(0.95,0.21,0.57)*ring*(0.65+0.35*cos(angle-time*2.0));',
      '  gl_FragColor=vec4(color,1.0-smoothstep(0.83,1.0,r));',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n')
  });
  portal.add(new T.Mesh(new T.CircleGeometry(1,64),vortex));
  const portalLight=new T.PointLight(0x792bd0,5,4);
  portalLight.position.set(entrance.x-.5,1.3,entrance.z);
  bridgeScenery.add(portalLight);
  const wallX=bankRight+.24;
  for(const [start,end] of [[-18.5,bridgeZ-1.55],[bridgeZ+1.55,18.5]]){
    mesh(bridgeScenery,box,0x68758d,wallX,-.10,(start+end)/2,.85,4.5,end-start);
    for(let z=start+.48;z<end-.25;z+=1.2){
      mesh(bridgeScenery,box,0x58627b,wallX,2.34,z,.94,.44,.65);
    }
  }
  const rearWallX=41.76;
  for(const z of [-18.26,18.26]){
    mesh(bridgeScenery,box,0x68758d,(wallX+rearWallX)/2,-.10,z,rearWallX-wallX,4.5,.85);
    for(let x=wallX+.8;x<rearWallX-.45;x+=1.2){
      mesh(bridgeScenery,box,0x58627b,x,2.34,z,.65,.44,.94);
    }
  }
  mesh(bridgeScenery,box,0x68758d,rearWallX,-.10,0,.85,4.5,37);
  for(let z=-18.05;z<=18.05;z+=1.2){
    mesh(bridgeScenery,box,0x58627b,rearWallX,2.34,z,.94,.44,.65);
  }
  const gate=pos(...path.at(-1));
  const castleMoonlight=new T.SpotLight(0xb4ceff,210,29,Math.PI/5,.75,2);
  castleMoonlight.position.set(gate.x-5,17,gate.z-6);
  castleMoonlight.target.position.set(gate.x+5,4,gate.z);
  bridgeScenery.add(castleMoonlight,castleMoonlight.target);
  const wingShape=new T.Shape();
  wingShape.moveTo(0,0);
  wingShape.lineTo(.58,.18);
  wingShape.lineTo(.47,-.17);
  wingShape.quadraticCurveTo(.34,-.06,.29,-.23);
  wingShape.quadraticCurveTo(.16,-.12,0,-.15);
  const wingGeometry=new T.ShapeGeometry(wingShape);
  const wingMaterial=new T.MeshBasicMaterial({color:0x171326,side:T.DoubleSide});
  const bats=Array.from({length:6},()=>{
    const body=new T.Group();
    mesh(body,ball,0x21192d,0,0,0,.11,.12,.22);
    const wings=[1,-1].map(side=>{
      const wing=new T.Mesh(wingGeometry,wingMaterial);
      wing.rotation.x=-Math.PI/2;
      wing.scale.x=side;
      const hinge=new T.Group();
      hinge.add(wing);
      body.add(hinge);
      return hinge;
    });
    bridgeScenery.add(body);
    return {body,wings};
  });
  for(const z of [gate.z-3.3,gate.z+3.3]){
    mesh(bridgeScenery,box,0x68758d,gate.x+1,3.5,z,3.6,7,3.2);
    for(const x of [-1.25,1.25])for(const dz of [-1,1])mesh(bridgeScenery,box,0x58627b,gate.x+1+x,7.3,z+dz,.8,.85,.8);
    mesh(bridgeScenery,cylinder,0x7e2947,gate.x-1.2,1.1,z, .52,2.1,.52);
    mesh(bridgeScenery,box,0xff3b63,gate.x-1.75,1.45,z,.12,.85,.26,true);
  }
  mesh(bridgeScenery,box,0x454861,gate.x+1,4.25,gate.z,3.3,1.4,5);
  mesh(bridgeScenery,box,0x89869a,gate.x+.39,.045,gate.z,.85,.19,3.8);
  mesh(bridgeScenery,box,0x491427,gate.x+.6,1.8,gate.z,.3,3.6,3.8);
  mesh(bridgeScenery,ball,0xff315f,gate.x+.39,2.65,gate.z,.28,.42,.42,true);
  const towerOutline=new T.Shape([
    [-1.4,-.93],[-.93,-1.4],[.93,-1.4],[1.4,-.93],
    [1.4,.93],[.93,1.4],[-.93,1.4],[-1.4,.93]
  ].map(([x,z])=>new T.Vector2(x,z)));
  const towerGeometry=new T.ExtrudeGeometry(towerOutline,{depth:10,bevelEnabled:false});
  towerGeometry.rotateX(-Math.PI/2);
  const towerUv=towerGeometry.attributes.uv;
  for(let i=0;i<towerUv.count;i++){
    towerUv.setXY(i,towerUv.getX(i)/3,towerUv.getY(i)/3);
  }
  const windowArch=new T.Shape();
  windowArch.moveTo(-.44,0);
  windowArch.lineTo(.44,0);
  windowArch.lineTo(.44,.91);
  windowArch.quadraticCurveTo(.44,1.36,0,1.72);
  windowArch.quadraticCurveTo(-.44,1.36,-.44,.91);
  windowArch.closePath();
  const windowGeometry=new T.ShapeGeometry(windowArch);
  const stainedGlass=new T.TextureLoader(loadingManager).load(new URL('./assets/vitral.png', import.meta.url).href);
  stainedGlass.colorSpace=T.SRGBColorSpace;
  const paneGeometry=windowGeometry.clone();
  const paneUv=paneGeometry.attributes.uv;
  for(let i=0;i<paneUv.count;i++) paneUv.setXY(i,(paneUv.getX(i)+.44)/.88,paneUv.getY(i)/1.72);
  const paneMaterial=new T.MeshStandardMaterial({
    map:stainedGlass,emissiveMap:stainedGlass,emissive:0xffffff,emissiveIntensity:.45,roughness:.42
  });
  function victorianWindow(x,y,z,rotation){
    const frame=new T.Group();
    frame.position.set(x,y,z);
    frame.rotation.y=rotation;
    bridgeScenery.add(frame);
    mesh(frame,windowGeometry,0x9b8590,0,0,0,1,1,1);
    const pane=new T.Mesh(paneGeometry,paneMaterial);
    pane.position.set(0,.1,.025);
    pane.scale.set(.76,.85,1);
    frame.add(pane);
    mesh(frame,box,0x302239,0,.67,.052,.04,1.16,.045);
    mesh(frame,box,0x302239,0,.73,.052,.66,.045,.045);
    const tracery=mesh(frame,box,0xc08293,0,1.15,.061,.13,.13,.035);
    tracery.rotation.z=Math.PI/4;
    mesh(frame,box,0x58627b,0,-.045,.03,1.04,.12,.23);
  }
  const keepX=gate.x+8.2;
  new GLTFLoader(loadingManager).load(new URL('./assets/torre-central.glb', import.meta.url).href,({scene:model})=>{
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3());
    const center=bounds.getCenter(new T.Vector3());
    const scale=19/size.y;
    if(!Number.isFinite(scale)||scale<=0) return;
    const centralTower=new T.Group();
    centralTower.scale.setScalar(scale);
    centralTower.position.set(keepX-center.x*scale,-.05-bounds.min.y*scale,gate.z-center.z*scale);
    centralTower.add(model);
    centralTower.updateMatrixWorld(true);
    const stoneMaterial=new T.MeshStandardMaterial({
      color:0x68758d,map:stone,bumpMap:stone,bumpScale:.055,roughness:.95
    });
    const point=new T.Vector3(), normal=new T.Vector3();
    model.traverse(part=>{
      if(!part.isMesh) return;
      const geometry=part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      const positions=geometry.attributes.position;
      const uv=new Float32Array(positions.count*2);
      const a=new T.Vector3(), b=new T.Vector3(), c=new T.Vector3();
      for(let i=0;i<positions.count;i+=3){
        a.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld);
        b.fromBufferAttribute(positions,i+1).applyMatrix4(part.matrixWorld).sub(a);
        c.fromBufferAttribute(positions,i+2).applyMatrix4(part.matrixWorld).sub(a);
        normal.crossVectors(b,c);
        const top=Math.abs(normal.y)>=Math.max(Math.abs(normal.x),Math.abs(normal.z));
        const side=Math.abs(normal.x)>Math.abs(normal.z);
        for(let j=i;j<i+3;j++){
          point.fromBufferAttribute(positions,j).applyMatrix4(part.matrixWorld);
          uv[j*2]=(top||!side?point.x:point.z)/3;
          uv[j*2+1]=(top?point.z:point.y)/3;
        }
      }
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
      part.geometry=geometry;
      part.material=stoneMaterial;
    });
    bridgeScenery.add(centralTower);
  },undefined,error=>console.warn('Falha ao carregar a torre central.',error));
  mesh(bridgeScenery,box,0x68758d,keepX,4.1,gate.z,8.4,8.3,8.8);
  mesh(bridgeScenery,box,0x58627b,keepX,8.15,gate.z,8.9,.45,9.3);
  for(const side of [-1,1]){
    for(let offset=-3.6;offset<=3.6;offset+=1.2){
      mesh(bridgeScenery,box,0x58627b,keepX+offset,8.68,gate.z+side*4.4,.62,.75,.72);
      mesh(bridgeScenery,box,0x58627b,keepX+side*4.2,8.68,gate.z+offset,.72,.75,.62);
    }
    for(const x of [gate.x+4.4,gate.x+11.9]){
      const z=gate.z+side*5.1;
      mesh(bridgeScenery,towerGeometry,0x68758d,x,-.05,z,1,1,1);
      mesh(bridgeScenery,box,0x58627b,x,9.9,z,3.15,.5,3.15);
      for(const dx of [-1.1,0,1.1]){
        for(const dz of [-1.1,0,1.1]){
          if(dx||dz) mesh(bridgeScenery,box,0x58627b,x+dx,10.45,z+dz,.55,.72,.55);
        }
      }
      for(const height of [3.6,6.8,8.6]){
        mesh(bridgeScenery,box,0x454861,x-1.43,height,z,.12,1.05,.46);
        mesh(bridgeScenery,box,0x1e1725,x-1.5,height+.05,z,.06,.78,.18);
      }
    }
    for(const x of [keepX-1.9,keepX,keepX+1.9]){
      const z=gate.z+side*4.42;
      victorianWindow(x,4.85,z,side===1?0:Math.PI);
    }
  }
  for(const offset of [-1.65,0,1.65]){
    victorianWindow(keepX-4.23,5.85,gate.z+offset,-Math.PI/2);
  }
  new GLTFLoader(loadingManager).load(new URL('./assets/caixao.glb', import.meta.url).href,({scene:model})=>{
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3());
    const center=bounds.getCenter(new T.Vector3());
    const scale=1.65/Math.max(size.x,size.y,size.z);
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
    for(const [x,z,angle] of [[3.1,7.7,.2],[5,8.5,-.18],[7.1,8.1,.35],[6.2,-8.5,-.3],[-11.8,7.4,.3],[-12.2,11.5,-.25]]){
      const coffin=new T.Group();
      coffin.add(model.clone(true));
      coffin.position.set(gate.x+x,-.05,gate.z+z);
      coffin.rotation.y=angle;
      coffin.scale.setScalar(scale);
      bridgeScenery.add(coffin);
    }
  });
  const bloodLight=new T.PointLight(0xff2458,58,11);
  bloodLight.position.set(gate.x-1,2.6,gate.z);bridgeScenery.add(bloodLight);
  const forest=[];
  const glowCanvas=document.createElement('canvas');
  glowCanvas.width=glowCanvas.height=64;
  const glowPaint=glowCanvas.getContext('2d');
  const glowGradient=glowPaint.createRadialGradient(32,32,0,32,32,32);
  glowGradient.addColorStop(0,'rgba(255,255,255,1)');
  glowGradient.addColorStop(.24,'rgba(255,255,255,.48)');
  glowGradient.addColorStop(1,'rgba(255,255,255,0)');
  glowPaint.fillStyle=glowGradient;
  glowPaint.fillRect(0,0,64,64);
  const glowTexture=new T.CanvasTexture(glowCanvas);
  const forestEyes=[[-24,-14,1.15],[-20.7,-12.8,.85],[-17.8,-14,1.55]].map(([x,z,y])=>{
    const material=new T.SpriteMaterial({map:glowTexture,color:0xff3657,transparent:true,depthWrite:false});
    for(const offset of [-.18,.18]){
      const eye=new T.Sprite(material);
      eye.position.set(x+offset,y,z);
      eye.scale.set(.62,.4,1);
      bridgeScenery.add(eye);
    }
    return material;
  });
  for(let i=0;i<44;i++){
    const x=((i*137%810)-405)/10, z=i%2 ? -15-(i%3) : 14+(i%4);
    if(Math.abs(x-riverX)<3.4) continue;
    forest.push({x,z,height:2.8+(i*7%5)*.7,variant:i%3===0?1:0});
  }
  for(const [x,z] of [[-39,-15],[-32,-12],[-24,-10],[-15,-16],[-8,-15],[0,-13],
    [3,10],[17,-16],[22,-12],[28,-16],[34,-14],[38,-10],[36,15],[-36,15],[-25,15],[-14,14]]){
    forest.push({x,z,height:3.1,variant:2});
  }
  const extraTrees=[
    {variant:1,positions:[[-37,-10],[-28,9],[-16,-9],[-4,12],[5,-10],[15,13],[23,-8],[35,12]]},
    {variant:2,positions:[[-36,9],[-29,-9],[-18,11],[-9,-9],[-2,15],[4,-16],[24,12],[33,-11]]}
  ];
  for(const {variant,positions} of extraTrees){
    positions.forEach(([x,z],i)=>forest.push({x,z,height:3.3+(i%4)*.45,variant}));
  }
  const defenseClearings=pads.map(([x,y])=>pos(x,y));
  for(let row=0;row<8;row++){
    for(let col=0;col<17;col++){
      const x=-38+col*4.6+Math.sin(row*7+col)*.65;
      const z=-16+row*4.5+Math.cos(row+col*3)*.65;
      if(Math.abs(x-riverX)<4 || x>25&&Math.abs(z)<8) continue;
      if(defenseClearings.some(p=>Math.hypot(p.x-x,p.z-z)<4)) continue;
      if(forest.some(tree=>Math.hypot(tree.x-x,tree.z-z)<3.1)) continue;
      const nearRoad=road.slice(1).some((end,i)=>{
        const start=road[i],dx=end.x-start.x,dz=end.z-start.z;
        const t=T.MathUtils.clamp(((x-start.x)*dx+(z-start.z)*dz)/(dx*dx+dz*dz),0,1);
        return Math.hypot(x-start.x-t*dx,z-start.z-t*dz)<4.4;
      });
      if(!nearRoad) forest.push({x,z,height:2.6+(col%4)*.35,variant:(row+col)%4===0?2:1});
    }
  }
  function loadTrees(url,variant){
    new GLTFLoader(loadingManager).load(url,({scene:model})=>{
      if(variant===2){
        const leaves=model.getObjectByName('leaves');
        if(leaves?.isMesh){
          const original=leaves.material.map;
          const foliage=document.createElement('canvas');
          foliage.width=foliage.height=512;
          const ctx=foliage.getContext('2d');
          ctx.drawImage(original.image,0,0,512,512);
          ctx.globalCompositeOperation='source-atop';
          ctx.fillStyle='#243c30c9';
          ctx.fillRect(0,0,512,512);
          ctx.globalAlpha=.36;
          ctx.fillStyle=ctx.createPattern(needles.image,'repeat');
          ctx.fillRect(0,0,512,512);
          const map=new T.CanvasTexture(foliage);
          map.colorSpace=T.SRGBColorSpace;
          map.flipY=original.flipY;
          map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
          leaves.material=new T.MeshStandardMaterial({
            color:0x73947b,map,alphaTest:.12,side:T.DoubleSide,roughness:1
          });
        }
      }
      const bounds=new T.Box3().setFromObject(model);
      const center=bounds.getCenter(new T.Vector3());
      const dimensions=bounds.getSize(new T.Vector3());
      const height=dimensions.y;
      if(!Number.isFinite(height)||height<=0) return;
      const rooted=new T.Group();
      model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
      rooted.add(model);
      forest.filter(tree=>tree.variant===variant).forEach(({x,z,height:targetHeight},i)=>{
        const instance=rooted.clone(true);
        instance.position.set(x,-.05,z);
        instance.rotation.y=i*2.4;
        const sizeFactor=variant===0 ? .8 : variant===1 ? 1.2 : 1;
        const scale=targetHeight*sizeFactor/height;
        const canopyRadius=Math.hypot(dimensions.x,dimensions.z)*scale/2;
        if(defenseClearings.some(p=>Math.hypot(p.x-x,p.z-z)<canopyRadius+2)) return;
        const overlapsRoad=points.slice(1).some((b,i)=>{
          const a=points[i],dx=b.x-a.x,dz=b.y-a.y;
          const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz),0,1);
          return Math.hypot(x-a.x-t*dx,z-a.y-t*dz)<canopyRadius+1.9;
        });
        if(overlapsRoad||Math.abs(x-riverX)<canopyRadius+2) return;
        instance.scale.setScalar(scale);
        bridgeScenery.add(instance);
      });
    },undefined,error=>console.warn('Falha ao carregar a árvore.',error));
  }
  loadTrees(new URL('./assets/arvore.glb', import.meta.url).href,0);
  loadTrees(new URL('./assets/arvore-seca.gltf', import.meta.url).href,1);
  for(const [x,z,height] of [[-26,-13,4.7],[-13,-15,5.3],[2,-14,4.5],[20,-15,5],[29,14,4.8],[-19,15,4.6],[-33,-15,4.4],[-22,-16,4.9],[-6,-12,4.2],[25,-12,4.1],[-32,13,4.5],[-10,16,4.8],[3,14,4.2],[18,15,4.7]]){
    forest.push({x,z,height,variant:2});
  }
  loadTrees(new URL('./assets/pinheiro.glb', import.meta.url).href,2);
  const cathedralFires=[];
  const cathedralBats=[];
  if(cathedralRoutes){
    const masonry=pattern('#41434b',.12,(ctx,random)=>{
      ctx.drawImage(stone.image,0,0,128,128);
      ctx.fillStyle='#570f24b0';
      for(let i=0;i<11;i++){
        const x=random()*128,y=random()*128;
        ctx.beginPath();
        ctx.ellipse(x,y,1+random()*7,1+random()*4,random()*Math.PI,0,Math.PI*2);
        ctx.fill();
      }
    });
    const stoneColor=0xaca6b2, trim=0x71667a;
    surfaces.set(stoneColor,[masonry,3]);
    mesh(scene,box,stoneColor,0,-.8,0,84,1.5,38);
    mesh(scene,box,stoneColor,.75,-.045,0,78.5,.12,34);
    for(const route of cathedralRoutes){
      const points=route.map(([x,y])=>pos(x,y,.035));
      const centerline=new T.CurvePath();
      let start=points[0];
      for(let i=1;i<points.length-1;i++){
        const corner=points[i];
        const before=corner.clone().lerp(points[i-1],.19);
        const after=corner.clone().lerp(points[i+1],.19);
        centerline.add(new T.LineCurve3(start,before));
        centerline.add(new T.QuadraticBezierCurve3(before,corner,after));
        start=after;
      }
      centerline.add(new T.LineCurve3(start,points.at(-1)));
      const positions=[],uv=[],indices=[];
      const steps=Math.ceil(centerline.getLength()*4);
      for(let i=0;i<=steps;i++){
        const t=i/steps;
        const p=centerline.getPoint(t), heading=centerline.getTangent(t);
        for(const side of [-1,1]){
          const x=p.x-heading.z*side*1.325;
          const z=p.z+heading.x*side*1.325;
          positions.push(x,p.y,z);
          uv.push(x/3,z/3);
        }
        if(i>0){
          const v=2*i;
          indices.push(v-2,v-1,v,v-1,v+1,v);
        }
      }
      const surface=new T.BufferGeometry();
      surface.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      surface.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      surface.setIndex(indices);
      surface.computeVertexNormals();
      mesh(scene,surface,0x68758d,0,0,0,1,1,1);
    }
    const puddleMaterial=new T.MeshStandardMaterial({
      color:0x395e7d,transparent:true,opacity:.56,roughness:.2,depthWrite:false
    });
    for(const [x,z,width,depth] of [[-30,7,3,1.7],[-23,-10,1.5,1],[-12,8,5,2.5],
      [-3,-11,3,2],[7,6,1.6,.9],[16,-10,5.5,2.7],[24,10,2.7,1.4],[33,-7,2,1.1]]){
      const outline=new T.Shape();
      for(let i=0;i<32;i++){
        const angle=i/32*Math.PI*2;
        const edge=1+.12*Math.sin(angle*3+x)+.08*Math.cos(angle*5);
        const px=Math.cos(angle)*width*.5*edge;
        const py=Math.sin(angle)*depth*.5*edge;
        if(i===0)outline.moveTo(px,py);
        else outline.lineTo(px,py);
      }
      outline.closePath();
      const puddle=new T.Mesh(new T.ShapeGeometry(outline),puddleMaterial);
      puddle.rotation.x=-Math.PI/2;
      puddle.position.set(x,.024,z);
      scene.add(puddle);
    }
    const glass=new T.TextureLoader(loadingManager).load(new URL('./assets/vitral.png',import.meta.url).href);
    glass.colorSpace=T.SRGBColorSpace;
    const pane=new T.MeshBasicMaterial({map:glass,color:0xffa6b8,side:T.DoubleSide});
    for(const z of [-16,16]){
      const wallZ=z+(z<0?.58:-.58);
      for(let index=0;index<8;index++){
        const x=-35+index*10;
        mesh(scene,box,stoneColor,x,3.55,wallZ,10,7.1,.95);
        mesh(scene,box,trim,x,7.12,wallZ,10.2,.3,1.12);
        for(const edge of [-4.55,4.55]){
          mesh(scene,box,trim,x+edge,3.7,wallZ,1.05,7.4,1.18);
          mesh(scene,box,stoneColor,x+edge,7.65,wallZ,1.38,.72,1.4);
          mesh(scene,box,trim,x+edge,8.06,wallZ,1.12,.18,1.14);
        }
        // Full masonry panels frame each stained-glass window.
        mesh(scene,box,stoneColor,x,1.05,wallZ,8.95,2.1,1.02);
        mesh(scene,box,stoneColor,x,7.9,wallZ,8.95,.92,1.02);
        for(const face of [-1,1]){
          const window=new T.Mesh(new T.PlaneGeometry(3.55,3.75),pane);
          window.position.set(x,4.45,wallZ+face*.53);
          scene.add(window);
          for(const dx of [-1.92,1.92]){
            mesh(scene,box,trim,x+dx,4.45,wallZ+face*.55,.16,4.05,.15);
          }
          for(const y of [2.48,6.43]){
            mesh(scene,box,trim,x,y,wallZ+face*.55,4.05,.18,.15);
          }
        }
      }
      for(let index=0;index<8;index++){
        const x=-35+index*10;
        const direction=z<0?1:-1;
        const beam=new T.Mesh(new T.PlaneGeometry(4.4,7),
          new T.ShaderMaterial({
            transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
            vertexShader: `varying vec2 beamUv;
              void main(){beamUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
            fragmentShader: `varying vec2 beamUv;
              void main(){
                float edge=smoothstep(0.,.23,beamUv.x)*(1.-smoothstep(.77,1.,beamUv.x));
                float fade=smoothstep(0.,.65,beamUv.y);
                gl_FragColor=vec4(.9,.07,.14,.12*edge*fade);
              }`
          }));
        for(const height of [2.6,4.4,6.2]){
          const sheet=beam.clone();
          const reach=6;
          sheet.scale.y=Math.hypot(height,reach)/7;
          sheet.rotation.x=-direction*Math.atan2(reach,height);
          sheet.position.set(x,height/2,wallZ+direction*(.6+reach/2));
          scene.add(sheet);
        }
      }
      // Continuous stone footing and a finished cornice make the nave feel enclosed.
      mesh(scene,box,trim,1,.18,wallZ,78,.36,1.2);
      mesh(scene,box,trim,1,8.18,wallZ,78,.24,1.2);
    }
    for(const x of [40]){
      mesh(scene,box,stoneColor,x,3.55,0,1.05,7.1,31);
      mesh(scene,box,trim,x,7.2,0,1.24,.35,31.5);
      mesh(scene,box,trim,x,.18,0,1.23,.36,31.4);
      for(const z of [-10,0,10]){
        mesh(scene,box,trim,x,3.55,z,1.45,7.1,1.15);
      }
    }
    for(const [x,z,angle,length] of [[-27,-12,.9,1.8],[-23,7,-.6,1.3],
      [-14,-11,1.3,2.1],[-7,4,-.8,1.6],[3,12,.4,1.4],[11,-12,-1.1,2],[21,10,.7,1.7]]){
      mesh(scene,box,0x77533d,x,.13,z,.32,.22,length).rotation.y=angle;
    }
    const crypt=pos(...cathedralRoutes[0].at(-1));
    const groundFire=new T.LatheGeometry([
      [0,-.46],[.20,-.44],[.32,-.26],[.27,-.05],[.17,.16],[.08,.34],[0,.49]
    ].map(([radius,y])=>new T.Vector2(radius,y)),16);
    const flameVertices=groundFire.attributes.position;
    for(let i=0;i<flameVertices.count;i++){
      const height=flameVertices.getY(i)+.46;
      flameVertices.setX(i,flameVertices.getX(i)+.38*height*height);
    }
    groundFire.computeVertexNormals();
    const rear=40;
    const keepWidth=rear-crypt.x-.5;
    mesh(scene,box,stoneColor,rear-keepWidth/2,3.6,0,keepWidth,7.2,13);
    mesh(scene,box,stoneColor,rear-keepWidth/2,7.2,0,keepWidth, .55,13.5);
    for(const side of [-1,1]){
      mesh(scene,box,stoneColor,crypt.x+1.5,4.3,side*5.3,3.1,8.6,3.3);
      for(const dz of [-1.1,1.1]){
        mesh(scene,box,stoneColor,crypt.x+.35,8.8,side*5.3+dz,.8,.8,.85);
      }
    }
    for(const z of [-3,-1.5,0,1.5,3]){
      mesh(scene,box,stoneColor,crypt.x+.42,7.65,z,.75,.75,.82);
    }
    mesh(scene,box,0x721737,crypt.x+.43,1.8,0,.12,3.6,2.7,true);
    for(const [x,y,z] of [[-34,0,-12],[-34,0,12],[4,0,-11],[35,0,-12],[35,0,12],
      [crypt.x-1,0,-5],[crypt.x-1,0,5],[crypt.x+1.5,8.6,-5.3],[crypt.x+1.5,8.6,5.3]]){
      mesh(scene,cylinder,trim,x,y+.32,z,.74,.64,.74);
      const flame=new T.Mesh(groundFire,new T.MeshBasicMaterial({color:0xff6330}));
      flame.position.set(x,y+.99,z);
      scene.add(flame);
      const core=new T.Mesh(new T.ConeGeometry(.17,.57,7),new T.MeshBasicMaterial({color:0xffd177}));
      core.position.set(x,y+.88,z+.09);
      scene.add(core);
      const light=new T.PointLight(0xff5725,9,5.5);
      light.position.set(x,y+1,z);
      scene.add(light);
      cathedralFires.push({flame,core,light});
    }
    for(const [x,z,angle] of [[-24,3,.7],[-10,2,-.4],[7,10,1.4],[19,-8,2.2]]){
      const body=new T.Group();
      body.position.set(x,.03,z);
      body.rotation.y=angle;
      scene.add(body);
      const bloodEdge=new T.SplineCurve(Array.from({length:17},(_,i)=>{
        const theta=i%16*Math.PI/8;
        const ripple=1+.21*Math.sin(theta*3+angle)+.14*Math.cos(theta*5-angle);
        return new T.Vector2(.94*ripple*Math.cos(theta),1.4*ripple*Math.sin(theta));
      }));
      const pool=mesh(body,new T.ShapeGeometry(new T.Shape(bloodEdge.getPoints(64))),
        0x651324,0,.009,0,1,1,1);
      pool.rotation.x=-Math.PI/2;
      mesh(body,ball,0x34313f,0,.24,-.07,.66,.4,.93);
      mesh(body,ball,0x48404a,0,.19,.32,.52,.31,.5);
      mesh(body,box,0x604034,0,.3,.3,.5,.11,.16);
      mesh(body,ball,0x9b8276,0,.2,-.47,.18,.21,.28);
      mesh(body,ball,0x9b8276,0,.23,-.65,.32,.35,.35);
      for(const side of [-1,1]){
        mesh(body,ball,0x3d3844,side*.21,.17,.65,.26,.28,.72).rotation.y=side*.18;
        mesh(body,ball,0x302932,side*.28,.12,1.05,.21,.23,.65).rotation.y=side*.12;
        mesh(body,ball,0x221c24,side*.34,.105,1.37,.25,.21,.36);
        mesh(body,ball,0x48404a,side*.36,.17,-.21,.23,.28,.56).rotation.y=side*.53;
        mesh(body,ball,0x3b3440,side*.55,.115,.16,.17,.21,.52).rotation.y=-side*.27;
        mesh(body,ball,0x9b8276,side*.51,.09,.41,.16,.14,.23);
      }
    }
    const fireOrange=new T.MeshBasicMaterial({color:0xff5020});
    const fireGold=new T.MeshBasicMaterial({color:0xffbd53});
    for(const [x,z] of [[-36,-11],[-36,0],[-36,11],[-27,-13],[-16,5],[1,-8],[15,9],[33,-9]]){
      const light=new T.PointLight(0xff5725,8,5);
      light.position.set(x,.72,z);
      scene.add(light);
      for(let i=0;i<7;i++){
        const flame=new T.Mesh(groundFire,fireOrange);
        flame.position.set(x+(i-3)*.43,.42,z+Math.sin(i*2)*.45);
        flame.rotation.y=i;
        const core=new T.Mesh(groundFire,fireGold);
        core.position.copy(flame.position);
        core.position.y=.27;
        core.scale.set(.58,.56,.58);
        scene.add(flame,core);
        cathedralFires.push({flame,core,light:i===0?light:null,coreHeight:.56});
      }
    }
    const reserveLight=new T.PointLight(0xff285a,42,11);
    reserveLight.position.set(crypt.x-1,2,0);
    scene.add(reserveLight);
    const shaft=new T.SpotLight(0xb8d6ff,180,65,.29,.68);
    shaft.position.set(5,24,-8);
    shaft.target.position.set(1,0,-2);
    scene.add(shaft,shaft.target);
    const entranceX=pos(...cathedralRoutes[0][0]).x;
    const facadeHeight=8.3;
    mesh(scene,box,stoneColor,entranceX-.57,facadeHeight/2,0,.26,facadeHeight,31.8);
    let wallStart=-15.5;
    cathedralRoutes.forEach(route=>{
      const {z}=pos(...route[0]);
      const edge=z-1.65;
      mesh(scene,box,stoneColor,entranceX,facadeHeight/2,(wallStart+edge)/2,1.05,facadeHeight,edge-wallStart);
      mesh(scene,box,stoneColor,entranceX,6.2,z,1.05,4.2,3.3);
      for(const side of [-1,1]){
        mesh(scene,box,trim,entranceX+.45,2,z+side*1.65,.68,4,.42);
      }
      mesh(scene,box,trim,entranceX+.45,4,z,.68,.4,3.7);
      for(const side of [-1,1]){
        const columnZ=z+side*1.97;
        mesh(scene,box,stoneColor,entranceX+.68,1.95,columnZ,.72,3.9,.48);
        for(const y of [.25,3.7]){
          mesh(scene,box,trim,entranceX+.68,y,columnZ,.86,.26,.65);
        }
      }
      for(let i=0;i<=10;i++){
        const angle=i*Math.PI/10;
        const voussoir=mesh(scene,box,stoneColor,entranceX+.65,
          2.95+1.42*Math.sin(angle),z+1.87*Math.cos(angle),.64,.38,.52);
        voussoir.rotation.x=-angle;
      }
      mesh(scene,box,trim,entranceX+.79,4.48,z,.55,.48,.48).rotation.x=Math.PI/4;
      const doorwayPortal=portal.clone();
      doorwayPortal.position.set(entranceX+.48,1.94,z);
      doorwayPortal.scale.set(1.66,1.98,1);
      scene.add(doorwayPortal);
      wallStart=z+1.65;
    });
    mesh(scene,box,stoneColor,entranceX,facadeHeight/2,(wallStart+15.5)/2,1.05,facadeHeight,15.5-wallStart);
    mesh(scene,box,trim,entranceX,8.18,0,1.15,.24,32);
    const kit=[
      ['gothic_archway',[[805,215]],5],
      ['candelabra',[[160,232],[300,71],[500,345],[742,115],[777,296]],1.6],
      ['tombstone',[[120,390],[210,406],[332,392],[418,374]],1.25],
      ['coffin',[[52,56,1.1],[165,75,.8],[255,53,1.55],[539,72,-.9],[680,100,.55],[66,219,-1.4],[244,254,.95],[700,355,1.25]],1.05],
      ['bat_flying',[[120,215],[260,215],[400,215],[540,215],[680,215]],.65],
      ['pillar',[[140,46],[370,46],[635,46],[140,402],[635,384]],4],
      ['portrait',[[300,22],[560,408]],1.7],
      ['throne',[[752,125]],2.2],
      ['skull',[[127,404],[345,393],[760,280]],.38],
      ['wall_sconce',[-30,-10,10,30].flatMap(x=>[-1,1].map(side=>[450+x*13,215+side*14.7*13])),1.15]
    ];
    for(const [name,placements,height] of kit){
      new GLTFLoader(loadingManager).load(new URL('./assets/catedral-'+name+'.glb',import.meta.url).href,({scene:model,animations})=>{
        const bounds=new T.Box3().setFromObject(model);
        const center=bounds.getCenter(new T.Vector3());
        const scale=height/(bounds.max.y-bounds.min.y);
        model.scale.setScalar(scale);
        model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
        for(const [x,y,angle=0] of placements){
          const prop=new T.Group();
          prop.position.copy(pos(x,y));
          prop.rotation.y=angle;
          if(name==='wall_sconce'||name==='portrait'){
            prop.position.y=name==='wall_sconce'?2.65:2.3;
            if(prop.position.z>0)prop.rotation.y=Math.PI;
          }
          if(name==='gothic_archway')prop.rotation.y=Math.PI/2;
          const instance=name==='bat_flying'?cloneRig(model):model.clone(true);
          prop.add(instance);
          scene.add(prop);
          if(name==='bat_flying'){
            const mixer=new T.AnimationMixer(instance);
            if(animations.length)mixer.clipAction(animations[0]).play();
            cathedralBats.push({prop,mixer,center:prop.position.clone()});
          }
          if(name==='candelabra'||name==='wall_sconce'){
            const flame=prop.position.clone();
            flame.y+=height;
            mesh(scene,ball,0xff3559,flame.x,flame.y,flame.z,.1,.18,.1,true);
            const light=new T.PointLight(0xff254b,7,5);
            light.position.copy(flame);
            scene.add(light);
          }
        }
      });
    }
  }
  let gargoyleModel;
  new STLLoader(loadingManager).load(new URL('./assets/gargula.stl', import.meta.url).href, geometry=>{
    geometry.rotateX(-Math.PI/2);
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox;
    const center=bounds.getCenter(new T.Vector3());
    const size=bounds.getSize(new T.Vector3());
    geometry.translate(-center.x,-bounds.min.y,-center.z);
    const scale=2.3/Math.max(size.x,size.y,size.z);
    geometry.scale(scale,scale,scale);
    const positions=geometry.attributes.position;
    const uv=new Float32Array(positions.count*2);
    for(let i=0;i<positions.count;i++){
      uv[2*i]=positions.getX(i)+positions.getZ(i)*.73;
      uv[2*i+1]=positions.getY(i)+positions.getZ(i)*.41;
    }
    geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
    const statue=new T.Mesh(geometry,new T.MeshStandardMaterial({
      color:0xa5a9b7,map:soil,bumpMap:soil,bumpScale:.035,roughness:1
    }));
    gargoyleModel=new T.Group();
    gargoyleModel.add(statue);
    const eyeHeight=size.y*scale*.81;
    const eyeRay=new T.Raycaster();
    for(const x of [-.105,.105]){
      eyeRay.set(new T.Vector3(x,eyeHeight,4),new T.Vector3(0,0,-1));
      const hit=eyeRay.intersectObject(statue,false)[0];
      if(!hit) continue;
      const z=hit.point.z+.035;
      mesh(gargoyleModel,ball,0xff173e,x,eyeHeight,z,.064,.046,.035,true);
      mesh(gargoyleModel,ball,0xffa0a7,x,eyeHeight,z+.028,.029,.022,.015,true).name="laser-eye";
    }
  },undefined,error=>console.warn('Falha ao carregar a Gárgula.',error));
  let alchemistModel;
  new STLLoader(loadingManager).load(new URL('./assets/alquimista.stl', import.meta.url).href,geometry=>{
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox;
    const center=bounds.getCenter(new T.Vector3());
    const size=bounds.getSize(new T.Vector3());
    const height=size.y;
    if(!Number.isFinite(height)||height<=0) return;
    geometry.translate(-center.x,-bounds.min.y,-center.z);
    const scale=2.45/height;
    geometry.scale(scale,scale,scale);
    const vertices=geometry.attributes.position;
    const colors=new Float32Array(vertices.count*3);
    const cloth=new T.Color(0x18141e), red=new T.Color(0x81182f);
    const skin=new T.Color(0xe1c8c2), gold=new T.Color(0xd49b38);
    const ember=new T.Color(0xd62608), flame=new T.Color(0xffdf71);
    const color=new T.Color();
    const finish=new Float32Array(vertices.count*2);
    const flameBounds=new T.Box3();
    const flameVertex=new T.Vector3();
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i);
      const y=vertices.getY(i);
      const z=vertices.getZ(i);
      const u=x/(size.x*scale)+.5, v=y/2.45;
      const shaft=.41-.31*v;
      const weapon=(Math.abs(u-shaft)<.033)||(v>.74&&u<.29);
      const fire=u>.85&&v>.65&&v<.94;
      const face=u>.55&&u<.76&&v>.81;
      const trim=v>.46&&v<.81&&(Math.abs(u-.54)<.022||Math.abs(u-.77)<.026||
        Math.abs(v-.53)<.018||Math.abs(v-.72)<.016);
      const grain=Math.sin(x*147+y*83+z*119)*Math.cos(z*161-y*103);
      if(fire){
        flameBounds.expandByPoint(flameVertex.set(x,y,z));
        const heat=T.MathUtils.clamp((.94-v)*3.4+.34+.23*Math.sin(x*30+z*22+y*17),0,1);
        color.copy(ember).lerp(flame,heat);
      }else{
        color.copy(weapon?gold:face?skin:trim?red:cloth);
        color.multiplyScalar(1+grain*(face?.07:.16));
      }
      color.toArray(colors,i*3);
      finish[i*2]=weapon&&!fire ? 1 : 0;
      finish[i*2+1]=fire ? .65+.35*Math.sin(y*11+x*15) : 0;
    }
    geometry.setAttribute('color',new T.BufferAttribute(colors,3));
    geometry.setAttribute('surfaceFinish',new T.BufferAttribute(finish,2));
    const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.82});
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec2 surfaceFinish; varying vec2 vFinish;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvFinish = surfaceFinish;');
      shader.fragmentShader='varying vec2 vFinish;\n'+shader.fragmentShader
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, vFinish.x);')
        .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.48, vFinish.x);')
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vFinish.y * 1.5;');
    };
    const vampire=new T.Mesh(geometry,material);
    alchemistModel=new T.Group();
    alchemistModel.add(vampire);
    const flameOrigin=new T.Object3D();
    flameOrigin.name="alchemist-flame-origin";
    flameBounds.getCenter(flameOrigin.position);
    alchemistModel.add(flameOrigin);
    const eyeRay=new T.Raycaster();
    for(const u of [.605,.675]){
      const x=(u-.5)*size.x*scale;
      const y=2.29;
      eyeRay.set(new T.Vector3(x,y,4),new T.Vector3(0,0,-1));
      const hit=eyeRay.intersectObject(vampire,false)[0];
      if(hit) mesh(alchemistModel,ball,0xff1737,x,y,hit.point.z+.012,.031,.018,.021,true);
    }
  },undefined,error=>console.warn('Falha ao carregar o Alquimista.',error));
  let sniperModel;
  new GLTFLoader(loadingManager).load(new URL('./assets/vam2.glb', import.meta.url).href, ({scene: model}) => {
    const bounds = new T.Box3().setFromObject(model);
    const size = bounds.getSize(new T.Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(extent) || extent <= 0) return;
    const center = bounds.getCenter(new T.Vector3());
    const scale = 2.6 / extent;
    sniperModel = new T.Group();
    const fitted = new T.Group();
    model.updateMatrixWorld(true);
    const piecesByMaterial = new Map();
    model.traverse(part => {
      if (!part.isMesh) return;
      const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(part.matrixWorld);
      // Baking a mirrored transform removes the renderer's automatic winding flip.
      if(part.matrixWorld.determinant()<0){
        for(const attribute of Object.values(geometry.attributes)){
          const {array,itemSize,count}=attribute;
          for(let vertex=0;vertex<count;vertex+=3){
            for(let component=0;component<itemSize;component++){
              const a=(vertex+1)*itemSize+component;
              const b=(vertex+2)*itemSize+component;
              const value=array[a];
              array[a]=array[b];
              array[b]=value;
            }
          }
        }
      }
      if (!piecesByMaterial.has(part.material)) piecesByMaterial.set(part.material, []);
      piecesByMaterial.get(part.material).push(geometry);
    });
    for (const [material, pieces] of piecesByMaterial) {
      const merged = mergeGeometries(pieces);
      pieces.forEach(piece => piece.dispose());
      if (!merged) {
        sniperModel = undefined;
        return;
      }
      // The texture uses cutouts. Blending the merged triangles can hide nearer surfaces.
      const cutout = material.clone();
      cutout.transparent = false;
      cutout.depthWrite = true;
      cutout.alphaTest = .1;
      const positions=merged.attributes.position;
      const hands=[-1,1].map(side=>{
        const tip=new T.Vector3();
        let outermost=-Infinity;
        for(let i=0;i<positions.count;i++){
          const x=(positions.getX(i)-center.x)*scale;
          const y=(positions.getY(i)-bounds.min.y)*scale;
          if(y<.55||y>1.65||side*x<=outermost) continue;
          outermost=side*x;
          tip.set(x,y,(positions.getZ(i)-center.z)*scale);
        }
        const palm=new T.Vector3();
        let samples=0;
        for(let i=0;i<positions.count;i++){
          const x=(positions.getX(i)-center.x)*scale;
          const y=(positions.getY(i)-bounds.min.y)*scale;
          if(side*x<outermost-.14||Math.abs(y-tip.y)>.13) continue;
          palm.x+=x;
          palm.y+=y;
          palm.z+=(positions.getZ(i)-center.z)*scale;
          samples++;
        }
        return samples ? palm.divideScalar(samples) : tip;
      });
      const arms=hands.map((hand,index)=>{
        const shoulder=new T.Vector3(index===0?-.32:.32,1.92,hand.z*.25);
        const target=new T.Vector3(.15,1.42,index===0?-.62:-.93);
        const axis=hand.clone().sub(shoulder);
        const rotation=new T.Quaternion().setFromUnitVectors(axis.clone().normalize(),
          target.clone().sub(shoulder).normalize());
        const correction=target.clone().sub(axis.clone().applyQuaternion(rotation).add(shoulder));
        return {hand,shoulder,axis,rotation,correction};
      });
      const grip=new Float32Array(positions.count*3);
      const draw=new Float32Array(positions.count*3);
      const point=new T.Vector3(), posed=new T.Vector3();
      for(let i=0;i<positions.count;i++){
        point.set((positions.getX(i)-center.x)*scale,(positions.getY(i)-bounds.min.y)*scale,
          (positions.getZ(i)-center.z)*scale);
        const side=point.x<0?0:1;
        const arm=arms[side];
        const along=posed.copy(point).sub(arm.shoulder).dot(arm.axis)/arm.axis.lengthSq();
        const palm=point.distanceTo(arm.hand)<.19;
        const weight=palm ? 1 : T.MathUtils.smoothstep(along,.12,.81)*
          T.MathUtils.smoothstep(Math.abs(point.x),.32,.52)*
          T.MathUtils.smoothstep(point.y,.46,.72)*(1-T.MathUtils.smoothstep(point.y,1.92,2.12));
        posed.copy(point).sub(arm.shoulder).applyQuaternion(arm.rotation)
          .add(arm.shoulder).addScaledVector(arm.correction,T.MathUtils.smoothstep(along,.12,.8))
          .sub(point).multiplyScalar(weight/scale);
        grip.set([posed.x,posed.y,posed.z],i*3);
        if(side===0) draw[i*3+2]=.17*weight/scale;
      }
      merged.morphTargetsRelative=true;
      merged.morphAttributes.position=[
        new T.BufferAttribute(grip,3),new T.BufferAttribute(draw,3)
      ];
      const archer=new T.Mesh(merged,cutout);
      archer.morphTargetInfluences[0]=1;
      fitted.add(archer);
    }
    fitted.scale.setScalar(scale);
    fitted.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    sniperModel.add(fitted);
  }, undefined, error => console.warn('Falha ao carregar o modelo do Atirador.', error));
  const spots=pads.map(([x,y],i)=>{
    const p=pos(x,y), g=new T.Group();
    if(!cathedralRoutes&&(i===6||i===7)){
      mesh(scene,box,0x68758d,p.x,.72,p.z,3.8,4.54,3.8);
      mesh(scene,box,0x58627b,p.x,3.11,p.z,4.1,.24,4.1);
      for(const dx of [-1.72,1.72]){
        for(const dz of [-1.72,1.72]){
          mesh(scene,box,0x58627b,p.x+dx,3.47,p.z+dz,.62,.52,.62);
        }
      }
      p.y=3.23;
    }
    scene.add(g);g.position.copy(p);
    const disc=mesh(g,cylinder,0x829bb7,0,.14,0,1.65,.35,1.65);
    const mark=mesh(g,cylinder,0xd2eeff,0,.34,0,1.25,.08,1.25,true);
    g.userData={i,disc,mark,level:0};return g;
  });
  const pickTargets=spots.map(spot=>spot.userData.disc);
  const pointer=new T.Vector2(), ray=new T.Raycaster();
  let pan;
  let ignoreClick=false;
  const right=new T.Vector3();
  const forward=new T.Vector3();
  canvas.addEventListener('pointerdown', event=>{
    if(event.pointerType!=='mouse'||event.button!==0||drag) return;
    ignoreClick=false;
    pan={id:event.pointerId,x:event.clientX,y:event.clientY,moving:false};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event=>{
    if(pan?.id!==event.pointerId||!(event.buttons&1)) return;
    const dx=event.clientX-pan.x,dy=event.clientY-pan.y;
    if(!pan.moving&&Math.hypot(dx,dy)<5) return;
    pan.moving=true;
    ignoreClick=true;
    pan.x=event.clientX;
    pan.y=event.clientY;
    canvas.style.cursor='grabbing';
    right.setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
    forward.crossVectors(right,camera.up).normalize();
    const units=2*orbit.radius*Math.tan(T.MathUtils.degToRad(camera.fov/2))/(canvas.clientHeight*camera.zoom);
    focus.addScaledVector(right,-dx*units).addScaledVector(forward,-dy*units/Math.cos(orbit.phi));
    focus.x=T.MathUtils.clamp(focus.x,-42,42);
    focus.z=T.MathUtils.clamp(focus.z,-20,20);
    camera.position.setFromSpherical(orbit).add(focus);
    camera.lookAt(focus);
  });
  canvas.addEventListener('lostpointercapture', event=>{
    if(pan?.id!==event.pointerId) return;
    pan=null;
    if(!drag)canvas.style.cursor='';
  });
  canvas.onclick=event=>{
    if(ignoreClick){
      ignoreClick=false;
      return;
    }
    const i=platformAt(event);
    if(i!==undefined) build(i);
  };
  function platformAt(event){
    const r=canvas.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(pickTargets,false)[0];
    return hit?.object.parent.userData.i;
  }
  const defenseType='application/x-fortaleza-defense';
  canvas.addEventListener('dragover',event=>{
    if(!event.dataTransfer.types.includes(defenseType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect=platformAt(event)===undefined?'none':'copy';
  });
  canvas.addEventListener('drop',event=>{
    const data=event.dataTransfer.getData(defenseType);
    if(!/^[0-2]$/.test(data)) return;
    event.preventDefault();
    const i=platformAt(event);
    if(i!==undefined) build(i,Number(data));

  });
  const towerColors=[0xa4b8d6,0xc069ea,0xe88696];
  let crossbow;
  // The supplied FBX references a base-color image that was not bundled.
  const crossbowSwatch=document.createElement('canvas');
  crossbowSwatch.width=crossbowSwatch.height=1;
  const swatchPaint=crossbowSwatch.getContext('2d');
  swatchPaint.fillStyle='#72513b';
  swatchPaint.fillRect(0,0,1,1);
  const crossbowColor=crossbowSwatch.toDataURL();
  loadingManager.setURLModifier(url=>url.endsWith('_None_BaseColor.png')?crossbowColor:url);
  new FBXLoader(loadingManager).load(new URL('./assets/crossbow.fbx',import.meta.url).href,model=>{
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3());
    const mount=new T.Group();
    model.position.sub(bounds.getCenter(new T.Vector3()));
    mount.scale.setScalar(1.05/Math.max(size.x,size.y,size.z));
    mount.add(model);
    mount.rotation.y=-Math.PI/2;
    crossbow=mount;
  });
  function badgeMaterial(draw){
    const tile=document.createElement('canvas');
    tile.width=128;
    tile.height=32;
    draw(tile.getContext('2d'));
    const map=new T.CanvasTexture(tile);
    map.colorSpace=T.SRGBColorSpace;
    return new T.SpriteMaterial({map,transparent:true,depthWrite:false});
  }
  const levelBadges=[1,2,3].map(level=>badgeMaterial(ctx=>{
    ctx.fillStyle='#211728';
    ctx.fillRect(13,1,102,30);
    ctx.strokeStyle='#bd697d';
    ctx.strokeRect(14,2,100,28);
    ctx.fillStyle='#fff0de';
    ctx.font='bold 19px sans-serif';
    ctx.textAlign='center';
    ctx.fillText('NÍVEL '+level,64,23);
  }));
  const healthBadges=Array.from({length:21},(_,i)=>badgeMaterial(ctx=>{
    ctx.fillStyle='#191321';
    ctx.fillRect(1,5,126,22);
    ctx.strokeStyle='#dcb2bc';
    ctx.strokeRect(2,6,124,20);
    ctx.fillStyle=i<=6?'#ed7a58':'#d94468';
    ctx.fillRect(5,9,118*i/20,14);
  }));
  function updateTower(g,t){
    const {disc,mark}=g.userData;
    const customModel = [gargoyleModel,alchemistModel,sniperModel][t?.kind];
    if(g.userData.model!==customModel||g.userData.level!==(t?.level??0)||g.userData.kind!==t?.kind){
      for(const part of g.children.slice(2))g.remove(part);
      g.userData.figure=undefined;
      g.userData.levelBadge=undefined;
      g.userData.model=customModel;
      g.userData.level=t?.level??0;g.userData.kind=t?.kind;
      if(t){
        const c=towerColors[t.kind], h=1.2+.3*t.level;
        if(!customModel) mesh(g,cylinder,0x323c56,0,h/2,0,1,h,1);
        if(customModel){
          const figure=customModel.clone(true);
          figure.position.y=.16;
          const facing=Math.atan2(camera.position.x-g.position.x,camera.position.z-g.position.z);
          figure.rotation.y=facing+(t.kind===2?Math.PI:0);
          g.add(figure);
          if(t.kind===2){
            g.userData.figure=figure;
            const bow=new T.Group();
            bow.position.set(.15,1.42,-.78);
            figure.add(bow);
            const grip=new T.Group();
            grip.position.z=-.15;
            if(crossbow)grip.add(crossbow.clone(true));
            bow.add(grip);
            figure.userData.armMeshes=[];
            figure.traverse(part=>{
              if(part.morphTargetInfluences) figure.userData.armMeshes.push(part);
            });
          }
        }else{
          mesh(g,t.kind===0?ball:cylinder,c,0,h+.42,0,.66,.75,.66,t.kind===1);
          if(t.kind!==1)mesh(g,box,c,.54,h+.38,0,1.65,.26,.28);
        }
        g.updateWorldMatrix(true,true);
        const top=new T.Box3().setFromObject(g).max.y-g.position.y;
        const badge=new T.Sprite(levelBadges[t.level-1]);
        badge.position.y=top+.34;
        badge.scale.set(1.75,.44,1);
        g.add(badge);
        g.userData.levelBadge=badge;
      }
    }
    const badgeScale=1.65 * camera.zoom ** -1.07;
    g.userData.levelBadge?.scale.set(1.75*badgeScale,.44*badgeScale,1);
    mark.visible=!t;
    disc.visible=!customModel;

  }
  let witchModel, witchWalk;
  new GLTFLoader(loadingManager).load(new URL('./assets/bruxa.glb', import.meta.url).href,({scene:model,animations})=>{
    const bounds=new T.Box3().setFromObject(model);
    const height=bounds.getSize(new T.Vector3()).y;
    if(!Number.isFinite(height)||height<=0) return;
    const center=bounds.getCenter(new T.Vector3());
    const fitted=new T.Group();
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
    fitted.add(model);
    fitted.scale.setScalar(2.65/height);
    fitted.rotation.y=0;
    witchWalk=animations.find(clip=>clip.name==='walk-loop');
    witchModel=fitted;
  },undefined,error=>console.warn('Falha ao carregar o Bruxa.',error));
  const walkingModels=[];
  function loadWalker(url,kind,targetHeight){
    new GLTFLoader(loadingManager).load(url,({scene:model})=>{
    if(kind===1){
      for(const name of ['Goblins_Sword','Goblins_Shield'])model.getObjectByName(name)?.removeFromParent();
    }
    if(kind===2){
      const weapons=[];
      model.traverse(part=>{
        if(part.isMesh&&part.material.name==='defaultMat5')weapons.push(part);
      });
      for(const weapon of weapons)weapon.removeFromParent();
    }
    const bounds=new T.Box3().setFromObject(model);
    const center=bounds.getCenter(new T.Vector3());
    const height=bounds.getSize(new T.Vector3()).y;
    if(!Number.isFinite(height)||height<=0) return;
    model.updateMatrixWorld(true);
    model.traverse(part=>{
      if(!part.isMesh)return;
      const geometry=part.geometry;
      const vertices=geometry.attributes.position;
      const stride=new Float32Array(vertices.count*3);
      const leftLift=new Float32Array(stride.length),rightLift=new Float32Array(stride.length);
      const inverseBasis=new T.Matrix3().setFromMatrix4(part.matrixWorld).invert();
      const forward=new T.Vector3(0,0,height*.14).applyMatrix3(inverseBasis);
      const upward=new T.Vector3(0,height*.065,0).applyMatrix3(inverseBasis);
      const point=new T.Vector3();
      for(let i=0;i<vertices.count;i++){
        point.fromBufferAttribute(vertices,i).applyMatrix4(part.matrixWorld);
        const weight=1-T.MathUtils.smoothstep((point.y-bounds.min.y)/height,.12,.48);
        const side=point.x<center.x?-1:1;
        const level=(point.y-bounds.min.y)/height;
        const lateral=Math.abs(point.x-center.x)/height;
        const armWeight=T.MathUtils.smoothstep(lateral,.19,.32)*
          T.MathUtils.smoothstep(level,.36,.53)*(1-T.MathUtils.smoothstep(level,.72,.86));
        forward.clone().multiplyScalar(side*(weight-.55*armWeight)).toArray(stride,i*3);
        upward.clone().multiplyScalar(weight).toArray(side<0?leftLift:rightLift,i*3);
      }
      geometry.morphTargetsRelative=true;
      geometry.morphAttributes.position=[stride,leftLift,rightLift].map(data=>new T.BufferAttribute(data,3));
      part.updateMorphTargets();
    });
    const scale=targetHeight/height;
    const walker=new T.Group();
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
    walker.add(model);
    walker.scale.setScalar(scale);
    if(kind===0){
      model.traverse(part=>{
        if(!part.isMesh)return;
        const geometry=part.geometry;
        const positions=geometry.attributes.position;
        const colors=new Float32Array(positions.count*3);
        const fur=new T.Color(0x29343e), muzzle=new T.Color(0x67727a);
        const color=new T.Color(), point=new T.Vector3();
        for(let i=0;i<positions.count;i++){
          point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld);
          const x=(point.x-center.x)/height,y=(point.y-bounds.min.y)/height,z=(point.z-center.z)/height;
          const face=T.MathUtils.smoothstep(y,.73,.91)*(1-T.MathUtils.smoothstep(Math.abs(x),.075,.18));
          const grain=Math.sin(x*337+y*98+z*221)*Math.cos(x*173-y*36+z*284);
          color.copy(fur).lerp(muzzle,face*.72).multiplyScalar(1+grain*.21);
          color.toArray(colors,i*3);
        }
        geometry.setAttribute('color',new T.BufferAttribute(colors,3));
        part.material=new T.MeshStandardMaterial({vertexColors:true,roughness:.97});
      });
    }
    walkingModels[kind]=walker;
    },undefined,error=>console.warn('Falha ao carregar inimigo animado.',error));
  }
  loadWalker(new URL('./assets/troll.glb', import.meta.url).href,1,2.8);
  loadWalker(new URL('./assets/lobisomem.glb', import.meta.url).href,0,2.45);
  loadWalker(new URL('./assets/cacador.glb', import.meta.url).href,2,2.55);
  const grenadeEffects=new Map();
  const shockwave=new T.RingGeometry(.78,1,40);
  const actors=new Map(), beams=new Map();
  const arrowWood=new T.TextureLoader(loadingManager).load(new URL('./assets/arrow-wood.jpg',import.meta.url).href);
  arrowWood.colorSpace=T.SRGBColorSpace;
  const arrowMaterial=new T.MeshStandardMaterial({map:arrowWood,roughness:.8});
  let arrowModel;
  new OBJLoader(loadingManager).load(new URL('./assets/arrow.obj',import.meta.url).href,model=>{
    const bounds=new T.Box3().setFromObject(model);
    const size=bounds.getSize(new T.Vector3());
    const axis=size.x>size.y&&size.x>size.z?'x':size.y>size.z?'y':'z';
    model.position.sub(bounds.getCenter(new T.Vector3()));
    model.traverse(part=>{if(part.isMesh)part.material=arrowMaterial;});
    arrowModel=new T.Group();
    arrowModel.add(model);
    arrowModel.scale.setScalar(1.1/size[axis]);
    if(axis==='x')arrowModel.rotation.y=-Math.PI/2;
    if(axis==='y')arrowModel.rotation.x=Math.PI/2;
  });
  const sparkGeometry=new T.SphereGeometry(1,10,8);
  const sparkMaterial=new T.MeshBasicMaterial({color:0xffc25c});
  const fireGlow=new T.SpriteMaterial({map:glowTexture,color:0xff7021,blending:T.AdditiveBlending,depthWrite:false});
  const emberMaterial=new T.MeshBasicMaterial({color:0xff7233});
  const colors=[0x9d89b7,0x628568,0xc68f61,0xdf4b88];
  function makeActor(m){
    const g=new T.Group(), c=colors[m.k];
    if(m.k===3&&witchModel){
      const model=cloneRig(witchModel);
      g.add(model);
      if(witchWalk){
        const mixer=new T.AnimationMixer(model);
        mixer.clipAction(witchWalk).play();
        g.userData.walkMixer=mixer;
      }
      scene.add(g);
      return g;
    }
    if(walkingModels[m.k]){
      g.add(walkingModels[m.k].clone(true));
      g.userData.legs=[];
      g.traverse(part=>{
        if(part.morphTargetInfluences)g.userData.legs.push(part.morphTargetInfluences);
      });
      g.userData.stepDistance=0;
      g.userData.customWalker=true;
      scene.add(g);
      return g;
    }
    const size=[.72,1.05,.62,.78][m.k];
    mesh(g,ball,c,0,size*1.45,0,size*.78,size,size*.58);
    mesh(g,ball,c,0,size*2.36,.17,size*.52,size*.53,size*.49);
    if(m.k===0)for(const x of [-.23,.23])mesh(g,cone,c,x,size*2.9,.12,.17,.45,.18);
    if(m.k===3)mesh(g,cone,0x712253,0,size*3,0,.64,.79,.64);
    for(const side of [-1,1])mesh(g,ball,0xf94e74,side*.16,size*2.42,.54,.065,.065,.065,true);
    scene.add(g);
    return g;
  }
  return (placed,mobs,shots)=>{
    const width=canvas.clientWidth, height=canvas.clientHeight;
    const pixel=renderer.getPixelRatio();
    if(canvas.width!==Math.floor(width*pixel)||canvas.height!==Math.floor(height*pixel)){
      renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    spots.forEach((g,i)=>updateTower(g,placed[i]));
    const live=new Set(mobs);
    for(const [m,g] of actors)if(!live.has(m)){scene.remove(g);actors.delete(m);}
    for(const m of mobs){
      const previous=actors.get(m);
      if(!previous||(walkingModels[m.k]&&!previous.userData.customWalker)){
        if(previous)scene.remove(previous);
        actors.set(m,makeActor(m));
      }
      const g=actors.get(m), target=pos(...(m.route??path)[m.seg]);
      const legs=g.userData.legs;
      if(legs){
        const last=g.userData.lastStep;
        if(last)g.userData.stepDistance+=Math.hypot(m.x-last.x,m.y-last.y)/13;
        g.userData.lastStep={x:m.x,y:m.y};
        const wolf=m.k===0;
        const phase=g.userData.stepDistance*Math.PI/(wolf?1.06:.78);
        if(wolf){
          g.children[0].rotation.x=.14+Math.sin(phase)*.035;
          g.children[0].rotation.z=Math.cos(phase)*.05;
        }
        for(const weights of legs){
          weights[0]=Math.cos(phase);
          weights[1]=Math.max(0,Math.sin(phase))*(wolf?.23:1);
          weights[2]=Math.max(0,-Math.sin(phase))*(wolf?.38:1);
        }
      }
      const walkMixer=g.userData.walkMixer;
      if(walkMixer){
        const last=g.userData.lastStep;
        if(last){
          const distance=Math.hypot(m.x-last.x,m.y-last.y)/13;
          walkMixer.update(distance*witchWalk.duration/2.1);
        }
        g.userData.lastStep={x:m.x,y:m.y};
      }
      const bounce=(m.k===1||legs||walkMixer) ? -.035 : Math.sin(performance.now()/65+m.x)*.12+.1;
      g.position.copy(pos(m.x,m.y,bounce));
      g.position.y+=bridgeHeight(g.position.x,g.position.z);
      if(!g.userData.healthBar){
        const bar=new T.Sprite(healthBadges[20]);
        g.updateWorldMatrix(true,true);
        bar.position.y=new T.Box3().setFromObject(g).max.y-g.position.y+.28;
        bar.scale.set(1.55,.39,1);
        g.add(bar);
        g.userData.healthBar=bar;
      }
      const healthStep=Math.ceil(20*T.MathUtils.clamp(m.health/m.maxHealth,0,1));
      const badgeScale=1.65 * camera.zoom ** -1.07;
      g.userData.healthBar.scale.set(1.55*badgeScale,.39*badgeScale,1);
      g.userData.healthBar.material=healthBadges[healthStep];
      if(target)g.rotation.y=Math.atan2(target.x-g.position.x,target.z-g.position.z);
    }
    const now=performance.now();
    forestEyes.forEach((material,i)=>{
      const phase=(now+i*1130)%(3700+i*870);
      material.opacity=phase<110||phase>270&&phase<385?0:.92;
    });
    cathedralFires.forEach(({flame,core,light,coreHeight=1},i)=>{
      const flicker=Math.sin(now*.014+i)*.14+Math.sin(now*.023+i*2)*.09;
      flame.scale.set(1-flicker*.6,1+flicker,1-flicker*.6);
      flame.rotation.z=flicker*.45;
      core.scale.y=coreHeight*(1-flicker*.6);
      if(light)light.intensity=9+flicker*9;
    });
    cathedralBats.forEach(({prop,mixer,center},i)=>{
      const angle=now*.0012+i*2.1;
      prop.position.set(center.x+4*Math.cos(angle),4.2+.55*Math.sin(angle*2+i),4.7*Math.sin(angle));
      prop.rotation.y=Math.atan2(-4*Math.sin(angle),4.7*Math.cos(angle));
      mixer.setTime(now*.001+i*.13);
    });
    const portalPulse=.5+.5*Math.sin(now*.003);
    vortex.uniforms.time.value=now*.001;
    portalLight.intensity=3+portalPulse*3;
    bats.forEach(({body,wings},i)=>{
      const time=now*.001;
      const angle=time*(.65+i*.045)+i*1.06;
      const radius=3.3+i*.52;
      body.position.set(gate.x+Math.cos(angle)*radius,5.1+i*.46+Math.sin(time*2+i)*.45,
        gate.z+Math.sin(angle)*radius);
      body.rotation.y=-angle;
      const flap=Math.sin(time*16+i*2)*.72;
      wings[0].rotation.z=flap;
      wings[1].rotation.z=-flap;
    });
    current.offset.y=-(now*.00015)%1;
    for(const shot of shots){
      if(shot.grenade||beams.has(shot)) continue;
      const spot=spots.find(g=>{
        const [x,y]=pads[g.userData.i];
        return x===shot.x&&y===shot.y;
      });
      if(!spot||(!spot.userData.figure&&shot.kind!==1))continue;
      spot.userData.castAt=now;
      spot.userData.aim=Math.atan2(shot.a-shot.x,shot.b-shot.y);
    }
    for(const spot of spots){
      const {figure,aim,castAt,i}=spot.userData;
      if(!figure){
        if(alchemistModel&&spot.userData.model===alchemistModel){
          const model=spot.children[2];
          const facing=now-(castAt??-1000)<450&&aim!==undefined
            ? aim
            : Math.atan2(camera.position.x-spot.position.x,camera.position.z-spot.position.z);
          const turn=facing-model.rotation.y;
          model.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*.45;
        }
        if(spot.userData.model===gargoyleModel&&gargoyleModel){
          spot.children[2].rotation.y=Math.atan2(camera.position.x-spot.position.x,camera.position.z-spot.position.z);
        }
        continue;
      }
      const elapsed=(now-(castAt??-1000))/1000;
      const recoil=elapsed<.42 ? Math.sin(Math.PI*Math.min(elapsed/.13,1)/2)*Math.max(0,1-elapsed/.42) : 0;
      const facing=elapsed<.65&&aim!==undefined
        ? aim
        : Math.atan2(camera.position.x-spot.position.x,camera.position.z-spot.position.z);
      // The imported model faces local -Z.
      const turn=facing+Math.PI-figure.rotation.y;
      figure.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*.35;
      const pull=elapsed<.16 ? .17*Math.exp(-elapsed*30) : 0;
      for(const part of figure.userData.armMeshes){
        part.morphTargetInfluences[1]=pull/.17;
      }
      figure.rotation.x=Math.sin(now/570+i)*.022-recoil*.24;
      figure.scale.y=1+Math.sin(now/470+i)*.017+recoil*.07;
      figure.position.y=.16+recoil*.13;
    }
    const visible=new Set(shots);
    for(const [shot,effect] of grenadeEffects){
      if(visible.has(shot))continue;
      scene.remove(effect);
      effect.traverse(part=>part.material?.dispose());
      grenadeEffects.delete(shot);
    }
    for(const shot of shots){
      if(!shot.grenade)continue;
      let effect=grenadeEffects.get(shot);
      if(!effect){
        effect=new T.Group();
        effect.position.copy(pos(shot.a,shot.b,.65));
        const spot=spots.find((_,i)=>pads[i][0]===shot.a&&pads[i][1]===shot.b);
        effect.position.y+=spot?.position.y??0;
        const flashMaterial=new T.MeshBasicMaterial({
          color:0xfff4ce,transparent:true,depthWrite:false,blending:T.AdditiveBlending
        });
        effect.add(new T.Mesh(ball,flashMaterial));
        const ring=new T.Mesh(shockwave,new T.MeshBasicMaterial({
          color:0xffbe57,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending
        }));
        ring.rotation.x=-Math.PI/2;
        effect.add(ring);
        const sparks=flashMaterial.clone();
        sparks.color.setHex(0xffcf78);
        for(let i=0;i<16;i++)effect.add(new T.Mesh(ball,sparks));
        scene.add(effect);
        grenadeEffects.set(shot,effect);
      }
      const t=1-shot.life/.6;
      const [flash,ring,...sparks]=effect.children;
      flash.scale.setScalar(.28+t*2.2);
      flash.material.opacity=(1-t)**4;
      ring.scale.setScalar(.35+t*3.5);
      ring.material.opacity=(1-t)**2;
      sparks.forEach((spark,i)=>{
        const angle=i*Math.PI/8;
        spark.position.set(Math.cos(angle)*t*3,Math.sin(t*Math.PI)*(.7+i%3*.23),Math.sin(angle)*t*3);
        spark.scale.set(.075,.15,.075);
        spark.material.opacity=1-t;
      });
    }
    for(const [shot,effect] of beams)if(!visible.has(shot)){
      scene.remove(effect);
      if(effect.isLineSegments){
        effect.geometry.dispose();
        effect.material.dispose();
      }
      beams.delete(shot);
    }
    for(const shot of shots){
      if(shot.grenade)continue;
      const impact=pos(shot.a,shot.b,1);
      impact.y+=bridgeHeight(impact.x,impact.z);
      const source=spots.find((_,i)=>pads[i][0]===shot.x&&pads[i][1]===shot.y);
      const origin=pos(shot.x,shot.y,1.55+(source?.position.y??0));
      const flameOrigin=shot.kind===1?source?.getObjectByName("alchemist-flame-origin"):undefined;
      flameOrigin?.getWorldPosition(origin);
      let effect=beams.get(shot);
      if(!effect){
        if(shot.kind===0){
          const points=[];
          source?.traverse(part=>{
            if(part.name==='laser-eye')points.push(part.getWorldPosition(new T.Vector3()),impact);
          });
          if(!points.length)points.push(origin,impact);
          effect=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),
            new T.LineBasicMaterial({color:0xff385d,transparent:true}));
        }else{
          effect=new T.Group();
          if(shot.kind===2){
            if(arrowModel)effect.add(arrowModel.clone(true));
            const flame=new T.Sprite(fireGlow);
            flame.position.z=.54;
            flame.scale.set(.74,.56,1);
            effect.add(flame);
          }
          if(shot.kind===1){
            mesh(effect,sparkGeometry,0xffc25c,0,0,0,.17,.17,.17,true).material=sparkMaterial;
            for(let i=1;i<=5;i++){
              const size=.12-i*.017;
              mesh(effect,sparkGeometry,0xff7233,0,0,-i*.15,size,size,size,true).material=emberMaterial;
            }
          }
        }
        scene.add(effect);
        beams.set(shot,effect);
      }
      if(effect.isLineSegments)effect.material.opacity=shot.life/shot.duration;
      else{
        effect.position.copy(origin).lerp(impact,1-shot.life/shot.duration);
        effect.lookAt(impact);
      }
    }
    renderer.render(scene,camera);
  };
}
