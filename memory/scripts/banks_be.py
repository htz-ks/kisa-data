p = "/app/backend/server.py"
s = open(p).read()
BANKF = '''    pay_method: Literal["cash", "bank"] = "cash"
    bank: Optional[str] = None
'''
pairs = [
    ('''    seller_name: Optional[str] = ""  # typed manually when not a saved supplier
''', '''    seller_name: Optional[str] = ""  # typed manually when not a saved supplier
''' + BANKF),
    ('''    direction: Literal["in", "out"]  # 'in' = received from customer, 'out' = paid to supplier
    notes: Optional[str] = ""
''', '''    direction: Literal["in", "out"]  # 'in' = received from customer, 'out' = paid to supplier
    notes: Optional[str] = ""
''' + BANKF),
    ('''    amount: float
    date: Optional[str] = None


@api.get("/expenses")''', '''    amount: float
    date: Optional[str] = None
''' + BANKF + '''

@api.get("/expenses")'''),
    ('''    cash_amount: Optional[float] = None  # cash part of a mixed payment
''', '''    cash_amount: Optional[float] = None  # cash part of a mixed payment
    bank: Optional[str] = None  # bank that received the card part
'''),
    ('''    split = split_payment(normal_total, body.payment_method, body.cash_amount, rates)
''', '''    split = split_payment(normal_total, body.payment_method, body.cash_amount, rates)
    sale_bank = check_bank("bank" if body.payment_method in ("card", "mixed") else "cash", body.bank)
'''),
    ('''        "rates": rates,
''', '''        "rates": rates, "bank": sale_bank,
'''),
    ('''        "supplier_id": body.supplier_id or None,
''', '''        "supplier_id": body.supplier_id or None,
        "pay_method": body.pay_method, "bank": check_bank(body.pay_method, body.bank),
'''),
    ('''    doc = body.model_dump()
    doc.update({
        "balance_before": before,''', '''    doc = body.model_dump()
    doc["bank"] = check_bank(body.pay_method, body.bank)
    doc.update({
        "balance_before": before,'''),
    ('''    doc["category"] = doc["category"][:60]
''', '''    doc["category"] = doc["category"][:60]
    doc["bank"] = check_bank(body.pay_method, body.bank)
'''),
    ('''from daybook import make_router as make_daybook_router  # noqa: E402''', '''from banks import make_router as make_banks_router  # noqa: E402
api.include_router(make_banks_router(db, require_admin, now_utc))
from daybook import make_router as make_daybook_router  # noqa: E402'''),
    ('from finance import get_rates, split_payment', 'from finance import get_rates, split_payment\nfrom banks import check_bank'),
]
for a, b in pairs:
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
open(p, "w").write(s)

# daybook: bank-paid purchases/expenses/payments leave the cash; transfers move money cash <-> bank
p = "/app/backend/daybook.py"
s = open(p).read()
pairs = [
    ('''                "hyrje": amt if is_c else 0.0, "dalje": 0.0 if is_c else amt, "method": "cash",''',
     '''                "hyrje": amt if is_c else 0.0, "dalje": 0.0 if is_c else amt, "method": "bank" if p.get("bank") else "cash", "bank": p.get("bank"),'''),
    ('''"invoice_no": f"BL-{str(p['_id'])[-6:].upper()}", "hyrje": 0.0, "dalje": r2(p.get("paid_amount")),
                "method": "cash",''', '''"invoice_no": f"BL-{str(p['_id'])[-6:].upper()}", "hyrje": 0.0, "dalje": r2(p.get("paid_amount")),
                "method": "bank" if p.get("bank") else "cash", "bank": p.get("bank"),'''),
    ('''                "hyrje": 0.0, "dalje": amt, "method": "cash", "revenue": 0.0, "cost": 0.0, "cost_missing": False,
                "opex": amt, "value": amt, "note": "",''', '''                "hyrje": 0.0, "dalje": amt, "method": "bank" if e.get("bank") else "cash", "bank": e.get("bank"),
                "revenue": 0.0, "cost": 0.0, "cost_missing": False, "opex": amt, "value": amt, "note": "",'''),
    ('''        async for m in db.daybook_manual.find(''', '''        async for t in db.bank_transfers.find({"date": {"$gte": d_from, "$lte": d_to}}):
            src, dst, amt = t["source"], t["target"], r2(t["amount"])
            lbl = lambda x: "Arka" if x == "cash" else x  # noqa: E731
            out.append({
                "key": f"transfer:{t['_id']}", "source": "transfer", "source_id": str(t["_id"]), "date": t["date"], "time": t["created_at"],
                "type": "Depozitim në bankë" if src == "cash" else ("Tërheqje nga banka" if dst == "cash" else "Transfertë bankare"),
                "description": f"{lbl(src)} → {lbl(dst)}{' · ' + t['note'] if t.get('note') else ''}", "invoice_no": "",
                "hyrje": amt if dst == "cash" else 0.0, "dalje": amt if src == "cash" else 0.0, "method": "cash" if "cash" in (src, dst) else "bank",
                "cash_in": amt if dst == "cash" else 0.0, "bank_in": amt if dst != "cash" else 0.0,
                "revenue": 0.0, "cost": 0.0, "cost_missing": False, "opex": 0.0, "value": amt, "note": "",
            })

        async for m in db.daybook_manual.find('''),
    ('''            e["cash_out"], e["bank_out"] = (0.0, e["dalje"]) if e["method"] == "bank" else (e["dalje"], 0.0)''',
     '''            if e["source"] == "transfer":
                e["cash_out"] = e["dalje"]
                e["bank_out"] = e["value"] if not e["dalje"] else 0.0
            else:
                e["cash_out"], e["bank_out"] = (0.0, e["dalje"]) if e["method"] == "bank" else (e["dalje"], 0.0)'''),
]
for a, b in pairs:
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
open(p, "w").write(s)
print("ok")
