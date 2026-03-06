const { useState, useRef, useEffect } = React;

/**
 * Custom hook for searching within body text
 * Handles search term, regex mode, match navigation, and auto-scrolling
 * @returns {Object} Search state and controls
 */
export function useBodySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [show, setShow] = useState(false);
  const contentRef = useRef(null);

  const toggleRegex = () => setIsRegex(prev => !prev);

  const nextMatch = () => {
    if (matchCount > 0) {
      setMatchIndex(prev => (prev + 1) % matchCount);
    }
  };

  const prevMatch = () => {
    if (matchCount > 0) {
      setMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
    }
  };

  const close = () => {
    setShow(false);
    setSearchTerm('');
    setMatchIndex(0);
    setMatchCount(0);
  };

  const open = () => {
    setShow(true);
  };

  // Auto-scroll to current match
  useEffect(() => {
    if (!show || !contentRef.current || matchCount === 0) return;

    const matches = contentRef.current.querySelectorAll('.search-hl');
    if (matches[matchIndex]) {
      matches[matchIndex].scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      });
    }
  }, [matchIndex, matchCount, show]);

  return {
    searchTerm,
    setSearchTerm,
    isRegex,
    setIsRegex,
    toggleRegex,
    matchIndex,
    setMatchIndex,
    matchCount,
    setMatchCount,
    show,
    setShow,
    open,
    close,
    nextMatch,
    prevMatch,
    contentRef
  };
}
