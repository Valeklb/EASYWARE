'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../_ui/Topbar';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

type Invite = {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  used_at: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

async function requireMaster() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    window.location.href = '/login';
    return;
  }
  const { data: p } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', u.user.id)
    .maybeSingle();
  const role = (p?.role ?? 'VIEWER') as Role;
  if (role !== 'MASTER') window.location.href = '/estoque';
}

export default function UsuariosPage() {
  const [tab, setTab] = useState<'convites' | 'usuarios'>('convites');

  const [invites, setInvites] = useState<Invite[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('VIEWER');

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadInvites() {
    const { data, error } = await supabase
      .from('user_invites')
      .select('id,email,role,created_at,used_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setInvites((data ?? []) as any);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id,full_name,role,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setProfiles((data ?? []) as any);
  }

  async function loadAll() {
    setMsg(null);
    try {
      await Promise.all([loadInvites(), loadProfiles()]);
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro ao carregar dados.');
    }
  }

  useEffect(() => {
    (async () => {
      await requireMaster();
      await loadAll();
    })();
  }, []);

  const usedCount = useMemo(
    () => invites.filter((i) => !!i.used_at).length,
    [invites]
  );

  async function addInvite() {
    setMsg(null);
    const email = newEmail.trim().toLowerCase();
    if (!email.includes('@')) return setMsg('Informe um e-mail válido.');

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Sessão inválida. Faça login novamente.');

      const { error } = await supabase.from('user_invites').insert({
        email,
        role: newRole,
        created_by: u.user.id,
      });

      if (error) throw error;

      setNewEmail('');
      setNewRole('VIEWER');
      setMsg(
        'Convite criado. O usuário deve criar conta em /signup com esse e-mail.'
      );
      await loadInvites();
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro ao criar convite.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvite(id: string) {
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from('user_invites')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadInvites();
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro ao excluir convite.');
    } finally {
      setBusy(false);
    }
  }

  async function updateUserRole(userId: string, role: Role) {
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('user_id', userId);
      if (error) throw error;
      setMsg('Role atualizado.');
      await loadProfiles();
    } catch (e: any) {
      setMsg(e?.message ?? 'Erro ao atualizar role.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Topbar title="Master • Usuários" />

      <div style={{ padding: 12, display: 'grid', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setTab('convites')}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #333',
              cursor: 'pointer',
              background: tab === 'convites' ? '#f2f2f2' : 'white',
            }}
          >
            Convites
          </button>

          <button
            onClick={() => setTab('usuarios')}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #333',
              cursor: 'pointer',
              background: tab === 'usuarios' ? '#f2f2f2' : 'white',
            }}
          >
            Usuários
          </button>

          <button
            onClick={loadAll}
            disabled={busy}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #333',
              cursor: 'pointer',
            }}
          >
            Atualizar
          </button>

          <div style={{ fontSize: 12, color: '#666' }}>
            Convites: {invites.length} • Usados: {usedCount}
          </div>
        </div>

        {msg && (
          <div
            style={{
              color: msg.toLowerCase().includes('erro') ? 'crimson' : 'green',
            }}
          >
            {msg}
          </div>
        )}

        {tab === 'convites' && (
          <section
            style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}
          >
            <h3 style={{ marginTop: 0 }}>Criar convite (email + role)</h3>

            <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>E-mail</span>
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ex.: lider@empresa.com"
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #ccc',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span>Role</span>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid #ccc',
                  }}
                >
                  <option value="VIEWER">VIEWER</option>
                  <option value="LIDER">LIDER</option>
                  <option value="MASTER">MASTER</option>
                </select>
              </label>

              <button
                onClick={addInvite}
                disabled={busy}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #333',
                  cursor: 'pointer',
                  width: 220,
                }}
              >
                {busy ? 'Salvando...' : 'Criar convite'}
              </button>

              <div style={{ fontSize: 12, color: '#666' }}>
                O usuário cria a conta em <strong>/signup</strong>. O role é
                aplicado automaticamente via trigger.
              </div>
            </div>

            <h3 style={{ marginTop: 18 }}>Lista de convites</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      E-mail
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Role
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Criado
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Usado
                    </th>
                    <th style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {i.email}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {i.role}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {new Date(i.created_at).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {i.used_at ? new Date(i.used_at).toLocaleString() : '-'}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <button
                          onClick={() => deleteInvite(i.id)}
                          disabled={busy}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 10,
                            border: '1px solid #999',
                            cursor: 'pointer',
                            background: 'white',
                          }}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invites.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 12, color: '#666' }}>
                        Nenhum convite.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'usuarios' && (
          <section
            style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}
          >
            <h3 style={{ marginTop: 0 }}>Usuários cadastrados</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Nome
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      User ID
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Role
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: 10,
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Criado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.user_id}>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {p.full_name ?? '-'}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                          fontSize: 12,
                        }}
                      >
                        {p.user_id}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <select
                          value={p.role}
                          disabled={busy}
                          onChange={(e) =>
                            updateUserRole(p.user_id, e.target.value as Role)
                          }
                          style={{
                            padding: 6,
                            borderRadius: 10,
                            border: '1px solid #ccc',
                          }}
                        >
                          <option value="VIEWER">VIEWER</option>
                          <option value="LIDER">LIDER</option>
                          <option value="MASTER">MASTER</option>
                        </select>
                      </td>
                      <td
                        style={{
                          padding: 10,
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, color: '#666' }}>
                        Nenhum usuário ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
              Observação: o role aqui altera permissões imediatamente (RLS).
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
