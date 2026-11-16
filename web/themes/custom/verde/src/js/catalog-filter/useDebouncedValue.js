import { useEffect, useState } from 'react';

/**
 * Returns `value`, but only after it has stopped changing for `delay` ms.
 *
 * Used for the search box: typing "bowl" sends one request, not four.
 *
 * @param {*} value - The value that changes often.
 * @param {number} delay - Milliseconds to wait.
 * @returns {*} The debounced value.
 */
export default function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    // Cleanup runs before the next effect: a new keystroke cancels the timer.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
