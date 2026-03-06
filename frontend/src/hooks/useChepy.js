const { useState, useCallback } = React;
import { chepyService } from '../services/chepyService.js';

/**
 * Custom hook for Chepy cipher tool pipeline
 * @param {Function} toast - Toast notification function
 * @returns {Object} Chepy state and methods
 */
export function useChepy(toast) {
  const [subTab, setSubTab] = useState('pipeline');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [operations, setOperations] = useState([]);
  const [opsCatalog, setOpsCatalog] = useState([]);
  const [categories, setCategories] = useState({});
  const [selectedCat, setSelectedCat] = useState('');
  const [baking, setBaking] = useState(false);

  // Load operations catalog
  const loadOperations = useCallback(async () => {
    try {
      const data = await chepyService.getOperations();
      if (data && data.operations) {
        setCategories(data.operations);
        const cats = Object.keys(data.operations);
        if (cats.length > 0 && !selectedCat) {
          setSelectedCat(cats[0]);
        }
      } else {
        setOpsCatalog(data || []);
      }
    } catch (err) {
      console.error('Failed to load Chepy operations:', err);
    }
  }, [selectedCat]);

  // Bake (execute pipeline)
  const bake = useCallback(async () => {
    if (!input.trim()) {
      toast('Input required', 'error');
      return false;
    }

    setBaking(true);
    setError('');
    try {
      const r = await chepyService.bake(input, operations);
      if (r.error) {
        setError(r.error);
        setOutput('');
        toast('Bake failed', 'error');
        return false;
      } else {
        setOutput(r.output || '');
        toast('Recipe baked', 'success');
        return true;
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
      toast('Bake failed', 'error');
      return false;
    } finally {
      setBaking(false);
    }
  }, [input, operations, toast]);

  // Add operation to pipeline
  const addOp = useCallback((op) => {
    setOperations(prev => [...prev, { ...op, args: op.defaultArgs || {} }]);
  }, []);

  // Remove operation from pipeline
  const removeOp = useCallback((index) => {
    setOperations(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update operation arguments
  const updateOpArg = useCallback((index, argName, value) => {
    setOperations(prev => prev.map((op, i) =>
      i === index ? { ...op, args: { ...op.args, [argName]: value } } : op
    ));
  }, []);

  // Move operation up/down in pipeline
  const moveOp = useCallback((index, direction) => {
    setOperations(prev => {
      const newOps = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOps.length) return prev;
      [newOps[index], newOps[targetIndex]] = [newOps[targetIndex], newOps[index]];
      return newOps;
    });
  }, []);

  // Clear recipe
  const clearRecipe = useCallback(() => {
    setOperations([]);
    setOutput('');
    setError('');
  }, []);

  return {
    subTab,
    setSubTab,
    input,
    setInput,
    output,
    setOutput,
    error,
    setError, // Allow direct state setting
    operations,
    setOperations, // Allow direct state setting
    opsCatalog,
    categories,
    setCategories, // Allow direct state setting
    selectedCategory: selectedCat,
    selectedCat,
    setSelectedCategory: setSelectedCat,
    setSelectedCat,
    isBaking: baking,
    baking,
    setBaking, // Allow direct state setting
    loadOperations,
    bake,
    addOp,
    removeOp,
    updateOpArg,
    moveOp,
    clearRecipe
  };
}
