# Iteration 12: Return refund respects invoice discount + manual refund override/capping
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
BE = dotenv_values("/app/backend/.env")
db = MongoClient(BE["MONGO_URL"])[BE["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@prodata.al", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip("login failed")
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    yield s
    sids = [str(x["_id"]) for x in db.sales.find({"items.product_name": {"$regex": "^TEST_RD"}})]
    db.returns.delete_many({"sale_id": {"$in": sids}})
    db.sales.delete_many({"_id": {"$in": [x["_id"] for x in db.sales.find({"items.product_name": {"$regex": "^TEST_RD"}})]}})
    db.products.delete_many({"name": {"$regex": "^TEST_RD"}})
    db.customers.delete_many({"name": {"$regex": "^TEST_RD"}})


def acc(admin, name, price, qty=5):
    r = admin.post(f"{BASE_URL}/api/products", json={"name": name, "type": "accessory", "cost_price": 5, "sale_price": price, "quantity": qty})
    assert r.status_code == 200, r.text
    return r.json()


def sale(admin, items, discount, paid, method="cash", customer_id=""):
    r = admin.post(f"{BASE_URL}/api/sales", json={"customer_id": customer_id, "items": items, "discount": discount,
                                                 "paid_amount": paid, "payment_method": method})
    assert r.status_code == 200, r.text
    return r.json()


def ret(admin, sid, items, refund=None):
    body = {"items": items, "reason": "TEST_RD"}
    if refund is not None:
        body["refund_amount"] = refund
    return admin.post(f"{BASE_URL}/api/sales/{sid}/return", json=body)


def qty_of(admin, pid):
    return admin.get(f"{BASE_URL}/api/products/{pid}").json()["quantity"]


class TestDiscountRefund:
    def test_single_item_discount_auto_12(self, admin):
        p = acc(admin, "TEST_RD_acc15", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 15}], 3, 12)
        assert s["total"] == 12
        assert qty_of(admin, p["id"]) == 4
        r = ret(admin, s["id"], [{"index": 0, "quantity": 1}])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["refund_total"] == 12 and d["cash_refund"] == 12 and d["debt_reduction"] == 0
        assert qty_of(admin, p["id"]) == 5
        rets = admin.get(f"{BASE_URL}/api/returns").json()
        assert any(x["id"] == d["id"] and x["refund_total"] == 12 for x in rets)
        sd = admin.get(f"{BASE_URL}/api/sales/{s['id']}").json()
        assert sd["refunded_amount"] == 12 and sd["status"] == "returned"

    def test_manual_override_10(self, admin):
        p = acc(admin, "TEST_RD_accman", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 15}], 3, 12)
        d = ret(admin, s["id"], [{"index": 0, "quantity": 1}], refund=10).json()
        assert d["refund_total"] == 10 and d["cash_refund"] == 10

    def test_manual_above_max_capped(self, admin):
        p = acc(admin, "TEST_RD_acccap", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 15}], 3, 12)
        d = ret(admin, s["id"], [{"index": 0, "quantity": 1}], refund=100).json()
        assert d["refund_total"] == 12

    def test_manual_negative_clamped_zero(self, admin):
        p = acc(admin, "TEST_RD_accneg", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 15}], 0, 15)
        d = ret(admin, s["id"], [{"index": 0, "quantity": 1}], refund=-5).json()
        assert d["refund_total"] == 0

    def test_manual_zero_restores_stock(self, admin):
        p = acc(admin, "TEST_RD_acczero", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 2, "sale_price": 15}], 0, 30)
        assert qty_of(admin, p["id"]) == 3
        r = ret(admin, s["id"], [{"index": 0, "quantity": 2}], refund=0)
        assert r.status_code == 200, r.text
        assert r.json()["refund_total"] == 0 and r.json()["cash_refund"] == 0
        assert qty_of(admin, p["id"]) == 5

    def test_multi_item_proportional_and_remaining_cap(self, admin):
        a = acc(admin, "TEST_RD_m10", 10)
        b = acc(admin, "TEST_RD_m20", 20)
        s = sale(admin, [{"product_id": a["id"], "quantity": 1, "sale_price": 10},
                         {"product_id": b["id"], "quantity": 1, "sale_price": 20}], 6, 24)
        assert s["total"] == 24
        d1 = ret(admin, s["id"], [{"index": 1, "quantity": 1}]).json()
        assert d1["refund_total"] == 16
        # remaining refundable = 8; manual 50 must be capped to 8
        d2 = ret(admin, s["id"], [{"index": 0, "quantity": 1}], refund=50).json()
        assert d2["refund_total"] == 8
        sd = admin.get(f"{BASE_URL}/api/sales/{s['id']}").json()
        assert sd["refunded_amount"] == 24 and sd["status"] == "returned"
        assert qty_of(admin, a["id"]) == 5 and qty_of(admin, b["id"]) == 5
        # nothing left
        assert ret(admin, s["id"], [{"index": 0, "quantity": 1}]).status_code == 400

    def test_partial_qty_after_manual_overrefund(self, admin):
        # first return manually refunds more than its share, second auto return must be capped by remaining
        p = acc(admin, "TEST_RD_part", 10)
        s = sale(admin, [{"product_id": p["id"], "quantity": 2, "sale_price": 10}], 4, 16)
        d1 = ret(admin, s["id"], [{"index": 0, "quantity": 1}], refund=12).json()
        assert d1["refund_total"] == 12
        d2 = ret(admin, s["id"], [{"index": 0, "quantity": 1}]).json()
        assert d2["refund_total"] == 4

    def test_debt_sale_discount(self, admin):
        c = admin.post(f"{BASE_URL}/api/customers", json={"name": "TEST_RD_cust"}).json()
        p = acc(admin, "TEST_RD_debt", 15)
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 15}], 3, 5, method="debt", customer_id=c["id"])
        assert s["total"] == 12 and s["due_amount"] == 7
        from bson import ObjectId
        bal = db.customers.find_one({"_id": ObjectId(c["id"])})["balance"]
        assert bal == 7
        d = ret(admin, s["id"], [{"index": 0, "quantity": 1}]).json()
        assert d["refund_total"] == 12 and d["debt_reduction"] == 7 and d["cash_refund"] == 5
        assert db.customers.find_one({"_id": ObjectId(c["id"])})["balance"] == 0

    def test_phone_imei_back_in_stock(self, admin):
        p = admin.post(f"{BASE_URL}/api/products", json={"name": "TEST_RD_phone", "type": "phone", "cost_price": 100, "sale_price": 200,
                                                        "quantity": 1, "imeis": ["TESTRD000001"]}).json()
        s = sale(admin, [{"product_id": p["id"], "quantity": 1, "sale_price": 200, "imei": "TESTRD000001"}], 20, 180)
        d = ret(admin, s["id"], [{"index": 0, "quantity": 1}]).json()
        assert d["refund_total"] == 180
        pr = admin.get(f"{BASE_URL}/api/products/{p['id']}").json()
        assert pr["quantity"] == 1
        assert [x for x in pr["imeis"] if x["imei"] == "TESTRD000001"][0]["status"] == "in_stock"
