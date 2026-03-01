# Calendar Copilot

An AI-powered calendar assistant built with Next.js, Google Calendar, and OpenAI.

## Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example below into a `.env.local` file at the project root:

```env
AUTH_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

OPENAI_API_KEY=

# Optional — required only for flight search
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
```

---

### Getting each key

#### `AUTH_SECRET`
Used by NextAuth to sign session tokens. Generate a random secret:
```bash
openssl rand -base64 32
```

---

#### `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (or select an existing one).
2. Navigate to **APIs & Services → Library** and enable:
   - **Google Calendar API**
   - **Gmail API**
3. Go to **APIs & Services → OAuth consent screen**:
   - Set User Type to **External**
   - Fill in the app name, support email, and developer contact
   - Add scopes: `calendar.events`, `gmail.compose`, `openid`, `email`, `profile`
   - Add your Google account as a test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - (For production, also add your deployed URL)
5. Copy the **Client ID** and **Client Secret**.

---

#### `OPENAI_API_KEY`

1. Go to [platform.openai.com](https://platform.openai.com/) and sign in.
2. Navigate to **API Keys** and click **Create new secret key**.
3. Copy the key — it won't be shown again.

---

#### `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` (optional)

Required only if you want the flight search feature. The app uses Amadeus's test environment, which is free.

1. Go to [developers.amadeus.com](https://developers.amadeus.com/) and create an account.
2. Create a new app — you'll receive an **API Key** and **API Secret**.
3. The test environment covers real routes with simulated pricing.

---

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
