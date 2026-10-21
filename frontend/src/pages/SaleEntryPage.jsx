import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Save, X, RefreshCw, ScanLine, UserPlus, Printer, ShoppingBag, Undo2, Banknote, List, Warehouse, CreditCard, IdCard, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ProductFormDialog, EMPTY_PRODUCT } from "@/components/ProductFormDialog";
import { ProductCombobox } from "@/components/ProductCombobox";
import { WarrantyPicker } from "@/components/WarrantyPicker";
import { WarrantyTermsBox } from "@/components/WarrantyTermsBox";
import BarcodeScanner from "@/components/BarcodeScanner";
import { QuickCustomerDialog } from "@/components/QuickCustomerDialog";

export const DRAFT_KEY = "sale-draft";
const TODAY = () => new Date().toISOString().slice(0, 10);

function emptyRow() {
  return { product_id: "", _code: "", _barcode: "", _name: "", quantity: 1, unit: "copë", sale_price: 0, discount: 0, imei: "", _type: "accessory" };
}

/**
 * Prodata-style "Shitja vendore (I ri)" document entry.
 */
export default function SaleEntryPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [docDate, setDocDate] = useState(TODAY());
  const [dueDate, setDueDate] = useState(TODAY());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [priceMode, setPriceMode] = useState("retail"); // retail | wholesale
  const [paid, setPaid] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [newForRow, setNewForRow] = useState(null);
  const [scanRow, setScanRow] = useState(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [warranty, setWarranty] = useState(null);
  const [terms, setTerms] = useState("");
  useEffect(() => { api.get("/settings/warranty-terms").then(({ data }) => setTerms(data.text)); }, []);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const load = async () => {
    const [c, p] = await Promise.all([api.get("/customers"), api.get("/products")]);
    setCustomers(c.data);
    setProducts(p.data);
  };
  useEffect(() => { load(); }, []);

  // keep the unsaved sale while visiting other pages; restored when coming back
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(DRAFT_KEY);
    window.dispatchEvent(new Event("sale-draft"));
    const d = JSON.parse(raw);
    setCustomerId(d.customerId); setDocDate(d.docDate); setDueDate(d.dueDate); setPaymentMethod(d.paymentMethod);
    setPriceMode(d.priceMode); setPaid(d.paid); setRows(d.rows); setNotes(d.notes); setWarranty(d.warranty);
  }, []);
  const goTo = (path) => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ customerId, docDate, dueDate, paymentMethod, priceMode, paid, rows, notes, warranty }));
    window.dispatchEvent(new Event("sale-draft"));
    navigate(path);
  };


  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, patch) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));

  const applyProduct = (i, prod, wantedImei = "") => {
    if (!prod) { updateRow(i, { product_id: "", _code: "", _barcode: "", _name: "", sale_price: 0, _type: "accessory", imei: "" }); return; }
    const price = priceMode === "wholesale" && prod.wholesale_price > 0 ? prod.wholesale_price : prod.sale_price;
    // auto-pick IMEI: scanned one, else first in-stock IMEI not used in another row
    const used = new Set(rows.filter((_, idx) => idx !== i).map((r) => r.imei).filter(Boolean));
    const imei = prod.type === "phone"
      ? wantedImei || ((prod.imeis || []).find((x) => x.status === "in_stock" && !used.has(x.imei))?.imei || "")
      : "";
    updateRow(i, {
      product_id: prod.id,
      _code: prod.code || prod.barcode || "",
      _barcode: prod.barcode || "",
      _name: prod.name,
      sale_price: price,
      quantity: prod.type === "phone" ? 1 : 1,
      _type: prod.type,
      imei,
    });
  };

  const findByCode = (i) => {
    const q = (rows[i]._code || "").trim().toLowerCase();
    if (!q) return;
    const prod = products.find((p) => (p.code || "").toLowerCase() === q || (p.barcode || "").toLowerCase() === q);
    if (prod) applyProduct(i, prod);
    else if (rows[i].product_id) return;
    else toast.error(`Nuk u gjet artikull me shifrën "${rows[i]._code}"`);
  };

  // Scan barcode (or phone IMEI) -> fill row, then add & focus a new empty row
  const scanBarcode = (i, raw) => {
    const q = (raw ?? rows[i]._barcode ?? "").trim();
    if (!q) return;
    let prod = products.find((p) => (p.barcode || "").toLowerCase() === q.toLowerCase());
    let imei = "";
    if (!prod) {
      prod = products.find((p) => (p.imeis || []).some((x) => x.imei === q && x.status === "in_stock"));
      if (prod) imei = q;
    }
    if (!prod) { toast.error(`Nuk u gjet artikull me barkodin "${q}"`); return; }
    applyProduct(i, prod, imei);
    if (i === rows.length - 1) {
      setRows((r) => [...r, emptyRow()]);
      setTimeout(() => document.querySelector(`[data-testid="sale-barcode-input-${i + 1}"]`)?.focus(), 50);
    }
  };

  const onProductCreated = async (prod) => {
    const p = await api.get("/products");
    setProducts(p.data);
    if (newForRow !== null) applyProduct(newForRow, prod);
    setNewForRow(null);
  };

  // when price mode changes, repick prices on existing rows
  useEffect(() => {
    setRows((rs) => rs.map((r) => {
      if (!r.product_id) return r;
      const p = products.find((x) => x.id === r.product_id);
      if (!p) return r;
      const price = priceMode === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sale_price;
      return { ...r, sale_price: price };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode]);

  const lineTotal = (r) => (Number(r.sale_price) || 0) * (Number(r.quantity) || 0) - (Number(r.discount) || 0);
  const subtotal = useMemo(() => rows.reduce((s, r) => s + lineTotal(r), 0), [rows]);
  const total = subtotal;

  const save = async (print = false) => {
    const items = rows.filter((r) => r.product_id).map((r) => ({
      product_id: r.product_id,
      quantity: Number(r.quantity) || 1,
      sale_price: Number(r.sale_price) || 0,
      imei: r.imei || null,
    }));
    if (items.length === 0) { toast.error("Shto të paktën një artikull"); return; }
    const phoneRows = rows.filter((r) => r.product_id && r._type === "phone");
    const missing = phoneRows.find((r) => !(r.imei || "").trim());
    if (missing) { toast.error(`Shkruaj IMEI për ${missing._name}`); return; }
    const imeiList = phoneRows.map((r) => r.imei.trim());
    const dup = imeiList.find((x, k) => imeiList.indexOf(x) !== k);
    if (dup) { toast.error(`IMEI ${dup} është vendosur dy herë`); return; }
    const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId || "",
        items,
        discount: totalDiscount,
        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : total,
        payment_method: paymentMethod,
        document_date: docDate,
        due_date: dueDate,
        notes,
        warranty_months: warranty?.unit === "muaj" ? warranty.n : null,
        warranty_days: warranty?.unit === "ditë" ? warranty.n : warranty ? null : 0,
        price_mode: priceMode,
        warranty_terms: priceMode === "retail" ? terms : "",
      };
      const { data } = await api.post("/sales", payload);
      toast.success(`Fatura ${data.invoice_no} u ruajt`);
      navigate(print ? `/print/sale/${data.id}?format=a4&auto=1` : "/sales");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  // style helpers for the Prodata-like look
  const field = "h-9 bg-slate-50 border-slate-300 text-slate-900 focus-visible:ring-emerald-500";
  const label = "text-xs text-slate-600 font-medium";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6" data-testid="sale-entry-page">
      <div className="max-w-[1400px] mx-auto bg-white border border-slate-300 rounded-lg shadow-sm">
        {/* Title bar */}
        <div className="border-b border-slate-300 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 rounded-t-lg">
          <h1 className="text-xl font-bold text-slate-900">Shitja vendore <span className="text-emerald-600 font-normal">(I ri)</span></h1>
          <div className="flex flex-wrap items-center md:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/sales")} data-testid="sale-cancel-btn"><X className="w-4 h-4 mr-1" /> Anulo</Button>
            <Button size="sm" onClick={() => save(false)} disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold" data-testid="sale-save-btn">
              <Save className="w-4 h-4 mr-1" /> Ruaj
            </Button>
            <div className="hidden md:block w-px h-7 bg-slate-300 mx-1" />
            <Button size="sm" onClick={() => save(true)} disabled={saving}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold" data-testid="sale-save-print-btn">
              <Printer className="w-4 h-4 mr-1" /> Ruaj & Printo A4
            </Button>
            {isAdmin && (
              <>
                <div className="hidden md:block w-px h-7 bg-slate-300 mx-1" />
                <Button size="sm" variant="outline" onClick={() => goTo("/daily-flow")} className="border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-semibold" data-testid="sale-goto-daily-flow-btn">
                  <CalendarDays className="w-4 h-4 mr-1" /> Qarkullimet Ditore
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/products")} className="border-sky-400 text-sky-700 hover:bg-sky-50" data-testid="sale-goto-products-btn">
                  <List className="w-4 h-4 mr-1" /> Artikujt
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/stock")} className="border-emerald-400 text-emerald-700 hover:bg-emerald-50" data-testid="sale-goto-stock-btn">
                  <Warehouse className="w-4 h-4 mr-1" /> Stoku
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/payments")} className="border-orange-400 text-orange-700 hover:bg-orange-50" data-testid="sale-goto-debts-btn">
                  <CreditCard className="w-4 h-4 mr-1" /> Borxhet
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/customer-cards")} className="border-teal-400 text-teal-700 hover:bg-teal-50" data-testid="sale-goto-customer-cards-btn">
                  <IdCard className="w-4 h-4 mr-1" /> Kartela e blerësve
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/supplier-cards")} className="border-indigo-400 text-indigo-700 hover:bg-indigo-50" data-testid="sale-goto-supplier-cards-btn">
                  <IdCard className="w-4 h-4 mr-1" /> Kartela e furnitorëve
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/purchases?new=1")} className="border-violet-400 text-violet-700 hover:bg-violet-50" data-testid="sale-goto-purchase-btn">
                  <ShoppingBag className="w-4 h-4 mr-1" /> Blerja
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/returns?new=1")} className="border-amber-400 text-amber-700 hover:bg-amber-50" data-testid="sale-goto-return-btn">
                  <Undo2 className="w-4 h-4 mr-1" /> Kthimi i produktit
                </Button>
                <Button size="sm" variant="outline" onClick={() => goTo("/expenses?new=1")} className="border-rose-400 text-rose-700 hover:bg-rose-50" data-testid="sale-goto-expense-btn">
                  <Banknote className="w-4 h-4 mr-1" /> Shpenzimet
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Buyer + header fields */}
        <div className="border border-slate-200 m-5 p-4 rounded">
          <div className={label + " mb-2"}>Blerësi:</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <Label className={label}>Blerësi</Label>
              <div className="mt-1 flex gap-1">
                <Select value={customerId || "none"} onValueChange={(v) => {
                  if (v === "__new__") { setNewCustomer(true); return; }
                  setCustomerId(v === "none" ? "" : v);
                }}>
                  <SelectTrigger className={`${field} flex-1`} data-testid="sale-buyer-select">
                    <SelectValue placeholder="Zgjidh blerësin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <SelectItem value="__new__" className="text-emerald-700 font-semibold" data-testid="sale-buyer-new-option">+ Shto klient të ri</SelectItem>
                    <SelectItem value="none">— Qytetar —</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="h-9 px-3 border-emerald-500 text-emerald-700 hover:bg-emerald-50" onClick={() => setNewCustomer(true)}
                  title="Shto klient të ri" data-testid="sale-add-customer-btn">
                  <UserPlus className="w-4 h-4 mr-1" /> Shto klient
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={load} title="Rifresko"><RefreshCw className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Çmimorja</Label>
              <Select value={priceMode} onValueChange={setPriceMode}>
                <SelectTrigger className={field + " mt-1"} data-testid="sale-pricemode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Me pakicë</SelectItem>
                  <SelectItem value="wholesale">Me shumicë</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Mënyra pagesës</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className={field + " mt-1"} data-testid="sale-payment-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Kartë</SelectItem>
                  <SelectItem value="debt">Kredi / Borxh</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label className={label}>Data e dokumentit</Label>
              <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)}
                className={field + " mt-1"} data-testid="sale-docdate-input" />
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Data e skadencës</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className={field + " mt-1"} data-testid="sale-duedate-input" />
            </div>
            <div className="md:col-span-3">
              <Label className={label}>Garancioni</Label>
              <div className="mt-1"><WarrantyPicker value={warranty} onChange={setWarranty} /></div>
            </div>
            {paymentMethod === "debt" && (
              <div className="md:col-span-3">
                <Label className={label}>Paguar tani (€)</Label>
                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)}
                  className={field + " mt-1"} placeholder="0.00" data-testid="sale-paid-input" />
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="mx-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-slate-700">Artikujt</div>
            <Button size="sm" variant="outline" onClick={addRow} data-testid="sale-add-row-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Shto rresht</Button>
          </div>
          <div className="border border-slate-300 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 border-b border-slate-300">
                  <th className="px-2 py-2 text-left w-32">Shifra</th>
                  <th className="px-2 py-2 text-left w-52">Barkodi</th>
                  <th className="px-2 py-2 text-left">Përshkrimi</th>
                  <th className="px-2 py-2 text-right w-20">Stoku</th>
                  <th className="px-2 py-2 text-left w-48">IMEI</th>
                  <th className="px-2 py-2 text-right w-20">Sasia</th>
                  <th className="px-2 py-2 text-right w-28">Çmimi</th>
                  <th className="px-2 py-2 text-right w-24">Zbritja</th>
                  <th className="px-2 py-2 text-right w-28">Totali</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const prod = products.find((p) => p.id === r.product_id);
                  const availableImeis = (prod?.imeis || []).filter((x) => x.status === "in_stock" && !rows.some((o, k) => k !== i && o.imei === x.imei));
                  return (
                    <tr key={i} className="border-b border-slate-200" data-testid={`sale-row-${i}`}>
                      <td className="px-1 py-1">
                        <Input value={r._code} placeholder="Shifra / barkod"
                          onChange={(e) => updateRow(i, { _code: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findByCode(i); } }}
                          onBlur={() => findByCode(i)}
                          className="h-8 bg-white border-slate-300 text-xs font-mono" data-testid={`sale-code-input-${i}`} />
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex gap-1">
                          <Input value={r._barcode} placeholder="Skano barkodin"
                            onChange={(e) => updateRow(i, { _barcode: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scanBarcode(i); } }}
                            className="h-8 bg-white border-slate-300 text-xs font-mono" data-testid={`sale-barcode-input-${i}`} />
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Skano me kamerë"
                            onClick={() => setScanRow(i)} data-testid={`sale-barcode-camera-${i}`}>
                            <ScanLine className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-1 py-1">
<ProductCombobox products={products} value={r.product_id} testId={`sale-product-${i}`}
                          onPick={(p) => applyProduct(i, p)}
                          onCreate={isAdmin ? (name) => { setNewName(name); setNewForRow(i); } : null} />
                      </td>
                      <td className="px-1 py-1 text-right font-mono text-sm pr-2">
                        <span className={prod && prod.quantity <= (prod.low_stock_threshold || 2) ? "text-red-500" : "text-slate-700"}>
                          {prod ? prod.quantity : "—"}
                        </span>
                      </td>
                      <td className="px-1 py-1">
                        {r._type === "phone" ? (
                          <>
                            <Input value={r.imei} list={`imeis-${i}`} placeholder="Shkruaj / skano IMEI"
                              onChange={(e) => updateRow(i, { imei: e.target.value })}
                              className={`h-8 bg-white border-slate-300 text-xs font-mono ${r.product_id && !r.imei ? "border-red-400" : ""}`}
                              data-testid={`sale-imei-${i}`} />
                            <datalist id={`imeis-${i}`}>
                              {availableImeis.map((x) => <option key={x.imei} value={x.imei} />)}
                            </datalist>
                          </>
                        ) : (
                          <div className="h-8 flex items-center text-xs text-slate-400 px-2">—</div>
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" value={r.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })}
                          disabled={r._type === "phone"} className="h-8 text-right bg-white border-slate-300" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" value={r.sale_price} onChange={(e) => updateRow(i, { sale_price: e.target.value })}
                          className="h-8 text-right bg-white border-slate-300 font-mono" />
                      </td>
                      <td className="px-1 py-1">
                        <Input type="number" step="0.01" value={r.discount} onChange={(e) => updateRow(i, { discount: e.target.value })}
                          className="h-8 text-right bg-white border-slate-300 font-mono" />
                      </td>
                      <td className="px-1 py-1 text-right font-mono text-sm text-slate-900 pr-2">
                        {eur(lineTotal(r))}
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-red-500" onClick={() => removeRow(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals + notes */}
        <div className="grid md:grid-cols-2 gap-5 m-5">
          <div>
            <Label className={label}>Shënime</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={field + " mt-1"} />
            <WarrantyTermsBox terms={terms} setTerms={setTerms} retail={priceMode === "retail"} hasWarranty={!!warranty} isAdmin={isAdmin} />
          </div>
          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Nëntotali</span><span className="font-mono">{eur(subtotal)}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-300 text-lg font-bold">
                <span>TOTALI</span><span className="font-mono text-emerald-600" data-testid="sale-total">{eur(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <QuickCustomerDialog open={newCustomer} onOpenChange={setNewCustomer}
        onCreated={async (c) => { const r = await api.get("/customers"); setCustomers(r.data); setCustomerId(c.id); }} />
      <ProductFormDialog open={newForRow !== null} onOpenChange={(o) => !o && setNewForRow(null)} onSaved={onProductCreated}
        initial={{ ...EMPTY_PRODUCT, name: newName }} />
      <BarcodeScanner open={scanRow !== null} onClose={() => setScanRow(null)}
        onDetected={(text) => { const i = scanRow; setScanRow(null); updateRow(i, { _barcode: text }); scanBarcode(i, text); }} />
    </div>
  );
}
