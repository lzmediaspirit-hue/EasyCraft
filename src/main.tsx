import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// נקבע גם מכאן ולא רק ב-HTML, כדי שהאפליקציה תישאר RTL גם כשהיא מוטמעת בדף אחר
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'he';

const root = document.getElementById('root') ?? document.body.appendChild(
  Object.assign(document.createElement('div'), { id: 'root' }),
);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
