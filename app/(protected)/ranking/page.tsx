'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  receiver: string;
  total: number;
};

export default function RankingPage() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const { data } = await supabase.rpc('ranking_colaboradores');
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>      <div className="container">
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Total de Itens Recebidos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 800 }}>{r.receiver}</td>
                    <td>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!rows.length && (
              <div className="small" style={{ padding: 16 }}>
                Sem dados no período.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
