import { useEffect } from 'react';

export function useKeyboardShortcut(key: string, callback: () => void, ctrlKey: boolean = true) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((ctrlKey ? (e.ctrlKey || e.metaKey) : true) && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, ctrlKey]);
}
