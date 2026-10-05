// Small fetch wrapper: every call returns JSON or throws an Error with a readable message.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new Error('Cannot reach the LogLens server. Is it running on port 3001?');
  }
  if (res.status === 204) return null;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error((isJson && body.error) || `Request failed (${res.status})`);
  return body;
}

export const api = {
  health: () => request('/health'),
  meta: () => request('/meta'),
  stats: () => request('/stats'),
  samples: () => request('/samples'),
  sample: (name) => request(`/samples/${encodeURIComponent(name)}`),
  listRuns: ({ q = '', category = '' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    return request(`/logs?${params}`);
  },
  getRun: (id) => request(`/logs/${id}`),
  bugReport: (id) => request(`/logs/${id}/bug-report`),
  review: (id, body) => request(`/logs/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  deleteRun: (id) => request(`/logs/${id}`, { method: 'DELETE' }),
  upload: (formData) => request('/logs', { method: 'POST', body: formData }),
};
