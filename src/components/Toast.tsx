import { useEffect } from 'react';

export interface ToastData {
  id: number;
  message: string;
  undo?: () => void;
}

interface Props {
  toast: ToastData | null;
  onDone: () => void;
}

const VISIBLE_MS = 5000;

/** 保存・完了などの直後に数秒だけ出す。「取り消し」で元に戻せる */
export function Toast({ toast, onDone }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDone, VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [toast, onDone]);

  return (
    <div className="toast-area" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo!();
                onDone();
              }}
            >
              取り消し
            </button>
          )}
        </div>
      )}
    </div>
  );
}
