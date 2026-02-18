# Google Auth Appwrite Function

An Appwrite Cloud Function that verifies Google ID tokens and creates authenticated Appwrite sessions.

## Features

- ✅ Verifies Google ID tokens using the Google Auth Library
- ✅ Automatically creates or retrieves existing users
- ✅ Returns Appwrite user ID and session token
- ✅ Supports user profile data (email, name, avatar)
- ✅ Secure token generation with 5-minute expiry

## Prerequisites

- [Appwrite Cloud](https://cloud.appwrite.io) account
- [Google Cloud Console](https://console.cloud.google.com) OAuth 2.0 credentials
- Node.js 18+ (for local development)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Set these variables in your Appwrite Function settings:

```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

The following are automatically provided by Appwrite:
- `APPWRITE_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_API_KEY` (via headers)

### 3. Deploy to Appwrite

```bash
# Using Appwrite CLI
appwrite functions createDeployment \
  --functionId google-auth \
  --activate true
```

## Usage

### Client-Side (Tauri/React)

```typescript
import { signIn } from "@choochmeque/tauri-plugin-google-auth-api";

const googleResponse = await signIn({
  clientId: "YOUR_GOOGLE_CLIENT_ID",
  scopes: ["email", "profile", "openid"],
});

const response = await fetch("/v1/functions/google-auth", {
  method: "POST",
  body: JSON.stringify({ idToken: googleResponse.idToken }),
});

const { userId, secret } = await response.json();
const session = await account.createSession(userId, secret);
```

### Request Body

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ..."
}
```

### Response

**Success (200):**
```json
{
  "userId": "user_123abc",
  "secret": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com"
}
```

**Error (4xx/5xx):**
```json
{
  "error": "Missing idToken"
}
```

## Error Handling

| Error | Status | Cause |
|-------|--------|-------|
| Missing configuration | 500 | `GOOGLE_CLIENT_ID` or `APPWRITE_API_KEY` not set |
| Missing idToken | 400 | No `idToken` in request body |
| Authentication verification failed | 401 | Invalid or expired Google ID token |
| User creation failed | 500 | Error creating/retrieving user in Appwrite |

## Security Considerations

- ✅ Uses Google's official Auth Library for token verification
- ✅ Returns short-lived tokens (5-minute expiry)
- ✅ Never stores Google credentials
- ✅ Validates token audience matches client ID
- ⚠️ Ensure `APPWRITE_API_KEY` is never exposed in client code

## Development

```bash
# Run locally with node-appwrite mock
npm install --save-dev appwrite-cli

# Test the function
node src/main.js
```

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
