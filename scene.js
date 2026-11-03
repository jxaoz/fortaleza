import * as T from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

export function createScene(canvas, path, pads, build) {
  const renderer = new T.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new T.Scene();
  scene.background = new T.Color(0x111b31);
  scene.fog = new T.FogExp2(0x111b31, .013);
  const camera = new T.PerspectiveCamera(38, 900/430, .1, 250);
  camera.position.set(3, 66, 65);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xb8d8ff, 0x3c2036, 2.5));
  const moon = new T.DirectionalLight(0x97baff, 2);
  moon.position.set(-15, 32, -15);
  scene.add(moon);
  const pos = (x,y,h=0) => new T.Vector3((x-450)/13,h,(y-215)/13);
  const box = new T.BoxGeometry(1,1,1);
  const ball = new T.IcosahedronGeometry(1,0);
  const cone = new T.ConeGeometry(1,1,5);
  const cylinder = new T.CylinderGeometry(1,1,1,12);
  const materials = new Map();
  function mesh(parent, shape, color, x,y,z, w,h,d, glow=false) {
    const key = color + ':' + glow;
    if(!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
      color, flatShading:true, emissive:glow ? color : 0, emissiveIntensity:.85
    }));
    const m = new T.Mesh(shape,materials.get(key));
    m.position.set(x,y,z); m.scale.set(w,h,d); parent.add(m);
    return m;
  }
  mesh(scene,box,0x222c42,0,-.8,0,84,1.5,37);
  const road = path.map(([x,y])=>pos(x,y));
  for(let i=1;i<road.length;i++){
    const a=road[i-1], b=road[i];
    const roadbed=mesh(scene,box,0x555465,(a.x+b.x)/2,.035,(a.z+b.z)/2,a.distanceTo(b)+2.8,.23,3.1);
    roadbed.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
    if(i===5){
      for(const z of [a.z-1.7,a.z+1.7]) mesh(scene,box,0x343a50,(a.x+b.x)/2,.55,z,a.distanceTo(b)+2,.75,.25);
      for(let x=a.x;x<=b.x;x+=1.5)for(const z of [a.z-1.7,a.z+1.7])mesh(scene,box,0x5b6275,x,.94,z,.45,.5,.5);
    }
  }
  const gate=pos(...path.at(-1));
  for(const z of [gate.z-3.3,gate.z+3.3]){
    mesh(scene,box,0x374158,gate.x+1,3.5,z,3.6,7,3.2);
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
    mesh(scene,cone,i%2?0x202c41:0x29374a,x/10,h/2,z,1.1,h,1.2);
  }
  const spots=pads.map(([x,y],i)=>{
    const p=pos(x,y), g=new T.Group();
    scene.add(g);g.position.copy(p);
    const disc=mesh(g,cylinder,0x526582,0,.14,0,1.65,.35,1.65);
    const mark=mesh(g,cylinder,0xa2c9ff,0,.34,0,1.25,.08,1.25,true);
    g.userData={i,disc,mark,level:0};return g;
  });
  const pointer=new T.Vector2(), ray=new T.Raycaster();
  canvas.onclick=event=>{
    const r=canvas.getBoundingClientRect();
    pointer.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);
    ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(spots,true)[0];
    if(hit) build(hit.object.parent.userData.i);
  };
  const towerColors=[0xa4b8d6,0xc069ea,0xe88696];
  function updateTower(g,t){
    const {disc,mark}=g.userData;
    if(g.userData.level!==(t?.level??0)||g.userData.kind!==t?.kind){
      for(const part of g.children.slice(2))g.remove(part);
      g.userData.level=t?.level??0;g.userData.kind=t?.kind;
      if(t){
        const c=towerColors[t.kind], h=1.2+.3*t.level;
        mesh(g,cylinder,0x323c56,0,h/2,0,1,h,1);
        mesh(g,t.kind===0?ball:cylinder,c,0,h+.42,0,.66,.75,.66,t.kind===1);
        if(t.kind!==1)mesh(g,box,c,.54,h+.38,0,1.65,.26,.28);
      }
    }
    mark.visible=!t;
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
