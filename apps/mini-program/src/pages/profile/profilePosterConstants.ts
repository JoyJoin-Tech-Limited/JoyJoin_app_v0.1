/**
 * Shared canvas ID for the profile share-card poster.
 *
 * Kept in a tiny standalone module so the main Profile page can reference the
 * canvas element without eagerly importing the much larger `profilePoster.ts`
 * drawing code.
 */
export const PROFILE_SHARE_POSTER_CANVAS_ID = 'profile-share-poster-canvas'
