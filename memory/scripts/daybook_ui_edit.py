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


# --- cards + rates button on Qarkullimet Ditore
edit("pages/DailyFlowPage.jsx", [
    ('''        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card icon={Receipt} label="Qarkullimi i Ditës" value={eur(data.turnover)} tid="card-turnover" />''',
     '''        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={Receipt} label="Qarkullimi total" value={eur(s.turnover_total)} tid="card-turnover" />
          <Card icon={Banknote} label="Qarkullimi Cash" value={eur(s.turnover_cash)} tid="card-turnover-cash" />
          <Card icon={CreditCard} label="Qarkullimi Card-Bank" value={eur(s.turnover_card)} tone="text-sky-700" tid="card-turnover-card" />'''),
    ('''<Card icon={TrendingUp} label="Fitimi/Humbja Ditore"''', '''<Card icon={TrendingUp} label="Fitimi i pastër ditor"'''),
    ('''        <Button variant="outline" onClick={() => navigate("/sale/new")} data-testid="daybook-back-to-sale">''',
     '''        <div className="flex gap-2">
        <RatesButton onSaved={load} />
        <Button variant="outline" onClick={() => navigate("/sale/new")} data-testid="daybook-back-to-sale">'''),
    ('''<ArrowLeft className="w-4 h-4 mr-1" /> Shitja vendore</Button>''', '''<ArrowLeft className="w-4 h-4 mr-1" /> Shitja vendore</Button>
        </div>'''),
    ("Scale, ArrowLeft }", "Scale, ArrowLeft, Banknote, CreditCard }"),
], 'import { RatesButton } from "@/components/daybook/RatesDialog";')

# --- profit box with VAT, bank fees, profit tax
s = open(base + "components/daybook/CashSummary.jsx").read()
i = s.index("export const ProfitBox")
s = s[:i] + '''const PLine = ({ l, v, b, tid, cls = "" }) => (
  <div className={`flex justify-between py-1.5 border-b border-slate-800/40 ${b ? "font-bold" : ""} ${cls}`}><span>{l}</span><span className="font-mono-pd" data-testid={tid}>{eur(v)}</span></div>
);

export const ProfitBox = ({ s }) => {
  const net = s.net_profit;
  return (
    <div className="stat-card p-4" data-testid="profit-box">
      <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold text-lg">Fitimi ose Humbja e Ditës</h2></div>
      <PLine l={`Të ardhurat nga shitjet (${s.sales_count} shitje, pa kthimet)`} v={s.revenue} tid="profit-revenue" />
      {s.vat > 0 && <PLine l="TVSH e përfshirë (Card-Bank / e kombinuar)" v={-s.vat} tid="profit-vat" />}
      <PLine l="Kostoja e produkteve të shitura" v={-s.cogs} tid="profit-cogs" />
      <PLine l="Fitimi bruto" v={s.gross_profit} b tid="profit-gross" />
      {s.bank_fees > 0 && <PLine l="Komisione bankare" v={-s.bank_fees} tid="profit-bank-fees" />}
      {(s.service_income > 0 || s.service_parts_cost > 0) && <PLine l={`Fitimi nga servisi (${eur(s.service_income)} − pjesët ${eur(s.service_parts_cost)})`} v={s.service_profit} tid="profit-service" />}
      {s.other_income > 0 && <PLine l="Të ardhura të tjera" v={s.other_income} />}
      <PLine l="Shpenzimet operative" v={-s.opex} tid="profit-opex" />
      <PLine l="Fitimi para tatimit" v={s.profit_before_tax} b tid="profit-before-tax" />
      <PLine l={`Tatimi në fitim ${s.profit_tax_pct}%`} v={-s.profit_tax} tid="profit-tax" />
      <div className={`flex justify-between pt-3 text-xl font-extrabold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        <span>{net >= 0 ? "Fitimi i pastër" : "Humbja"}</span><span className="font-mono-pd" data-testid="profit-net">{eur(net)}</span>
      </div>
      {s.profit_incomplete && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600" data-testid="profit-incomplete">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Fitimi është i paplotë: {s.missing_cost_count} shitje kanë produkte pa çmim blerjeje. Plotësoje te "Korrigjo".
        </div>
      )}
      <div className="text-[11px] text-slate-500 mt-2">Blerja e mallit për stok dhe pagesat e borxheve nuk llogariten si humbje/fitim. Tatimi llogaritet mbi fitimin total të periudhës, vetëm kur është pozitiv.</div>
    </div>
  );
};
'''
open(base + "components/daybook/CashSummary.jsx", "w").write(s)

edit("components/daybook/CashSummary.jsx", [
    ('''<Line n={2} label="Të hyrat nga shitjet Cash"''', '''<Line n={2} label="Të hyrat nga shitjet Cash (pa Card-Bank)"'''),
    ('''Banka (e ndarë nga arka): hyrje {eur(s.bank_in)} · dalje {eur(s.bank_out)}''', '''Card-Bank (nuk hyn në arkë): hyrje {eur(s.bank_in)} · dalje {eur(s.bank_out)}'''),
])

# --- flow table payment label
edit("components/daybook/FlowTable.jsx", [
    ('''<td className="px-3 py-2">{e.method === "bank" ? "Bankë" : "Cash"}</td>''',
     '''<td className="px-3 py-2 whitespace-nowrap">{e.method === "mixed" ? <span title={`Cash ${eur(e.cash_in)} + Bankë ${eur(e.bank_in)}`}>Cash + Bankë<div className="text-[10px] text-slate-500">{eur(e.cash_in)} + {eur(e.bank_in)}</div></span> : e.method === "bank" ? "Bankë" : "Cash"}</td>'''),
])

# --- report columns
edit("components/daybook/Reports.jsx", [
    ('''const COLS = [["sales_total", "Shitjet"], ["purchases_total", "Blerjet"], ["expenses_total", "Shpenzimet"], ["returns_total", "Kthimet"], ["service_income", "Servisi"],
  ["cash_in", "Hyrje Cash"], ["cash_out", "Dalje Cash"], ["gross_profit", "Fitimi bruto"], ["net_profit", "Fitimi neto"],
  ["cash_end", "Arka në fund"], ["count_difference", "Dif. numërimit"]];''',
     '''const COLS = [["sales_count", "Nr. shitjeve"], ["turnover_cash", "Qark. Cash"], ["turnover_card", "Qark. Card-Bank"], ["turnover_total", "Qark. total"],
  ["purchases_total", "Blerjet"], ["expenses_total", "Shpenzimet"], ["returns_total", "Kthimet"], ["service_income", "Servisi"],
  ["bank_fees", "Komisione"], ["vat", "TVSH"], ["cogs", "Kosto"], ["profit_before_tax", "Fitimi para tatimit"], ["profit_tax", "Tatimi"],
  ["net_profit", "Fitimi i pastër"], ["cash_in", "Hyrje Cash"], ["cash_out", "Dalje Cash"], ["cash_end", "Arka në fund"], ["count_difference", "Dif. numërimit"]];
const cell = (k, v) => (v == null ? "—" : k === "sales_count" ? v : eur(v));'''),
    ('''{COLS.map(([k]) => <td key={k} className={`px-2 py-1.5 text-right font-mono-pd ${color(k, r[k])}`}>{r[k] == null ? "—" : eur(r[k])}</td>)}''',
     '''{COLS.map(([k]) => <td key={k} className={`px-2 py-1.5 text-right font-mono-pd whitespace-nowrap ${color(k, r[k])}`}>{cell(k, r[k])}</td>)}'''),
    ('''data-testid={`report-total-${k}`}>{data.totals[k] == null ? "—" : eur(data.totals[k])}</td>''',
     '''data-testid={`report-total-${k}`}>{cell(k, data.totals[k])}</td>'''),
    ('''["net_profit", "gross_profit", "count_difference"].includes(k)''', '''["net_profit", "gross_profit", "profit_before_tax", "count_difference"].includes(k)'''),
])
print("ok")
