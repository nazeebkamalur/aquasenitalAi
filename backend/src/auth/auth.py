from datetime import datetime
from datetime import timedelta

from jose import jwt
from passlib.context import CryptContext


SECRET_KEY = "AQUASENTINEL_DEVELOPMENT_SECRET"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_HOURS = 2


pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def hash_password(password: str) -> str:

    return pwd_context.hash(password)


def verify_password(
    password: str,
    password_hash: str
) -> bool:

    return pwd_context.verify(
        password,
        password_hash
    )


def create_access_token(
    user_id: int,
    role: str
) -> str:

    expire = (
        datetime.utcnow()
        + timedelta(
            hours=ACCESS_TOKEN_EXPIRE_HOURS
        )
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )