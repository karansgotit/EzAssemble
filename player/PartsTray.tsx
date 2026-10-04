import type { TrayItem } from "./stepView";
import styles from "./StepPlayer.module.css";

/** "What you'll use": the parts this step needs, written the manual's way, count first (FR-39). */
export function PartsTray({ items }: { items: TrayItem[] }) {
  return (
    <section className={styles.tray} aria-label="Parts used in this step">
      <h2 className="eyebrow">What you&apos;ll use</h2>
      {items.length === 0 ? (
        <p className={styles.muted}>No new parts in this step.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className={styles.count}>{item.count}×</span>
              <span className={styles.partName}>{item.label}</span>
              {item.ikeaNumber && <span className={styles.partNumber}>{item.ikeaNumber}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
