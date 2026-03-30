import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VILLAGE_NAME } from '../utils/constants';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Identifiants incorrects');
        return;
      }

      navigate('/');
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image floute */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm scale-105"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      {/* Overlay sombre */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Lueurs decoratives */}
      <div className="absolute top-[calc(50%-300px)] left-[calc(50%-240px)] w-16 h-16 bg-[var(--v-secondary)] rounded-full blur-[24px] opacity-20" />
      <div className="absolute top-[calc(50%+220px)] left-[calc(50%+160px)] w-16 h-16 bg-[var(--v-gold)] rounded-full blur-[24px] opacity-20" />

      {/* Carte de login */}
      <div className="relative w-full max-w-[448px] mx-4">
        {/* Bordure bois */}
        <div className="bg-[var(--v-medium)] rounded-[6px] p-1 shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
          <div className="bg-[var(--v-cream)] rounded overflow-hidden">
            {/* Bande rouge haut */}
            <div className="h-3 bg-gradient-to-b from-[var(--v-primary)] via-[var(--v-secondary)] to-[var(--v-primary)]" />

            <div className="px-8 pt-8 pb-0">
              {/* Embleme */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-[var(--v-dark)] border-4 border-[var(--v-gold)] flex items-center justify-center shadow-lg">
                  <span className="text-[var(--v-gold)] text-4xl font-normal" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                    忍
                  </span>
                </div>
                <h1
                  className="mt-4 text-[30px] font-medium text-[var(--v-dark)] text-center"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Bureau des Missions
                </h1>
                {/* Separateur rouge */}
                <div className="mt-2 w-32 h-px bg-gradient-to-r from-transparent via-[var(--v-primary)] to-transparent" />
              </div>

              {/* Formulaire */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Nom d'utilisateur
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`prenom@${VILLAGE_NAME.toLowerCase()}.bdm`}
                    required
                    className="w-full h-9 px-3 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] placeholder-[var(--v-medium)]/50 outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--v-dark)]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full h-9 px-3 pr-10 bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded text-sm text-[var(--v-dark)] outline-none focus:border-[var(--v-gold)] focus:ring-1 focus:ring-[var(--v-gold)] transition-colors"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--v-medium)]/60 hover:text-[var(--v-medium)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-[var(--v-secondary)] text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-[var(--v-medium)] border-2 border-[var(--v-dark)] rounded text-[var(--v-off-white)] text-lg font-medium shadow-lg hover:bg-[var(--v-medium-dark)] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>

            {/* Bande rouge bas */}
            <div className="h-3 mt-8 bg-gradient-to-b from-[var(--v-primary)] via-[var(--v-secondary)] to-[var(--v-primary)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
