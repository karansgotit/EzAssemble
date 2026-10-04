import Link from "next/link";
import styles from "./ErrorScreen.module.css";

/** Shown instead of a blank page whenever loaded data is missing or invalid (FR-02): what happened, why, and the way out. */
export function ErrorScreen({ title, errors }: { title: string; errors: string[] }) {
  return (
    <main className={styles.screen} role="alert">
      <span className={styles.mark} aria-hidden="true">
        ✗
      </span>
      <div className={styles.say}>
        <h1>{title}</h1>
        <ul>
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
        <Link className="btn btn-lg" href="/">
          ← All manuals
        </Link>
      </div>
    </main>
  );
}
