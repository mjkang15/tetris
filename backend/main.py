from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import schemas
import auth

models.Base.metadata.create_all(bind=engine)

import os

app = FastAPI(title="Tetris API", version="1.0.0")

# Environment variable for allowed CORS origins (comma-separated). Default to '*'
cors_origins_env = os.getenv("CORS_ORIGINS")
origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()] if cors_origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/register", response_model=schemas.Token)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 이메일입니다",
        )
    user = models.User(
        email=body.email,
        username=body.username,
        hashed_password=auth.hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = auth.create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/auth/login", response_model=schemas.Token)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not auth.verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )
    token = auth.create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.get("/auth/me", response_model=schemas.UserResponse)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.post("/scores", response_model=schemas.ScoreResponse)
def create_score(
    body: schemas.ScoreCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    record = models.Score(
        user_id=current_user.id,
        score=body.score,
        lines=body.lines,
        level=body.level,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/scores/top", response_model=schemas.TopScore | None)
def top_score(db: Session = Depends(get_db)):
    result = (
        db.query(models.Score, models.User)
        .join(models.User, models.Score.user_id == models.User.id)
        .order_by(models.Score.score.desc())
        .first()
    )
    if not result:
        return None
    record, user = result
    return {"score": record.score, "username": user.username, "played_at": record.played_at}


@app.get("/scores/me", response_model=list[schemas.ScoreResponse])
def my_scores(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Score)
        .filter(models.Score.user_id == current_user.id)
        .order_by(models.Score.played_at.desc())
        .limit(10)
        .all()
    )
