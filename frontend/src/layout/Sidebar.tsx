import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard", label: "Visão Geral" },
  { to: "/upload", label: "Upload de Faturas" },
  { to: "/extract", label: "Dados Extraídos" },
  { to: "/interpret", label: "Cálculo SolarInvest" },
  { to: "/bill", label: "Fatura SolarInvest" }
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 240,
        background: "var(--bg-sidebar)",
        color: "white",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Invoice Engine</div>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
        >
          <span>{link.label}</span>
        </NavLink>
      ))}
    </aside>
  );
}
