'use client';

import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const links: Array<{ href: string; label: string }> = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/master', label: 'Master' },
    { href: '/estoque', label: 'Ver estoque' },
    { href: '/historico', label: 'Histórico' },
    { href: '/mobile', label: 'Entrada (mobile)' },
    { href: '/mobile/saida', label: 'Saída (mobile)' },
    { href: '/collaboradores', label: 'Colaboradores' },
    { href: '/ranking', label: 'Ranking' },
  ];

  async function onLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <aside
      className="card"
      style={{
        width: 280,
        marginLeft: 16,
        marginTop: 12,
        height: 'calc(100vh - 120px)',
        position: 'sticky',
        top: 84,
        alignSelf: 'start',
      }}
    >
      <div className="card-inner" style={{ display: 'grid', gap: 10, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${role === 'MASTER' ? 'badge-ok' : role === 'LIDER' ? 'badge-warn' : ''}`}>
            Acesso: {role}
          </span>
          <span className="badge">Online</span>
        </div>

        <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== '/dashboard' && pathname?.startsWith(l.href));
            return (
              <a
                key={l.href}
                href={l.href}
                className="btn"
                style={{
                  justifyContent: 'center',
                  borderColor: active ? 'rgba(40,120,255,.45)' : undefined,
                  boxShadow: active ? '0 0 0 3px rgba(40,120,255,.10)' : undefined,
                }}
              >
                {l.label}
              </a>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <button
          className="btn"
          onClick={onLogout}
          style={{ borderColor: 'rgba(220,0,0,.25)', color: 'crimson', marginTop: 8 }}
        >
          Sair (logout)
        </button>

        <div className="small" style={{ opacity: 0.75 }}>
          Dica: a barra lateral fica fixa — só o conteúdo ao lado muda.
        </div>
      </div>
    </aside>
  );
}
