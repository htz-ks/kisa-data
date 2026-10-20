from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

# ------------- Mongo setup -------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ------------- App & router -------------
app = FastAPI(title="Prodata Stock & POS API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]


# ---------- Helpers ----------
def _oid(v):
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_oid)]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def doc_to_json(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ---------- Models ----------
class LoginBody(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "employee"] = "employee"
    daily_target: float = 0.0
    commission_percent: float = 0.0


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "employee"]] = None
    password: Optional[str] = None
    daily_target: Optional[float] = None
    commission_percent: Optional[float] = None


class CategoryIn(BaseModel):
    name: str


class SupplierIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""


class CustomerIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    credit_limit: float = 0.0


class IMEIItem(BaseModel):
    imei: str
    status: Literal["in_stock", "sold"] = "in_stock"


class PurchaseSource(BaseModel):
    seller_type: Literal["supplier", "citizen"] = "supplier"
    supplier_id: Optional[str] = ""
    citizen_name: Optional[str] = ""
    citizen_phone: Optional[str] = ""
    citizen_personal_no: Optional[str] = ""
    paid_amount: float = 0.0


class ProductIn(BaseModel):
    name: str
    type: Literal["phone", "accessory"] = "accessory"
    brand: Optional[str] = ""
    category_id: Optional[str] = ""
    barcode: Optional[str] = ""
    cost_price: float = 0.0
    sale_price: float = 0.0
    wholesale_price: float = 0.0
    quantity: int = 0  # for accessories
    low_stock_threshold: int = 2
    warranty_months: int = 12  # for phones
    gb: Optional[str] = ""
    ram: Optional[str] = ""
    battery_percent: Optional[str] = ""
    imeis: List[str] = []  # for phones (adds new IMEIs)
    description: Optional[str] = ""
    purchase: Optional[PurchaseSource] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category_id: Optional[str] = None
    barcode: Optional[str] = None
    cost_price: Optional[float] = None
    sale_price: Optional[float] = None
    wholesale_price: Optional[float] = None
    quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    warranty_months: Optional[int] = None
    gb: Optional[str] = None
    ram: Optional[str] = None
    battery_percent: Optional[str] = None
    description: Optional[str] = None


class PurchaseItem(BaseModel):
    product_id: str
    quantity: int = 1
    cost_price: float = 0.0
    imeis: List[str] = []


class PurchaseIn(BaseModel):
    supplier_id: Optional[str] = ""
    items: List[PurchaseItem]
    paid_amount: float = 0.0
    notes: Optional[str] = ""


class SaleItem(BaseModel):
    product_id: str
    quantity: int = 1
    sale_price: float = 0.0
    imei: Optional[str] = None  # for phone


class SaleIn(BaseModel):
    customer_id: Optional[str] = ""
    items: List[SaleItem]
    discount: float = 0.0
    paid_amount: float = 0.0
    payment_method: Literal["cash", "card", "debt"] = "cash"
    notes: Optional[str] = ""
    document_date: Optional[str] = None
    due_date: Optional[str] = None


class PaymentIn(BaseModel):
    entity_type: Literal["customer", "supplier"]
    entity_id: str
    amount: float
    direction: Literal["in", "out"]  # 'in' = received from customer, 'out' = paid to supplier
    notes: Optional[str] = ""


class ReturnItem(BaseModel):
    index: int  # index in sale.items
    quantity: int = 1


class ReturnIn(BaseModel):
    items: List[ReturnItem]
    reason: Optional[str] = ""


# ---------- Auth dependency ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nuk je i autentikuar")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesioni ka skaduar")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token i pavlefshëm")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Përdoruesi nuk ekziston")
    return doc_to_json(user)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Vetëm administratori ka qasje")
    return user


# ---------- Auth routes ----------
@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ose fjalëkalim i gabuar")
    token = create_access_token(str(user["_id"]), user["email"], user["role"])
    response.set_cookie(
        "access_token", token, httponly=True, secure=True, samesite="none",
        max_age=12 * 3600, path="/",
    )
    return {"user": doc_to_json(user), "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response, _user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Users (admin) ----------
@api.get("/users")
async def list_users(_admin: dict = Depends(require_admin)):
    users = await db.users.find({}).to_list(1000)
    return [doc_to_json(u) for u in users]


@api.post("/users")
async def create_user(body: UserCreate, _admin: dict = Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email ekziston")
    doc = {
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "daily_target": body.daily_target,
        "commission_percent": body.commission_percent,
        "created_at": now_utc().isoformat(),
    }
    r = await db.users.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@api.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, _admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
    if not update:
        raise HTTPException(400, "Asgjë për të përditësuar")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return doc_to_json(u)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if admin["id"] == user_id:
        raise HTTPException(400, "Nuk mund të fshish llogarinë tënde")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(_u: dict = Depends(get_current_user)):
    cs = await db.categories.find({}).sort("name", 1).to_list(1000)
    return [doc_to_json(c) for c in cs]


@api.post("/categories")
async def create_category(body: CategoryIn, _a: dict = Depends(require_admin)):
    doc = {"name": body.name, "created_at": now_utc().isoformat()}
    r = await db.categories.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@api.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, _a: dict = Depends(require_admin)):
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": {"name": body.name}})
    c = await db.categories.find_one({"_id": ObjectId(cid)})
    return doc_to_json(c)


@api.delete("/categories/{cid}")
async def delete_category(cid: str, _a: dict = Depends(require_admin)):
    await db.categories.delete_one({"_id": ObjectId(cid)})
    return {"ok": True}


# ---------- Suppliers ----------
@api.get("/suppliers")
async def list_suppliers(_u: dict = Depends(require_admin)):
    data = await db.suppliers.find({}).sort("name", 1).to_list(2000)
    return [doc_to_json(x) for x in data]


@api.post("/suppliers")
async def create_supplier(body: SupplierIn, _a: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc.update({"balance": 0.0, "created_at": now_utc().isoformat()})
    r = await db.suppliers.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@api.put("/suppliers/{sid}")
async def update_supplier(sid: str, body: SupplierIn, _a: dict = Depends(require_admin)):
    await db.suppliers.update_one({"_id": ObjectId(sid)}, {"$set": body.model_dump()})
    s = await db.suppliers.find_one({"_id": ObjectId(sid)})
    return doc_to_json(s)


@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, _a: dict = Depends(require_admin)):
    await db.suppliers.delete_one({"_id": ObjectId(sid)})
    return {"ok": True}


# ---------- Customers ----------
@api.get("/customers")
async def list_customers(_u: dict = Depends(get_current_user)):
    data = await db.customers.find({}).sort("name", 1).to_list(2000)
    return [doc_to_json(x) for x in data]


@api.post("/customers")
async def create_customer(body: CustomerIn, _u: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"balance": 0.0, "created_at": now_utc().isoformat()})
    r = await db.customers.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@api.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, _a: dict = Depends(require_admin)):
    await db.customers.update_one({"_id": ObjectId(cid)}, {"$set": body.model_dump()})
    c = await db.customers.find_one({"_id": ObjectId(cid)})
    return doc_to_json(c)


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, _a: dict = Depends(require_admin)):
    await db.customers.delete_one({"_id": ObjectId(cid)})
    return {"ok": True}


# ---------- Products ----------
@api.get("/products")
async def list_products(_u: dict = Depends(get_current_user)):
    data = await db.products.find({}).sort("name", 1).to_list(5000)
    return [doc_to_json(p) for p in data]


@api.get("/products/{pid}")
async def get_product(pid: str, _u: dict = Depends(get_current_user)):
    p = await db.products.find_one({"_id": ObjectId(pid)})
    if not p:
        raise HTTPException(404, "Produkti nuk u gjet")
    return doc_to_json(p)


async def _next_product_code() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "product_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"P-{seq:05d}"


async def _unique_barcode() -> str:
    while True:
        d = "20" + "".join(str(secrets.randbelow(10)) for _ in range(10))
        check = (10 - sum(int(c) * (3 if i % 2 else 1) for i, c in enumerate(d)) % 10) % 10
        code = d + str(check)
        if not await db.products.find_one({"barcode": code}):
            return code


@api.post("/products")
async def create_product(body: ProductIn, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    src = doc.pop("purchase", None)
    if src and src["seller_type"] == "citizen" and not (src.get("citizen_name") or "").strip():
        raise HTTPException(400, "Shkruaj emrin e qytetarit nga i cili e bleve")
    imei_list = doc.pop("imeis", []) or []
    if doc["type"] == "phone":
        doc["imeis"] = [{"imei": i, "status": "in_stock"} for i in imei_list]
        if imei_list:
            doc["quantity"] = len(doc["imeis"])
    doc["barcode"] = (doc.get("barcode") or "").strip()
    if doc["barcode"]:
        if await db.products.find_one({"barcode": doc["barcode"]}):
            raise HTTPException(400, "Ky barkod ekziston tashmë te një artikull tjetër")
    else:
        doc["barcode"] = await _unique_barcode()
    doc["code"] = await _next_product_code()
    doc["created_at"] = now_utc().isoformat()
    r = await db.products.insert_one(doc)
    doc["_id"] = r.inserted_id
    if src and doc["quantity"] > 0:
        await _record_product_purchase(doc, imei_list, src, user)
    return doc_to_json(doc)


async def _record_product_purchase(prod: dict, imei_list: list, src: dict, user: dict):
    qty = prod["quantity"]
    total = round(prod["cost_price"] * qty, 2)
    paid = min(max(0.0, src.get("paid_amount") or 0.0), total)
    due = round(total - paid, 2)
    is_citizen = src["seller_type"] == "citizen"
    supplier_id = None if is_citizen else (src.get("supplier_id") or None)
    citizen = None
    if is_citizen:
        citizen = {k: (src.get(f"citizen_{k}") or "").strip() for k in ("name", "phone", "personal_no")}
        key = {"personal_no": citizen["personal_no"]} if citizen["personal_no"] else {"name": citizen["name"], "phone": citizen["phone"]}
        await db.citizens.update_one(key, {"$set": {**citizen, "updated_at": now_utc().isoformat()}}, upsert=True)
    await db.purchases.insert_one({
        "supplier_id": supplier_id,
        "seller_type": src["seller_type"],
        "citizen": citizen,
        "items": [{
            "product_id": str(prod["_id"]), "product_name": prod["name"], "quantity": qty,
            "cost_price": prod["cost_price"], "line_total": total, "imeis": imei_list,
        }],
        "total": total, "paid_amount": paid, "due_amount": due,
        "notes": "Regjistruar gjatë krijimit të artikullit",
        "created_at": now_utc().isoformat(), "created_by": user["id"],
    })
    if supplier_id and due:
        await db.suppliers.update_one({"_id": ObjectId(supplier_id)}, {"$inc": {"balance": due}})


@api.get("/citizens")
async def list_citizens(_a: dict = Depends(require_admin)):
    data = await db.citizens.find({}).sort("name", 1).to_list(2000)
    return [doc_to_json(c) for c in data]


@api.put("/products/{pid}")
async def update_product(pid: str, body: ProductUpdate, _a: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "Asgjë për të përditësuar")
    if "barcode" in update:
        update["barcode"] = update["barcode"].strip() or await _unique_barcode()
        if await db.products.find_one({"barcode": update["barcode"], "_id": {"$ne": ObjectId(pid)}}):
            raise HTTPException(400, "Ky barkod ekziston tashmë te një artikull tjetër")
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": update})
    p = await db.products.find_one({"_id": ObjectId(pid)})
    return doc_to_json(p)


@api.delete("/products/{pid}")
async def delete_product(pid: str, _a: dict = Depends(require_admin)):
    await db.products.delete_one({"_id": ObjectId(pid)})
    return {"ok": True}


# ---------- Purchases ----------
@api.get("/purchases")
async def list_purchases(_u: dict = Depends(require_admin)):
    data = await db.purchases.find({}).sort("created_at", -1).to_list(2000)
    return [doc_to_json(p) for p in data]


@api.post("/purchases")
async def create_purchase(body: PurchaseIn, user: dict = Depends(require_admin)):
    total = 0.0
    enriched_items = []
    # process each item: update stock
    for it in body.items:
        prod = await db.products.find_one({"_id": ObjectId(it.product_id)})
        if not prod:
            raise HTTPException(404, f"Produkti {it.product_id} nuk u gjet")
        line_total = it.cost_price * it.quantity
        total += line_total
        enriched_items.append({
            "product_id": it.product_id,
            "product_name": prod["name"],
            "quantity": it.quantity,
            "cost_price": it.cost_price,
            "line_total": line_total,
            "imeis": it.imeis,
        })
        # update stock
        if prod.get("type") == "phone":
            existing = prod.get("imeis", []) or []
            existing_set = {x["imei"] for x in existing}
            for imei in it.imeis:
                if imei and imei not in existing_set:
                    existing.append({"imei": imei, "status": "in_stock"})
            await db.products.update_one(
                {"_id": ObjectId(it.product_id)},
                {"$set": {"imeis": existing, "quantity": len([x for x in existing if x["status"] == "in_stock"]),
                          "cost_price": it.cost_price or prod.get("cost_price", 0)}},
            )
        else:
            new_qty = prod.get("quantity", 0) + it.quantity
            await db.products.update_one(
                {"_id": ObjectId(it.product_id)},
                {"$set": {"quantity": new_qty, "cost_price": it.cost_price or prod.get("cost_price", 0)}},
            )

    paid = max(0.0, body.paid_amount)
    due = total - paid
    doc = {
        "supplier_id": body.supplier_id or None,
        "items": enriched_items,
        "total": total,
        "paid_amount": paid,
        "due_amount": due,
        "notes": body.notes,
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
    }
    r = await db.purchases.insert_one(doc)
    doc["_id"] = r.inserted_id

    # update supplier balance (positive = we owe them)
    if body.supplier_id:
        await db.suppliers.update_one(
            {"_id": ObjectId(body.supplier_id)}, {"$inc": {"balance": due}}
        )

    return doc_to_json(doc)


# ---------- Sales ----------
async def _next_invoice_number() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "invoice"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"INV-{datetime.now().year}-{seq:05d}"


@api.get("/sales")
async def list_sales(_u: dict = Depends(get_current_user)):
    data = await db.sales.find({}).sort("created_at", -1).to_list(5000)
    return [doc_to_json(s) for s in data]


@api.get("/sales/{sid}")
async def get_sale(sid: str, _u: dict = Depends(get_current_user)):
    s = await db.sales.find_one({"_id": ObjectId(sid)})
    if not s:
        raise HTTPException(404, "Shitja nuk u gjet")
    return doc_to_json(s)


@api.post("/sales")
async def create_sale(body: SaleIn, user: dict = Depends(get_current_user)):
    subtotal = 0.0
    enriched_items = []
    for it in body.items:
        prod = await db.products.find_one({"_id": ObjectId(it.product_id)})
        if not prod:
            raise HTTPException(404, f"Produkti {it.product_id} nuk u gjet")

        if prod.get("type") == "phone":
            if not it.imei:
                raise HTTPException(400, f"IMEI mungon për {prod['name']}")
            imeis = prod.get("imeis", []) or []
            found = next((x for x in imeis if x["imei"] == it.imei and x["status"] == "in_stock"), None)
            if not found:
                raise HTTPException(400, f"IMEI {it.imei} nuk është në stok")
            now = now_utc()
            months = int(prod.get("warranty_months", 12) or 0)
            warranty_until = (now + timedelta(days=months * 30)).isoformat() if months > 0 else None
            found["status"] = "sold"
            found["sold_at"] = now.isoformat()
            found["warranty_until"] = warranty_until
            await db.products.update_one(
                {"_id": ObjectId(it.product_id)},
                {"$set": {"imeis": imeis,
                          "quantity": len([x for x in imeis if x["status"] == "in_stock"])}},
            )
            qty = 1
            warranty_info = {"warranty_months": months, "warranty_until": warranty_until}
        else:
            if prod.get("quantity", 0) < it.quantity:
                raise HTTPException(400, f"Sasia e pamjaftueshme për {prod['name']}")
            await db.products.update_one(
                {"_id": ObjectId(it.product_id)},
                {"$inc": {"quantity": -it.quantity}},
            )
            qty = it.quantity
            warranty_info = {}

        line_total = it.sale_price * qty
        subtotal += line_total
        enriched_items.append({
            "product_id": it.product_id,
            "product_name": prod["name"],
            "product_type": prod.get("type"),
            "imei": it.imei,
            "quantity": qty,
            "sale_price": it.sale_price,
            "cost_price": prod.get("cost_price", 0),
            "line_total": line_total,
            **warranty_info,
        })

    discount = max(0.0, body.discount or 0.0)
    total = max(0.0, subtotal - discount)

    if body.payment_method == "debt":
        paid = body.paid_amount
    else:
        paid = total  # cash/card = paid in full

    due = max(0.0, total - paid)

    invoice_no = await _next_invoice_number()

    customer_name = ""
    if body.customer_id:
        cust = await db.customers.find_one({"_id": ObjectId(body.customer_id)})
        if cust:
            customer_name = cust["name"]

    doc = {
        "invoice_no": invoice_no,
        "customer_id": body.customer_id or None,
        "customer_name": customer_name,
        "items": enriched_items,
        "subtotal": subtotal,
        "discount": discount,
        "total": total,
        "paid_amount": paid,
        "due_amount": due,
        "payment_method": body.payment_method,
        "document_date": body.document_date,
        "due_date": body.due_date,
        "notes": body.notes,
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
    }
    r = await db.sales.insert_one(doc)
    doc["_id"] = r.inserted_id

    if body.customer_id and due > 0:
        await db.customers.update_one(
            {"_id": ObjectId(body.customer_id)}, {"$inc": {"balance": due}}
        )

    return doc_to_json(doc)


# ---------- Invoice PDF ----------
@api.get("/sales/{sid}/invoice.pdf")
async def invoice_pdf(sid: str, _u: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"_id": ObjectId(sid)})
    if not sale:
        raise HTTPException(404, "Shitja nuk u gjet")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#10B981"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#64748B"))
    body = styles["Normal"]

    story = []
    story.append(Paragraph("KISA-DATA", title_style))
    story.append(Paragraph("Faturë Shitjeje / Sales Invoice", small))
    story.append(Spacer(1, 8))

    header_tbl = Table(
        [
            [Paragraph(f"<b>Nr. Faturës:</b> {sale.get('invoice_no','')}", body),
             Paragraph(f"<b>Data:</b> {sale.get('created_at','')[:19].replace('T',' ')}", body)],
            [Paragraph(f"<b>Klienti:</b> {sale.get('customer_name') or 'Klient i rastit'}", body),
             Paragraph(f"<b>Mënyra pagesës:</b> {sale.get('payment_method','').upper()}", body)],
        ],
        colWidths=[90 * mm, 90 * mm],
    )
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 10))

    data = [["#", "Përshkrimi", "IMEI", "Sasia", "Çmimi (€)", "Totali (€)"]]
    for i, it in enumerate(sale.get("items", []), start=1):
        data.append([
            str(i),
            it.get("product_name", ""),
            it.get("imei", "") or "-",
            str(it.get("quantity", 0)),
            f"{it.get('sale_price', 0):.2f}",
            f"{it.get('line_total', 0):.2f}",
        ])

    items_tbl = Table(data, colWidths=[10 * mm, 70 * mm, 35 * mm, 15 * mm, 25 * mm, 25 * mm])
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B0F17")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 10))

    totals = [
        ["Nëntotali:", f"€ {sale.get('subtotal', 0):.2f}"],
        ["Zbritja:", f"€ {sale.get('discount', 0):.2f}"],
        ["TOTALI:", f"€ {sale.get('total', 0):.2f}"],
        ["Paguar:", f"€ {sale.get('paid_amount', 0):.2f}"],
        ["Mbetur (Borxh):", f"€ {sale.get('due_amount', 0):.2f}"],
    ]
    tot_tbl = Table(totals, colWidths=[40 * mm, 40 * mm], hAlign="RIGHT")
    tot_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor("#10B981")),
        ("LINEABOVE", (0, 2), (-1, 2), 0.5, colors.HexColor("#233044")),
    ]))
    story.append(tot_tbl)
    story.append(Spacer(1, 20))
    story.append(Paragraph("Faleminderit për blerjen! — Kisa-Data POS", small))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{sale.get("invoice_no","invoice")}.pdf"'},
    )


# ---------- Payments (debt settlement) ----------
@api.get("/payments")
async def list_payments(_u: dict = Depends(require_admin)):
    data = await db.payments.find({}).sort("created_at", -1).to_list(2000)
    return [doc_to_json(p) for p in data]


@api.post("/payments")
async def create_payment(body: PaymentIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
    })
    r = await db.payments.insert_one(doc)
    doc["_id"] = r.inserted_id

    collection = db.customers if body.entity_type == "customer" else db.suppliers
    delta = -body.amount  # payment reduces outstanding balance
    await collection.update_one(
        {"_id": ObjectId(body.entity_id)}, {"$inc": {"balance": delta}}
    )
    return doc_to_json(doc)


# ---------- Returns ----------
@api.get("/returns")
async def list_returns(_a: dict = Depends(require_admin)):
    data = await db.returns.find({}).sort("created_at", -1).to_list(2000)
    return [doc_to_json(r) for r in data]


@api.post("/sales/{sid}/return")
async def create_return(sid: str, body: ReturnIn, user: dict = Depends(require_admin)):
    sale = await db.sales.find_one({"_id": ObjectId(sid)})
    if not sale:
        raise HTTPException(404, "Shitja nuk u gjet")

    items = sale.get("items", []) or []
    returned_items = []
    refund_total = 0.0

    for ret in body.items:
        if ret.index < 0 or ret.index >= len(items):
            raise HTTPException(400, "Artikull i pavlefshëm")
        item = items[ret.index]
        already_returned = int(item.get("returned_quantity", 0) or 0)
        available = int(item.get("quantity", 0)) - already_returned
        if available <= 0:
            continue
        qty = min(int(ret.quantity), available)
        if qty <= 0:
            continue

        # restore stock
        prod = await db.products.find_one({"_id": ObjectId(item["product_id"])})
        if prod:
            if item.get("product_type") == "phone" and item.get("imei"):
                imeis = prod.get("imeis", []) or []
                for x in imeis:
                    if x["imei"] == item["imei"]:
                        x["status"] = "in_stock"
                        x.pop("sold_at", None)
                        x.pop("warranty_until", None)
                        break
                await db.products.update_one(
                    {"_id": ObjectId(item["product_id"])},
                    {"$set": {"imeis": imeis,
                              "quantity": len([x for x in imeis if x["status"] == "in_stock"])}},
                )
            else:
                await db.products.update_one(
                    {"_id": ObjectId(item["product_id"])},
                    {"$inc": {"quantity": qty}},
                )

        item["returned_quantity"] = already_returned + qty
        line_refund = float(item.get("sale_price", 0)) * qty
        refund_total += line_refund
        returned_items.append({
            "product_id": item["product_id"],
            "product_name": item.get("product_name", ""),
            "imei": item.get("imei"),
            "quantity": qty,
            "sale_price": item.get("sale_price", 0),
            "line_refund": line_refund,
        })

    if not returned_items:
        raise HTTPException(400, "Asgjë për t'u kthyer")

    # reverse payment: reduce customer debt first (if any), rest = cash refund out
    debt_reduction = 0.0
    cash_refund = refund_total
    if sale.get("customer_id") and float(sale.get("due_amount", 0) or 0) > 0:
        remaining_due = min(float(sale["due_amount"]), refund_total)
        debt_reduction = remaining_due
        cash_refund = refund_total - remaining_due
        new_due = float(sale["due_amount"]) - remaining_due
        sale["due_amount"] = new_due
        # reduce customer balance
        await db.customers.update_one(
            {"_id": ObjectId(sale["customer_id"])}, {"$inc": {"balance": -remaining_due}}
        )

    # update sale document (items with returned_quantity, totals)
    returned_sum = sum(
        float(i.get("sale_price", 0)) * int(i.get("returned_quantity", 0) or 0)
        for i in items
    )
    original_subtotal = float(sale.get("subtotal", 0) or 0)
    fully_returned = all(
        int(i.get("returned_quantity", 0) or 0) >= int(i.get("quantity", 0))
        for i in items
    )
    await db.sales.update_one(
        {"_id": ObjectId(sid)},
        {"$set": {
            "items": items,
            "returned_total": returned_sum,
            "due_amount": sale.get("due_amount", 0),
            "status": "returned" if fully_returned else "partial_return",
        }},
    )

    doc = {
        "sale_id": sid,
        "invoice_no": sale.get("invoice_no", ""),
        "customer_id": sale.get("customer_id"),
        "customer_name": sale.get("customer_name", ""),
        "items": returned_items,
        "refund_total": refund_total,
        "debt_reduction": debt_reduction,
        "cash_refund": cash_refund,
        "reason": body.reason,
        "created_at": now_utc().isoformat(),
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
    }
    r = await db.returns.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


# ---------- Dashboard & Reports ----------
@api.get("/reports/dashboard")
async def dashboard(_u: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc).isoformat()
    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc).isoformat()

    sales_today = await db.sales.aggregate([
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    sales_month = await db.sales.aggregate([
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"},
                    "profit": {"$sum": {"$subtract": ["$total", {"$sum": "$items.cost_price"}]}}}},
    ]).to_list(1)

    products = await db.products.find({}).to_list(5000)
    stock_value = 0.0
    low_stock = 0
    total_units = 0
    for p in products:
        q = p.get("quantity", 0)
        stock_value += (p.get("cost_price", 0) or 0) * q
        total_units += q
        if q <= p.get("low_stock_threshold", 2):
            low_stock += 1

    cust_debt = await db.customers.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
    ]).to_list(1)
    supp_debt = await db.suppliers.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$balance"}}},
    ]).to_list(1)

    # last 7 days chart
    chart = []
    for i in range(6, -1, -1):
        d = datetime.now(timezone.utc).date() - timedelta(days=i)
        start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc).isoformat()
        end = (datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(days=1)).isoformat()
        agg = await db.sales.aggregate([
            {"$match": {"created_at": {"$gte": start, "$lt": end}}},
            {"$group": {"_id": None, "total": {"$sum": "$total"}}},
        ]).to_list(1)
        chart.append({"date": d.isoformat(), "total": agg[0]["total"] if agg else 0})

    return {
        "sales_today": sales_today[0]["total"] if sales_today else 0,
        "orders_today": sales_today[0]["count"] if sales_today else 0,
        "sales_month": sales_month[0]["total"] if sales_month else 0,
        "stock_value": stock_value,
        "low_stock_count": low_stock,
        "total_units": total_units,
        "customer_debt": cust_debt[0]["total"] if cust_debt else 0,
        "supplier_debt": supp_debt[0]["total"] if supp_debt else 0,
        "chart_7d": chart,
    }


@api.get("/reports/my-performance")
async def my_performance(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc).isoformat()
    month_start = datetime(today.year, today.month, 1, tzinfo=timezone.utc).isoformat()

    uid = user["id"]
    full = await db.users.find_one({"_id": ObjectId(uid)})
    target = float((full or {}).get("daily_target", 0) or 0)
    commission_pct = float((full or {}).get("commission_percent", 0) or 0)

    today_sales = await db.sales.aggregate([
        {"$match": {"created_by": uid, "created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    month_sales = await db.sales.aggregate([
        {"$match": {"created_by": uid, "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    recent = await db.sales.find({"created_by": uid}).sort("created_at", -1).limit(10).to_list(10)

    today_total = today_sales[0]["total"] if today_sales else 0
    month_total = month_sales[0]["total"] if month_sales else 0
    progress = (today_total / target * 100.0) if target > 0 else 0

    return {
        "daily_target": target,
        "commission_percent": commission_pct,
        "today_total": today_total,
        "today_count": today_sales[0]["count"] if today_sales else 0,
        "today_commission": today_total * commission_pct / 100.0,
        "month_total": month_total,
        "month_count": month_sales[0]["count"] if month_sales else 0,
        "month_commission": month_total * commission_pct / 100.0,
        "target_progress": min(100, progress),
        "target_remaining": max(0, target - today_total),
        "recent_sales": [doc_to_json(s) for s in recent],
    }


@api.get("/reports/top-products")
async def top_products(_u: dict = Depends(get_current_user)):
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "product_name": {"$first": "$items.product_name"},
            "units": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.line_total"},
        }},
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
    ]
    data = await db.sales.aggregate(pipeline).to_list(10)
    for d in data:
        d["product_id"] = str(d.pop("_id"))
    return data


# ---------- CSV exports ----------
def _csv_response(rows: list[list], filename: str) -> StreamingResponse:
    import csv
    buf = io.StringIO()
    writer = csv.writer(buf)
    for r in rows:
        writer.writerow(r)
    data = buf.getvalue().encode("utf-8-sig")  # BOM for Excel
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/reports/sales.csv")
async def export_sales_csv(_a: dict = Depends(require_admin)):
    sales = await db.sales.find({}).sort("created_at", -1).to_list(10000)
    rows = [["Nr. Fature", "Data", "Klienti", "Pagesa", "Nëntotali (€)", "Zbritja (€)", "Totali (€)", "Paguar (€)", "Borxh (€)", "Shitësi"]]
    for s in sales:
        rows.append([
            s.get("invoice_no", ""),
            (s.get("created_at", "") or "")[:19].replace("T", " "),
            s.get("customer_name", "") or "Klient i rastit",
            s.get("payment_method", "").upper(),
            f"{s.get('subtotal', 0):.2f}",
            f"{s.get('discount', 0):.2f}",
            f"{s.get('total', 0):.2f}",
            f"{s.get('paid_amount', 0):.2f}",
            f"{s.get('due_amount', 0):.2f}",
            s.get("created_by_name", "") or "",
        ])
    return _csv_response(rows, f"shitjet_{datetime.now().strftime('%Y%m%d')}.csv")


@api.get("/reports/stock.csv")
async def export_stock_csv(_a: dict = Depends(require_admin)):
    products = await db.products.find({}).sort("name", 1).to_list(10000)
    categories = {str(c["_id"]): c["name"] for c in await db.categories.find({}).to_list(1000)}
    rows = [["Produkti", "Lloji", "Markë", "Kategoria", "Barkod", "Çmim blerje (€)", "Çmim shitje (€)", "Sasia", "Alarm", "IMEI në stok"]]
    for p in products:
        in_stock_imeis = [x["imei"] for x in (p.get("imeis") or []) if x.get("status") == "in_stock"]
        rows.append([
            p.get("name", ""),
            "Telefon" if p.get("type") == "phone" else "Aksesor",
            p.get("brand", "") or "",
            categories.get(p.get("category_id", "") or "", ""),
            p.get("barcode", "") or "",
            f"{p.get('cost_price', 0):.2f}",
            f"{p.get('sale_price', 0):.2f}",
            p.get("quantity", 0),
            p.get("low_stock_threshold", 0),
            " | ".join(in_stock_imeis),
        ])
    return _csv_response(rows, f"stoku_{datetime.now().strftime('%Y%m%d')}.csv")


# ---------- Customer history ----------
@api.get("/customers/{cid}/history")
async def customer_history(cid: str, _u: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"_id": ObjectId(cid)})
    if not customer:
        raise HTTPException(404, "Klienti nuk u gjet")
    sales = await db.sales.find({"customer_id": cid}).sort("created_at", -1).to_list(1000)
    payments = await db.payments.find({"entity_type": "customer", "entity_id": cid}).sort("created_at", -1).to_list(1000)
    totals = {
        "total_spent": sum(s.get("total", 0) for s in sales),
        "total_paid": sum(s.get("paid_amount", 0) for s in sales) + sum(p.get("amount", 0) for p in payments),
        "orders_count": len(sales),
    }
    return {
        "customer": doc_to_json(customer),
        "sales": [doc_to_json(s) for s in sales],
        "payments": [doc_to_json(p) for p in payments],
        "totals": totals,
    }


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("barcode")
    await db.sales.create_index("invoice_no", unique=True)

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    # backfill: existing products without code
    async for p in db.products.find({"code": {"$exists": False}}):
        await db.products.update_one({"_id": p["_id"]}, {"$set": {"code": await _next_product_code()}})
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrator",
            "role": "admin",
            "created_at": now_utc().isoformat(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    # employee seed
    emp_email = "punonjes@prodata.al"
    if not await db.users.find_one({"email": emp_email}):
        await db.users.insert_one({
            "email": emp_email,
            "password_hash": hash_password("punonjes123"),
            "name": "Punonjës",
            "role": "employee",
            "created_at": now_utc().isoformat(),
        })


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
