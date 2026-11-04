export function setupAudio(button,effectsButton,phase){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio){
    button.disabled=true;
    effectsButton.disabled=true;
    return ()=>{};
  }

  let context, music, muted=false, effectsMuted=false, nextBeat=0, beat=0;
  const tracks=[
    {step:.19, melody:[76,79,83,0,82,79,76,0,74,77,81,0,79,77,74,0,
      72,76,79,84,83,0,79,76,75,78,81,0,80,78,75,0,
      76,0,71,74,79,78,76,0,72,74,76,79,78,75,71,0],
      bass:[40,47,43,47,38,45,41,45,36,43,40,43,39,46,42,47,40,43,47,43,36,43,39,47]},
    {step:.32, melody:[64,0,0,63,59,0,0,0,60,0,0,58,55,0,0,0,
      57,0,60,0,59,0,56,0,57,0,53,0,51,0,0,0],
      bass:[36,36,35,35,31,31,34,34,33,33,32,32,29,29,35,35]},
    {step:.28, melody:[64,0,0,67,66,0,63,0,60,0,0,64,63,0,59,0,
      57,0,60,64,63,0,59,0,55,0,58,61,63,0,59,0],
      bass:[40,36,33,35]}
  ];
  const {step,melody,bass}=tracks[phase-1];
  const hz=note=>440*2**((note-69)/12);

  function tone(bus,time,from,to,duration,volume,type){
    const voice=context.createOscillator();
    const envelope=context.createGain();
    voice.type=type;
    voice.frequency.setValueAtTime(from,time);
    voice.frequency.exponentialRampToValueAtTime(to,time+duration);
    envelope.gain.setValueAtTime(.0001,time);
    envelope.gain.exponentialRampToValueAtTime(volume,time+.008);
    envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
    voice.connect(envelope).connect(bus);
    voice.start(time);
    voice.stop(time+duration);
  }

  function schedule(){
    if(context.state!=='running'||document.hidden)return;
    nextBeat=Math.max(nextBeat,context.currentTime+.02);
    while(nextBeat<context.currentTime+.16){
      const note=melody[beat%melody.length];
      if(note){
        const pitch=hz(note);
        tone(music,nextBeat,pitch,pitch,phase===1?.17:step*1.8,.12,'triangle');
        if(phase===3)tone(music,nextBeat,pitch*2,pitch*2,step*1.8,.035,'sine');
      }
      if(phase===3&&beat%8===0){
        const chord=[0,beat%32===24?4:3,7,12];
        const root=bass[(beat/8)%bass.length];
        for(const interval of chord){
          const pitch=hz(root+interval);
          tone(music,nextBeat,pitch,pitch,step*7.8,.05,'triangle');
          tone(music,nextBeat,pitch*2,pitch*2,step*7.8,.025,'sine');
        }
      }else if(phase!==3&&beat%2===0){
        const root=hz(bass[(beat/2)%bass.length]);
        tone(music,nextBeat,root,root,phase===1?.17:.58,.16,'triangle');
      }
      beat++;
      nextBeat+=step;
    }
  }

  let arrowAir;
  function arrowWhoosh(){
    const time=context.currentTime;
    const source=context.createBufferSource();
    const filter=context.createBiquadFilter();
    const gain=context.createGain();
    source.buffer=arrowAir;
    filter.type='bandpass';
    filter.frequency.setValueAtTime(2100,time);
    filter.frequency.exponentialRampToValueAtTime(500,time+.11);
    gain.gain.setValueAtTime(.07,time);
    gain.gain.exponentialRampToValueAtTime(.0001,time+.12);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(time);
  }
  function activate(){
    if(!context){
      context=new Audio();
      arrowAir=context.createBuffer(1,Math.ceil(context.sampleRate*.12),context.sampleRate);
      const samples=arrowAir.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      music=context.createGain();
      music.gain.value=muted?0:.45;
      music.connect(context.destination);
      setInterval(schedule,90);
    }
    if(context.state!=='running')context.resume().catch(()=>{});
  }
  document.addEventListener('click',activate,{capture:true,once:true});
  window.addEventListener('keydown',activate,{once:true});
  button.onclick=()=>{
    activate();
    muted=!muted;
    music.gain.setTargetAtTime(muted?0:.45,context.currentTime,.025);
    button.setAttribute('aria-pressed',String(!muted));
  };

  effectsButton.onclick=()=>{
    activate();
    effectsMuted=!effectsMuted;
    effectsButton.setAttribute('aria-pressed',String(!effectsMuted));
  };

  const effects=[
    [[720,140,.15,.045,'sawtooth']],
    [[280,520,.19,.065,'sine'],[630,310,.12,.022,'triangle']],
    [[235,92,.11,.09,'triangle']],
    [[125,49,.3,.08,'triangle'],[260,105,.23,.03,'sine']]
  ];
  return kind=>{
    if(effectsMuted||context?.state!=='running'||document.hidden)return;
    if(kind===2)arrowWhoosh();
    for(const sound of effects[kind]??[]){
      tone(context.destination,context.currentTime,...sound);
    }
  };
}
