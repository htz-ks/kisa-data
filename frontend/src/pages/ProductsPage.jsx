import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Smartphone, Box, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ProductFormDialog, EMPTY_PRODUCT as EMPTY } from "@/components/ProductFormDialog";

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();

  // Auto-open create dialog when navigated via ?new=1
  useEffect(() => {
    if (sp.get("new") === "1" && isAdmin) {
      setForm(EMPTY);
      setEditId(null);
      setOpen(true);
      // clean up the URL param so refresh doesn't re-open
      navigate("/products", { replace: true });
    }
  }, [sp, isAdmin, navigate]);

  const load = async () => {
    const p = await api.get("/products");
    setProducts(p.data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || "",
      type: p.type || "accessory",
      brand: p.brand || "",
      barcode: p.barcode || "",
      cost_price: p.cost_price || 0,
      sale_price: p.sale_price || 0,
      wholesale_price: p.wholesale_price || 0,
      quantity: p.quantity || 0,
      low_stock_threshold: p.low_stock_threshold || 2,
      warranty_months: p.warranty_months ?? 12,
      gb: p.gb || "",
      ram: p.ram || "",
      battery_percent: p.battery_percent || "",
      imeis: [],
      description: p.description || "",
    });
    setEditId(p.id);
    setOpen(true);
  };


  const hasFilter = !!q.trim() || typeFilter !== "all";
  const filtered = !hasFilter ? [] : products.filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase())
      || (p.brand || "").toLowerCase().includes(q.toLowerCase())
      || (p.barcode || "").includes(q);
    const matchT = typeFilter === "all" || p.type === typeFilter;
    return matchQ && matchT;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Artikujt"
        subtitle="Telefona me IMEI dhe aksesorë në sasi"
        action={isAdmin && (
          <Button onClick={openCreate} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold"
            data-testid="product-create-btn">
            <Plus className="w-4 h-4 mr-1" /> Krijo Artikull
          </Button>
        )}
      />

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kërko produkt, markë, barkod…"
            className="pl-10 bg-slate-900/50 border-slate-800" data-testid="product-search-input" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="md:w-56 bg-slate-900/50 border-slate-800" data-testid="product-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Të gjitha</SelectItem>
            <SelectItem value="phone">Telefona</SelectItem>
            <SelectItem value="accessory">Aksesorë</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm" data-testid="products-table">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 w-24">Shifra</th>
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Lloji</th>
              <th className="px-4 py-3">Markë</th>
              <th className="px-4 py-3 text-right">Blerje</th>
              <th className="px-4 py-3 text-right">Shitje</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Veprime</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`product-row-${p.id}`}>
                <td className="px-4 py-3 font-mono-pd text-xs text-indigo-500">{p.code || "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  {p.barcode && <div className="text-xs text-slate-500 font-mono-pd">{p.barcode}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={p.type === "phone" ? "border-indigo-500/40 text-indigo-300" : "border-emerald-500/40 text-emerald-300"}>
                    {p.type === "phone" ? <Smartphone className="w-3 h-3 mr-1" /> : <Box className="w-3 h-3 mr-1" />}
                    {p.type === "phone" ? "Telefon" : "Aksesor"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-300">{p.brand || "—"}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-slate-400">{eur(p.cost_price)}</td>
                <td className="px-4 py-3 text-right font-mono-pd text-emerald-400">{eur(p.sale_price)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono-pd ${p.quantity <= (p.low_stock_threshold || 2) ? "text-red-400" : "text-slate-200"}`}>
                    {p.quantity}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => {
                      const copies = window.prompt("Sa etiketa të printohen?", "1");
                      if (!copies) return;
                      window.open(`/print/label/${p.id}?copies=${parseInt(copies, 10) || 1}`, "_blank", "width=520,height=640");
                    }} className="text-sky-500" data-testid={`product-label-${p.id}`} title="Printo etiketa">
                      <Tag className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} data-testid={`product-edit-${p.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => del(p.id)} className="text-red-400 hover:text-red-300" data-testid={`product-delete-${p.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
                {!isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => window.open(`/print/label/${p.id}?copies=1`, "_blank", "width=520,height=640")} className="text-sky-500" title="Printo etiketë">
                      <Tag className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                {hasFilter ? "Nuk u gjet asnjë produkt që përputhet." : `Fillo të shkruash për të kërkuar nga ${products.length} produkte, ose zgjidh një filtër.`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ProductFormDialog open={open} onOpenChange={setOpen} editId={editId} initial={form} onSaved={load} />
    </div>
  );
}
