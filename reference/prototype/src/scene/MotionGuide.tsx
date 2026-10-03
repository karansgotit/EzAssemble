import { Line } from '@react-three/drei';
import { Quaternion, Vector3, Euler } from 'three';
import type { Track } from './tracks';
import { lerp } from './geometry';
export function MotionGuide({track,time}: {track: Track; time: number}) {
  if (track.kind==='flip'||track.kind==='lock'||time<track.start||time>track.start+track.duration+.25) return null;
  const direction=new Vector3(...track.to.position).sub(new Vector3(...track.from.position));
  if (direction.length()<.01) return null;
  const e=new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.normalize()));
  const opacity=Math.max(0,1-Math.max(0,time-track.start-track.duration)/.25);
  return <group><Line points={[track.from.position,track.to.position]} color="#0058a3" lineWidth={1.7} dashed dashSize={1.5} gapSize={1} transparent opacity={opacity}/>
    <mesh position={lerp(track.from.position,track.to.position,.8)} rotation={[e.x,e.y,e.z]}><coneGeometry args={[1.3,3,12]}/><meshBasicMaterial color="#0058a3" transparent opacity={opacity}/></mesh>
  </group>;
}
