import type { Metadata } from 'next';
import { Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './components/providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'commit. — stake it. prove it. let the chain decide.',
  description: 'Habit-stake protocol on Solana with AI-verified check-ins and on-chain accountability.',
  icons: { icon: '/commit-logo.png', shortcut: '/commit-logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${geistMono.variable} bg-amethyst-500 text-white min-h-screen antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
