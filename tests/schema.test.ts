import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as S from "@/schema";
import { layout, saved, scene, steps } from "./helpers/schemaFixtures";

const image = "/9j/";
const partsRequest = { title: "KALLAX", productSizeCm: [77, 147, 39], partsPages: [image], cover: image, stepThumbs: [image] };
const examples: Record<string, { schema: z.ZodType; valid: unknown; invalid: unknown }> = {
  Face: { schema: S.Face, valid: "top", invalid: "north" },
  Vec3: { schema: S.Vec3, valid: [1, 2, 3], invalid: [1, 2] },
  ProductSizeCm: { schema: S.ProductSizeCm, valid: [77, 147, 39], invalid: [0, 147, 39] },
  Verb: { schema: S.Verb, valid: "attach", invalid: "hammer" },
  PartId: { schema: S.PartId, valid: "shelf_1", invalid: "bad id" },
  PartKind: { schema: S.PartKind, valid: "camBolt", invalid: "bolt" },
  BuildOrientation: { schema: S.BuildOrientation, valid: "on-back", invalid: "diagonal" },
  Confidence: { schema: S.Confidence, valid: "high", invalid: "certain" },
  WrongOrientation: { schema: S.WrongOrientation, valid: "rotated-90", invalid: "rotated-45" },
  StepBox: { schema: S.StepBox, valid: [0, 0, 1000, 1000], invalid: [-1, 0, 1000, 1000] },
  PageIndex: { schema: S.PageIndex, valid: { pageType: "steps", steps: [{ stepNumber: 1, box: [0, 0, 1000, 1000] }] }, invalid: { pageType: "steps", steps: [{ stepNumber: 1, box: [0, 0, 1001, 1000] }] } },
  AiPart: { schema: S.AiPart, valid: layout.parts[0], invalid: { ...layout.parts[0], count: 0 } },
  PartsLayout: { schema: S.PartsLayout, valid: layout, invalid: { ...layout, parts: [] } },
  Action: { schema: S.Action, valid: steps[0].actions[0], invalid: { ...steps[0].actions[0], verb: "hammer" } },
  ManualTrap: { schema: S.ManualTrap, valid: steps[0].orientationTrap, invalid: { ...steps[0].orientationTrap, source: "geometry" } },
  Step: { schema: S.Step, valid: steps[0], invalid: { ...steps[0], kind: "subassembly" } },
  SavedStep: { schema: S.SavedStep, valid: saved.steps[0], invalid: { status: "failed", stepNumber: 1 } },
  SavedManual: { schema: S.SavedManual, valid: saved, invalid: { ...saved, schemaVersion: 2 } },
  LibraryIndex: { schema: S.LibraryIndex, valid: [{ id: "kallax", title: "KALLAX", stepCount: 19, thumbnail: "crops/step-01.jpg", createdAt: saved.createdAt }], invalid: [{ id: "kallax" }] },
  ScenePart: { schema: S.ScenePart, valid: scene.parts[0], invalid: { ...scene.parts[0], shape: "sphere" } },
  SceneTrap: { schema: S.SceneTrap, valid: scene.steps[0].trap, invalid: { ...scene.steps[0].trap, autoplay: "yes" } },
  SceneStep: { schema: S.SceneStep, valid: scene.steps[0], invalid: { ...scene.steps[0], kind: "unknown" } },
  SceneManual: { schema: S.SceneManual, valid: scene, invalid: { ...scene, buildSizeCm: [147, 39] } },
  IndexPageRequest: { schema: S.IndexPageRequest, valid: { image, pageNumber: 1 }, invalid: { image, pageNumber: 0 } },
  PartsRequest: { schema: S.PartsRequest, valid: partsRequest, invalid: { ...partsRequest, productSizeCm: [-1, 147, 39] } },
  AnalyzeStepRequest: { schema: S.AnalyzeStepRequest, valid: { image, stepNumber: 1, parts: layout.parts, placedPartIds: [], previousInstructions: [] }, invalid: { image, stepNumber: 1.5, parts: [], placedPartIds: [], previousInstructions: [] } },
  SaveManualRequest: { schema: S.SaveManualRequest, valid: { manual: saved, crops: [{ name: "step-01.jpg", base64: image }] }, invalid: { manual: saved, crops: [{ name: "step-01.jpg" }] } },
  AskRequest: { schema: S.AskRequest, valid: { question: "Which panel?", step: steps[0], image }, invalid: { question: "", step: steps[0], image } },
};

describe("every public data schema", () => {
  it.each(Object.entries(examples))("%s accepts valid data", (_, { schema, valid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it.each(Object.entries(examples))("%s rejects invalid data", (_, { schema, invalid }) => {
    expect(schema.safeParse(invalid).success).toBe(false);
  });
  it("keeps this table complete as public schemas are added", () => {
    const names = Object.entries(S).filter(([, value]) => value instanceof z.ZodType).map(([key]) => key).sort();
    expect(Object.keys(examples).sort()).toEqual(names);
  });
});

describe("contract edge cases", () => {
  it.each([[900, 0, 100, 1000], [0, 900, 1000, 100], [0, 0, 0, 1000], [0, 0, 1001, 1000]])("rejects unordered, empty or out-of-range boxes %j", (...box) => {
    expect(S.StepBox.safeParse(box).success).toBe(false);
  });
  it.each(["cover", "warning", "tools", "parts", "other"])("requires empty steps on %s pages", pageType => {
    expect(S.PageIndex.safeParse({ pageType, steps: [] }).success).toBe(true);
    expect(S.PageIndex.safeParse({ pageType, steps: [{ stepNumber: 1, box: [0, 0, 1000, 1000] }] }).success).toBe(false);
  });
  it.each([
    saved.steps[0],
    { status: "failed", stepNumber: 1, crop: "crops/step-01.jpg", errors: ["Unreadable"], attempts: 3 },
    { status: "subassembly", stepNumber: 20, sourceSteps: [20, 21], label: "drawer", message: "Assemble separately." },
  ])("accepts SavedStep status $status", value => expect(S.SavedStep.safeParse(value).success).toBe(true));
  it("rejects multiple solids sharing one position in AI and scene data", () => {
    expect(S.AiPart.safeParse({ ...layout.parts[0], kind: "other", count: 2 }).success).toBe(false);
    expect(S.ScenePart.safeParse({ ...scene.parts[0], kind: "leg", count: 4 }).success).toBe(false);
    expect(S.AiPart.safeParse(layout.parts.find(part => part.id === "dowel")).success).toBe(true);
  });
  it("defaults omitted AI features and still generates JSON schemas for model calls", () => {
    const { features: _, ...part } = layout.parts[0];
    expect(S.AiPart.parse(part).features).toEqual([]);
    for (const schema of [S.PageIndex, S.PartsLayout, S.Step]) expect(() => z.toJSONSchema(schema)).not.toThrow();
  });
  it("exports data types, not just runtime validators", () => {
    expectTypeOf<S.PartId>().toEqualTypeOf<string>();
    expectTypeOf<S.StepBox>().toEqualTypeOf<[number, number, number, number]>();
    expectTypeOf<S.PageIndex>().toEqualTypeOf<z.infer<typeof S.PageIndex>>();
    expectTypeOf<S.ScenePart>().toEqualTypeOf<z.infer<typeof S.ScenePart>>();
    expectTypeOf<S.SceneStep>().toEqualTypeOf<z.infer<typeof S.SceneStep>>();
    expectTypeOf<S.SceneTrap>().toEqualTypeOf<z.infer<typeof S.SceneTrap>>();
    expectTypeOf<S.ManualTrap>().toEqualTypeOf<z.infer<typeof S.ManualTrap>>();
    expectTypeOf<S.LibraryIndex>().toEqualTypeOf<z.infer<typeof S.LibraryIndex>>();
    expectTypeOf<S.Confidence>().toEqualTypeOf<"high" | "medium" | "low">();
    expectTypeOf<S.WrongOrientation>().toEqualTypeOf<z.infer<typeof S.WrongOrientation>>();
    expectTypeOf<S.IndexPageRequest>().toEqualTypeOf<z.infer<typeof S.IndexPageRequest>>();
    expectTypeOf<S.PartsRequest>().toEqualTypeOf<z.infer<typeof S.PartsRequest>>();
    expectTypeOf<S.AnalyzeStepRequest>().toEqualTypeOf<z.infer<typeof S.AnalyzeStepRequest>>();
    expectTypeOf<S.SaveManualRequest>().toEqualTypeOf<z.infer<typeof S.SaveManualRequest>>();
    expectTypeOf<S.AskRequest>().toEqualTypeOf<z.infer<typeof S.AskRequest>>();
  });
});
