p = "/app/frontend/src/pages/SaleEntryPage.jsx"
s = open(p).read()
pairs = [
    ('quantity: 1, unit: "copë", sale_price: 0, discount: 0, imei: "", _type: "accessory" };',
     'quantity: 1, unit: "copë", sale_price: 0, discount: 0, imei: "", _type: "accessory", cash: "" };'),
    ("  const split = computeSplit(total, paymentMethod, cashAmount, rates);",
     '''  const mixed = paymentMethod === "mixed";
  const coef = rates?.card_coef ?? 1.33;
  // mixed payment: the cash part is entered per article; the rest of each line is paid by Card-Bank × coef
  const rowCash = (r) => Math.max(0, Number(r.cash) || 0);
  const rowsCash = Math.round(rows.reduce((t, r) => t + (r.product_id ? rowCash(r) : 0), 0) * 100) / 100;
  const badRow = mixed && rows.some((r) => r.product_id && rowCash(r) > lineTotal(r) + 0.001);
  const split = computeSplit(total, paymentMethod, mixed ? rowsCash : cashAmount, rates);'''),
    ('''    if (!split.valid) { toast.error("Shuma Cash duhet të jetë më e madhe se 0 dhe më e vogël se çmimi normal"); return; }''',
     '''    if (badRow) { toast.error("Pjesa Cash e një artikulli nuk mund të jetë më e madhe se totali i tij"); return; }
    if (!split.valid) { toast.error("Shuma Cash duhet të jetë më e madhe se 0 dhe më e vogël se çmimi normal"); return; }'''),
    ('''                <Label className={label}>Shuma Cash (€)</Label>
                <Input type="number" step="0.01" min="0" max={total} value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                  className={field + " mt-1" + (cashAmount !== "" && !split.valid ? " border-red-500" : "")} placeholder={`më pak se ${total.toFixed(2)}`} data-testid="sale-cash-amount-input" />
                {cashAmount !== "" && !split.valid && <div className="text-[11px] text-red-600 mt-0.5">Duhet të jetë mes 0 dhe çmimit normal</div>}''',
     '''                <Label className={label}>Shuma Cash (nga artikujt)</Label>
                <div className={field + " mt-1 h-9 flex items-center px-3 rounded-md border font-mono font-semibold" + (rowsCash > 0 && !split.valid ? " border-red-500 text-red-600" : "")} data-testid="sale-cash-amount-input">{eur(rowsCash)}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Shkruaj pjesën Cash te kolona "Cash" e çdo artikulli</div>'''),
    ('''                  <th className="px-2 py-2 text-right w-28">Totali</th>
                  <th className="px-2 py-2 w-10"></th>''',
     '''                  <th className="px-2 py-2 text-right w-28">Totali</th>
                  {mixed && <th className="px-2 py-2 text-right w-28 bg-emerald-50 text-emerald-800" data-testid="sale-col-cash">Cash (€)</th>}
                  {mixed && <th className="px-2 py-2 text-right w-32 bg-sky-50 text-sky-800" data-testid="sale-col-card">Card-Bank × {coef}</th>}
                  <th className="px-2 py-2 w-10"></th>'''),
    ('''                        {eur(lineTotal(r))}
                      </td>
''',
     '''                        {eur(lineTotal(r))}
                      </td>
                      {mixed && (
                        <td className="px-1 py-1 bg-emerald-50/60">
                          <Input type="number" step="0.01" min="0" value={r.cash ?? ""} placeholder="0.00" disabled={!r.product_id}
                            onChange={(e) => updateRow(i, { cash: e.target.value })}
                            className={`h-8 text-right bg-white font-mono ${rowCash(r) > lineTotal(r) + 0.001 ? "border-red-500 text-red-600" : "border-emerald-300"}`} data-testid={`sale-row-cash-${i}`} />
                        </td>
                      )}
                      {mixed && (
                        <td className="px-1 py-1 text-right font-mono text-sm text-sky-700 font-semibold pr-2 bg-sky-50/60" data-testid={`sale-row-card-${i}`}>
                          {r.product_id ? eur(Math.round(Math.max(0, lineTotal(r) - rowCash(r)) * coef * 100) / 100) : ""}
                        </td>
                      )}
'''),
]
for a, b in pairs:
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
open(p, "w").write(s)
print("ok")
