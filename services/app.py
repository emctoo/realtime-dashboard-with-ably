from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
import jwt
import redis
import os
from datetime import datetime, timedelta
import dotenv
import logging
from ably import AblyRest

dotenv.load_dotenv()

# Ably client
ably_client = AblyRest(os.getenv("ABLY_API_KEY"))

app = FastAPI()
log = logging.getLogger('fastapi')

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 修改为你的前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis连接
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL"))

# 配置
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 预设用户
MOCK_USERS = {
    "admin": {
        "username": "admin",
        "fullname": "Admin User",
        "email": "admin@example.com",
        "hashed_password": "admin123",  # 实际应用中应该使用哈希密码
        "disabled": False,
        "subscription": "premium"
    },
    "user": {
        "username": "user",
        "fullname": "Normal User",
        "email": "user@example.com",
        "hashed_password": "user123",
        "disabled": False,
        "subscription": "basic"
    },
    "user1": {
        "username": "u1",
        "fullname": "User1",
        "email": "user1@example.com",
        "hashed_password": "user234",
        "disabled": False,
        "subscription": "premium"
    }
}

# 模型定义
class Token(BaseModel):
    access_token: str
    token_type: str
    user_info: dict

class UserInDB(BaseModel):
    username: str
    fullname: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None
    subscription: str = "basic"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 工具函数
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = MOCK_USERS.get(username)
    if user is None:
        raise credentials_exception
    return UserInDB(**user)


@app.post("/api/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = MOCK_USERS.get(form_data.username)
    if not user or user["hashed_password"] != form_data.password:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if user["disabled"]:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = create_access_token(
        data={"sub": user["username"]}
    )
    
    # Filter sensitive information
    user_info = {k: v for k, v in user.items() if k != "hashed_password"}
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_info": user_info
    }


@app.get("/api/users/me")
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return current_user


class RaceEvent(BaseModel):
    type: Literal["FLAG", "PENALTY", "PIT", "INCIDENT"]
    message: str
    timestamp: Optional[int] = None


@app.post("/admin/race/events", status_code=201)
async def publish_race_event(
    event: RaceEvent,
    current_user: UserInDB = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to publish events"
        )

    try:
        # 确保有 timestamp
        if not event.timestamp:
            event.timestamp = int(datetime.utcnow().timestamp() * 1000)
            
        # 准备消息数据
        message_data = {
            "id": f"evt_{event.timestamp}",  # 添加唯一标识符
            "type": event.type,
            "message": event.message,
            "timestamp": event.timestamp,
            "publisher": current_user.username
        }
        
        # 发布消息到 Ably
        channel = ably_client.channels.get("race:events")
        result = await channel.publish("update", message_data)
        log.info('result: %s', result)
        
        return {
            "status": "success",
            "message": "Event published successfully",
            "data": message_data,            
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to publish event: {str(e)}"
        )
