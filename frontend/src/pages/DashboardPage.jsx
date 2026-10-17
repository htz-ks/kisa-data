import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Smartphone, Package, TrendingUp, AlertTriangle, Wallet, ArrowDownRight } from "lucide-react";
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
  const [d, setD] = useState(null);
  const [top, setTop] = useState([]);

  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([
        api.get("/reports/dashboard"),
        api.get("/reports/top-products"),
      ]);
      setD(a.data);
      setTop(b.data);
    })();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Paneli i kontrollit"
        subtitle="Pamje e shpejtë e biznesit tënd"
        testid="dashboard-header"
      />
      {!d ? (
        <div className="text-slate-500 text-sm">Duke ngarkuar…</div>
      ) : (
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
