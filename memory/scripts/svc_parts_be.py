p = "/app/backend/services.py"
s = open(p).read()
pairs = [
    ('''class StatusIn(BaseModel):''', '''class PartIn(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=1000)


class StatusIn(BaseModel):'''),
    ('''    d["status_label"] = STATUSES.get(doc.get("status"), doc.get("status"))
    return d''', '''    d["status_label"] = STATUSES.get(doc.get("status"), doc.get("status"))
    d["parts"] = doc.get("parts", [])
    d["stock_parts_cost"] = round(sum(x["cost_price"] * x["quantity"] for x in d["parts"]), 2)
    return d'''),
    ('''    @router.delete("/{sid}")
    async def delete(sid: str, user: dict = Depends(require_admin)):''', '''    async def move_stock(prod: dict, qty: int, s: dict, user: dict, reason: str):
        # every stock movement caused by a service is recorded
        await db.stock_movements.insert_one({
            "product_id": str(prod["_id"]), "product_name": prod.get("name", ""), "quantity": qty, "reason": reason,
            "source": "service", "source_id": str(s["_id"]), "service_number": s.get("number"),
            "customer": f"{s.get('first_name', '')} {s.get('last_name', '')}".strip(), "customer_phone": s.get("phone", ""),
            "at": now_utc().isoformat(), "user": user.get("name") or user.get("email", ""),
        })

    @router.post("/{sid}/parts")
    async def add_part(sid: str, body: PartIn, user: dict = Depends(require_admin)):
        s = await get(sid)
        prod = await db.products.find_one({"_id": ObjectId(body.product_id)}) if ObjectId.is_valid(body.product_id) else None
        if not prod:
            raise HTTPException(404, "Produkti nuk u gjet")
        if prod.get("type") == "phone":
            raise HTTPException(400, "Telefonat me IMEI nuk mund të merren si pjesë servisi")
        r = await db.products.update_one({"_id": prod["_id"], "quantity": {"$gte": body.quantity}}, {"$inc": {"quantity": -body.quantity}})
        if not r.modified_count:
            raise HTTPException(400, f"Sasia e pamjaftueshme në stok për {prod['name']} (ka {prod.get('quantity', 0)})")
        part = {"id": str(ObjectId()), "product_id": str(prod["_id"]), "name": prod.get("name", ""), "code": prod.get("code", ""),
                "quantity": body.quantity, "cost_price": round(float(prod.get("cost_price") or 0), 2), "at": now_utc().isoformat()}
        await db.services.update_one({"_id": s["_id"]}, {"$push": {"parts": part, "history": {**who(user), "action": "Pjesë nga stoku", "changes": {"pjesa": [None, f"{part['name']} × {part['quantity']}"]}}}})
        await move_stock(prod, -body.quantity, s, user, f"Marrë për servisin {s.get('number')}")
        return out(await get(sid))

    @router.delete("/{sid}/parts/{pid}")
    async def remove_part(sid: str, pid: str, user: dict = Depends(require_admin)):
        s = await get(sid)
        part = next((x for x in s.get("parts", []) if x["id"] == pid), None)
        if not part:
            raise HTTPException(404, "Pjesa nuk u gjet")
        prod = await db.products.find_one({"_id": ObjectId(part["product_id"])})
        await db.services.update_one({"_id": s["_id"]}, {"$pull": {"parts": {"id": pid}}, "$push": {"history": {**who(user), "action": "Pjesa u kthye në stok", "changes": {"pjesa": [f"{part['name']} × {part['quantity']}", None]}}}})
        if prod:
            await db.products.update_one({"_id": prod["_id"]}, {"$inc": {"quantity": part["quantity"]}})
            await move_stock(prod, part["quantity"], s, user, f"Kthyer nga servisi {s.get('number')}")
        return out(await get(sid))

    @router.delete("/{sid}")
    async def delete(sid: str, user: dict = Depends(require_admin)):'''),
    # deleting a service returns its stock parts
    ('''        old = await get(sid)
        await db.services.update_one({"_id": old["_id"]}, {"$set": {"deleted": True,''', '''        old = await get(sid)
        for part in old.get("parts", []):
            if (prod := await db.products.find_one({"_id": ObjectId(part["product_id"])})):
                await db.products.update_one({"_id": prod["_id"]}, {"$inc": {"quantity": part["quantity"]}})
                await move_stock(prod, part["quantity"], old, user, f"Kthyer nga servisi i fshirë {old.get('number')}")
        await db.services.update_one({"_id": old["_id"]}, {"$set": {"deleted": True,'''),
]
for a, b in pairs:
    assert a in s, a[:70]
    s = s.replace(a, b, 1)
open(p, "w").write(s)

p = "/app/backend/daybook.py"
s = open(p).read()
a = '''            cost = r2(sv.get("parts_cost"))
            if paid <= 0 and cost <= 0:'''
assert a in s
s = s.replace(a, '''            cost = r2(r2(sv.get("parts_cost")) + sum(x["cost_price"] * x["quantity"] for x in sv.get("parts", [])))
            if paid <= 0 and cost <= 0:''')
s = s.replace('''"note": "falas / garanci" if paid <= 0 else ("pa kosto pjesësh" if sv.get("parts_cost") is None else ""),''',
              '''"note": "falas / garanci" if paid <= 0 else ("pa kosto pjesësh" if sv.get("parts_cost") is None and not sv.get("parts") else ""),''')
open(p, "w").write(s)
print("ok")
