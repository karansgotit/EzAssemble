import { Icon } from './Icon';
export function StepNav({index,total,onChange}: {index:number;total:number;onChange:(index:number)=>void}) {
  return <nav className="step-navigation" aria-label="Assembly steps"><button className="button subtle" disabled={index===0} onClick={()=>onChange(index-1)}><Icon name="back" size={18}/> Previous</button>
    <div className="step-dots">{Array.from({length:total},(_,i)=><button key={i} className={`step-dot ${i===index?'active':i<index?'visited':''} ${i>=15?'info-dot':''}`} onClick={()=>onChange(i)} aria-label={`Go to step ${i+1}`} aria-current={i===index?'step':undefined} title={`Step ${i+1}${i>=15?' · Wall mounting':''}`}>{i<index?<Icon name="check" size={12}/>:i+1}</button>)}</div>
    <button className="button primary" disabled={index===total-1} onClick={()=>onChange(index+1)}>{index===total-1?'Complete':'Next step'}<Icon name="arrow" size={18}/></button></nav>;
}
