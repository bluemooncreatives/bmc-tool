import { fonts } from '@/config/fonts'
import '@/styles/index.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/manrope'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: {
    default: 'Shadcn Admin',
    template: '%s | Shadcn Admin',
  },
  description:
    'A production-ready admin dashboard built with Next.js and shadcn/ui.',
  icons: {
    icon: [
      {
        url: '/images/favicon.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/images/favicon_light.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: light)',
      },
    ],
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
