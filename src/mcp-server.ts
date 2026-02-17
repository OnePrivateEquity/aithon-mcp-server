/**
 * Aithon MCP Server — JSON-RPC 2.0 tool server for AI agent discovery & commerce
 *
 * This is the public MCP endpoint that AI agents use to discover and interact
 * with the Aithon marketplace. It implements the Model Context Protocol (MCP)
 * standard for tool discovery and invocation.
 *
 * Live at: https://aithon.tech/api/v1/mcp
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';

// Database helpers — in production these come from the platform's database module.
// For standalone usage, provide your own pg Pool connection.
import type { PoolClient } from 'pg';

interface DbHelpers {
  withDb: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
  runQuery: (client: PoolClient, sql: string, params: any[], label: string) => Promise<{ rows: any[] }>;
}

/**
 * Creates the MCP router with the provided database helpers.
 *
 * Usage:
 *   import { createMcpRouter } from './mcp-server';
 *   const mcpRouter = createMcpRouter({ withDb, runQuery });
 *   app.use('/api/v1/mcp', mcpRouter);
 */
export function createMcpRouter(db: DbHelpers): Router {
  const router = Router();

  // ─── GET / — MCP Manifest (tool discovery) ──────────────────────
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      manifest_version: '0.3',
      id: 'net.techadds.aithon-marketplace',
      name: 'aithon-marketplace',
      display_name: 'Aithon — AI Agent Marketplace',
      version: '1.0.0',
      description:
        'AI agent commerce marketplace — register, list services, buy and sell capabilities with real payments via Stripe. 10% transaction fee.',
      author: {
        name: 'Aithon Inc',
        url: 'https://aithon.tech',
        email: 'support@aithon.tech',
      },
      homepage: 'https://aithon.tech',
      categories: ['AI Marketplace', 'Agent Tools', 'Commerce', 'MCP Server'],
      repository: 'https://github.com/OnePrivateEquity/aithon-mcp-server',
      privacy_policy: 'https://aithon.tech/privacy',
      discovery: {
        agents_json: 'https://aithon.tech/.well-known/agents.json',
        llms_txt: 'https://aithon.tech/llms.txt',
        mcp_manifest: 'https://aithon.tech/api/v1/mcp',
      },
      tools: [
        {
          name: 'aithon.tools.list',
          description: 'List all available MCP tools with input/output schemas',
        },
        {
          name: 'aithon.catalog.search',
          description: 'Search the catalog of AI and IT services',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: { type: 'string', description: 'Filter by category' },
              limit: { type: 'number', default: 25, description: 'Max results (1-100)' },
            },
          },
        },
        {
          name: 'aithon.catalog.get',
          description: 'Get full details for a specific service by ID',
          inputSchema: {
            type: 'object',
            properties: {
              service_id: { type: 'string', description: 'Service UUID' },
            },
            required: ['service_id'],
          },
        },
        {
          name: 'aithon.service.buy',
          description: 'Purchase a service — returns an access token (requires x-api-key)',
          inputSchema: {
            type: 'object',
            properties: {
              service_id: { type: 'string', description: 'Service UUID to purchase' },
              parameters: { type: 'object', description: 'Optional parameters for the service' },
            },
            required: ['service_id'],
          },
        },
        {
          name: 'aithon.agent.wallet.balance',
          description: 'Check your agent wallet balance (requires x-api-key)',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    });
  });

  // ─── POST /rpc — JSON-RPC 2.0 endpoint ──────────────────────────
  router.post('/rpc', async (req: Request, res: Response) => {
    try {
      const body = req.body;

      if (!body || body.jsonrpc !== '2.0' || !body.method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid JSON-RPC request' },
          id: body?.id ?? null,
        });
      }

      const id = body.id ?? null;
      const params = body.params || {};

      // Authenticate via x-api-key header
      async function authenticate(): Promise<any> {
        const apiKey = (req.headers['x-api-key'] as string) || '';
        if (!apiKey) return null;
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        return db.withDb(async (client) => {
          const result = await db.runQuery(
            client,
            'SELECT * FROM agents WHERE api_key_hash = $1',
            [hash],
            'mcp.auth.lookup',
          );
          return result.rows[0] || null;
        });
      }

      switch (body.method) {
        // ── Tool Discovery ──────────────────────────────────────
        case 'aithon.tools.list': {
          return res.json({
            jsonrpc: '2.0',
            result: [
              {
                name: 'aithon.catalog.search',
                description: 'Search the catalog of AI and IT services',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    category: { type: 'string' },
                    limit: { type: 'number' },
                  },
                },
              },
              {
                name: 'aithon.catalog.get',
                description: 'Get service details by ID',
                inputSchema: {
                  type: 'object',
                  properties: { service_id: { type: 'string' } },
                  required: ['service_id'],
                },
              },
              {
                name: 'aithon.service.buy',
                description: 'Buy a service (requires x-api-key)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    service_id: { type: 'string' },
                    parameters: { type: 'object' },
                  },
                  required: ['service_id'],
                },
              },
              {
                name: 'aithon.agent.wallet.balance',
                description: 'Check wallet balance (requires x-api-key)',
                inputSchema: { type: 'object', properties: {} },
              },
            ],
            id,
          });
        }

        // ── Catalog Search (public) ─────────────────────────────
        case 'aithon.catalog.search': {
          const query = (params.query || '').toString();
          const category = params.category || null;
          const limit = Math.min(Number(params.limit) || 25, 100);

          const result = await db.withDb(async (client) => {
            let sql = `
              SELECT s.id, s.name, s.description, s.price_per_call_cents,
                     s.rating_avg, s.category, a.name as agent_name
              FROM agent_services s
              LEFT JOIN agents a ON s.agent_id = a.id
              WHERE s.status = 'active'`;
            const values: any[] = [];
            let idx = 1;

            if (query) {
              sql += ` AND (LOWER(s.name) LIKE $${idx} OR LOWER(s.description) LIKE $${idx})`;
              values.push(`%${query.toLowerCase()}%`);
              idx++;
            }
            if (category) {
              sql += ` AND LOWER(s.category) = $${idx}`;
              values.push(category.toString().toLowerCase());
              idx++;
            }

            sql += ` ORDER BY s.call_count DESC NULLS LAST LIMIT $${idx}`;
            values.push(limit);

            return db.runQuery(client, sql, values, 'mcp.catalog.search');
          });

          return res.json({ jsonrpc: '2.0', result: result.rows, id });
        }

        // ── Catalog Get (public) ────────────────────────────────
        case 'aithon.catalog.get': {
          const serviceId = params.service_id || params.serviceId;
          if (!serviceId) {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32602, message: 'service_id is required' },
              id,
            });
          }

          const row = await db.withDb(async (client) => {
            const r = await db.runQuery(
              client,
              `SELECT s.*, a.name as agent_name
               FROM agent_services s
               LEFT JOIN agents a ON s.agent_id = a.id
               WHERE s.id = $1`,
              [serviceId],
              'mcp.catalog.get',
            );
            return r.rows[0] || null;
          });

          if (!row) {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32011, message: 'Service not found' },
              id,
            });
          }
          return res.json({ jsonrpc: '2.0', result: row, id });
        }

        // ── Wallet Balance (authenticated) ──────────────────────
        case 'aithon.agent.wallet.balance': {
          const agent = await authenticate();
          if (!agent) {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32003, message: 'Missing or invalid x-api-key' },
              id,
            });
          }
          return res.json({
            jsonrpc: '2.0',
            result: {
              wallet_balance_cents: Number(agent.wallet_balance_cents || 0),
              toll_tag_enabled: Boolean(agent.toll_tag_enabled),
            },
            id,
          });
        }

        // ── Service Purchase (authenticated) ────────────────────
        case 'aithon.service.buy': {
          const agent = await authenticate();
          if (!agent) {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32003, message: 'Missing or invalid x-api-key' },
              id,
            });
          }

          const serviceId = params.service_id || params.serviceId;
          if (!serviceId) {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32602, message: 'service_id is required' },
              id,
            });
          }

          const txResult = await db.withDb(async (client) => {
            // Lock buyer wallet
            const buyerRes = await db.runQuery(
              client,
              'SELECT id, wallet_balance_cents FROM agents WHERE id = $1 FOR UPDATE',
              [agent.id],
              'mcp.buy.lock',
            );
            const buyerBalance = Number(buyerRes.rows[0]?.wallet_balance_cents || 0);

            // Load service
            const svcRes = await db.runQuery(
              client,
              "SELECT * FROM agent_services WHERE id = $1 AND status = 'active'",
              [serviceId],
              'mcp.buy.svc',
            );
            if (!svcRes.rows[0]) throw new Error('SERVICE_NOT_FOUND');
            const svc = svcRes.rows[0];
            const price = Number(svc.price_per_call_cents || 0);
            const sellerId = svc.agent_id;

            if (buyerBalance < price) throw new Error('INSUFFICIENT_BALANCE');

            // Platform fee (10%)
            const platformFee = Math.round(price * 0.1);
            const sellerAmount = price - platformFee;

            // Debit buyer
            const updBuyer = await db.runQuery(
              client,
              'UPDATE agents SET wallet_balance_cents = wallet_balance_cents - $1 WHERE id = $2 RETURNING wallet_balance_cents',
              [price, agent.id],
              'mcp.buy.debit',
            );

            // Credit seller
            const updSeller = await db.runQuery(
              client,
              'UPDATE agents SET wallet_balance_cents = wallet_balance_cents + $1 WHERE id = $2 RETURNING wallet_balance_cents',
              [sellerAmount, sellerId],
              'mcp.buy.credit',
            );

            // Wallet transaction ledger
            await db.runQuery(
              client,
              `INSERT INTO agent_wallet_transactions (agent_id, type, amount_cents, balance_after_cents, description)
               VALUES ($1, 'purchase', $2, $3, $4)`,
              [agent.id, price, Number(updBuyer.rows[0].wallet_balance_cents), `Purchase: ${svc.name}`],
              'mcp.buy.wtx.buyer',
            );
            await db.runQuery(
              client,
              `INSERT INTO agent_wallet_transactions (agent_id, type, amount_cents, balance_after_cents, description)
               VALUES ($1, 'earning', $2, $3, $4)`,
              [sellerId, sellerAmount, Number(updSeller.rows[0].wallet_balance_cents), `Sale: ${svc.name}`],
              'mcp.buy.wtx.seller',
            );

            // Transaction record
            const accessToken = crypto.randomBytes(32).toString('hex');
            const slaMinutes = Number(process.env.FULFILLMENT_SLA_MINUTES || 30);
            const buyerParams = params.parameters || null;

            const txRes = await db.runQuery(
              client,
              `INSERT INTO agent_transactions
               (buyer_agent_id, seller_agent_id, service_id, amount_cents, platform_fee_cents,
                seller_amount_cents, status, access_token, fulfillment_status, sla_deadline_at, parameters)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending', NOW() + make_interval(mins := $9), $10)
               RETURNING id`,
              [
                agent.id, sellerId, serviceId, price, platformFee, sellerAmount,
                'completed', accessToken, slaMinutes,
                buyerParams ? JSON.stringify(buyerParams) : null,
              ],
              'mcp.buy.tx',
            );

            const txId = txRes.rows[0].id;

            // Platform revenue
            await db.runQuery(
              client,
              'INSERT INTO platform_revenue (transaction_id, fee_cents) VALUES ($1, $2)',
              [txId, platformFee],
              'mcp.buy.platformrev',
            );

            // Increment call count
            await db.runQuery(
              client,
              'UPDATE agent_services SET call_count = call_count + 1 WHERE id = $1',
              [serviceId],
              'mcp.buy.callcount',
            );

            return {
              transaction_id: txId,
              access_token: accessToken,
              amount_cents: price,
              platform_fee_cents: platformFee,
              status: 'completed',
              fulfillment_status: 'pending',
            };
          });

          return res.json({ jsonrpc: '2.0', result: txResult, id });
        }

        default:
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32601, message: `Method not found: ${body.method}` },
            id,
          });
      }
    } catch (err: any) {
      console.error('[MCP] Error:', err);
      const code =
        err.message === 'INSUFFICIENT_BALANCE'
          ? -32010
          : err.message === 'SERVICE_NOT_FOUND'
            ? -32011
            : -32000;
      return res.status(200).json({
        jsonrpc: '2.0',
        error: { code, message: err.message || 'Internal error' },
        id: req.body?.id ?? null,
      });
    }
  });

  return router;
}
