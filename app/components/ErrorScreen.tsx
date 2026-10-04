import Link from "next/link";
import styles from "./ErrorScreen.module.css";

/** The red error screen: shown instead of a blank page whenever loaded data is missing or invalid (FR-02). */
export function ErrorScreen({ title, errors }: { title: string; errors: string[] }) {
  return (
    <main className={styles.screen} role="alert">
      <h1>{title}</h1>
      <ul>
        {errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
      <Link href="/">← Back to the library</Link>
    </main>
  );
}
