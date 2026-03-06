const { useState, useCallback } = React;
import { collectionService } from '../services/collectionService.js';

/**
 * Custom hook for Collections and runner
 * @param {Function} toast - Toast notification function
 * @returns {Object} Collections state and methods
 */
export function useCollections(toast) {
  const [collections, setCollections] = useState([]);
  const [selectedColl, setSelectedColl] = useState(null);
  const [items, setItems] = useState([]);
  const [vars, setVars] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState([]);
  const [running, setRunning] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load collections
  const load = useCallback(async () => {
    try {
      const data = await collectionService.list();
      setCollections(Array.isArray(data) ? data : (data.collections || []));
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  }, []);

  // Create collection
  const create = useCallback(async (name, description = '') => {
    if (!name.trim()) {
      toast('Collection name required', 'error');
      return false;
    }

    setLoading(true);
    try {
      const r = await collectionService.create(name, description);
      if (r.status === 'created') {
        await load();
        toast('Collection created', 'success');
        return true;
      } else {
        toast('Failed to create collection', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to create collection', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, load]);

  // Delete collection
  const deleteCollection = useCallback(async (collId) => {
    setLoading(true);
    try {
      await collectionService.delete(collId);
      await load();
      if (selectedColl?.id === collId) {
        setSelectedColl(null);
        setItems([]);
      }
      toast('Collection deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete collection', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedColl, toast, load]);

  // Load items for a collection
  const loadItems = useCallback(async (collId) => {
    try {
      const data = await collectionService.getItems(collId);
      setItems(Array.isArray(data) ? data : (data.items || []));
    } catch (err) {
      console.error('Failed to load collection items:', err);
    }
  }, []);

  // Add item to collection
  const addItem = useCallback(async (collId, request) => {
    setLoading(true);
    try {
      const r = await collectionService.addItem(collId, request);
      if (r.status === 'added') {
        await loadItems(collId);
        toast('Item added', 'success');
        return true;
      } else {
        toast('Failed to add item', 'error');
        return false;
      }
    } catch (err) {
      toast('Failed to add item', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadItems]);

  // Delete item from collection
  const deleteItem = useCallback(async (collId, itemId) => {
    setLoading(true);
    try {
      await collectionService.deleteItem(collId, itemId);
      await loadItems(collId);
      toast('Item deleted', 'success');
      return true;
    } catch (err) {
      toast('Failed to delete item', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadItems]);

  // Update item extraction rules
  const updateItemExtracts = useCallback(async (collId, itemId, extracts) => {
    setLoading(true);
    try {
      await collectionService.updateItemExtracts(collId, itemId, extracts);
      await loadItems(collId);
      toast('Extraction rules updated', 'success');
      return true;
    } catch (err) {
      toast('Failed to update extraction rules', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast, loadItems]);

  // Execute a single step
  const executeStep = useCallback(async (collId, stepIndex) => {
    if (stepIndex >= items.length) {
      setRunning(false);
      toast('Collection run completed', 'success');
      return;
    }

    setCurrentStep(stepIndex);
    setRunning(true);

    try {
      const item = items[stepIndex];
      const r = await collectionService.executeItem(collId, item.id, vars);

      // Update vars with extracted values
      if (r.extracted) {
        setVars(prev => ({ ...prev, ...r.extracted }));
      }

      setResponses(prev => [...prev, r]);

      // Continue to next step
      setTimeout(() => executeStep(collId, stepIndex + 1), 100);
    } catch (err) {
      toast('Step failed: ' + err.message, 'error');
      setRunning(false);
    }
  }, [items, vars, toast]);

  // Reset run state
  const resetRun = useCallback(() => {
    setCurrentStep(0);
    setResponses([]);
    setVars({});
    setRunning(false);
  }, []);

  return {
    collections,
    selectedColl,
    setSelectedColl,
    items,
    setItems, // Allow direct state setting
    vars,
    setVars,
    currentStep,
    responses,
    setResponses, // Allow direct state setting
    running,
    setRunning, // Allow direct state setting
    showPicker,
    setShowPicker,
    loading,
    load,
    create,
    delete: deleteCollection,
    loadItems,
    addItem,
    deleteItem,
    updateItemExtracts,
    executeStep,
    resetRun
  };
}
