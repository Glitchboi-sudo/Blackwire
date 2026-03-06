import api from '../utils/api.js';

export const projectService = {
  /**
   * List all projects
   */
  async list() {
    return await api.get('/api/projects');
  },

  /**
   * Get current active project
   */
  async getCurrent() {
    return await api.get('/api/projects/current');
  },

  /**
   * Create new project
   */
  async create(name, description) {
    return await api.post('/api/projects', { name, description });
  },

  /**
   * Select/switch to a project
   */
  async select(name) {
    return await api.post(`/api/projects/${name}/select`);
  },

  /**
   * Delete a project
   */
  async delete(name) {
    return await api.del(`/api/projects/${name}`);
  },

  /**
   * Export project as JSON (triggers browser download)
   */
  exportJSON(name) {
    window.location.href = `/api/projects/${name}/export`;
  },

  /**
   * Export project as Burp Suite XML (triggers browser download)
   */
  exportBurp(name) {
    window.location.href = `/api/projects/${name}/export-burp`;
  },

  /**
   * Import project data to existing project
   */
  async importTo(name, file, clearExisting = false) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('clear_existing', clearExisting);
    return await api.post(`/api/projects/${name}/import`, fd);
  },

  /**
   * Import as new project
   */
  async importAsNew(file) {
    const fd = new FormData();
    fd.append('file', file);
    return await api.post('/api/projects/import', fd);
  },

  /**
   * Import Burp Suite XML file
   */
  async importBurp(name, file) {
    const text = await file.text();
    const response = await fetch(`/api/projects/${name}/import-burp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: text
    });
    return await response.json();
  },

  /**
   * Update project configuration
   */
  async updateConfig(name, config) {
    return await api.put(`/api/projects/${name}`, config);
  }
};
