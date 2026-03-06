const { useState, useCallback } = React;

/**
 * Custom hook for form state management
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Submit handler (optional)
 * @returns {Object} Form state and handlers
 */
export function useForm(initialValues = {}, onSubmit = null) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when it changes
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!onSubmit) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(values);
    } catch (err) {
      if (err.errors) {
        setErrors(err.errors);
      } else {
        console.error('Form submission error:', err);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [values, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  const setFieldValue = useCallback((name, value) => {
    handleChange(name, value);
  }, [handleChange]);

  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, []);

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    reset,
    setFieldValue,
    setFieldError,
    setValues,
    setErrors
  };
}
