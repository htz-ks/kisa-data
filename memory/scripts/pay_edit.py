import sys

base = "/app/frontend/src/"


def edit(p, pairs, extra_import=None):
    s = open(base + p).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    if extra_import:
        i = s.index("\n", s.rindex("\nimport "))
        s = s[:i] + "\n" + extra_import + s[i:]
    open(base + p, "w").write(s)


IMP = 'import { useRates, computeSplit, PaymentBreakdown } from "@/components/PaymentSplit";'

edit("pages/SaleEntryPage.jsx", [
    ('  const [paid, setPaid] = useState("");', '  const [paid, setPaid] = useState("");\n  const [cashAmount, setCashAmount] = useState("");\n  const rates = useRates();'),
    ("  const total = subtotal;", "  const total = subtotal;\n  const split = computeSplit(total, paymentMethod, cashAmount, rates);"),
    ("    const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);\n    setSaving(true);",
     '    const totalDiscount = rows.reduce((s, r) => s + (Number(r.discount) || 0), 0);\n    if (!split.valid) { toast.error("Shuma Cash duhet të jetë më e madhe se 0 dhe më e vogël se çmimi normal"); return; }\n    setSaving(true);'),
    ('        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : total,\n        payment_method: paymentMethod,\n        document_date: docDate,',
     '        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : split.final,\n        payment_method: paymentMethod,\n        cash_amount: paymentMethod === "mixed" ? split.cash : null,\n        document_date: docDate,'),
    ('                  <SelectItem value="card">Kartë</SelectItem>\n                  <SelectItem value="debt">Kredi / Borxh</SelectItem>\n                </SelectContent>\n              </Select>\n            </div>\n',
     '''                  <SelectItem value="card">Card-Bank (× {rates?.card_coef ?? 1.33})</SelectItem>
                  <SelectItem value="mixed">Cash + Card-Bank (e kombinuar)</SelectItem>
                  <SelectItem value="debt">Kredi / Borxh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "mixed" && (
              <div className="md:col-span-3">
                <Label className={label}>Shuma Cash (€)</Label>
                <Input type="number" step="0.01" min="0" max={total} value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                  className={field + " mt-1" + (cashAmount !== "" && !split.valid ? " border-red-500" : "")} placeholder={`më pak se ${total.toFixed(2)}`} data-testid="sale-cash-amount-input" />
                {cashAmount !== "" && !split.valid && <div className="text-[11px] text-red-600 mt-0.5">Duhet të jetë mes 0 dhe çmimit normal</div>}
              </div>
            )}
'''),
    ('                <span>TOTALI</span><span className="font-mono text-emerald-600" data-testid="sale-total">{eur(total)}</span>\n              </div>',
     '                <span>{split.final !== total ? "TOTALI PËR PAGESË" : "TOTALI"}</span><span className="font-mono text-emerald-600" data-testid="sale-total">{eur(split.final)}</span>\n              </div>\n              <PaymentBreakdown split={split} method={paymentMethod} rates={rates} />'),
    ("paymentMethod, priceMode, paid, rows, notes, warranty }));", "paymentMethod, priceMode, paid, rows, notes, warranty, cashAmount }));"),
    ("setPaid(d.paid); setRows(d.rows); setNotes(d.notes); setWarranty(d.warranty);", 'setPaid(d.paid); setRows(d.rows); setNotes(d.notes); setWarranty(d.warranty); setCashAmount(d.cashAmount || "");'),
], IMP)

edit("pages/POSPage.jsx", [
    ('                      <SelectItem value="card">Kartë</SelectItem>\n                      <SelectItem value="debt">Kredi / Borxh</SelectItem>',
     '                      <SelectItem value="card">Card-Bank (× {rates?.card_coef ?? 1.33})</SelectItem>\n                      <SelectItem value="mixed">Cash + Card-Bank</SelectItem>\n                      <SelectItem value="debt">Kredi / Borxh</SelectItem>'),
    ('              {paymentMethod === "debt" && (\n                <div>\n                  <Label className="text-xs">Paguar tani € (pjesor)</Label>',
     '''              {paymentMethod === "mixed" && (
                <div>
                  <Label className="text-xs">Shuma Cash €</Label>
                  <Input type="number" step="0.01" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                    placeholder={`më pak se ${total.toFixed(2)}`} className="mt-1 h-9 bg-slate-900 border-slate-800" data-testid="pos-cash-amount-input" />
                </div>
              )}
              {paymentMethod === "debt" && (
                <div>
                  <Label className="text-xs">Paguar tani € (pjesor)</Label>'''),
    ('<span>TOTALI</span><span className="text-emerald-400 font-mono-pd" data-testid="pos-total">{eur(total)}</span></div>',
     '<span>TOTALI</span><span className="text-emerald-400 font-mono-pd" data-testid="pos-total">{eur(split.final)}</span></div>\n                <PaymentBreakdown split={split} method={paymentMethod} rates={rates} prefix="pos" />'),
    ('        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : total,\n        payment_method: paymentMethod,',
     '        paid_amount: paymentMethod === "debt" ? Number(paid || 0) : split.final,\n        payment_method: paymentMethod,\n        cash_amount: paymentMethod === "mixed" ? split.cash : null,'),
    ('  const [paymentMethod, setPaymentMethod] = useState("cash");', '  const [paymentMethod, setPaymentMethod] = useState("cash");\n  const [cashAmount, setCashAmount] = useState("");\n  const rates = useRates();'),
], IMP)
print("ok")
