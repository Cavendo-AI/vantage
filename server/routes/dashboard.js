import { Router } from 'express';
import db from '../db/adapter.js';
import * as response from '../utils/response.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', apiKeyAuth('read'), async (req, res) => {
  try {
    const period = req.query.period || '7d';
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [totalSignals, recentSignals, totalSources, totalTopics] = await Promise.all([
      db.one('SELECT COUNT(*) as count FROM signals'),
      db.one('SELECT COUNT(*) as count FROM signals WHERE captured_at >= ?', [since]),
      db.one('SELECT COUNT(*) as count FROM sources'),
      db.one('SELECT COUNT(*) as count FROM topics')
    ]);

    const byPlatform = await db.many(
      `SELECT platform, COUNT(*) as count FROM signals
       WHERE captured_at >= ? AND platform IS NOT NULL
       GROUP BY platform ORDER BY count DESC`,
      [since]
    );

    const topTopics = await db.many(
      `SELECT t.name, t.slug, COUNT(*) as count
       FROM signal_topics st
       JOIN topics t ON st.topic_id = t.id
       JOIN signals s ON st.signal_id = s.id
       WHERE s.captured_at >= ?
       GROUP BY t.id ORDER BY count DESC LIMIT 10`,
      [since]
    );

    const topSources = await db.many(
      `SELECT src.name, src.organization, COUNT(*) as count
       FROM signals s
       JOIN sources src ON s.source_id = src.id
       WHERE s.captured_at >= ?
       GROUP BY src.id ORDER BY count DESC LIMIT 10`,
      [since]
    );

    const recentHighlights = await db.many(
      `SELECT s.id, s.title, s.content, s.platform, s.importance, s.captured_at,
              src.name as source_name
       FROM signals s
       LEFT JOIN sources src ON s.source_id = src.id
       WHERE s.captured_at >= ? AND s.importance IN ('critical', 'high')
       ORDER BY s.captured_at DESC LIMIT 5`,
      [since]
    );

    response.success(res, {
      period,
      total_signals: totalSignals.count,
      recent_signals: recentSignals.count,
      total_sources: totalSources.count,
      total_topics: totalTopics.count,
      by_platform: byPlatform,
      top_topics: topTopics,
      top_sources: topSources,
      recent_highlights: recentHighlights
    });
  } catch (err) {
    console.error('Error getting dashboard summary:', err);
    response.serverError(res, "Internal server error");
  }
});

// GET /api/dashboard/timeline
router.get('/timeline', apiKeyAuth('read'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const timeline = await db.many(
      `SELECT date(captured_at) as date, COUNT(*) as count
       FROM signals WHERE captured_at >= ?
       GROUP BY date(captured_at) ORDER BY date`,
      [since]
    );

    response.success(res, timeline);
  } catch (err) {
    console.error('Error getting timeline:', err);
    response.serverError(res, "Internal server error");
  }
});

export default router;
