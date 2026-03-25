import http from 'http';
import { createApp } from './server/app.js';

function req(method, path, body = null, apiKey = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3098, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (apiKey) opts.headers['Authorization'] = 'Bearer ' + apiKey;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const { start, stop } = createApp();
await start({ port: 3098 });

try {
  // 1. Health check
  const health = await req('GET', '/health');
  console.log('1. Health:', health.status === 'ok' ? 'PASS' : 'FAIL');

  // 2. Generate API key
  const keyRes = await req('POST', '/api/auth/keys', { name: 'test-key' });
  const API_KEY = keyRes.data.key;
  console.log('2. API Key:', API_KEY ? 'PASS (' + keyRes.data.prefix + '...)' : 'FAIL');

  // 3. Create source
  const srcRes = await req('POST', '/api/sources', {
    name: 'Marc Andreessen',
    bio: 'Co-founder of Andreessen Horowitz',
    organization: 'a16z',
    credibility: 'authority',
    platformHandles: { x: '@pmarca', linkedin: 'marcandreessen' }
  }, API_KEY);
  console.log('3. Create source:', srcRes.success ? 'PASS (id=' + srcRes.data.id + ')' : 'FAIL: ' + JSON.stringify(srcRes.error));

  // 4. Create signal with topics
  const sigRes = await req('POST', '/api/signals', {
    sourceId: srcRes.data.id,
    signalType: 'post',
    platform: 'x',
    content: 'Every SaaS company will need an agent layer within 18 months.',
    sourceUrl: 'https://x.com/pmarca/status/123456',
    publishedAt: '2026-03-24T10:00:00Z',
    importance: 'high',
    sentiment: 'positive',
    topics: ['AI Agents', 'SaaS', 'Enterprise']
  }, API_KEY);
  console.log('4. Create signal:', sigRes.success ? 'PASS (id=' + sigRes.data.id + ')' : 'FAIL: ' + JSON.stringify(sigRes.error));

  // 5. Get signal with relations
  const getRes = await req('GET', '/api/signals/' + sigRes.data.id, null, API_KEY);
  console.log('5. Get signal:', getRes.success && getRes.data.topics?.length === 3 ? 'PASS (3 topics)' : 'FAIL');

  // 6. List topics
  const topicsRes = await req('GET', '/api/topics', null, API_KEY);
  console.log('6. List topics:', topicsRes.success && topicsRes.data?.length === 3 ? 'PASS' : 'FAIL');

  // 7. Search
  const searchRes = await req('GET', '/api/signals/search?q=agent+layer', null, API_KEY);
  console.log('7. Search:', searchRes.success && searchRes.data?.length === 1 ? 'PASS' : 'FAIL');

  // 8. Feed
  const feedRes = await req('GET', '/api/signals/feed?limit=10', null, API_KEY);
  console.log('8. Feed:', feedRes.success && feedRes.data?.length === 1 ? 'PASS' : 'FAIL');

  // 9. Create collection
  const collRes = await req('POST', '/api/collections', {
    name: 'AI Agent Market Signals',
    description: 'Tracking what leaders say about AI agents',
    purpose: 'market_validation'
  }, API_KEY);
  console.log('9. Collection:', collRes.success ? 'PASS (id=' + collRes.data.id + ')' : 'FAIL');

  // 10. Add signal to collection
  const addRes = await req('POST', '/api/collections/' + collRes.data.id + '/signals', {
    signalId: sigRes.data.id,
    notes: 'Key signal from major VC'
  }, API_KEY);
  console.log('10. Add to collection:', addRes.success ? 'PASS' : 'FAIL');

  // 11. Business context
  const ctxRes = await req('POST', '/api/contexts', {
    title: 'Cavendo AI Go-to-Market',
    contextType: 'strategy',
    content: '# GTM Strategy\n\nCavendo AI is a business workflow platform...'
  }, API_KEY);
  console.log('11. Context:', ctxRes.success ? 'PASS (id=' + ctxRes.data.id + ')' : 'FAIL');

  // 12. Analysis
  const anaRes = await req('POST', '/api/analyses', {
    title: 'Q1 2026 Market Validation',
    analysisType: 'validation',
    content: '# Analysis\n\nBased on signals analyzed...',
    signalIds: [sigRes.data.id],
    businessContextId: ctxRes.data.id
  }, API_KEY);
  console.log('12. Analysis:', anaRes.success ? 'PASS (id=' + anaRes.data.id + ')' : 'FAIL');

  // 13. Dashboard
  const dashRes = await req('GET', '/api/dashboard/summary?period=30d', null, API_KEY);
  console.log('13. Dashboard:', dashRes.success && dashRes.data.totalSignals === 1 ? 'PASS' : 'FAIL');

  // 14. Sources list
  const srcList = await req('GET', '/api/sources', null, API_KEY);
  console.log('14. Sources list:', srcList.success && srcList.data.sources[0].signalCount === 1 ? 'PASS' : 'FAIL');

  // 15. Auth required
  const noAuth = await req('GET', '/api/signals');
  console.log('15. No auth = 401:', noAuth.error?.code === 'UNAUTHORIZED' ? 'PASS' : 'FAIL');

  console.log('\n=== All tests complete ===');
} catch (err) {
  console.error('TEST FAILED:', err);
} finally {
  await stop();
  process.exit(0);
}
