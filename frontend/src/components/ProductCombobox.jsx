import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Plus } from "lucide-react";

// Searchable product picker: type name / shifra / barcode, or create a new article from the typed text
export const ProductCombobox = ({ products, value, onPick, onCreate, testId }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = products.find((p) => p.id === value);

  const choose = (p) => { onPick(p); setOpen(false); setSearch(""); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId}
          className="h-8 w-full flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-sm text-left hover:border-emerald-500">
          <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>{selected ? selected.name : "Shkruaj ose zgjidh produktin"}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Shkruaj emrin, shifrën ose barkodin..." data-testid={`${testId}-search`} />
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
            <button type="button" onClick={() => { onCreate(search.trim()); setOpen(false); setSearch(""); }}
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
