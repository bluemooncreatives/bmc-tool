export type ProfileEmail = {
  address: string
  isPrimary: boolean
  verified: boolean
}

export type AccountProfile = {
  username: string
  canonicalEmail: string
  displayEmail: string
  bio: string
  urls: string[]
  emails: ProfileEmail[]
  usernameAvailableAt: string | null
  updatedAt: string
}

export type ProfileResponse = { profile: AccountProfile }

export type EmailChallenge = {
  challengeId: string
  email: string
  expiresIn: number
  resendAfter: number
}
