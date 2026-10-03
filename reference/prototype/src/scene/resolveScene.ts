import type { Manual } from '../schema/manual';
import type { Action } from '../schema/step';
import { isHardware, type Vec3, type Part } from '../schema/parts';
import { HARDWARE_SCALE } from './constants';
import { add, axisRotation, jointPositions, NORMALS, scale, boundsOf, pivotPose, uprightQuaternion } from './geometry';
export interface Pose { position: Vec3; rotation: Vec3; spin?: number; opacity?: number }
export interface Instance extends Pose { instanceId: string; partId: string; sizeCm: Vec3; shape: Part['shape'] }
export interface ResolvedAction { action: Action; instanceIds: string[]; normal: Vec3 }
export interface SceneState { instances: Map<string, Instance>; stepActions: ResolvedAction[][]; assemblyPose: Pose }
export function resolveScene(manual: Manual, uptoStepIndexInclusive: number, hardwareScale = HARDWARE_SCALE): SceneState {
  const instances = new Map<string, Instance>(), stepActions: ResolvedAction[][] = [];
  const counts = new Map<string, number>(), inserted = new Map<string,string[]>();
  const parts = new Map(manual.parts.map(p=>[p.id,p]));
  let assemblyPose: Pose = {position:[0,0,0],rotation:[0,0,0]};
  const panel = (p: Part, id: string): Instance => ({instanceId:id,partId:p.id,position:[...p.homeCm!],rotation:[0,0,0],sizeCm:[...p.sizeCm!],shape:p.shape});
  for (const step of manual.steps.slice(0,uptoStepIndexInclusive+1)) {
    const resolved: ResolvedAction[] = [];
    for (const action of step.actions) {
      const normal = NORMALS[action.face ?? 'top'];
      if (action.verb === 'flip') {
        assemblyPose = pivotPose(boundsOf([...instances.values()].filter(i=>parts.get(i.partId)?.kind === 'panel')),uprightQuaternion(action.flipMode));
        resolved.push({action,instanceIds:['assembly'],normal}); continue;
      }
      const p = parts.get(action.part)!;
      if (action.target) {
        const target = parts.get(action.target)!;
        // The first receiving panel is the foundation, even if it has no place action.
        if (!isHardware(target) && !instances.has(`${target.id}#1`)) instances.set(`${target.id}#1`,panel(target,`${target.id}#1`));
      }
      if (action.verb === 'lock') {
        const ids = (inserted.get(p.id) ?? []).slice(-action.count);
        ids.forEach(id => { const i=instances.get(id)!; instances.set(id,{...i,spin:(i.spin ?? 0)+Math.PI/2}); });
        resolved.push({action,instanceIds:ids,normal}); continue;
      }
      const positions = isHardware(p) ? jointPositions(parts.get(action.target!)!,action.face!,action.count,action.for ? parts.get(action.for) : undefined,action.at) : [];
      const ids: string[] = [];
      for (let j=0;j<action.count;j++) {
        const n=(counts.get(p.id) ?? 0)+1; counts.set(p.id,n);
        const id=`${p.id}#${n}`; ids.push(id);
        if (!isHardware(p)) { instances.set(id,panel(p,id)); continue; }
        const length=p.hardwareMm!.length/10*hardwareScale, diameter=p.hardwareMm!.diameter/10*hardwareScale;
        const position=p.kind === 'screw' ? add(positions[j],scale(normal,-length/2)) : positions[j];
        instances.set(id,{instanceId:id,partId:p.id,position,rotation:axisRotation(normal),sizeCm:[diameter,length,diameter],shape:p.shape,spin:action.verb === 'screw' ? Math.PI*6 : 0});
      }
      if (action.verb === 'insert') inserted.set(p.id,[...(inserted.get(p.id) ?? []),...ids]);
      resolved.push({action,instanceIds:ids,normal});
    }
    stepActions.push(resolved);
  }
  return {instances,stepActions,assemblyPose};
}
