import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DRAM — Whisky Archive',
  description: 'Your personal whisky tasting archive powered by Gemini',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
