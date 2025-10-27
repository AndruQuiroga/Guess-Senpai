from __future__ import annotations

from fastapi.middleware.cors import CORSMiddleware

from app import main as app_main


def _get_cors_options(app_main_module) -> dict:
    app = app_main_module.create_app()
    for middleware in app.user_middleware:
        if middleware.cls is CORSMiddleware:
            return middleware.kwargs
    raise AssertionError("CORS middleware not configured")


def test_frontend_base_url_is_added_to_cors_origins(monkeypatch):
    class DummySettings:
        def __init__(self) -> None:
            self.cors_origins = ["https://api.example"]
            self.frontend_base_url = "https://frontend.example"

    custom_settings = DummySettings()

    monkeypatch.setattr(app_main, "settings", custom_settings)
    monkeypatch.setattr(app_main, "register_database", lambda app: None)

    cors_options = _get_cors_options(app_main)

    assert "https://frontend.example" in cors_options["allow_origins"]
