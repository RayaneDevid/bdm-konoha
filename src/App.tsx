import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Adherents from './pages/Adherents';
import AdherentProfile from './pages/AdherentProfile';
import Rapports from './pages/Rapports';
import ConfigCartes from './pages/ConfigCartes';
import Cycles from './pages/Cycles';
import Administration from './pages/Administration';
import Recompenses from './pages/Recompenses';
import Annuaire from './pages/Annuaire';
import AnnuaireAdherent from './pages/AnnuaireAdherent';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF3E3]">
        <p className="text-[#3E2723] text-lg" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Chargement...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth required */}
        <Route path="/annuaire" element={<Annuaire />} />
        <Route path="/annuaire/:id" element={<AnnuaireAdherent />} />

        {/* Auth-guarded routes */}
        <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
        <Route element={session ? <AppLayout /> : <Navigate to="/login" />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/adherents" element={<Adherents />} />
          <Route path="/adherents/:id" element={<AdherentProfile />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/recompenses" element={<Recompenses />} />
          <Route path="/config-cartes" element={<ConfigCartes />} />
          <Route path="/cycles" element={<Cycles />} />
          <Route path="/administration" element={<Administration />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
