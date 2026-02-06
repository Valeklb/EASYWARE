'use client';

export default function Topbar({ title }: { title: string }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(8px)',
        background: 'rgba(255,255,255,.85)',
        borderBottom: '1px solid rgba(0,0,0,.06)',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#0b1220',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              letterSpacing: 0.5,
            }}
          >
            CM
          </div>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Controle de Materiais</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge">Online</span>
        </div>
      </div>
    </div>
  );
}
