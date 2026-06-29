import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { assetUrl } from './base'
import { Dashboard, Jam, Practice, Show, SongDetail } from './pages'

export default function App() {
  return <div className="app-shell">
    <header className="topbar"><NavLink to="/" className="brand"><img className="brand-logo" src={assetUrl('martin-drive-logo.jpg')} alt="Martin Drive"/><span>Overdrive<br/><small>setlist</small></span></NavLink><nav aria-label="Primary"><NavLink to="/">Home</NavLink><NavLink to="/practice">Practice</NavLink><NavLink to="/jam">Jam</NavLink><NavLink to="/show">Show</NavLink></nav></header>
    <main><Routes><Route path="/" element={<Dashboard />} /><Route path="/practice" element={<Practice />} /><Route path="/songs" element={<Navigate to="/practice" replace />} /><Route path="/song/:id" element={<SongDetail />} /><Route path="/jam" element={<Jam />} /><Route path="/show" element={<Show />} /><Route path="*" element={<Dashboard />} /></Routes></main>
  </div>
}
