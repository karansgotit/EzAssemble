import { describe,it,expect } from 'vitest';
import { Euler,Vector3 } from 'three';
import fixture from '../src/fixtures/kallax.json';
import { Manual } from '../src/schema/manual';
import { resolveScene } from '../src/scene/resolveScene';
import { buildTracks,sample } from '../src/scene/tracks';
import { galleryManual } from '../src/dev/galleryManual';
const manual=Manual.parse(fixture);
const build=(index:number,m=manual)=>buildTracks(m.steps[index],resolveScene(m,index-1),resolveScene(m,index));
describe('animation tracks',()=>{
  it('samples the exact from and to poses, with an intermediate midpoint',()=>{const {tracks,totalDuration}=build(2),track=tracks[0];expect(sample(tracks,0).get(track.instanceId)!.position).toEqual(track.from.position);expect(sample(tracks,totalDuration).get(track.instanceId)!.position).toEqual(track.to.position);const z=sample(tracks,track.duration/2).get(track.instanceId)!.position[2];expect(z).toBeGreaterThan(track.to.position[2]);expect(z).toBeLessThan(track.from.position[2]);});
  it('makes three full screw turns about its own insertion axis',()=>{const {tracks,totalDuration}=build(0),track=tracks[0];expect(sample(tracks,0).get(track.instanceId)!.spin).toBe(0);expect(sample(tracks,totalDuration).get(track.instanceId)!.spin).toBeCloseTo(6*Math.PI);});
  it('staggers instances by .15 and starts the next action after a .25 gap',()=>{const {tracks}=build(2);expect(tracks[1].start-tracks[0].start).toBeCloseTo(.15);expect(tracks[2].start-tracks[1].start-tracks[1].duration).toBeCloseTo(.25);expect(sample(tracks,0).get(tracks[2].instanceId)!.opacity).toBe(.4);});
  it('moves panels out from the target face',()=>{const {tracks}=build(4),t=tracks[0];expect(t.from.position[0]).toBeGreaterThan(t.to.position[0]);expect(t.from.position[1]).toBe(t.to.position[1]);});
  it('locks a quarter turn without translation',()=>{const {manual:m,stepIndex}=galleryManual('lock');const {tracks,totalDuration}=build(stepIndex,m);const t=tracks[0];expect(t.from.position).toEqual(t.to.position);expect(sample(tracks,totalDuration).get(t.instanceId)!.spin).toBeCloseTo(Math.PI/2);});
  it('keeps every corner above the floor throughout the stand-up motion',()=>{const {tracks}=build(14);for(const time of [0,.5,1,1.5,2]){const p=sample(tracks,time).get('assembly')!;const ys:number[]=[];for(const x of [0,147])for(const y of [0,39])for(const z of [0,77])ys.push(new Vector3(x,y,z).applyEuler(new Euler(...p.rotation)).add(new Vector3(...p.position)).y);expect(Math.min(...ys)).toBeCloseTo(0);}});
  it('returns identical samples regardless of playback history',()=>{const {tracks}=build(11);const first=sample(tracks,1);sample(tracks,4);expect(sample(tracks,1)).toEqual(first);});
});
