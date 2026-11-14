from __future__ import annotations

import json
import sys
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
from browser_use.agent.views import AgentHistoryList

import example

API_KEY = "test-control-plane-key"
DATA_TOKEN = "test-cdp-data-token"
SESSION_ID = UUID("6c3f7d14-7fe4-4c8e-9f1b-0b6d6f2fa2ef")
CDP_URL = f"https://api.adscrawl.net/cdp/sessions/{SESSION_ID}?token={DATA_TOKEN}"
PUBLIC_URL = "https://example.com/article?access_token=page-secret"


def test_validate_target_blocks_obvious_local_and_credential_urls() -> None:
    for url in (
        "file:///etc/passwd",
        "http://localhost/private",
        "https://sub.localhost/private",
        "http://127.0.0.1/",
        "http://[::1]/",
        "https://user:pass@example.com/",
        "https://example.com/#fragment",
    ):
        with pytest.raises(example.ConfigurationError):
            example.validate_target(url)


def test_validate_target_keeps_query_for_navigation_but_sanitizes_output() -> None:
    target = example.validate_target(PUBLIC_URL)
    assert target.url == PUBLIC_URL
    assert target.origin == "https://example.com"
    assert target.display_url == "https://example.com/article"
    assert "page-secret" not in target.display_url


def test_secret_requires_non_placeholder_environment_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADSCRAWL_API_KEY", "YOUR_ADSCRAWL_API_KEY")
    with pytest.raises(example.ConfigurationError, match="ADSCRAWL_API_KEY"):
        example._secret("ADSCRAWL_API_KEY")
    monkeypatch.setenv("ADSCRAWL_API_KEY", API_KEY)
    assert example._secret("ADSCRAWL_API_KEY") == API_KEY


def test_validate_cdp_url_rejects_bad_endpoint_without_echoing_token() -> None:
    bad = f"https://attacker.example/cdp/sessions/{SESSION_ID}?token={DATA_TOKEN}"
    with pytest.raises(example.SessionCreationUnknown) as error:
        example.validate_cdp_url(bad, SESSION_ID)
    assert DATA_TOKEN not in str(error.value)


@pytest.mark.asyncio
async def test_create_session_uses_control_plane_key_and_validates_contract() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": CDP_URL})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        session_id, cdp_url = await example.create_session(client, API_KEY)

    assert session_id == SESSION_ID
    assert cdp_url == CDP_URL
    assert len(seen) == 1
    assert str(seen[0].url) == example.API_URL
    assert seen[0].headers["x-api-key"] == API_KEY
    assert json.loads(seen[0].content) == {
        "idleTimeoutMs": 60000,
        "maxSessionMs": 180000,
        "browserSettings": {"countryCode": "GLOBAL"},
    }


@pytest.mark.asyncio
async def test_create_session_treats_server_error_as_unknown_without_retry() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503, json={"error": "may contain provider details"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(example.SessionCreationUnknown, match="outcome unknown"):
            await example.create_session(client, API_KEY)
    assert calls == 1


@pytest.mark.asyncio
async def test_create_session_rejects_non_object_response_without_leaking_payload() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(201, json=[DATA_TOKEN]))
    ) as client:
        with pytest.raises(example.SessionCreationUnknown) as error:
            await example.create_session(client, API_KEY)
    assert DATA_TOKEN not in str(error.value)


@pytest.mark.asyncio
async def test_delete_session_retries_conflict_then_confirms() -> None:
    statuses = iter((409, 200))
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        status = next(statuses)
        return httpx.Response(status, json={"ok": True} if status == 200 else {"error": "busy"})

    async def no_sleep(_: float) -> None:
        return None

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await example.delete_session(client, API_KEY, SESSION_ID, sleep=no_sleep)

    assert len(calls) == 2
    assert all(request.method == "DELETE" for request in calls)
    assert all(str(request.url) == f"{example.API_URL}/{SESSION_ID}" for request in calls)
    assert all(request.headers["x-api-key"] == API_KEY for request in calls)
    assert all(DATA_TOKEN not in str(request.url) for request in calls)


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [404, 410])
async def test_delete_session_treats_missing_or_expired_as_confirmed(status: int) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(status))
    ) as client:
        await example.delete_session(client, API_KEY, SESSION_ID)


@pytest.mark.asyncio
async def test_delete_session_surfaces_unconfirmed_uuid_without_token() -> None:
    async def no_sleep(_: float) -> None:
        return None

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(503))
    ) as client:
        with pytest.raises(example.CleanupUnconfirmed) as error:
            await example.delete_session(client, API_KEY, SESSION_ID, sleep=no_sleep, attempts=2)
    assert str(SESSION_ID) in str(error.value)
    assert DATA_TOKEN not in str(error.value)


class FakeBrowser:
    created: dict[str, object] | None = None
    close_calls = 0

    def __init__(self, **kwargs: object) -> None:
        type(self).created = kwargs
        type(self).close_calls = 0

    async def close(self) -> None:
        type(self).close_calls += 1


class FakeAgent:
    task: str | None = None
    kwargs: dict[str, object] | None = None
    close_calls = 0
    run_calls: list[dict[str, object]] = []
    history: object | None = None

    def __init__(self, *, task: str, **kwargs: object) -> None:
        type(self).task = task
        type(self).kwargs = kwargs
        type(self).close_calls = 0
        type(self).run_calls = []

    async def run(self, **kwargs: object) -> object:
        type(self).run_calls.append(kwargs)
        if isinstance(type(self).history, Exception):
            raise type(self).history
        return type(self).history

    async def close(self) -> None:
        type(self).close_calls += 1


class FakeChatOpenAI:
    created: dict[str, object] | None = None

    def __init__(self, **kwargs: object) -> None:
        type(self).created = kwargs


def _history(*, status: str = "completed", output: object | None = None) -> AgentHistoryList:
    return AgentHistoryList(
        status=status,
        text="",
        output=output,
        steps=1,
        duration_s=0.1,
        usage={},
        cost_usd=0.0,
        partial=None,
        error=None,
        messages=[],
        output_schema=example.PageSummary,
    )


def _install_fakes(monkeypatch: pytest.MonkeyPatch, history: object) -> None:
    FakeAgent.history = history
    FakeBrowser.created = None
    FakeChatOpenAI.created = None
    monkeypatch.setitem(
        sys.modules,
        "browser_use",
        SimpleNamespace(Agent=FakeAgent, Browser=FakeBrowser, ChatOpenAI=FakeChatOpenAI),
    )


@pytest.mark.asyncio
async def test_run_example_uses_browser_use_1_history_shape_and_cleans_up(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    summary = example.PageSummary(title="Example", h1="Article", bullet_points=["One"])
    _install_fakes(monkeypatch, _history(output=summary))
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "POST":
            return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": CDP_URL})
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await example.run_example(
            example.validate_target(PUBLIC_URL),
            "test-model",
            API_KEY,
            "test-openai-key",
            client=client,
        )

    assert result == {
        "status": "completed",
        "requested_url": "https://example.com/article",
        "summary": {"title": "Example", "h1": "Article", "bullet_points": ["One"]},
    }
    assert DATA_TOKEN not in json.dumps(result)
    assert "page-secret" not in json.dumps(result)
    assert FakeBrowser.created == {
        "cdp_url": CDP_URL,
        "allowed_domains": ["https://example.com"],
        "block_ip_addresses": True,
        "keep_alive": False,
    }
    assert "page-secret" in (FakeAgent.task or "")  # Query remains available for navigation.
    assert DATA_TOKEN not in (FakeAgent.task or "")
    assert FakeAgent.kwargs is not None
    assert FakeAgent.kwargs["web_search"] is False
    assert FakeAgent.kwargs["use_vision"] is False
    assert FakeAgent.run_calls == [{"max_steps": 6, "timeout": 90}]
    assert FakeAgent.close_calls == 1
    assert FakeBrowser.close_calls == 0  # Agent owns the Browser Use lifecycle.
    assert len(requests) == 2
    assert requests[1].method == "DELETE"


@pytest.mark.asyncio
async def test_run_example_returns_incomplete_for_missing_structured_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fakes(monkeypatch, _history(status="timeout", output=None))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": CDP_URL})
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await example.run_example(
            example.validate_target("https://example.com"),
            "test-model",
            API_KEY,
            "test-openai-key",
            client=client,
        )
    assert result["status"] == "incomplete"
    assert FakeAgent.close_calls == 1


@pytest.mark.asyncio
async def test_run_example_closes_created_browser_when_agent_construction_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class BrokenAgent:
        def __init__(self, **_: object) -> None:
            raise RuntimeError("private agent details")

    monkeypatch.setitem(
        sys.modules,
        "browser_use",
        SimpleNamespace(Agent=BrokenAgent, Browser=FakeBrowser, ChatOpenAI=FakeChatOpenAI),
    )

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": CDP_URL})
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await example.run_example(
            example.validate_target("https://example.com"),
            "test-model",
            API_KEY,
            "test-openai-key",
            client=client,
        )
    assert result["status"] == "error"
    assert "private agent details" not in json.dumps(result)
    assert FakeBrowser.close_calls == 1


def test_parse_args_requires_explicit_user_authorization() -> None:
    with pytest.raises(SystemExit):
        example.parse_args(["--url", "https://example.com", "--model", "test-model"])
    parsed = example.parse_args(
        ["--url", "https://example.com", "--model", "test-model", "--authorized"]
    )
    assert parsed.authorized is True


@pytest.mark.parametrize(
    "url",
    [
        "https://example..com/",
        "https://exa mple.com/",
        "https://example.com\\@localhost/",
        "https://localhost./",
        "https://printer.local/",
    ],
)
def test_validate_target_rejects_malformed_or_local_dns(url: str) -> None:
    with pytest.raises(example.ConfigurationError):
        example.validate_target(url)


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_cdp", [None, "https://attacker.example/?token=test-cdp-data-token"])
async def test_known_uuid_is_deleted_when_create_response_has_invalid_cdp_url(
    bad_cdp: str | None,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.method == "POST":
            return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": bad_cdp})
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(example.SessionCreationUnknown) as error:
            await example.run_example(
                example.validate_target("https://example.com"),
                "test-model",
                API_KEY,
                "test-openai-key",
                client=client,
            )
    assert error.value.session_id == SESSION_ID
    assert DATA_TOKEN not in str(error.value)
    assert [request.method for request in requests] == ["POST", "DELETE"]
    assert str(requests[-1].url) == f"{example.API_URL}/{SESSION_ID}"


@pytest.mark.asyncio
async def test_owned_http_client_is_closed_even_when_session_delete_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fakes(monkeypatch, _history(output=example.PageSummary(title="Example")))

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(201, json={"sessionId": str(SESSION_ID), "cdpBaseUrl": CDP_URL})
        return httpx.Response(401)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(example.httpx, "AsyncClient", lambda **_: client)
    try:
        with pytest.raises(example.CleanupUnconfirmed):
            await example.run_example(
                example.validate_target("https://example.com"),
                "test-model",
                API_KEY,
                "test-openai-key",
            )
        assert client.is_closed
    finally:
        await client.aclose()


def test_unicode_hostname_requires_explicit_punycode() -> None:
    with pytest.raises(example.ConfigurationError, match="ASCII/punycode"):
        example.validate_target("https://faß.de/")


def test_punycode_hostname_has_stable_authorized_origin() -> None:
    target = example.validate_target("https://xn--fa-hia.de/")
    assert target.origin == "https://xn--fa-hia.de"
    assert target.url == "https://xn--fa-hia.de/"
