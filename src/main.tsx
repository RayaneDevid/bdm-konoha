import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const village = import.meta.env.VITE_VILLAGE;
if (village === 'Kiri') {
  document.documentElement.setAttribute('data-village', 'kiri');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
