import { z } from 'zod';
import { Face } from './parts';
export const Action = z.object({
  verb: z.enum(['insert', 'attach', 'screw', 'lock', 'place', 'flip']), part: z.string(),
  count: z.number().int().min(1), target: z.string().optional(), face: Face.optional(),
  for: z.string().optional(), at: z.enum(['start', 'middle', 'end', 'all']).optional(),
  flipMode: z.enum(['stand-up', 'turn-over']).optional(),
});
export type Action = z.infer<typeof Action>;
export type Verb = Action['verb'];
export const OrientationTrap = z.object({
  part: z.string(), feature: z.enum(['holes', 'finished-edge']), mustFace: Face,
  wrong: z.enum(['flipped-vertical', 'flipped-horizontal', 'rotated-90']), hint: z.string().max(80),
});
export type OrientationTrap = z.infer<typeof OrientationTrap>;
export const Step = z.object({
  stepNumber: z.number().int(), kind: z.enum(['assembly', 'info']).default('assembly'),
  instruction: z.string().min(10).max(220), actions: z.array(Action).max(4),
  orientationTrap: OrientationTrap.optional(), confidence: z.enum(['high', 'medium', 'low']), note: z.string().optional(),
});
export type Step = z.infer<typeof Step>;
