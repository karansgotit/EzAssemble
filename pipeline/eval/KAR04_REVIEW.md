# KAR-04 independent review

Evaluation date: 2026-10-04. Repository base: `df13841`, branch `karan/KAR-04-analyze-step-spike`, with the author's uncommitted KAR-04 changes preserved.

## Hackathon decision

**Stop tuning and integrate the layout-aware Flash LOW candidate, with original-diagram fallback. Do not switch everything to Pro.** This is the best tested starting point, not proof of a universally best model or production-ready extraction.

| Same 19 crops, gold context | Six-field agreement | Exact steps | Median seconds |
|---|---:|---:|---:|
| Original prompt, Flash LOW | 74.4% | 12/19 | 10.3 |
| Original prompt, Pro LOW | 64.7% | 11/19 | 8.4 |
| Layout-aware candidate, Flash LOW | 84.0% | 14/19 | 7.6 |
| Layout-aware candidate, Pro LOW | 67.9% | 12/19 | 7.4 |

The candidate Flash result reaches 98.9% field agreement on the subset excluding disputed fixture steps 1/12/14/15, but that is a sensitivity check, not a claim of 99% real-world reliability. It still misses the step-13 orientation warning details. Pro MEDIUM with temperature 1 was tested twice on ten varied crops: 15/20 valid completions, median 32.2 seconds, five request/deadline failures. Previous-image context and a step-3 example did not establish a better default. Later Pro trials encountered HTTP 429s; these are availability failures, not evidence of incorrect reasoning.

**Immediate priorities for the remaining hackathon time:**

1. Use the full existing parts layout and explicit fixed-axis prompt; keep Zod/semantic validation.
2. Add a whole-request deadline and output cap, and fall back to the original crop when uncertain or unavailable. Do not treat self-reported high confidence as a reliability gate.
3. Hand-review fixture steps 1, 12, 14 and 15, and trap details at 13; don't optimize models against disputed labels.
4. Ship the reviewed saved KALLAX demo path first. Treat live analysis as best-effort; don't let an accepted but impossible joint silently drive trusted guidance.

The user requested an early stop because of the hackathon deadline. All paid evaluation processes were stopped. The sequential Flash rollout completed records through step 14 only; it is **not** a full-manual end-to-end result. Native optional-field API trials, extra Flash repeats and Pro HIGH trials were not run. Only their diagnostic scaffolding exists. The subsequent implementation is listed below; disputed fixtures remain unchanged.

## Follow-up implementation

Applied after the evaluation: layout-aware prompt and full parts in a shared `analyzeStep` helper (Flash LOW default), requested-step-number validation, a shared 55-second deadline, 8,192 output-token cap, disabled SDK transport retries, schema-aware optional-null normalization, corrected standard Pro prices, and one-to-one scoring in the original spike. Added offline regression tests. Contracts and disputed fixtures remain unchanged. No additional paid calls were made. The shared helper is ready for the future API route; this does not implement that route or its fallback UI. Historical findings below describe the evaluated baseline.

## Scope and interpretation

The evaluation tested model/prompt alternatives. Its selected prompt has now been promoted and the original spike uses the shared helper and corrected scorer. Contracts and fixtures remain unchanged. No commits or paid infrastructure changes are made.

The original four-step experiment meets the issue's **exploration** threshold. It does not prove production reliability, does not determine a statistically reliable model winner, and does not test the whole upload pipeline. Every experiment here still supplies the hand-authored parts/layout; an AI-produced layout introduces another unmeasured source of error. Only KALLAX crops are available locally; LACK/MALM generalization is untested.

Complete measurements and per-step/per-field tables: `../../eval/out/kar04-review/measurements.md`. Saved records in that directory include input prompts, image hashes, responses, rejection reasons, model versions, timings, tokens, costs and scores. The output directory is git-ignored, intentionally; the reproducible harness and this report are not.

## Method

- Baseline: original analyze-step prompt, original short parts list, LOW reasoning, temperature 0. Both models, all 19 crops.
- Layout candidate: full existing `AiPart` data, fixed coordinate axes, explicit per-verb applicability, current-action versus context distinction. Both models, all 19 crops.
- Completed additional comparisons test Pro's documented default temperature, MEDIUM reasoning, previous-crop context and a step-3 example. Sequential predicted-state evaluation was stopped partway through. Native optional-schema comparison is implemented but was not run against the API. Settings and sample sizes are recorded per run; do not compare differently sized groups as if they used identical test cases.
- Calls still pass through the production `callStructured`, Zod, and `checkStep`. The injected SDK function adds an 8,192-output-token cap, no transport retries, and a shared 55-second whole-step deadline. This is a controlled baseline, not a reproduction of uncapped production latency.
- Each logical prediction permits up to three validation attempts. SDK/network/time failures count as failures, never disappear from the denominator.
- Scores use one-to-one maximum-agreement action assignment, penalize missing and extra actions, and report both the original six fields and active-only fields. Exact-action scores also check `at` and `flipMode`; exact-step scores additionally check step number, kind, and structural trap fields. Instruction wording and trap hint quality need visual review and are not captured by the exact-step number.
- Four fixture steps are disputed (1, 12, 14, 15), so a sensitivity table excludes them. This is **not** a certified replacement ground truth. No examples are added from future scored steps. The few-shot run excludes step 3 from evaluation.
- Prices in the ledger conservatively use Flash $1.50/$7.50 and Pro $2/$12 per million input/output tokens, including thought tokens, without promotional or cache discounts. Uncertain/aborted requests retain an allowance for the full 65,536-token model maximum, not merely the requested 8,192-token cap. The harness stops reserving requests at $9, leaving $1 below the user's $10 ceiling. Run only one harness process at a time; it manages two in-flight series internally. The ledger is an estimate/reservation system, not a Cloud Billing invoice or account-level spending limit.

## Findings established independently of model selection

### 1. The gold fixture is not a reliable physical ground truth yet

Visual inspection of all 19 supplied crops found:

| Step | Existing fixture | Drawing / review |
|---|---|---|
| 1 | Places E2 at the far end immediately | Main diagram only joins E1 and L1. E2 is not installed here. |
| 12 | Last two dowels: target E2, left face, for L2 | The last divider D4 is exposed; its two dowels point toward the still-absent E2. The other six belong to S1/S2/S3 toward L2. |
| 14 | Only screws, because E2 was declared placed in step 1 | The inset shows E2 being introduced now, then six screws secure the remaining corners. |
| 15 | A whole-unit stand-up action | The numbered operation shows four adhesive pads and a branch choice; the actual numbered drawing still has the unit lying down. Treating this as a synthetic transition needs an explicit product policy, not an asserted extraction label. |

Step 12's fixture already labels itself low-confidence. The candidate Flash response correctly identified D4/right/E2 and lost three comparison points. Do not teach these disputed labels as examples or silently "repair" model outputs to agree with them. Review the source manual and update reference data in a separate, explicit change.

The gold instruction for step 16 also describes marking a bracket position, while the numbered detail actually shows attaching brackets with screws. This reinforces the need to check instructions, not only action JSON.

There is a broader representation issue: crops such as step 2 show dowels aligned with the edge of the **loose incoming panel**, followed by placement of that panel. A model can reasonably describe insertion into that loose panel, but `checkStep` rejects later unplaced targets. Gold instead encodes the already assembled side of the joint as the hardware target. Those two encodings can refer to the same final dowel location, while describing different preparation order and face normals. The candidate prompt explicitly teaches gold's canonical receiving-anchor convention, so some accuracy gain is **encoding alignment**, not proof of improved image understanding. Decide whether Actions describe physical preparation operations or canonical final joints; document/validate that choice. A future manual requiring preparation of a new part cannot be handled honestly by simply treating every unplaced-target rejection as a hallucination.

### 2. The original scorer overcounts and misses important failure classes

`pipeline/scripts/spike.ts:27` uses `actual.find(verb + part)` independently for every expected action. On repeated dowel/screw groups, the same predicted action can be credited multiple times. Extra predicted actions never increase the denominator. Info steps have zero action fields, so this score alone cannot assess them. Trap correctness, flip mode, step number, instruction correctness and completeness are absent.

This does not mean the reported four-step numbers were fabricated: those particular steps mostly avoid repeated same-part actions. It means the scorer must change before extending to the full manual. The new scorer has offline regression tests for duplicate matching, hallucinated extras, omissions, optional-field inflation, info cases and flip mode.

### 3. Valid JSON and semantic acceptance are not assembly correctness

An offline reproduction passes a Step with `stepNumber: 999` and an S1 joint targeting `E2/bottom` through the current `checkStep` without errors. The request's step number is not checked there, and geometry feasibility is not checked.

In the live baseline, Pro's step 12 inserted dowels into D1/D2/D3/D4 toward L2 and was accepted with high confidence. Pro's step 14 grouped six screws into L2/back; the layout candidate also accepted physically wrong groups. The semantic checker recognizes vocabulary and identifiers but cannot verify what the crop depicts.

The scene resolver can render structurally wrong actions without throwing. Both baseline series finished with only 10/11 solid panels represented; one also emitted a hardware-face warning. "No exception" is not a sufficient integration assertion.

### 4. Gold history hides error propagation

The original spike reconstructs every step's prior state and instructions from gold. This is appropriate for an isolated perception test, but it must be labelled **gold-context**, not end-to-end upload accuracy. A missing panel placement can be invisibly supplied back to the next prediction. The diagnostic rollout instead advances only accepted predicted actions and uses predicted instructions.

### 5. The face explanation is underspecified for perspective drawings

The original prompt's "left and right = as you look at the drawing" conflates page directions with the fixed build-frame axes used by `scene/geometry.ts`. A diagonal screen arrow need not mean the build-frame right face. Full parts fractions/features and explicit +x/+y/+z definitions are already available through `AnalyzeStepRequest.parts`; using them needs no request-contract change. Adding a previous crop, by contrast, would require an API/client contract change because the current request has only one image.

### 6. Global null stripping is not a general schema-safe adapter

`dropNulls()` deletes every null-valued object property. A legitimate required nullable property such as `z.object({value: z.string().nullable()})` rejects `{value:null}` after normalization, even though Zod accepts the original value. Current Step fields are optional rather than genuinely nullable, so this is a generic-wrapper defect, not the main current step failure. Normalize only synthetic optional-null fields, or use a separate wire schema with an explicit transform. Retain Zod validation either way.

The claim that Gemini *always* omits optional fields is too broad. A native-optionals diagnostic was prepared but not run before the user's stop request; this review therefore does not establish whether it is better for this prompt.

### 7. Thinking LOW is not a latency bound

Production `vertexGenerate` currently specifies no output cap, timeout or abort signal, and the SDK's documented transport retry default is five attempts. Two validation retries can therefore exceed a 60-second route budget. The browser's reanalysis path can also use a shorter timeout. A production implementation needs a whole-request deadline shared across retries/escalation, transport retry policy, and a bounded output budget, with original-diagram fallback. Client cancellation does not guarantee cancellation of server billing (installed SDK documentation).

## External facts checked

- [Google's current Vertex pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing): standard global Pro 3.1 is $2 input / $12 output per million tokens below 200K input. The repository's $1/$6 rates correspond to discounted Flex/Batch pricing, not this standard synchronous request. Flash's introductory net rates are $0.75/$3.75; the review ledger uses undiscounted $1.50/$7.50 conservatively.
- [Flash 3.8 developer guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash): MINIMAL is unsupported; LOW/MEDIUM/HIGH are valid. Sampling parameters such as temperature are ignored. The report's suggestion to try MINIMAL on this model should not be implemented.
- [Gemini 3 guidance](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/get-started-with-gemini-3): recommends temperature 1 for applicable Gemini 3 models. The review tests this on Pro instead of assuming the global temperature-0 setting is optimal.
- [Thinking configuration](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking): Pro 3.1 supports LOW/MEDIUM/HIGH. Reasoning level is a model-specific quality/latency tradeoff, not a hard completion-time guarantee.

## Reproduction

Run from the repo root. Real-call commands cost money and require approval for any new run. Use unique run names; matching existing case files are resumed without rebilling.

```sh
npm run typecheck && npm test
npx tsx --conditions=react-server --env-file=.env.local pipeline/eval/kar04Review.ts baseline baseline all fast,strong LOW 1
npx tsx --conditions=react-server --env-file=.env.local pipeline/eval/kar04Review.ts layout layout all fast,strong LOW 1
npx tsx --conditions=react-server pipeline/eval/reviewSummary.ts
```

CLI positional arguments: run name, variant, comma-separated step numbers or `all`, tiers, thinking level, repeat count, temperature (0 or 1; default 0). Variants: baseline, layout, previous, fewshot, native, rollout. For a rollout, use every step in ascending order from 1. For few-shot, exclude training step 3.
