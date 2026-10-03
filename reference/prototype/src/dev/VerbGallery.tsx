import { useMemo, useState } from 'react';
import type { SceneOptions } from '../scene/constants';
import { AssemblyScene } from '../scene/AssemblyScene';
import { PlaybackBar } from '../player/PlaybackBar';
import { Icon } from '../player/Icon';
import { galleryManual, type Demo } from './galleryManual';
const descriptions:Record<Demo,string>={insert:'A short approach, a gentle tap, a solid connection.',screw:'Three full turns. One flush finish.',lock:'A quarter turn locks the connection in place.',attach:'Bring the panel in along the receiving face.',place:'A smooth approach from the right direction.',flip:'Rotate the assembly about its centre, then settle it on the floor.',trap:'Spot the wrong orientation before it becomes a problem.'};
export function VerbGallery({options}: {options:SceneOptions}) {
  const [demo,setDemo]=useState<Demo>('insert'),[playKey,setPlayKey]=useState(0),[playing,setPlaying]=useState(true),[progress,setProgress]=useState(0),[speed,setSpeed]=useState(1),[scrubT,setScrubT]=useState<number|null>(null);
  const {manual,stepIndex}=useMemo(()=>galleryManual(demo),[demo]);
  const replay=()=>{setPlayKey(k=>k+1);setPlaying(true);setProgress(0);setScrubT(null);};
  return <><section className="product-heading"><div><div className="eyebrow blue">SMALL MOTIONS. CLEAR INSTRUCTIONS.</div><h1>The motion library<span>Verb gallery</span></h1><p>Every assembly action, broken down to its simplest move.</p></div><span className="tag">7 INTERACTIVE DEMOS</span></section>
    <div className="gallery-tabs">{(['insert','screw','lock','attach','place','flip','trap'] as Demo[]).map(verb=><button className={demo===verb?'selected':''} key={verb} onClick={()=>{setDemo(verb);replay();}}>{verb==='trap'?'Trap ghost':verb==='flip'?'Flip · stand up':verb}</button>)}</div>
    <section className="gallery-scene scene-panel"><div className="panel-heading scene-heading"><span><Icon name="cube" size={16}/> MOTION PREVIEW</span><span>SHARED ANIMATION ENGINE</span></div><AssemblyScene key={demo} manual={manual} stepIndex={stepIndex} playKey={playKey} playing={playing} speed={speed} scrubT={scrubT} showTrap={demo==='trap'} onProgress={setProgress} onDone={()=>setPlaying(false)} options={options}/></section>
    <section className="gallery-caption"><h2>{descriptions[demo]}</h2><PlaybackBar playing={playing} progress={progress} speed={speed} onReplay={replay} onToggle={()=>{if(progress>=1)replay();else {setScrubT(null);setPlaying(p=>!p);}}} onSpeed={setSpeed} onScrub={n=>{setScrubT(n);setProgress(n);setPlaying(false);}}/></section>
  </>;
}
