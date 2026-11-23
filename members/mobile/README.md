# Vault Human: the phone app

The App Store and Google Play app for members. Same account, same Keys and the same lines as
https://members.vaulthuman.com, through the members site's app API (`/api/app/*`).

- **Sign in:** the membership email, then a six-digit code from the email (10 minutes, once).
- **Today:** the current Key with its video, the daily line, any Key that opened with it, when the next one opens,
  and the first session with Russ for the first seven days.
- **My keys:** every Key opened so far, with the member's lines.
- **Russ:** book a session, email or call, manage membership, sign out.
- **Reminders:** 8 a.m. and 8 p.m. in the member's time zone, from the members site's hourly clock, through Expo push.

Built with Expo (SDK 58) and Expo Router. Routes are in `src/app/`; everything else in `src/lib/` and `src/components/`.

## Check it

```bash
npm install
npx tsc --noEmit
npx expo-doctor
npx expo export --platform ios     # proves the bundle builds
```

Web preview against a local members site: `EXPO_PUBLIC_API_URL=http://localhost:4321 npx expo export --platform web`.

## Ship it (needs Russ's accounts)

1. An Expo account (expo.dev) owned by vault@vaulthuman.com, with the project created by `npx eas-cli@latest init`
   (writes the project id into `app.json` → `extra.eas.projectId`; reminders need it).
2. Apple Developer Program ($99/year) and Google Play Console ($25 once).
3. `npx eas-cli@latest build --platform all --profile production`, then `npx eas-cli@latest submit`.
   EAS signs the app in the cloud; no Mac is needed.
4. After the first build, the Expo GitHub app can build from this repo (base directory `members/mobile`).

Store listing: name "Vault Human", bundle id `com.vaulthuman.app`, privacy policy https://www.vaulthuman.com/privacy/.
