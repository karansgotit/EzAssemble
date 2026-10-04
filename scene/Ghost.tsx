"use client";

import { Edges } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { CanvasTexture, Color, SRGBColorSpace } from "three";
import { COLORS } from "./constants";
import { FeatureMarker } from "./FeatureMarker";
import { ghostAt } from "./ghostFrames";
import type { Placed } from "./resolveScene";
import type { SceneTrap } from "./types";

const LABEL_GAP_CM = 8;
const LABEL_HEIGHT = 0.034; // of the view; the label keeps its size however far the camera is
const LABEL_PX = 80;

// A pill-shaped text label drawn to a texture, so it lives in the 3D scene and needs no DOM.
function useLabel(text: string, background: string): { texture: CanvasTexture; aspect: number } {
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    const pen = canvas.getContext("2d");
    const font = `600 ${LABEL_PX * 0.52}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    if (pen) pen.font = font;
    canvas.width = Math.ceil((pen?.measureText(text).width ?? LABEL_PX * 4) + LABEL_PX * 0.8);
    canvas.height = LABEL_PX;
    if (pen) {
      pen.font = font; // resizing the canvas resets it
      pen.fillStyle = background;
      pen.beginPath();
      if (pen.roundRect) pen.roundRect(0, 0, canvas.width, canvas.height, LABEL_PX / 2);
      else pen.rect(0, 0, canvas.width, canvas.height);
      pen.fill();
      pen.fillStyle = "#ffffff";
      pen.textAlign = "center";
      pen.textBaseline = "middle";
      pen.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, aspect: canvas.width / canvas.height };
  }, [text, background]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return label;
}

// The wrong-vs-right moment before a step plays: a see-through copy of the part, the wrong way
// round and red, that turns the right way and goes green. Its hole dots sit on the face that
// must point the right way, so they visibly start on the wrong side.
export function Ghost({ piece, trap, time }: { piece: Placed; trap: SceneTrap; time: number }) {
  const frame = ghostAt(trap, time);
  const corrected = frame?.label.startsWith("✓") ?? false;
  const label = useLabel(frame?.label ?? "", corrected ? COLORS.right : COLORS.wrong);
  if (!frame) return null;
  const color = new Color(COLORS.wrong).lerp(new Color(COLORS.right), frame.rightness).getStyle();
  const solid = Math.min(1, frame.opacity * 2.2); // edges, dots and label stay readable while the fill is faint
  return (
    <group position={piece.position}>
      <group quaternion={frame.quaternion}>
        <mesh>
          <boxGeometry args={piece.size} />
          <meshStandardMaterial color={color} transparent opacity={frame.opacity} depthWrite={false} />
          <Edges color={color} lineWidth={1.7} transparent opacity={solid} />
        </mesh>
        <FeatureMarker size={piece.size} features={[{ type: "holes", face: trap.mustFace }]} opacity={solid} />
      </group>
      <sprite position={[0, piece.size[1] / 2 + LABEL_GAP_CM, 0]} scale={[LABEL_HEIGHT * label.aspect, LABEL_HEIGHT, 1]} renderOrder={10}>
        <spriteMaterial map={label.texture} transparent opacity={solid} depthTest={false} sizeAttenuation={false} toneMapped={false} />
      </sprite>
    </group>
  );
}
