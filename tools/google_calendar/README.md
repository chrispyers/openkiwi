# Google Calendar Tool

Read and create events using the Google Calendar API.

## Setup Procedure

1. Create OAuth 2.0 Client ID at console.cloud.google.com
2. Add `http://localhost:3000` as an authorized JavaScript origin 
3. Add `http://localhost:3456/callback` as an authorized redirect URI
4. Go to APIs and Services > OAuth Consent Screen > Audience and add your email address as a test user
5. Save the Client ID and Client Secret to the .env file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
6. Make sure to enable the Google Calendar API in your Google Cloud Platform project.
7. Connect your Google account via the Settings > Connections page in the app.

## Instructions

The tool allows the agent to list upcoming appointments and schedule new ones. Uses standard RFC 3339 formatting for times.
