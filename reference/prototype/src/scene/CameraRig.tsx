import { useEffect, useRef, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Bounds } from './geometry';
export function CameraRig({bounds,frameKey,upright}: {bounds:Bounds;frameKey:string;upright:boolean}) {
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const {camera,size}=useThree();
  const transition=useRef<{elapsed:number;from:Vector3;to:Vector3;targetFrom:Vector3;target:Vector3}|null>(null);
  useEffect(()=>{
    const target=new Vector3(...bounds.min).add(new Vector3(...bounds.max)).multiplyScalar(.5);
    const diagonal=new Vector3(...bounds.max).sub(new Vector3(...bounds.min)).length();
    const vfov=30*Math.PI/180, hfov=2*Math.atan(Math.tan(vfov/2)*size.width/size.height);
    const distance=Math.max(45,diagonal/2/Math.sin(Math.min(vfov,hfov)/2)*1.4);
    const dir=new Vector3(...(upright?[-.65,.45,1.5]:[-.6,1,1.2])).normalize();
    transition.current={elapsed:0,from:camera.position.clone(),to:target.clone().addScaledVector(dir,distance),targetFrom:controls.current?.target.clone()??target.clone(),target};
  // Reframe only on requested resets, step/replay, flip completion, or resize.
  },[frameKey,upright,size.width,size.height]);
  useFrame((_,dt)=>{
    const t=transition.current;if(!t||!controls.current)return;
    t.elapsed+=dt;const f=1-Math.pow(1-Math.min(1,t.elapsed/.6),3);
    camera.position.lerpVectors(t.from,t.to,f);controls.current.target.lerpVectors(t.targetFrom,t.target,f);controls.current.update();
    if(f===1)transition.current=null;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping minDistance={25} maxDistance={1100} maxPolarAngle={Math.PI*.49} onStart={()=>{transition.current=null;}}/>;
}
