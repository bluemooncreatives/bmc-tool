/** Account emails are stored lower-cased for case-insensitive uniqueness. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Usernames preserve display casing but compare through this normalized key. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}
