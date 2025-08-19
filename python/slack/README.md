# Slack Example

Dev setup:

```bash
uv sync
```

Slack requires a HTTPS endpoint for its events. For local development, you have to use a service like `ngrok` to get your uvicorn server a public IP and a HTTPS endpoint.

The following Slack scopes are required for this application:

- `app_mentions:read` - View messages that directly mention @Browser-use in conversations that the app is in
- `channels:read` - View basic information about public channels in a workspace
- `chat:write` - Send messages as @Browser-use

The required event subscription is: `app_mentions`

Create a `.env` file in your project root by copying the `.env.example`.

For more detailed information, refer to the [Slack API documentation](https://api.slack.com/).
