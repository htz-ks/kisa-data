import re

# backend: half-up rounding identical to the frontend
p = "/app/backend/finance.py"
s = open(p).read()
s = s.replace("from typing import Optional\n", "from decimal import Decimal, ROUND_HALF_UP\nfrom typing import Optional\n", 1)
s = s.replace('def split_payment(', '''def r2(x) -> float:
    """Money rounding half-up (16.625 -> 16.63), same as the sale screen."""
    return float(Decimal(repr(round(float(x or 0), 10))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def split_payment(''', 1)
body_start = s.index("def split_payment(")
body = s[body_start:s.index("def make_router")]
new_body = re.sub(r"\bround\((.+?), 2\)", r"r2(\1)", body)
s = s.replace(body, new_body)
open(p, "w").write(s)

# frontend: same normalisation
p = "/app/frontend/src/components/PaymentSplit.jsx"
s = open(p).read()
s = s.replace("const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;",
              "const r2 = (x) => { const v = Number((Number(x) || 0).toFixed(10)); return Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100; };")
open(p, "w").write(s)

# daybook: total turnover = all sales (incl. unpaid debt part)
p = "/app/backend/daybook.py"
s = open(p).read()
a = '"turnover_total": r2(t_cash + t_card),'
assert a in s
s = s.replace(a, '"turnover_total": r2(sum(e["revenue"] for e in sales)), "turnover_debt": r2(sum(e["revenue"] - e["cash_in"] - e["bank_in"] for e in sales)),')
open(p, "w").write(s)

# sales list labels
p = "/app/frontend/src/pages/SalesPage.jsx"
s = open(p).read()
s = s.replace("{s.payment_method.toUpperCase()}", "{PAY_LABELS[s.payment_method] || s.payment_method.toUpperCase()}", 1)
s = s.replace("{view.payment_method?.toUpperCase()}", "{PAY_LABELS[view.payment_method] || view.payment_method?.toUpperCase()}", 1)
s = s.replace('s.payment_method === "card" ? "border-sky-500/40 text-sky-300" :',
              's.payment_method === "card" || s.payment_method === "mixed" ? "border-sky-500/40 text-sky-300" :', 1)
i = s.index("\n", s.rindex("\nimport "))
s = s[:i] + '\nimport { PAY_LABELS } from "@/components/PaymentSplit";' + s[i:]
open(p, "w").write(s)

# POS inline error + same label
p = "/app/frontend/src/pages/POSPage.jsx"
s = open(p).read()
a = '''placeholder={`më pak se ${total.toFixed(2)}`} className="mt-1 h-9 bg-slate-900 border-slate-800" data-testid="pos-cash-amount-input" />'''
assert a in s
s = s.replace(a, '''placeholder={`më pak se ${total.toFixed(2)}`} className={`mt-1 h-9 bg-slate-900 border-slate-800 ${cashAmount !== "" && !split.valid ? "border-red-500" : ""}`} data-testid="pos-cash-amount-input" />
                  {cashAmount !== "" && !split.valid && <div className="text-[11px] text-red-500 mt-0.5" data-testid="pos-cash-error">Duhet të jetë mes 0 dhe çmimit normal</div>}''')
s = s.replace('<SelectItem value="mixed">Cash + Card-Bank</SelectItem>', '<SelectItem value="mixed">Cash + Card-Bank (e kombinuar)</SelectItem>')
open(p, "w").write(s)
print("ok")
