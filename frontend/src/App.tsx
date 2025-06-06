import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes';
import ToastManager from './components/Toast/ToastManager';
import { clarity } from 'react-microsoft-clarity';

clarity.init("qjsxn8sbzh");

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastManager>
          <div className="max-w-7xl mx-auto p-8 text-center">
            <AppRoutes />
          </div>
        </ToastManager>
      </AuthProvider>
    </Router>
  );
};

export default App;

