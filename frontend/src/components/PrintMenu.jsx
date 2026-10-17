import { useEffect, useState } from "react";
import api, { eur } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Printer, ChevronDown } from "lucide-react";

/**
 * Dropdown with 3 options: A4, Termik 80mm, Termik 58mm.
 * Each opens the print page in a new window; the page auto-triggers window.print().
 */
export default function PrintMenu({ saleId, size = "default", testid }) {
  const open = (fmt) => {
    const url = `/print/sale/${saleId}?format=${fmt}`;
    window.open(url, "_blank", "width=420,height=640");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size === "icon" ? "sm" : "sm"} className="text-sky-400 hover:text-sky-300" data-testid={testid || `print-menu-${saleId}`}>
          <Printer className="w-4 h-4" />
          {size !== "icon" && <ChevronDown className="w-3 h-3 ml-0.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#141C2B] border-slate-800 text-slate-200">
        <DropdownMenuItem onClick={() => open("a4")} className="focus:bg-slate-800" data-testid={`print-a4-${saleId}`}>
          <Printer className="w-4 h-4 mr-2" /> A4 (Printer normal)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("80")} className="focus:bg-slate-800" data-testid={`print-80-${saleId}`}>
          <Printer className="w-4 h-4 mr-2" /> Termik 80mm
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open("58")} className="focus:bg-slate-800" data-testid={`print-58-${saleId}`}>
          <Printer className="w-4 h-4 mr-2" /> Termik 58mm
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
