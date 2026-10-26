# Servis / Shërbimi API tests + Qarkullimet Ditore integration. All services created use first_name TEST*; soft-deleted at end.
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import requests

FE_ENV = dict(l.split("=", 1) for l in Path("/app/frontend/.env").read_text().splitlines() if "=" in l)
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or FE_ENV["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"
TODAY = datetime.now(ZoneInfo("Europe/Belgrade")).date().isoformat()
CREATED = []


def _login(email, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


@pytest.fixture(scope="module")
def admin():
    s = _login("admin@prodata.al", "admin123")
    yield s
    for sid in CREATED:
        s.delete(f"{API}/services/{sid}")


def mk(admin, **kw):
    body = {"first_name": "TESTSrv", "last_name": "Klient", "phone": "0691112233", "device": "TEST Samsung S21",
            "defect": "Ekran i thyer", **kw}
    r = admin.post(f"{API}/services", json=body)
    assert r.status_code == 200, r.text
    CREATED.append(r.json()["id"])
    return r.json()


def day(admin, d=TODAY):
    r = admin.get(f"{API}/daybook/day", params={"date": d})
    assert r.status_code == 200, r.text
    return r.json()


# --- access control
def test_employee_forbidden():
    emp = _login("punonjes@prodata.al", "punonjes123")
    assert emp.get(f"{API}/services").status_code == 403
    assert emp.post(f"{API}/services", json={"first_name": "TESTx", "phone": "123", "device": "x", "defect": "y"}).status_code == 403


# --- create & validation
def test_create_defaults(admin):
    s = mk(admin, price=50)
    assert s["number"].startswith("S-") and len(s["number"]) >= 6
    assert s["received_date"] == TODAY
    assert s["status"] == "pending" and s["paid_amount"] is None
    assert s["status_label"] == "Në pritje"
    assert "_id" not in s
    g = admin.get(f"{API}/services/{s['id']}").json()
    assert g["device"] == "TEST Samsung S21" and g["price"] == 50


def test_numbers_increment(admin):
    a, b = mk(admin), mk(admin)
    assert int(b["number"][2:]) == int(a["number"][2:]) + 1


@pytest.mark.parametrize("bad", [{"first_name": ""}, {"phone": ""}, {"device": ""}, {"defect": ""}, {"price": -1}, {"received_date": "xx"}])
def test_validation(admin, bad):
    body = {"first_name": "TESTv", "phone": "0691", "device": "d", "defect": "x", **bad}
    r = admin.post(f"{API}/services", json=body)
    assert r.status_code in (400, 422), r.text
    if r.status_code == 200:
        CREATED.append(r.json()["id"])


# --- list filters
def test_filters(admin):
    s = mk(admin, first_name="TESTFiltri", last_name="Zzqxy", phone="0697778899", device="TEST iPhone 13 Pro", received_date="2026-01-05")
    ids = lambda **p: [x["id"] for x in admin.get(f"{API}/services", params=p).json()]  # noqa: E731
    assert s["id"] in ids(q="testfiltri")
    assert s["id"] in ids(q="zzqxy")
    assert s["id"] in ids(q="7778899")
    assert s["id"] in ids(q="iphone 13")
    assert s["id"] not in ids(q="nonexistent_zz_123")
    assert s["id"] in ids(status="pending")
    assert s["id"] not in ids(status="repaired")
    assert s["id"] in ids(date_from="2026-01-05", date_to="2026-01-05")
    assert s["id"] not in ids(date_from="2026-01-06")
    assert s["id"] not in ids(date_to="2026-01-04")


# --- edit + history, status, deliver
def test_edit_history(admin):
    s = mk(admin)
    body = {k: s[k] for k in ("first_name", "last_name", "phone", "device", "defect", "received_date", "notes")}
    body.update(price=80, parts_cost=20)
    r = admin.put(f"{API}/services/{s['id']}", json=body)
    assert r.status_code == 200
    d = r.json()
    assert d["price"] == 80 and d["parts_cost"] == 20
    assert len(d["history"]) == 2 and "price" in d["history"][-1]["changes"]


def test_status_flow(admin):
    s = mk(admin)
    r = admin.patch(f"{API}/services/{s['id']}/status", json={"status": "repairing"})
    assert r.status_code == 200 and r.json()["status"] == "repairing"
    r = admin.patch(f"{API}/services/{s['id']}/status", json={"status": "delivered"})
    assert r.status_code == 400
    r = admin.patch(f"{API}/services/{s['id']}/status", json={"status": "delivered", "paid_amount": 30, "paid_method": "bank"})
    d = r.json()
    assert d["paid_amount"] == 30 and d["paid_method"] == "bank" and d["delivered_date"] == TODAY
    r = admin.patch(f"{API}/services/{s['id']}/status", json={"status": "repaired"})
    d = r.json()
    assert d["paid_amount"] is None and d["delivered_date"] is None and d["paid_method"] is None
    assert admin.patch(f"{API}/services/{s['id']}/status", json={"status": "bogus"}).status_code == 422


# --- daybook integration
def test_daybook_integration(admin):
    before = day(admin)
    bs = before["summary"]
    a = mk(admin, price=100, parts_cost=30)   # cash delivered 100
    b = mk(admin, price=60, parts_cost=10)    # bank delivered 60
    c = mk(admin, price=999)                  # received only, not delivered
    mid = day(admin)
    assert {a["id"], b["id"], c["id"]} <= {x["id"] for x in mid["services_received"]}
    assert mid["summary"]["service_income"] == bs["service_income"]
    assert mid["summary"]["net_profit"] == bs["net_profit"]
    assert mid["closing_cash"] == before["closing_cash"]

    admin.patch(f"{API}/services/{a['id']}/status", json={"status": "delivered", "paid_amount": 100, "paid_method": "cash"})
    admin.patch(f"{API}/services/{b['id']}/status", json={"status": "delivered", "paid_amount": 60, "paid_method": "bank"})
    # deliver again (idempotent, no duplicates)
    admin.patch(f"{API}/services/{a['id']}/status", json={"status": "delivered", "paid_amount": 100, "paid_method": "cash"})
    after = day(admin)
    s = after["summary"]
    keys = [e["key"] for e in after["entries"]]
    assert len(keys) == len(set(keys))
    assert keys.count(f"service:{a['id']}") == 1 and keys.count(f"service:{b['id']}") == 1
    assert f"service:{c['id']}" not in keys
    ent = next(e for e in after["entries"] if e["key"] == f"service:{a['id']}")
    assert ent["type"] == "Servis" and ent["hyrje"] == 100 and ent["profit"] == 70
    assert s["service_income"] == round(bs["service_income"] + 160, 2)
    assert s["service_profit"] == round(bs["service_profit"] + 120, 2)
    assert s["service_delivered"] == bs["service_delivered"] + 2
    assert s["service_cash"] == round(bs["service_cash"] + 100, 2)
    assert s["sales_total"] == bs["sales_total"]
    assert s["revenue"] == bs["revenue"]
    assert s["net_profit"] == round(bs["net_profit"] + 120, 2)
    assert s["bank_in"] == round(bs["bank_in"] + 60, 2)
    if before["closing_cash"] is not None:
        assert after["closing_cash"] == round(before["closing_cash"] + 100, 2)

    # report column
    rep = admin.get(f"{API}/daybook/report", params={"date_from": TODAY, "date_to": TODAY}).json()
    assert rep["rows"][0]["service_income"] == s["service_income"]
    assert rep["totals"]["service_income"] == s["service_income"]

    # soft delete hides from list and daybook
    for x in (a, b, c):
        assert admin.delete(f"{API}/services/{x['id']}").json()["ok"] is True
    gone = day(admin)
    assert gone["summary"]["service_income"] == bs["service_income"]
    assert gone["summary"]["net_profit"] == bs["net_profit"]
    assert not ({a["id"], b["id"], c["id"]} & {x["id"] for x in gone["services_received"]})
    lst = [x["id"] for x in admin.get(f"{API}/services").json()]
    assert a["id"] not in lst
    assert admin.get(f"{API}/services/{a['id']}").status_code == 404


def test_zero_paid_not_in_entries(admin):
    s = mk(admin, parts_cost=15)
    admin.patch(f"{API}/services/{s['id']}/status", json={"status": "delivered", "paid_amount": 0})
    keys = [e["key"] for e in day(admin)["entries"]]
    assert f"service:{s['id']}" not in keys  # note: parts cost of free repairs not subtracted (design)


def test_receipt_pdf(admin):
    s = mk(admin, notes="Pa karikues")
    r = admin.get(f"{API}/services/{s['id']}/receipt.pdf")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_receipt_pdf_special_chars(admin):
    s = mk(admin, defect="Ekran < 5 & bateri > 3", notes="a < b")
    r = admin.get(f"{API}/services/{s['id']}/receipt.pdf")
    assert r.status_code == 200, f"PDF failed with special chars: {r.status_code}"


def test_404_invalid(admin):
    assert admin.get(f"{API}/services/bad").status_code == 404
    assert admin.delete(f"{API}/services/000000000000000000000000").status_code == 404
