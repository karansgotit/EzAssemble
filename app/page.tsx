import Link from "next/link";

// Placeholder. The library (manual cards + "Upload a manual") lands in SMI-02.
export default function HomePage() {
  return (
    <main className="placeholder">
      <h1>EzAssemble</h1>
      <p>Turn a confusing IKEA assembly manual into clear, animated 3D steps.</p>
      <p>
        The manual library goes here. Dev pages: <Link href="/dev/scene">scene</Link>.
      </p>
    </main>
  );
}
