import type { TrayItem } from "./stepView";
import styles from "./StepPlayer.module.css";

/** "What you'll use": the parts this step's actions move, with counts and IKEA numbers (FR-39). */
export function PartsTray({ items }: { items: TrayItem[] }) {
  return (
    <section className={styles.tray} aria-label="Parts used in this step">
      <h3>What you&apos;ll use</h3>
      {items.length === 0 ? (
        <p className={styles.muted}>No new parts in this step.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.label}</strong>
                {item.ikeaNumber && <small>#{item.ikeaNumber}</small>}
              </span>
              <span className={styles.count}>×{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
