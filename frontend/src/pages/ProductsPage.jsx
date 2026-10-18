import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Smartphone, Box } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const EMPTY = {
  name: "", type: "accessory", brand: "", category_id: "", barcode: "",
  cost_price: 0, sale_price: 0, quantity: 0, low_stock_threshold: 2, warranty_months: 12, imeis: [], description: "",
};

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [imeiInput, setImeiInput] = useState("");
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();

  // Auto-open create dialog when navigated via ?new=1
  useEffect(() => {
    if (sp.get("new") === "1" && isAdmin) {
      setForm(EMPTY);
      setEditId(null);
      setImeiInput("");
      setOpen(true);
      // clean up the URL param so refresh doesn't re-open
      navigate("/products", { replace: true });
    }
  }, [sp, isAdmin, navigate]);

  const load = async () => {
    const [p, c] = await Promise.all([api.get("/products"), api.get("/categories")]);
    setProducts(p.data);
    setCategories(c.data);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(EMPTY);
    setEditId(null);
    setImeiInput("");
    setOpen(true);
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || "",
      type: p.type || "accessory",
      brand: p.brand || "",
      category_id: p.category_id || "",
      barcode: p.barcode || "",
      cost_price: p.cost_price || 0,
      sale_price: p.sale_price || 0,
      quantity: p.quantity || 0,
      low_stock_threshold: p.low_stock_threshold || 2,
      warranty_months: p.warranty_months ?? 12,
      imeis: [],
      description: p.description || "",
    });
    setEditId(p.id);
    setOpen(true);
  };

  const save = async () => {
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        quantity: Number(form.quantity) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        warranty_months: Number(form.warranty_months) || 0,
      };
      if (editId) {
        delete payload.imeis;
        delete payload.type;
        await api.put(`/products/${editId}`, payload);
        toast.success("Produkti u përditësua");
      } else {
        await api.post("/products", payload);
        toast.success("Produkti u shtua");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gabim");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Sigurt që dëshiron ta fshish këtë produkt?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Produkti u fshi");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const addImei = () => {
    const v = imeiInput.trim();
    if (!v) return;
    setForm((f) => ({ ...f, imeis: [...f.imeis, v] }));
    setImeiInput("");
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
              <th className="px-4 py-3">Produkt</th>
              <th className="px-4 py-3">Lloji</th>
              <th className="px-4 py-3">Markë</th>
              <th className="px-4 py-3 text-right">Blerje</th>
              <th className="px-4 py-3 text-right">Shitje</th>
              <th className="px-4 py-3 text-right">Stok</th>
              {isAdmin && <th className="px-4 py-3 text-right">Veprime</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30" data-testid={`product-row-${p.id}`}>
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
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)} data-testid={`product-edit-${p.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => del(p.id)} className="text-red-400 hover:text-red-300" data-testid={`product-delete-${p.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center text-slate-500">
                {hasFilter ? "Nuk u gjet asnjë produkt që përputhet." : `Fillo të shkruash për të kërkuar nga ${products.length} produkte, ose zgjidh një filtër.`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#141C2B] border-slate-800">
          <DialogHeader>
            <DialogTitle>{editId ? "Edito produktin" : "Shto produkt të ri"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Emri *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" data-testid="product-name-input" />
            </div>
            <div>
              <Label>Lloji *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={!!editId}>
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-800" data-testid="product-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Telefon (me IMEI)</SelectItem>
                  <SelectItem value="accessory">Aksesor (sasi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Markë</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" data-testid="product-brand-input" />
            </div>
            <div>
              <Label>Kategoria</Label>
              <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1 bg-slate-900 border-slate-800" data-testid="product-category-select">
                  <SelectValue placeholder="Zgjidh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pa kategori —</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Barkod</Label>
              <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800 font-mono-pd" data-testid="product-barcode-input" />
            </div>
            <div>
              <Label>Çmim blerje (€)</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" data-testid="product-cost-input" />
            </div>
            <div>
              <Label>Çmim shitje (€)</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" data-testid="product-price-input" />
            </div>
            {form.type === "accessory" && (
              <div>
                <Label>Sasia</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="mt-1 bg-slate-900 border-slate-800" data-testid="product-quantity-input" />
              </div>
            )}
            <div>
              <Label>Alarm stok i ulët</Label>
              <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" data-testid="product-threshold-input" />
            </div>
            {form.type === "phone" && (
              <div>
                <Label>Garanci (muaj)</Label>
                <Input type="number" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
                  className="mt-1 bg-slate-900 border-slate-800" data-testid="product-warranty-input" />
              </div>
            )}

            {form.type === "phone" && !editId && (
              <div className="col-span-2">
                <Label>Shto IMEI (opsionale, mund t'i shtosh me blerje)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={imeiInput} onChange={(e) => setImeiInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImei())}
                    placeholder="Shtyp IMEI dhe Enter"
                    className="bg-slate-900 border-slate-800 font-mono-pd" data-testid="product-imei-input" />
                  <Button type="button" onClick={addImei} variant="outline" data-testid="product-imei-add-btn">Shto</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.imeis.map((im, i) => (
                    <span key={i} className="imei-badge" data-testid={`imei-badge-${i}`}>
                      {im}
                      <button type="button" onClick={() => setForm({ ...form, imeis: form.imeis.filter((_, j) => j !== i) })} className="ml-1 text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="col-span-2">
              <Label>Përshkrim</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 bg-slate-900 border-slate-800" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="product-save-btn">
              Ruaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
