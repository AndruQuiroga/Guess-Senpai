"""Persist immutable published daily puzzle sets."""

from alembic import op
import sqlalchemy as sa

revision = "202610120001"
down_revision = "202411090002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Legacy startup used SQLAlchemy create_all before Alembic was wired in.
    # Adopt that already-created table and let Alembic record this revision.
    if sa.inspect(op.get_bind()).has_table("daily_puzzle_sets"):
        return
    op.create_table(
        "daily_puzzle_sets",
        sa.Column("puzzle_date", sa.Date(), primary_key=True),
        sa.Column("reset_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rules_version", sa.String(length=32), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("available_modes", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )


def downgrade() -> None:
    # This drops published daily history. Export/backup the table before rollback.
    op.drop_table("daily_puzzle_sets")
