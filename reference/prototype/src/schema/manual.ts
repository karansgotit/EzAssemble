import { z } from 'zod';
import { Part, Vec3, isHardware } from './parts';
import { Step } from './step';
export const Manual = z.object({ id: z.string(), title: z.string(), productSizeCm: Vec3, parts: z.array(Part), steps: z.array(Step) });
export type Manual = z.infer<typeof Manual>;
export function checkManual(manual: Manual): string[] {
  const errors: string[] = [];
  const parts = new Map(manual.parts.map(p => [p.id, p]));
  const used = new Map<string, number>();
  const inserted = new Map<string, number>();
  if (parts.size !== manual.parts.length) errors.push('Part ids must be unique.');
  for (const p of manual.parts) {
    if (p.kind === 'panel' && (!p.homeCm || !p.sizeCm)) errors.push(`${p.id}: panels need homeCm and sizeCm.`);
    if (isHardware(p) && !p.hardwareMm) errors.push(`${p.id}: hardware needs hardwareMm.`);
  }
  for (const step of manual.steps) {
    const prefix = `Step ${step.stepNumber}`;
    if (step.kind === 'assembly' && !step.actions.length) errors.push(`${prefix}: assembly step needs at least one action.`);
    for (const a of step.actions) {
      for (const [field, id] of [['part', a.part], ['target', a.target], ['for', a.for]]) {
        if (id && !(field === 'part' && a.verb === 'flip' && id === 'assembly') && !parts.has(id)) errors.push(`${prefix}: unknown ${field} "${id}".`);
      }
      if (a.verb === 'flip') continue;
      const p = parts.get(a.part);
      if (!p) continue;
      if (['insert', 'screw', 'lock'].includes(a.verb) && !isHardware(p)) errors.push(`${prefix}: ${a.verb} requires hardware, got ${p.id}.`);
      if (['attach', 'place'].includes(a.verb) && isHardware(p)) errors.push(`${prefix}: ${a.verb} requires a panel, got ${p.id}.`);
      if (a.verb === 'lock') {
        if ((inserted.get(p.id) ?? 0) < a.count) errors.push(`${prefix}: cannot lock ${a.count} ${p.id}; insert them first.`);
      } else used.set(p.id, (used.get(p.id) ?? 0) + a.count);
      if (a.verb === 'insert') inserted.set(p.id, (inserted.get(p.id) ?? 0) + a.count);
      if (isHardware(p) && (!a.target || !a.face)) errors.push(`${prefix}: hardware needs a target and face.`);
    }
    if (step.orientationTrap) {
      const id = step.orientationTrap.part;
      if (!parts.has(id)) errors.push(`${prefix}: unknown orientationTrap.part "${id}".`);
      if (!step.actions.some(a => a.part === id || a.target === id)) errors.push(`${prefix}: orientation trap ${id} must appear in the actions.`);
    }
  }
  for (const [id, n] of used) if (n > parts.get(id)!.count) errors.push(`${id}: ${n} instances used, but only ${parts.get(id)!.count} available.`);
  return errors;
}
