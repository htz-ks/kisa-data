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
