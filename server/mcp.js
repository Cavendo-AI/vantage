/**
 * MCP Streamable HTTP Transport — mounted on the main Vantage Express server.
 *
 * Endpoint: POST/GET/DELETE /mcp
 *
 * This allows remote MCP clients (Claude web, Claude mobile, any MCP client)
 * to connect to Vantage over HTTP instead of requiring a local stdio subprocess.
 *
 * Uses stateless mode (no sessions) since all Vantage tools are
 * simple request/response with no streaming or long-running operations.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { VantageClient } from '../mcp-server/src/api/vantageClient.js';
import { registerTools } from '../mcp-server/src/tools.js';

/**
 * Mount MCP endpoint on an Express app.
 * The MCP endpoint validates the API key from the Authorization header
 * and forwards it to the Vantage REST API.
 *
 * @param {import('express').Express} app - Express app
 * @param {object} options
 * @param {string} options.apiBaseUrl - Base URL of the Vantage REST API (default: self, same server)
 */
export function mountMcp(app, { apiBaseUrl } = {}) {
  const baseUrl = apiBaseUrl || `http://localhost:${process.env.PORT || 3020}`;

  function createServerForRequest(apiKey) {
    const client = new VantageClient(baseUrl, apiKey);
    const server = new McpServer({ name: 'vantage', version: '0.1.0' });
    registerTools(server, client);
    return server;
  }

  // POST /mcp — main MCP endpoint (stateless: new server per request)
  app.post('/mcp', async (req, res) => {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || !authHeader.slice(7).startsWith('vtg_')) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Authorization required: Bearer vtg_...' },
        id: null
      });
    }

    const apiKey = authHeader.slice(7);

    try {
      const server = createServerForRequest(apiKey);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined // stateless
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  // GET /mcp — not supported in stateless mode
  app.get('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST /mcp.' },
      id: null
    });
  });

  // DELETE /mcp — not supported in stateless mode
  app.delete('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Stateless server — no sessions to terminate.' },
      id: null
    });
  });

  console.log('MCP Streamable HTTP endpoint mounted at /mcp');
}
