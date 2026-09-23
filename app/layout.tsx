import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Firebird — подрядчики под ваше событие',
  description: 'До трёх подрядчиков с объяснением выбора по дате, бюджету и формату события.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
