import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const SnackbarContext = createContext(null);

const typeStyles = {
  success: { bg: 'bg-green-600', icon: CheckCircle },
  error: { bg: 'bg-red-600', icon: XCircle },
  info: { bg: 'bg-[#1A73E8]', icon: Info },
};

export function SnackbarProvider({ children }) {
  const [snacks, setSnacks] = useState([]);

  const showSnack = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setSnacks((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setSnacks((prev) => prev.filter((s) => s.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id) => {
    setSnacks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <SnackbarContext.Provider value={{ showSnack }}>
      {children}
      {createPortal(
        <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center w-full max-w-sm px-4">
          {snacks.map((snack) => {
            const style = typeStyles[snack.type] || typeStyles.info;
            const Icon = style.icon;
            return (
              <div
                key={snack.id}
                className={`${style.bg} text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 w-full animate-fade-in`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">{snack.message}</span>
                <button
                  onClick={() => dismiss(snack.id)}
                  className="p-1 rounded hover:bg-white/20 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}
