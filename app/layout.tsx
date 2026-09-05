import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MORRIS — オンライン対戦室',
  icons: { icon: '/favicon.svg' },
  description:
    'ナインメンズモリスをオンラインで対戦。2人対戦と観戦席ありを選べて、同じURLで盤面を共有できます。',
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
