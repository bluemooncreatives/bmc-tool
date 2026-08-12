import { type MatchKeysAndValues } from 'mongodb'

/**
 * The driver's `MatchKeysAndValues` is deeply readonly, which is right for a
 * literal passed straight to `$set` but stops the routes from assembling one
 * field at a time. This strips the modifier while keeping the key and value
 * types, so a typo in a field name is still a compile error.
 */
export type UpdateFields<TSchema> = {
  -readonly [Key in keyof MatchKeysAndValues<TSchema>]: MatchKeysAndValues<TSchema>[Key]
}
