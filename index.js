const { OAuth2Client } = require('google-auth-library');
const sdk = require('node-appwrite');
const crypto = require('crypto');

// This function expects these environment variables to be set in Appwrite:
// GOOGLE_CLIENT_ID - the Google OAuth Web client ID used to verify idTokens
// APPWRITE_ENDPOINT - your Appwrite endpoint, e.g. https://cloud.appwrite.io/v1
// APPWRITE_PROJECT_ID - your Appwrite project ID
// APPWRITE_API_KEY - an Appwrite API key with permissions to manage users

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function resolveEnv(...keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return undefined;
}

function makeAppwriteClient() {
  const endpoint = resolveEnv('APPWRITE_ENDPOINT', 'APPWRITE_FUNCTION_ENDPOINT', 'VITE_APPWRITE_ENDPOINT');
  const projectId = resolveEnv('APPWRITE_PROJECT_ID', 'APPWRITE_FUNCTION_PROJECT_ID', 'VITE_APPWRITE_PROJECT_ID');
  const apiKey = resolveEnv('APPWRITE_API_KEY', 'APPWRITE_FUNCTION_API_KEY');

  if (!endpoint || !projectId || !apiKey) {
    console.error('Appwrite function missing required environment variables:', {
      endpoint: !!endpoint,
      projectId: !!projectId,
      apiKey: !!apiKey,
    });
    throw new Error('Appwrite function not configured. Ensure APPWRITE_ENDPOINT/APPWRITE_PROJECT_ID/APPWRITE_API_KEY (or their function equivalents) are set.');
  }

  const client = new sdk.Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return client;
}

function randomSecret() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = async function (req, res) {
  try {
    const payload = req.payload ? JSON.parse(req.payload) : {};
    const idToken = payload.idToken;

    if (!idToken) {
      return res.json({ error: 'Missing idToken' }, 400);
    }

    // Verify idToken with Google
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const info = ticket.getPayload();

    const googleSub = info.sub; // unique Google user id
    const email = info.email || '';
    const name = info.name || '';

    if (!googleSub) {
      return res.json({ error: 'Invalid idToken payload' }, 400);
    }

    const client = makeAppwriteClient();
    const users = new sdk.Users(client);

    // Use a stable Appwrite user id derived from the Google subject
    const appwriteUserId = `google_${googleSub}`;

    // Generate a password/secret that the client can use to create a session
    const password = randomSecret();

    try {
      // Try to fetch existing user
      await users.get(appwriteUserId);

      // If user exists, update email/name and rotate password so we can
      // return a valid secret for the client to sign in with `account.createSession`.
      // Note: the `users.update` admin call allows setting a new password.
      await users.update(appwriteUserId, email || undefined, password, name || undefined);
    } catch (err) {
      // If not found, create the user using the admin API
      await users.create(appwriteUserId, email, password, name);
    }

    // Return credentials for the client to call `account.createSession({ userId, secret })`
    return res.json({ userId: appwriteUserId, secret: password });
  } catch (err) {
    console.error('google-oauth-exchange error', err);
    return res.json({ error: String(err) }, 500);
  }
};
