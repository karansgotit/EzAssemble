import { Manual } from '../schema/manual';
import type { Action, Verb } from '../schema/step';
export type Demo = Verb | 'trap';
export function galleryManual(demo: Demo): {manual:Manual;stepIndex:number} {
  const base={id:'base',label:'Test panel',kind:'panel',count:1,shape:'box',sizeCm:[40,3,30],homeCm:[20,1.5,15],features:[{type:'holes',face:'top'}]};
  const part={id:'panel',label:'Moving panel',kind:'panel',count:1,shape:'box',sizeCm:[3,24,30],homeCm:[1.5,15,15],features:[{type:'holes',face:'right'}]};
  const other={...part,id:'other',homeCm:[38.5,15,15]};
  const hardware={id:'hardware',label:demo==='screw'?'Test screw':'Test dowel',kind:demo==='screw'?'screw':'dowel',count:2,shape:'cylinder',hardwareMm:{length:30,diameter:8}};
  const insert:Action={verb:'insert',part:'hardware',count:2,target:'base',face:'top',at:'all'};
  const foundation:Action={verb:'place',part:'base',count:1};
  const moving:Action={verb:demo==='attach'?'attach':'place',part:'panel',count:1,target:'base',face:'top'};
  let previous:Action[]=[foundation],actions:Action[]=[insert];
  if(demo==='screw')actions=[{...insert,verb:'screw'}];
  if(demo==='place'||demo==='attach')actions=[moving];
  if(demo==='lock'){previous=[foundation,insert];actions=[{...insert,verb:'lock'}];}
  if(demo==='flip'){previous=[foundation,moving,{...moving,part:'other'}];actions=[{verb:'flip',part:'assembly',count:1,flipMode:'stand-up'}];}
  const step={stepNumber:2,instruction:`Watch the ${demo} motion in isolation.`,confidence:'high',actions,
    ...(demo==='trap'?{orientationTrap:{part:'base',feature:'holes',mustFace:'top',wrong:'flipped-vertical',hint:'Drilled holes face up'}}:{})};
  return {manual:Manual.parse({id:`gallery-${demo}`,title:'Motion laboratory',productSizeCm:[40,30,27],parts:[base,part,other,hardware],steps:[{stepNumber:1,instruction:'Prepare the test assembly.',confidence:'high',actions:previous},step]}),stepIndex:1};
}
