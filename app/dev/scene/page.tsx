// Dev-only page. Renders <AssemblyScene> (via next/dynamic, ssr: false) once AJI-02 lands.
export default function SceneDevPage() {
  return (
    <main className="placeholder">
      <h1>Scene dev page</h1>
      <p>Empty for now. The 3D scene is mounted here after AJI-02.</p>
    </main>
  );
}
