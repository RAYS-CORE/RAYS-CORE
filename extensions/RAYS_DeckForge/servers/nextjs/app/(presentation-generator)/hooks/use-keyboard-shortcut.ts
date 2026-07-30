import { useEffect, useCallback } from 'react';

type KeyboardEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
};

export const useKeyboardShortcut = (
  keys: string[],
  callback: (e: KeyboardEvent) => void,
  deps: any[] = []
) => {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      const isCtrlPressed = event.ctrlKey;
      
      if (keys.includes(event.key.toLowerCase()) && isCtrlPressed) {
        event.preventDefault();
        callback(event);
      }
    },
    [callback, ...deps]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress as any);
    return () => {
      document.removeEventListener('keydown', handleKeyPress as any);
    };
  }, [handleKeyPress]);
}; 