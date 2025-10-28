"""create media title index tables

Revision ID: 202411090001
Revises: 202411080001_create_user_recent_media
Create Date: 2024-11-09 00:01:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202411090001"
down_revision = "202411080001_create_user_recent_media"
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
            # ``pg_trgm`` requires superuser/owner privileges. When the
            # extension cannot be installed (e.g. managed Postgres services),
            # we still want the schema migration to succeed so that the API
            # can boot.  We fall back to standard indexes below.
            trigram_supported = False

    op.create_table(
        "media_titles",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("canonical_title", sa.String(length=512), nullable=False),
        sa.Column("normalized_title", sa.String(length=512), nullable=False),
        sa.Column("romaji_title", sa.String(length=512), nullable=True),
        sa.Column("english_title", sa.String(length=512), nullable=True),
        sa.Column("native_title", sa.String(length=512), nullable=True),
        sa.Column("user_preferred_title", sa.String(length=512), nullable=True),
        sa.Column("cover_image", sa.String(length=1024), nullable=True),
        sa.Column("format", sa.String(length=64), nullable=True),
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
        "ix_media_titles_normalized_title",
        "media_titles",
        ["normalized_title"],
        unique=False,
    )

    op.create_table(
        "media_title_aliases",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("media_id", sa.BigInteger(), nullable=False),
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
        sa.ForeignKeyConstraint(["media_id"], ["media_titles.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_media_title_aliases_normalized_alias",
        "media_title_aliases",
        ["normalized_alias"],
        unique=False,
    )
    op.create_index(
        "ix_media_title_aliases_media_priority",
        "media_title_aliases",
        ["media_id", "priority"],
        unique=False,
    )
    if trigram_supported and dialect_name == "postgresql":
        op.create_index(
            "ix_media_title_aliases_trgm",
            "media_title_aliases",
            ["alias"],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={"alias": "gin_trgm_ops"},
        )
    else:
        # Fallback for databases where ``pg_trgm`` is unavailable.  The
        # regular btree index keeps lookups responsive even without trigram
        # search support.
        op.create_index(
            "ix_media_title_aliases_trgm",
            "media_title_aliases",
            ["alias"],
            unique=False,
        )
    if dialect_name == "sqlite":
        op.create_index(
            "uq_media_title_alias_media",
            "media_title_aliases",
            ["media_id", "normalized_alias"],
            unique=True,
        )
    else:
        op.create_unique_constraint(
            "uq_media_title_alias_media",
            "media_title_aliases",
            ["media_id", "normalized_alias"],
        )


def downgrade() -> None:
    ctx = op.get_context()
    dialect_name = getattr(ctx.dialect, "name", "")
    if dialect_name == "sqlite":
        op.drop_index("uq_media_title_alias_media", table_name="media_title_aliases")
    else:
        op.drop_constraint("uq_media_title_alias_media", "media_title_aliases", type_="unique")
    op.drop_index("ix_media_title_aliases_trgm", table_name="media_title_aliases")
    op.drop_index("ix_media_title_aliases_media_priority", table_name="media_title_aliases")
    op.drop_index("ix_media_title_aliases_normalized_alias", table_name="media_title_aliases")
    op.drop_table("media_title_aliases")
    op.drop_index("ix_media_titles_normalized_title", table_name="media_titles")
    op.drop_table("media_titles")
