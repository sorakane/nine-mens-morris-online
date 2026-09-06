import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'MORRIS — オンライン対戦室',
  icons: { icon: '/favicon.svg' },
  description:
    'ナインメンズモリスをオンラインで対戦。対戦者2人に加え、観戦者は何人でも参加できて、同じURLで盤面を共有できます。',
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
