import type { Metadata } from 'next';
import { Sora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Branch AI — inspect, fork, and compare AI reasoning trees',
  description: 'Every reasoning step is a node. Navigate, fork from any point, and diff two runs side by side.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jakarta.variable} ${mono.variable}`}>
      <body className="bg-[#0A0F14] text-[#E6EDF3] font-[family-name:var(--font-jakarta)] antialiased">
        {children}
      </body>
    </html>
  );
}
