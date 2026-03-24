/**
 * HTTP client wrapping Vantage REST API
 */

export class VantageClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error?.message || `Request failed: ${res.status}`);
    }

    return json.data;
  }

  // Signals
  async captureSignal(data) { return this.request('POST', '/api/signals', data); }
  async listSignals(query = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null));
    return this.request('GET', `/api/signals?${params}`);
  }
  async getSignal(id) { return this.request('GET', `/api/signals/${id}`); }
  async searchSignals(q, limit = 20) { return this.request('GET', `/api/signals/search?q=${encodeURIComponent(q)}&limit=${limit}`); }
  async getSignalFeed(limit = 20, since = null) {
    const params = new URLSearchParams({ limit });
    if (since) params.set('since', since);
    return this.request('GET', `/api/signals/feed?${params}`);
  }

  // Sources
  async createSource(data) { return this.request('POST', '/api/sources', data); }
  async updateSource(id, data) { return this.request('PUT', `/api/sources/${id}`, data); }
  async listSources(limit = 50) { return this.request('GET', `/api/sources?limit=${limit}`); }
  async getSource(id) { return this.request('GET', `/api/sources/${id}`); }

  // Topics
  async createTopic(data) { return this.request('POST', '/api/topics', data); }
  async updateTopic(id, data) { return this.request('PUT', `/api/topics/${id}`, data); }
  async listTopics() { return this.request('GET', '/api/topics'); }

  // Collections
  async createCollection(data) { return this.request('POST', '/api/collections', data); }
  async getCollection(id) { return this.request('GET', `/api/collections/${id}`); }
  async listCollections() { return this.request('GET', '/api/collections'); }
  async addSignalToCollection(collectionId, signalId, notes) {
    return this.request('POST', `/api/collections/${collectionId}/signals`, { signalId, notes });
  }
  async removeSignalFromCollection(collectionId, signalId) {
    return this.request('DELETE', `/api/collections/${collectionId}/signals/${signalId}`);
  }

  // Business Contexts
  async createContext(data) { return this.request('POST', '/api/contexts', data); }
  async updateContext(id, data) { return this.request('PUT', `/api/contexts/${id}`, data); }
  async listContexts() { return this.request('GET', '/api/contexts'); }
  async getContext(id) { return this.request('GET', `/api/contexts/${id}`); }

  // Analyses
  async saveAnalysis(data) { return this.request('POST', '/api/analyses', data); }
  async listAnalyses() { return this.request('GET', '/api/analyses'); }
  async getAnalysis(id) { return this.request('GET', `/api/analyses/${id}`); }

  // Dashboard
  async getDashboard(period = '7d') { return this.request('GET', `/api/dashboard/summary?period=${period}`); }
  async getTimeline(days = 30) { return this.request('GET', `/api/dashboard/timeline?days=${days}`); }
}
