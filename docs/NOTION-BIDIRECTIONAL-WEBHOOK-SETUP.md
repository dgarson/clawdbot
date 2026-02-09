# Notion Bidirectional Integration Setup

OpenClaw supports full bidirectional Notion integration:

- **Inbound** (Notion → OpenClaw): Webhook handler receives events when pages/databases/comments change
- **Outbound** (OpenClaw → Notion): Agent tools for searching, reading, creating, and updating Notion content

## Prerequisites

1. A [Notion internal integration](https://www.notion.so/my-integrations) (or public OAuth integration)
2. The integration must have access to the pages/databases you want to monitor
3. For webhooks: a publicly accessible URL (or tunneled via Tailscale/ngrok)

## Quick Start

### 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Give it a name (e.g. "OpenClaw")
4. Select the workspace
5. Under **Capabilities**, enable:
   - Read content
   - Update content
   - Insert content
   - Read comments (optional)
6. Copy the **Internal Integration Secret** (starts with `ntn_`)

### 2. Configure Environment Variables

Set these environment variables (or add them to your `openclaw.yaml` config):

```bash
# Required: API key for outbound API calls (tools)
export NOTION_API_KEY="ntn_your_integration_secret"

# Required for webhooks: HMAC-SHA256 signature validation secret
export NOTION_WEBHOOK_SECRET="your_webhook_signing_secret"

# Optional: Bot user ID for loop prevention (skip self-authored events)
export NOTION_BOT_ID="your_bot_user_uuid"
```

### 3. Configure in openclaw.yaml

```yaml
notion:
  botId: "your-bot-user-uuid" # Optional: for self-authored event filtering
  webhook:
    enabled: true
    secret: "${NOTION_WEBHOOK_SECRET}"
    # path: "/webhooks/notion"  # Optional: custom endpoint path
  tools:
    enabled: true
    apiKey: "${NOTION_API_KEY}"
```

Or use env vars only — the integration auto-enables when the respective env vars are present:

- **Tools** auto-enable when `NOTION_API_KEY` is set
- **Webhook** auto-enables when `NOTION_WEBHOOK_SECRET` is set

### 4. Set Up Notion Webhook Subscription

Create a webhook subscription via the Notion API:

```bash
curl -X POST "https://api.notion.com/v1/webhooks" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-gateway.example.com/webhooks/notion",
    "event_types": [
      "page.created",
      "page.content_updated",
      "page.properties_updated",
      "page.moved",
      "page.deleted",
      "database.content_updated",
      "database.schema_updated",
      "comment.created",
      "comment.updated"
    ]
  }'
```

During subscription creation, Notion sends a verification request to your endpoint. The handler automatically echoes back the `verification_token` to complete the handshake.

### 5. Share Pages with Your Integration

In Notion, open each page/database you want the integration to access:

1. Click the **⋮** menu (or **Share**)
2. **Add connections** → select your integration
3. Repeat for each top-level page/database

## Architecture

### Inbound Webhook Flow

```
Notion Event → POST /webhooks/notion → Signature Validation → Event Parsing
    → Loop Prevention (skip bot-authored) → Event Categorization:
        • memory: Content changes → Memory Ingest Pipeline
        • wake:   Structural changes → Session Wake
        • system: Admin events → System Log
```

### Outbound Tools

The following agent tools are available when `NOTION_API_KEY` is configured:

| Tool                      | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `notion_search`           | Search pages and databases by keyword                  |
| `notion_get_page`         | Get a page with all its properties                     |
| `notion_get_page_content` | Get block content (body) of a page                     |
| `notion_create_page`      | Create a page in a database or under a parent page     |
| `notion_update_page`      | Update page properties, icon, cover, or archive status |
| `notion_append_blocks`    | Append block content to a page                         |
| `notion_query_database`   | Query a database with filters and sorts                |

All tools use Notion API version `2025-09-03`.

### Event Types

| Event                                   | Category | Action                    |
| --------------------------------------- | -------- | ------------------------- |
| `page.created`                          | memory   | Ingest page content       |
| `page.content_updated`                  | memory   | Re-ingest updated content |
| `page.properties_updated`               | memory   | Ingest property changes   |
| `page.moved`                            | wake     | Wake session              |
| `page.deleted` / `page.undeleted`       | wake     | Wake session              |
| `page.locked` / `page.unlocked`         | system   | Log only                  |
| `database.content_updated`              | memory   | Ingest changes            |
| `database.created` / `database.deleted` | wake     | Wake session              |
| `database.schema_updated`               | wake     | Wake session              |
| `comment.created` / `comment.updated`   | memory   | Ingest comment            |
| `comment.deleted`                       | system   | Log only                  |

### Security

- **HMAC-SHA256 Signature Validation**: When `NOTION_WEBHOOK_SECRET` is configured, all incoming webhook requests are validated using the `X-Notion-Signature` header with timing-safe comparison
- **Loop Prevention**: Events authored by the configured `NOTION_BOT_ID` are silently dropped to prevent infinite loops
- **Fast Acknowledgment**: The handler responds with HTTP 200 immediately, then processes events asynchronously

## Troubleshooting

### Webhook not receiving events

- Verify the webhook URL is publicly accessible
- Check that pages are shared with your integration
- Verify the webhook subscription is active: `GET https://api.notion.com/v1/webhooks`

### Signature validation failing

- Ensure `NOTION_WEBHOOK_SECRET` matches the signing secret from your webhook subscription
- Check that the raw request body is not modified by any middleware/proxy

### Tools returning permission errors

- Ensure the target page/database is shared with your integration
- Verify the integration has the required capabilities (read/update/insert content)

### Loop prevention not working

- Set `NOTION_BOT_ID` to the bot user ID (found via `GET /v1/users/me`)
- The bot ID should match the `id` field in the `authors` array of webhook events

## API Reference

- [Notion Webhooks API](https://developers.notion.com/reference/webhooks)
- [Notion Webhooks Events](https://developers.notion.com/reference/webhooks-events-delivery)
- [Notion REST API](https://developers.notion.com/reference)
