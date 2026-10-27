import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const BANKS = ["TEB", "Raiffeisen", "BKT", "NLB"];

// one select for "where did the money go/come from": Cash or one of the banks
export const PaySource = ({ value, onChange, testId, className = "", cash = true }) => (
  <Select value={value || (cash ? "cash" : "")} onValueChange={onChange}>
    <SelectTrigger className={`bg-slate-900 border-slate-800 ${className}`} data-testid={testId}><SelectValue placeholder="Zgjidh bankën" /></SelectTrigger>
    <SelectContent>
      {cash && <SelectItem value="cash">Cash (arka)</SelectItem>}
      {BANKS.map((b) => <SelectItem key={b} value={b}>Bankë · {b}</SelectItem>)}
    </SelectContent>
  </Select>
);

// API fields from the select value
export const payFields = (v) => (v && v !== "cash" ? { pay_method: "bank", bank: v } : { pay_method: "cash", bank: null });
