"""add tables for daily progress and streaks"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202411070001_add_progress_tables"
down_revision = "202411040001_create_users_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_progress",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("puzzle_date", sa.Date(), nullable=False),
        sa.Column("progress", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "puzzle_date"),
    )
    op.create_table(
        "streaks",
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_completed", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("streaks")
    op.drop_table("daily_progress")
