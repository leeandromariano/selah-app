// Enabled only in local development after the local migration. Hosted
// environments require their own migration, gateway and authorization review.
import { bibleAvailable } from './availability.ts'
export const bibleEditorialEnabled = bibleAvailable
