import type { Metadata } from 'next';
import './globals.css';
const title = 'MORRIS｜ナインメンズモリス・オンライン対戦';
const description =
  '3つ並べて、相手の駒を取る。2人で遊ぶボードゲーム「ナインメンズモリス」。招待URLから同じ対戦室に参加でき、何人でも観戦できます。';
export const metadata: Metadata = {
  title,
  icons: { icon: '/favicon.svg' },
  description,
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'MORRIS',
    title,
    description,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
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
