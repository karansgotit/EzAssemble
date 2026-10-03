import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
export function DiagramPanel({stepNumber,large=false}: {stepNumber:number;large?:boolean}) {
  const [failed,setFailed]=useState(false),[open,setOpen]=useState(false);
  const closeButton=useRef<HTMLButtonElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const src=`/crops/step-${String(stepNumber).padStart(2,'0')}.png`;
  useEffect(()=>{setFailed(false);setOpen(false);},[stepNumber]);
  useEffect(()=>{
    if(!open)return;
    closeButton.current?.focus();
    const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}if(e.key==='Tab'){e.preventDefault();closeButton.current?.focus();}};
    document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[open]);
  const content=failed?<div className="diagram-placeholder"><span>{String(stepNumber).padStart(2,'0')}</span><p>Original manual diagram goes here</p><small>public/crops/step-{String(stepNumber).padStart(2,'0')}.png</small></div>:
    <img src={src} alt={`Original KALLAX manual, step ${stepNumber}`} onError={()=>setFailed(true)}/>;
  return <div className={`diagram-panel ${large?'large':''}`}>
    <div className="panel-heading"><span><Icon name="book" size={16}/> ORIGINAL MANUAL</span><small>AA-1055145-11</small></div>
    <button ref={trigger} className="diagram-image" onClick={()=>!failed&&setOpen(true)} aria-label={`Enlarge original diagram for step ${stepNumber}`} disabled={failed}>{content}{!failed&&<span className="expand-hint"><Icon name="expand" size={15}/></span>}</button>
    <div className="diagram-caption"><span>01 / REFERENCE</span><span>From the original IKEA guide</span></div>
    {open&&<div className="lightbox" role="dialog" aria-modal="true" aria-label="Enlarged manual diagram" onClick={()=>{setOpen(false);trigger.current?.focus();}}>
      <button ref={closeButton} className="lightbox-close" aria-label="Close enlarged diagram"><Icon name="close"/></button>
      <img src={src} alt={`Enlarged manual step ${stepNumber}`} onClick={e=>e.stopPropagation()}/>
    </div>}
  </div>;
}
