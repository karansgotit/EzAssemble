import { describe,it,expect } from 'vitest';
import { Vector3,Euler } from 'three';
import fixture from '../src/fixtures/kallax.json';
import { Manual } from '../src/schema/manual';
import { resolveScene } from '../src/scene/resolveScene';
import { jointPositions, NORMALS } from '../src/scene/geometry';
import { galleryManual } from '../src/dev/galleryManual';
const manual=Manual.parse(fixture);
describe('deterministic assembly layout',()=>{
  it('places S1 at home and its dowels on the projected joint',()=>{const s=resolveScene(manual,2);expect(s.instances.get('S1#1')!.position).toEqual([38.25,19.5,38.5]);const a=s.instances.get('dowel#3')!.position,b=s.instances.get('dowel#4')!.position;expect(a[0]).toBeCloseTo(38.25);expect(a[2]).toBeCloseTo(3.8);expect(b[0]).toBeCloseTo(38.25);expect(a[1]).not.toBe(b[1]);});
  it('positions the first divider dowels on E1 right face',()=>{for(const id of ['dowel#1','dowel#2']){const p=resolveScene(manual,1).instances.get(id)!.position;expect(p[0]).toBeCloseTo(3.8);expect(p[2]).toBeCloseTo(38.5);}});
  it('has precisely 22 dowels, 8 screws, and 11 panels after step 14',()=>{const s=resolveScene(manual,13);expect([...s.instances.values()].filter(i=>i.partId==='dowel')).toHaveLength(22);expect([...s.instances.values()].filter(i=>i.partId==='screw')).toHaveLength(8);expect(s.instances.size).toBe(41);});
  it('rebuilds identical states when jumping backwards and forwards',()=>{const before=resolveScene(manual,2);resolveScene(manual,18);expect(resolveScene(manual,2)).toEqual(before);expect(resolveScene(manual,-1).instances.size).toBe(0);expect(before.instances.has('S2#1')).toBe(false);});
  it('locks reuse the latest inserted instances',()=>{const {manual:m}=galleryManual('lock');const s=resolveScene(m,1);expect([...s.instances.values()].filter(i=>i.partId==='hardware')).toHaveLength(2);expect(s.stepActions[1][0].instanceIds).toEqual(['hardware#1','hardware#2']);expect(s.instances.get('hardware#1')!.spin).toBeCloseTo(Math.PI/2);});
  it('maps E1 to the top, E2 to the floor and open front toward +z',()=>{const s=resolveScene(manual,14),e=new Euler(...s.assemblyPose.rotation);const map=(v:number[])=>new Vector3(...v).applyEuler(e).add(new Vector3(...s.assemblyPose.position));expect(map([1.9,19.5,38.5]).y).toBeCloseTo(145.1);expect(map([145.1,19.5,38.5]).y).toBeCloseTo(1.9);expect(new Vector3(0,1,0).applyEuler(e).z).toBeCloseTo(1);expect(resolveScene(manual,18).assemblyPose).toEqual(s.assemblyPose);});
  it('keeps screw heads flush and scales hardware without shifting the joint',()=>{for(const scale of [1,2.5,5]){const s=resolveScene(manual,1,scale),screw=s.instances.get('screw#1')!;expect(screw.position[0]-screw.sizeCm[1]/2).toBeCloseTo(0);expect(s.instances.get('dowel#1')!.position[0]).toBeCloseTo(3.8);}});
  it('orients cylinders along every face normal',()=>{for(const a of resolveScene(manual,13).stepActions.flat())for(const id of a.instanceIds){const i=resolveScene(manual,13).instances.get(id)!;if(i.shape==='cylinder'){const v=new Vector3(0,1,0).applyEuler(new Euler(...i.rotation));expect(v.distanceTo(new Vector3(...NORMALS[a.action.face!]))).toBeLessThan(.0001);}}});
  it('implements fallback face positions',()=>{const target=manual.parts.find(p=>p.id==='L1')!;expect(jointPositions(target,'front',1,undefined,'start')[0][0]).toBeCloseTo(3.8+139.4*.15);expect(jointPositions(target,'front',1,undefined,'middle')[0][0]).toBeCloseTo(73.5);});
});
