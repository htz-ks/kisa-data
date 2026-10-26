import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BarChart3, Receipt, UserCog, LogOut, Smartphone, Tags, CreditCard, IdCard, Banknote, Undo2,
  ChevronDown, PlusSquare, List, Boxes, Handshake, FolderClosed, Wallet, Warehouse, ArrowLeft, CalendarDays, Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

/**
 * Sidebar structure:
 * - Standalone items (no children) have `to`
 * - Group items have `children`
 */
const NAV = [
  { key: "panel", to: "/dashboard", icon: LayoutDashboard, label: "Paneli", roles: ["admin", "employee"], tid: "nav-dashboard" },
  { key: "sale-new", to: "/sale/new", icon: Receipt, label: "Shitje e re", roles: ["admin", "employee"], tid: "nav-sale-new" },
  { key: "services", to: "/services", icon: Wrench, label: "Servis / Shërbimi", roles: ["admin"], tid: "nav-services" },
  { key: "daily-flow", to: "/daily-flow", icon: CalendarDays, label: "Qarkullimet Ditore", roles: ["admin"], tid: "nav-daily-flow" },
  { key: "pos", to: "/pos", icon: ShoppingCart, label: "POS i shpejtë", roles: ["admin", "employee"], tid: "nav-pos" },
  {
    key: "articles", icon: Boxes, label: "Artikuj", roles: ["admin", "employee"],
    children: [
      { to: "/products", icon: List, label: "Artikujt", roles: ["admin", "employee"], tid: "nav-products" },
      { to: "/products?new=1", icon: PlusSquare, label: "Krijo Artikull", roles: ["admin"], tid: "nav-product-new" },
      { to: "/stock", icon: Warehouse, label: "Stoku", roles: ["admin", "employee"], tid: "nav-stock" },
    ],
  },
  {
    key: "partners", icon: Handshake, label: "Partnerë", roles: ["admin", "employee"],
    children: [
      { to: "/customers", icon: Users, label: "Klientët", roles: ["admin", "employee"], tid: "nav-customers" },
      { to: "/suppliers", icon: Truck, label: "Furnitorët", roles: ["admin"], tid: "nav-suppliers" },
    ],
  },
  {
    key: "docs", icon: FolderClosed, label: "Dokumente", roles: ["admin", "employee"],
    children: [
      { to: "/purchases", icon: FileText, label: "Blerjet", roles: ["admin"], tid: "nav-purchases" },
      { to: "/sales", icon: Receipt, label: "Faturat", roles: ["admin", "employee"], tid: "nav-sales" },
      { to: "/returns", icon: Undo2, label: "Rikthimet", roles: ["admin"], tid: "nav-returns" },
    ],
  },
  {
    key: "finance", icon: Wallet, label: "Financa", roles: ["admin"],
    children: [
      { to: "/payments", icon: CreditCard, label: "Pagesa / Borxhe", roles: ["admin"], tid: "nav-payments" },
      { to: "/customer-cards", icon: IdCard, label: "Kartela e blerësve", roles: ["admin"], tid: "nav-customer-cards" },
      { to: "/supplier-cards", icon: IdCard, label: "Kartela e furnitorëve", roles: ["admin"], tid: "nav-supplier-cards" },
      { to: "/expenses", icon: Banknote, label: "Shpenzimet", roles: ["admin"], tid: "nav-expenses" },
      { to: "/reports", icon: BarChart3, label: "Raportet", roles: ["admin"], tid: "nav-reports" },
    ],
  },
  { key: "users", to: "/users", icon: UserCog, label: "Përdoruesit", roles: ["admin"], tid: "nav-users" },
];

function filterByRole(items, role) {
  return items
    .filter((i) => i.roles.includes(role))
    .map((i) => (i.children ? { ...i, children: i.children.filter((c) => c.roles.includes(role)) } : i))
    .filter((i) => !i.children || i.children.length > 0);
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = filterByRole(NAV, user?.role);
  // open state for groups
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(items.filter((i) => i.children).map((i) => [i.key, true])));
  const toggle = (k) => setOpenGroups((p) => ({ ...p, [k]: !p[k] }));

  const onLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
    }`;

  return (
    <div className="min-h-screen bg-white text-slate-900 flex">
      {/* Sidebar (always dark) */}
      <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-slate-800 bg-[#0A0E16] shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-slate-900" />
          </div>
          <div>
            <div className="font-extrabold tracking-tight text-slate-100">KISA-DATA</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">Stock & POS</div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {items.map((i) => {
            if (!i.children) {
              return (
                <NavLink key={i.key} to={i.to} data-testid={i.tid} end className={navItemClass}>
                  <i.icon className="w-4 h-4" />
                  <span>{i.label}</span>
                </NavLink>
              );
            }
            const open = openGroups[i.key];
            return (
              <div key={i.key} className="mt-2">
                <button onClick={() => toggle(i.key)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-widest font-mono-pd text-slate-500 hover:text-slate-300"
                  data-testid={`navgroup-${i.key}`}>
                  <span className="flex items-center gap-2"><i.icon className="w-3.5 h-3.5" /> {i.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
                </button>
                {open && (
                  <div className="mt-0.5 ml-2 pl-2 border-l border-slate-800/60 space-y-0.5">
                    {i.children.map((c) => (
                      <NavLink key={c.to} to={c.to} data-testid={c.tid} end className={navItemClass}>
                        <c.icon className="w-4 h-4" />
                        <span>{c.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate text-slate-200" data-testid="current-user-name">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono-pd">{user?.role}</div>
            </div>
          </div>
          <Button onClick={onLogout} variant="ghost" size="sm"
            className="w-full justify-start text-slate-400 hover:text-red-300 hover:bg-red-500/10"
            data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" /> Dil
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0E16] border-t border-slate-800">
        <div className="grid grid-cols-5 gap-0">
          {items.slice(0, 5).map((i) => {
            const to = i.to || i.children?.[0]?.to;
            const Icon = i.icon;
            return (
              <NavLink key={i.key} to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-[10px] ${isActive ? "text-emerald-400" : "text-slate-400"}`
                }>
                <Icon className="w-4 h-4" />
                <span>{i.label.split(" ")[0]}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <main className="pane-light flex-1 min-w-0 pb-20 md:pb-0">
        <BackToSale />
        <Outlet />
      </main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

const DRAFT_KEY = "sale-draft";

const BackToSale = () => {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [has, setHas] = useState(!!sessionStorage.getItem(DRAFT_KEY));
  useEffect(() => {
    const on = () => setHas(!!sessionStorage.getItem(DRAFT_KEY));
    window.addEventListener("sale-draft", on);
    return () => window.removeEventListener("sale-draft", on);
  }, []);
  if (!has || pathname === "/sale/new") return null;
  return (
    <button onClick={() => nav("/sale/new")} data-testid="back-to-sale-btn"
      className="fixed bottom-20 md:bottom-6 right-6 z-[60] pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow-xl transition-colors">
      <ArrowLeft className="w-5 h-5" /> Kthehu te Shitja vendore
    </button>
  );
};
