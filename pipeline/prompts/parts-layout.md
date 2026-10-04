You are reading a wordless IKEA assembly manual for "{{title}}". List every part, and estimate where each solid part sits once assembled, measured in the pose the steps are drawn in (the build pose), not the pose of the finished product on the cover.

## Images
- Image 1 is the cover: the finished furniture.
- The next {{partsPageCount}} image(s) are the parts list: every panel and hardware piece with its count ("22x") and number ("101339").
- The last {{stepThumbCount}} images are small thumbnails of the assembly steps, in order.

## Parts
- One entry per DISTINCT solid piece (panel, leg, finished sub-assembled unit such as a drawer): give each its own snake_case id, e.g. "long_panel_1", "long_panel_2", "shelf_1", "drawer_1", "drawer_2", and count 1. Two identical shelves are two entries.
- Hardware (dowel, screw, cam, camBolt, nail) is ONE entry per type with its total count from the parts list, e.g. id "dowel", count 22. Use the printed number as ikeaNumber.
- label: a short plain name (at most 40 characters), e.g. "Long side panel".
- shape: "box" for solids, "cylinder" for dowels, screws, cams and bolts.
- hardwareMm (hardware only): approximate length and diameter in mm.
- Never use the id "assembly"; it is reserved.
- Leave out accessories that are none of these kinds and are not built into the furniture: felt pads, wall brackets, covers, wall plugs, tools such as the Allen key or handle, and any screws that only fix those accessories (e.g. bracket screws). They are not animated.

## The build frame
The furniture's finished (upright) size is {{productSizeCm}} cm (width × height × depth).
Steps are drawn with the furniture in one pose while it is being built. Pick that pose as buildOrientation:
- "upright": built standing as it will be used. Build size = [width, height, depth].
- "on-back": built lying on its back. You look DOWN into the open compartments; the depth is what stands vertically, so the build is low. Build size = [height, depth, width].
- "upside-down": built with its top on the floor. Build size = [width, height, depth].
- "on-side": built lying on one side panel. The open front faces YOU, not the ceiling; the width stands vertically. Build size = [height, width, depth].
Decide from the middle step thumbnails, while parts are still being added: which dimension of the furniture is vertical there? Ignore the cover and the last steps, which usually show the finished product standing. Then give every sizeFrac and homeFrac in that build pose.

All positions use that build pose: +x = right, +y = up, +z = toward the viewer. Faces: left = -x, right = +x, bottom = -y, top = +y, back = -z, front = +z.

## Solid parts only
- sizeFrac: the part's full size along x, y, z as fractions (0, 1] of the build size. A panel spanning the full length is 1 on that axis; a 1.5 cm thick panel in a 77 cm direction is about 0.02.
- homeFrac: the centre of the part in the finished build, as fractions (0, 1) of the build size.
- features: which face has the drilled holes ("holes") or the nice visible edge ("finished-edge"), in the build frame. Leave [] if you can't tell.
Hardware never has sizeFrac or homeFrac.

## Problems with your previous answer
{{previousErrors}}
