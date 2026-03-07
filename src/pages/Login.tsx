import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
      <div className="absolute top-[calc(50%-300px)] left-[calc(50%-240px)] w-16 h-16 bg-[#C41E3A] rounded-full blur-[24px] opacity-20" />
      <div className="absolute top-[calc(50%+220px)] left-[calc(50%+160px)] w-16 h-16 bg-[#D4A017] rounded-full blur-[24px] opacity-20" />

      {/* Carte de login */}
      <div className="relative w-full max-w-[448px] mx-4">
        {/* Bordure bois */}
        <div className="bg-[#5D4037] rounded-[6px] p-1 shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)]">
          <div className="bg-[#F5E6CA] rounded overflow-hidden">
            {/* Bande rouge haut */}
            <div className="h-3 bg-gradient-to-b from-[#8B0000] via-[#C41E3A] to-[#8B0000]" />

            <div className="px-8 pt-8 pb-0">
              {/* Embleme */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-[#3E2723] border-4 border-[#D4A017] flex items-center justify-center shadow-lg">
                  <span className="text-[#D4A017] text-4xl font-normal" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                    忍
                  </span>
                </div>
                <h1
                  className="mt-4 text-[30px] font-medium text-[#3E2723] text-center"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Bureau des Missions
                </h1>
                {/* Separateur rouge */}
                <div className="mt-2 w-32 h-px bg-gradient-to-r from-transparent via-[#8B0000] to-transparent" />
              </div>

              {/* Formulaire */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#3E2723]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Nom d'utilisateur
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                    required
                    className="w-full h-9 px-3 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] placeholder-[#5D4037]/50 outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#3E2723]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full h-9 px-3 pr-10 bg-[#FAF3E3] border border-[#5D4037] rounded text-sm text-[#3E2723] outline-none focus:border-[#D4A017] focus:ring-1 focus:ring-[#D4A017] transition-colors"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5D4037]/60 hover:text-[#5D4037] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-[#C41E3A] text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-[52px] bg-[#5D4037] border-2 border-[#3E2723] rounded text-[#FAF3E3] text-lg font-medium shadow-lg hover:bg-[#4E342E] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>

            {/* Bande rouge bas */}
            <div className="h-3 mt-8 bg-gradient-to-b from-[#8B0000] via-[#C41E3A] to-[#8B0000]" />
          </div>
        </div>
      </div>
    </div>
  );
}
