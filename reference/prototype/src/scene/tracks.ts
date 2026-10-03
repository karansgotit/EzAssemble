import { Euler, Quaternion } from 'three';
import type { Step, Verb } from '../schema/step';
import type { Vec3 } from '../schema/parts';
import type { Pose, SceneState } from './resolveScene';
import { DURATIONS, GAP, STAGGER, HOLD, HARDWARE_SCALE } from './constants';
import { add, scale, axisOf, lerp, boundsOf, pivotPose, type Bounds } from './geometry';
export interface Track { instanceId: string; from: Pose; to: Pose; start: number; duration: number; kind: Verb; bounds?: Bounds }
export const ease = (t: number): number => t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
export function buildTracks(step: Step, posesBefore: SceneState, posesAfter: SceneState, hardwareScale = HARDWARE_SCALE): { tracks: Track[]; totalDuration: number } {
  const tracks: Track[] = []; let cursor=0;
  const actions = posesAfter.stepActions.at(-1) ?? [];
  for (const {action,instanceIds,normal} of actions) {
    const duration=DURATIONS[action.verb];
    instanceIds.forEach((id,i) => {
      const to: Pose = id === 'assembly' ? posesAfter.assemblyPose : posesAfter.instances.get(id)!;
      let from: Pose = {...to,position:[...to.position],rotation:[...to.rotation]};
      if (action.verb === 'flip') from=posesBefore.assemblyPose;
      else if (action.verb === 'lock') from=posesBefore.instances.get(id) ?? {...to,spin:(to.spin ?? 0)-Math.PI/2};
      else {
        const size=posesAfter.instances.get(id)!.sizeCm;
        const distance=['insert','screw'].includes(action.verb) ? 6*hardwareScale/2.5 : size[axisOf(normal)]*.35+10;
        from={...from,position:add(to.position,scale(normal,distance)),spin:action.verb === 'screw' ? (to.spin ?? 0)-6*Math.PI : to.spin};
      }
      tracks.push({instanceId:id,from,to,start:cursor+i*STAGGER,duration,kind:action.verb,
        bounds:action.verb === 'flip' ? boundsOf([...posesAfter.instances.values()].filter(p=>p.shape==='box')) : undefined});
    });
    cursor+=duration+Math.max(0,instanceIds.length-1)*STAGGER+GAP;
  }
  return {tracks,totalDuration:step.actions.length ? cursor-GAP+HOLD : HOLD};
}
export function sample(tracks: Track[], tSeconds: number): Map<string,Pose> {
  const result=new Map<string,Pose>();
  for (const track of tracks) {
    // A later action touching the same instance must not hide its earlier motion.
    if (tSeconds < track.start && result.has(track.instanceId)) continue;
    const raw=Math.max(0,Math.min(1,(tSeconds-track.start)/track.duration)), t=ease(raw);
    let position=lerp(track.from.position,track.to.position,t), rotation=lerp(track.from.rotation,track.to.rotation,t);
    if (track.kind === 'insert' && raw>.84 && raw<1) {
      const bump=Math.sin((raw-.84)/.16*Math.PI*2)*.055;
      position=position.map((v,i)=>v+(track.from.position[i]-track.to.position[i])*bump) as Vec3;
    }
    if (track.kind === 'flip' && track.bounds) {
      const q=new Quaternion().setFromEuler(new Euler(...track.from.rotation));
      q.slerp(new Quaternion().setFromEuler(new Euler(...track.to.rotation)),t);
      ({position,rotation}=pivotPose(track.bounds,q));
    }
    result.set(track.instanceId,{position,rotation,spin:(track.from.spin ?? 0)+((track.to.spin ?? 0)-(track.from.spin ?? 0))*t,opacity:tSeconds<track.start ? .4 : 1});
  }
  return result;
}
