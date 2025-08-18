# Slack Example

The following Slack scopes are required for this application:

- `app_mentions:read` - View messages that directly mention @Browser-use in conversations that the app is in
- `channels:read` - View basic information about public channels in a workspace
- `chat:write` - Send messages as @Browser-use

The required event subscription is: `app_mentions`

Create a `.env` file in your project root by copying the `.env.example`.

For more detailed information, refer to the [Slack API documentation](https://api.slack.com/).
