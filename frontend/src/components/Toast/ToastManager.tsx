import React, { useState, useCallback } from 'react';
import Toast, { ToastType } from './index';
import styles from './ToastManager.module.css';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
}

let toastCounter = 0;

const ToastManager: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // 导出到 window 对象，以便全局调用
  (window as any).toast = {
    show: (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = ++toastCounter;
      setToasts(prev => [...prev, { id, message, type, duration }]);
    },
    success: (message: string, duration?: number) => {
      (window as any).toast.show(message, 'success', duration);
    },
    error: (message: string, duration?: number) => {
      (window as any).toast.show(message, 'error', duration);
    },
    warning: (message: string, duration?: number) => {
      (window as any).toast.show(message, 'warning', duration);
    },
    info: (message: string, duration?: number) => {
      (window as any).toast.show(message, 'info', duration);
    },
  };

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastManager; 