import * as T from 'three';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

export function createScene(canvas, path, pads, build, zoomIn, zoomOut) {
  const renderer = new T.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new T.Scene();
  scene.background = new T.Color(0x344767);
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
  const surfaces=new Map([
    [0x46546a,[soil,3]], [0x89869a,[paving,3]], [0x68758d,[stone,3]],
    [0x58627b,[stone,3]], [0x454861,[stone,3]], [0x343a50,[stone,3]],
    [0x5b6275,[stone,3]], [0x202c41,[needles]], [0x29374a,[needles]],
    [0x514641,[bark]]
  ]);
  function mesh(parent, shape, color, x,y,z, w,h,d, glow=false) {
    const [map,tileSize] = surfaces.get(color) || [];
    const key = color + ':' + glow;
    if(!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
      color, map:map || null, flatShading:true, emissive:glow ? color : 0, emissiveIntensity:.85
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
  mesh(scene,box,0x46546a,0,-.8,0,84,1.5,37);
  const road = path.map(([x,y])=>pos(x,y));
  for(let i=1;i<road.length;i++){
    const a=road[i-1], b=road[i];
    const roadbed=mesh(scene,box,0x89869a,(a.x+b.x)/2,.035,(a.z+b.z)/2,a.distanceTo(b)+2.8,.23,3.1);
    roadbed.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
    if(i===5){
      for(const z of [a.z-1.7,a.z+1.7]) mesh(scene,box,0x343a50,(a.x+b.x)/2,.55,z,a.distanceTo(b)+2,.75,.25);
      for(let x=a.x;x<=b.x;x+=1.5)for(const z of [a.z-1.7,a.z+1.7])mesh(scene,box,0x5b6275,x,.94,z,.45,.5,.5);
    }
  }
  const gate=pos(...path.at(-1));
  for(const z of [gate.z-3.3,gate.z+3.3]){
    mesh(scene,box,0x68758d,gate.x+1,3.5,z,3.6,7,3.2);
    for(const x of [-1.25,1.25])for(const dz of [-1,1])mesh(scene,box,0x58627b,gate.x+1+x,7.3,z+dz,.8,.85,.8);
    mesh(scene,cylinder,0x7e2947,gate.x-1.2,1.1,z, .52,2.1,.52);
    mesh(scene,box,0xff3b63,gate.x-1.75,1.45,z,.12,.85,.26,true);
  }
  mesh(scene,box,0x454861,gate.x+1,4.25,gate.z,3.3,1.4,5);
  mesh(scene,box,0x491427,gate.x+.6,1.8,gate.z,.3,3.6,3.8);
  mesh(scene,ball,0xff315f,gate.x+.39,2.65,gate.z,.28,.42,.42,true);
  const bloodLight=new T.PointLight(0xff2458,58,11);
  bloodLight.position.set(gate.x-1,2.6,gate.z);scene.add(bloodLight);
  for(let i=0;i<44;i++){
    const x=(i*137%810)-405, z=i%2 ? -15-(i%3) : 14+(i%4);
    const h=2.8+(i*7%5)*.7;
    mesh(scene,cylinder,0x514641,x/10,.55,z,.18,1.1,.18);
    mesh(scene,cone,i%2?0x202c41:0x29374a,x/10,h/2+.55,z,1.1,h,1.2);
  }
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
    const r=canvas.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(pickTargets,false)[0];
    if(hit) build(hit.object.parent.userData.i);
  };
  const towerColors=[0xa4b8d6,0xc069ea,0xe88696];
  function updateTower(g,t){
    const {disc,mark}=g.userData;
    const customModel = t?.kind===2 ? sniperModel : undefined;
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
          figure.rotation.y=Math.atan2(camera.position.x-g.position.x,camera.position.z-g.position.z)+Math.PI;
          g.add(figure);
          g.userData.figure=figure;
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
      if(target)g.rotation.y=Math.atan2(target.x-g.position.x,target.z-g.position.z);
    }
    const now=performance.now();
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
      if(!figure) continue;
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
      const b=new T.Line(new T.BufferGeometry().setFromPoints([pos(s.x,s.y,2),pos(s.a,s.b,1)]),
        new T.LineBasicMaterial({color:s.color,transparent:true,opacity:.85}));
      scene.add(b);beams.set(s,b);
    }
    renderer.render(scene,camera);
  };
}
