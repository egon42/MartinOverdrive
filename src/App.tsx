import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { assetUrl, baseUrl } from './base'
import { Dashboard, Practice, Show, SongDetail } from './pages'
import { SetlistPage } from './setlist'
import { SettingsPage } from './settings'
import { SwUpdateBanner } from './swUpdate'

const brandLogo = baseUrl.includes('/dev/') ? 'martin-drive-logo-dev.jpg' : 'martin-drive-logo.jpg'

export default function App() {
  return <div className="app-shell">
    <header className="topbar"><NavLink to="/" className="brand"><img className="brand-logo" src={assetUrl(brandLogo)} alt="Martin Drive"/><span>Overdrive<br/><small>setlist</small></span></NavLink><nav aria-label="Primary"><NavLink to="/">Home</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/set">Set</NavLink><NavLink to="/show">Show</NavLink><NavLink to="/settings">Settings</NavLink></nav></header>
    <main><Routes><Route path="/" element={<Dashboard />} /><Route path="/practice" element={<Practice />} /><Route path="/songs" element={<Navigate to="/practice" replace />} /><Route path="/song/:id" element={<SongDetail />} /><Route path="/set" element={<SetlistPage />} /><Route path="/show/:songId?" element={<Show />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Dashboard />} /></Routes></main>
    <SwUpdateBanner />
  </div>
}
