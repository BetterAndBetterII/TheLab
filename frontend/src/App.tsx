import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes';
import styles from './App.module.css';
import ToastManager from './components/Toast/ToastManager';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className={styles.layout}>
          {/* 右侧主内容区域 */}
          <main className={styles.main}>
            <AppRoutes />
          </main>
        </div>
        <ToastManager />
      </AuthProvider>
    </Router>
  );
};

export default App;
