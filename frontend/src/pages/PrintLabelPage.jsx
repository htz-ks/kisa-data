import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Barcode from "react-barcode";
import api from "@/lib/api";

/**
 * Prints 1..N copies of a product's price label.
 * Label format (50mm x 30mm):
 *   [name]
 *   [shifra] [barcode] [cost reversed]
 *   [price]
 *
 * Access: /print/label/:id?copies=4
 */
export default function PrintLabelPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const copies = Math.max(1, Math.min(50, parseInt(sp.get("copies") || "1", 10)));
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/products/${id}`).then(({ data }) => setP(data)); }, [id]);
  useEffect(() => { if (p) setTimeout(() => window.print(), 500); }, [p]);

  if (!p) return <div style={{ padding: 20 }}>Duke ngarkuar…</div>;

  // Reverse cost price (integer euros): 50 -> "05", 1200 -> "0021"
  const costInt = Math.round(Number(p.cost_price || 0)).toString();
  const costReversed = costInt.split("").reverse().join("");

  const barcodeValue = p.barcode || p.code || p.id.slice(-10);

  const labels = Array.from({ length: copies });

  return (
    <div>
      <style>{`
        @page { size: 50mm 30mm; margin: 0; }
        html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #000; background: #fff !important; }
        .page-wrap { padding: 10px; background: #fff; }
        .label {
          width: 50mm; height: 30mm; overflow: hidden;
          padding: 1.5mm 2.5mm; box-sizing: border-box;
          border: 1px dashed #999; margin: 0 0 2mm 0;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .name { font-size: 10px; font-weight: 700; line-height: 1.1; overflow: hidden; max-height: 22px; text-align: center; }
        .specs { font-size: 8px; font-family: monospace; display: flex; gap: 6px; justify-content: center; line-height: 1; }
        .mid { display: flex; align-items: center; justify-content: space-between; gap: 4px; line-height: 1; }
        .code { font-size: 8px; font-family: monospace; }
        .cost-rev { font-size: 8px; font-family: monospace; letter-spacing: 1px; }
        .price { font-size: 13px; font-weight: 800; font-family: monospace; }
        .barcode-wrap { line-height: 0; text-align: center; }
        .barcode-wrap svg { display: block; margin: 0 auto; width: 40mm; height: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .page-wrap { padding: 0; }
          .label { border: 0; margin: 0; page-break-after: always; break-after: page; }
          .label:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
      <div className="no-print" style={{ padding: 10, background: "#eee", display: "flex", gap: 8 }}>
        <button onClick={() => window.print()} style={{ padding: "6px 10px" }}>Printo {copies} etiketa</button>
        <button onClick={() => window.close()} style={{ padding: "6px 10px" }}>Mbyll</button>
        <span style={{ fontSize: 12, marginLeft: 10 }}>Produkti: <b>{p.name}</b> · Shifra: {p.code || "—"}</span>
      </div>

      <div className="page-wrap">
        {labels.map((_, i) => (
          <div key={i} className="label" data-testid={`print-label-${i}`}>
            <div className="name">
              {p.brand ? <span style={{ color: "#555", fontWeight: 400 }}>{p.brand} </span> : null}
              {p.name}
            </div>
            {(p.gb || p.ram || p.battery_percent) && (
              <div className="specs">
                {p.gb && <span><b>{p.gb}</b>GB</span>}
                {p.ram && <span>RAM <b>{p.ram}</b></span>}
                {p.battery_percent && <span>Bat <b>{p.battery_percent}%</b></span>}
              </div>
            )}
            <div className="barcode-wrap">
              <Barcode value={barcodeValue} format="CODE128" displayValue={true} fontSize={9} height={26} margin={0} />
            </div>
            <div className="mid">
              <span className="code">{p.code || "—"}</span>
              <span className="price">€ {Number(p.sale_price || 0).toFixed(2)}</span>
              <span className="cost-rev">{costReversed}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
