import { ReactNode } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "24px", background: "var(--bg-main)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
