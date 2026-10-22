import { useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Plus } from "lucide-react";

// Type / scan directly (Enter = find by barcode, shifra, IMEI or name). The list opens only from the arrow button.
export const ProductCombobox = ({ products, value, onPick, onCreate, onEnter, testId }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null); // null = not typing, show selected name
  const [search, setSearch] = useState("");
  const selected = products.find((p) => p.id === value);

  const choose = (p) => { onPick(p); setOpen(false); setSearch(""); setText(null); };
  const openList = () => { setSearch(text || ""); setOpen(true); };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = (text || "").trim();
    if (!q) return;
    if (onEnter(q)) setText(null);
    else openList();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverAnchor asChild>
        <div className="h-8 w-full flex items-center rounded-md border border-slate-300 bg-white text-sm hover:border-emerald-500 focus-within:border-emerald-500">
          <input value={text ?? (selected ? selected.name : "")} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
            onBlur={() => !open && setText(null)}
            placeholder="Shkruaj / skano produktin" data-testid={testId}
            className="flex-1 min-w-0 h-full bg-transparent px-2 outline-none text-slate-900 placeholder:text-slate-400" />
          <button type="button" tabIndex={-1} onClick={openList} title="Hap listën e produkteve"
            className="px-2 h-full border-l border-slate-200 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700" data-testid={`${testId}-open`}>
            <ChevronsUpDown className="w-4 h-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent className="p-0 w-[420px]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Kërko emrin, shifrën ose barkodin..." data-testid={`${testId}-search`} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nuk u gjet asnjë produkt.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.code || ""} ${p.barcode || ""} ${p.id}`} onSelect={() => choose(p)}
                  data-testid={`${testId}-option-${p.id}`}>
                  <span className="font-mono text-xs text-slate-400 w-10 shrink-0">{p.code}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-slate-400">stok {p.quantity}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {onCreate && (
            <button type="button" onClick={() => { onCreate(search.trim()); setOpen(false); setSearch(""); setText(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 border-t text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              data-testid={`${testId}-create`}>
              <Plus className="w-4 h-4" /> {search.trim() ? `Krijo artikull: "${search.trim()}"` : "Krijo artikull të ri"}
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
