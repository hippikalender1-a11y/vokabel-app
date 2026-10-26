import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import UpdateHinweis from './UpdateHinweis.jsx'
import InfoTafel from './InfoTafel.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <UpdateHinweis />
    <InfoTafel />
  </StrictMode>,
)
