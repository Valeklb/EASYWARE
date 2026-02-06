'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const has = !!data.session;
      window.location.replace(has ? '/dashboard' : '/login');
    })();
  }, []);
  return null;
}
