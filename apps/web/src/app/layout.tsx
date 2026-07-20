import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AIVA - AI Video Generator',
  description: 'AI-powered YouTube content production platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  )
}
