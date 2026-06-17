from tests.conftest import VALID_USER, register_and_login, auth_headers

SCORE_PAYLOAD = {"score": 1500, "lines": 10, "level": 2}

USER_B = {"email": "other@example.com", "username": "other", "password": "password456"}


# ── /scores (POST) ────────────────────────────────────────────────────────


def test_create_score_success(client):
    token = register_and_login(client)
    resp = client.post("/scores", json=SCORE_PAYLOAD, headers=auth_headers(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == SCORE_PAYLOAD["score"]
    assert body["lines"] == SCORE_PAYLOAD["lines"]
    assert body["level"] == SCORE_PAYLOAD["level"]
    assert body["user"]["email"] == VALID_USER["email"]


def test_create_score_unauthenticated(client):
    resp = client.post("/scores", json=SCORE_PAYLOAD)
    assert resp.status_code == 403


# ── /scores/top ───────────────────────────────────────────────────────────


def test_top_score_empty(client):
    resp = client.get("/scores/top")
    assert resp.status_code == 200
    assert resp.json() is None


def test_top_score_returns_highest(client):
    token_a = register_and_login(client, VALID_USER)
    token_b = register_and_login(client, USER_B)

    client.post("/scores", json={"score": 500, "lines": 5, "level": 1}, headers=auth_headers(token_a))
    client.post("/scores", json={"score": 9999, "lines": 50, "level": 5}, headers=auth_headers(token_b))
    client.post("/scores", json={"score": 300, "lines": 3, "level": 1}, headers=auth_headers(token_a))

    resp = client.get("/scores/top")
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 9999
    assert body["username"] == USER_B["username"]


# ── /scores/me ────────────────────────────────────────────────────────────


def test_my_scores_empty(client):
    token = register_and_login(client)
    resp = client.get("/scores/me", headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_my_scores_returns_own_only(client):
    token_a = register_and_login(client, VALID_USER)
    token_b = register_and_login(client, USER_B)

    client.post("/scores", json={"score": 100, "lines": 1, "level": 1}, headers=auth_headers(token_a))
    client.post("/scores", json={"score": 200, "lines": 2, "level": 1}, headers=auth_headers(token_a))
    client.post("/scores", json={"score": 999, "lines": 9, "level": 3}, headers=auth_headers(token_b))

    resp = client.get("/scores/me", headers=auth_headers(token_a))
    assert resp.status_code == 200
    scores = resp.json()
    assert len(scores) == 2
    assert all(s["user"]["email"] == VALID_USER["email"] for s in scores)


def test_my_scores_limited_to_10(client):
    token = register_and_login(client)
    for i in range(15):
        client.post("/scores", json={"score": i * 100, "lines": i, "level": 1}, headers=auth_headers(token))

    resp = client.get("/scores/me", headers=auth_headers(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 10


def test_my_scores_unauthenticated(client):
    resp = client.get("/scores/me")
    assert resp.status_code == 403
