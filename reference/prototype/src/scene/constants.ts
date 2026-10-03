export const HARDWARE_SCALE = 2.5;
export const COLORS = { background: '#fbfaf7', current: '#ffd23f', previous: '#ffffff', edge: '#9b9b9b', blue: '#0058a3', dowel: '#d9b98a', screw: '#b8bec6' };
export const DURATIONS = { insert: .8, screw: 1.4, lock: .5, attach: 1.2, place: 1.2, flip: 2 };
export const GAP = .25, STAGGER = .15, HOLD = .4, TRAP_DURATION = 2.6;
export interface SceneOptions { hardwareScale: number; globalSpeed: number; axes: boolean; guides: boolean; features: boolean }
export const DEFAULT_OPTIONS: SceneOptions = { hardwareScale: HARDWARE_SCALE, globalSpeed: 1, axes: false, guides: true, features: true };
