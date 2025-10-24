"""create user recent media table

Revision ID: 202411080001_create_user_recent_media
Revises: 202411070001_add_progress_tables
Create Date: 2024-11-08 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from app.core.config import get_settings

# revision identifiers, used by Alembic.
revision = "202411080001_create_user_recent_media"
down_revision = "202411070001_add_progress_tables"
branch_labels = None
depends_on = None

settings = get_settings()
HISTORY_DAYS = max(settings.puzzle_history_days, 0)


def upgrade() -> None:
    op.create_table(
        "user_recent_media",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("media_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "media_id"),
    )

    partial_clause = None
    if HISTORY_DAYS > 0:
        partial_clause = sa.text(
            f"seen_at >= (CURRENT_TIMESTAMP - INTERVAL '{HISTORY_DAYS} DAYS')"
        )

    op.create_index(
        "ix_user_recent_media_recent_window",
        "user_recent_media",
        ["user_id", "seen_at"],
        unique=False,
        postgresql_where=partial_clause,
    )


def downgrade() -> None:
    op.drop_index("ix_user_recent_media_recent_window", table_name="user_recent_media")
    op.drop_table("user_recent_media")
