import { createRoot } from 'react-dom/client';
import { App } from './App';
import './cluster-checks';
import './index.css';
import './canvas/canvas.css';

createRoot(document.getElementById('root')!).render(<App />);
