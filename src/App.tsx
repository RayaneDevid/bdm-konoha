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
import FicheMembre from './pages/FicheMembre';
import Annuaire from './pages/Annuaire';
import AnnuaireAdherent from './pages/AnnuaireAdherent';

export default function App() {
  const { session, loading } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — always accessible, no auth check */}
        <Route path="/annuaire" element={<Annuaire />} />
        <Route path="/annuaire/:id" element={<AnnuaireAdherent />} />

        {/* During auth init, catch everything else with a spinner */}
        {loading ? (
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-[var(--v-off-white)]">
                <p
                  className="text-[var(--v-dark)] text-lg"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Chargement...
                </p>
              </div>
            }
          />
        ) : (
          <>
            <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
            <Route element={session ? <AppLayout /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/adherents" element={<Adherents />} />
              <Route path="/adherents/:id" element={<AdherentProfile />} />
              <Route path="/rapports" element={<Rapports />} />
              <Route path="/fiche-membre" element={<FicheMembre />} />
              <Route path="/recompenses" element={<Recompenses />} />
              <Route path="/config-cartes" element={<ConfigCartes />} />
              <Route path="/cycles" element={<Cycles />} />
              <Route path="/administration" element={<Administration />} />
            </Route>
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
