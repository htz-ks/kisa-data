# PRD — Prodata Stock & POS

## Original Problem
Albanian user owns a phone & accessories store and wants a stock/POS management program similar to Prodata.

## User Choices (2026-10-17)
- Full featured: products + categories + stock + purchases + sales + supplier/customer debts + reports
- JWT auth with admin + employee roles
- IMEI tracking per phone
- Currency: EUR
- Downloadable PDF invoices

## Personas
- **Admin (owner)** — full access: products, categories, suppliers, purchases, customers, POS, invoices, payments/debts, reports, users
- **Punonjës (employee)** — POS/sales, product lookup, customers, invoices (read)

## Core Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt + PyJWT), reportlab for PDF
- Frontend: React 19, Tailwind, shadcn/ui, recharts, framer motion, sonner toasts
- All API under `/api`; Mongo accessed via `MONGO_URL` / `DB_NAME`; frontend uses `REACT_APP_BACKEND_URL`

## Implemented (2026-10-17)
- Auth: `/api/auth/login|logout|me`, admin seed, role dependency
- CRUD: categories, suppliers, customers, products (phone with IMEI or accessory with qty), users
- Purchases: creates stock lines, appends IMEIs, updates supplier balance by due amount
- Sales (POS): invoice number counter, decrements stock, marks IMEI sold, cash/card/debt, discount, customer balance update
- PDF invoice (reportlab) at `/api/sales/{id}/invoice.pdf`
- Payments: in/out, updates customer/supplier balance
- Reports: dashboard KPIs + 7-day chart + top products
- Frontend: Login, Dashboard (KPIs + charts), POS (grid + cart + IMEI picker), Products, Categories, Customers, Suppliers, Purchases, Sales/Invoices, Payments, Reports, Users
- Role-gated admin routes (categories, suppliers, purchases, payments, reports, users)

## Verified
- End-to-end tested via testing agent (iteration_1.json) — backend 95%, frontend 100%
- Backend role enforcement tightened for suppliers/purchases/payments

## Backlog / Next
- P1: Barcode scanner input (camera + hotkey) for POS
- P1: Export sales report to Excel/CSV
- P2: Multi-currency (ALL + EUR) with configurable rate
- P2: Customer purchase history drawer
- P2: Settings page (business name, logo on invoice, tax)
- P2: WhatsApp/SMS invoice share

## Update (June 2026)
- Shifra në Shitje: e shkruajtshme; kod (P-xxxxx) ose barkod + Enter plotëson artikullin.
- "+ Krijo artikull të ri" brenda listës së produkteve në Shitje (vetëm admin) – dritare e shpejtë, shitja nuk humbet.
- Barkod: shkruhet vetë ose butoni "Gjenero" (EAN-13 "20..."); bosh = gjenerohet automatikisht; kontroll për dublikatë në krijim dhe editim.
- Forma e artikullit u nda në komponent të përbashkët: components/ProductFormDialog.jsx.
- Kërkimi te Artikujt gjen edhe sipas Shifrës.
## Backlog
- P2: Ndarja e tabelës së shitjes në komponent më vete.
- Kolona "Barkodi" në Shitje: skanim me skaner/tastierë + Enter ose me kamerë; gjen artikullin sipas barkodit (ose IMEI-t në stok); shton dhe fokuson rresht të ri automatikisht.
- Krijo Artikull → seksioni "Blerja": Furnitor ose Qytetar (emri, telefoni, nr. personal – ruhen te /api/citizens), totali, paguar (parazgjedhje i plotë, i ndryshueshëm). Ruhet automatikisht si blerje te Blerjet; borxhi shtohet te furnitori; stoku hyn direkt.
- Shitja: IMEI plotësohet automatikisht për telefona (IMEI i skanuar, ose i pari në stok që s’është në rresht tjetër).
- Shitja: IMEI fushë teksti me sugjerime, validim i plotë para ruajtjes (pa humbje stoku), fatura (A4/80mm/PDF) me Shifra, Barkodi, Përshkrimi, IMEI.
- Krijo/Edito Artikull: seksion IMEI për telefona (edhe në editim, add_imeis), IMEI i shkruar ruhet edhe pa Enter, unik mes artikujve (në stok). IMEI del automatikisht te Shitja.
- Shifra: numër rendor i thjeshtë (1, 2, 3...), kodet e vjetra P-0000X u kthyen në numra.
- Pagesa/Borxhe: lista e klientëve/furnitorëve me borxh; kolona Pagesa + Mbetet (llogaritet vetë), butoni Paguaj; historiku me borxhin para/pas; validim shuma >0 dhe ≤ borxhi.
- Pagesa/Borxhe: klik te klienti → historia e borxhit (fatura me borxh, pagesa, kthime, gjendja), WhatsApp dhe PDF A4 (/api/customers/{id}/statement.pdf).
- Historia e klientit: klik te fatura me borxh → borxhi i faturës, pagesat (FIFO, më e vjetra e para), kthimet dhe Mbetet.
- Fshirja e pagesës (DELETE /api/payments/{id}) kthen borxhin. Historia e furnitorit (drawer, ledger, FIFO për blerje, WhatsApp, PDF /api/suppliers/{id}/statement.pdf).
- PDF e faturës: seksion "Pagesat e borxhit të kësaj fature" (borxhi, çdo pagesë/kthim, mbetet).
- PDF A4 e borxhit (klient/furnitor): të gjitha faturat me borxh në një dokument (artikujt, paguar, pagesat, mbetet).
- Drawer i klientit: vetëm info + borxhi aktual + butona të mëdhenj WhatsApp/PDF A4. WhatsApp: numri 0xx→383xx, mesazh me borxhin, faturat e hapura dhe link publik PDF (/api/public/statement/{cid}/{token}.pdf, token HMAC).
- Kartela e borxhit (PDF/PNG): vetëm tabela përmbledhëse + kolona Përshkrimi (produkti, GB/RAM/bateria, IMEI); WhatsApp dërgon vetëm foto (Web Share në telefon; në kompjuter shkarkon foton + hap bisedën). Endpoint /statement.png (PyMuPDF).
- Kartela e blerësve (/customer-cards, nën Financa pas Pagesa/Borxhe): pasqyra e të gjithë klientëve (fatura, blerë, paguar, borxhi, statusi), filtra, WhatsApp foto + PDF A4; PDF shfaq "PAGUAR PLOTËSISHT" kur borxhi = 0.
- Shitja vendore: butoni "Shto klient" + opsioni "+ Shto klient të ri" (dialog i shpejtë, zgjidhet automatikisht). "Klient i rastit" → "Qytetar" kudo.
- Shitja vendore: hoqa Limiti/Gjendja; shtova Garancioni (butona 1–12 muaj + shkrim i lirë, vlen për të gjithë artikujt); Përshkrimi me kërkim (shkruaj emër/shifër/barkod) + "Krijo artikull: <tekst>".
- Garancioni: dropdown si Çmimorja (Sipas artikullit, 1–12 muaj) + shkrim i lirë me njësi ditë/muaj; muajt llogariten si muaj kalendarikë; fatura tregon "Garanci X deri: data".
- Garancioni: klik "ditë" → rrjetë 1–100 ditë me klik; "muaj" → lista 1–12 muaj.
- Kushtet e garancionit (tekst i ndryshueshëm, /api/settings/warranty-terms) printohen në A4 vetëm për shitje me pakicë me garanci, me nënshkrime Shitësi/Blerësi. Garancioni: parazgjedhje "Pa garanci" (0). Butoni "Ruaj & Printo A4".
- Fatura A4: shkronja më të mëdha (tabela 15px, totali 22px, kushtet 11px); klienti në krye pranë nr. faturës; 1–3 telefona + kushtet hyjnë në një faqe.
- Branding faturash: logo HITECHZONE (/htz-logo.png, backend/assets) + HIGH TECH ZONE SH.P.K., Rr. Henri Dunan nr. 6, NUI 811313620, Tel 044 104 605, htz.ks@hotmail.com në A4, 80/58mm, PDF fature dhe kartelë borxhi (frontend/src/lib/company.js, COMPANY në server.py).
- Kushtet e garancionit në A4: shkronja 14px (titujt 16px); mund të kalojnë në faqe të dytë.
- Shitja vendore: butonat Blerja (/purchases?new=1), Kthimi i produktit (/returns?new=1 – gjej faturën me nr. ose IMEI), Shpenzimet (/expenses: CRUD, filtër sipas muajit, totali; nav Financa > Shpenzimet).
- Blerje e re: butonat "Shto furnitor" (dialog i shpejtë, zgjidhet vetë) dhe "Krijo artikull" (ProductFormDialog catalogOnly → shtohet si rresht në blerje, pa dyfishim stoku).
- Rikthimi: shuma llogaritet sipas pagesës pas zbritjes (çmimi × total/nëntotal), maksimumi = totali − të kthyerat më parë (refunded_amount); shuma mund të shkruhet manualisht (refund_amount), butoni Auto.
- RREGULL: Fusha IMEI te forma e artikullit shfaqet GJITHMONË poshtë Barkodit gjatë krijimit (edhe nga Blerja/Shitja); mos e fshih më. Shtimi i IMEI e kthen llojin në Telefon; nga Blerja IMEI-t kalojnë te rreshti i blerjes.

## 2026-06 Update
- SaleEntryPage: added quick buttons Artikujt (/products), Stoku (/stock), Borxhet (/payments) next to Blerja/Kthimi/Shpenzimet
- ProductFormDialog: Barkod full-width, IMEI section directly below it (verified in Purchases "Krijo Artikull")

- 2026-06: Kartela e furnitorëve (/supplier-cards, GET /api/supplier-cards) with Paguaj dialog, PDF/WhatsApp; buttons Kartela e blerësve/furnitorëve on Shitja vendore (admin)

- 2026-06: Zekati te Stoku (admin): per vit, 2.5% e (vlera e blerjes se stokut + fitim simbolik %), shuma e ndryshueshme, pagesa pjese-pjese me mbetje, fshirje. Endpoints /api/zakat, /api/zakat/{id}/payments, DELETE /api/zakat/payments/{pid}

- 2026-06: Shitja vendore quick buttons save draft (sessionStorage sale-draft) + floating "Kthehu te Shitja vendore" button (back-to-sale-btn) restores the sale

- 2026-06: Qarkullimet Ditore (/daily-flow, backend/daybook.py): kalendar, tabela nga shitjet/blerjet/shpenzimet/pagesat/kthimet + hyrje/dalje manuale, korrigjime me historik (edhe nga Faturat/Blerjet/Shpenzimet), Arka Ditore me bartje, Numërimi i Parave 12 prerje, fitimi ditor, raporte ditë/muaj/vit me Excel+PDF. Admin only. Test data cleaned; user must set Arka fillestare.

- 2026-06: Servis / Shërbimi (/services, backend/services.py): pranim, kërkim, filtra, statuse, historik, fshirje e butë, fletëpranim A4; integruar te Qarkullimet Ditore (pranuar sot vs arkëtuar; paraja hyn vetëm në dorëzim, kostoja e pjesëve zbritet nga fitimi)

- 2026-06: Cash / Card-Bank / Cash+Card-Bank (mixed). finance.py: rates (card_coef 1.33, bank_fee 6%, VAT 18%, profit tax 10%) editable via Normat (Qarkullimet Ditore), snapshot per sale (sale.rates, normal_total, cash_paid, card_paid, card_surcharge, bank_fee, vat). Card part x coef once; fee & VAT only card/mixed; daybook: turnover cash/card/total, cash only cash parts, profit before tax, tax on positive period profit, net. Invoice shows surcharge + cash/card parts, never fee/cost. Half-up rounding both sides. Services: WhatsApp "gati" text message.

- 2026-06: Servis: pjesë nga stoku (POST/DELETE /api/services/{id}/parts), zbritje/kthim stoku, regjistrim në stock_movements (produkt, sasi, servis, klient, përdorues); kostoja e pjesëve zbritet nga fitimi i servisit; fshirja e servisit kthen pjesët.

- 2026-06: Bankat (banks.py): TEB, Raiffeisen, BKT, NLB. Shitja card/mixed kërkon bankën (sale.bank); banka merr card_paid - komisioni. Blerje/shpenzime/pagesa borxhesh: pay_method cash|bank + bank. Transferta Arka<->Bankë/Bankë<->Bankë (bank_transfers). /banks: gjendja + historiku me saldo. Daybook: daljet me bankë nuk prekin arkën; transfertat lëvizin arkën. Fillojnë nga 0.
