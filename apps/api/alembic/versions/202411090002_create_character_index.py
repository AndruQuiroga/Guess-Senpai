"""create character index tables

Revision ID: 202411090002
Revises: 202411090001_create_media_title_index
Create Date: 2024-11-09 00:02:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202411090002"
down_revision = "202411090001_create_media_title_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    ctx = op.get_context()
    dialect_name = getattr(ctx.dialect, "name", "")
    trigram_supported = False

    if dialect_name == "postgresql":
        try:
            op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            trigram_supported = True
        except Exception:  # pragma: no cover - dependent on database privs
            trigram_supported = False

    op.create_table(
        "character_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("canonical_name", sa.String(length=512), nullable=False),
        sa.Column("normalized_name", sa.String(length=512), nullable=False),
        sa.Column("full_name", sa.String(length=512), nullable=True),
        sa.Column("native_name", sa.String(length=512), nullable=True),
        sa.Column("user_preferred_name", sa.String(length=512), nullable=True),
        sa.Column("image_large", sa.String(length=1024), nullable=True),
        sa.Column("image_medium", sa.String(length=1024), nullable=True),
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
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_character_entries_normalized_name",
        "character_entries",
        ["normalized_name"],
        unique=False,
    )

    op.create_table(
        "character_aliases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.BigInteger(), nullable=False),
        sa.Column("alias", sa.String(length=512), nullable=False),
        sa.Column("normalized_alias", sa.String(length=512), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
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
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["character_id"], ["character_entries.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_character_aliases_normalized_alias",
        "character_aliases",
        ["normalized_alias"],
        unique=False,
    )
    op.create_index(
        "ix_character_aliases_character_priority",
        "character_aliases",
        ["character_id", "priority"],
        unique=False,
    )
    if trigram_supported and dialect_name == "postgresql":
        op.create_index(
            "ix_character_aliases_trgm",
            "character_aliases",
            ["alias"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"alias": "gin_trgm_ops"},
        )
    else:
        op.create_index(
            "ix_character_aliases_trgm",
            "character_aliases",
            ["alias"],
            unique=False,
        )

    if dialect_name == "sqlite":
        op.create_index(
            "uq_character_alias_character",
            "character_aliases",
            ["character_id", "normalized_alias"],
            unique=True,
        )
    else:
        op.create_unique_constraint(
            "uq_character_alias_character",
            "character_aliases",
            ["character_id", "normalized_alias"],
        )


def downgrade() -> None:
    ctx = op.get_context()
    dialect_name = getattr(ctx.dialect, "name", "")

    if dialect_name == "sqlite":
        op.drop_index("uq_character_alias_character", table_name="character_aliases")
    else:
        op.drop_constraint("uq_character_alias_character", "character_aliases", type_="unique")

    op.drop_index("ix_character_aliases_trgm", table_name="character_aliases")
    op.drop_index("ix_character_aliases_character_priority", table_name="character_aliases")
    op.drop_index("ix_character_aliases_normalized_alias", table_name="character_aliases")
    op.drop_table("character_aliases")

    op.drop_index("ix_character_entries_normalized_name", table_name="character_entries")
    op.drop_table("character_entries")
