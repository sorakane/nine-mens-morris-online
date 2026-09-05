import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MORRIS — 3人の対戦室',
  icons: { icon: '/favicon.svg' },
  description:
    'ナインメンズモリスを2人で対戦、1人が観戦。同じURLで盤面を共有し、対局ごとに交代。',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
