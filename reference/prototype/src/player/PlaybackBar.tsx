import { Icon } from './Icon';
interface Props {playing:boolean;progress:number;speed:number;onToggle:()=>void;onReplay:()=>void;onSpeed:(n:number)=>void;onScrub:(n:number)=>void}
export function PlaybackBar({playing,progress,speed,onToggle,onReplay,onSpeed,onScrub}:Props) {
  return <div className="playback"><div className="playback-actions"><button className="play-button" onClick={onToggle} aria-label={playing?'Pause animation':'Play animation'}><Icon name={playing?'pause':'play'} size={17}/></button><button className="text-button" onClick={onReplay}><Icon name="replay" size={16}/> Replay</button><span className="playback-divider"/><span className="eyebrow">ANIMATION</span></div>
    <input aria-label="Animation progress" type="range" min="0" max="1" step=".001" value={progress} onChange={e=>onScrub(Number(e.target.value))} style={{background:`linear-gradient(to right, #0058a3 ${progress*100}%, #dfdfd8 ${progress*100}%)`}}/>
    <span className="progress-percent">{Math.round(progress*100)}%</span><div className="speeds" aria-label="Playback speed">{[.5,1,2].map(n=><button key={n} aria-pressed={n===speed} className={n===speed?'selected':''} onClick={()=>onSpeed(n)}>{n}×</button>)}</div>
  </div>;
}
