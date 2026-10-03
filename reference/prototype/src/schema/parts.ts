import { z } from 'zod';
export const Face = z.enum(['top', 'bottom', 'left', 'right', 'front', 'back']);
export type Face = z.infer<typeof Face>;
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;
export const Part = z.object({
  id: z.string(), ikeaNumber: z.string().optional(), label: z.string(),
  kind: z.enum(['panel', 'dowel', 'screw', 'other']), count: z.number().int().min(1).max(64),
  shape: z.enum(['box', 'cylinder']), sizeCm: Vec3.optional(), homeCm: Vec3.optional(),
  hardwareMm: z.object({ length: z.number(), diameter: z.number() }).optional(),
  features: z.array(z.object({ type: z.enum(['holes', 'finished-edge']), face: Face })).default([]),
});
export type Part = z.infer<typeof Part>;
export const isHardware = (part: Part): boolean => part.kind === 'dowel' || part.kind === 'screw' || !!part.hardwareMm;
