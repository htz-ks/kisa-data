# Sale-level warranty override tests: warranty_days / warranty_months / product default (phone vs accessory)
import os
from datetime import datetime, timezone, timedelta
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

FE_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
BE_ENV = dotenv_values("/app/backend/.env")
mdb = MongoClient(BE_ENV["MONGO_URL"])[BE_ENV["DB_NAME"]]

created_products, created_sales = [], []


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    assert r.status_code == 200
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield ses
    for sid in created_sales:
        mdb.sales.delete_one({"_id": ObjectId(sid)})
    for pid in created_products:
        mdb.products.delete_one({"_id": ObjectId(pid)})


def mkprod(s, **kw):
    body = {"name": "TEST_W_acc", "type": "accessory", "cost_price": 5, "sale_price": 10, "quantity": 20}
    body.update(kw)
    r = s.post(f"{BASE_URL}/api/products", json=body)
    assert r.status_code == 200, r.text
    created_products.append(r.json()["id"])
    return r.json()


def sell(s, pid, imei=None, **w):
    body = {"customer_id": "", "items": [{"product_id": pid, "quantity": 1, "sale_price": 10, "imei": imei}],
            "discount": 0, "paid_amount": 10, "payment_method": "cash", **w}
    r = s.post(f"{BASE_URL}/api/sales", json=body)
    if r.status_code == 200:
        created_sales.append(r.json()["id"])
    return r


def days_from_now(iso):
    d = datetime.fromisoformat(iso)
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return (d - datetime.now(timezone.utc)).total_seconds() / 86400


@pytest.fixture(scope="module")
def acc(s):
    return mkprod(s)


@pytest.fixture(scope="module")
def phone(s):
    return mkprod(s, name="TEST_W_phone", type="phone", quantity=3, warranty_months=12,
                  imeis=["TESTW0001", "TESTW0002", "TESTW0003"])


class TestSaleWarranty:
    def test_accessory_10_days(self, s, acc):
        r = sell(s, acc["id"], warranty_days=10, warranty_months=None)
        assert r.status_code == 200, r.text
        it = r.json()["items"][0]
        assert it["warranty_label"] == "10 ditë"
        assert 9.9 < days_from_now(it["warranty_until"]) <= 10.01
        g = s.get(f"{BASE_URL}/api/sales/{r.json()['id']}").json()["items"][0]
        assert g["warranty_label"] == "10 ditë"

    def test_accessory_6_months(self, s, acc):
        r = sell(s, acc["id"], warranty_months=6, warranty_days=None)
        it = r.json()["items"][0]
        assert it["warranty_label"] == "6 muaj" and it["warranty_months"] == 6
        assert 180 <= days_from_now(it["warranty_until"]) + 0.1 <= 185

    def test_accessory_default_no_warranty(self, s, acc):
        r = sell(s, acc["id"])
        it = r.json()["items"][0]
        assert not it.get("warranty_until") and not it.get("warranty_label")

    def test_phone_default_product_warranty(self, s, phone):
        r = sell(s, phone["id"], imei="TESTW0001")
        assert r.status_code == 200, r.text
        it = r.json()["items"][0]
        assert it["warranty_months"] == 12 and it["warranty_label"] == "12 muaj"
        assert 364.9 < days_from_now(it["warranty_until"]) <= 366.01
        p = s.get(f"{BASE_URL}/api/products/{phone['id']}").json()
        im = next(x for x in p["imeis"] if x["imei"] == "TESTW0001")
        assert im["status"] == "sold" and im["warranty_until"][:10] == it["warranty_until"][:10]

    def test_phone_override_10_days(self, s, phone):
        r = sell(s, phone["id"], imei="TESTW0002", warranty_days=10)
        it = r.json()["items"][0]
        assert it["warranty_label"] == "10 ditë"
        assert 9.9 < days_from_now(it["warranty_until"]) <= 10.01

    def test_phone_override_18_months(self, s, phone):
        r = sell(s, phone["id"], imei="TESTW0003", warranty_months=18)
        it = r.json()["items"][0]
        assert it["warranty_label"] == "18 muaj" and it["warranty_months"] == 18
        assert 545 < days_from_now(it["warranty_until"]) <= 551

    def test_days_priority_over_months(self, s, acc):
        r = sell(s, acc["id"], warranty_days=5, warranty_months=6)
        it = r.json()["items"][0]
        assert it["warranty_label"] == "5 ditë"
        assert 4.9 < days_from_now(it["warranty_until"]) <= 5.01

    def test_negative_days_no_warranty(self, s, acc):
        r = sell(s, acc["id"], warranty_days=-3)
        assert r.status_code in (200, 422)
        if r.status_code == 200:
            it = r.json()["items"][0]
            assert not it.get("warranty_until")
