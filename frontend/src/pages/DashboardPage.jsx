import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Smartphone, Package, TrendingUp, AlertTriangle, Wallet, ArrowDownRight, Target, Award, Receipt } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from "recharts";

function Stat({ icon: Icon, label, value, hint, color = "emerald", tid }) {
  const colors = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    red: "text-red-400 bg-red-500/10 border-red-500/30",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  };
  return (
    <div className="stat-card" data-testid={tid}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] uppercase font-mono-pd tracking-widest text-slate-500">{hint}</span>
      </div>
      <div className="mt-4 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [d, setD] = useState(null);
  const [top, setTop] = useState([]);
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    (async () => {
      const calls = [api.get("/reports/my-performance")];
      if (isAdmin) {
        calls.push(api.get("/reports/dashboard"), api.get("/reports/top-products"));
      }
      const results = await Promise.all(calls);
      setPerf(results[0].data);
      if (isAdmin) {
        setD(results[1].data);
        setTop(results[2].data);
      }
    })();
  }, [isAdmin]);

  if (!isAdmin || isAdmin) {
    return (
      <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6" data-testid="employee-landing">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_60%)] blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-8">
              <Smartphone className="w-14 h-14 text-slate-900" strokeWidth={2.5} />
            </div>
            <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-br from-slate-100 to-slate-400 bg-clip-text text-transparent">
              PRODATA
            </h1>
            <div className="mt-3 text-sm font-mono-pd uppercase tracking-[0.4em] text-emerald-400">
              Stock · POS · Phones
            </div>
            <div className="mt-10 text-xs font-mono-pd uppercase tracking-widest text-slate-600">
              v1.0
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title={isAdmin ? "Paneli i kontrollit" : `Mirë se vjen, ${user?.name || ""}`}
        subtitle={isAdmin ? "Pamje e shpejtë e biznesit tënd" : "Performanca jote për sot"}
        testid="dashboard-header"
      />

      {/* Personal performance panel (always) */}
      {perf && (
        <div className="mb-6" data-testid="my-performance-panel">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] uppercase font-mono-pd text-slate-500">Target ditor</span>
              </div>
              <div className="text-2xl font-extrabold">{eur(perf.today_total)} <span className="text-sm text-slate-500 font-normal">/ {eur(perf.daily_target)}</span></div>
              <div className="mt-3">
                <Progress value={perf.target_progress} className="h-2 bg-slate-800" />
                <div className="text-xs text-slate-500 mt-1.5 flex justify-between">
                  <span>{Math.round(perf.target_progress)}% i target-it</span>
                  {perf.target_remaining > 0 && <span className="text-amber-400">Mbetur {eur(perf.target_remaining)}</span>}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <span className="text-[10px] uppercase font-mono-pd text-slate-500">Fatura sot</span>
              </div>
              <div className="text-2xl font-extrabold mt-1">{perf.today_count}</div>
              <div className="text-xs text-slate-500 mt-1.5">Këtë muaj: <span className="text-slate-300">{perf.month_count}</span></div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span className="text-[10px] uppercase font-mono-pd text-slate-500">Komision sot</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-400">{eur(perf.today_commission)}</div>
              <div className="text-xs text-slate-500 mt-1.5">{perf.commission_percent}% nga shitjet</div>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="w-5 h-5 text-sky-400" />
                <span className="text-[10px] uppercase font-mono-pd text-slate-500">Komision muaj</span>
              </div>
              <div className="text-2xl font-extrabold text-sky-400">{eur(perf.month_commission)}</div>
              <div className="text-xs text-slate-500 mt-1.5">Shitjet muaj: {eur(perf.month_total)}</div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && perf && (
        <div className="stat-card">
          <h3 className="text-lg font-bold mb-3">Shitjet e mia të fundit</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {perf.recent_sales.length === 0 && <div className="text-slate-500 text-sm py-6 text-center">Ende pa shitje. Shko te POS!</div>}
            {perf.recent_sales.map((s) => (
              <div key={s.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div>
                  <div className="font-mono-pd text-emerald-400 text-sm">{s.invoice_no}</div>
                  <div className="text-xs text-slate-500">{(s.created_at || "").slice(0, 16).replace("T", " ")} · {s.customer_name || "I rastit"}</div>
                </div>
                <div className="font-mono-pd font-semibold">{eur(s.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && !d ? (
        <div className="text-slate-500 text-sm">Duke ngarkuar…</div>
      ) : isAdmin && d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Stat tid="stat-sales-today" icon={TrendingUp} label="Shitjet sot" value={eur(d.sales_today)} hint="Sot" color="emerald" />
            <Stat tid="stat-sales-month" icon={Wallet} label="Shitjet këtë muaj" value={eur(d.sales_month)} hint="Muaji" color="sky" />
            <Stat tid="stat-stock-value" icon={Package} label="Vlera e stokut" value={eur(d.stock_value)} hint="Stok" color="indigo" />
            <Stat tid="stat-total-units" icon={Smartphone} label="Njësi në stok" value={d.total_units} hint="Copë" color="emerald" />
            <Stat tid="stat-low-stock" icon={AlertTriangle} label="Produkte në stok të ulët" value={d.low_stock_count} hint="Kujdes" color="amber" />
            <Stat tid="stat-customer-debt" icon={ArrowDownRight} label="Borxh nga klientët" value={eur(d.customer_debt)} hint="Të marrim" color="amber" />
            <Stat tid="stat-supplier-debt" icon={ArrowDownRight} label="Borxh ndaj furnitorëve" value={eur(d.supplier_debt)} hint="Të paguajmë" color="red" />
            <Stat tid="stat-orders-today" icon={Package} label="Fatura sot" value={d.orders_today} hint="Sot" color="indigo" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2 stat-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Shitjet 7 ditët e fundit</h3>
                  <p className="text-xs text-slate-500">Totali ditor në EUR</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.chart_7d}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233044" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={11}
                      tickFormatter={(v) => v.slice(5)} />
                    <YAxis stroke="#64748B" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0B0F17", border: "1px solid #233044", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5}
                      dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="stat-card">
              <h3 className="text-lg font-bold mb-4">Produktet më të shitura</h3>
              <div className="h-72">
                {top.length === 0 ? (
                  <div className="text-slate-500 text-sm">Nuk ka të dhëna ende.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top.slice(0, 5)} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="product_name" stroke="#94A3B8" width={100} fontSize={11} />
                      <Tooltip contentStyle={{ background: "#0B0F17", border: "1px solid #233044", borderRadius: 8 }} />
                      <Bar dataKey="units" fill="#6366F1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
