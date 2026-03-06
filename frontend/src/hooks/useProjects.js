const { useState, useCallback } = React;
import { projectService } from '../services/projectService.js';

/**
 * Custom hook for projects CRUD
 * @param {Function} toast - Toast notification function
 * @param {Function} onProjectChange - Callback when project changes
 * @returns {Object} Projects state and methods
 */
export function useProjects(toast, onProjectChange) {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all projects
  const load = useCallback(async () => {
    try {
      const data = await projectService.list();
      setProjects(Array.isArray(data) ? data : (data.projects || []));
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, []);

  // Load current project
  const loadCurrent = useCallback(async () => {
    try {
      const data = await projectService.getCurrent();
      setCurrentProject(data);
      if (onProjectChange) {
        onProjectChange(data);
      }
    } catch (err) {
      console.error('Failed to load current project:', err);
    }
  }, [onProjectChange]);

  // Select a project
  const select = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const r = await projectService.select(projectId);
      if (r.status === 'selected') {
        await loadCurrent();
        await load();
        toast('Project selected', 'success');
        return true;
      } else {
        toast('Failed to select project', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to select project', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, load, loadCurrent]);

  // Create new project
  const create = useCallback(async (name = null, description = null) => {
    const projectName = name || newName;
    if (!projectName.trim()) {
      toast('Project name required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const r = await projectService.create(projectName, description || newDesc);
      if (r.status === 'created') {
        setNewName('');
        setNewDesc('');
        setShowNew(false);
        await load();
        toast('Project created', 'success');
        return true;
      } else {
        toast('Failed to create project', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to create project', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [newName, newDesc, toast, load]);

  // Delete project
  const deleteProject = useCallback(async (projectId) => {
    setLoading(true);
    try {
      await projectService.delete(projectId);
      await load();
      toast('Project deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete project', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, load]);

  // Export project as JSON
  const exportJSON = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const data = await projectService.exportJSON(projectId);
      toast('Project exported', 'success');
      return data;
    } catch (err) {
      toast('Failed to export project', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Export project as Burp
  const exportBurp = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const data = await projectService.exportBurp(projectId);
      toast('Project exported to Burp format', 'success');
      return data;
    } catch (err) {
      toast('Failed to export project', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Import to existing project
  const importTo = useCallback(async (projectId, data) => {
    setLoading(true);
    try {
      const r = await projectService.importTo(projectId, data);
      if (r.status === 'imported') {
        toast('Data imported', 'success');
        return true;
      } else {
        toast('Failed to import data', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to import data', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Import as new project
  const importAsNew = useCallback(async (name, data) => {
    setLoading(true);
    try {
      const r = await projectService.importAsNew(name, data);
      if (r.status === 'imported') {
        await load();
        toast('Project imported', 'success');
        return true;
      } else {
        toast('Failed to import project', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to import project', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, load]);

  // Import from Burp
  const importBurp = useCallback(async (name, burpFile) => {
    setLoading(true);
    try {
      const r = await projectService.importBurp(name, burpFile);
      if (r.status === 'imported') {
        await load();
        toast('Burp project imported', 'success');
        return true;
      } else {
        toast('Failed to import Burp project', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to import Burp project', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, load]);

  return {
    projects,
    currentProject,
    showNew,
    setShowNew,
    newName,
    setNewName,
    newDesc,
    setNewDesc,
    loading,
    load,
    loadCurrent,
    select,
    create,
    delete: deleteProject,
    exportJSON,
    exportBurp,
    importTo,
    importAsNew,
    importBurp
  };
}
