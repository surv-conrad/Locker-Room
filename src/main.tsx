import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ExportProvider } from './contexts/ExportContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ExportProvider>
        <App />
      </ExportProvider>
    </ErrorBoundary>
  </StrictMode>,
);
