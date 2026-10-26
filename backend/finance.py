"""Card-Bank coefficient, bank fee, VAT and profit tax settings + payment split."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

DEFAULTS = {"card_coef": 1.33, "bank_fee_pct": 6.0, "vat_pct": 18.0, "profit_tax_pct": 10.0}


class RatesIn(BaseModel):
    card_coef: float = Field(ge=1, le=3)
    bank_fee_pct: float = Field(ge=0, le=50)
    vat_pct: float = Field(ge=0, le=50)
    profit_tax_pct: float = Field(ge=0, le=50)


async def get_rates(db) -> dict:
    doc = await db.finance_settings.find_one({"_id": "rates"}) or {}
    return {k: float(doc.get(k, v)) for k, v in DEFAULTS.items()}


def split_payment(normal_total: float, method: str, cash_amount: Optional[float], rates: dict) -> dict:
    """Cash part stays at the normal price; only the part paid by Card-Bank is multiplied (once) by the coefficient."""
    normal_total = round(normal_total, 2)
    if method == "mixed":
        cash = round(float(cash_amount or 0), 2)
        if cash <= 0 or cash >= normal_total:
            raise HTTPException(400, "Te pagesa e kombinuar shuma Cash duhet të jetë më e madhe se 0 dhe më e vogël se çmimi normal")
    elif method == "card":
        cash = 0.0
    else:
        return {"cash_paid": normal_total, "card_normal": 0.0, "card_paid": 0.0, "bank_fee": 0.0, "final_total": normal_total, "vat": 0.0}
    card_normal = round(normal_total - cash, 2)
    card_paid = round(card_normal * rates["card_coef"], 2)
    final_total = round(cash + card_paid, 2)
    return {
        "cash_paid": cash, "card_normal": card_normal, "card_paid": card_paid,
        "bank_fee": round(card_paid * rates["bank_fee_pct"] / 100, 2), "final_total": final_total,
        "vat": round(final_total * rates["vat_pct"] / (100 + rates["vat_pct"]), 2),
    }


def make_router(db, get_current_user, require_admin):
    router = APIRouter(prefix="/finance-settings")

    @router.get("")
    async def read(_u: dict = Depends(get_current_user)):
        return await get_rates(db)

    @router.put("")
    async def write(body: RatesIn, _a: dict = Depends(require_admin)):
        await db.finance_settings.update_one({"_id": "rates"}, {"$set": body.model_dump()}, upsert=True)
        return await get_rates(db)

    return router
