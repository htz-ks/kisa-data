import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Truck, PackagePlus } from "lucide-react";
import { QuickCustomerDialog } from "@/components/QuickCustomerDialog";
import { ProductFormDialog, EMPTY_PRODUCT } from "@/components/ProductFormDialog";
import { ProductCombobox, norm } from "@/components/ProductCombobox";
import { toast } from "sonner";
import { CorrectButton } from "@/components/daybook/EntryEditDialog";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get("new") === "1");
  useEffect(() => { if (sp.get("new")) setSp({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [supplierId, setSupplierId] = useState("");
  const [sellerText, setSellerText] = useState("");
  const onSellerType = (v) => {
    setSellerText(v);
    const s = suppliers.find((x) => (x.name || "").trim().toLowerCase() === v.trim().toLowerCase());
    setSupplierId(s ? s.id : "");
  };
  const [paid, setPaid] = useState(0);
  const [items, setItems] = useState([{ product_id: "", quantity: 1, cost_price: 0, imeis: [], imeiInput: "" }]);
  const [notes, setNotes] = useState("");
  const [newSupplier, setNewSupplier] = useState(false);
  const [newProduct, setNewProduct] = useState(false);
  const [newName, setNewName] = useState("");

  const onSupplierCreated = async (sup) => {
    const { data } = await api.get("/suppliers");
    setSuppliers(data);
    setSupplierId(sup.id); setSellerText(sup.name || "");
  };
  // new article goes straight into this purchase (first empty row, or a new row)
  const onProductCreated = async (prod, imeis = []) => {
    const { data } = await api.get("/products");
    setProducts(data);
    const row = { product_id: prod.id, quantity: imeis.length || 1, cost_price: prod.cost_price || 0, imeis, imeiInput: "" };
    setItems((p) => {
      const empty = p.findIndex((i) => !i.product_id);
      return empty >= 0 ? p.map((it, i) => (i === empty ? row : it)) : [...p, row];
    });
  };

  const load = async () => {
    const [p, pr, s] = await Promise.all([api.get("/purchases"), api.get("/products"), api.get("/suppliers")]);
    setPurchases(p.data); setProducts(pr.data); setSuppliers(s.data);
  };
  useEffect(() => { load(); }, []);

  const total = items.reduce((s, i) => s + Number(i.cost_price || 0) * Number(i.quantity || 0), 0);

  const addRow = () => setItems((p) => [...p, { product_id: "", quantity: 1, cost_price: 0, imeis: [], imeiInput: "" }]);
  const updateRow = (idx, patch) => setItems((p) => p.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeRow = (idx) => setItems((p) => p.filter((_, i) => i !== idx));
  const addImeiToRow = (idx) => {
    const row = items[idx];
    const v = (row.imeiInput || "").trim();
    if (!v) return;
    updateRow(idx, { imeis: [...row.imeis, v], imeiInput: "" });
  };

  const save = async () => {
    try {
      const payload = {
        supplier_id: supplierId || "",
        seller_name: supplierId ? "" : sellerText.trim(),
        items: items.filter((i) => i.product_id).map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity) || 1,
          cost_price: Number(i.cost_price) || 0,
          imeis: i.imeis || [],
        })),
        paid_amount: Number(paid) || 0,
        notes,
      };
      if (payload.items.length === 0) {
        toast.error("Shto të paktën një artikull");
        return;
      }
      await api.post("/purchases", payload);
      toast.success("Blerja u ruajt");
      setOpen(false);
      setItems([{ product_id: "", quantity: 1, cost_price: 0, imeis: [], imeiInput: "" }]);
      setSupplierId(""); setSellerText(""); setPaid(0); setNotes("");
      await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Blerjet" subtitle="Hyrja e produkteve nga furnitorët dhe qytetarët"
        action={<Button onClick={() => setOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="purchase-create-btn"><Plus className="w-4 h-4 mr-1" /> Blerje e re</Button>} />

      <div className="data-grid bg-[#0D131E]">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500 font-mono-pd border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Furnitori / Qytetari</th>
              <th className="px-4 py-3">Artikuj</th>
              <th className="px-4 py-3 text-right">Totali</th>
              <th className="px-4 py-3 text-right">Paguar</th>
              <th className="px-4 py-3 text-right">Borxh</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const sup = suppliers.find((s) => s.id === p.supplier_id);
              return (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono-pd text-xs text-slate-400">{(p.created_at || "").slice(0, 10)}</td>
                  <td className="px-4 py-3">{p.citizen ? <span>{p.citizen.name} <span className="text-xs text-sky-400">(qytetar{p.citizen.personal_no ? ` · ${p.citizen.personal_no}` : ""})</span></span> : (sup?.name || "—")}</td>
                  <td className="px-4 py-3 text-slate-400">{p.items?.length || 0} artikuj</td>
                  <td className="px-4 py-3 text-right font-mono-pd">{eur(p.total)}</td>
                  <td className="px-4 py-3 text-right font-mono-pd text-emerald-400">{eur(p.paid_amount)}</td>
                  <td className="px-4 py-3 text-right font-mono-pd text-amber-400">{eur(p.due_amount)}</td>
                  <td className="px-2 py-2 text-right"><CorrectButton entryKey={`purchase:${p.id}`} /></td>
                </tr>
              );
            })}
            {purchases.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Pa blerje.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141C2B] border-slate-800 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Blerje e re</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Furnitori</Label>
<Input value={sellerText} onChange={(e) => onSellerType(e.target.value)} list="purchase-suppliers-list"
                  placeholder="Shkruaj ose zgjidh furnitorin / prej kujt e bleve" className="mt-1 bg-slate-900 border-slate-800" data-testid="purchase-supplier-select" />
                <datalist id="purchase-suppliers-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                <div className="text-[11px] mt-1 text-slate-500" data-testid="purchase-seller-hint">
                  {supplierId ? "Furnitor i regjistruar – borxhi shkon në kartelën e tij" : sellerText.trim() ? "Emër i shkruar manualisht (jo furnitor i regjistruar)" : "Pa furnitor"}
                </div>
              </div>
              <div>
                <Label>Paguar tani (€)</Label>
                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" data-testid="purchase-paid-input" />
              </div>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => {
                const prod = products.find((p) => p.id === it.product_id);
                return (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Label className="text-xs">Produkti</Label>
                        <div className="mt-1">
                          <ProductCombobox products={products} value={it.product_id} testId={`purchase-item-product-${idx}`}
                            onPick={(p) => updateRow(idx, { product_id: p.id, cost_price: p.cost_price || 0 })}
                            onEnter={(q) => {
                              const l = q.toLowerCase();
                              let p = products.find((x) => (x.barcode || "").toLowerCase() === l || (x.code || "").toLowerCase() === l);
                              if (!p) { const m = products.filter((x) => norm(x.name).includes(norm(q))); if (m.length === 1) p = m[0]; }
                              if (!p) return false;
                              updateRow(idx, { product_id: p.id, cost_price: p.cost_price || 0 });
                              return true;
                            }}
                            onCreate={(name) => { setNewName(name); setNewProduct(true); }} />
                        </div>
                      </div>
                      <div className="col-span-2"><Label className="text-xs">Sasia</Label><Input type="number" value={it.quantity} onChange={(e) => updateRow(idx, { quantity: e.target.value })} className="mt-1 h-9 bg-slate-900 border-slate-800" disabled={prod?.type === "phone"} /></div>
                      <div className="col-span-3"><Label className="text-xs">Çmim blerje (€)</Label><Input type="number" step="0.01" value={it.cost_price} onChange={(e) => updateRow(idx, { cost_price: e.target.value })} className="mt-1 h-9 bg-slate-900 border-slate-800" /></div>
                      <div className="col-span-2 text-right text-sm font-mono-pd text-emerald-400 pb-2">{eur(Number(it.cost_price || 0) * Number(it.quantity || 0))}</div>
                      <div className="col-span-12 flex justify-end"><Button variant="ghost" size="sm" onClick={() => removeRow(idx)} className="text-red-400"><Trash2 className="w-3.5 h-3.5" /></Button></div>
                    </div>
                    {prod?.type === "phone" && (
                      <div>
                        <Label className="text-xs">IMEI (për telefona)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input value={it.imeiInput} onChange={(e) => updateRow(idx, { imeiInput: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImeiToRow(idx))}
                            placeholder="IMEI dhe Enter" className="h-9 bg-slate-900 border-slate-800 font-mono-pd" />
                          <Button type="button" variant="outline" onClick={() => addImeiToRow(idx)}>+</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {it.imeis.map((im, i) => (
                            <span key={i} className="imei-badge">{im}<button onClick={() => updateRow(idx, { imeis: it.imeis.filter((_, j) => j !== i) })} className="ml-1 text-red-400">×</button></span>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Sasia përditësohet automatikisht nga numri i IMEI-ve.</div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={addRow} data-testid="purchase-add-row-btn"><Plus className="w-4 h-4 mr-1" /> Shto artikull</Button>
                <Button variant="outline" onClick={() => setNewSupplier(true)} className="border-violet-500/60 text-violet-300" data-testid="purchase-new-supplier-btn">
                  <Truck className="w-4 h-4 mr-1" /> Shto furnitor
                </Button>
                <Button variant="outline" onClick={() => setNewProduct(true)} className="border-emerald-500/60 text-emerald-300" data-testid="purchase-new-product-btn">
                  <PackagePlus className="w-4 h-4 mr-1" /> Krijo artikull
                </Button>
              </div>
            </div>

            <div><Label>Shënime</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" /></div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-sm text-slate-400">Totali</span>
              <span className="text-xl font-bold text-emerald-400 font-mono-pd">{eur(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
            <Button onClick={save} className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="purchase-save-btn">Ruaj Blerjen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickCustomerDialog kind="supplier" open={newSupplier} onOpenChange={setNewSupplier} onCreated={onSupplierCreated} />
      <ProductFormDialog catalogOnly open={newProduct} onOpenChange={(o) => { setNewProduct(o); if (!o) setNewName(""); }} onSaved={onProductCreated}
        initial={newName ? { ...EMPTY_PRODUCT, name: newName } : undefined} />
    </div>
  );
}
