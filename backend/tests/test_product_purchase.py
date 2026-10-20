# Product creation with purchase source (supplier/citizen) -> stock + purchase + supplier debt
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TAG = "TEST_PP_" + uuid.uuid4().hex[:6]


def _mongo():
    env = {}
    for line in open("/app/backend/.env"):
        if "=" in line:
            k, v = line.strip().split("=", 1)
            env[k] = v.strip('"')
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module")
def employee():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "punonjes@prodata.al", "password": "punonjes123"})
    if r.status_code != 200:
        pytest.skip("employee login failed")
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module")
def supplier(admin):
    r = admin.post(f"{BASE_URL}/api/suppliers", json={"name": f"{TAG}_Supplier"})
    assert r.status_code in (200, 201), r.text
    sup = r.json()
    yield sup
    admin.delete(f"{BASE_URL}/api/suppliers/{sup['id']}")


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    db = _mongo()
    prods = list(db.products.find({"name": {"$regex": f"^{TAG}"}}))
    ids = [str(p["_id"]) for p in prods]
    db.purchases.delete_many({"items.product_id": {"$in": ids}})
    db.products.delete_many({"name": {"$regex": f"^{TAG}"}})
    db.citizens.delete_many({"name": {"$regex": f"^{TAG}"}})


def _purchase_for(admin, pid):
    r = admin.get(f"{BASE_URL}/api/purchases")
    assert r.status_code == 200
    return [p for p in r.json() if any(i["product_id"] == pid for i in p.get("items", []))]


def _balance(admin, sid):
    r = admin.get(f"{BASE_URL}/api/suppliers")
    return next(s for s in r.json() if s["id"] == sid).get("balance", 0)


class TestSupplierPurchase:
    def test_supplier_partial_paid(self, admin, supplier):
        before = _balance(admin, supplier["id"])
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_Acc", "type": "accessory", "cost_price": 10, "quantity": 5,
            "purchase": {"seller_type": "supplier", "supplier_id": supplier["id"], "paid_amount": 20}})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["quantity"] == 5
        purs = _purchase_for(admin, p["id"])
        assert len(purs) == 1
        pu = purs[0]
        assert pu["total"] == 50 and pu["paid_amount"] == 20 and pu["due_amount"] == 30
        assert pu["supplier_id"] == supplier["id"]
        assert _balance(admin, supplier["id"]) == pytest.approx(before + 30)

    def test_paid_clamped_to_total(self, admin, supplier):
        before = _balance(admin, supplier["id"])
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_Over", "type": "accessory", "cost_price": 2, "quantity": 3,
            "purchase": {"seller_type": "supplier", "supplier_id": supplier["id"], "paid_amount": 100}})
        assert r.status_code == 200
        pu = _purchase_for(admin, r.json()["id"])[0]
        assert pu["paid_amount"] == 6 and pu["due_amount"] == 0
        assert _balance(admin, supplier["id"]) == pytest.approx(before)

    def test_quantity_zero_no_purchase(self, admin, supplier):
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_Zero", "type": "accessory", "cost_price": 10, "quantity": 0,
            "purchase": {"seller_type": "supplier", "supplier_id": supplier["id"], "paid_amount": 0}})
        assert r.status_code == 200
        assert _purchase_for(admin, r.json()["id"]) == []

    def test_no_purchase_field_backward_compat(self, admin):
        r = admin.post(f"{BASE_URL}/api/products", json={"name": f"{TAG}_NoSrc", "type": "accessory", "quantity": 2, "cost_price": 1})
        assert r.status_code == 200
        assert _purchase_for(admin, r.json()["id"]) == []

    def test_invalid_supplier_id(self, admin):
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_BadSup", "type": "accessory", "cost_price": 1, "quantity": 1,
            "purchase": {"seller_type": "supplier", "supplier_id": "not-an-objectid", "paid_amount": 0}})
        print("invalid supplier status", r.status_code, r.text[:200])
        assert r.status_code in (400, 404, 422)

    def test_employee_forbidden(self, employee):
        r = employee.post(f"{BASE_URL}/api/products", json={"name": f"{TAG}_Emp", "quantity": 1})
        assert r.status_code == 403
        assert employee.get(f"{BASE_URL}/api/citizens").status_code == 403


class TestCitizenPurchase:
    def test_citizen_phone_imei(self, admin):
        pno = "K" + uuid.uuid4().hex[:8].upper()
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_Phone", "type": "phone", "cost_price": 100, "imeis": [f"35{uuid.uuid4().int % 10**13:013d}"],
            "purchase": {"seller_type": "citizen", "citizen_name": f"{TAG}_Arben", "citizen_phone": "044111222",
                         "citizen_personal_no": pno, "paid_amount": 100}})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["quantity"] == 1
        pu = _purchase_for(admin, p["id"])[0]
        assert pu["seller_type"] == "citizen" and pu["supplier_id"] is None
        assert pu["citizen"]["name"] == f"{TAG}_Arben" and pu["citizen"]["personal_no"] == pno
        assert pu["total"] == 100 and pu["due_amount"] == 0
        cits = admin.get(f"{BASE_URL}/api/citizens").json()
        c = [x for x in cits if x.get("personal_no") == pno]
        assert len(c) == 1 and c[0]["phone"] == "044111222"
        assert "_id" not in c[0]
        # same personal no again -> upsert, no duplicate
        r2 = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_Phone2", "type": "phone", "cost_price": 50, "quantity": 2,
            "purchase": {"seller_type": "citizen", "citizen_name": f"{TAG}_Arben", "citizen_phone": "044999",
                         "citizen_personal_no": pno, "paid_amount": 100}})
        assert r2.status_code == 200
        assert r2.json()["quantity"] == 2  # phone w/o IMEI keeps typed qty
        cits = admin.get(f"{BASE_URL}/api/citizens").json()
        assert len([x for x in cits if x.get("personal_no") == pno]) == 1

    def test_citizen_without_name(self, admin):
        r = admin.post(f"{BASE_URL}/api/products", json={
            "name": f"{TAG}_NoName", "type": "accessory", "cost_price": 1, "quantity": 1,
            "purchase": {"seller_type": "citizen", "citizen_name": "  ", "paid_amount": 1}})
        assert r.status_code == 400
        assert "qytetarit" in r.json()["detail"]
        assert not _mongo().products.find_one({"name": f"{TAG}_NoName"})

    def test_phone_qty_without_imei_no_purchase_flag(self, admin):
        r = admin.post(f"{BASE_URL}/api/products", json={"name": f"{TAG}_PhQty", "type": "phone", "quantity": 4})
        assert r.status_code == 200 and r.json()["quantity"] == 4
