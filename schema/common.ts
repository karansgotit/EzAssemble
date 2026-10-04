import { z } from "zod";


export const Face = z.enum(["top", "bottom", "left", "right", "front", "back"]);
export type Face = z.infer<typeof Face>;


export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

export const ProductSizeCm = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);
export type ProductSizeCm = z.infer<typeof ProductSizeCm>;

export const Verb = z.enum(["insert", "attach", "screw", "lock", "place", "flip"]);
export type Verb = z.infer<typeof Verb>;


export const PartId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
export type PartId = z.infer<typeof PartId>;

export const PartKind = z.enum(["panel", "leg", "dowel", "screw", "cam", "camBolt", "nail", "other"]);
export type PartKind = z.infer<typeof PartKind>;
export const HARDWARE_KINDS: PartKind[] = ["dowel", "screw", "cam", "camBolt", "nail"];


export const BuildOrientation = z.enum(["upright", "on-back", "upside-down", "on-side"]);
export type BuildOrientation = z.infer<typeof BuildOrientation>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const WrongOrientation = z.enum(["flipped-vertical", "flipped-horizontal", "rotated-90"]);
export type WrongOrientation = z.infer<typeof WrongOrientation>;
