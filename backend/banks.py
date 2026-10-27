"""Bank accounts (TEB, Raiffeisen, BKT, NLB): balances and movement history, plus Cash <-> Bank transfers."""
from datetime import datetime
from typing import Optional, Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

BANKS = ["TEB", "Raiffeisen", "BKT", "NLB"]
TZ = ZoneInfo("Europe/Belgrade")


def check_bank(method: str, bank: Optional[str]) -> Optional[str]:
    """Returns the bank for a bank payment, None for cash; rejects a bank payment without a valid bank."""
    if method != "bank":
        return None
    if bank not in BANKS:
        raise HTTPException(400, "Zgjidh bankën: " + ", ".join(BANKS))
    return bank


class TransferIn(BaseModel):
    source: str  # "cash" or a bank
    target: str
    amount: float = Field(gt=0)
    date: Optional[str] = None
    note: str = Field(default="", max_length=200)


def _day(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).astimezone(TZ).date().isoformat()
    except (TypeError, ValueError):
        return ""


async def movements(db) -> list:
    """Every money movement on the bank accounts, computed from the source documents (never stored twice)."""
    out = []
    names = {str(c["_id"]): c.get("name", "") async for c in db.customers.find({}, {"name": 1})}
    names.update({str(c["_id"]): c.get("name", "") async for c in db.suppliers.find({}, {"name": 1})})
    async for s in db.sales.find({"bank": {"$in": BANKS}}):
        net = round(float(s.get("card_paid") or 0) - float(s.get("bank_fee") or 0), 2)
        out.append({"bank": s["bank"], "date": s.get("document_date") or _day(s["created_at"]), "at": s["created_at"], "type": "Shitje (pas komisionit)",
                    "doc": s.get("invoice_no", ""), "description": f"{s.get('customer_name') or 'Qytetar'} · kartelë {s.get('card_paid', 0):.2f} € − komision {s.get('bank_fee', 0):.2f} €",
                    "in": net, "out": 0.0})
    async for p in db.purchases.find({"bank": {"$in": BANKS}}):
        out.append({"bank": p["bank"], "date": _day(p["created_at"]), "at": p["created_at"], "type": "Blerje", "doc": f"BL-{str(p['_id'])[-6:].upper()}",
                    "description": ", ".join(i.get("product_name", "") for i in p.get("items", [])), "in": 0.0, "out": round(float(p.get("paid_amount") or 0), 2)})
    async for e in db.expenses.find({"bank": {"$in": BANKS}}):
        out.append({"bank": e["bank"], "date": e["date"], "at": e.get("created_at", e["date"]), "type": "Shpenzim", "doc": "",
                    "description": f"{e.get('category', '')} {e.get('description', '')}".strip(), "in": 0.0, "out": round(float(e["amount"]), 2)})
    async for p in db.payments.find({"bank": {"$in": BANKS}}):
        is_c = p.get("entity_type") == "customer"
        amt = round(float(p["amount"]), 2)
        out.append({"bank": p["bank"], "date": _day(p["created_at"]), "at": p["created_at"], "type": "Arkëtim borxhi" if is_c else "Pagesë furnitori",
                    "doc": "", "description": names.get(p.get("entity_id"), ""), "in": amt if is_c else 0.0, "out": 0.0 if is_c else amt})
    async for t in db.bank_transfers.find({}):
        label = lambda x: "Arka" if x == "cash" else x  # noqa: E731
        base = {"date": t["date"], "at": t["created_at"], "doc": "", "transfer_id": str(t["_id"]),
                "description": f"{label(t['source'])} → {label(t['target'])}{' · ' + t['note'] if t.get('note') else ''}"}
        if t["source"] in BANKS:
            out.append({**base, "bank": t["source"], "type": "Tërheqje" if t["target"] == "cash" else "Transfertë dalëse", "in": 0.0, "out": t["amount"]})
        if t["target"] in BANKS:
            out.append({**base, "bank": t["target"], "type": "Depozitim" if t["source"] == "cash" else "Transfertë hyrëse", "in": t["amount"], "out": 0.0})
    out.sort(key=lambda m: (m["date"], m["at"]))
    return out


def make_router(db, require_admin, now_utc):
    router = APIRouter(prefix="/banks")

    @router.get("")
    async def balances(_a: dict = Depends(require_admin)):
        ms = await movements(db)
        res = []
        for b in BANKS:
            mine = [m for m in ms if m["bank"] == b]
            tin, tout = round(sum(m["in"] for m in mine), 2), round(sum(m["out"] for m in mine), 2)
            res.append({"bank": b, "in": tin, "out": tout, "balance": round(tin - tout, 2), "count": len(mine)})
        return {"banks": res, "total": round(sum(x["balance"] for x in res), 2)}

    @router.get("/history/{bank}")
    async def history(bank: str, date_from: str = "", date_to: str = "", _a: dict = Depends(require_admin)):
        if bank not in BANKS:
            raise HTTPException(404, "Banka nuk ekziston")
        bal, rows = 0.0, []
        for m in [m for m in await movements(db) if m["bank"] == bank]:
            bal = round(bal + m["in"] - m["out"], 2)
            if (not date_from or m["date"] >= date_from) and (not date_to or m["date"] <= date_to):
                rows.append({**m, "balance": bal})
        return list(reversed(rows))

    @router.post("/transfers")
    async def transfer(body: TransferIn, user: dict = Depends(require_admin)):
        valid = ["cash"] + BANKS
        if body.source not in valid or body.target not in valid or body.source == body.target:
            raise HTTPException(400, "Zgjidh burimin dhe destinacionin (të ndryshëm)")
        if body.source == "cash" and body.target == "cash":
            raise HTTPException(400, "Të paktën njëra anë duhet të jetë bankë")
        try:
            day = datetime.fromisoformat(body.date).date().isoformat() if body.date else datetime.now(TZ).date().isoformat()
        except ValueError:
            raise HTTPException(400, "Data nuk është e vlefshme")
        doc = {"source": body.source, "target": body.target, "amount": round(body.amount, 2), "date": day, "note": body.note.strip(),
               "created_at": now_utc().isoformat(), "created_by": user["id"], "created_by_name": user.get("name", "")}
        r = await db.bank_transfers.insert_one(doc)
        return {"id": str(r.inserted_id)}

    @router.delete("/transfers/{tid}")
    async def delete_transfer(tid: str, _a: dict = Depends(require_admin)):
        if not ObjectId.is_valid(tid) or not (await db.bank_transfers.delete_one({"_id": ObjectId(tid)})).deleted_count:
            raise HTTPException(404, "Transferta nuk u gjet")
        return {"ok": True}

    return router
