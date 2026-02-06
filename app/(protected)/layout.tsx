'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/_ui/AppShell';
import { supabase } from '@/lib/supabaseClient';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

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

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('VIEWER');
  const [title, setTitle] = useState('Dashboard');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.replace('/login');
        return;
      }
      const r = await getMyRole();
      setRole(r);
      setReady(true);
    })();
  }, []);

  // title by pathname (simple)
  useEffect(() => {
    const p = window.location.pathname || '/dashboard';
    const t =
      p === '/dashboard' ? 'Dashboard' :
      p.startsWith('/master') ? 'Master • Itens & Configuração' :
      p.startsWith('/estoque') ? 'Estoque (visualização)' :
      p.startsWith('/historico') ? 'Histórico' :
      p.startsWith('/mobile/saida') ? 'Saída (mobile)' :
      p.startsWith('/mobile') ? 'Entrada (mobile)' :
      p.startsWith('/collaboradores') ? 'Colaboradores' :
      p.startsWith('/ranking') ? 'Ranking' :
      'Easyware';
    setTitle(t);
  }, [ready]);

  if (!ready) return null;

  return <AppShell title={title} role={role}>{children}</AppShell>;
}
