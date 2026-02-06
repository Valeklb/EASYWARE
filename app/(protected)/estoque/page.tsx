'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ItemRow = {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  active: boolean;
};

export default function EstoquePage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(
    null
  );

  const [items, setItems] = useState<ItemRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('TODAS');
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        window.location.href = '/login';
        return;
      }

      const { data: itemsData, error: itemsErr } = await supabase
        .from('items')
        .select('id,name,category,sku,unit,min_stock,active')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (itemsErr) throw itemsErr;

      const list = (itemsData ?? []) as ItemRow[];
      setItems(list);

      const { data: vData, error: vErr } = await supabase
        .from('v_stock')
        .select('item_id,balance');
      if (vErr) throw vErr;

      const map: Record<string, number> = {};
      (vData ?? []).forEach((r: any) => {
        map[String(r.item_id)] = Number(r.balance ?? 0);
      });
      setBalances(map);
    } catch (e: any) {
      setMsg({ text: e?.message ?? 'Erro ao carregar estoque.', type: 'err' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return ['TODAS', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return items.filter((i) => {
      if (onlyActive && !i.active) return false;
      if (cat !== 'TODAS' && i.category !== cat) return false;

      const bal = Number(balances[i.id] ?? 0);
      const below = bal < Number(i.min_stock ?? 0);
      if (onlyBelowMin && !below) return false;

      if (!s) return true;
      return `${i.category} ${i.name} ${i.sku ?? ''} ${i.unit} ${bal}`
        .toLowerCase()
        .includes(s);
    });
  }, [items, balances, q, cat, onlyBelowMin, onlyActive]);

  const totals = useMemo(() => {
    let totalItems = 0;
    let belowMin = 0;
    let totalBalance = 0;

    for (const i of filtered) {
      totalItems += 1;
      const bal = Number(balances[i.id] ?? 0);
      totalBalance += bal;
      if (bal < Number(i.min_stock ?? 0)) belowMin += 1;
    }

    return { totalItems, belowMin, totalBalance };
  }, [filtered, balances]);

  return (
    <div>      <div className="container">
        <div className="row">
          <a className="btn" href="/master">
            Master
          </a>
          <a className="btn" href="/historico">
            Histórico
          </a>

          <div className="spacer" />

          <button className="btn" onClick={loadAll} disabled={loading}>
            Atualizar
          </button>
        </div>

        <div style={{ marginTop: 12 }} className="card">
          <div className="card-inner" style={{ display: 'grid', gap: 12 }}>
            <div className="row">
              <span className="badge">
                Itens: <b style={{ marginLeft: 6 }}>{totals.totalItems}</b>
              </span>
              <span
                className={`badge ${
                  totals.belowMin > 0 ? 'badge-warn' : 'badge-ok'
                }`}
              >
                Abaixo do mínimo:{' '}
                <b style={{ marginLeft: 6 }}>{totals.belowMin}</b>
              </span>
              <span className="badge">
                Saldo total (somado):{' '}
                <b style={{ marginLeft: 6 }}>{totals.totalBalance}</b>
              </span>

              <div className="spacer" />

              <span className="small">Destaque: itens abaixo do mínimo.</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: 12,
              }}
            >
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por item, categoria ou SKU..."
              />
              <select
                className="select"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="row" style={{ gap: 16 }}>
              <label className="row" style={{ gap: 10 }}>
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                <span>Somente ativos</span>
              </label>

              <label className="row" style={{ gap: 10 }}>
                <input
                  type="checkbox"
                  checked={onlyBelowMin}
                  onChange={(e) => setOnlyBelowMin(e.target.checked)}
                />
                <span>Somente abaixo do mínimo</span>
              </label>
            </div>

            {msg && (
              <div
                className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="card">
          <div className="table-wrap">
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
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: 'var(--muted)' }}>
                      Nada encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => {
                    const bal = Number(balances[i.id] ?? 0);
                    const belowMin = bal < Number(i.min_stock ?? 0);

                    return (
                      <tr key={i.id} className={belowMin ? 'tr-warn' : ''}>
                        <td>{i.category}</td>
                        <td style={{ fontWeight: 800 }}>{i.name}</td>
                        <td>{i.sku ?? '-'}</td>
                        <td>{i.unit}</td>
                        <td>{bal}</td>
                        <td>{i.min_stock}</td>
                        <td>
                          {i.active ? (
                            <span
                              className={`badge ${
                                belowMin ? 'badge-warn' : 'badge-ok'
                              }`}
                            >
                              {belowMin ? 'Abaixo do mínimo' : 'Ativo'}
                            </span>
                          ) : (
                            <span className="badge badge-danger">Inativo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="card-inner">
            <div className="small">
              Dica: para acionar reposição, use o filtro “Somente abaixo do
              mínimo”.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
