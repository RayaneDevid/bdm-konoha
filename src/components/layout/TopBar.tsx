import { useEffect, useState } from 'react';
import { LogOut, KeyRound, Eye, EyeOff, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_LABELS } from '../../utils/constants';
import type { Role } from '../../types';

const isKiri = import.meta.env.VITE_VILLAGE === 'Kiri';
const ROLE_BADGE_STYLES: Record<Role, string> = {
  superviseur: 'bg-[#6A0DAD] border-[#4B0082] text-white',
  gerant: isKiri
    ? 'bg-[#1565C0] border-[#0D47A1] text-white'
    : 'bg-[#C62828] border-[#8B0000] text-white',
  'co-gerant': 'bg-[#E67E22] border-[#C05600] text-white',
  membre_bdm: 'bg-[#1565C0] border-[#0D47A1] text-white',
};

export default function TopBar() {
  const navigate = useNavigate();
  const { staffUser } = useAuth();

  const userName = staffUser ? `${staffUser.first_name} ${staffUser.last_name}` : '...';
  const role: Role = staffUser?.role ?? 'membre_bdm';
  const [cycleName, setCycleName] = useState('...');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase
      .from('cycles')
      .select('name')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCycleName(data.name);
        else setCycleName('Aucun cycle');
      });
  }, []);

  // Password change modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  function resetPwModal() {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setPwError('');
    setPwSuccess(false);
    setPwSubmitting(false);
  }

  function openPwModal() {
    resetPwModal();
    setShowPwModal(true);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');

    if (newPw.length < 6) {
      setPwError('Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPwSubmitting(true);

    // Vérifier le mot de passe actuel en se re-authentifiant
    const email = staffUser?.email;
    if (!email) {
      setPwError('Impossible de récupérer votre email.');
      setPwSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPw,
    });

    if (signInError) {
      setPwError('Mot de passe actuel incorrect.');
      setPwSubmitting(false);
      return;
    }

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPw,
    });

    if (updateError) {
      setPwError(updateError.message);
      setPwSubmitting(false);
      return;
    }

    setPwSuccess(true);
    setPwSubmitting(false);
    setTimeout(() => {
      setShowPwModal(false);
      resetPwModal();
    }, 1500);
  }

  return (
    <>
      <header className="bg-[var(--v-cream)] border-b-4 border-[var(--v-medium)] shadow-md">
        <div className="flex items-center justify-between px-4 h-[89px]">
          {/* Cycle actif */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 bg-[var(--v-primary)] rounded-full" />
            <span
              className="text-[var(--v-primary)] text-xl"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              {cycleName}
            </span>
            <div className="w-1 h-8 bg-[var(--v-primary)] rounded-full" />
          </div>

          {/* User info + actions */}
          <div className="flex items-center gap-3">
            {/* Carte user */}
            <div className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded-md px-4 py-1.5 flex flex-row gap-2 items-end">
              <span className="text-sm text-[var(--v-dark)]">{userName}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${ROLE_BADGE_STYLES[role]}`}
              >
                {ROLE_LABELS[role]}
              </span>
            </div>

            {/* Bouton changer mot de passe */}
            <button
              onClick={openPwModal}
              className="flex items-center gap-2 bg-[var(--v-medium)] border border-[var(--v-dark)] text-[var(--v-off-white)] px-3 h-9 rounded text-sm font-medium hover:bg-[var(--v-dark)] transition-colors cursor-pointer"
              title="Changer le mot de passe"
            >
              <KeyRound size={16} />
            </button>

            {/* Bouton deconnexion */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 bg-[var(--v-secondary)] border border-[var(--v-primary)] text-[var(--v-off-white)] px-4 h-9 rounded text-sm font-medium hover:bg-[var(--v-secondary-dark)] transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal Changer le mot de passe */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowPwModal(false); resetPwModal(); }} />
          <div className="relative bg-[var(--v-cream)] border-4 border-[var(--v-medium)] rounded-[10px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[var(--v-gold)] via-[var(--v-primary)] to-[var(--v-gold)]" />

            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KeyRound size={20} className="text-[var(--v-primary)]" />
                <h3
                  className="text-xl font-medium text-[var(--v-primary)]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Changer le mot de passe
                </h3>
              </div>
              <button
                onClick={() => { setShowPwModal(false); resetPwModal(); }}
                className="text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {pwSuccess ? (
              <div className="px-6 pb-6 flex flex-col items-center gap-3 py-8">
                <div className="w-12 h-12 rounded-full bg-[#4A5D23]/20 flex items-center justify-center">
                  <Check size={28} className="text-[#4A5D23]" />
                </div>
                <p className="text-sm font-medium text-[#4A5D23]">
                  Mot de passe modifié avec succès !
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="px-6 pb-6 space-y-4">
                {/* Mot de passe actuel */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--v-dark)]">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className="w-full bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded px-3 py-2 pr-10 text-sm text-[var(--v-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
                    >
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Nouveau mot de passe */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--v-dark)]">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded px-3 py-2 pr-10 text-sm text-[var(--v-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)]"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--v-medium)] hover:text-[var(--v-dark)] cursor-pointer"
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--v-medium)]">Minimum 6 caractères</p>
                </div>

                {/* Confirmer */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--v-dark)]">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className={`w-full bg-[var(--v-off-white)] border rounded px-3 py-2 text-sm text-[var(--v-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)] ${
                      confirmPw && confirmPw !== newPw ? 'border-[#C62828]' : 'border-[var(--v-medium)]'
                    }`}
                    required
                  />
                  {confirmPw && confirmPw !== newPw && (
                    <p className="text-xs text-[#C62828]">Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                {/* Erreur */}
                {pwError && (
                  <div className="bg-[#C62828]/10 border border-[#C62828] rounded px-3 py-2">
                    <p className="text-xs text-[#C62828]">{pwError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowPwModal(false); resetPwModal(); }}
                    className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] text-[var(--v-dark)] px-5 py-2 rounded text-sm font-medium hover:bg-[var(--v-light-beige)] transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="bg-[var(--v-primary)] border-2 border-[var(--v-primary-dark)] text-[var(--v-off-white)] px-5 py-2 rounded text-sm font-medium hover:bg-[var(--v-secondary)] transition-colors cursor-pointer disabled:opacity-50"
                    style={{ fontFamily: "'Noto Serif JP', serif" }}
                  >
                    {pwSubmitting ? 'Modification...' : 'Modifier'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
