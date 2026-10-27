base = "/app/frontend/src/"
IMP = 'import { PaySource, payFields } from "@/components/BankSelect";'


def edit(p, pairs, extra_import=IMP):
    s = open(base + p).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    if extra_import:
        i = s.index("\n", s.rindex("\nimport "))
        s = s[:i] + "\n" + extra_import + s[i:]
    open(base + p, "w").write(s)


bank_ui = lambda prefix, cls: f'''            {{(paymentMethod === "card" || paymentMethod === "mixed") && (
              <div className="{cls}">
                <Label className={{label}}>Banka e pagesës me kartelë *</Label>
                <div className="mt-1"><PaySource value={{bank}} onChange={{setBank}} cash={{false}} testId="{prefix}-bank-select" className={{field}} /></div>
              </div>
            )}}
'''

edit("pages/SaleEntryPage.jsx", [
    ('  const [cashAmount, setCashAmount] = useState("");', '  const [cashAmount, setCashAmount] = useState("");\n  const [bank, setBank] = useState("");'),
    ('''    if (!split.valid) { toast.error("Shuma Cash duhet''', '''    if ((paymentMethod === "card" || paymentMethod === "mixed") && !bank) { toast.error("Zgjidh bankën ku u realizua pagesa (TEB, Raiffeisen, BKT, NLB)"); return; }
    if (!split.valid) { toast.error("Shuma Cash duhet'''),
    ('''        cash_amount: paymentMethod === "mixed" ? split.cash : null,''', '''        cash_amount: paymentMethod === "mixed" ? split.cash : null,
        bank: paymentMethod === "card" || paymentMethod === "mixed" ? bank : null,'''),
    ('''            {paymentMethod === "mixed" && (
              <div className="md:col-span-3">''', bank_ui("sale", "md:col-span-3") + '''            {paymentMethod === "mixed" && (
              <div className="md:col-span-3">'''),
], 'import { PaySource } from "@/components/BankSelect";')

s = open(base + "pages/POSPage.jsx").read()
edit("pages/POSPage.jsx", [
    ('  const [cashAmount, setCashAmount] = useState("");', '  const [cashAmount, setCashAmount] = useState("");\n  const [bank, setBank] = useState("");'),
    ('''    if (!split.valid) { toast.error("Shuma Cash duhet''', '''    if ((paymentMethod === "card" || paymentMethod === "mixed") && !bank) { toast.error("Zgjidh bankën e pagesës me kartelë"); return; }
    if (!split.valid) { toast.error("Shuma Cash duhet'''),
    ('''        cash_amount: paymentMethod === "mixed" ? split.cash : null,''', '''        cash_amount: paymentMethod === "mixed" ? split.cash : null,
        bank: paymentMethod === "card" || paymentMethod === "mixed" ? bank : null,'''),
    ('''              {paymentMethod === "mixed" && (
                <div>
                  <Label className="text-xs">Shuma Cash €</Label>''', '''              {(paymentMethod === "card" || paymentMethod === "mixed") && (
                <div>
                  <Label className="text-xs">Banka e pagesës me kartelë *</Label>
                  <div className="mt-1"><PaySource value={bank} onChange={setBank} cash={false} testId="pos-bank-select" className="h-9" /></div>
                </div>
              )}
              {paymentMethod === "mixed" && (
                <div>
                  <Label className="text-xs">Shuma Cash €</Label>'''),
], 'import { PaySource } from "@/components/BankSelect";')

edit("pages/PurchasesPage.jsx", [
    ('  const [sellerText, setSellerText] = useState("");', '  const [sellerText, setSellerText] = useState("");\n  const [paySrc, setPaySrc] = useState("cash");'),
    ('''        paid_amount: Number(paid) || 0,''', '''        paid_amount: Number(paid) || 0,
        ...payFields(paySrc),'''),
    ('''                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" data-testid="purchase-paid-input" />
              </div>''', '''                <Input type="number" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 bg-slate-900 border-slate-800" data-testid="purchase-paid-input" />
                <div className="mt-2"><Label className="text-xs">Paguar me</Label><div className="mt-1"><PaySource value={paySrc} onChange={setPaySrc} testId="purchase-pay-source" /></div></div>
              </div>'''),
])

edit("pages/ExpensesPage.jsx", [
    ('const EMPTY = { category: "Tjetër", description: "", amount: "", date: today() };', 'const EMPTY = { category: "Tjetër", description: "", amount: "", date: today(), src: "cash" };'),
    ('''      await api.post("/expenses", { ...f, amount: Number(f.amount) });''', '''      const { src, ...rest } = f;
      await api.post("/expenses", { ...rest, amount: Number(f.amount), ...payFields(src) });'''),
    ('''      setF({ ...EMPTY, date: f.date });''', '''      setF({ ...EMPTY, date: f.date, src: f.src });'''),
    ('''          onKeyDown={(e) => e.key === "Enter" && save()} autoFocus className={inp + " font-mono-pd"} data-testid="expense-amount-input" />
      </div>''', '''          onKeyDown={(e) => e.key === "Enter" && save()} autoFocus className={inp + " font-mono-pd"} data-testid="expense-amount-input" />
        <div className="mt-2"><PaySource value={f.src} onChange={(v) => setF({ ...f, src: v })} testId="expense-pay-source" className="h-8 text-xs" /></div>
      </div>'''),
])

edit("pages/PaymentsPage.jsx", [
    ('  const [amount, setAmount] = useState("");', '  const [amount, setAmount] = useState("");\n  const [src, setSrc] = useState("cash");'),
    ('''        direction: type === "customer" ? "in" : "out", notes: "",''', '''        direction: type === "customer" ? "in" : "out", notes: "", ...payFields(src),'''),
    ('''          className="h-9 w-32 ml-auto text-right bg-slate-900 border-slate-700 font-mono-pd" data-testid={`debt-pay-input-${c.id}`} />''',
     '''          className="h-9 w-32 ml-auto text-right bg-slate-900 border-slate-700 font-mono-pd" data-testid={`debt-pay-input-${c.id}`} />
        <div className="mt-1 w-32 ml-auto"><PaySource value={src} onChange={setSrc} testId={`debt-pay-source-${c.id}`} className="h-7 text-xs" /></div>'''),
])

edit("components/SupplierPayDialog.jsx", [
    ('  const [notes, setNotes] = useState("");', '  const [notes, setNotes] = useState("");\n  const [src, setSrc] = useState("cash");'),
    ('''amount: value, direction: "out", notes });''', '''amount: value, direction: "out", notes, ...payFields(src) });'''),
    ('''        <div>
          <Label>Shënim</Label>''', '''        <div>
          <Label>Paguar me</Label>
          <div className="mt-1"><PaySource value={src} onChange={setSrc} testId="supplier-pay-source" /></div>
        </div>
        <div>
          <Label>Shënim</Label>'''),
])
print("ok")
