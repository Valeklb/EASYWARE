'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

type Collaborator = {
  id: string;
  name: string;
  sector: string | null;
  active: boolean;
  created_at?: string;
};

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function getMyRole(): Promise<Role> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return 'VIEWER';

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  return ((profile?.role as Role) ?? 'VIEWER') as Role;
}

export default function ColaboradoresPage() {
  const [role, setRole] = useState<Role>('VIEWER');
  const isMaster = role === 'MASTER';

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(
    null
  );

  const [list, setList] = useState<Collaborator[]>([]);
  const [q, setQ] = useState('');

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Collaborator | null>(null);

  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [active, setActive] = useState(true);

  function toast(text: string, type: 'ok' | 'err') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  }

  async function refresh() {
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select('id,name,sector,active,created_at')
        .order('active', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setList((data ?? []) as Collaborator[]);
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao carregar colaboradores.', 'err');
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    if (!isMaster) return toast('Apenas MASTER pode cadastrar.', 'err');
    setEdit(null);
    setName('');
    setSector('');
    setActive(true);
    setOpen(true);
  }

  function openEdit(c: Collaborator) {
    if (!isMaster) return toast('Apenas MASTER pode editar.', 'err');
    setEdit(c);
    setName(c.name ?? '');
    setSector(c.sector ?? '');
    setActive(!!c.active);
    setOpen(true);
  }

  async function save() {
    if (!isMaster) return toast('Apenas MASTER pode salvar.', 'err');

    const n = name.trim();
    if (!n) return toast('Nome é obrigatório.', 'err');

    setLoading(true);
    try {
      const payload: any = {
        name: n,
        sector: sector.trim() || null,
        active: !!active,
      };
      if (edit?.id) payload.id = edit.id;

      const { error } = await supabase
        .from('collaborators')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      toast('Salvo ✅', 'ok');
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao salvar.', 'err');
    } finally {
      setLoading(false);
    }
  }

  async function remove(c: Collaborator) {
    if (!isMaster) return toast('Apenas MASTER pode excluir.', 'err');

    const ok = window.confirm(
      `Excluir colaborador?\n\n${c.name}\n\nSe tiver histórico, recomendo desativar ao invés de excluir.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', c.id);
      if (!error) {
        toast('Excluído ✅', 'ok');
        await refresh();
        return;
      }

      // fallback: desativar
      const { error: e2 } = await supabase
        .from('collaborators')
        .update({ active: false })
        .eq('id', c.id);
      if (e2) throw e2;

      toast('Não pôde excluir (histórico). Foi DESATIVADO ✅', 'ok');
      await refresh();
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao excluir/desativar.', 'err');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((c) =>
      `${c.name} ${c.sector ?? ''}`.toLowerCase().includes(s)
    );
  }, [list, q]);

  useEffect(() => {
    (async () => {
      const uid = await getUid();
      if (!uid) {
        window.location.href = '/login';
        return;
      }
      const r = await getMyRole();
      setRole(r);

      if (r !== 'MASTER') {
        window.location.href = '/estoque';
        return;
      }

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>      <div className="container">
        <div className="row">
          <a className="btn" href="/master">
            Master
          </a>
          <a className="btn" href="/estoque">
            Estoque
          </a>
          <a className="btn" href="/historico">
            Histórico
          </a>

          <div className="spacer" />

          <button className="btn" onClick={refresh} disabled={loading}>
            Atualizar
          </button>
          <button
            className="btn btn-primary"
            onClick={openNew}
            disabled={!isMaster || loading}
          >
            + Novo colaborador
          </button>
        </div>

        <div style={{ marginTop: 12 }} className="card">
          <div className="card-inner" style={{ display: 'grid', gap: 12 }}>
            {msg && (
              <div
                className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}
              >
                {msg.text}
              </div>
            )}

            <div>
              <div className="label">Buscar</div>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome / setor..."
              />
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Setor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="small">
                        Nenhum colaborador.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 900 }}>{c.name}</td>
                        <td>{c.sector ?? '-'}</td>
                        <td>
                          <span
                            className={`badge ${
                              c.active ? 'badge-ok' : 'badge-warn'
                            }`}
                          >
                            {c.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 8,
                          }}
                        >
                          <button
                            className="btn"
                            onClick={() => openEdit(c)}
                            disabled={!isMaster || loading}
                          >
                            Editar
                          </button>
                          <button
                            className="btn"
                            onClick={() => remove(c)}
                            disabled={!isMaster || loading}
                            style={{
                              borderColor: 'rgba(220,0,0,.25)',
                              color: 'crimson',
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="small">
              Dica: se um colaborador saiu da empresa, use <b>Inativo</b> (não
              apaga histórico).
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="modal-backdrop"
          onClick={() => !loading && setOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div style={{ fontWeight: 900 }}>
                {edit ? 'Editar colaborador' : 'Novo colaborador'}
              </div>
              <div className="spacer" />
              <button
                className="btn"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Fechar
              </button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div>
                <div className="label">Nome</div>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: João Silva"
                />
              </div>

              <div>
                <div className="label">Setor (opcional)</div>
                <input
                  className="input"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="Ex.: Produção / Logística"
                />
              </div>

              <label className="row" style={{ gap: 10 }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>Ativo</span>
              </label>

              <div className="row">
                <div className="spacer" />
                <button
                  className="btn btn-primary"
                  onClick={save}
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
