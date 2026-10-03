import type { SceneOptions } from '../scene/constants';
import { Icon } from '../player/Icon';
export function DevPanel({options,onChange}: {options:SceneOptions;onChange:(options:SceneOptions)=>void}) {
  return <details className="dev-panel"><summary><Icon name="settings" size={15}/> Scene settings</summary><div className="dev-controls">
    <label>Hardware scale <output>{options.hardwareScale.toFixed(1)}×</output><input aria-label="Hardware scale" type="range" min="1" max="5" step=".1" value={options.hardwareScale} onChange={e=>onChange({...options,hardwareScale:Number(e.target.value)})}/></label>
    <label>Global speed <output>{options.globalSpeed.toFixed(1)}×</output><input aria-label="Global speed" type="range" min=".25" max="2" step=".25" value={options.globalSpeed} onChange={e=>onChange({...options,globalSpeed:Number(e.target.value)})}/></label>
    {(['axes','guides','features'] as const).map((key,i)=><label className="check-label" key={key}><input type="checkbox" checked={options[key]} onChange={e=>onChange({...options,[key]:e.target.checked})}/>{['Show axes','Motion guides','Feature markers'][i]}</label>)}
  </div></details>;
}
