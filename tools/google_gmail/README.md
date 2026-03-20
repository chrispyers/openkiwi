# Google Gmail Tool

Read and send emails using the Gmail API, including sending files as attachments.

## Setup Procedure

1. Create OAuth 2.0 Client ID at console.cloud.google.com
2. Add `http://localhost:3000` as an authorized JavaScript origin 
3. Add `http://localhost:3456/callback` as an authorized redirect URI
4. Go to APIs and Services > OAuth Consent Screen > Audience and add your email address as a test user
5. Save the Client ID and Client Secret to the .env file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
6. Connect your Google account via the Settings > Connections page in the app

## Example config

Create a `gmail/config.json` file in your workspace to manage your default settings if needed:

```json
{
    "allowed_domains": [
        "gmail.com",
        "example.com"
    ],
    "default_signature": "\n\nSent from my Agent"
}
```
