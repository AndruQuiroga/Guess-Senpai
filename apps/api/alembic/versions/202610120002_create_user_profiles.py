"""Include the existing profile model in fresh migration-built databases."""
from alembic import op
import sqlalchemy as sa

revision = "202610120002"
down_revision = "202610120001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("user_profiles"):
        return
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar_frame", sa.String(128), nullable=True),
        sa.Column("cosmetics", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
