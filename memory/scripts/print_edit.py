base = "/app/frontend/src/pages/PrintSalePage.jsx"
s = open(base).read()
pairs = [
    ('<div className="row"><span>Pagesa</span><span>{(sale.payment_method || "").toUpperCase()}</span></div>',
     '<div className="row"><span>Pagesa</span><span>{PAY_LABELS[sale.payment_method] || (sale.payment_method || "").toUpperCase()}</span></div>'),
    ('<div style={{ fontSize: 13, color: "#64748B" }}>Pagesa: {(sale.payment_method || "").toUpperCase()}</div>',
     '<div style={{ fontSize: 13, color: "#64748B" }}>Pagesa: {PAY_LABELS[sale.payment_method] || (sale.payment_method || "").toUpperCase()}</div>'),
    ('''        <div className="row b" style={{ fontSize: 13 }}><span>TOTALI</span><span>€ {sale.total.toFixed(2)}</span></div>
        <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>''',
     '''        {sale.card_surcharge > 0 && <div className="row"><span>Shtesë Card-Bank</span><span>€ {sale.card_surcharge.toFixed(2)}</span></div>}
        <div className="row b" style={{ fontSize: 13 }}><span>TOTALI</span><span>€ {sale.total.toFixed(2)}</span></div>
        {sale.payment_method === "mixed" ? <>
          <div className="row"><span>Paguar Cash</span><span>€ {sale.cash_paid.toFixed(2)}</span></div>
          <div className="row"><span>Paguar Card-Bank</span><span>€ {sale.card_paid.toFixed(2)}</span></div>
        </> : <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>}'''),
    ('''          <div className="row big"><span>TOTALI</span><span>€ {sale.total.toFixed(2)}</span></div>
          <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>''',
     '''          {sale.card_surcharge > 0 && <div className="row"><span>Shtesë pagesë Card-Bank</span><span>€ {sale.card_surcharge.toFixed(2)}</span></div>}
          <div className="row big"><span>{sale.card_surcharge > 0 ? "TOTALI PËR PAGESË" : "TOTALI"}</span><span data-testid="print-total">€ {sale.total.toFixed(2)}</span></div>
          {sale.payment_method === "mixed" ? <>
            <div className="row"><span>Paguar Cash</span><span data-testid="print-cash-paid">€ {sale.cash_paid.toFixed(2)}</span></div>
            <div className="row"><span>Paguar Card-Bank</span><span data-testid="print-card-paid">€ {sale.card_paid.toFixed(2)}</span></div>
          </> : <div className="row"><span>Paguar</span><span>€ {sale.paid_amount.toFixed(2)}</span></div>}'''),
]
for a, b in pairs:
    assert a in s, a[:60]
    s = s.replace(a, b, 1)
i = s.index("\n", s.rindex("\nimport "))
s = s[:i] + '\nimport { PAY_LABELS } from "@/components/PaymentSplit";' + s[i:]
open(base, "w").write(s)
print("ok")
