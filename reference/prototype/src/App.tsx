import { Component, useState, type ReactNode } from 'react';
import fixture from './fixtures/kallax.json';
import { Manual, checkManual } from './schema/manual';
import { StepPlayer } from './player/StepPlayer';
import { VerbGallery } from './dev/VerbGallery';
import { DevPanel } from './dev/DevPanel';
import { DEFAULT_OPTIONS } from './scene/constants';
import { Icon } from './player/Icon';
const parsed=Manual.safeParse(fixture);
const problems=parsed.success?checkManual(parsed.data):parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`);
function ErrorScreen({errors}: {errors:string[]}) {return <main className="error-screen"><Icon name="alert" size={36}/><h1>We couldn’t load this assembly.</h1><p>Please correct the manual data and try again.</p><ul>{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></main>;}
class RenderBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state:{error:string|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<ErrorScreen errors={[this.state.error]}/>:this.props.children;}
}
export default function App() {
  const [mode,setMode]=useState<'guide'|'gallery'>('guide'),[options,setOptions]=useState(DEFAULT_OPTIONS);
  if(!parsed.success||problems.length)return <ErrorScreen errors={problems}/>;
  return <RenderBoundary><div className="app-shell"><header className="app-header"><a className="brand" href="/" aria-label="Assembly Studio home"><span className="brand-mark"><Icon name="cube" size={23}/></span><span>assembly<span className="brand-light"> / studio</span><small>A LITTLE CLARITY GOES A LONG WAY.</small></span></a><div className="header-right"><span className="prototype-label"><i/> LOCAL PROTOTYPE</span><nav className="mode-switch" aria-label="App mode"><button className={mode==='guide'?'selected':''} aria-pressed={mode==='guide'} onClick={()=>setMode('guide')}>Guide</button><button className={mode==='gallery'?'selected':''} aria-pressed={mode==='gallery'} onClick={()=>setMode('gallery')}>Verb gallery</button></nav></div></header>
    <main>{mode==='guide'?<StepPlayer manual={parsed.data} options={options}/>:<VerbGallery options={options}/>}</main><div className="app-bottom"><span>Built from the KALLAX manual · Handwritten step data · No AI service connected</span><DevPanel options={options} onChange={setOptions}/></div></div></RenderBoundary>;
}
