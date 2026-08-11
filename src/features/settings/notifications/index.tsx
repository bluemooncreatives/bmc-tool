import { ContentSection } from '../components/content-section'
import { NotificationsForm } from './notifications-form'

export function SettingsNotifications() {
  return (
    <ContentSection
      title='Notifications'
      desc='Control which workspace activity appears in your centralized notification center.'
    >
      <NotificationsForm />
    </ContentSection>
  )
}
