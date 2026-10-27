import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";

export const PAY_LABELS = { cash: "CASH", card: "CARD-BANK", mixed: "CASH + CARD-BANK", debt: "KREDI / BORXH" };
const r2 = (x) => { const v = Number((Number(x) || 0).toFixed(10)); return Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100; };

let cached = null;
export const useRates = () => {
  const [rates, setRates] = useState(cached);
  useEffect(() => { api.get("/finance-settings").then(({ data }) => { cached = data; setRates(data); }); }, []);
  return rates;
};

// same rule as the backend: only the Card-Bank part is multiplied (once) by the coefficient
export const computeSplit = (normal, method, cashAmount, rates) => {
  const n = r2(normal);
  const coef = rates?.card_coef ?? 1.33;
  const feePct = rates?.bank_fee_pct ?? 6;
  if (method !== "card" && method !== "mixed") return { normal: n, cash: n, rest: 0, card: 0, fee: 0, final: n, valid: true };
  const cash = method === "mixed" ? r2(cashAmount) : 0;
  const valid = method === "card" || (cash > 0 && cash < n);
  const rest = r2(n - cash);
  const card = r2(rest * coef);
  return { normal: n, cash, rest, card, fee: r2(card * feePct / 100), final: r2(cash + card), valid };
};

const Row = ({ l, v, cls = "", tid }) => (
  <div className={`flex justify-between ${cls}`}><span>{l}</span><span className="font-mono" data-testid={tid}>{v}</span></div>
);

// internal breakdown shown to the seller (fee is never printed on the customer's invoice)
export const PaymentBreakdown = ({ split, method, rates, prefix = "sale" }) => {
  if (method !== "card" && method !== "mixed") return null;
  return (
    <div className="mt-2 pt-2 border-t border-dashed border-slate-300 space-y-1 text-sm" data-testid={`${prefix}-payment-breakdown`}>
      <Row l="Çmimi normal" v={eur(split.normal)} tid={`${prefix}-normal-total`} />
      {method === "mixed" && <Row l="Pagesa Cash" v={eur(split.cash)} tid={`${prefix}-cash-part`} />}
      {method === "mixed" && <Row l="Pjesa e mbetur (çmim normal)" v={eur(split.rest)} tid={`${prefix}-rest-part`} />}
      <Row l={`Card-Bank (× ${rates?.card_coef ?? 1.33})`} v={eur(split.card)} cls="text-sky-700 font-semibold" tid={`${prefix}-card-part`} />
      <Row l={`Komisioni bankar ${rates?.bank_fee_pct ?? 6}% (i brendshëm)`} v={eur(split.fee)} cls="text-xs text-slate-500" tid={`${prefix}-bank-fee`} />
    </div>
  );
};
