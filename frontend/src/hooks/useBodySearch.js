const { useState, useRef, useEffect } = React;
import { useDebounce } from './useDebounce.js';

/**
 * Custom hook for searching within body text
 * Handles search term, regex mode, match navigation, and auto-scrolling
 * Now with debouncing for better performance on large texts
 * @returns {Object} Search state and controls
 */
export function useBodySearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [show, setShow] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const contentRef = useRef(null);

  // Debounce search term to avoid excessive processing on large texts
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Track if we're waiting for debounce
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm && searchTerm.length > 0) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedSearchTerm]);

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
    debouncedSearchTerm,
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
    contentRef,
    isSearching
  };
}
