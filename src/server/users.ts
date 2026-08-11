import { type Collection, type ObjectId } from 'mongodb'
import { getDb } from './mongodb'

export type UserDoc = {
  _id: ObjectId
  email: string
  passwordHash: string
  role: string[]
  accountNo: string
  /** Bumped to invalidate every token issued before the change. */
  tokenVersion: number
  createdAt: Date
  updatedAt: Date
}

/** The shape sent to the client. Never includes passwordHash. */
export type PublicUser = {
  id: string
  accountNo: string
  email: string
  role: string[]
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toHexString(),
    accountNo: user.accountNo,
    email: user.email,
    role: user.role,
  }
}

/** Emails are stored lower-cased so uniqueness is case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

let indexesReady: Promise<void> | undefined

export async function getUsersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb()
  const users = db.collection<UserDoc>('users')

  // Created once per process. Without the unique index, two concurrent
  // sign-ups with the same email would both succeed.
  if (!indexesReady) {
    indexesReady = users
      .createIndex({ email: 1 }, { unique: true })
      .then(() => undefined)
      .catch((error) => {
        indexesReady = undefined
        throw error
      })
  }
  await indexesReady

  return users
}
