# Miyo Setup Guide

This guide is for a real Android build, not Expo Go.

## 1. Local config

Create a local `.env.local` or set the same values in EAS secrets.

Required for this beta:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_DISABLE_GOOGLE_SIGN_IN=1
EXPO_PUBLIC_DISABLE_CLOUD_SYNC=1
```

Optional future-use Google overrides:

```bash
EXPO_PUBLIC_GOOGLE_DRIVE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_DRIVE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_DRIVE_WEB_CLIENT_ID=
```

What each value does:

- `EXPO_PUBLIC_SUPABASE_URL`: used by account auth, verification, community dictionaries, and other Supabase-backed features
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: public client key for the same Supabase project
- `EXPO_PUBLIC_DISABLE_GOOGLE_SIGN_IN=1`: keeps Google account sign-in off in beta
- `EXPO_PUBLIC_DISABLE_CLOUD_SYNC=1`: keeps cloud backup providers off in beta

## 2. Supabase Auth setup

Open Supabase Dashboard -> Authentication.

### Redirect URLs

Add all three:

- `miyo://`
- `miyo://auth/confirm`

Without these:

- verification links can fall back to a dead page
- the in-app verification screen cannot reopen correctly

## 3. Email verification

## 4. Email verification

The verification screen in the app expects the email link to come back through `miyo://auth/confirm`.

Install the template files from:

- `/root/Epub-Reader-/supabase/email-templates/confirm-signup.html`
- `/root/Epub-Reader-/supabase/email-templates/confirm-signup-subject.txt`

The template should route to `{{ .RedirectTo }}auth/confirm?...`, not localhost.

If a user verifies the email successfully but no session is restored, Miyo now shows a verified state and routes them back to manual sign-in cleanly.

## 4. Offline dictionaries

Miyo now supports three dictionary flows:

- built-in downloadable starter packs
- hosted package import by URL
- local JSON/ZIP import from the phone

Current offline English support:

- the app ships an installable local English starter pack
- the user can also provide a larger hosted or local English package
- lookup stays local-first and only falls back online when no offline match exists

### One-tap starter package

`English Essentials` is included as a built-in offline starter dictionary and can be installed from `Settings -> Dictionary Library`.

### User-provided packages

Supported package formats:

- raw JSON dictionary package
- ZIP file containing `dictionary.json`, `package.json`, or another JSON payload

Supported JSON shapes:

```json
{
  "magic": "MIYO_DICTIONARY_V1",
  "manifest": {
    "id": "english-core",
    "name": "English Core",
    "language": "en",
    "version": "1.0.0",
    "tags": ["english", "offline"],
    "description": "Compact offline English lookup package",
    "attribution": "Source / author",
    "sourceUrl": "https://example.com/source"
  },
  "entries": [
    {
      "term": "abandon",
      "definition": "To leave behind or give up.",
      "partOfSpeech": "verb",
      "aliases": ["leave"]
    }
  ]
}
```

Or a direct downloaded-dictionary style payload:

```json
{
  "id": "english-core",
  "name": "English Core",
  "language": "en",
  "version": "1.0.0",
  "tags": ["english"],
  "entriesCount": 1,
  "downloadCount": 0,
  "downloadedAt": "2026-04-08T00:00:00.000Z",
  "entries": [
    {
      "term": "abandon",
      "definition": "To leave behind or give up."
    }
  ]
}
```

## 5. WTR-LAB online MTL browser

The beta build now includes an in-app WTR-LAB browser on the Library tab.

Feature set:

- title/keyword search
- description search
- minimum and maximum total-chapter filters
- minimum rating and review count
- latest toggle
- status filter
- updated/rating/chapter sorting
- load more pagination
- chapter-range EPUB export into the library

Important implementation note:

- WTR-LAB is browser-protected by Cloudflare.
- Miyo does not rely on raw Node/server fetching for this feature.
- The parser runs inside a browser/WebView context, then Miyo packages the result as an EPUB locally.

Live verification script:

- `/root/Epub-Reader-/scripts/wtr-lab.live.test.ts`

What the script verifies:

- search returns novels
- a novel detail fetch returns cover and description
- chapter fetch returns non-empty HTML

Limitation:

- headless Chromium can still be challenged by Cloudflare
- the script may fail in CI/headless even when the Android WebView path works on-device

## 6. Cloud backup behavior

Backups now cover more than the original minimal reader state.

Included in backup:

- library metadata
- reading positions
- bookmarks
- highlights
- theme and reading settings
- custom themes
- term groups
- downloaded dictionaries
- OPDS catalog list
- library sort/filter/view preferences
- reading stats keys stored in AsyncStorage

Google Drive term-group sync now uses its own file instead of overwriting the main app backup.

Cloud sync status in this beta:

- Google sign-in is intentionally off
- Google Drive backup is intentionally off
- WebDAV is not exposed in the beta UI

The backup envelope code can stay in the repo, but beta testers should treat cloud sync as unavailable.

## 7. Special themes

Miyo ships `Normal` and `Special` themes.

Current special themes:

- Peach Blossom
- Dark Coffee
- Parchment Comfort
- Matcha Paper

Special themes use ambient art on:

- the theme picker
- the in-app splash overlay
- the book loading screen
- the auth confirmation surface

Reduced Motion disables the particle layer but keeps the palette and artwork.

## 8. Common failures

### Google sign-in still fails

For this beta, that is expected.

Leave `EXPO_PUBLIC_DISABLE_GOOGLE_SIGN_IN=1` enabled and use email/password auth.

### Google Drive does not connect

For this beta, that is expected.

Leave `EXPO_PUBLIC_DISABLE_CLOUD_SYNC=1` enabled.

### Verification email opens a web page instead of Miyo

This is a redirect misconfiguration. Fix Supabase redirect URLs and the confirmation email template.

### Special themes look missing

Check:

1. theme category is set to `Special`
2. Reduced Motion is not hiding the ambient layer
3. the app build includes the generated assets from `/root/Epub-Reader-/assets/images/theme-effects`

### WTR-LAB live verification fails

If the script reports a Cloudflare challenge page or a browser verification timeout:

1. the script reached the site
2. WTR-LAB blocked headless automation
3. verify the feature on the Android beta build, because that is the real runtime path

## 9. Build reminder

These flows need a dev build or release build:

- volume-button navigation
- native auth/deep link return handling
- Google Drive OAuth persistence
- Android storage-folder integration

Use:

```bash
npx expo run:android
```

or an EAS Android build.
