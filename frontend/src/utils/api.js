const API = '';

const api = {
  get: async u => (await fetch(API + u)).json(),
  post: async (u, d) => (await fetch(API + u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: d ? JSON.stringify(d) : undefined
  })).json(),
  put: async (u, d) => (await fetch(API + u, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: d ? JSON.stringify(d) : undefined
  })).json(),
  del: async u => (await fetch(API + u, { method: 'DELETE' })).json()
};

export default api;
