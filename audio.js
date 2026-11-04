export function setupAudio(button){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio){
    button.disabled=true;
    button.textContent='Música indisponível';
    return ()=>{};
  }

  let context, music, muted=false, nextBeat=0, beat=0;
  const melody=[76,0,79,78,76,0,71,0,72,76,75,0,71,0,0,0,
    74,0,77,76,74,0,69,0,71,74,75,0,76,0,0,0];
  const bass=[40,47,43,47,45,48,47,39,38,45,41,45,43,47,47,39];
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
      if(note)tone(music,nextBeat,hz(note),hz(note),.28,.12,'triangle');
      if(beat%2===0){
        const root=hz(bass[(beat/2)%bass.length]);
        tone(music,nextBeat,root,root,.21,.16,'triangle');
      }
      beat++;
      nextBeat+=.245;
    }
  }

  function activate(){
    if(!context){
      context=new Audio();
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
    button.textContent=muted?'Música: off':'Música: on';
    button.setAttribute('aria-pressed',String(!muted));
  };

  const effects=[
    [[720,140,.15,.045,'sawtooth']],
    [[280,520,.19,.065,'sine'],[630,310,.12,.022,'triangle']],
    [[190,60,.095,.09,'triangle'],[950,320,.06,.02,'square']],
    [[125,49,.3,.08,'triangle'],[260,105,.23,.03,'sine']]
  ];
  return kind=>{
    if(context?.state!=='running'||document.hidden)return;
    for(const sound of effects[kind]??[]){
      tone(context.destination,context.currentTime,...sound);
    }
  };
}
