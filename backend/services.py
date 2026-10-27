"""Servis / Shërbimi: phones received for repair."""
import io
import re
from xml.sax.saxutils import escape
from datetime import datetime
from typing import Optional, Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

TZ = ZoneInfo("Europe/Belgrade")
STATUSES = {"pending": "Në pritje", "repairing": "Në riparim", "repaired": "I riparuar", "not_repaired": "Nuk u riparua",
            "delivered": "I dorëzuar klientit", "refunded": "Kthim i pagesës"}
REFUND_CLEAR = {"refund_amount": None, "refund_method": None, "refund_date": None, "refund_at": None}
FIELDS = ("first_name", "last_name", "phone", "device", "defect", "received_date", "price", "parts_cost", "notes")


def today_local() -> str:
    return datetime.now(TZ).date().isoformat()


def valid_day(s: str) -> str:
    try:
        return datetime.fromisoformat(s).date().isoformat()
    except (TypeError, ValueError):
        raise HTTPException(400, "Data nuk është e vlefshme")


class ServiceIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(default="", max_length=80)
    phone: str = Field(min_length=3, max_length=40)
    device: str = Field(min_length=1, max_length=120)
    defect: str = Field(min_length=1, max_length=500)
    received_date: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    parts_cost: Optional[float] = Field(default=None, ge=0)
    notes: str = Field(default="", max_length=1000)


class PartIn(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=1000)


class StatusIn(BaseModel):
    status: Literal["pending", "repairing", "repaired", "not_repaired", "delivered", "refunded"]
    paid_amount: Optional[float] = Field(default=None, ge=0)
    paid_method: Literal["cash", "bank"] = "cash"


def out(doc: dict) -> dict:
    d = {k: v for k, v in doc.items() if k != "_id"}
    d["id"] = str(doc["_id"])
    d["status_label"] = STATUSES.get(doc.get("status"), doc.get("status"))
    d["parts"] = doc.get("parts", [])
    d["stock_parts_cost"] = round(sum(x["cost_price"] * x["quantity"] for x in d["parts"]), 2)
    return d


def make_router(db, require_admin, now_utc, company_header):
    router = APIRouter(prefix="/services")

    def who(user: dict) -> dict:
        return {"at": now_utc().isoformat(), "user": user.get("name") or user.get("email", "")}

    async def get(sid: str) -> dict:
        doc = await db.services.find_one({"_id": ObjectId(sid), "deleted": {"$ne": True}}) if ObjectId.is_valid(sid) else None
        if not doc:
            raise HTTPException(404, "Servisi nuk u gjet")
        return doc

    @router.get("")
    async def list_services(q: str = "", status: str = "", date_from: str = "", date_to: str = "", _a: dict = Depends(require_admin)):
        f: dict = {"deleted": {"$ne": True}}
        if status in STATUSES:
            f["status"] = status
        if date_from or date_to:
            f["received_date"] = {**({"$gte": valid_day(date_from)} if date_from else {}), **({"$lte": valid_day(date_to)} if date_to else {})}
        if q.strip():
            rx = {"$regex": re.escape(q.strip()), "$options": "i"}
            f["$or"] = [{"first_name": rx}, {"last_name": rx}, {"phone": rx}, {"device": rx}, {"number": rx}, {"defect": rx}]
        rows = await db.services.find(f).sort([("received_date", -1), ("created_at", -1)]).to_list(2000)
        return [out(r) for r in rows]

    @router.post("")
    async def create(body: ServiceIn, user: dict = Depends(require_admin)):
        c = await db.counters.find_one_and_update({"_id": "service"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
        data = body.model_dump()
        data["received_date"] = valid_day(body.received_date) if body.received_date else today_local()
        doc = {**data, "number": f"S-{c['seq']:04d}", "status": "pending", "paid_amount": None, "paid_method": None,
               "delivered_date": None, "created_at": now_utc().isoformat(), "created_by": user["id"],
               "history": [{**who(user), "action": "Pranuar në servis", "changes": {}}]}
        r = await db.services.insert_one(doc)
        doc["_id"] = r.inserted_id
        return out(doc)

    @router.get("/{sid}")
    async def one(sid: str, _a: dict = Depends(require_admin)):
        return out(await get(sid))

    @router.put("/{sid}")
    async def update(sid: str, body: ServiceIn, user: dict = Depends(require_admin)):
        old = await get(sid)
        new = body.model_dump()
        new["received_date"] = valid_day(body.received_date) if body.received_date else old["received_date"]
        changes = {k: [old.get(k), new[k]] for k in FIELDS if old.get(k) != new[k]}
        if not changes:
            return out(old)
        await db.services.update_one({"_id": old["_id"]}, {"$set": new, "$push": {"history": {**who(user), "action": "Të dhënat u ndryshuan", "changes": changes}}})
        return out(await get(sid))

    @router.patch("/{sid}/status")
    async def set_status(sid: str, body: StatusIn, user: dict = Depends(require_admin)):
        old = await get(sid)
        upd: dict = {"status": body.status}
        if body.status == "refunded":
            paid = float(old.get("paid_amount") or 0)
            if old.get("status") not in ("delivered", "refunded") or paid <= 0:
                raise HTTPException(400, "Kthimi i pagesës bëhet vetëm për servis të dorëzuar dhe të paguar")
            amt = round(paid if body.paid_amount is None else body.paid_amount, 2)
            if amt <= 0 or amt > paid:
                raise HTTPException(400, f"Shuma e kthimit duhet të jetë nga 0.01 deri në {paid:.2f} €")
            upd.update({"refund_amount": amt, "refund_method": body.paid_method, "refund_date": old.get("refund_date") or today_local(),
                        "refund_at": old.get("refund_at") or now_utc().isoformat()})
            await db.services.update_one({"_id": old["_id"]}, {"$set": upd, "$push": {"history": {**who(user), "action": "Kthim i pagesës",
                                         "changes": {"status": [STATUSES.get(old.get("status")), STATUSES["refunded"]], "kthyer": [old.get("refund_amount"), amt]}}}})
            return out(await get(sid))
        upd.update(REFUND_CLEAR)
        if body.status == "delivered":
            if body.paid_amount is None:
                raise HTTPException(400, "Shkruaj sa pagoi klienti (0 nëse falas)")
            upd.update({"paid_amount": round(body.paid_amount, 2), "paid_method": body.paid_method,
                        "delivered_date": today_local() if old.get("status") != "delivered" else old.get("delivered_date") or today_local(),
                        "delivered_at": now_utc().isoformat() if old.get("status") != "delivered" else old.get("delivered_at") or now_utc().isoformat()})
        else:
            upd.update({"paid_amount": None, "paid_method": None, "delivered_date": None, "delivered_at": None})
        changes = {"status": [STATUSES.get(old.get("status")), STATUSES[body.status]]}
        if body.status == "delivered":
            changes["paguar"] = [old.get("paid_amount"), upd["paid_amount"]]
        await db.services.update_one({"_id": old["_id"]}, {"$set": upd, "$push": {"history": {**who(user), "action": "Statusi u ndryshua", "changes": changes}}})
        return out(await get(sid))

    async def move_stock(prod: dict, qty: int, s: dict, user: dict, reason: str):
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
    async def delete(sid: str, user: dict = Depends(require_admin)):
        old = await get(sid)
        for part in old.get("parts", []):
            if (prod := await db.products.find_one({"_id": ObjectId(part["product_id"])})):
                await db.products.update_one({"_id": prod["_id"]}, {"$inc": {"quantity": part["quantity"]}})
                await move_stock(prod, part["quantity"], old, user, f"Kthyer nga servisi i fshirë {old.get('number')}")
        await db.services.update_one({"_id": old["_id"]}, {"$set": {"deleted": True, "deleted_at": now_utc().isoformat(), "deleted_by": user["id"]},
                                                          "$push": {"history": {**who(user), "action": "Fshirë", "changes": {}}}})
        return {"ok": True}

    @router.get("/{sid}/receipt.pdf")
    async def receipt(sid: str, _a: dict = Depends(require_admin)):
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        s = await get(sid)
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
        st = getSampleStyleSheet()
        body = ParagraphStyle("b", parent=st["Normal"], fontSize=11, leading=15)
        title = ParagraphStyle("t", parent=st["Title"], fontSize=20, textColor=colors.HexColor("#10B981"))
        d = s["received_date"].split("-")
        rows = [
            ["Nr. i servisit", s["number"]], ["Data e pranimit", f"{d[2]}.{d[1]}.{d[0]}"],
            ["Klienti", f"{s['first_name']} {s.get('last_name', '')}".strip()], ["Telefoni i klientit", s["phone"]],
            ["Pajisja (marka / modeli)", s["device"]], ["Defekti / problemi", Paragraph(escape(s["defect"]), body)],
            ["Çmimi i riparimit", f"{s['price']:.2f} €" if s.get("price") is not None else "Do të caktohet pas kontrollit"],
        ]
        if s.get("notes"):
            rows.append(["Shënime", Paragraph(escape(s["notes"]), body)])
        t = Table(rows, colWidths=[55 * mm, 125 * mm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        terms = Paragraph(
            "<b>Kushtet:</b> Telefoni pranohet për kontroll/riparim sipas defektit të përshkruar më sipër. "
            "Klienti duhet ta paraqesë këtë fletë kur e merr telefonin. Servisi nuk mban përgjegjësi për të dhënat në telefon; "
            "rekomandohet ruajtja e tyre paraprakisht. Telefonat që nuk tërhiqen brenda 60 ditëve pas njoftimit nuk garantohen.", body)
        sign = Table([["Nënshkrimi i klientit", "Nënshkrimi i servisit"], ["\n\n______________________", "\n\n______________________"]], colWidths=[90 * mm, 90 * mm])
        sign.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 11), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
        story = company_header("Fletëpranim Servisi") + [Paragraph(f"Fletëpranim Servisi · {s['number']}", title), Spacer(1, 6), t,
                                                         Spacer(1, 12), terms, Spacer(1, 28), sign]
        doc.build(story)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="servis_{s["number"]}.pdf"'})

    return router
