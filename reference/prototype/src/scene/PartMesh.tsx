import { Edges } from '@react-three/drei';
import type { Part } from '../schema/parts';
import type { Instance, Pose } from './resolveScene';
import { COLORS } from './constants';
import { FeatureMarker } from './FeatureMarker';
export function PartMesh({instance,part,pose,current,features=true,color,ghost=false}: {
  instance: Instance; part: Part; pose: Pose; current: boolean; features?: boolean; color?: string; ghost?: boolean;
}) {
  const opacity=pose.opacity ?? 1;
  const fill=color ?? (part.kind==='dowel'?COLORS.dowel:part.kind==='screw'?COLORS.screw:current?COLORS.current:COLORS.previous);
  const edge=color ?? (current || part.kind!=='panel' ? '#111111' : COLORS.edge);
  return <group position={pose.position} rotation={pose.rotation}><group rotation={[0,pose.spin ?? 0,0]}>
    <mesh castShadow receiveShadow>
      {instance.shape==='box' ? <boxGeometry args={instance.sizeCm}/> : <cylinderGeometry args={[instance.sizeCm[0]/2,instance.sizeCm[0]/2,instance.sizeCm[1],16]}/>}
      <meshStandardMaterial color={fill} roughness={part.kind==='screw'?.4:.82} metalness={part.kind==='screw'?.5:0} transparent={opacity<1} opacity={opacity} depthWrite={!ghost && opacity>.8}/>
      <Edges color={edge} lineWidth={current?1.7:1} transparent opacity={opacity}/>
    </mesh>
    {part.kind==='screw' && <group position={[0,instance.sizeCm[1]/2,0]}>
      <mesh><cylinderGeometry args={[instance.sizeCm[0]*.9,instance.sizeCm[0]*.9,.8,16]}/><meshStandardMaterial color={fill} transparent opacity={opacity}/><Edges color="#333"/></mesh>
      <mesh position={[0,.43,0]}><boxGeometry args={[instance.sizeCm[0]*1.25,.1,.35]}/><meshBasicMaterial color="#333" transparent opacity={opacity}/></mesh>
    </group>}
    {features && part.kind==='panel' && <FeatureMarker part={part} opacity={opacity}/>}
  </group></group>;
}
