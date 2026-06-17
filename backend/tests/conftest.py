import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import models
from database import Base, get_db
from main import app


# Single in-memory engine shared across the entire test session.
# StaticPool ensures TestClient and fixtures use the same connection.
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# SQLite disables FK constraints by default; enable them so IntegrityError
# is raised on FK violations just as MySQL would.
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    db = TestingSessionLocal()
    try:
        db.query(models.Score).delete()
        db.query(models.User).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client(_clean_tables):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session(_clean_tables):
    """Raw DB session for unit tests that bypass the HTTP layer."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers reused across test modules
# ---------------------------------------------------------------------------

VALID_USER = {
    "email": "test@example.com",
    "username": "tester",
    "password": "password123",
}


def register_and_login(client, user=None):
    user = user or VALID_USER
    client.post("/auth/register", json=user)
    resp = client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    return resp.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
