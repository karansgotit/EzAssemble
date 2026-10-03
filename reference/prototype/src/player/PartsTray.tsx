import type { Manual } from '../schema/manual';
import type { Step } from '../schema/step';
export function PartsTray({manual,step}: {manual:Manual;step:Step}) {
  const counts=new Map<string,number>();step.actions.filter(a=>a.part!=='assembly').forEach(a=>counts.set(a.part,(counts.get(a.part)??0)+a.count));
  return <div className="parts-tray"><div className="eyebrow">WHAT YOU’LL USE</div><div className="parts-list">{[...counts].map(([id,count])=>{
    const p=manual.parts.find(p=>p.id===id)!;
    return <div className="part-item" key={id}><div className={`part-icon ${p.kind}`}><svg viewBox="0 0 44 32" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {p.kind==='panel'?<path d="m6 11 23-6 9 13-24 8Zm0 0v3l8 15 24-8v-3M14 26v3"/>:p.kind==='dowel'?<><rect x="6" y="12" width="32" height="9" rx="4.5" transform="rotate(-25 22 16)"/><path d="m12 21 20-9m-19 12 21-9"/></>:<><path d="m8 25 24-16m-19 9 5 5m-1-8 5 5m-1-8 5 5m-1-8 5 5m1-14 9 13"/><path d="m28 5 4-3 9 13-4 3Z"/></>}
    </svg></div><div><strong>{p.label.split(' (')[0]}</strong><small>{p.ikeaNumber?`#${p.ikeaNumber}`:p.id}</small></div><span className="part-count">×{count}</span></div>;
  })}{!counts.size&&<p className="muted">One assembled shelf. And a helping hand.</p>}</div></div>;
}
