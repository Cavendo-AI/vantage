#!/usr/bin/env node

/**
 * Vantage MCP Server — Stdio Transport
 *
 * For local use with Claude Desktop or Claude Code.
 * Launches as a subprocess, communicates via stdin/stdout.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VantageClient } from './api/vantageClient.js';
import { registerTools } from './tools.js';

const VANTAGE_API_URL = process.env.VANTAGE_API_URL || 'http://localhost:3020';
const VANTAGE_API_KEY = process.env.VANTAGE_API_KEY;

if (!VANTAGE_API_KEY) {
  console.error('VANTAGE_API_KEY environment variable is required');
  process.exit(1);
}

const client = new VantageClient(VANTAGE_API_URL, VANTAGE_API_KEY);

const server = new McpServer({
  name: 'vantage',
  version: '0.1.0'
});

registerTools(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vantage MCP server running (stdio)');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
