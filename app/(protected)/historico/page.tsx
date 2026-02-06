'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Move = {
  id: string;
  created_at: string;
  item_name: string;
  category: string;
  unit: string;
  qty: number;
  type: string;
  receiver: string;
  actor: string;
  note: string;
};

function downloadCSV(rows: Move[]) {
  if (!rows.length) return;

  const header = [
    'Data',
    'Tipo',
    'Categoria',
    'Item',
    'Quantidade',
    'Unidade',
    'Entregue para',
    'Lançado por',
    'Observação',
  ];

  const csv = [
    header.join(';'),
    ...rows.map((r) =>
      [
        r.created_at,
        r.type,
        r.category,
        r.item_name,
        r.qty,
        r.unit,
        r.receiver,
        r.actor,
        r.note ?? '',
      ].join(';')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoricoPage() {
  const [rows, setRows] = useState<Move[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);

    const { data } = await supabase.rpc('v_historico_completo');
    setRows((data ?? []) as Move[]);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>      <div className="container">
        <div className="row">
          <button className="btn" onClick={load} disabled={loading}>
            Atualizar
          </button>

          <div className="spacer" />

          <button
            className="btn btn-primary"
            onClick={() => downloadCSV(rows)}
            disabled={!rows.length}
          >
            Exportar CSV
          </button>
        </div>

        <div style={{ marginTop: 12 }} className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Un</th>
                  <th>Entregue para</th>
                  <th>Lançado por</th>
                  <th>Obs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.type}</td>
                    <td>{r.category}</td>
                    <td>{r.item_name}</td>
                    <td>{r.qty}</td>
                    <td>{r.unit}</td>
                    <td>{r.receiver}</td>
                    <td>{r.actor}</td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!rows.length && (
              <div className="small" style={{ padding: 16 }}>
                Nenhum registro encontrado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
