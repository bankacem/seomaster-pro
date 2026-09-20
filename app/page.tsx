export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section style={{ maxWidth: 680, textAlign: "center" }}>
        <p style={{ margin: 0, color: "#2563eb", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          SEOMaster Pro
        </p>
        <h1 style={{ margin: "1rem 0 0.75rem", fontSize: "2.25rem" }}>Backend is running</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
          خدمة الـ API تعمل. استخدم مسارات المصادقة والتحليل والفوترة تحت <code>/api</code>.
        </p>
      </section>
    </main>
  );
}