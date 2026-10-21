# Warranty terms (retail only) + untouched warranty (warranty_days=0) + settings endpoint tests
import os
from datetime import datetime, timezone
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
TERMS = "KUSHTET PËR GARANCION\nTEST terms line"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    assert r.status_code == 200
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    orig = mdb.settings.find_one({"key": "warranty_terms"})
    yield ses
    for sid in created_sales:
        mdb.sales.delete_one({"_id": ObjectId(sid)})
    for pid in created_products:
        mdb.products.delete_one({"_id": ObjectId(pid)})
    if orig is None:
        mdb.settings.delete_one({"key": "warranty_terms"})
    else:
        mdb.settings.update_one({"key": "warranty_terms"}, {"$set": {"value": orig["value"]}})


@pytest.fixture(scope="module")
def phone(s):
    r = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_WT_phone", "type": "phone", "cost_price": 50,
               "sale_price": 100, "quantity": 5, "warranty_months": 12,
               "imeis": [f"TESTWT000{i}" for i in range(1, 6)]})
    assert r.status_code == 200, r.text
    created_products.append(r.json()["id"])
    return r.json()


@pytest.fixture(scope="module")
def acc(s):
    r = s.post(f"{BASE_URL}/api/products", json={"name": "TEST_WT_acc", "type": "accessory", "cost_price": 5,
               "sale_price": 10, "quantity": 20})
    assert r.status_code == 200, r.text
    created_products.append(r.json()["id"])
    return r.json()


def sell(s, pid, imei=None, **kw):
    body = {"customer_id": "", "items": [{"product_id": pid, "quantity": 1, "sale_price": 10, "imei": imei}],
            "discount": 0, "paid_amount": 10, "payment_method": "cash", **kw}
    r = s.post(f"{BASE_URL}/api/sales", json=body)
    assert r.status_code == 200, r.text
    created_sales.append(r.json()["id"])
    return r.json()


def days_from_now(iso):
    d = datetime.fromisoformat(iso)
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return (d - datetime.now(timezone.utc)).total_seconds() / 86400


class TestSettings:
    def test_get_default_terms(self, s):
        r = s.get(f"{BASE_URL}/api/settings/warranty-terms")
        assert r.status_code == 200
        assert r.json()["text"].startswith("KUSHTET PËR GARANCION")
        assert "HITECHZONE" in r.json()["text"]

    def test_put_terms_persists_and_requires_auth(self, s):
        r = s.put(f"{BASE_URL}/api/settings/warranty-terms", json={"text": "TEST_custom"})
        assert r.status_code == 200 and r.json()["text"] == "TEST_custom"
        assert s.get(f"{BASE_URL}/api/settings/warranty-terms").json()["text"] == "TEST_custom"
        assert requests.put(f"{BASE_URL}/api/settings/warranty-terms", json={"text": "x"}).status_code in (401, 403)
        mdb.settings.delete_one({"key": "warranty_terms"})
        assert s.get(f"{BASE_URL}/api/settings/warranty-terms").json()["text"].startswith("KUSHTET")

    def test_employee_cannot_put(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "punonjes@prodata.al", "password": "punonjes123"})
        if r.status_code != 200:
            pytest.skip("employee login failed")
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        assert requests.get(f"{BASE_URL}/api/settings/warranty-terms", headers=h).status_code == 200
        assert requests.put(f"{BASE_URL}/api/settings/warranty-terms", json={"text": "x"}, headers=h).status_code == 403


class TestSaleTerms:
    def test_phone_untouched_warranty_none(self, s, phone):
        d = sell(s, phone["id"], imei="TESTWT0001", warranty_days=0, warranty_months=None,
                 price_mode="retail", warranty_terms=TERMS)
        it = d["items"][0]
        assert not it.get("warranty_until") and not it.get("warranty_label")
        assert d["price_mode"] == "retail" and d["warranty_terms"] == ""
        p = s.get(f"{BASE_URL}/api/products/{phone['id']}").json()
        im = next(x for x in p["imeis"] if x["imei"] == "TESTWT0001")
        assert im["status"] == "sold" and not im.get("warranty_until")

    def test_phone_10_days_retail_terms(self, s, phone):
        d = sell(s, phone["id"], imei="TESTWT0002", warranty_days=10, warranty_months=None,
                 price_mode="retail", warranty_terms=TERMS)
        it = d["items"][0]
        assert 9.9 < days_from_now(it["warranty_until"]) <= 10.01 and it["warranty_label"] == "10 ditë"
        assert d["warranty_terms"] == TERMS
        g = s.get(f"{BASE_URL}/api/sales/{d['id']}").json()
        assert g["warranty_terms"] == TERMS and g["price_mode"] == "retail"

    def test_phone_months_wholesale_no_terms(self, s, phone):
        d = sell(s, phone["id"], imei="TESTWT0003", warranty_months=3, warranty_days=None,
                 price_mode="wholesale", warranty_terms=TERMS)
        assert d["items"][0]["warranty_until"]
        assert d["price_mode"] == "wholesale" and d["warranty_terms"] == ""

    def test_accessory_untouched_no_terms(self, s, acc):
        d = sell(s, acc["id"], warranty_days=0, price_mode="retail", warranty_terms=TERMS)
        assert not d["items"][0].get("warranty_until") and d["warranty_terms"] == ""

    def test_accessory_6_months_retail_terms(self, s, acc):
        d = sell(s, acc["id"], warranty_months=6, warranty_days=None, price_mode="retail", warranty_terms=TERMS)
        assert d["items"][0]["warranty_until"] and d["warranty_terms"] == TERMS

    def test_invalid_price_mode_422(self, s, acc):
        r = s.post(f"{BASE_URL}/api/sales", json={"customer_id": "", "items": [{"product_id": acc["id"], "quantity": 1, "sale_price": 10}],
                   "discount": 0, "paid_amount": 10, "payment_method": "cash", "price_mode": "bogus"})
        assert r.status_code == 422
