import { Quaternion, Vector3, Euler } from 'three';
import type { Part } from '../schema/parts';
import { faceRect, NORMALS } from './geometry';
export function FeatureMarker({part,opacity=1}: {part: Part; opacity?: number}) {
  return <>{part.features.map((feature,index)=>{
    const rect=faceRect({...part,homeCm:[0,0,0]},feature.face), normal=NORMALS[feature.face];
    const e=new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(...normal)));
    const long=rect.max[rect.u]-rect.min[rect.u]>rect.max[rect.v]-rect.min[rect.v] ? rect.u : rect.v;
    return <group key={index}>{Array.from({length:feature.type==='holes'?4:1},(_,i)=>{
      const p:[number,number,number]=[0,0,0];p[rect.axis]=rect.plane+normal[rect.axis]*.09;
      p[long]=feature.type==='holes' ? rect.min[long]+(rect.max[long]-rect.min[long])*(.18+i*.21) : 0;
      return <mesh key={i} position={p} rotation={[e.x,e.y,e.z]}>
        {feature.type==='holes' ? <circleGeometry args={[.7,16]}/> : <planeGeometry args={[(rect.max[rect.u]-rect.min[rect.u])*.85,.65]}/>}
        <meshBasicMaterial color={feature.type==='holes'?'#333':'#0058a3'} transparent opacity={opacity} depthWrite={false}/>
      </mesh>;
    })}</group>;
  })}</>;
}
