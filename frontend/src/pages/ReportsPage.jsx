import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line,
} from "recharts";

export default function ReportsPage() {
  const [top, setTop] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      const [t, s, p] = await Promise.all([api.get("/reports/top-products"), api.get("/sales"), api.get("/products")]);
      setTop(t.data); setSales(s.data); setProducts(p.data);
    })();
  }, []);

  // group sales by day (last 30)
  const byDay = {};
  sales.forEach((s) => {
    const d = (s.created_at || "").slice(0, 10);
    if (!byDay[d]) byDay[d] = { date: d, total: 0, orders: 0 };
    byDay[d].total += s.total || 0;
    byDay[d].orders += 1;
  });
  const chart = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  const totalRevenue = sales.reduce((s, x) => s + (x.total || 0), 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.items || []).reduce((a, i) => a + (i.sale_price - (i.cost_price || 0)) * i.quantity, 0), 0);
  const totalOrders = sales.length;
  const lowStock = products.filter((p) => p.quantity <= (p.low_stock_threshold || 2));

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Raportet" subtitle="Analiza e shitjeve, fitimit dhe stokut" />

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card"><div className="text-xs uppercase font-mono-pd text-slate-500">Të ardhura totale</div><div className="text-2xl font-extrabold text-emerald-400 mt-2">{eur(totalRevenue)}</div></div>
        <div className="stat-card"><div className="text-xs uppercase font-mono-pd text-slate-500">Fitimi i vlerësuar</div><div className="text-2xl font-extrabold text-indigo-400 mt-2">{eur(totalProfit)}</div></div>
        <div className="stat-card"><div className="text-xs uppercase font-mono-pd text-slate-500">Numri i faturave</div><div className="text-2xl font-extrabold mt-2">{totalOrders}</div></div>
        <div className="stat-card"><div className="text-xs uppercase font-mono-pd text-slate-500">Stok i ulët</div><div className="text-2xl font-extrabold text-amber-400 mt-2">{lowStock.length}</div></div>
      </div>

      <div className="stat-card mb-6">
        <h3 className="text-lg font-bold mb-4">Shitjet ditore (30 ditët e fundit)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#233044" />
              <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#64748B" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0B0F17", border: "1px solid #233044" }} />
              <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="text-lg font-bold mb-4">Top 10 produktet më të shitura</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical">
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="product_name" stroke="#94A3B8" width={120} fontSize={11} />
                <Tooltip contentStyle={{ background: "#0B0F17", border: "1px solid #233044" }} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="text-lg font-bold mb-4">Produkte në stok të ulët</h3>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.brand || "—"}</div></div>
                <div className="text-right"><div className="text-amber-400 font-mono-pd font-bold">{p.quantity}</div><div className="text-[10px] text-slate-500">min: {p.low_stock_threshold}</div></div>
              </div>
            ))}
            {lowStock.length === 0 && <div className="text-slate-500 text-sm text-center py-6">Të gjitha stokun e kanë në rregull.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
