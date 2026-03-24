import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number)
});

export const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
}).partial();

// ============================================
// Source Schemas
// ============================================

export const createSourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  bio: z.string().max(2000).optional().nullable(),
  organization: z.string().max(255).optional().nullable(),
  credibility: z.enum(['authority', 'practitioner', 'commentator', 'unknown']).optional().default('unknown'),
  platformHandles: z.record(z.string()).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

export const updateSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(2000).optional().nullable(),
  organization: z.string().max(255).optional().nullable(),
  credibility: z.enum(['authority', 'practitioner', 'commentator', 'unknown']).optional(),
  platformHandles: z.record(z.string()).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

// ============================================
// Signal Schemas
// ============================================

export const createSignalSchema = z.object({
  sourceId: z.number().int().positive().optional().nullable(),
  signalType: z.enum(['post', 'article', 'screenshot', 'quote', 'thread', 'comment', 'report', 'other']),
  platform: z.string().max(50).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  content: z.string().min(1, 'Content is required').max(100000),
  sourceUrl: z.string().max(2000).optional().nullable(),
  publishedAt: z.string().optional().nullable(),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional().nullable(),
  importance: z.enum(['critical', 'high', 'normal', 'low']).optional().default('normal'),
  rawData: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  topics: z.array(z.string()).optional()
});

export const updateSignalSchema = z.object({
  sourceId: z.number().int().positive().optional().nullable(),
  signalType: z.enum(['post', 'article', 'screenshot', 'quote', 'thread', 'comment', 'report', 'other']).optional(),
  platform: z.string().max(50).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  content: z.string().min(1).max(100000).optional(),
  sourceUrl: z.string().max(2000).optional().nullable(),
  publishedAt: z.string().optional().nullable(),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional().nullable(),
  importance: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  rawData: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  topics: z.array(z.string()).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const signalQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
  sourceId: z.string().regex(/^\d+$/).transform(Number).optional(),
  signalType: z.enum(['post', 'article', 'screenshot', 'quote', 'thread', 'comment', 'report', 'other']).optional(),
  platform: z.string().optional(),
  topic: z.string().optional(),
  importance: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  q: z.string().max(200).optional()
}).partial();

// ============================================
// Topic Schemas
// ============================================

export const createTopicSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(7).optional().nullable(),
  parentId: z.number().int().positive().optional().nullable()
});

export const updateTopicSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(7).optional().nullable(),
  parentId: z.number().int().positive().optional().nullable()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

// ============================================
// Collection Schemas
// ============================================

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  purpose: z.string().max(100).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  purpose: z.string().max(100).optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
  metadata: z.record(z.any()).optional().nullable()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const addCollectionSignalSchema = z.object({
  signalId: z.number().int().positive('Signal ID is required'),
  notes: z.string().max(1000).optional().nullable()
});

// ============================================
// Business Context Schemas
// ============================================

export const createContextSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  contextType: z.enum(['strategy', 'roadmap', 'positioning', 'persona', 'competitor_profile', 'thesis', 'other']),
  content: z.string().min(1, 'Content is required').max(500000),
  status: z.enum(['active', 'archived', 'draft']).optional().default('active'),
  metadata: z.record(z.any()).optional().nullable()
});

export const updateContextSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  contextType: z.enum(['strategy', 'roadmap', 'positioning', 'persona', 'competitor_profile', 'thesis', 'other']).optional(),
  content: z.string().min(1).max(500000).optional(),
  status: z.enum(['active', 'archived', 'draft']).optional(),
  metadata: z.record(z.any()).optional().nullable()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

// ============================================
// Analysis Schemas
// ============================================

export const createAnalysisSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  analysisType: z.enum(['validation', 'stress_test', 'trend', 'competitive', 'opportunity', 'risk', 'summary', 'custom']),
  content: z.string().min(1, 'Content is required').max(500000),
  methodology: z.string().max(5000).optional().nullable(),
  businessContextId: z.number().int().positive().optional().nullable(),
  collectionId: z.number().int().positive().optional().nullable(),
  signalIds: z.array(z.number().int().positive()).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  provider: z.string().max(50).optional().nullable(),
  inputTokens: z.number().int().nonnegative().optional().nullable(),
  outputTokens: z.number().int().nonnegative().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

// ============================================
// Auth Schemas
// ============================================

export const generateKeySchema = z.object({
  name: z.string().max(100).optional().nullable(),
  scopes: z.array(z.enum(['read', 'write'])).optional().default(['read', 'write'])
});

// ============================================
// Validation Middleware
// ============================================

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.reduce((acc, err) => {
        acc[err.path.join('.')] = err.message;
        return acc;
      }, {});
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: result.error.errors[0].message, errors }
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.reduce((acc, err) => {
        acc[err.path.join('.')] = err.message;
        return acc;
      }, {});
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: result.error.errors[0].message, errors }
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMETER', message: result.error.errors[0].message }
      });
    }
    req.params = result.data;
    next();
  };
}
