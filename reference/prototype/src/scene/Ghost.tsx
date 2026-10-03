import { Html } from '@react-three/drei';
import { Color, Euler, Quaternion } from 'three';
import type { Part } from '../schema/parts';
import type { OrientationTrap } from '../schema/step';
import type { Instance } from './resolveScene';
import { PartMesh } from './PartMesh';
import { ease } from './tracks';
export function Ghost({part,instance,trap,time}: {part:Part;instance:Instance;trap:OrientationTrap;time:number}) {
  if (time>=2.6) return null;
  const correcting=time>=1.2, t=ease(Math.max(0,Math.min(1,(time-1.2))));
  const wrong=trap.wrong==='flipped-horizontal' ? new Euler(0,Math.PI,0) : trap.wrong==='flipped-vertical' ? new Euler(Math.PI,0,0) : new Euler(0,0,Math.PI/2);
  const q=new Quaternion().setFromEuler(wrong).slerp(new Quaternion(),t), e=new Euler().setFromQuaternion(q);
  const color=new Color('#e5484d').lerp(new Color('#30a46c'),t).getStyle();
  const opacity=.45*(time>2.2?1-(time-2.2)/.4:1);
  const marked={...part,features:[{type:trap.feature,face:trap.mustFace}]};
  return <><PartMesh part={marked} instance={instance} pose={{...instance,rotation:[e.x,e.y,e.z],opacity}} current color={color} ghost/>
    <Html position={[instance.position[0],instance.position[1]+instance.sizeCm[1]/2+8,instance.position[2]]} center zIndexRange={[20,0]}>
      <div className={`trap-label ${correcting?'correct':'wrong'}`}>{correcting?'✓ '+trap.hint:'✕ Wrong way round'}</div>
    </Html></>;
}
