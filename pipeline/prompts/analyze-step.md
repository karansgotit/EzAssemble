You read an IKEA assembly step. Return the Step JSON form, not coordinates or code.
The final image is the current step {{stepNumber}}. Any earlier image is explicitly labelled context, not an instruction to repeat.

## Parts and layout
{{parts}}
The layout fractions describe final solid boxes in a fixed BUILD frame, not screen pixels.
homeFrac is each box's centre; sizeFrac is its full extent. Use these existing estimates to distinguish similarly named panels.
+x = right, +y = up, +z = front. Faces: left=-x, right=+x, bottom=-y, top=+y, back=-z, front=+z.
Keep these axes fixed across perspective drawings and after a whole-assembly flip. A diagonal arrow on the page is NOT automatically the left/right face.
An inset may show a tool or enlarged joint, not a separate action. Match the inset's leader to the main diagram.

## Prior accepted state
Placed ids: {{placedPartIds}}
Previous instructions: {{previousInstructions}}
Do not repeat past assembly actions. Parts merely visible in the diagram need no placement action.
Use current arrows, loose parts, callouts and hardware counts to identify what changes NOW.
Do not invent placements just to complete the model. If several parts share a shape, use their layout, the remaining ids and the assembly history.

## Actions
- insert: put a dowel or cam into a solid.
- screw: drive a screw or bolt into a solid.
- lock: turn previously inserted cam hardware.
- place: slide a solid panel into a joint, including onto existing dowels.
- attach: secure a solid as a structural attachment, commonly alongside screws.
- flip: rotate the whole assembly; part="assembly", count=1, flipMode="stand-up" or "turn-over". No target, face, for or at.
part is the moving part or hardware id. Use only listed ids, or assembly for flip.
count is per action/target, not the total across several targets. Split hardware over distinct targets into separate actions, at most four.
target is the solid receiving it, not the moving panel. face is the face OF target, in the fixed build frame.
for is hardware-only: the other solid connected by the hardware. Prefer for when the layout and diagram identify it; otherwise use at=start/middle/end/all if visible, without guessing an id.
For inserts that introduce a panel, describe the joint using the already assembled receiving solid as target, and the newly introduced panel as for. Then place that panel on the same target/face.
For hardware-only preparation, identify the receiving solid and the next mating solid from layout; don't pretend the latter was placed now.
place/attach have count=1 and no for, at or flipMode. Hardware requires target and face. Null means not applicable, not a substitute for a required joint field.
The first assembly step may establish its receiving foundation implicitly. In later steps, targets must already be placed or have been placed earlier within this step.

## Evidence and uncertainty
kind="info", actions=[] for wall fixing, tools or non-assembly warnings. Explain the visible operation even if excluded from 3D.
orientationTrap is ONLY for a drawn orientation detail or crossed-out wrong orientation of an action's part. It is not a generic safety warning or tool close-up. Source="manual"; otherwise null. Don't infer a warning just because parts have holes.
instruction: one practical sentence, at most 25 words. Don't invent invisible operations.
confidence="low" if any identity or joint is uncertain; don't turn a guess into high confidence to satisfy validation.
orientationTrap.hint must be at most 80 characters. Return exactly the requested stepNumber.
