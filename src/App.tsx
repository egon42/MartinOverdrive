import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { assetUrl, baseUrl } from './base'
import { Dashboard, Practice, Show, SongDetail } from './pages'
import { SetlistPage } from './setlist'
import { SettingsPage } from './settings'

export default function App() {
  return <div className="app-shell">
    <header className="topbar"><NavLink to="/" className="brand"><img className="brand-logo" src={assetUrl('martin-drive-logo.jpg')} alt="Martin Drive"/><span>Overdrive<br/><small>setlist</small></span>{baseUrl.includes('/dev/') && <span className="dev-badge">dev</span>}</NavLink><nav aria-label="Primary"><NavLink to="/">Home</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/set">Set</NavLink><NavLink to="/show">Show</NavLink><NavLink to="/settings">Settings</NavLink></nav></header>
    <main><Routes><Route path="/" element={<Dashboard />} /><Route path="/practice" element={<Practice />} /><Route path="/songs" element={<Navigate to="/practice" replace />} /><Route path="/song/:id" element={<SongDetail />} /><Route path="/set" element={<SetlistPage />} /><Route path="/show/:songId?" element={<Show />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Dashboard />} /></Routes></main>
  </div>
}
