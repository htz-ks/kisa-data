import { useEffect, useMemo, useState } from "react";
import api, { eur } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Boxes, AlertTriangle, Package, Search, Smartphone, Headphones } from "lucide-react";

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | low | zero | phone | accessory

  useEffect(() => { api.get("/products").then(({ data }) => setProducts(data)); }, []);

  const stats = useMemo(() => {
    let phoneValue = 0, phoneUnits = 0, accValue = 0, accUnits = 0, low = 0, zero = 0;
    products.forEach((p) => {
      const qty = Number(p.quantity || 0);
      const val = Number(p.cost_price || 0) * qty;
      if (p.type === "phone") { phoneUnits += qty; phoneValue += val; }
      else { accUnits += qty; accValue += val; }
      if (qty <= 0) zero++;
      else if (qty <= Number(p.low_stock_threshold || 2)) low++;
    });
    return { phoneValue, phoneUnits, accValue, accUnits, low, zero, totalValue: phoneValue + accValue };
  }, [products]);

  const filtered = products.filter((p) => {
    const matchQ = !q
      || p.name?.toLowerCase().includes(q.toLowerCase())
      || (p.brand || "").toLowerCase().includes(q.toLowerCase())
      || (p.code || "").toLowerCase().includes(q.toLowerCase())
      || (p.barcode || "").includes(q);
    if (!matchQ) return false;
    const qty = Number(p.quantity || 0);
    if (filter === "low") return qty > 0 && qty <= Number(p.low_stock_threshold || 2);
    if (filter === "zero") return qty <= 0;
    if (filter === "phone") return p.type === "phone";
    if (filter === "accessory") return p.type === "accessory";
    return true;
  });

  const StatCard = ({ icon: Icon, label, value, hint, color = "slate", active = false, onClick, tid }) => {
    const colors = {
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
      amber: "bg-amber-50 text-amber-700 border-amber-200",
      red: "bg-red-50 text-red-700 border-red-200",
      slate: "bg-slate-50 text-slate-700 border-slate-200",
    };
    const base = `stat-card text-left transition-all ${onClick ? "cursor-pointer hover:border-emerald-500 hover:-translate-y-0.5" : ""} ${active ? "ring-2 ring-emerald-500 border-emerald-500" : ""}`;
    const Comp = onClick ? "button" : "div";
    return (
      <Comp type={onClick ? "button" : undefined} onClick={onClick} className={base} data-testid={tid}>
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          {hint && <span className="text-[10px] uppercase font-mono-pd tracking-widest text-slate-500">{hint}</span>}
        </div>
        <div className="mt-4 text-2xl font-extrabold tracking-tight">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </Comp>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Stoku" subtitle="Pamje e përgjithshme e stokut dhe alarmet" testid="stock-header" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={Smartphone} label="Vlera Telefona" value={eur(stats.phoneValue)}
          hint={`${stats.phoneUnits} copë`} color="indigo"
          active={filter === "phone"}
          onClick={() => setFilter(filter === "phone" ? "all" : "phone")}
          tid="stock-card-phones" />
        <StatCard icon={Headphones} label="Vlera Aksesorë" value={eur(stats.accValue)}
          hint={`${stats.accUnits} copë`} color="emerald"
          active={filter === "accessory"}
          onClick={() => setFilter(filter === "accessory" ? "all" : "accessory")}
          tid="stock-card-accessories" />
        <StatCard icon={Boxes} label="Vlera totale" value={eur(stats.totalValue)} color="slate" />
        <StatCard icon={Package} label="Njësi gjithsej" value={stats.phoneUnits + stats.accUnits} color="slate" />
        <StatCard icon={AlertTriangle} label="Stok i ulët" value={stats.low} color="amber"
          active={filter === "low"} onClick={() => setFilter(filter === "low" ? "all" : "low")} tid="stock-card-low" />
        <StatCard icon={AlertTriangle} label="Pa stok" value={stats.zero} color="red"
          active={filter === "zero"} onClick={() => setFilter(filter === "zero" ? "all" : "zero")} tid="stock-card-zero" />
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kërko emër, markë, shifër, barkod…"
            className="pl-10" data-testid="stock-search-input" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="md:w-56" data-testid="stock-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Të gjitha</SelectItem>
            <SelectItem value="low">Stok i ulët</SelectItem>
            <SelectItem value="zero">Pa stok</SelectItem>
            <SelectItem value="phone">Vetëm telefona</SelectItem>
            <SelectItem value="accessory">Vetëm aksesorë</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="data-grid">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-24">Shifra</th>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Markë</th>
              <th className="px-4 py-3">Lloji</th>
              <th className="px-4 py-3 text-right">Çmim blerje</th>
              <th className="px-4 py-3 text-right">Çmim shitje</th>
              <th className="px-4 py-3 text-right">Stoku</th>
              <th className="px-4 py-3 text-right">Alarm</th>
              <th className="px-4 py-3 text-right">Vlera</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
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
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={p.type === "phone" ? "border-indigo-300 text-indigo-700" : "border-emerald-300 text-emerald-700"}>
                      {p.type === "phone" ? "Telefon" : "Aksesor"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-pd text-slate-700">{eur(p.cost_price)}</td>
                  <td className="px-4 py-3 text-right font-mono-pd text-emerald-700">{eur(p.sale_price)}</td>
                  <td className={`px-4 py-3 text-right font-mono-pd font-bold ${stockColor}`}>{qty}</td>
                  <td className="px-4 py-3 text-right font-mono-pd text-slate-500">{alarm}</td>
                  <td className="px-4 py-3 text-right font-mono-pd font-semibold">{eur(value)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-500">Nuk u gjet asnjë produkt.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
