import Link from "next/link";

// Placeholder so the library's "Upload a manual" card has somewhere to go. The real page lands in SMI-07.
export default function UploadPage() {
  return (
    <main className="placeholder">
      <h1>Upload a manual</h1>
      <p>Uploading your own IKEA manual isn&apos;t available yet.</p>
      <p>
        <Link href="/">← Back to the library</Link>
      </p>
    </main>
  );
}
