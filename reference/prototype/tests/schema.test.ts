import { describe,it,expect } from 'vitest';
import fixture from '../src/fixtures/kallax.json';
import { Manual,checkManual } from '../src/schema/manual';
import { galleryManual } from '../src/dev/galleryManual';
const manual=Manual.parse(fixture);
describe('manual validation',()=>{
  it('accepts the real 19-step fixture with exact hardware totals',()=>{
    expect(checkManual(manual)).toEqual([]);expect(manual.steps).toHaveLength(19);
    for(const [id,count] of [['dowel',22],['screw',8]] as const)expect(manual.steps.flatMap(s=>s.actions).filter(a=>a.part===id).reduce((n,a)=>n+a.count,0)).toBe(count);
  });
  it('reports an unknown reference readably',()=>{const m=structuredClone(manual);m.steps[1].actions[0].for='typo';expect(checkManual(m).join(' ')).toContain('unknown for "typo"');});
  it('rejects 23 dowels',()=>{const m=structuredClone(manual);m.steps[1].actions[0].count=3;expect(checkManual(m).join(' ')).toContain('dowel: 23 instances used, but only 22 available');});
  it('rejects an empty assembly step',()=>{const m=structuredClone(manual);m.steps[0].actions=[];expect(checkManual(m).join(' ')).toContain('assembly step needs at least one action');});
  it('rejects hardware verbs on panels and panel verbs on hardware',()=>{const m=structuredClone(manual);m.steps[0].actions[0].part='E1';m.steps[0].actions[1].part='dowel';expect(checkManual(m).join(' ')).toContain('screw requires hardware');expect(checkManual(m).join(' ')).toContain('attach requires a panel');});
  it('checks all reference fields and trap membership',()=>{const m=structuredClone(manual);m.steps[0].actions[0].part='bad-part';m.steps[0].actions[0].target='bad-target';m.steps[0].orientationTrap!.part='bad-trap';const errors=checkManual(m).join(' ');expect(errors).toContain('unknown part');expect(errors).toContain('unknown target');expect(errors).toContain('unknown orientationTrap.part');expect(errors).toContain('must appear in the actions');});
  it('does not count locks as new hardware and validates every gallery',()=>{for(const demo of ['insert','screw','lock','attach','place','flip','trap'] as const)expect(checkManual(galleryManual(demo).manual)).toEqual([]);});
  it('rejects invalid schema fields before rendering',()=>{expect(Manual.safeParse({...fixture,productSizeCm:[77,147]}).success).toBe(false);});
});
