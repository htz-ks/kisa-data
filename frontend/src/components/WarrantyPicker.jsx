import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";

// value: null (= product warranty) or { n: number, unit: "muaj" | "ditë" }
export const warrantyLabel = (v) => (v ? `${v.n} ${v.unit}` : "Sipas artikullit");

export const WarrantyPicker = ({ value, onChange, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState("");
  const [unit, setUnit] = useState("ditë");

  const pick = (v) => { onChange(v); setOpen(false); setN(""); };
  const applyTyped = () => { const x = parseInt(n, 10); if (x > 0) pick({ n: x, unit }); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-testid="sale-warranty-trigger"
          className={`h-9 w-full flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 hover:border-emerald-500 ${className}`}>
          <span>{warrantyLabel(value)}</span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 bg-white text-slate-900 border-slate-200" data-testid="sale-warranty-menu">
        <div className="flex gap-1 mb-2">
          <Input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} placeholder="Shkruaj"
            onKeyDown={(e) => e.key === "Enter" && applyTyped()} autoFocus
            className="h-8 w-20 bg-white border-slate-300 text-slate-900" data-testid="sale-warranty-input" />
          {["ditë", "muaj"].map((u) => (
            <button key={u} type="button" onClick={() => setUnit(u)} data-testid={`sale-warranty-unit-${u === "ditë" ? "dite" : "muaj"}`}
              className={`h-8 px-2 rounded text-xs font-semibold border ${unit === u ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-slate-600"}`}>
              {u}
            </button>
          ))}
          <Button size="sm" className="h-8 px-2 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={applyTyped} data-testid="sale-warranty-apply">OK</Button>
        </div>
        <div className="max-h-64 overflow-y-auto border-t border-slate-200 pt-1">
          <Item active={!value} onClick={() => pick(null)} testId="sale-warranty-default">Sipas artikullit</Item>
          {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
            <Item key={m} active={value?.unit === "muaj" && value?.n === m} onClick={() => pick({ n: m, unit: "muaj" })} testId={`sale-warranty-${m}`}>
              {m} muaj
            </Item>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Item = ({ active, onClick, testId, children }) => (
  <button type="button" onClick={onClick} data-testid={testId}
    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-left hover:bg-slate-100">
    {children}
    {active && <Check className="w-4 h-4 text-emerald-600" />}
  </button>
);
