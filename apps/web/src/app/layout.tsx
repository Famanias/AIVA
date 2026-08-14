import { syne, inter, mono } from './fonts';
import './globals.css';
import { Toaster } from '@/components/ui/toast';
import { ModalProvider } from '@/components/ui/modal';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'AIVA - AI Video Generator',
  description: 'AI-powered YouTube content production platform',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${inter.variable} ${mono.variable} dark`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-bg-page text-text-primary antialiased flex flex-col font-sans">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1 w-full pt-[var(--header-height)]">
          {children}
        </main>
        <Footer />
        <ModalProvider>
          <Toaster />
        </ModalProvider>
      </body>
    </html>
  );
}
