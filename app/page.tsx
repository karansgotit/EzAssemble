"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Loaded, loadLibrary, manualBaseUrl } from "@/client/loadManual";
import { setPendingUpload } from "@/client/pendingUpload";
import type { LibraryIndex } from "@/schema";
import { DropZone } from "./components/DropZone";
import styles from "./home.module.css";

// The three things that happen, in the order they happen. A real sequence, so it is numbered.
const HOW_IT_WORKS = [
  { title: "Drop in your manual", text: "The PDF that came with your furniture, or the one from the maker's website." },
  { title: "Wait 2 to 3 minutes", text: "We read every page and work out each step. You watch them appear." },
  { title: "Follow along in 3D", text: "One step at a time: a plain sentence and an animation of which piece goes where." },
];

/** Home: say what this does, show the three steps, and take the manual (FR-01, FR-03, FR-10). */
export default function HomePage() {
  const router = useRouter();
  const [library, setLibrary] = useState<Loaded<LibraryIndex> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary().then((result) => {
      if (!cancelled) setLibrary(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function start(file: File) {
    setPendingUpload(file);
    router.push("/upload");
  }

  return (
    <main className={styles.page}>
      <p className={styles.name}>EzAssemble</p>

      <section className={styles.hero}>
        <div className={styles.pitch}>
          <h1>Turn a furniture manual into steps you can actually follow.</h1>
          <p>
            Upload the assembly manual. Get every step as one plain sentence and a 3D animation that shows exactly which piece goes where, plus the
            mistake to avoid.
          </p>
        </div>
        <DropZone onFile={start} />
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className={styles.heading}>
          How it works
        </h2>
        <ol className={styles.how}>
          {HOW_IT_WORKS.map((item, i) => (
            <li key={item.title}>
              <span className={styles.howNumber} aria-hidden="true">
                {i + 1}
              </span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="example-heading">
        <h2 id="example-heading" className={styles.heading}>
          What you get for each step
        </h2>
        <div className={styles.example}>
          <figure className={styles.before}>
            <figcaption className="eyebrow">In the manual</figcaption>
            <img src="/manuals/kallax/crops/step-03.jpg" alt="A wordless drawing: two dowels and a panel, with an arrow" />
          </figure>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
          <div className={styles.after}>
            <p className="eyebrow">In EzAssemble</p>
            <p className={styles.sentence}>
              <span aria-hidden="true">3</span>
              Tap 2 dowels into the long panel and push the first shelf onto them.
            </p>
            <ul>
              <li>A 3D animation of the piece moving into place</li>
              <li>The parts you need, with their counts</li>
              <li>A warning when a piece can go in the wrong way round</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading" className={styles.heading}>
          No manual to hand? Try one we&apos;ve already read
        </h2>
        {library && !library.ok ? (
          <p className={styles.note} role="alert">
            The saved manuals couldn&apos;t be loaded. {library.errors[0]}
          </p>
        ) : (
          <ul className={styles.grid} aria-busy={library === null}>
            {library === null && <li className={styles.note}>Loading manuals…</li>}
            {library?.ok && library.data.length === 0 && <li className={styles.note}>Nothing here yet. Drop a manual above to read the first one.</li>}
            {library?.ok &&
              library.data.map((manual) => (
                <li key={manual.id}>
                  <Link className={styles.card} href={`/m/${manual.id}`}>
                    <img src={manualBaseUrl(manual.id) + manual.thumbnail} alt="" />
                    <strong>{manual.title}</strong>
                    <span>
                      {manual.stepCount} {manual.stepCount === 1 ? "step" : "steps"} · open
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}
