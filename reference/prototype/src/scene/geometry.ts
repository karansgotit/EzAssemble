import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Face, Part, Vec3 } from '../schema/parts';
export const NORMALS: Record<Face, Vec3> = { top: [0,1,0], bottom: [0,-1,0], left: [-1,0,0], right: [1,0,0], front: [0,0,1], back: [0,0,-1] };
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const scale = (v: Vec3, n: number): Vec3 => [v[0]*n,v[1]*n,v[2]*n];
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((v,i) => v+(b[i]-v)*t) as Vec3;
export const axisOf = (normal: Vec3): number => normal.findIndex(v => v !== 0);
export function axisRotation(normal: Vec3): Vec3 {
  const q = new Quaternion().setFromUnitVectors(new Vector3(0,1,0), new Vector3(...normal));
  const e = new Euler().setFromQuaternion(q); return [e.x,e.y,e.z];
}
export interface Rect { axis: number; plane: number; u: number; v: number; min: Vec3; max: Vec3 }
export function faceRect(part: Part, face: Face): Rect {
  const n = NORMALS[face], axis = axisOf(n), p = part.homeCm!, s = part.sizeCm!;
  const min = p.map((x,i) => x-s[i]/2) as Vec3, max = p.map((x,i) => x+s[i]/2) as Vec3;
  const [u,v] = [0,1,2].filter(i => i !== axis);
  return { axis, plane: p[axis]+n[axis]*s[axis]/2, u,v,min,max };
}
export function overlapRect(rect: Rect, part: Part): Rect {
  const min = [...rect.min] as Vec3, max = [...rect.max] as Vec3;
  for (const i of [rect.u,rect.v]) {
    min[i] = Math.max(min[i],part.homeCm![i]-part.sizeCm![i]/2);
    max[i] = Math.min(max[i],part.homeCm![i]+part.sizeCm![i]/2);
    if (max[i] < min[i]) throw new Error(`No joint overlap with ${part.id}`);
  }
  return { ...rect, min, max };
}
export function jointPositions(target: Part, face: Face, count: number, forPart?: Part, at = 'all'): Vec3[] {
  const rect = forPart ? overlapRect(faceRect(target,face),forPart) : faceRect(target,face);
  const long = rect.max[rect.u]-rect.min[rect.u] >= rect.max[rect.v]-rect.min[rect.v] ? rect.u : rect.v;
  return Array.from({length:count},(_,i) => {
    const p = lerp(rect.min,rect.max,.5); p[rect.axis] = rect.plane;
    const fraction = forPart ? (count === 1 ? .5 : .25+.5*i/(count-1)) :
      at === 'start' ? .15 : at === 'middle' ? .5 : at === 'end' ? .85 : count === 1 ? .5 : .15+.7*i/(count-1);
    p[long] = rect.min[long] + (rect.max[long]-rect.min[long])*fraction;
    return p;
  });
}
export interface Bounds { min: Vec3; max: Vec3 }
export function boundsOf(items: {position: Vec3; sizeCm: Vec3}[]): Bounds {
  if (!items.length) return { min:[0,0,0],max:[147,39,77] };
  return { min: [0,1,2].map(i=>Math.min(...items.map(p=>p.position[i]-p.sizeCm[i]/2))) as Vec3,
    max: [0,1,2].map(i=>Math.max(...items.map(p=>p.position[i]+p.sizeCm[i]/2))) as Vec3 };
}
export function uprightQuaternion(mode: 'stand-up' | 'turn-over' = 'stand-up'): Quaternion {
  if (mode === 'turn-over') return new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0,-1,0),new Vector3(0,0,1),new Vector3(-1,0,0)));
}
export function pivotPose(bounds: Bounds, quaternion: Quaternion): { position: Vec3; rotation: Vec3 } {
  const center = new Vector3(...lerp(bounds.min,bounds.max,.5));
  const rotated = center.clone().applyQuaternion(quaternion);
  let minY = Infinity;
  for (const x of [bounds.min[0],bounds.max[0]]) for (const y of [bounds.min[1],bounds.max[1]]) for (const z of [bounds.min[2],bounds.max[2]])
    minY = Math.min(minY,new Vector3(x,y,z).sub(center).applyQuaternion(quaternion).y);
  const e = new Euler().setFromQuaternion(quaternion);
  return { position: [center.x-rotated.x,-minY-rotated.y,center.z-rotated.z], rotation: [e.x,e.y,e.z] };
}
