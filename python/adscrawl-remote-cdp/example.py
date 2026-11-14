"""Browser Use 1.0+ with an AdsCrawl-owned temporary Remote CDP session.

The control-plane API key and the CDP data token are different credentials.
The CDP URL stays in memory and is never added to task text or output.
"""

from __future__ import annotations

import argparse
import asyncio
import ipaddress
import json
import logging
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlsplit, urlunsplit
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, ValidationError

API_URL = "https://api.adscrawl.net/cdp/sessions"
OPENAI_BASE_URL = "https://api.openai.com/v1"


class ExampleError(Exception):
    """Safe-to-display failure without provider bodies or exception chains."""


class ConfigurationError(ExampleError):
    pass


class SessionCreationUnknown(ExampleError):
    """Creation did not yield a usable session; preserve a known UUID for cleanup."""

    def __init__(self, message: str, *, session_id: UUID | None = None) -> None:
        super().__init__(message)
        self.session_id = session_id


class CleanupUnconfirmed(ExampleError):
    pass


class PageSummary(BaseModel):
    title: str = ""
    h1: str = ""
    bullet_points: list[str] = Field(default_factory=list, max_length=3)


@dataclass(frozen=True)
class Target:
    url: str
    origin: str
    display_url: str


def validate_target(raw: str) -> Target:
    """Reject obvious non-public, credential-bearing, and non-web URL forms."""
    if any(character.isspace() or ord(character) < 32 for character in raw) or "\\" in raw:
        raise ConfigurationError("--url must not contain raw whitespace, controls, or backslashes")
    try:
        parsed = urlsplit(raw)
    except ValueError:
        raise ConfigurationError("--url must be a valid public HTTP(S) URL") from None
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ConfigurationError("--url must be a public HTTP(S) URL")
    if parsed.username is not None or parsed.password is not None or parsed.fragment:
        raise ConfigurationError("--url must not contain userinfo or a fragment")
    if not parsed.hostname.isascii():
        raise ConfigurationError("--url must use an ASCII/punycode DNS hostname")
    try:
        host = parsed.hostname.encode("idna").decode("ascii").lower().rstrip(".")
    except UnicodeError:
        raise ConfigurationError("--url must contain a valid DNS hostname") from None
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if (
        not host
        or address is not None
        or host == "localhost"
        or host.endswith(".localhost")
        or host.endswith(".local")
    ):
        raise ConfigurationError(
            "--url must use a public DNS hostname, not localhost or an IP literal"
        )
    try:
        port = parsed.port
    except ValueError:
        raise ConfigurationError("--url has an invalid port") from None
    scheme = parsed.scheme.lower()
    if port is not None and (
        (scheme == "https" and port == 443) or (scheme == "http" and port == 80)
    ):
        port = None
    origin = f"{scheme}://{host}" + (f":{port}" if port else "")
    # Query parameters may carry signed values. Keep them for navigation, but never echo them.
    display_url = urlunsplit((scheme, parsed.netloc, parsed.path, "", ""))
    return Target(raw, origin, display_url)


def _secret(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value or value.startswith("YOUR_"):
        raise ConfigurationError(f"{name} must be set to a real environment value")
    return value


def configure_logging() -> None:
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
    os.environ.setdefault("BROWSER_USE_LOGGING_LEVEL", "warning")
    logging.basicConfig(level=logging.WARNING)


def _safe_uuid(value: Any) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise SessionCreationUnknown(
            "AdsCrawl returned no valid session ID; inspect existing sessions before retrying"
        ) from None


def validate_cdp_url(value: str, session_id: UUID) -> None:
    """Accept only the documented HTTPS endpoint and its embedded data token."""
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
        query = parse_qs(parsed.query, keep_blank_values=True)
    except ValueError:
        raise SessionCreationUnknown("AdsCrawl returned an invalid CDP URL") from None
    expected_path = f"/cdp/sessions/{session_id}"
    tokens = query.get("token", [])
    if (
        parsed.scheme != "https"
        or host != "api.adscrawl.net"
        or port not in (None, 443)
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or parsed.path != expected_path
        or set(query) != {"token"}
        or len(tokens) != 1
        or not tokens[0]
    ):
        raise SessionCreationUnknown("AdsCrawl returned an invalid CDP URL")


async def create_session(client: httpx.AsyncClient, api_key: str) -> tuple[UUID, str]:
    payload = {
        "idleTimeoutMs": 60000,
        "maxSessionMs": 180000,
        "browserSettings": {"countryCode": "GLOBAL"},
    }
    try:
        response = await client.post(
            API_URL,
            headers={"x-api-key": api_key, "content-type": "application/json"},
            json=payload,
        )
    except (httpx.HTTPError, TimeoutError):
        raise SessionCreationUnknown(
            "Session creation outcome unknown; inspect AdsCrawl sessions before retrying"
        ) from None
    if response.status_code >= 500:
        raise SessionCreationUnknown(
            "Session creation outcome unknown; inspect AdsCrawl sessions before retrying"
        )
    if response.status_code < 200 or response.status_code >= 300:
        raise ExampleError(f"AdsCrawl session creation failed with HTTP {response.status_code}")
    try:
        body = response.json()
    except (ValueError, json.JSONDecodeError):
        raise SessionCreationUnknown(
            "Invalid session response; inspect AdsCrawl sessions before retrying"
        ) from None
    if not isinstance(body, dict):
        raise SessionCreationUnknown(
            "Invalid session response; inspect AdsCrawl sessions before retrying"
        )
    session_id = _safe_uuid(body.get("sessionId"))
    cdp_url = body.get("cdpBaseUrl")
    if not isinstance(cdp_url, str):
        raise SessionCreationUnknown(
            "Invalid session response; inspect AdsCrawl sessions before retrying",
            session_id=session_id,
        )
    try:
        validate_cdp_url(cdp_url, session_id)
    except SessionCreationUnknown as error:
        raise SessionCreationUnknown(str(error), session_id=session_id) from None
    return session_id, cdp_url


async def delete_session(
    client: httpx.AsyncClient,
    api_key: str,
    session_id: UUID,
    *,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    attempts: int = 3,
) -> None:
    """Delete the AdsCrawl resource; closing Browser Use alone is not sufficient."""
    url = f"{API_URL}/{session_id}"
    last_status: int | None = None
    for attempt in range(attempts):
        try:
            response = await client.delete(url, headers={"x-api-key": api_key})
            last_status = response.status_code
            if response.status_code in (404, 410):
                return
            if response.status_code == 200:
                try:
                    body = response.json()
                except (ValueError, json.JSONDecodeError):
                    body = None
                if isinstance(body, dict) and body.get("ok") is True:
                    return
            retryable = response.status_code in (409, 429) or response.status_code >= 500
        except (httpx.HTTPError, TimeoutError):
            retryable = True
        if not retryable or attempt == attempts - 1:
            break
        await sleep(0.1 * (attempt + 1))
    suffix = f" (last HTTP {last_status})" if last_status is not None else " (request timed out)"
    raise CleanupUnconfirmed(
        f"AdsCrawl session {session_id} cleanup unconfirmed{suffix}; handle this UUID manually"
    )


PAGE_READING_TASK = (
    "Read the already-authorized public page at the supplied URL. Report its page title, first H1, "
    "and at most three concise bullet points visible on that page. Do not click, submit, log in, "
    "fill forms, purchase, download, upload, or navigate to another URL. Return only the requested "
    "structured fields."
)


async def run_example(
    target: Target,
    model_name: str,
    api_key: str,
    openai_key: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    configure_logging()
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0))
    session_id: UUID | None = None
    browser = agent = None
    try:
        session_id, cdp_url = await create_session(client, api_key)
        # Lazy imports keep module import and offline validation side-effect free.
        from browser_use import Agent, Browser, ChatOpenAI

        llm = ChatOpenAI(model=model_name, api_key=openai_key, base_url=OPENAI_BASE_URL)
        browser = Browser(
            cdp_url=cdp_url,
            allowed_domains=[target.origin],
            block_ip_addresses=True,
            keep_alive=False,
        )
        agent = Agent(
            task=f"{PAGE_READING_TASK}\nURL: {target.url}",
            llm=llm,
            browser=browser,
            use_vision=False,
            web_search=False,
            output_model_schema=PageSummary,
        )
        history = await agent.run(max_steps=6, timeout=90)
        structured = getattr(history, "structured_output", None)
        if isinstance(history, PageSummary):
            structured = history
            completed = True
        else:
            completed = getattr(history, "status", None) == "completed"
        if completed and structured is not None:
            try:
                summary = PageSummary.model_validate(structured).model_dump()
                status = "completed"
            except ValidationError:
                summary = {}
                status = "incomplete"
        else:
            summary = {}
            status = "incomplete"
        return {"status": status, "requested_url": target.display_url, "summary": summary}
    except asyncio.CancelledError:
        raise
    except SessionCreationUnknown as error:
        if error.session_id is not None:
            session_id = error.session_id
        raise
    except ExampleError:
        raise
    except Exception:
        return {"status": "error", "requested_url": target.display_url, "summary": {}}
    finally:
        try:
            if agent is not None:
                try:
                    await agent.close()
                except Exception:
                    pass
            elif browser is not None:
                try:
                    await browser.close()
                except Exception:
                    pass
            if session_id is not None:
                await delete_session(client, api_key, session_id)
        finally:
            if own_client:
                await client.aclose()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Ask Browser Use to read an authorized public URL via an AdsCrawl Remote CDP session."
        )
    )
    parser.add_argument("--url", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument(
        "--authorized",
        action="store_true",
        help="confirm AdsCrawl and your selected model provider may process this public URL",
    )
    args = parser.parse_args(argv)
    if not args.authorized:
        parser.error("--authorized is required")
    return args


async def async_main(args: argparse.Namespace) -> int:
    target = validate_target(args.url)
    adscrawl_key = _secret("ADSCRAWL_API_KEY")
    openai_key = _secret("OPENAI_API_KEY")
    result = await run_example(target, args.model, adscrawl_key, openai_key)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "completed" else 1


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(parse_args(argv)))


if __name__ == "__main__":
    main()
