'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

type ItemRow = {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  active: boolean;
};

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

async function getUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function insertMoveInAuto(params: {
  item_id: string;
  qty: number;
  note?: string | null;
  created_by: string;
}) {
  const candidates = [
    { move_type: 'IN' },
    { move_type: 'ENTRADA' },
    { move_type: 'INPUT' },
    { move_type: 'INBOUND' },
    { move_type: 'ENTRY' },
  ] as const;

  let lastErr: any = null;

  for (const c of candidates) {
    const { error } = await supabase.from('stock_moves').insert({
      item_id: params.item_id,
      qty: params.qty,
      note: params.note ?? null,
      created_by: params.created_by,
      move_type: (c as any).move_type,
    });

    if (!error)
      return { ok: true as const, used: (c as any).move_type as string };
    lastErr = error;

    const msg = String(error.message || '');
    if (!msg.includes('check constraint') && !msg.includes('violates')) break;
  }

  return { ok: false as const, error: lastErr };
}

export default function MobileEntradaPage() {
  const [role, setRole] = useState<Role>('VIEWER');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(
    null
  );

  const [items, setItems] = useState<ItemRow[]>([]);
  const [q, setQ] = useState('');

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) =>
      `${i.category} ${i.name} ${i.sku ?? ''}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  async function loadItems() {
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id,name,category,sku,unit,min_stock,active')
        .eq('active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      const list = (data ?? []) as ItemRow[];
      setItems(list);

      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Erro ao carregar itens.', type: 'err' });
    } finally {
      setLoading(false);
    }
  }

  async function registerEntrada() {
    setMsg(null);

    if (role !== 'MASTER')
      return setMsg({
        text: 'Sem permissão: apenas MASTER registra entrada.',
        type: 'err',
      });
    if (!selectedId) return setMsg({ text: 'Selecione um item.', type: 'err' });

    const uid = await getUid();
    if (!uid)
      return setMsg({
        text: 'Sessão inválida. Faça login novamente.',
        type: 'err',
      });

    const nQty = Math.trunc(Number(qty || 0));
    if (nQty <= 0) return setMsg({ text: 'Quantidade inválida.', type: 'err' });

    setLoading(true);
    try {
      const res = await insertMoveInAuto({
        item_id: selectedId,
        qty: nQty,
        note: note.trim() || null,
        created_by: uid,
      });

      if (!res.ok) throw res.error;

      setMsg({ text: 'Entrada registrada ✅', type: 'ok' });
      setQty(1);
      setNote('');
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Erro ao registrar entrada.', type: 'err' });
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
      await loadItems();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>      <div className="container" style={{ maxWidth: 820 }}>
        <div className="row">
          <a className="btn" href="/master">
            Voltar Master
          </a>
          <a className="btn" href="/mobile/saida">
            Ir para Saída (Líder)
          </a>
          <a className="btn" href="/estoque">
            Ver Estoque
          </a>

          <div className="spacer" />

          <span
            className={`badge ${role === 'MASTER' ? 'badge-ok' : 'badge-warn'}`}
          >
            Perfil: {role}
          </span>
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
              <div className="label">Buscar item</div>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Digite para filtrar..."
              />
            </div>

            <div>
              <div className="label">Item</div>
              <select
                className="select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {filtered.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category} — {i.name} {i.sku ? `(${i.sku})` : ''} (
                    {i.unit})
                  </option>
                ))}
              </select>

              {selected && (
                <div style={{ marginTop: 10 }} className="msg">
                  <div style={{ fontWeight: 900 }}>{selected.name}</div>
                  <div className="small">
                    Categoria: <b>{selected.category}</b> • Unidade:{' '}
                    <b>{selected.unit}</b> • Mínimo: <b>{selected.min_stock}</b>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: 12,
              }}
            >
              <div>
                <div className="label">Quantidade (entrada)</div>
                <input
                  className="input"
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              <div>
                <div className="label">Observação</div>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="row">
              <button className="btn" onClick={loadItems} disabled={loading}>
                Atualizar itens
              </button>
              <div className="spacer" />
              <button
                className="btn btn-primary"
                onClick={registerEntrada}
                disabled={loading || role !== 'MASTER'}
              >
                {loading ? 'Registrando...' : 'Registrar entrada'}
              </button>
            </div>

            <div className="small">
              Regras: apenas <b>MASTER</b> pode registrar entrada.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
