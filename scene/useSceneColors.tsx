"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { COLORS, readSceneColors, type SceneColors } from "./constants";

// The colours in force for one canvas. Parts read them from here, never from constants.
export const SceneColorsContext = createContext<SceneColors>(COLORS);
export const useSceneColors = (): SceneColors => useContext(SceneColorsContext);

// The scene's colours as the page defines them (the --scene-* design tokens), so the 3D and
// the UI around it always match. Until the page defines a token, the designed value is used.
export function usePageSceneColors(): SceneColors {
  const [colors, setColors] = useState<SceneColors>(COLORS);
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setColors(readSceneColors((name) => style.getPropertyValue(name)));
  }, []);
  return colors;
}
