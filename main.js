const sdk = require("node-appwrite");
const { OAuth2Client } = require("google-auth-library");

module.exports = async (context) => {
  const client = new sdk.Client();
  const users = new sdk.Users(client);

  const APPWRITE_ENDPOINT =
    process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const APPWRITE_FUNCTION_PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const APPWRITE_API_KEY = context.req.headers["x-appwrite-key"];
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

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

    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();

    let user;
    try {
      const userList = await users.list([sdk.Query.equal("email", email)]);

      if (userList.total > 0) {
        user = userList.users[0];
      } else {
        user = await users.create(sdk.ID.unique(), email, null, name);
        if (picture) {
          await users.updatePrefs(user.$id, { avatar: picture });
        }
      }
    } catch (err) {
      context.error(`User lookup/creation failed: ${err.message}`);
      return context.res.json({ error: "User creation failed" }, 500);
    }

    const secret = sdk.ID.unique();
    await users.updateLabel(user.$id, `verified_${Date.now()}`);

    return context.res.json({
      userId: user.$id,
      secret: secret,
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
