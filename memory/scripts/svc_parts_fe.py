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


edit("components/service/ServiceFormDialog.jsx", [
    ('''  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;''', '''  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState([]);
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!open) return;
    setQueued([]); setCurrent(service || null);'''),
    ('''      const { data } = service ? await api.put(`/services/${service.id}`, body) : await api.post("/services", body);''',
     '''      let { data } = service ? await api.put(`/services/${service.id}`, body) : await api.post("/services", body);
      for (const p of service ? [] : queued) {
        try { ({ data } = await api.post(`/services/${data.id}/parts`, { product_id: p.product_id, quantity: p.quantity })); }
        catch (e) { toast.error(`${p.name}: ${formatApiErrorDetail(e.response?.data?.detail)}`); }
      }'''),
    ('''{field("parts_cost", "Kostoja e pjesëve (€) – opsional",''', '''{field("parts_cost", "Kosto tjetër e pjesëve, jo nga stoku (€)",'''),
    ('''          <div className="sm:col-span-2">
            <Label>Shënime shtesë</Label>''', '''          <ServiceParts service={current} queued={queued} setQueued={setQueued} onChanged={(d) => { setCurrent(d); onSaved(d, false, true); }} />
          <div className="sm:col-span-2">
            <Label>Shënime shtesë</Label>'''),
], 'import { ServiceParts } from "./ServiceParts";')

edit("pages/ServicesPage.jsx", [
    ('''  const onSaved = (data, isNew) => { load(); if (isNew''', '''  const onSaved = (data, isNew, partsOnly) => { load(); if (partsOnly) return; if (isNew'''),
    ('''<td className="px-3 py-2 min-w-[180px] text-slate-600">{s.defect}</td>''',
     '''<td className="px-3 py-2 min-w-[180px] text-slate-600">{s.defect}
                    {s.parts?.length > 0 && <div className="text-[11px] text-emerald-700 mt-0.5" data-testid={`service-parts-summary-${s.id}`}>Pjesë: {s.parts.map((p) => `${p.name} × ${p.quantity}`).join(", ")}</div>}
                  </td>'''),
])
print("ok")
