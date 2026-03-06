const { useState, useEffect } = React;

/**
 * Custom hook for pagination logic
 * @param {Object} options - Pagination options
 * @param {number} options.totalItems - Total number of items
 * @param {number} options.initialPageSize - Initial page size (default: 500)
 * @returns {Object} Pagination state and controls
 */
export function usePagination({ totalItems = 0, initialPageSize = 500 } = {}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const firstPage = () => setCurrentPage(1);

  const lastPage = () => setCurrentPage(totalPages);

  const changePageSize = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page when changing size
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    setPageSize: changePageSize,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage
  };
}
