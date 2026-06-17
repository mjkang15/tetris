import os
import sys

# Must be set before any app module is imported so database.py uses SQLite
os.environ["DATABASE_URL"] = "sqlite:///./test_tetris.db"

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from database import engine
from main import app  # triggers create_all on the SQLite test DB


@pytest.fixture(autouse=True)
def _clean_tables():
    """Wipe all rows between tests so each test starts with an empty DB."""
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM scores"))
        conn.execute(text("DELETE FROM users"))
        conn.commit()
    yield


@pytest.fixture
def client(_clean_tables):
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# Helpers reused across test modules
# ---------------------------------------------------------------------------

VALID_USER = {
    "email": "test@example.com",
    "username": "tester",
    "password": "password123",
}


def register_and_login(client, user=None):
    """Register a user and return the bearer token."""
    user = user or VALID_USER
    client.post("/auth/register", json=user)
    resp = client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
