import './globals.css';

export const metadata = {
  title: 'Easyware',
  description: 'Controle de Materiais — Easyware',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
