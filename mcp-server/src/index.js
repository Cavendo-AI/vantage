#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { VantageClient } from './api/vantageClient.js';

const VANTAGE_API_URL = process.env.VANTAGE_API_URL || 'http://localhost:3002';
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

// ============================================
// Tools
// ============================================

// capture_signal — Primary ingestion tool
server.tool(
  'capture_signal',
  'Capture a market signal — a post, article, quote, screenshot, or discussion from someone about a topic. Auto-creates the source if source_name is provided but not yet tracked.',
  {
    content: z.string().describe('The text content of the signal'),
    signal_type: z.enum(['post', 'article', 'screenshot', 'quote', 'thread', 'comment', 'report', 'other']).default('post').describe('Type of signal'),
    platform: z.string().optional().describe('Platform: x, linkedin, web, reddit, hackernews, etc.'),
    title: z.string().optional().describe('Optional headline or summary'),
    source_url: z.string().optional().describe('Link to the original'),
    source_name: z.string().optional().describe('Name of the person/account who posted this'),
    source_bio: z.string().optional().describe('Bio/role of the source (used when auto-creating)'),
    source_org: z.string().optional().describe('Organization of the source'),
    published_at: z.string().optional().describe('When the original was published (ISO datetime)'),
    topics: z.array(z.string()).optional().describe('Topic tags for this signal'),
    importance: z.enum(['critical', 'high', 'normal', 'low']).default('normal').describe('Importance level'),
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional().describe('Sentiment of the signal')
  },
  async ({ content, signal_type, platform, title, source_url, source_name, source_bio, source_org, published_at, topics, importance, sentiment }) => {
    try {
      let sourceId = null;

      // Auto-create or find source if name provided
      if (source_name) {
        const sources = await client.listSources(200);
        const existing = sources.sources?.find(s =>
          s.name.toLowerCase() === source_name.toLowerCase()
        );
        if (existing) {
          sourceId = existing.id;
        } else {
          const newSource = await client.createSource({
            name: source_name,
            bio: source_bio || null,
            organization: source_org || null
          });
          sourceId = newSource.id;
        }
      }

      const signal = await client.captureSignal({
        sourceId,
        signalType: signal_type,
        platform,
        title,
        content,
        sourceUrl: source_url,
        publishedAt: published_at,
        topics,
        importance,
        sentiment
      });

      return {
        content: [{ type: 'text', text: formatSignal(signal) }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// search_signals
server.tool(
  'search_signals',
  'Search across all captured signals by keyword, with optional filters.',
  {
    query: z.string().describe('Search query'),
    platform: z.string().optional().describe('Filter by platform'),
    topic: z.string().optional().describe('Filter by topic name or slug'),
    source_name: z.string().optional().describe('Filter by source name'),
    importance: z.enum(['critical', 'high', 'normal', 'low']).optional(),
    since: z.string().optional().describe('Only signals captured after this date (ISO)'),
    until: z.string().optional().describe('Only signals captured before this date (ISO)'),
    limit: z.number().default(20).describe('Max results')
  },
  async ({ query, platform, topic, importance, since, until, limit }) => {
    try {
      const data = await client.listSignals({
        q: query, platform, topic, importance, since, until, limit
      });
      const signals = data.signals || data;
      if (!signals.length) return { content: [{ type: 'text', text: 'No signals found.' }] };
      return {
        content: [{ type: 'text', text: `Found ${signals.length} signals:\n\n${signals.map(formatSignalBrief).join('\n\n---\n\n')}` }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// list_recent_signals
server.tool(
  'list_recent_signals',
  'Get the latest signals feed — what\'s new.',
  {
    limit: z.number().default(20).describe('Max results'),
    platform: z.string().optional(),
    topic: z.string().optional(),
    since: z.string().optional().describe('Only signals after this datetime')
  },
  async ({ limit, platform, topic, since }) => {
    try {
      let data;
      if (platform || topic) {
        data = await client.listSignals({ platform, topic, limit });
        data = data.signals || data;
      } else {
        data = await client.getSignalFeed(limit, since);
      }
      if (!data.length) return { content: [{ type: 'text', text: 'No recent signals.' }] };
      return {
        content: [{ type: 'text', text: `${data.length} recent signals:\n\n${data.map(formatSignalBrief).join('\n\n---\n\n')}` }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// get_signal
server.tool(
  'get_signal',
  'Get full details on a specific signal including source info, topics, and images.',
  {
    signal_id: z.number().describe('Signal ID')
  },
  async ({ signal_id }) => {
    try {
      const signal = await client.getSignal(signal_id);
      return { content: [{ type: 'text', text: formatSignal(signal) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// manage_source
server.tool(
  'manage_source',
  'Create or update a source (person/account) profile.',
  {
    name: z.string().describe('Name of the person/account'),
    bio: z.string().optional().describe('Bio, title, or role'),
    organization: z.string().optional().describe('Company or outlet'),
    credibility: z.enum(['authority', 'practitioner', 'commentator', 'unknown']).optional(),
    platform_handles: z.record(z.string()).optional().describe('Platform handles, e.g. {"x": "@handle", "linkedin": "url"}'),
    notes: z.string().optional().describe('Freeform notes')
  },
  async ({ name, bio, organization, credibility, platform_handles, notes }) => {
    try {
      // Check if source exists
      const sources = await client.listSources(200);
      const existing = sources.sources?.find(s => s.name.toLowerCase() === name.toLowerCase());

      let source;
      if (existing) {
        source = await client.updateSource(existing.id, {
          name, bio, organization, credibility, platformHandles: platform_handles, notes
        });
      } else {
        source = await client.createSource({
          name, bio, organization, credibility, platformHandles: platform_handles, notes
        });
      }

      return {
        content: [{ type: 'text', text: `Source ${existing ? 'updated' : 'created'}:\n\nName: ${source.name}\nBio: ${source.bio || 'N/A'}\nOrg: ${source.organization || 'N/A'}\nCredibility: ${source.credibility}\nID: ${source.id}` }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// list_sources
server.tool(
  'list_sources',
  'List tracked people/accounts with their signal counts.',
  {
    limit: z.number().default(50)
  },
  async ({ limit }) => {
    try {
      const data = await client.listSources(limit);
      const sources = data.sources || data;
      if (!sources.length) return { content: [{ type: 'text', text: 'No sources tracked yet.' }] };
      const lines = sources.map(s =>
        `- **${s.name}** (${s.organization || 'N/A'}) — ${s.credibility} — ${s.signalCount || 0} signals`
      );
      return { content: [{ type: 'text', text: `${sources.length} tracked sources:\n\n${lines.join('\n')}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// manage_topic
server.tool(
  'manage_topic',
  'Create or update a topic/theme for categorizing signals.',
  {
    name: z.string().describe('Topic name'),
    description: z.string().optional(),
    color: z.string().optional().describe('Hex color, e.g. #FF5733')
  },
  async ({ name, description, color }) => {
    try {
      const topics = await client.listTopics();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = (topics || []).find(t => t.slug === slug);

      let topic;
      if (existing) {
        topic = await client.updateTopic(existing.id, { name, description, color });
      } else {
        topic = await client.createTopic({ name, description, color });
      }

      return {
        content: [{ type: 'text', text: `Topic ${existing ? 'updated' : 'created'}: ${topic.name} (${topic.slug})` }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// list_topics
server.tool(
  'list_topics',
  'List all topics/themes with their signal counts.',
  {},
  async () => {
    try {
      const topics = await client.listTopics();
      if (!topics.length) return { content: [{ type: 'text', text: 'No topics yet.' }] };
      const lines = topics.map(t =>
        `- **${t.name}** (${t.signalCount || 0} signals)${t.description ? ` — ${t.description}` : ''}`
      );
      return { content: [{ type: 'text', text: `${topics.length} topics:\n\n${lines.join('\n')}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// manage_collection
server.tool(
  'manage_collection',
  'Create a collection, or add/remove signals from one.',
  {
    action: z.enum(['create', 'add_signal', 'remove_signal']).describe('What to do'),
    name: z.string().optional().describe('Collection name (for create)'),
    description: z.string().optional().describe('Collection description (for create)'),
    purpose: z.string().optional().describe('Collection purpose (for create)'),
    collection_id: z.number().optional().describe('Collection ID (for add/remove)'),
    signal_id: z.number().optional().describe('Signal ID (for add/remove)'),
    notes: z.string().optional().describe('Why this signal was added')
  },
  async ({ action, name, description, purpose, collection_id, signal_id, notes }) => {
    try {
      if (action === 'create') {
        if (!name) return { content: [{ type: 'text', text: 'Error: name is required for create' }], isError: true };
        const coll = await client.createCollection({ name, description, purpose });
        return { content: [{ type: 'text', text: `Collection created: "${coll.name}" (ID: ${coll.id})` }] };
      }
      if (action === 'add_signal') {
        if (!collection_id || !signal_id) return { content: [{ type: 'text', text: 'Error: collection_id and signal_id required' }], isError: true };
        await client.addSignalToCollection(collection_id, signal_id, notes);
        return { content: [{ type: 'text', text: `Signal ${signal_id} added to collection ${collection_id}` }] };
      }
      if (action === 'remove_signal') {
        if (!collection_id || !signal_id) return { content: [{ type: 'text', text: 'Error: collection_id and signal_id required' }], isError: true };
        await client.removeSignalFromCollection(collection_id, signal_id);
        return { content: [{ type: 'text', text: `Signal ${signal_id} removed from collection ${collection_id}` }] };
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// set_business_context
server.tool(
  'set_business_context',
  'Upload or update a business strategy document for comparison against market signals.',
  {
    title: z.string().describe('Document title'),
    context_type: z.enum(['strategy', 'roadmap', 'positioning', 'persona', 'competitor_profile', 'thesis', 'other']),
    content: z.string().describe('The document content (markdown)')
  },
  async ({ title, context_type, content }) => {
    try {
      const ctx = await client.createContext({
        title,
        contextType: context_type,
        content
      });
      return { content: [{ type: 'text', text: `Business context saved: "${ctx.title}" (ID: ${ctx.id}, type: ${ctx.contextType})` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// analyze_signals
server.tool(
  'analyze_signals',
  'Gather signals and business context into a structured payload for analysis. Does NOT call an LLM — assembles the data for YOU (the LLM) to reason over.',
  {
    analysis_type: z.enum(['validation', 'stress_test', 'trend', 'competitive', 'opportunity', 'risk', 'summary', 'custom']),
    collection_id: z.number().optional().describe('Analyze signals from this collection'),
    topic: z.string().optional().describe('Analyze signals with this topic'),
    signal_ids: z.array(z.number()).optional().describe('Specific signal IDs to analyze'),
    business_context_id: z.number().optional().describe('Business context to compare against'),
    question: z.string().optional().describe('Specific question to answer')
  },
  async ({ analysis_type, collection_id, topic, signal_ids, business_context_id, question }) => {
    try {
      let signals = [];
      let contextDoc = null;

      // Gather signals
      if (collection_id) {
        const coll = await client.getCollection(collection_id);
        signals = coll.signals || [];
      } else if (signal_ids && signal_ids.length > 0) {
        for (const id of signal_ids) {
          const s = await client.getSignal(id);
          signals.push(s);
        }
      } else if (topic) {
        const data = await client.listSignals({ topic, limit: 100 });
        signals = data.signals || data;
      } else {
        const data = await client.getSignalFeed(50);
        signals = data;
      }

      // Gather business context
      if (business_context_id) {
        contextDoc = await client.getContext(business_context_id);
      }

      // Assemble structured payload
      let output = `# Analysis Request: ${analysis_type}\n\n`;
      if (question) output += `**Question:** ${question}\n\n`;

      if (contextDoc) {
        output += `## Business Context: ${contextDoc.title}\n`;
        output += `Type: ${contextDoc.contextType}\n\n`;
        output += `${contextDoc.content}\n\n`;
      }

      output += `## Market Signals (${signals.length} total)\n\n`;
      for (const s of signals) {
        output += `### Signal #${s.id}`;
        if (s.sourceName) output += ` — ${s.sourceName}`;
        if (s.sourceOrganization) output += ` (${s.sourceOrganization})`;
        output += `\n`;
        output += `- Type: ${s.signalType} | Platform: ${s.platform || 'N/A'} | Importance: ${s.importance}\n`;
        if (s.publishedAt) output += `- Published: ${s.publishedAt}\n`;
        if (s.capturedAt) output += `- Captured: ${s.capturedAt}\n`;
        if (s.sourceUrl) output += `- URL: ${s.sourceUrl}\n`;
        if (s.topics && s.topics.length) output += `- Topics: ${s.topics.map(t => t.name || t).join(', ')}\n`;
        if (s.sentiment) output += `- Sentiment: ${s.sentiment}\n`;
        output += `\n${s.content}\n\n`;
      }

      output += `---\n\nPlease analyze the above ${signals.length} signals`;
      if (contextDoc) output += ` against the business context "${contextDoc.title}"`;
      output += ` with focus on: **${analysis_type}**`;
      if (question) output += `\n\nSpecific question: ${question}`;

      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// get_dashboard
server.tool(
  'get_dashboard',
  'Get a summary of market signal intelligence — counts, top topics, top sources, highlights.',
  {
    period: z.enum(['7d', '30d', '90d']).default('7d')
  },
  async ({ period }) => {
    try {
      const data = await client.getDashboard(period);
      let output = `# Vantage Dashboard (${period})\n\n`;
      output += `- **Total signals:** ${data.totalSignals}\n`;
      output += `- **Recent signals:** ${data.recentSignals}\n`;
      output += `- **Tracked sources:** ${data.totalSources}\n`;
      output += `- **Topics:** ${data.totalTopics}\n\n`;

      if (data.byPlatform?.length) {
        output += `## By Platform\n`;
        data.byPlatform.forEach(p => { output += `- ${p.platform}: ${p.count}\n`; });
        output += '\n';
      }

      if (data.topTopics?.length) {
        output += `## Top Topics\n`;
        data.topTopics.forEach(t => { output += `- ${t.name}: ${t.count} signals\n`; });
        output += '\n';
      }

      if (data.topSources?.length) {
        output += `## Top Sources\n`;
        data.topSources.forEach(s => { output += `- ${s.name} (${s.organization || 'N/A'}): ${s.count} signals\n`; });
        output += '\n';
      }

      if (data.recentHighlights?.length) {
        output += `## Recent Highlights (Critical/High)\n`;
        data.recentHighlights.forEach(h => {
          output += `- [${h.importance}] ${h.title || h.content?.slice(0, 80)}... — ${h.sourceName || 'Unknown'}\n`;
        });
      }

      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// save_analysis
server.tool(
  'save_analysis',
  'Save an analysis for future reference.',
  {
    title: z.string().describe('Analysis title'),
    analysis_type: z.enum(['validation', 'stress_test', 'trend', 'competitive', 'opportunity', 'risk', 'summary', 'custom']),
    content: z.string().describe('The analysis content (markdown)'),
    signal_ids: z.array(z.number()).optional().describe('Signal IDs used in this analysis'),
    business_context_id: z.number().optional(),
    collection_id: z.number().optional()
  },
  async ({ title, analysis_type, content, signal_ids, business_context_id, collection_id }) => {
    try {
      const analysis = await client.saveAnalysis({
        title,
        analysisType: analysis_type,
        content,
        signalIds: signal_ids,
        businessContextId: business_context_id,
        collectionId: collection_id
      });
      return { content: [{ type: 'text', text: `Analysis saved: "${analysis.title}" (ID: ${analysis.id})` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ============================================
// Formatters
// ============================================

function formatSignal(s) {
  let out = `# Signal #${s.id}\n\n`;
  out += `**Type:** ${s.signalType} | **Platform:** ${s.platform || 'N/A'} | **Importance:** ${s.importance}\n`;
  if (s.title) out += `**Title:** ${s.title}\n`;
  if (s.sourceName) out += `**Source:** ${s.sourceName}`;
  if (s.sourceOrganization) out += ` (${s.sourceOrganization})`;
  if (s.sourceCredibility) out += ` [${s.sourceCredibility}]`;
  if (s.sourceName) out += '\n';
  if (s.sourceBio) out += `**Bio:** ${s.sourceBio}\n`;
  if (s.publishedAt) out += `**Published:** ${s.publishedAt}\n`;
  out += `**Captured:** ${s.capturedAt}\n`;
  if (s.sourceUrl) out += `**URL:** ${s.sourceUrl}\n`;
  if (s.sentiment) out += `**Sentiment:** ${s.sentiment}\n`;
  if (s.topics?.length) out += `**Topics:** ${s.topics.map(t => t.name || t).join(', ')}\n`;
  out += `\n---\n\n${s.content}\n`;
  if (s.images?.length) {
    out += `\n**Images:** ${s.images.length} attached\n`;
  }
  return out;
}

function formatSignalBrief(s) {
  let out = `**#${s.id}** [${s.signalType}/${s.platform || 'N/A'}] `;
  if (s.sourceName) out += `by ${s.sourceName} `;
  out += `(${s.importance})`;
  if (s.capturedAt) out += ` — ${s.capturedAt}`;
  out += '\n';
  if (s.title) out += `${s.title}\n`;
  out += s.content?.length > 200 ? s.content.slice(0, 200) + '...' : s.content;
  if (s.topics?.length) out += `\nTopics: ${s.topics.map(t => t.name || t).join(', ')}`;
  return out;
}

// ============================================
// Start
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Vantage MCP server running');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
