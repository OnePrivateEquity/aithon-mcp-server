# Aithon MCP Server

**AI Agent Marketplace — MCP (Model Context Protocol) Server**

Aithon is a multi-tenant B2B services marketplace for IT, telecom, and AI services. This MCP server enables AI agents to discover, browse, and purchase services programmatically.

## 🔗 Live Endpoints

| Endpoint | URL |
|----------|-----|
| MCP Manifest | `https://aithon.tech/api/v1/mcp` |
| JSON-RPC | `https://aithon.tech/api/v1/mcp/rpc` |
| agents.json | `https://aithon.tech/.well-known/agents.json` |
| llms.txt | `https://aithon.tech/llms.txt` |

## 🛠 Available Tools

| Tool | Auth Required | Description |
|------|:---:|-------------|
| `aithon.tools.list` | ❌ | List all available MCP tools with schemas |
| `aithon.catalog.search` | ❌ | Search the catalog of AI and IT services |
| `aithon.catalog.get` | ❌ | Get full details for a service by ID |
| `aithon.service.buy` | ✅ | Purchase a service (returns access token) |
| `aithon.agent.wallet.balance` | ✅ | Check your agent wallet balance |

## 🚀 Quick Start

### Browse the catalog (no auth needed)

```bash
curl -X POST https://aithon.tech/api/v1/mcp/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "aithon.catalog.search",
    "params": { "query": "internet", "limit": 10 },
    "id": 1
  }'
```

### Get service details

```bash
curl -X POST https://aithon.tech/api/v1/mcp/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "aithon.catalog.get",
    "params": { "service_id": "YOUR_SERVICE_ID" },
    "id": 2
  }'
```

### Purchase a service (requires API key)

```bash
curl -X POST https://aithon.tech/api/v1/mcp/rpc \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_AGENT_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "method": "aithon.service.buy",
    "params": { "service_id": "YOUR_SERVICE_ID" },
    "id": 3
  }'
```

## 🔐 Authentication

Public tools (`catalog.search`, `catalog.get`, `tools.list`) require no authentication.

Transactional tools (`service.buy`, `agent.wallet.balance`) require an `x-api-key` header. Register as an AI agent at [aithon.tech/agents/register](https://aithon.tech/agents/register) to get your API key.

## 📡 Discovery

Aithon supports multiple AI agent discovery standards:

- **MCP Manifest** — `GET /api/v1/mcp` returns the full tool manifest
- **agents.json** — `GET /.well-known/agents.json` for [agents.json](https://agentsjson.org/) discovery
- **llms.txt** — `GET /llms.txt` for LLM-readable site description

### Partner Catalog Instances

Each partner gets scoped discovery endpoints:

- `GET /c/:slug/.well-known/agents.json`
- `GET /c/:slug/llms.txt`
- `GET /c/:slug/api/v1/mcp`

## 🏗 Architecture

```
┌─────────────────┐     JSON-RPC 2.0      ┌──────────────────┐
│   AI Agent       │ ◄──────────────────► │  Aithon MCP      │
│   (Claude, GPT,  │     x-api-key auth   │  Server           │
│    Grok, etc.)   │                       │                   │
└─────────────────┘                       └────────┬──────────┘
                                                    │
                                          ┌────────▼──────────┐
                                          │  PostgreSQL        │
                                          │  • agent_services  │
                                          │  • agents          │
                                          │  • transactions    │
                                          │  • wallets         │
                                          └───────────────────┘
```

## 💰 Pricing

- **Browsing**: Free (no auth needed)
- **Transactions**: 10% platform fee on purchases
- **Agent wallets**: Fund via Stripe, with optional toll-tag auto-refill

## 📋 JSON-RPC Protocol

All tool calls use [JSON-RPC 2.0](https://www.jsonrpc.org/specification):

```json
{
  "jsonrpc": "2.0",
  "method": "aithon.catalog.search",
  "params": { "query": "fiber internet" },
  "id": 1
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32600 | Invalid JSON-RPC request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32003 | Missing or invalid API key |
| -32010 | Insufficient wallet balance |
| -32011 | Service not found |

## 🔗 Links

- **Platform**: [aithon.tech](https://aithon.tech)
- **API Docs**: [aithon.tech/api/docs](https://aithon.tech/api/docs)
- **Partner Registration**: [aithon.tech/registerpartner](https://aithon.tech/registerpartner)
- **Agent Registration**: [aithon.tech/agents/register](https://aithon.tech/agents/register)

## License

MIT
