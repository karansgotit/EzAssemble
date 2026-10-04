"use client";

// Dev-only page for SMI-05: rasterize a PDF in the browser and try a step crop.
// Pick a file, or open /dev/pdf?url=/some.pdf to load one served by this app.
import { useCallback, useEffect, useState } from "react";
import { jpegDataUrl } from "@/client/canvas";
import { type Box, cropBox } from "@/client/crop";
import { type PageImage, PdfError, rasterize } from "@/client/rasterize";
import styles from "./page.module.css";

const DEFAULT_BOX = "370, 20, 725, 980";

function parseBox(text: string): Box | null {
  const values = text.split(",").map((part) => Number(part.trim()));
  return values.length === 4 && values.every(Number.isFinite) ? (values as Box) : null;
}

function kb(base64: string): number {
  return Math.round((base64.length * 0.75) / 1024);
}

export default function PdfDevPage() {
  const [status, setStatus] = useState("Pick a PDF.");
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageImage[]>([]);
  const [selected, setSelected] = useState(1);
  const [boxText, setBoxText] = useState(DEFAULT_BOX);
  const [crop, setCrop] = useState<{ full: string; thumb: string } | null>(null);

  const run = useCallback(async (file: File) => {
    setError(null);
    setPages([]);
    setCrop(null);
    setStatus(`Rasterizing ${file.name}…`);
    const started = performance.now();
    try {
      const result = await rasterize(file);
      const seconds = ((performance.now() - started) / 1000).toFixed(2);
      const totalKb = result.reduce((sum, page) => sum + kb(page.jpegBase64), 0);
      setPages(result);
      setSelected(1);
      setStatus(`${result.length} pages in ${seconds} s · ${totalKb} KB of JPEG in total`);
    } catch (e) {
      setStatus("Failed.");
      setError(e instanceof PdfError ? e.message : `Unexpected error: ${String(e)}`);
    }
  }, []);

  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get("url");
    if (!url) return;
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => run(new File([blob], url.split("/").pop() ?? "file")));
  }, [run]);

  const page = pages.find((p) => p.pageNumber === selected);
  const box = parseBox(boxText);

  async function runCrop() {
    if (!page || !box) return;
    setCrop({ full: await cropBox(page, box), thumb: await cropBox(page, box, { maxLongSide: 512 }) });
  }

  return (
    <main className={styles.page}>
      <h1>PDF rasterize + crop</h1>
      <input
        type="file"
        aria-label="PDF file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void run(file);
        }}
      />
      <p data-testid="status">{status}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {page && (
        <section className={styles.crop}>
          <label>
            Box for page {page.pageNumber} [ymin, xmin, ymax, xmax], 0–1000{" "}
            <input value={boxText} onChange={(e) => setBoxText(e.target.value)} />
          </label>
          <button type="button" onClick={() => void runCrop()} disabled={!box}>
            Crop
          </button>
          {crop && (
            <div className={styles.cropResult}>
              <img src={jpegDataUrl(crop.full)} alt="Cropped step" />
              <img src={jpegDataUrl(crop.thumb)} alt="Cropped step, 512 px thumbnail" />
              <p data-testid="crop-size">
                crop {kb(crop.full)} KB · thumb {kb(crop.thumb)} KB
              </p>
            </div>
          )}
        </section>
      )}

      <div className={styles.grid}>
        {pages.map((p) => (
          <button
            type="button"
            key={p.pageNumber}
            className={p.pageNumber === selected ? styles.selected : undefined}
            onClick={() => {
              setSelected(p.pageNumber);
              setCrop(null);
            }}
          >
            <img src={jpegDataUrl(p.jpegBase64)} alt={`Page ${p.pageNumber}`} />
            <span>
              {p.pageNumber} · {p.width}×{p.height} · {kb(p.jpegBase64)} KB
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
