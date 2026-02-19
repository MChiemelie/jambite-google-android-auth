const sdk = require("node-appwrite");
const { OAuth2Client } = require("@google-auth-library/nodejs");

/**
 * Appwrite Function: google-auth
 *
 * Takes a Google ID Token from the client, verifies it with Google,
 * and returns an Appwrite User ID and a Secret to create a session.
 */
module.exports = async (context) => {
  const client = new sdk.Client();
  const users = new sdk.Users(client);

  // Context environment variables
  const APPWRITE_ENDPOINT =
    process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const APPWRITE_FUNCTION_PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const APPWRITE_API_KEY = context.req.headers["x-appwrite-key"]; // Injected automatically
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Must be set in Function Variables

  if (!APPWRITE_API_KEY || !GOOGLE_CLIENT_ID) {
    context.error(
      "Missing configuration: APPWRITE_API_KEY or GOOGLE_CLIENT_ID",
    );
    return context.res.json({ error: "Server configuration error" }, 500);
  }

  client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

  try {
    let payload = {};
    if (context.req.body) {
      payload =
        typeof context.req.body === "string"
          ? JSON.parse(context.req.body)
          : context.req.body;
    }

    const { idToken } = payload;

    if (!idToken) {
      return context.res.json({ error: "Missing idToken" }, 400);
    }

    // 1. Verify Google Token
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();

    // 2. Find or Create User
    let user;
    try {
      // Try to list users by email
      const userList = await users.list([sdk.Query.equal("email", email)]);

      if (userList.total > 0) {
        user = userList.users[0];
      } else {
        // Create new user
        user = await users.create(sdk.ID.unique(), email, undefined, name);
        // Optionally update prefs with avatar
        if (picture) {
          await users.updatePrefs(user.$id, { avatar: picture });
        }
      }
    } catch (err) {
      context.error("User lookup/creation failed: " + err.message);
      return context.res.json({ error: "User creation failed" }, 500);
    }

    // 3. Create Restricted Token for Client Session
    // This token allows the client to call account.createSession(userId, token)
    const token = await users.createToken(user.$id, 64, 300); // 5 minutes expiry

    return context.res.json({
      userId: user.$id,
      secret: token.secret,
      email: user.email,
    });
  } catch (error) {
    context.error(error.message);
    return context.res.json(
      { error: "Authentication verification failed" },
      401,
    );
  }
};
