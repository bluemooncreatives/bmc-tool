import { fonts } from '@/config/fonts'
import '@/styles/index.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: {
    default: 'Blue Moon Creatives Tool',
    template: '%s | Blue Moon Creatives Tool',
  },
  description:
    'The internal operations workspace for Blue Moon Creatives.',
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const fontCookie = (await cookies()).get('font')?.value
  const font = fonts.find((candidate) => candidate === fontCookie) ?? fonts[0]

  return (
    <html lang='en' className={`font-${font}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
