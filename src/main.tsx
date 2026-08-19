import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GestureRecognizerProvider } from '@/contexts/GestureRecognizerContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GestureRecognizerProvider>
      <App />
    </GestureRecognizerProvider>
  </StrictMode>,
)
