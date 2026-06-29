import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { assetUrl, baseUrl } from './base'
import { PracticeProvider } from './storage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><PracticeProvider><App /></PracticeProvider></HashRouter></React.StrictMode>)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(assetUrl('sw.js'), { scope: baseUrl }))
}
