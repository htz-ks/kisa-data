import { useEffect, useMemo, useRef, useState } from "react";
import api, { eur, API, formatApiErrorDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, Smartphone, Box, Download, ScanLine, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import PrintMenu from "@/components/PrintMenu";

export default function POSPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState(0);
  const [imeiFor, setImeiFor] = useState(null); // product object
  const [doneSale, setDoneSale] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchRef = useRef(null);

  const load = async () => {
    const [p, c] = await Promise.all([api.get("/products"), api.get("/customers")]);
    setProducts(p.data);
    setCustomers(c.data);
  };
  useEffect(() => { load(); }, []);

  // Keyboard shortcut: F2 or "/" focuses search; "s" opens scanner
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (!typing && e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (!typing && (e.key === "s" || e.key === "S")) { e.preventDefault(); setScannerOpen(true); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleBarcodeDetected = (code) => {
    setScannerOpen(false);
    // 1. Try accessory/phone by barcode
    const byBarcode = products.find((p) => p.barcode && p.barcode === code);
    if (byBarcode) {
      addToCart(byBarcode);
      toast.success(`U shtua: ${byBarcode.name}`);
      return;
    }
    // 2. Try phone by IMEI
    const phoneByImei = products.find((p) =>
      (p.imeis || []).some((x) => x.imei === code && x.status === "in_stock")
    );
    if (phoneByImei) {
      setCart((prev) => [...prev, { product_id: phoneByImei.id, name: phoneByImei.name, type: "phone", imei: code, quantity: 1, sale_price: phoneByImei.sale_price }]);
      toast.success(`Telefon u shtua: ${phoneByImei.name}`);
      return;
    }
    toast.error(`Barkodi "${code}" nuk u gjet`);
    setQ(code);
  };

  const filtered = products.filter((p) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return p.name.toLowerCase().includes(needle)
      || (p.brand || "").toLowerCase().includes(needle)
      || (p.barcode || "").includes(q)
      || (p.imeis || []).some((x) => x.imei?.includes(q));
  });

  const addToCart = (p) => {
    if (p.type === "phone") {
      setImeiFor(p);
      return;
    }
    if (p.quantity <= 0) {
      toast.error("Nuk ka stok");
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((x) => x.product_id === p.id && !x.imei);
      if (i >= 0) {
        const next = [...prev];
        if (next[i].quantity + 1 > p.quantity) {
          toast.error("Nuk ka më stok");
          return prev;
        }
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { product_id: p.id, name: p.name, type: "accessory", quantity: 1, sale_price: p.sale_price }];
    });
  };

  const pickImei = (imei) => {
    const p = imeiFor;
    setCart((prev) => [...prev, { product_id: p.id, name: p.name, type: "phone", imei, quantity: 1, sale_price: p.sale_price }]);
    setImeiFor(null);
  };

  const removeAt = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const changeQty = (idx, delta) => {
    setCart((prev) => {
      const next = [...prev];
      const item = { ...next[idx] };
      if (item.type === "phone") return prev; // phones are quantity 1
      item.quantity = Math.max(1, item.quantity + delta);
      const prod = products.find((p) => p.id === item.product_id);
      if (prod && item.quantity > prod.quantity) {
        toast.error("Nuk ka më stok");
        return prev;
      }
      next[idx] = item;
      return next;
    });
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.sale_price * i.quantity, 0), [cart]);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error("Shporta është bosh");
      return;
    }
    try {
      const payload = {
        customer_id: customerId || "",
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          sale_price: i.sale_price,
          imei: i.imei || null,
        })),
        discount: Number(discount || 0),
        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : total,
        payment_method: paymentMethod,
      };
      const { data } = await api.post("/sales", payload);
      toast.success(`Fatura ${data.invoice_no} u krijua`);
      setDoneSale(data);
      setCart([]);
      setCustomerId("");
      setPaid("");
      setDiscount(0);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gabim");
    }
  };

  const downloadInvoice = (sid) => {
    const url = `${API}/sales/${sid}/invoice.pdf`;
    window.open(url, "_blank");
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <PageHeader title="POS — Shitje e re" subtitle="F2 ose / për të kërkuar · S për skanim" testid="pos-header" />

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Products grid */}
        <div className="lg:col-span-3">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Kërko emër / markë / barkod / IMEI…"
                className="pl-10 h-11 bg-slate-900/50 border-slate-800" data-testid="pos-search-input" />
            </div>
            <Button variant="outline" onClick={() => setScannerOpen(true)}
              className="h-11 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              data-testid="pos-scan-btn">
              <ScanLine className="w-4 h-4 mr-1" /> Skano
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="pos-products-grid">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)}
                disabled={p.quantity <= 0}
                data-testid={`pos-product-${p.id}`}
                className="text-left stat-card p-4 hover:border-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed">
                <div className="flex items-center justify-between mb-2">
                  {p.type === "phone"
                    ? <Smartphone className="w-4 h-4 text-indigo-400" />
                    : <Box className="w-4 h-4 text-emerald-400" />}
                  <span className={`text-xs font-mono-pd ${p.quantity <= 2 ? "text-red-400" : "text-slate-500"}`}>
                    {p.quantity} në stok
                  </span>
                </div>
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs text-slate-500">{p.brand || "—"}</div>
                <div className="mt-3 text-emerald-400 font-bold">{eur(p.sale_price)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-slate-500 text-sm py-10 text-center">Asnjë produkt.</div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="lg:col-span-2">
          <div className="stat-card p-5 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Shporta
              </h3>
              <Badge variant="outline" className="font-mono-pd">{cart.length} artikuj</Badge>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-4" data-testid="pos-cart-list">
              {cart.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800" data-testid={`cart-item-${idx}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    {i.imei && <div className="imei-badge mt-0.5">{i.imei}</div>}
                    <div className="text-xs text-slate-500 mt-1">{eur(i.sale_price)} × {i.quantity} = <span className="text-emerald-400">{eur(i.sale_price * i.quantity)}</span></div>
                  </div>
                  {i.type !== "phone" && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => changeQty(idx, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="font-mono-pd text-xs w-5 text-center">{i.quantity}</span>
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => changeQty(idx, 1)}><Plus className="w-3 h-3" /></Button>
                    </div>
                  )}
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-red-400" onClick={() => removeAt(idx)} data-testid={`cart-remove-${idx}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {cart.length === 0 && <div className="text-slate-500 text-sm text-center py-6">Shporta është bosh</div>}
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div>
                <Label className="text-xs">Klienti (opsionale)</Label>
                <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1 bg-slate-900 border-slate-800 h-9" data-testid="pos-customer-select">
                    <SelectValue placeholder="Klient i rastit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Klient i rastit —</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Zbritje €</Label>
                  <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 h-9 bg-slate-900 border-slate-800" data-testid="pos-discount-input" />
                </div>
                <div>
                  <Label className="text-xs">Pagesa</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1 bg-slate-900 border-slate-800 h-9" data-testid="pos-payment-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Kartë</SelectItem>
                      <SelectItem value="debt">Kredi / Borxh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {paymentMethod === "debt" && (
                <div>
                  <Label className="text-xs">Paguar tani € (pjesor)</Label>
                  <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)}
                    placeholder="0.00" className="mt-1 h-9 bg-slate-900 border-slate-800" data-testid="pos-paid-input" />
                </div>
              )}

              <div className="space-y-1 border-t border-slate-800 pt-3">
                <div className="flex justify-between text-xs text-slate-400"><span>Nëntotali</span><span className="font-mono-pd">{eur(subtotal)}</span></div>
                <div className="flex justify-between text-xs text-slate-400"><span>Zbritja</span><span className="font-mono-pd">-{eur(discount)}</span></div>
                <div className="flex justify-between text-base font-bold pt-1"><span>TOTALI</span><span className="text-emerald-400 font-mono-pd" data-testid="pos-total">{eur(total)}</span></div>
              </div>

              <Button onClick={checkout} disabled={cart.length === 0}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold text-base"
                data-testid="pos-checkout-btn">
                Përfundo shitjen
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* IMEI selection dialog */}
      <Dialog open={!!imeiFor} onOpenChange={(v) => !v && setImeiFor(null)}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader>
            <DialogTitle>Zgjidh IMEI për {imeiFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {(imeiFor?.imeis || []).filter((x) => x.status === "in_stock").map((x) => (
              <button key={x.imei} onClick={() => pickImei(x.imei)}
                className="w-full text-left p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 font-mono-pd text-sm"
                data-testid={`imei-pick-${x.imei}`}>
                {x.imei}
              </button>
            ))}
            {(imeiFor?.imeis || []).filter((x) => x.status === "in_stock").length === 0 && (
              <div className="text-slate-500 text-sm">Nuk ka IMEI në stok.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={!!doneSale} onOpenChange={(v) => !v && setDoneSale(null)}>
        <DialogContent className="bg-[#141C2B] border-slate-800">
          <DialogHeader>
            <DialogTitle>Shitja u ruajt me sukses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm">Fatura: <span className="font-mono-pd text-emerald-400">{doneSale?.invoice_no}</span></div>
            <div className="text-sm">Totali: <span className="font-mono-pd">{eur(doneSale?.total)}</span></div>
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold"
              onClick={() => downloadInvoice(doneSale.id)} data-testid="pos-download-invoice-btn">
              <Download className="w-4 h-4 mr-2" /> Shkarko Faturën PDF
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => window.open(`/print/sale/${doneSale.id}?format=a4`, "_blank", "width=900,height=1000")}
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10" data-testid="pos-print-a4-btn">
                <Printer className="w-3.5 h-3.5 mr-1" /> A4
              </Button>
              <Button variant="outline" onClick={() => window.open(`/print/sale/${doneSale.id}?format=80`, "_blank", "width=420,height=640")}
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10" data-testid="pos-print-80-btn">
                <Printer className="w-3.5 h-3.5 mr-1" /> 80mm
              </Button>
              <Button variant="outline" onClick={() => window.open(`/print/sale/${doneSale.id}?format=58`, "_blank", "width=360,height=640")}
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10" data-testid="pos-print-58-btn">
                <Printer className="w-3.5 h-3.5 mr-1" /> 58mm
              </Button>
            </div>
            {(() => {
              const cust = customers.find((c) => c.id === doneSale?.customer_id);
              const phone = (cust?.phone || "").replace(/[^0-9+]/g, "");
              const msg = encodeURIComponent(
                `Përshëndetje${cust ? " " + cust.name : ""}! Faleminderit për blerjen.\n\nFatura: ${doneSale?.invoice_no}\nTotali: € ${(doneSale?.total || 0).toFixed(2)}\nPaguar: € ${(doneSale?.paid_amount || 0).toFixed(2)}\nBorxh: € ${(doneSale?.due_amount || 0).toFixed(2)}\n\nKisa-Data`
              );
              const href = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
              return (
                <Button variant="outline" className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10"
                  onClick={() => window.open(href, "_blank")} data-testid="pos-whatsapp-btn">
                  <MessageCircle className="w-4 h-4 mr-2" /> Dërgo në WhatsApp
                </Button>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleBarcodeDetected} />
    </div>
  );
}
