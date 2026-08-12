import { ContentSection } from '../components/content-section'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  return (
    <ContentSection
      title='Profile & Account'
      desc='Manage your identity, account details, contact addresses, and public profile.'
    >
      <ProfileForm />
    </ContentSection>
  )
}
