import { useEffect, useMemo, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Headphones, Search, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ZakatSection } from "@/components/ZakatSection";

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [view, setView] = useState(null); // null | "phone" | "accessory"
  const [q, setQ] = useState("");
  const { user } = useAuth();

  useEffect(() => { api.get("/products").then(({ data }) => setProducts(data)); }, []);

  const list = useMemo(() => {
    if (!view) return [];
    return products
      .filter((p) => p.type === view)
      .filter((p) => !q
        || p.name?.toLowerCase().includes(q.toLowerCase())
        || (p.brand || "").toLowerCase().includes(q.toLowerCase())
        || (p.code || "").toLowerCase().includes(q.toLowerCase())
        || (p.barcode || "").includes(q));
  }, [products, view, q]);

  const totals = useMemo(() => {
    const units = list.reduce((s, p) => s + Number(p.quantity || 0), 0);
    const value = list.reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 0), 0);
    return { units, value };
  }, [list]);

  // --- Chooser screen ---
  if (!view) {
    const phoneValue = products.filter((p) => p.type === "phone").reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 0), 0);
    const accValue = products.filter((p) => p.type === "accessory").reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 0), 0);
    const totalValue = phoneValue + accValue;
    const totalUnits = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6" data-testid="stock-chooser">
        <div className="w-full max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-2 text-slate-900">Stoku</h1>
          <p className="text-center text-slate-500 mb-6 text-sm">Zgjidh kategorinë që dëshiron të shikosh</p>

          <div className="stat-card mb-8 flex items-center justify-between p-5" data-testid="stock-total-card">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono-pd text-slate-500">Vlera totale e stokut</div>
              <div className="text-3xl font-extrabold text-emerald-600 mt-1">{eur(totalValue)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest font-mono-pd text-slate-500">Njësi gjithsej</div>
              <div className="text-3xl font-extrabold text-slate-800 mt-1">{totalUnits}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setView("phone")}
              className="stat-card group p-10 text-left hover:border-indigo-500 hover:-translate-y-1 transition-all"
              data-testid="stock-pick-phones">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <Smartphone className="w-8 h-8 text-indigo-600" strokeWidth={2.2} />
              </div>
              <div className="mt-6">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">Telefona</div>
                <div className="text-sm text-slate-500 mt-1">Shiko stokun e telefonave me IMEI</div>
              </div>
            </button>

            <button onClick={() => setView("accessory")}
              className="stat-card group p-10 text-left hover:border-emerald-500 hover:-translate-y-1 transition-all"
              data-testid="stock-pick-accessories">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <Headphones className="w-8 h-8 text-emerald-600" strokeWidth={2.2} />
              </div>
              <div className="mt-6">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">Aksesorë</div>
                <div className="text-sm text-slate-500 mt-1">Shiko stokun e aksesorëve dhe sasive</div>
              </div>
            </button>
          </div>
          {user?.role === "admin" && <ZakatSection stockCost={totalValue} />}
        </div>
      </div>
    );
  }

  // --- Detail screen ---
  const isPhone = view === "phone";
  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setView(null); setQ(""); }} data-testid="stock-back-btn">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-900">
              {isPhone ? <Smartphone className="w-7 h-7 text-indigo-600" /> : <Headphones className="w-7 h-7 text-emerald-600" />}
              Stoku · {isPhone ? "Telefona" : "Aksesorë"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {totals.units} njësi · vlera {eur(totals.value)}
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Kërko…" className="pl-10" data-testid="stock-search-input" />
        </div>
      </div>

      <div className="data-grid">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-24">Shifra</th>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Markë</th>
              {isPhone && <th className="px-4 py-3">Specifikat</th>}
              <th className="px-4 py-3 text-right">Çmim blerje</th>
              <th className="px-4 py-3 text-right">Çmim shitje</th>
              <th className="px-4 py-3 text-right">Stoku</th>
              <th className="px-4 py-3 text-right">Vlera</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const qty = Number(p.quantity || 0);
              const alarm = Number(p.low_stock_threshold || 2);
              const value = qty * Number(p.cost_price || 0);
              const stockColor = qty <= 0 ? "text-red-500" : qty <= alarm ? "text-amber-600" : "text-emerald-600";
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`stock-row-${p.id}`}>
                  <td className="px-4 py-3 font-mono-pd text-xs text-indigo-500">{p.code || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.barcode && <div className="text-xs text-slate-500 font-mono-pd">{p.barcode}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.brand || "—"}</td>
                  {isPhone && (
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {p.gb && <Badge variant="outline" className="border-slate-300 text-slate-600 font-mono-pd">{p.gb}GB</Badge>}
                        {p.ram && <Badge variant="outline" className="border-slate-300 text-slate-600 font-mono-pd">RAM {p.ram}</Badge>}
                        {p.battery_percent && <Badge variant="outline" className="border-slate-300 text-slate-600 font-mono-pd">Bat {p.battery_percent}%</Badge>}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono-pd text-slate-700">{eur(p.cost_price)}</td>
                  <td className="px-4 py-3 text-right font-mono-pd text-emerald-700">{eur(p.sale_price)}</td>
                  <td className={`px-4 py-3 text-right font-mono-pd font-bold ${stockColor}`}>{qty}</td>
                  <td className="px-4 py-3 text-right font-mono-pd font-semibold">{eur(value)}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={isPhone ? 8 : 7} className="px-4 py-16 text-center text-slate-500">
                {q ? "Nuk u gjet asnjë produkt që përputhet." : `Nuk ka ${isPhone ? "telefona" : "aksesorë"} në stok.`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
