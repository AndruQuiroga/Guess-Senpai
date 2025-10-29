from __future__ import annotations

from datetime import date, datetime
from typing import Dict, List, Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base class for application models."""


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    access_token: Mapped[str] = mapped_column(Text)
    access_token_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sessions: Mapped[List["Session"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    daily_progress_entries: Mapped[List["DailyProgress"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    streak: Mapped[Optional["Streak"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    recent_media_entries: Mapped[List["UserRecentMedia"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class DailyProgress(Base):
    __tablename__ = "daily_progress"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, autoincrement=False
    )
    puzzle_date: Mapped[date] = mapped_column(Date, primary_key=True)
    progress: Mapped[Dict[str, Dict[str, object]]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="daily_progress_entries")


class Streak(Base):
    __tablename__ = "streaks"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, autoincrement=False
    )
    count: Mapped[int] = mapped_column(default=0)
    last_completed: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="streak")


class UserRecentMedia(Base):
    __tablename__ = "user_recent_media"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, autoincrement=False
    )
    media_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="recent_media_entries")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, autoincrement=False
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_frame: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    cosmetics: Mapped[Dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="profile")


class MediaTitle(Base):
    __tablename__ = "media_titles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    canonical_title: Mapped[str] = mapped_column(String(512))
    normalized_title: Mapped[str] = mapped_column(String(512), index=True)
    romaji_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    english_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    native_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    user_preferred_title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    cover_image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    format: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    aliases: Mapped[List["MediaTitleAlias"]] = relationship(
        back_populates="media_title", cascade="all, delete-orphan", passive_deletes=True
    )


class MediaTitleAlias(Base):
    __tablename__ = "media_title_aliases"
    __table_args__ = (
        UniqueConstraint("media_id", "normalized_alias", name="uq_media_title_alias_media"),
        Index("ix_media_title_aliases_normalized_alias", "normalized_alias"),
        Index(
            "ix_media_title_aliases_trgm",
            "alias",
            postgresql_using="gin",
            postgresql_ops={"alias": "gin_trgm_ops"},
        ),
        Index("ix_media_title_aliases_media_priority", "media_id", "priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    media_id: Mapped[int] = mapped_column(
        ForeignKey("media_titles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(512), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    media_title: Mapped[MediaTitle] = relationship(back_populates="aliases")


class CharacterEntry(Base):
    __tablename__ = "character_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    canonical_name: Mapped[str] = mapped_column(String(512))
    normalized_name: Mapped[str] = mapped_column(String(512), index=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    native_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    user_preferred_name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    image_large: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    image_medium: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    aliases: Mapped[List["CharacterAlias"]] = relationship(
        back_populates="character", cascade="all, delete-orphan", passive_deletes=True
    )


class CharacterAlias(Base):
    __tablename__ = "character_aliases"
    __table_args__ = (
        UniqueConstraint("character_id", "normalized_alias", name="uq_character_alias_character"),
        Index("ix_character_aliases_normalized_alias", "normalized_alias"),
        Index(
            "ix_character_aliases_trgm",
            "alias",
            postgresql_using="gin",
            postgresql_ops={"alias": "gin_trgm_ops"},
        ),
        Index("ix_character_aliases_character_priority", "character_id", "priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    character_id: Mapped[int] = mapped_column(
        ForeignKey("character_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(512), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    character: Mapped[CharacterEntry] = relationship(back_populates="aliases")
