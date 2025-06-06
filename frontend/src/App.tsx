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
          <AppRoutes />
        </ToastManager>
      </AuthProvider>
    </Router>
  );
};

export default App;

