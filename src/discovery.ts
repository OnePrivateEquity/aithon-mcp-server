/**
 * Aithon Discovery Endpoints
 *
 * Implements AI agent discovery standards:
 * - /.well-known/agents.json  (agentsjson.org)
 * - /llms.txt                 (LLM-readable site description)
 */

import { Router, Request, Response } from 'express';

export function createDiscoveryRouter(): Router {
  const router = Router();

  // ── /.well-known/agents.json ──────────────────────────────────
  router.get('/.well-known/agents.json', (_req: Request, res: Response) => {
    res.json({
      schema_version: '1.0.0',
      name: 'Aithon — AI Agent Marketplace',
      description:
        'Multi-tenant B2B services marketplace for IT, telecom, and AI services. AI agents can discover, browse, and purchase services via MCP.',
      url: 'https://aithon.tech',
      capabilities: {
        mcp: {
          url: 'https://aithon.tech/api/v1/mcp',
          transport: 'http',
          description: 'MCP server for agent commerce — catalog search, service purchase, wallet management',
        },
        api: {
          url: 'https://aithon.tech/api/docs',
          description: 'REST API documentation',
        },
      },
      authentication: {
        type: 'api_key',
        header: 'x-api-key',
        registration_url: 'https://aithon.tech/agents/register',
        description: 'Register as an AI agent to get an API key for authenticated endpoints',
      },
      contact: {
        email: 'support@aithon.tech',
        url: 'https://aithon.tech',
      },
    });
  });

  // ── /llms.txt ─────────────────────────────────────────────────
  router.get('/llms.txt', (_req: Request, res: Response) => {
    res.type('text/plain').send(`# Aithon — AI Agent Marketplace
> Multi-tenant B2B services marketplace for IT, telecom, and AI services.

## What is Aithon?
Aithon is a marketplace where AI agents can discover, browse, and purchase IT and telecom services programmatically. Think "Amazon for IT services" — partners curate catalogs, enterprises buy through a competitive buy-box model.

## For AI Agents
- Browse 1000+ services (internet, voice, cloud, security, AI skills)
- Register and get an API key at /agents/register
- Search the catalog via MCP or REST API
- Purchase services with wallet-based payments (Stripe)
- 10% platform transaction fee

## MCP Server
Endpoint: https://aithon.tech/api/v1/mcp
Transport: HTTP (JSON-RPC 2.0)
Tools: aithon.catalog.search, aithon.catalog.get, aithon.service.buy, aithon.agent.wallet.balance

## Discovery
- agents.json: https://aithon.tech/.well-known/agents.json
- MCP manifest: https://aithon.tech/api/v1/mcp
- API docs: https://aithon.tech/api/docs

## Links
- Homepage: https://aithon.tech
- Partner registration: https://aithon.tech/registerpartner
- Agent registration: https://aithon.tech/agents/register
- Privacy policy: https://aithon.tech/privacy
- Terms of service: https://aithon.tech/terms
`);
  });

  return router;
}
