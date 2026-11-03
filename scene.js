import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/STLLoader.js';
import * as T from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

export function createScene(canvas, path, pads, build, zoomIn, zoomOut) {
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
  zoomIn.onclick = () => zoomBy(1.15);
  zoomOut.onclick = () => zoomBy(1 / 1.15);
  canvas.addEventListener('wheel', event => {
    if (!event.deltaY) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, {passive: false});
  scene.add(new T.HemisphereLight(0xdceaff, 0x968199, 3.0));
  const moon = new T.DirectionalLight(0xc4dbff, 2.6);
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
  const stone=masonry(5,3);
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
  const grassTile=document.createElement('canvas');
  grassTile.width=grassTile.height=256;
  const grassPaint=grassTile.getContext('2d');
  const groundTexture=new T.CanvasTexture(grassTile);
  function paintGrass(image){
    grassPaint.fillStyle='#273b29';
    grassPaint.fillRect(0,0,256,256);
    if(image){
      grassPaint.globalAlpha=.24;
      grassPaint.drawImage(image,0,0,256,256);
      grassPaint.globalAlpha=1;
    }
    let seed=86;
    const sample=()=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296;
    };
    const greens=['#192c20','#29432b','#355237','#496445'];
    for(const color of greens){
      grassPaint.strokeStyle=color;
      grassPaint.beginPath();
      for(let i=0;i<850;i++){
        const x=sample()*256,y=sample()*256;
        grassPaint.moveTo(x,y);
        grassPaint.lineTo(x+(sample()-.5)*5,y-2-sample()*6);
      }
      grassPaint.stroke();
    }
    groundTexture.needsUpdate=true;
  }
  paintGrass();
  new T.TextureLoader().load(new URL('./assets/grass-ground.jpg', import.meta.url).href, texture=>{
    paintGrass(texture.image);
    texture.dispose();
  });
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
      color:color===0x46546a ? 0xc6d7bd : color, map:map || null, flatShading:true, emissive:glow ? color : 0, emissiveIntensity:.85
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
  const riverX=pos(577,0).x;
  const bankLeft=riverX-2,bankRight=riverX+2;
  const rampLength=1.25, rise=.78;
  const bridgeZ=pos(0,275).z;
  for(const [left,right] of [[-42,bankLeft],[bankRight,42]]){
    mesh(scene,box,0x46546a,(left+right)/2,-.8,0,right-left,1.5,37);
  }
  mesh(scene,box,0x427b94,riverX,-.85,0,4,.12,37);
  function bridgeHeight(x,y){
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
    const roadway=mesh(scene,surface,color,0,flat ? -.035 : .15,0,1,1,1);
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
      const plank=mesh(scene,box,0x927452,T.MathUtils.lerp(start,end,t),
        .06+T.MathUtils.lerp(low,high,t),bridgeZ,length/boards-.012,.18,3.1);
      plank.rotation.z=angle;
    }
    for(const side of [-1,1]){
      const rail=mesh(scene,box,0x927452,(start+end)/2,.62+(low+high)/2,
        bridgeZ+side*1.48,length+.05,.15,.15);
      rail.rotation.z=angle;
    }
  }
  for(const x of [leftJoin,bankLeft,riverX,bankRight,rightJoin]){
    for(const side of [-1,1]){
      mesh(scene,box,0x927452,x,.38+bridgeHeight(x,bridgeZ),bridgeZ+side*1.48,.16,.7,.16);
    }
  }
  const entrance=road[0];
  new GLTFLoader().load(new URL('./assets/caverna.glb', import.meta.url).href,({scene:model})=>{
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
    scene.add(cave);
  },undefined,error=>console.warn('Falha ao carregar a caverna.',error));
  const portal=new T.Group();
  portal.position.set(entrance.x-.85,1.27,entrance.z);
  portal.rotation.y=Math.PI/2;
  portal.scale.set(2.12,1.62,1);
  portal.position.y=1.53;
  scene.add(portal);
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
  scene.add(portalLight);
  const wallX=bankRight+.24;
  for(const [start,end] of [[-18.5,bridgeZ-1.55],[bridgeZ+1.55,18.5]]){
    mesh(scene,box,0x68758d,wallX,-.10,(start+end)/2,.85,4.5,end-start);
    for(let z=start+.48;z<end-.25;z+=1.2){
      mesh(scene,box,0x58627b,wallX,2.34,z,.94,.44,.65);
    }
  }
  const rearWallX=41.76;
  for(const z of [-18.26,18.26]){
    mesh(scene,box,0x68758d,(wallX+rearWallX)/2,-.10,z,rearWallX-wallX,4.5,.85);
    for(let x=wallX+.8;x<rearWallX-.45;x+=1.2){
      mesh(scene,box,0x58627b,x,2.34,z,.65,.44,.94);
    }
  }
  mesh(scene,box,0x68758d,rearWallX,-.10,0,.85,4.5,37);
  for(let z=-18.05;z<=18.05;z+=1.2){
    mesh(scene,box,0x58627b,rearWallX,2.34,z,.94,.44,.65);
  }
  const gate=pos(...path.at(-1));
  const castleMoonlight=new T.SpotLight(0xb4ceff,210,29,Math.PI/5,.75,2);
  castleMoonlight.position.set(gate.x-5,17,gate.z-6);
  castleMoonlight.target.position.set(gate.x+5,4,gate.z);
  scene.add(castleMoonlight,castleMoonlight.target);
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
    scene.add(body);
    return {body,wings};
  });
  for(const z of [gate.z-3.3,gate.z+3.3]){
    mesh(scene,box,0x68758d,gate.x+1,3.5,z,3.6,7,3.2);
    for(const x of [-1.25,1.25])for(const dz of [-1,1])mesh(scene,box,0x58627b,gate.x+1+x,7.3,z+dz,.8,.85,.8);
    mesh(scene,cylinder,0x7e2947,gate.x-1.2,1.1,z, .52,2.1,.52);
    mesh(scene,box,0xff3b63,gate.x-1.75,1.45,z,.12,.85,.26,true);
  }
  mesh(scene,box,0x454861,gate.x+1,4.25,gate.z,3.3,1.4,5);
  mesh(scene,box,0x89869a,gate.x+.39,.045,gate.z,.85,.19,3.8);
  mesh(scene,box,0x491427,gate.x+.6,1.8,gate.z,.3,3.6,3.8);
  mesh(scene,ball,0xff315f,gate.x+.39,2.65,gate.z,.28,.42,.42,true);
  const keepX=gate.x+8.2;
  mesh(scene,box,0x68758d,keepX,4.1,gate.z,8.4,8.3,8.8);
  mesh(scene,box,0x58627b,keepX,8.15,gate.z,8.9,.45,9.3);
  for(const side of [-1,1]){
    for(let offset=-3.6;offset<=3.6;offset+=1.2){
      mesh(scene,box,0x58627b,keepX+offset,8.68,gate.z+side*4.4,.62,.75,.72);
      mesh(scene,box,0x58627b,keepX+side*4.2,8.68,gate.z+offset,.72,.75,.62);
    }
    for(const x of [gate.x+4.4,gate.x+11.9]){
      const z=gate.z+side*5.1;
      mesh(scene,box,0x68758d,x,4.95,z,2.8,10,2.8);
      mesh(scene,box,0x58627b,x,9.9,z,3.15,.5,3.15);
      for(const dx of [-1.1,0,1.1]){
        for(const dz of [-1.1,0,1.1]){
          if(dx||dz) mesh(scene,box,0x58627b,x+dx,10.45,z+dz,.55,.72,.55);
        }
      }
      for(const height of [3.6,6.8,8.6]){
        mesh(scene,box,0x454861,x-1.43,height,z,.12,1.05,.46);
        mesh(scene,box,0x1e1725,x-1.5,height+.05,z,.06,.78,.18);
      }
    }
    for(const x of [keepX-1.9,keepX,keepX+1.9]){
      const z=gate.z+side*4.42;
      mesh(scene,box,0x454861,x,5.6,z,.65,1.5,.14);
      mesh(scene,box,0x351a29,x,5.65,z+side*.08,.29,1.18,.08);
    }
  }
  const bloodLight=new T.PointLight(0xff2458,58,11);
  bloodLight.position.set(gate.x-1,2.6,gate.z);scene.add(bloodLight);
  const forest=[];
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
    new GLTFLoader().load(url,({scene:model})=>{
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
        scene.add(instance);
      });
    },undefined,error=>console.warn('Falha ao carregar a árvore.',error));
  }
  loadTrees(new URL('./assets/arvore.glb', import.meta.url).href,0);
  loadTrees(new URL('./assets/arvore-seca.gltf', import.meta.url).href,1);
  for(const [x,z,height] of [[-26,-13,4.7],[-13,-15,5.3],[2,-14,4.5],[20,-15,5],[29,14,4.8],[-19,15,4.6],[-33,-15,4.4],[-22,-16,4.9],[-6,-12,4.2],[25,-12,4.1],[-32,13,4.5],[-10,16,4.8],[3,14,4.2],[18,15,4.7]]){
    forest.push({x,z,height,variant:2});
  }
  loadTrees(new URL('./assets/pinheiro.glb', import.meta.url).href,2);
  let gargoyleModel;
  new STLLoader().load(new URL('./assets/gargula.stl', import.meta.url).href, geometry=>{
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
      mesh(gargoyleModel,ball,0xffa0a7,x,eyeHeight,z+.028,.029,.022,.015,true);
    }
  },undefined,error=>console.warn('Falha ao carregar a Gárgula.',error));
  let sniperModel;
  new GLTFLoader().load(new URL('./assets/vam2.glb', import.meta.url).href, ({scene: model}) => {
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
      fitted.add(new T.Mesh(merged, cutout));
    }
    fitted.scale.setScalar(scale);
    fitted.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    sniperModel.add(fitted);
  }, undefined, error => console.warn('Falha ao carregar o modelo do Atirador.', error));
  const spots=pads.map(([x,y],i)=>{
    const p=pos(x,y), g=new T.Group();
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
  function updateTower(g,t){
    const {disc,mark}=g.userData;
    const customModel = t?.kind===2 ? sniperModel : t?.kind===0 ? gargoyleModel : undefined;
    if(g.userData.model!==customModel||g.userData.level!==(t?.level??0)||g.userData.kind!==t?.kind){
      for(const part of g.children.slice(2))g.remove(part);
      g.userData.figure=undefined;
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
          if(t.kind===2) g.userData.figure=figure;
        }else{
          mesh(g,t.kind===0?ball:cylinder,c,0,h+.42,0,.66,.75,.66,t.kind===1);
          if(t.kind!==1)mesh(g,box,c,.54,h+.38,0,1.65,.26,.28);
        }
      }
    }
    mark.visible=!t;
    disc.visible=!customModel||t.jam>0;
    disc.scale.y=t?.jam>0?.64:.35;
  }
  const actors=new Map(), beams=new Map();
  const colors=[0x9d89b7,0x628568,0xc68f61,0xdf4b88];
  function makeActor(m){
    const g=new T.Group(), c=colors[m.k];
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
      if(!actors.has(m))actors.set(m,makeActor(m));
      const g=actors.get(m), target=road[m.seg];
      g.position.copy(pos(m.x,m.y,Math.sin(performance.now()/(m.k===1?115:65)+m.x)*.12+.1));
      g.position.y+=bridgeHeight(g.position.x,g.position.z);
      if(target)g.rotation.y=Math.atan2(target.x-g.position.x,target.z-g.position.z);
    }
    const now=performance.now();
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
      if(beams.has(shot)) continue;
      const spot=spots.find(g=>{
        const [x,y]=pads[g.userData.i];
        return x===shot.x&&y===shot.y;
      });
      if(!spot?.userData.figure) continue;
      spot.userData.castAt=now;
      spot.userData.aim=Math.atan2(shot.a-shot.x,shot.b-shot.y);
    }
    for(const spot of spots){
      const {figure,aim,castAt,i}=spot.userData;
      if(!figure){
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
      figure.rotation.x=Math.sin(now/570+i)*.022-recoil*.24;
      figure.scale.y=1+Math.sin(now/470+i)*.017+recoil*.07;
      figure.position.y=.16+recoil*.13;
    }
    const visible=new Set(shots);
    for(const [s,b] of beams)if(!visible.has(s)){
      scene.remove(b);b.geometry.dispose();b.material.dispose();beams.delete(s);
    }
    for(const s of shots)if(!beams.has(s)){
      const impact=pos(s.a,s.b,1);
      impact.y+=bridgeHeight(impact.x,impact.z);
      const b=new T.Line(new T.BufferGeometry().setFromPoints([pos(s.x,s.y,2),impact]),
        new T.LineBasicMaterial({color:s.color,transparent:true,opacity:.85}));
      scene.add(b);beams.set(s,b);
    }
    renderer.render(scene,camera);
  };
}
