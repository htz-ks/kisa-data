# Product IMEI registration tests: create with IMEIs, uniqueness across products, edit add_imeis + quantity recalculation
import os
import uuid
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient
from bson import ObjectId

FE_ENV = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
BE_ENV = dotenv_values("/app/backend/.env")
mdb = MongoClient(BE_ENV["MONGO_URL"])[BE_ENV["DB_NAME"]]

created = []
U = uuid.uuid4().hex[:6]


def im(n):
    return f"77{U}{n:07d}"


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    assert r.status_code == 200
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield ses
    for pid in created:
        mdb.products.delete_one({"_id": ObjectId(pid)})
        mdb.purchases.delete_many({"items.product_id": pid})


def mk(s, **kw):
    body = {"name": "TEST_PIMEI", "type": "phone", "cost_price": 100, "sale_price": 150, "quantity": 0, "imeis": [],
            "purchase": {"seller_type": "supplier", "supplier_id": "", "paid_amount": 100000}}
    body.update(kw)
    r = s.post(f"{BASE_URL}/api/products", json=body)
    if r.status_code == 200:
        created.append(r.json()["id"])
    return r


class TestProductImei:
    def test_create_phone_single_imei_qty1(self, s):
        r = mk(s, imeis=[im(1)])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quantity"] == 1
        assert [x["imei"] for x in d["imeis"]] == [im(1)]
        assert d["imeis"][0]["status"] == "in_stock"
        g = s.get(f"{BASE_URL}/api/products/{d['id']}")
        if g.status_code == 200:
            assert g.json()["imeis"][0]["imei"] == im(1)

    def test_create_two_imeis_dedup(self, s):
        r = mk(s, imeis=[im(2), im(3), im(3), " "])
        assert r.status_code == 200, r.text
        assert r.json()["quantity"] == 2
        assert len(r.json()["imeis"]) == 2

    def test_create_duplicate_imei_other_product(self, s):
        r = mk(s, imeis=[im(1)])
        assert r.status_code == 400
        assert "ekziston te artikulli" in r.text and im(1) in r.text

    def test_edit_add_imeis(self, s):
        r = mk(s, imeis=[], quantity=0, name="TEST_PIMEI_edit")
        assert r.status_code == 200
        pid = r.json()["id"]
        u = s.put(f"{BASE_URL}/api/products/{pid}", json={"name": "TEST_PIMEI_edit", "quantity": 0, "add_imeis": [im(10), im(11)]})
        assert u.status_code == 200, u.text
        assert u.json()["quantity"] == 2
        assert {x["imei"] for x in u.json()["imeis"]} == {im(10), im(11)}
        # adding again an existing own imei is idempotent
        u2 = s.put(f"{BASE_URL}/api/products/{pid}", json={"quantity": 5, "add_imeis": [im(10), im(12)]})
        assert u2.status_code == 200, u2.text
        assert u2.json()["quantity"] == 5
        assert len(u2.json()["imeis"]) == 3
        doc = mdb.products.find_one({"_id": ObjectId(pid)})
        assert len(doc["imeis"]) == 3

    def test_edit_duplicate_imei_other_product(self, s):
        pid = created[-1]
        u = s.put(f"{BASE_URL}/api/products/{pid}", json={"add_imeis": [im(2)]})
        assert u.status_code == 400
        assert "ekziston te artikulli" in u.text

    def test_accessory_with_purchase_regression(self, s):
        r = mk(s, type="accessory", name="TEST_PIMEI_acc", quantity=4, cost_price=2, imeis=[im(99)],
               purchase={"seller_type": "citizen", "citizen_name": "TEST_cit", "paid_amount": 8})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["quantity"] == 4
        assert not d.get("imeis")
        p = mdb.purchases.find_one({"items.product_id": d["id"]})
        assert p and p["total"] == 8
        mdb.citizens.delete_many({"name": "TEST_cit"})
