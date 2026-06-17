from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ScoreCreate(BaseModel):
    score: int
    lines: int
    level: int


class ScoreResponse(BaseModel):
    id: int
    score: int
    lines: int
    level: int
    played_at: datetime
    user: UserResponse

    model_config = {"from_attributes": True}


class TopScore(BaseModel):
    score: int
    username: str
    played_at: datetime
