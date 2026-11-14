# AdsCrawl Remote CDP with Browser Use 1.0+

A small Python example that asks the open-source Browser Use agent to summarize a **public page you are authorized to read**, using an AdsCrawl temporary Remote CDP session.

This is an independent AdsCrawl-maintained example, not a Browser Use Cloud SDK integration, not maintained or endorsed by Browser Use, and not an official Browser Use integration listing. It uses the open-source `browser-use` package (`Browser(cdp_url=...)`), not `browser-use-sdk` or Browser Use Cloud task/session endpoints.

## How the connection works

1. The script creates a temporary AdsCrawl CDP session with `POST /cdp/sessions`, authenticated with your AdsCrawl `x-api-key`.
2. AdsCrawl returns a `cdpBaseUrl` containing a separate, short-lived CDP data token. The script passes that URL unchanged to `Browser(cdp_url=...)`; it never prints the URL, puts it in agent task text, or substitutes the API key for the data token.
3. Browser Use connects to that remote Chromium instance. The example sets a host/scheme allow rule, blocks IP-literal navigation, disables Browser Use web search and asks for a small structured page summary.
4. In `finally`, it closes the Browser Use agent and separately calls AdsCrawl `DELETE /cdp/sessions/{sessionId}` with the AdsCrawl API key. Disconnecting Browser Use is not the same as deleting the AdsCrawl session.

The documented AdsCrawl API and Browser Use 1.0 APIs are linked here: [AdsCrawl Remote CDP](https://docs.adscrawl.net/concepts/remote-cdp), [create a CDP session](https://docs.adscrawl.net/api-reference/cdp-sessions), [delete a CDP session](https://docs.adscrawl.net/api-reference/cdp-sessions-delete), and [Browser Use](https://github.com/browser-use/browser-use).

## Important safety boundary

The agent task says to read only. **That natural-language request is not an enforced read-only policy.** Browser Use 1.0 agents operate a Python REPL; they may take actions beyond what a prompt requests. Browser Use's domain restrictions and IP-literal blocking are defense in depth, not a sandbox, and do not constrain the agent's own Python networking or all subresource requests.

Use this example only for non-sensitive public pages you are authorized to have processed. Do not use it on signed-in accounts, private or personal pages, payment flows, forms, or untrusted URLs. Do not treat `--authorized` as a technical control; it is an explicit operator confirmation. For untrusted tasks or URLs, add an externally enforced network allowlist and process/container isolation before running an agent.

The complete page URL—including its query string—is sent to AdsCrawl for navigation and included in the agent task. The page content is sent to the OpenAI model you select. The printed result strips the query and fragment from the displayed URL, but that does not change the URL sent for processing. Avoid signed URLs, credentials, or other secrets in the URL. The CDP data-token URL is kept in memory and is not printed; if cleanup cannot be confirmed, the script reports the session UUID so you can check it in AdsCrawl before retrying.

## Requirements and setup

- Python 3.11 or later.
- `uv` for the pinned dependency set in `uv.lock`.
- An AdsCrawl API key with permission to create CDP sessions.
- An OpenAI API key and a model ID available to your account and supported by `ChatOpenAI`.

The example intentionally does not load `.env` files. Set the variables in your shell or secret manager; `.env.example` contains placeholders only.

```bash
uv sync --locked
export ADSCRAWL_API_KEY='YOUR_ADSCRAWL_API_KEY'
export OPENAI_API_KEY='YOUR_OPENAI_API_KEY'
uv run python example.py \
  --url 'https://example.com/' \
  --model 'YOUR_SUPPORTED_MODEL_ID' \
  --authorized
```

Replace the two placeholder values and model ID locally. Never commit real credentials. You can omit `--authorized` only to see the CLI refuse to run.

## Output and cleanup

The script prints JSON with `status`, a query/fragment-stripped `requested_url`, and the structured `title`, `h1`, and up to three bullet points. `incomplete` means the agent did not return the requested structured result; `error` is deliberately generic and does not print provider response bodies or the CDP token.

The AdsCrawl control-plane API key is used only for creating and deleting the session. The CDP data token is carried inside `cdpBaseUrl` and passed to Browser Use as-is. The OpenAI key is used by `ChatOpenAI`. Check the current service/model terms and pricing before running: creating a remote browser session and making model requests can incur charges.

If the create request times out or returns a server error, the outcome can be unknown. The script does not automatically retry session creation; inspect your active AdsCrawl sessions before retrying. A final DELETE that cannot be confirmed raises an error with the session UUID for manual follow-up.

## Tests and evidence boundary

```bash
uv run pytest -q
uv run ruff check .
```

Tests use `httpx.MockTransport`, a fake Browser Use agent, and pytest's disabled-socket fixture. They exercise AdsCrawl request/response handling, the Browser Use 1.0 `AgentHistoryList.structured_output` shape, authorization and domain configuration, credential redaction, retryable deletion, and cleanup ownership. They do not create a real AdsCrawl session, connect to a CDP browser, visit a website, or call a model. Passing them is not live end-to-end or production verification.

## Project files

- `example.py` — CLI, AdsCrawl session lifecycle, Browser Use 1.0+ wiring.
- `test_example.py` — fully mocked offline tests.
- `pyproject.toml` and `uv.lock` — pinned Python dependencies (`browser-use==1.0.4`).
- `.env.example` — placeholder variable names, not auto-loaded.
