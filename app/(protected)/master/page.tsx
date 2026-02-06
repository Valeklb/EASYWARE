'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

type StockRow = {
  item_id: string;
  category: string;
  name: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  active: boolean;
  balance: number;
};

type ItemUpsert = {
  id?: string;
  category: string;
  name: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  active: boolean;
};

async function getUid(): Promise<string | null> {
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

export default function MasterPage() {
  const [role, setRole] = useState<Role>('VIEWER');
  const isMaster = role === 'MASTER';

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(
    null
  );

  const [rows, setRows] = useState<StockRow[]>([]);
  const [q, setQ] = useState('');

  // modal create/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ItemUpsert | null>(null);

  const [form, setForm] = useState<ItemUpsert>({
    category: '',
    name: '',
    sku: null,
    unit: 'UNIDADE',
    min_stock: 0,
    active: true,
  });

  function toast(text: string, type: 'ok' | 'err') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  }

  async function refresh() {
    setLoading(true);
    setMsg(null);

    try {
      // Preferir a view v_stock (tem saldo pronto)
      const { data, error } = await supabase
        .from('v_stock')
        .select('item_id,category,name,sku,unit,min_stock,active,balance')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (!error) {
        setRows((data ?? []) as StockRow[]);
        return;
      }

      // Fallback: se v_stock não existir, pega items (saldo = 0)
      const { data: items, error: e2 } = await supabase
        .from('items')
        .select('id,category,name,sku,unit,min_stock,active')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (e2) throw e2;

      const fallback = (items ?? []).map((i: any) => ({
        item_id: i.id,
        category: i.category,
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        min_stock: i.min_stock,
        active: i.active,
        balance: 0,
      })) as StockRow[];

      setRows(fallback);
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao carregar dados.', 'err');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.category} ${r.name} ${r.sku ?? ''}`.toLowerCase().includes(s)
    );
  }, [rows, q]);

  function openNew() {
    if (!isMaster) return toast('Apenas MASTER pode criar item.', 'err');
    setEditing(null);
    setForm({
      category: '',
      name: '',
      sku: null,
      unit: 'UNIDADE',
      min_stock: 0,
      active: true,
    });
    setOpen(true);
  }

  function openEdit(r: StockRow) {
    if (!isMaster) return toast('Apenas MASTER pode editar item.', 'err');
    setEditing({
      id: r.item_id,
      category: r.category,
      name: r.name,
      sku: r.sku ?? null,
      unit: r.unit,
      min_stock: Number(r.min_stock || 0),
      active: !!r.active,
    });
    setForm({
      id: r.item_id,
      category: r.category,
      name: r.name,
      sku: r.sku ?? null,
      unit: r.unit,
      min_stock: Number(r.min_stock || 0),
      active: !!r.active,
    });
    setOpen(true);
  }

  async function saveItem() {
    if (!isMaster) return toast('Apenas MASTER pode salvar.', 'err');

    const category = form.category.trim();
    const name = form.name.trim();
    const unit = form.unit.trim();

    if (!category) return toast('Categoria é obrigatória.', 'err');
    if (!name) return toast('Item é obrigatório.', 'err');
    if (!unit) return toast('Unidade é obrigatória.', 'err');

    setLoading(true);
    try {
      const payload: any = {
        category,
        name,
        sku: form.sku?.trim() ? form.sku.trim() : null,
        unit,
        min_stock: Math.max(0, Math.trunc(Number(form.min_stock || 0))),
        active: !!form.active,
      };

      if (editing?.id) payload.id = editing.id;

      const { error } = await supabase
        .from('items')
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

  /**
   * Excluir item:
   * - tenta DELETE em items
   * - se falhar por histórico/FK, faz soft delete (active=false)
   */
  async function deleteItem(r: StockRow) {
    if (!isMaster) return toast('Apenas MASTER pode excluir.', 'err');

    const ok = window.confirm(
      `Excluir o item:\n\n${r.category} — ${r.name}\n\n` +
        `Se existir histórico de movimentos, o sistema vai DESATIVAR ao invés de excluir.\n\nContinuar?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      // tenta apagar de verdade
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', r.item_id);

      if (!error) {
        toast('Item excluído ✅', 'ok');
        await refresh();
        return;
      }

      // fallback: desativar
      const { error: e2 } = await supabase
        .from('items')
        .update({ active: false })
        .eq('id', r.item_id);
      if (e2) throw e2;

      toast('Item não pôde ser excluído (histórico). Foi DESATIVADO ✅', 'ok');
      await refresh();
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao excluir/desativar.', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const uid = await getUid();
      if (!uid) {
        window.location.href = '/login';
        return;
      }
      const r = await getMyRole();
      setRole(r);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>      {/* Layout: Sidebar + Conteúdo */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}
      >
        {/* Sidebar */}
        <aside
          className="card"
          style={{
            marginLeft: 16,
            marginTop: 12,
            height: 'calc(100vh - 120px)',
            position: 'sticky',
            top: 84,
            alignSelf: 'start',
          }}
        >
          <div className="card-inner" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${isMaster ? 'badge-ok' : 'badge-warn'}`}>
                Acesso: {role}
              </span>
              <span className="badge">Itens: {rows.length}</span>
            </div>

            <a className="btn" href="/estoque">
              Ver estoque
            </a>
            <a className="btn" href="/historico">
              Histórico
            </a>
            <a className="btn" href="/mobile">
              Entrada (mobile)
            </a>
            <a className="btn" href="/mobile/saida">
              Saída (mobile)
            </a>
            <a className="btn" href="/collaboradores">
              Colaboradores
            </a>

            <div
              style={{
                height: 1,
                background: 'rgba(0,0,0,0.06)',
                margin: '6px 0',
              }}
            />

            <button
              className="btn btn-primary"
              onClick={openNew}
              disabled={!isMaster || loading}
            >
              + Novo item
            </button>

            <button className="btn" onClick={refresh} disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>

            <div className="small" style={{ marginTop: 8, opacity: 0.8 }}>
              Dica: editar item não altera saldo diretamente; saldo muda via
              movimentos em <b>stock_moves</b>.
            </div>
          </div>
        </aside>

        {/* Conteúdo */}
        <main style={{ marginRight: 16, marginTop: 12 }}>
          <div className="card">
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
                  placeholder="Buscar por item, categoria, SKU..."
                />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Un</th>
                      <th>Saldo</th>
                      <th>Mín</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="small">
                          Nada encontrado.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => {
                        const belowMin =
                          Number(r.balance || 0) < Number(r.min_stock || 0);
                        return (
                          <tr
                            key={r.item_id}
                            style={
                              belowMin
                                ? { background: 'rgba(255, 210, 0, 0.12)' }
                                : undefined
                            }
                          >
                            <td>{r.category}</td>
                            <td style={{ fontWeight: 900 }}>{r.name}</td>
                            <td>{r.sku ?? '-'}</td>
                            <td>{r.unit}</td>
                            <td>{Number(r.balance || 0)}</td>
                            <td>{Number(r.min_stock || 0)}</td>
                            <td>
                              <span
                                className={`badge ${
                                  r.active ? 'badge-ok' : 'badge-warn'
                                }`}
                              >
                                {r.active ? 'Ativo' : 'Inativo'}
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
                                onClick={() => openEdit(r)}
                                disabled={!isMaster || loading}
                              >
                                Editar
                              </button>
                              <button
                                className="btn"
                                onClick={() => deleteItem(r)}
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
                        );
                      })
                    )}
                  </tbody>
                </table>

                <div className="small" style={{ marginTop: 10 }}>
                  Linhas em destaque: saldo abaixo do mínimo.
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal */}
      {open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <div style={{ fontWeight: 900 }}>
                {editing ? 'Editar item' : 'Novo item'}
              </div>
              <button className="btn" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div className="label">Categoria</div>
                  <input
                    className="input"
                    value={form.category}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, category: e.target.value }))
                    }
                    placeholder="Ex.: Fardamentos / EPI / Escritório"
                  />
                </div>

                <div>
                  <div className="label">SKU (opcional)</div>
                  <input
                    className="input"
                    value={form.sku ?? ''}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, sku: e.target.value || null }))
                    }
                    placeholder="Ex.: CA-12345"
                  />
                </div>
              </div>

              <div>
                <div className="label">Item</div>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Ex.: Calça N° 38"
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                <div>
                  <div className="label">Unidade</div>
                  <select
                    className="select"
                    value={form.unit}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, unit: e.target.value }))
                    }
                  >
                    <option value="UNIDADE">UNIDADE</option>
                    <option value="CAIXA">CAIXA</option>
                    <option value="PACOTE">PACOTE</option>
                  </select>
                </div>

                <div>
                  <div className="label">Saldo mínimo</div>
                  <input
                    className="input"
                    type="number"
                    value={form.min_stock}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        min_stock: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <div className="label">Status</div>
                  <select
                    className="select"
                    value={form.active ? '1' : '0'}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, active: e.target.value === '1' }))
                    }
                  >
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="row" style={{ marginTop: 8 }}>
                <div className="spacer" />
                <button
                  className="btn btn-primary"
                  onClick={saveItem}
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              <div className="small" style={{ opacity: 0.85 }}>
                Observação: o saldo aparece no estoque pela view <b>v_stock</b>{' '}
                (ou cálculo por movimentos).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
