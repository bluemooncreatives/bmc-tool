'use client'

import dynamic from 'next/dynamic'

const AdminApplication = dynamic(() => import('@/app/admin-application'), {
  ssr: false,
})

export default function AdminPage() {
  return <AdminApplication />
}
