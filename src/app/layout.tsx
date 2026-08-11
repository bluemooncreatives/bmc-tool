import '@/styles/index.css'
import type { Metadata, Viewport } from 'next'
import { Hanken_Grotesk } from 'next/font/google'

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: 'variable',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-hanken-grotesk',
})

export const metadata: Metadata = {
  title: {
    default: 'Blue Moon Creatives Tool',
    template: '%s | Blue Moon Creatives Tool',
  },
  description: 'The internal operations workspace for Blue Moon Creatives.',
  icons: {
    // The blue mark reads on both light and dark tab bars, so one file covers
    // both schemes.
    icon: [{ url: '/images/bmc-logo.png', type: 'image/png' }],
    apple: [{ url: '/images/bmc-logo.png', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang='en'
      className={`${hankenGrotesk.variable} ${hankenGrotesk.className}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
