from src.database.db import Base
from src.database.db import engine
from src.database.db import SessionLocal

from src.auth.models import User
from src.auth.auth import hash_password


Base.metadata.create_all(
    bind=engine
)


db = SessionLocal()


users = [

    {
        "name": "Aqua User",
        "email": "user@aquasentinel.ai",
        "password": "User@123",
        "role": "USER"
    },

    {
        "name": "Government Official",
        "email": "gov@aquasentinel.ai",
        "password": "Gov@123",
        "role": "GOVERNMENT"
    },

    {
        "name": "Administrator",
        "email": "admin@aquasentinel.ai",
        "password": "Admin@123",
        "role": "ADMIN"
    }

]


for data in users:

    existing_user = (
        db.query(User)
        .filter(
            User.email == data["email"]
        )
        .first()
    )

    if existing_user:

        print(
            f"User already exists: "
            f"{data['email']}"
        )

        continue


    user = User(

        name=data["name"],

        email=data["email"],

        password_hash=hash_password(
            data["password"]
        ),

        role=data["role"]

    )

    db.add(user)


db.commit()

db.close()


print()
print("===================================")
print(" AquaSentinel AI Users Created")
print("===================================")
print("USER")
print("Email    : user@aquasentinel.ai")
print("Password : User@123")
print()
print("GOVERNMENT")
print("Email    : gov@aquasentinel.ai")
print("Password : Gov@123")
print()
print("ADMIN")
print("Email    : admin@aquasentinel.ai")
print("Password : Admin@123")
print("===================================")