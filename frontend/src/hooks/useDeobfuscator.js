const { useState, useCallback } = React;

/**
 * Custom hook for managing deobfuscation with async processing
 * Provides non-blocking deobfuscation with progress tracking using setTimeout
 */
export function useDeobfuscator(onProgress) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);

  /**
   * Deobfuscate and beautify code asynchronously
   * Uses setTimeout to allow UI updates between processing steps
   */
  const deobfuscateAndBeautify = useCallback((code) => {
    return new Promise((resolve, reject) => {
      setIsProcessing(true);
      setProgress({ stage: 'starting' });

      // Import deobfuscator functions
      import('../utils/deobfuscator.js').then(({ deobfuscateAndBeautify: deobfuscateFunc }) => {
        import('../utils/formatters.js').then(({ beautifyJs }) => {
          // Notify progress
          if (onProgress) {
            onProgress({ stage: 'detecting' });
          }

          // Allow UI to update
          setTimeout(() => {
            try {
              if (onProgress) {
                onProgress({ stage: 'deobfuscating' });
              }

              // Perform deobfuscation (this is the heavy operation)
              const result = deobfuscateFunc(code, beautifyJs);

              if (onProgress) {
                onProgress({ stage: 'complete' });
              }

              setIsProcessing(false);
              setProgress(null);
              resolve(result);
            } catch (error) {
              console.error('Deobfuscation error:', error);
              setIsProcessing(false);
              setProgress(null);
              reject(error);
            }
          }, 50); // Small delay to allow UI update
        }).catch(reject);
      }).catch(reject);
    });
  }, [onProgress]);

  /**
   * Just beautify code (faster than deobfuscate)
   */
  const beautify = useCallback((code) => {
    return new Promise((resolve, reject) => {
      setIsProcessing(true);
      setProgress({ stage: 'beautifying' });

      import('../utils/formatters.js').then(({ beautifyJs }) => {
        if (onProgress) {
          onProgress({ stage: 'beautifying' });
        }

        setTimeout(() => {
          try {
            const result = beautifyJs(code);
            setIsProcessing(false);
            setProgress(null);
            resolve(result);
          } catch (error) {
            console.error('Beautification error:', error);
            setIsProcessing(false);
            setProgress(null);
            reject(error);
          }
        }, 50);
      }).catch(reject);
    });
  }, [onProgress]);

  /**
   * Detect obfuscation type
   */
  const detectType = useCallback((code) => {
    return new Promise((resolve, reject) => {
      import('../utils/deobfuscator.js').then(({ detectObfuscationType }) => {
        try {
          const result = detectObfuscationType(code);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });
  }, []);

  /**
   * Cancel ongoing processing
   */
  const cancel = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
  }, []);

  return {
    deobfuscateAndBeautify,
    beautify,
    detectType,
    cancel,
    isProcessing,
    progress
  };
}
