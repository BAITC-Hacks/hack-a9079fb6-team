import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 rx=%228%22 fill=%22%23c14420%22/%3E%3Ctext x=%2220%22 y=%2232%22 text-anchor=%22middle%22 font-family=%22Georgia%22 font-size=%2238%22 font-style=%22italic%22 fill=%22white%22%3Ef%3C/text%3E%3C/svg%3E' },
  title: 'Firebird — подрядчики под ваше событие',
  description: 'До трёх подрядчиков с объяснением выбора по дате, бюджету и формату события.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
