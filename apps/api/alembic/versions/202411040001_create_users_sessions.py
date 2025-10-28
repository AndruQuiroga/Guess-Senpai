from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "202411040001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    ctx = op.get_context()
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("avatar", sa.String(length=512), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("access_token_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("refresh_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    if ctx.dialect.name == "sqlite":
        op.create_index(
            "uq_sessions_token_hash",
            "sessions",
            ["token_hash"],
            unique=True,
        )
    else:
        op.create_unique_constraint("uq_sessions_token_hash", "sessions", ["token_hash"])


def downgrade() -> None:
    ctx = op.get_context()
    if ctx.dialect.name == "sqlite":
        op.drop_index("uq_sessions_token_hash", table_name="sessions")
    else:
        op.drop_constraint("uq_sessions_token_hash", "sessions", type_="unique")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")
