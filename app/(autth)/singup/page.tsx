'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Se já estiver logado, manda para login (que redireciona por role)
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) window.location.href = '/login';
    })();
  }, []);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (error) throw error;

      setMsg(
        'Conta criada. Agora vá para o login. (Se o Supabase exigir confirmação por e-mail, confirme no seu e-mail.)'
      );
      setFullName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setMsg(err?.message ?? 'Erro ao criar conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Criar conta</h2>

        <form onSubmit={onSignup} style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Nome (opcional)</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex.: João Silva"
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ccc',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>E-mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ccc',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Senha</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              style={{
                padding: 10,
                borderRadius: 10,
                border: '1px solid #ccc',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid #333',
              cursor: 'pointer',
            }}
          >
            {busy ? 'Criando...' : 'Criar conta'}
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = '/login')}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: 'white',
            }}
          >
            Voltar para Login
          </button>

          {msg && (
            <div
              style={{
                color: msg.toLowerCase().includes('erro') ? 'crimson' : 'green',
              }}
            >
              {msg}
            </div>
          )}
        </form>

        <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>
          Dica: o MASTER libera acessos por e-mail na tela “Usuários”. O role é
          aplicado automaticamente no primeiro cadastro.
        </div>
      </div>
    </div>
  );
}
