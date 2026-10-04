from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import HTTPBearer
from jose import jwt
from sqlalchemy.orm import Session

from src.auth.models import User
from src.auth.auth import SECRET_KEY
from src.auth.auth import ALGORITHM
from src.database.db import get_db


# ============================================================
# BEARER AUTHENTICATION
# ============================================================

security = HTTPBearer(
    auto_error=True
)


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    credentials=Depends(security),
    db: Session = Depends(get_db)
):

    token = credentials.credentials


    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )


        user_id = payload.get(
            "sub"
        )


        if not user_id:

            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )


    except HTTPException:

        raise


    except Exception:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )


    try:

        user_id = int(
            user_id
        )

    except (TypeError, ValueError):

        raise HTTPException(
            status_code=401,
            detail="Invalid user ID in token"
        )


    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )


    if not user:

        raise HTTPException(
            status_code=401,
            detail="User not found"
        )


    return user


# ============================================================
# ROLE CHECK
# ============================================================

def require_role(
    required_role: str
):

    def role_checker(
        user: User = Depends(
            get_current_user
        )
    ):

        if user.role != required_role:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Access denied for this role"
                )
            )


        return user


    return role_checker