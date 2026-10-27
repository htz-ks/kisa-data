base = "/app/frontend/src/"


def edit(p, pairs):
    s = open(base + p).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    open(base + p, "w").write(s)


edit("App.js", [
    ('import ServicesPage from "@/pages/ServicesPage";', 'import ServicesPage from "@/pages/ServicesPage";\nimport BanksPage from "@/pages/BanksPage";'),
    ('              <Route path="/services" element={<Protected adminOnly><ServicesPage /></Protected>} />',
     '              <Route path="/services" element={<Protected adminOnly><ServicesPage /></Protected>} />\n              <Route path="/banks" element={<Protected adminOnly><BanksPage /></Protected>} />'),
])
edit("components/AppShell.jsx", [
    ('  { key: "daily-flow", to: "/daily-flow",',
     '  { key: "banks", to: "/banks", icon: Landmark, label: "Gjendja e Bankave", roles: ["admin"], tid: "nav-banks" },\n  { key: "daily-flow", to: "/daily-flow",'),
    ("ArrowLeft, CalendarDays, Wrench", "ArrowLeft, CalendarDays, Wrench, Landmark"),
])
edit("pages/SaleEntryPage.jsx", [
    ('                <Button size="sm" variant="outline" onClick={() => goTo("/daily-flow")}',
     '                <Button size="sm" variant="outline" onClick={() => goTo("/banks")} className="border-sky-500 text-sky-700 hover:bg-sky-50 font-semibold" data-testid="sale-goto-banks-btn">\n                  <Landmark className="w-4 h-4 mr-1" /> Gjendja e Bankave\n                </Button>\n                <Button size="sm" variant="outline" onClick={() => goTo("/daily-flow")}'),
    ("IdCard, CalendarDays, Wrench }", "IdCard, CalendarDays, Wrench, Landmark }"),
])
print("ok")
