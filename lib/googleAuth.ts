import { google } from "googleapis";

/**
 * Creates a Google OAuth2 client pre-loaded with the given access token.
 * Use this anywhere you need to call a Google API on behalf of the signed-in user.
 */
export function makeGoogleAuth(accessToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}
