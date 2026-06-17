from tests.conftest import VALID_USER, register_and_login, auth_headers


# ── /auth/register ────────────────────────────────────────────────────────


def test_register_success(client):
    resp = client.post("/auth/register", json=VALID_USER)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["email"] == VALID_USER["email"]
    assert body["user"]["username"] == VALID_USER["username"]


def test_register_duplicate_email(client):
    client.post("/auth/register", json=VALID_USER)
    resp = client.post("/auth/register", json=VALID_USER)
    assert resp.status_code == 400
    assert "이미 사용 중인 이메일" in resp.json()["detail"]


def test_register_invalid_email(client):
    resp = client.post("/auth/register", json={**VALID_USER, "email": "not-an-email"})
    assert resp.status_code == 422


# ── /auth/login ───────────────────────────────────────────────────────────


def test_login_success(client):
    client.post("/auth/register", json=VALID_USER)
    resp = client.post("/auth/login", json={"email": VALID_USER["email"], "password": VALID_USER["password"]})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/auth/register", json=VALID_USER)
    resp = client.post("/auth/login", json={"email": VALID_USER["email"], "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post("/auth/login", json={"email": "nobody@example.com", "password": "pass"})
    assert resp.status_code == 401


# ── /auth/me ──────────────────────────────────────────────────────────────


def test_me_success(client):
    token = register_and_login(client)
    resp = client.get("/auth/me", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["email"] == VALID_USER["email"]


def test_me_no_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 403


def test_me_invalid_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401
