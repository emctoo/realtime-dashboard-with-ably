import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, Literal, Optional

import dotenv
import jwt
import redis
from ably import AblyRest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel

dotenv.load_dotenv()

# Ably client
ably_rest_client = AblyRest(os.getenv("ABLY_API_KEY"))

app = FastAPI()
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
# print(logging.root.manager.loggerDict.keys())
log = logging.getLogger("uvicorn")


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
        "subscription": "premium",
    },
    "user": {
        "username": "user",
        "fullname": "Normal User",
        "email": "user@example.com",
        "hashed_password": "uasdf",
        "disabled": False,
        "subscription": "basic",
    },
    "user1": {
        "username": "u1",
        "fullname": "User1",
        "email": "user1@example.com",
        "hashed_password": "uasdf",
        "disabled": False,
        "subscription": "premium",
    },
}


# 模型定义
class Token(BaseModel):
    access_token: str
    token_type: str
    user_info: dict
    ably_token: Dict


class UserInDB(BaseModel):
    username: str
    fullname: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None
    subscription: str = "basic"


class AblyTokenResponse(BaseModel):
    ably_token: Dict
    client_id: str


# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


async def create_ably_token_request(client_id: str, subscription: str = "basic"):
    """
    创建Ably Token,根据subscription类型设置不同的capabilities
    """
    try:
        # 基础capabilities - 所有用户都可以访问的功能
        capabilities = {
            "telemetry:*": ["subscribe"],  # 基础遥测数据
            "weather:*": ["subscribe"],  # 天气数据
            "race:events": ["subscribe"],  # 比赛事件
        }

        # Premium用户额外的capabilities
        if subscription == "premium":
            capabilities.update(
                {
                    "premium:*": ["subscribe"],  # premium专属数据
                    "telemetry:details:*": ["subscribe"],  # 详细遥测数据
                }
            )

        # 创建token request
        token_params = {
            "client_id": client_id,
            "capability": capabilities,
            "ttl": 60 * 60 * 1000,
        }
        token_request = await ably_rest_client.auth.create_token_request(token_params)
        log.info("token_request for %s", token_request.client_id)
        return token_request
    except Exception as e:
        log.error(f"Error creating Ably token: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create Ably token: {str(e)}"
        )


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


@app.get("/api/anonymous-token", response_model=AblyTokenResponse)
async def get_anonymous_token():
    """
    为匿名用户创建基础的Ably token
    """
    try:
        log.info('creating anonymous token ...')
        client_id = "anon"  # f"anon-{uuid.uuid4()}"
        token_request = await create_ably_token_request(client_id, "basic")
        return AblyTokenResponse(
            ably_token=token_request.to_dict(), client_id=client_id
        )
    except Exception as e:
        log.error(f"Error creating anonymous token: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create anonymous token: {str(e)}"
        )


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

    access_token = create_access_token(data={"sub": user["username"]})

    # 生成Ably token
    client_id = f"user-{user['username']}"
    token_request = await create_ably_token_request(client_id, user["subscription"])

    # Filter sensitive information
    user_info = {k: v for k, v in user.items() if k != "hashed_password"}

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_info": user_info,
        "token_request": token_request,
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
    event: RaceEvent, current_user: UserInDB = Depends(get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(
            status_code=403, detail="You don't have permission to publish events"
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
            "publisher": current_user.username,
        }

        # 发布消息到 Ably
        channel = ably_rest_client.channels.get("race:events")
        result = await channel.publish("update", message_data)
        log.info("result: %s", result)

        return {
            "status": "success",
            "message": "Event published successfully",
            "data": message_data,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to publish event: {str(e)}"
        )
