import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppRoutes from './routes';
import ToastManager from './components/Toast/ToastManager';
import { clarity } from 'react-microsoft-clarity';

clarity.init("qjsxn8sbzh");

const App: React.FC = () => {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <ToastManager>
            <AppRoutes />
          </ToastManager>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;

