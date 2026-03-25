import { useEffect, useState } from 'react';
import {
  UserPlus,
  X,
  CheckCircle,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ROLE_COLORS, ROLE_LABELS } from '../utils/constants';
import SearchableSelect from '../components/ui/SearchableSelect';
import type { StaffUser, Role, Adherent } from '../types';

const ROLES: Role[] = ['superviseur', 'gerant', 'co-gerant', 'membre_bdm'];

// Matrice statique des permissions
const PERMISSIONS: { label: string; superviseur: boolean; gerant: boolean; 'co-gerant': boolean; membre_bdm: boolean }[] = [
  { label: 'Voir le tableau de bord',          superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: true  },
  { label: 'Gérer les adhérents',              superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: true  },
  { label: "Évoluer la carte d'un adhérent",   superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: true  },
  { label: 'Enregistrer des missions',         superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: true  },
  { label: 'Marquer une mission réussie/échec', superviseur: true, gerant: true,  'co-gerant': true,  membre_bdm: true  },
  { label: 'Valider les paiements',            superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: false },
  { label: 'Supprimer une mission',            superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: false },
  { label: 'Créer / modifier un cycle',        superviseur: true,  gerant: true,  'co-gerant': false, membre_bdm: false },
  { label: 'Supprimer un cycle',               superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: false },
  { label: 'Configurer les cartes',            superviseur: true,  gerant: true,  'co-gerant': false, membre_bdm: false },
  { label: 'Accès Administration',             superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: false },
  { label: 'Gérer les utilisateurs staff',     superviseur: true,  gerant: true,  'co-gerant': true,  membre_bdm: false },
  { label: "Modifier le rôle d'un Gérant",     superviseur: false, gerant: false, 'co-gerant': false, membre_bdm: false },
];

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Administration() {
  const { staffUser } = useAuth();
  const isGerant = staffUser?.role === 'superviseur' || staffUser?.role === 'gerant';
  const canManageUsers = isGerant || staffUser?.role === 'co-gerant';

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adherentList, setAdherentList] = useState<Adherent[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<Role>('membre_bdm');
  const [formAdherentId, setFormAdherentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Success state after creation
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAdherents();
  }, []);

  const ROLE_ORDER: Role[] = ['superviseur', 'gerant', 'co-gerant', 'membre_bdm'];

  async function fetchUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('staff_users')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) {
      setUsers([...data].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)));
    }
    setLoading(false);
  }

  async function fetchAdherents() {
    const { data } = await supabase
      .from('adherents')
      .select('*')
      .eq('is_active', true)
      .order('last_name');
    if (data) setAdherentList(data);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formFirstName || !formLastName || !formEmail) return;
    setSubmitting(true);
    setFormError('');

    const tempPassword = generatePassword();

    // Sauvegarder la session actuelle
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    const { error } = await supabase.auth.signUp({
      email: formEmail,
      password: tempPassword,
      options: {
        data: {
          first_name: formFirstName,
          last_name: formLastName,
          role: formRole,
          ...(formAdherentId ? { adherent_id: formAdherentId } : {}),
        },
      },
    });

    // Restaurer la session admin
    if (currentSession) {
      await supabase.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      });
    }

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    // Succès
    setCreatedInfo({ email: formEmail, password: tempPassword });
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormRole('membre_bdm');
    setFormAdherentId('');
    setSubmitting(false);
    setShowModal(false);
    fetchUsers();
  }

  async function handleToggleActive(user: StaffUser) {
    await supabase
      .from('staff_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    fetchUsers();
  }

  async function handleChangeRole(userId: string, newRole: Role) {
    await supabase
      .from('staff_users')
      .update({ role: newRole })
      .eq('id', userId);
    fetchUsers();
  }

  function closeCreatedInfo() {
    setCreatedInfo(null);
    setCopied(false);
  }

  async function copyPassword(password: string) {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Titre + Bouton */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-4xl font-medium text-[#8B0000]"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            Administration
          </h1>
          <div className="mt-2 w-32 h-1 bg-gradient-to-r from-[#8B0000] via-[#C41E3A] to-transparent rounded-full" />
        </div>
        {canManageUsers && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#3E2723] text-[#FAF3E3] px-5 h-10 rounded shadow-lg text-sm font-medium hover:bg-[#5D4037] transition-colors cursor-pointer"
            style={{ fontFamily: "'Noto Serif JP', serif" }}
          >
            <UserPlus size={18} />
            Ajouter un utilisateur
          </button>
        )}
      </div>

      {/* Bandeau info après création */}
      {createdInfo && (
        <div className="bg-[#4A5D23]/10 border-2 border-[#4A5D23] rounded-[10px] px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-[#4A5D23]" />
                <span className="text-sm font-medium text-[#3E2723]">
                  Utilisateur créé avec succès !
                </span>
              </div>
              <div className="text-sm text-[#3E2723] space-y-1">
                <p>
                  Email : <span className="font-medium">{createdInfo.email}</span>
                </p>
                <p className="flex items-center gap-2">
                  Mot de passe temporaire :{' '}
                  <code className="bg-[#FAF3E3] border border-[#5D4037] px-2 py-0.5 rounded font-mono text-sm">
                    {createdInfo.password}
                  </code>
                  <button
                    onClick={() => copyPassword(createdInfo.password)}
                    className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
                  >
                    {copied ? <Check size={16} className="text-[#4A5D23]" /> : <Copy size={16} />}
                  </button>
                </p>
                <p className="text-xs text-[#5D4037] italic">
                  Communiquez ce mot de passe à l'utilisateur. Il pourra le changer après connexion.
                </p>
              </div>
            </div>
            <button onClick={closeCreatedInfo} className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Table des utilisateurs */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />

        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
            <h2
              className="text-2xl font-medium text-[#3E2723]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Utilisateurs du Bureau
            </h2>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-[#5D4037] text-sm text-center py-8">Chargement...</p>
          ) : users.length === 0 ? (
            <p className="text-[#5D4037] text-sm text-center py-8">Aucun utilisateur trouvé.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#5D4037]">
                    <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3">Nom</th>
                    <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3">Email</th>
                    <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3">Rôle</th>
                    <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3">Statut</th>
                    <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3">Date d'ajout</th>
                    <th className="text-right text-sm font-medium text-[#3E2723] px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#E8D5B7]">
                      {/* Nom */}
                      <td className="px-3 py-3 text-sm text-[#3E2723]">
                        {user.first_name} {user.last_name}
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3 text-sm text-[#5D4037]">{user.email}</td>

                      {/* Rôle */}
                      <td className="px-3 py-3">
                        {isGerant && user.id !== staffUser?.id ? (
                          <select
                            value={user.role}
                            onChange={(e) => handleChangeRole(user.id, e.target.value as Role)}
                            className="text-xs font-medium text-white px-3 py-1 rounded appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
                            style={{
                              backgroundColor: ROLE_COLORS[user.role],
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                            }}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="inline-block text-xs font-medium text-white px-3 py-1 rounded"
                            style={{ backgroundColor: ROLE_COLORS[user.role] }}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2 text-sm">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: user.is_active ? '#4A5D23' : '#C62828' }}
                          />
                          <span className="text-[#3E2723]">{user.is_active ? 'Actif' : 'Désactivé'}</span>
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3 text-sm text-[#5D4037]">{formatDate(user.created_at)}</td>

                      {/* Actions */}
                      <td className="px-3 py-3 text-right">
                        {canManageUsers && user.id !== staffUser?.id && (
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`text-xs font-medium px-3 py-1.5 rounded border cursor-pointer transition-colors ${
                              user.is_active
                                ? 'bg-[#C62828]/10 border-[#C62828] text-[#C62828] hover:bg-[#C62828]/20'
                                : 'bg-[#4A5D23]/10 border-[#4A5D23] text-[#4A5D23] hover:bg-[#4A5D23]/20'
                            }`}
                          >
                            {user.is_active ? '✕ Désactiver' : '✓ Activer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Matrice des Permissions */}
      <div className="bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-[#8B0000] via-[#D4A017] to-[#8B0000]" />

        <div className="bg-[#E8D5B7] border-b-2 border-[#5D4037] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-1 h-6 bg-[#C41E3A] rounded-full" />
            <h2
              className="text-2xl font-medium text-[#3E2723]"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              Matrice des Permissions
            </h2>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#5D4037]">
                  <th className="text-left text-sm font-medium text-[#3E2723] px-3 py-3 w-[40%]">
                    Capacité
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} className="text-center px-3 py-3">
                      <span
                        className="inline-block text-xs font-medium text-white px-4 py-1 rounded"
                        style={{ backgroundColor: ROLE_COLORS[r] }}
                      >
                        {ROLE_LABELS[r]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm, idx) => (
                  <tr
                    key={idx}
                    className={idx < PERMISSIONS.length - 1 ? 'border-b border-[#E8D5B7]' : ''}
                  >
                    <td className="px-3 py-3 text-sm text-[#3E2723]">{perm.label}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="text-center px-3 py-3">
                        {perm[r] ? (
                          <CheckCircle size={18} className="inline-block text-[#4A5D23]" />
                        ) : (
                          <XCircle size={18} className="inline-block text-[#C62828]" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Ajouter un utilisateur */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-[#F5E6CA] border-4 border-[#5D4037] rounded-[10px] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#D4A017] via-[#8B0000] to-[#D4A017]" />

            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus size={20} className="text-[#8B0000]" />
                <h3
                  className="text-xl font-medium text-[#8B0000]"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  Ajouter un utilisateur
                </h3>
              </div>
              <button
                onClick={() => { setShowModal(false); setFormError(''); setFormAdherentId(''); }}
                className="text-[#5D4037] hover:text-[#3E2723] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="px-6 pb-6 space-y-4">
              {/* Prénom + Nom */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#3E2723]">Prénom</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Saki"
                    className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#5D4037]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#3E2723]">Nom</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Sato"
                    className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#5D4037]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[#3E2723]">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="prenom@konoha.bdm"
                  className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#5D4037]/50 focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                  required
                />
              </div>

              {/* Rôle */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[#3E2723]">Rôle</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as Role)}
                  className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8B0000]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lier à un adhérent existant (optionnel) */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[#3E2723]">
                  Lier à un profil adhérent existant{' '}
                  <span className="text-[#5D4037] font-normal">(optionnel)</span>
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Créer un nouveau profil adhérent' },
                    ...adherentList.map((a) => ({
                      value: a.id,
                      label: `${a.first_name} ${a.last_name}`,
                    })),
                  ]}
                  value={formAdherentId}
                  onChange={setFormAdherentId}
                  placeholder="Rechercher un adhérent..."
                />
                {formAdherentId && (
                  <p className="text-xs text-[#4A5D23] italic">
                    Le compte sera lié au profil adhérent sélectionné. Aucun nouveau profil ne sera créé.
                  </p>
                )}
              </div>

              {/* Erreur */}
              {formError && (
                <div className="bg-[#C62828]/10 border border-[#C62828] rounded px-3 py-2">
                  <p className="text-xs text-[#C62828]">{formError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(''); setFormAdherentId(''); }}
                  className="bg-[#FAF3E3] border-2 border-[#5D4037] text-[#3E2723] px-5 py-2 rounded text-sm font-medium hover:bg-[#E8D5B7] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#8B0000] border-2 border-[#5D0000] text-[#FAF3E3] px-5 py-2 rounded text-sm font-medium hover:bg-[#C41E3A] transition-colors cursor-pointer disabled:opacity-50"
                  style={{ fontFamily: "'Noto Serif JP', serif" }}
                >
                  {submitting ? 'Création...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
