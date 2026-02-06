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

type Collaborator = {
  id: string;
  name: string;
  sector: string | null;
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

async function insertMoveOutAuto(params: {
  item_id: string;
  qty: number;
  note?: string | null;
  created_by: string;
  receiver_id: string;
}) {
  const candidates = [
    { move_type: 'OUT' },
    { move_type: 'SAIDA' },
    { move_type: 'OUTPUT' },
    { move_type: 'OUTBOUND' },
    { move_type: 'EXIT' },
  ] as const;

  let lastErr: any = null;

  for (const c of candidates) {
    const { error } = await supabase.from('stock_moves').insert({
      item_id: params.item_id,
      qty: params.qty,
      note: params.note ?? null,
      created_by: params.created_by,
      receiver_id: params.receiver_id,
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

export default function MobileSaidaPage() {
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

  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [cQ, setCQ] = useState('');
  const [receiverId, setReceiverId] = useState<string>('');

  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState<string>('');

  const [balance, setBalance] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) =>
      `${i.category} ${i.name} ${i.sku ?? ''}`.toLowerCase().includes(s)
    );
  }, [items, q]);

  const filteredCollabs = useMemo(() => {
    const s = cQ.trim().toLowerCase();
    const base = collabs.filter((c) => c.active);
    if (!s) return base;
    return base.filter((c) =>
      `${c.name} ${c.sector ?? ''}`.toLowerCase().includes(s)
    );
  }, [collabs, cQ]);

  async function loadItems() {
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
  }

  async function loadCollabs() {
    const { data, error } = await supabase
      .from('collaborators')
      .select('id,name,sector,active')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    const list = (data ?? []) as Collaborator[];
    setCollabs(list);
    if (!receiverId && list.length) setReceiverId(list[0].id);
  }

  async function loadBalance(itemId: string) {
    setBalance(null);

    // tenta pela view
    const v = await supabase
      .from('v_stock')
      .select('item_id,balance')
      .eq('item_id', itemId)
      .maybeSingle();
    if (!v.error && v.data) {
      setBalance(Number((v.data as any).balance ?? 0));
      return;
    }

    // fallback: se não tiver view, fica nulo (não bloqueia)
    setBalance(null);
  }

  async function bootstrap() {
    setLoading(true);
    setMsg(null);
    try {
      await Promise.all([loadItems(), loadCollabs()]);
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Erro ao carregar listas.', type: 'err' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) loadBalance(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function registerSaida() {
    setMsg(null);

    const canSubmit = role === 'MASTER' || role === 'LIDER';
    if (!canSubmit)
      return setMsg({
        text: 'Sem permissão: apenas LÍDER ou MASTER registra saída.',
        type: 'err',
      });

    if (!selectedId) return setMsg({ text: 'Selecione um item.', type: 'err' });
    if (!receiverId)
      return setMsg({
        text: 'Selecione o colaborador (Entregue para).',
        type: 'err',
      });

    const uid = await getUid();
    if (!uid)
      return setMsg({
        text: 'Sessão inválida. Faça login novamente.',
        type: 'err',
      });

    const nQty = Math.trunc(Number(qty || 0));
    if (nQty <= 0) return setMsg({ text: 'Quantidade inválida.', type: 'err' });

    // BLOQUEIO: não pode ficar negativo (se balance conhecido)
    if (balance !== null && nQty > balance) {
      return setMsg({
        text: `Saldo insuficiente. Saldo atual: ${balance}. Você tentou retirar: ${nQty}.`,
        type: 'err',
      });
    }

    setLoading(true);
    try {
      const res = await insertMoveOutAuto({
        item_id: selectedId,
        qty: nQty,
        note: note.trim() || null,
        created_by: uid,
        receiver_id: receiverId,
      });

      if (!res.ok) throw res.error;

      setMsg({ text: 'Saída registrada ✅', type: 'ok' });
      setQty(1);
      setNote('');
      await loadBalance(selectedId);
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Erro ao registrar saída.', type: 'err' });
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
      await bootstrap();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = role === 'MASTER' || role === 'LIDER';

  return (
    <div>      <div className="container" style={{ maxWidth: 920 }}>
        <div className="row">
          <a className="btn" href="/master">
            Voltar Master
          </a>
          <a className="btn" href="/mobile">
            Ir para Entrada (Master)
          </a>
          <a className="btn" href="/estoque">
            Ver Estoque
          </a>
          <div className="spacer" />
          <span className={`badge ${canSubmit ? 'badge-ok' : 'badge-warn'}`}>
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
                {filteredItems.map((i) => (
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
                    {' • '}
                    Saldo atual: <b>{balance === null ? '—' : balance}</b>
                  </div>
                </div>
              )}
            </div>

            <div className="hr" />

            <div>
              <div className="label">Buscar colaborador</div>
              <input
                className="input"
                value={cQ}
                onChange={(e) => setCQ(e.target.value)}
                placeholder="Nome / setor..."
              />
            </div>

            <div>
              <div className="label">Entregue para</div>
              <select
                className="select"
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
              >
                {filteredCollabs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.sector ? ` — ${c.sector}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: 12,
              }}
            >
              <div>
                <div className="label">Quantidade (saída)</div>
                <input
                  className="input"
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
                {balance !== null && qty > balance && (
                  <div
                    className="small"
                    style={{ color: 'crimson', marginTop: 6 }}
                  >
                    Quantidade maior que o saldo ({balance}).
                  </div>
                )}
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
              <button className="btn" onClick={bootstrap} disabled={loading}>
                Atualizar listas
              </button>
              <div className="spacer" />
              <button
                className="btn btn-primary"
                onClick={registerSaida}
                disabled={loading || !canSubmit}
              >
                {loading ? 'Registrando...' : 'Registrar saída'}
              </button>
            </div>

            <div className="small">
              Regra: não permite saída que deixe o saldo negativo (quando o
              saldo está disponível).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
