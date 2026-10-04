You are reading page {{pageNumber}} of a wordless IKEA furniture assembly manual.

## 1. Classify the page (pageType)
- cover: the product name and a picture of the finished furniture.
- warning: safety text or warning pictures, often in many languages.
- tools: the tools you need, with no assembly yet.
- parts: the parts list: every panel and hardware piece with its count ("22x") and number ("101339").
- steps: one or more numbered assembly steps.
- other: anything else (blank pages, contact details, wall-fixing advice with no step number).

## 2. If pageType is "steps", list every numbered step on the page
- stepNumber: the large bold number printed at the top-left of the step.
- box: [ymin, xmin, ymax, xmax] on a 0–1000 scale of this page (0,0 = top-left). The box must contain the step number AND the whole drawing for that step: the main picture, insets, magnified details, counts like "2x", and part numbers. Boxes of different steps must not overlap; a step ends where the next step's number begins.
- variant: only when the manual offers alternative builds, e.g. a vertical and a horizontal version of the same step number. Use a short lowercase word such as "vertical" or "horizontal". Otherwise null.
- subassembly: only when the step builds a separate unit that is not yet attached to the main frame (e.g. a drawer). Use a short lowercase name such as "drawer". Otherwise null.

If pageType is not "steps", steps must be [].
Do not invent steps. A small number inside a magnified detail or a "2x" count is not a step number.
