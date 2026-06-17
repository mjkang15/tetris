"""Unit tests for auth.py pure functions (no HTTP layer)."""
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from sqlalchemy.exc import IntegrityError

import auth
import models
from tests.conftest import VALID_USER, TestingSessionLocal


# ── hash_password / verify_password ──────────────────────────────────────


def test_hash_is_not_plaintext():
    hashed = auth.hash_password("secret")
    assert hashed != "secret"


def test_verify_correct_password():
    hashed = auth.hash_password("mypassword")
    assert auth.verify_password("mypassword", hashed) is True


def test_verify_wrong_password():
    hashed = auth.hash_password("mypassword")
    assert auth.verify_password("wrong", hashed) is False


def test_same_password_produces_different_hashes():
    h1 = auth.hash_password("pw")
    h2 = auth.hash_password("pw")
    assert h1 != h2  # bcrypt uses random salt


# ── create_access_token ───────────────────────────────────────────────────


def test_token_contains_correct_sub():
    token = auth.create_access_token(42)
    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    assert payload["sub"] == "42"


def test_token_has_future_expiry():
    token = auth.create_access_token(1)
    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    assert exp > datetime.now(timezone.utc)


def test_token_expiry_is_approximately_7_days():
    token = auth.create_access_token(1)
    payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    delta = exp - datetime.now(timezone.utc)
    # Allow ±60 s margin around 7 days
    assert abs(delta.total_seconds() - 7 * 24 * 3600) < 60


def test_expired_token_is_rejected(client):
    """A token whose exp is in the past must be rejected by the /auth/me endpoint."""
    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    expired = jwt.encode({"sub": "1", "exp": past}, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_token_with_wrong_secret_is_rejected(client):
    token = jwt.encode({"sub": "1"}, "wrong-secret", algorithm=auth.ALGORITHM)
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_token_missing_sub_is_rejected(client):
    token = jwt.encode({"exp": datetime.now(timezone.utc) + timedelta(hours=1)}, auth.SECRET_KEY, algorithm=auth.ALGORITHM)
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_token_for_nonexistent_user_is_rejected(client):
    token = auth.create_access_token(99999)
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ── Model-level constraints (bypass HTTP layer) ───────────────────────────


def test_user_email_unique_constraint():
    db = TestingSessionLocal()
    try:
        db.add(models.User(email="dup@example.com", username="a", hashed_password="x"))
        db.commit()
        db.add(models.User(email="dup@example.com", username="b", hashed_password="y"))
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()


def test_score_requires_user(db_session):
    score = models.Score(user_id=99999, score=100, lines=1, level=1)
    db_session.add(score)
    with pytest.raises(IntegrityError):
        db_session.commit()
