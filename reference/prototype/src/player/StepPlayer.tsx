import { useCallback, useEffect, useRef, useState } from 'react';
import type { Manual } from '../schema/manual';
import { AssemblyScene } from '../scene/AssemblyScene';
import type { SceneOptions } from '../scene/constants';
import { DiagramPanel } from './DiagramPanel';
import { PartsTray } from './PartsTray';
import { ConfidenceBanner } from './ConfidenceBanner';
import { StepNav } from './StepNav';
import { PlaybackBar } from './PlaybackBar';
import { InfoStep } from './InfoStep';
import { Icon } from './Icon';
const TITLES=['Start with a solid foundation.','The first piece of the puzzle.','Make room for your first shelf.','A small step. Two dowels.','Slide the next divider into place.','One shelf at a time.','Prepare the next connection.','Your next divider goes here.','The last shelf takes shape.','Two dowels. Nearly there.','Complete the final compartment.','Get ready to close the frame.','Bring it all together.','Make every corner secure.','A whole new perspective.','Give your shelf a safe home.','Mark it. Check it. Level it.','Choose the right wall fixings.','One final connection.'];
export function StepPlayer({manual,options}: {manual:Manual;options:SceneOptions}) {
  const [index,setIndex]=useState(0),[playKey,setPlayKey]=useState(0),[playing,setPlaying]=useState(true);
  const [speed,setSpeed]=useState(1),[progress,setProgress]=useState(0),[scrubT,setScrubT]=useState<number|null>(null);
  const [showTrap,setShowTrap]=useState(true),[resetKey,setResetKey]=useState(0);
  const seenTraps=useRef(new Set([0]));
  const step=manual.steps[index];
  const go=useCallback((next:number)=>{
    const n=Math.max(0,Math.min(manual.steps.length-1,next));
    setIndex(n);setPlayKey(k=>k+1);setProgress(0);setScrubT(null);setPlaying(true);
    setShowTrap(!!manual.steps[n].orientationTrap&&!seenTraps.current.has(n));seenTraps.current.add(n);
  },[manual]);
  const replay=useCallback((trap=false)=>{setShowTrap(trap);setScrubT(null);setProgress(0);setPlayKey(k=>k+1);setPlaying(true);},[]);
  const toggle=useCallback(()=>{if(progress>=1){replay();return;}setScrubT(null);setPlaying(p=>!p);},[progress,replay]);
  useEffect(()=>{
    const listener=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement).closest('input,select,textarea,[role="dialog"]')||document.querySelector('[role="dialog"]'))return;
      if(e.key==='ArrowRight'){e.preventDefault();go(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);}
      if(e.code==='Space'&&step.kind!=='info'&&!(e.target as HTMLElement).closest('button')){e.preventDefault();toggle();}if(e.key.toLowerCase()==='r'&&step.kind!=='info')replay();
    };window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
  },[go,index,replay,toggle,step.kind]);
  return <>
    <section className="product-heading"><div><div className="eyebrow blue">YOUR ASSEMBLY, MADE CLEAR</div><h1>{manual.title}<span>Shelving unit</span></h1><p>One step closer to making it yours.</p></div><div className="product-meta"><span>77 × 147 × 39 cm</span><span className="meta-divider"/><span>Vertical assembly</span><div className="step-counter"><strong>{String(index+1).padStart(2,'0')}</strong><span>/ {manual.steps.length} steps</span></div></div></section>
    <div className="phase-line"><span className={index<15?'phase active':'phase'}><span>01</span> Build the shelf</span><div/><span className={index>=15?'phase active':'phase'}><span>02</span> Make it secure</span><span className="phase-status">{index<15?'ASSEMBLY GUIDE':'WALL MOUNTING'}</span></div>
    {step.kind==='info'?<InfoStep step={step}/>:<section className="workspace"><aside className="reference-column"><DiagramPanel stepNumber={step.stepNumber}/><PartsTray manual={manual} step={step}/></aside><div className="scene-panel"><div className="panel-heading scene-heading"><span><Icon name="cube" size={16}/> THE STEP IN 3D</span><span className="live-label"><i/> INTERACTIVE</span></div>
      <AssemblyScene manual={manual} stepIndex={index} playKey={playKey} playing={playing} speed={speed} scrubT={scrubT} showTrap={showTrap} onProgress={setProgress} onDone={()=>setPlaying(false)} options={options} resetKey={resetKey}/>
      <div className="scene-legend"><span><i className="yellow-dot"/> This step</span><span><i className="white-dot"/> Already assembled</span></div>
      <div className="scene-bottom"><span>Drag to orbit · Scroll to zoom</span><button className="reset-view" onClick={()=>setResetKey(k=>k+1)}><Icon name="reset" size={14}/>Reset view</button></div>
    </div></section>}
    <section className="instruction-panel"><ConfidenceBanner step={step}/><div className="instruction-row"><div className="step-badge">{String(index+1).padStart(2,'0')}</div><div className="instruction-copy"><h2>{TITLES[index]}</h2><p>{step.instruction}</p></div>{step.orientationTrap&&<button className="trap-button" onClick={()=>replay(true)}><Icon name="alert" size={18}/><span>Show the<br/>common mistake</span><Icon name="play" size={12}/></button>}</div>
      {step.kind!=='info'&&<PlaybackBar playing={playing} progress={progress} speed={speed} onToggle={toggle} onReplay={()=>replay()} onSpeed={setSpeed} onScrub={n=>{setScrubT(n);setProgress(n);setPlaying(false);}}/>}
      <StepNav index={index} total={manual.steps.length} onChange={go}/>
    </section>
    <footer className="guide-footer"><span>A clearer way to put things together.</span><span><kbd>←</kbd><kbd>→</kbd> Steps <kbd>space</kbd> Play / pause <kbd>R</kbd> Replay</span></footer>
  </>;
}
