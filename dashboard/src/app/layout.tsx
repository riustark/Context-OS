import './globals.css';
import React from 'react';
import { Inter } from 'next/font/google';
import Navigation from './components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'ContextOS Dashboard | LLM Observability',
  description: 'Production LLM Runtime Observability Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="text-slate-900 min-h-screen bg-slate-50/50 antialiased selection:bg-indigo-500 selection:text-white">
        <Navigation />
        <main className="p-6 sm:p-8 max-w-7xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
