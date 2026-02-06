'use client';

import Topbar from './Topbar';
import Sidebar from './Sidebar';

type Role = 'MASTER' | 'LIDER' | 'VIEWER';

export default function AppShell({
  title,
  role,
  children,
}: {
  title: string;
  role: Role;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Topbar title={title} />
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <Sidebar role={role} />
          <main style={{ marginRight: 16, marginTop: 12 }}>{children}</main>
        </div>
      </div>
    </div>
  );
}
