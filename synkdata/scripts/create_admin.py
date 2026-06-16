"""
Script para crear el usuario administrador inicial de SynkData.

Uso:
    python scripts/create_admin.py
    python scripts/create_admin.py --email admin@synkdata.mx --password "S3cret!"
    python scripts/create_admin.py --interactive

Variables de entorno requeridas (ver .env):
    SYNKDATA_DATABASE_URL
    SYNKDATA_SECRET_KEY
    SYNKDATA_ADMIN_EMAIL (opcional, default: admin@synkdata.mx)
    SYNKDATA_ADMIN_PASSWORD (opcional — si no se define se pedirá interactivamente)
    SYNKDATA_ADMIN_NAME (opcional, default: "Administrador SynkData")
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Asegurar que el directorio raíz del proyecto esté en sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.database import close_db, get_db_session, init_db  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services.auth_service import AuthService  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(levelname)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("synkdata.create_admin")


async def create_admin(
    email: str,
    password: str,
    full_name: str,
    phone: str | None = None,
) -> User:
    """Crea o actualiza el usuario administrador inicial."""
    init_db()

    async with get_db_session() as db:
        existing = await db.execute(select(User).where(User.email == email))
        existing_user = existing.scalar_one_or_none()

        if existing_user is not None:
            if existing_user.role != UserRole.ADMIN:
                logger.warning(
                    "El usuario %s ya existe pero NO es admin. "
                    "Actualizando rol a ADMIN.",
                    email,
                )
                existing_user.role = UserRole.ADMIN
            existing_user.is_active = True
            existing_user.is_verified = True
            existing_user.hashed_password = AuthService.hash_password(password)
            if full_name:
                existing_user.full_name = full_name
            await db.commit()
            await db.refresh(existing_user)
            logger.info("✅ Admin existente actualizado: %s", email)
            return existing_user

        admin = User(
            id=uuid.uuid4(),
            email=email,
            full_name=full_name,
            phone=phone,
            hashed_password=AuthService.hash_password(password),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            last_login=None,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        logger.info("✅ Admin creado correctamente: %s (id=%s)", email, admin.id)
        return admin


def parse_args() -> argparse.Namespace:
    """Parsea argumentos de línea de comandos."""
    p = argparse.ArgumentParser(
        description="Crea el usuario administrador inicial de SynkData.",
    )
    p.add_argument("--email", help="Email del administrador")
    p.add_argument("--password", help="Contraseña del administrador")
    p.add_argument("--name", help="Nombre completo del administrador")
    p.add_argument("--phone", help="Teléfono del administrador")
    p.add_argument(
        "--interactive",
        action="store_true",
        help="Modo interactivo: pide datos por teclado",
    )
    return p.parse_args()


def main() -> int:
    """Punto de entrada del script."""
    args = parse_args()

    email = args.email or os.getenv("SYNKDATA_ADMIN_EMAIL", "admin@synkdata.mx")
    name = args.name or os.getenv("SYNKDATA_ADMIN_NAME", "Administrador SynkData")
    phone = args.phone or os.getenv("SYNKDATA_ADMIN_PHONE")

    if args.interactive:
        email = input(f"Email del admin [{email}]: ").strip() or email
        name = input(f"Nombre completo [{name}]: ").strip() or name
        phone = input("Teléfono (opcional): ").strip() or phone

    password = args.password or os.getenv("SYNKDATA_ADMIN_PASSWORD")
    if not password:
        if args.interactive or sys.stdin.isatty():
            while True:
                pwd1 = getpass.getpass("Contraseña: ")
                if len(pwd1) < 8:
                    print("⚠️  La contraseña debe tener al menos 8 caracteres.")
                    continue
                pwd2 = getpass.getpass("Confirmar contraseña: ")
                if pwd1 != pwd2:
                    print("⚠️  Las contraseñas no coinciden.")
                    continue
                password = pwd1
                break
        else:
            logger.error(
                "No se proporcionó contraseña. Usa --password, "
                "SYNKDATA_ADMIN_PASSWORD, o --interactive."
            )
            return 2

    logger.info("Creando administrador: %s", email)
    try:
        asyncio.run(
            create_admin(
                email=email,
                password=password,
                full_name=name,
                phone=phone,
            )
        )
    except Exception as exc:
        logger.exception("Error creando admin: %s", exc)
        return 1
    finally:
        asyncio.run(close_db())

    print("\n" + "=" * 60)
    print("  Admin listo. Ahora puedes iniciar sesión en:")
    print("  → http://localhost:8000/login")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
