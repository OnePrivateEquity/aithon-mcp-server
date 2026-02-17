/**
 * Aithon MCP Server — Entry point
 *
 * Re-exports the MCP router factory and discovery router for integration
 * into any Express-based application.
 */

export { createMcpRouter } from './mcp-server';
export { createDiscoveryRouter } from './discovery';
