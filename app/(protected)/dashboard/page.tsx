'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

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

type MoveRow = {
  id: string;
  created_at: string;
  item_id: string;
  qty: number;
  move_type: string; // 'IN' | 'OUT' etc
  actor_user_id: string | null;
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

function startOfDayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

function formatDayLabel(iso: string) {
  // iso: YYYY-MM-DD...
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}

export default function DashboardPage() {
  const [role, setRole] = useState<Role>('VIEWER');
  const isMaster = role === 'MASTER';
  const isLider = role === 'LIDER';
  const canEdit = isMaster || isLider;

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);

  const [stock, setStock] = useState<StockRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);

  // debounce de refresh (evita “tempestade” de eventos realtime)
  const refreshTimer = useRef<number | null>(null);

  function toast(text: string, type: 'ok' | 'err') {
    setMsg({ text, type });
    window.setTimeout(() => setMsg(null), 3500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function refreshAll() {
    setLoading(true);
    setMsg(null);
    try {
      // 1) Estoque (preferir v_stock)
      const { data: v, error: e1 } = await supabase
        .from('v_stock')
        .select('item_id,category,name,sku,unit,min_stock,active,balance')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (e1) throw e1;
      setStock((v ?? []) as StockRow[]);

      // 2) Movimentos (últimos 14 dias)
      const from = startOfDayISO(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000));
      const { data: m, error: e2 } = await supabase
        .from('stock_moves')
        .select('id,created_at,item_id,qty,move_type,actor_user_id')
        .gte('created_at', from)
        .order('created_at', { ascending: true });

      if (e2) throw e2;
      setMoves((m ?? []) as MoveRow[]);
    } catch (e: any) {
      toast(e?.message ?? 'Erro ao carregar dashboard.', 'err');
    } finally {
      setLoading(false);
    }
  }

  function scheduleRefresh() {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshAll();
    }, 450);
  }

  // KPIs
  const kpis = useMemo(() => {
    const totalItems = stock.length;
    const activeItems = stock.filter((s) => s.active).length;
    const belowMin = stock.filter((s) => Number(s.balance || 0) < Number(s.min_stock || 0)).length;

    const totalBalance = stock.reduce((acc, s) => acc + Number(s.balance || 0), 0);

    const todayISO = startOfDayISO(new Date()).slice(0, 10);
    const movesToday = moves.filter((m) => (m.created_at || '').slice(0, 10) === todayISO).length;

    return { totalItems, activeItems, belowMin, totalBalance, movesToday };
  }, [stock, moves]);

  // Série diária de entradas/saídas
  const seriesByDay = useMemo(() => {
    // últimos 14 dias
    const map = new Map<string, { day: string; in: number; out: number }>();

    for (const m of moves) {
      const day = (m.created_at || '').slice(0, 10);
      if (!day) continue;

      if (!map.has(day)) map.set(day, { day, in: 0, out: 0 });

      const row = map.get(day)!;
      const qty = Math.abs(Number(m.qty || 0));

      // Ajuste conforme seu check constraint (IN/OUT ou ENTRY/EXIT etc)
      if (String(m.move_type).toUpperCase().includes('IN')) row.in += qty;
      else if (String(m.move_type).toUpperCase().includes('OUT')) row.out += qty;
      else {
        // fallback: se o sistema usa outros nomes, não some
      }
    }

    const arr = Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((x) => ({
        day: formatDayLabel(x.day),
        in: x.in,
        out: x.out,
      }));

    return arr;
  }, [moves]);

  // Ranking (itens mais movimentados no período)
  const ranking = useMemo(() => {
    const countByItem = new Map<string, number>();
    for (const m of moves) {
      const id = m.item_id;
      const qty = Math.abs(Number(m.qty || 0));
      countByItem.set(id, (countByItem.get(id) ?? 0) + qty);
    }

    const nameById = new Map(stock.map((s) => [s.item_id, `${s.category} — ${s.name}`] as const));

    return Array.from(countByItem.entries())
      .map(([item_id, qty]) => ({
        item_id,
        name: nameById.get(item_id) ?? item_id,
        qty,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [moves, stock]);

  // Guard + Role + Realtime
  useEffect(() => {
    (async () => {
      const uid = await getUid();
      if (!uid) {
        window.location.href = '/login';
        return;
      }

      const r = await getMyRole();
      setRole(r);

      await refreshAll();

      // Realtime: escuta mudanças e atualiza dashboard
      const channel = supabase
        .channel('dashboard-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'stock_moves' },
          () => scheduleRefresh()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          () => scheduleRefresh()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>        {/* Conteúdo */}
        <main style={{ marginRight: 16, marginTop: 12, display: 'grid', gap: 16 }}>
          {msg && (
            <div className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>
              {msg.text}
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <div className="card"><div className="card-inner">
              <div className="small">Itens (total)</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{kpis.totalItems}</div>
              <div className="small">Ativos: {kpis.activeItems}</div>
            </div></div>

            <div className="card"><div className="card-inner">
              <div className="small">Abaixo do mínimo</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{kpis.belowMin}</div>
              <div className="small">Requer atenção</div>
            </div></div>

            <div className="card"><div className="card-inner">
              <div className="small">Movimentações hoje</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{kpis.movesToday}</div>
              <div className="small">Entradas + Saídas</div>
            </div></div>

            <div className="card"><div className="card-inner">
              <div className="small">Saldo total (soma)</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{kpis.totalBalance}</div>
              <div className="small">Unidades (geral)</div>
            </div></div>
          </div>

          {/* Gráficos + ranking */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card">
              <div className="card-inner" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Movimentações (últimos dias)</div>
                  <div className="small" style={{ opacity: 0.7 }}>Entradas x Saídas</div>
                </div>

                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={seriesByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="in" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="out" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="small" style={{ opacity: 0.75 }}>
                  Atualiza sozinho quando alguém registra entrada/saída.
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-inner" style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Top itens (movimentação)</div>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ranking}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="item_id" hide />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="qty" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="small" style={{ opacity: 0.8 }}>
                  {ranking.map((r) => (
                    <div key={r.item_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      <b>{r.qty}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Atalhos / avisos */}
          <div className="card">
            <div className="card-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Ações rápidas</div>
                <div className="small" style={{ opacity: 0.75 }}>
                  Para operar: use Entrada/Saída no mobile. Para cadastrar: use Master.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <a className="btn btn-primary" href="/mobile">Entrada (mobile)</a>
                <a className="btn btn-primary" href="/mobile/saida">Saída (mobile)</a>
                <a className="btn" href="/estoque">Ver estoque</a>
                <a className="btn" href="/historico">Histórico</a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
