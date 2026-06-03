import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import './index.css';

function ToastBridge({ children }) {
  const { addToast } = useToast();
  React.useEffect(() => {
    const orig = window.alert;
    window.alert = (msg) => addToast(String(msg), 'info');
    return () => { window.alert = orig; };
  }, [addToast]);
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <ToastBridge>
          <App />
        </ToastBridge>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);
