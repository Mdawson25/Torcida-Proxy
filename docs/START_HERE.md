# Torcida account and store launch

The implementation is on a review branch. Do not merge to production until the connected-service checks below pass. Existing main-branch users keep their local collections until they explicitly import them. No store accounts, purchases, or paid resources were created by this change.

## Owner setup in order

1. Create a Supabase project in your own account. In its SQL editor run `database/001_accounts.sql` once. This creates private account records, collection revisions, photos, usage counters, reports, and audit records. Public and authenticated database roles have no direct access. Only the server role can call the protected functions.
2. Enable email/password authentication and email confirmation. Set Site URL to `https://torcida-proxy.vercel.app`, and allow that URL and its `/#account-recovery` destination as redirects. Add the exact preview origin separately for testing. Configure a production email sender and test verification and password-reset delivery. Require secure password changes and test any resulting reauthentication settings before launch.
3. In Vercel, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as environment variables. The service role is a server secret. Do not put it in frontend code or send it through chat. Keep the existing Anthropic and Upstash settings. Set `APP_ORIGIN` to the exact deployment origin, and configure separate Supabase projects for production and previews.
4. Add `SUPPORT_EMAIL` with your chosen public support address. Review `privacy.html` and `terms.html` against your provider agreements, retention settings and publishing identity. The support page visibly reports incomplete setup until an address is configured.
5. Enroll in Apple Developer and Google Play Console under your intended personal or business identity. Complete identity checks, required agreements, tax and payout information. Enrollment and legal acceptance require the owner. Keep `com.torcida.journal` as the bundle/application identifier unless another identifier is already registered.
6. Create a RevenueCat project with Apple and Google apps. Create store subscription products `torcida_premium_monthly` and `torcida_premium_annual`, proposed at $3.99 monthly and $29.99 annually in the US. Final prices must be configured in each store. Attach both to entitlement `premium`, and put monthly and annual packages into the current offering. Do not add a lifetime plan.
7. Connect the stores to RevenueCat and configure its webhook to `https://torcida-proxy.vercel.app/api/billing-webhook`. Set a long random Authorization header value in RevenueCat and match it in Vercel as `REVENUECAT_WEBHOOK_AUTH`. Add server-side `REVENUECAT_SECRET_KEY` and public SDK keys `REVENUECAT_APPLE_PUBLIC_KEY` and `REVENUECAT_GOOGLE_PUBLIC_KEY` in Vercel. Never expose the secret API key to the app.
8. On a preview deployment only, set `ALLOW_SANDBOX_BILLING=true` for test purchases. Production explicitly rejects sandbox grants. Use separate provider projects and data for testing. API verification refreshes subscription status from RevenueCat rather than trusting webhook flags or the device.
9. Create your own account, verify email, and copy its Supabase user UUID into `TORCIDA_ADMIN_IDS`. Open `/admin.html`, enroll an authenticator, and verify its code. Later sessions can load the existing factor. Account administration requires both the allowlisted UUID and a verified `aal2` token. Use an ordinary second account to verify administrator access is denied.
10. Redeploy the review branch after environment changes. Test two accounts and two devices. Follow the release checklist. Only then prepare a production merge and store submission.

## Run and build

Use Node 22 or newer. Run `npm ci`, `npm test`, `npm run build`, and `npm run mobile:sync`. Vercel serves only the `public` output plus server API functions. Old dated HTML copies, SQL and source documents are not copied into the static release.

The mobile builds bundle the complete collection interface and assets, rather than loading a remote website as their home screen. Native API requests use Capacitor's native HTTP transport with the Torcida HTTPS endpoint and its cookie jar. Session-cookie persistence, rotation and logout must be verified on real iOS and Android devices. No password or auth token is written to JavaScript local storage.

For a native beta connected to a preview backend, set `MOBILE_API_ORIGIN` to that exact HTTPS origin when running `npm run mobile:sync`. Configure that preview's `APP_ORIGIN`, Supabase redirect allowlist and separate test-provider credentials consistently. The compiled native bundle contains only the API origin, never server secrets.

On a Mac with Xcode 26 or newer, open `ios/App/App.xcodeproj` and resolve its Swift packages, select your team, enable In-App Purchase, install dependencies if prompted and archive using the shared App scheme. On Android, open the generated project in Android Studio 2025.2.1 or newer, install SDK 36 and JDK 21 and produce a signed release bundle. Store signing credentials and App Store Connect/Play credentials are owner-controlled.

## Free and Premium

| Capability | Free | Premium |
|---|---|---|
| Cigar records | 25 | 5,000 |
| Humidors | 1 | 100 |
| Cloud photo allowance | 10 MB | 100 MB |
| AI identification | 5 introductory requests total | 50 per UTC calendar month |
| Manual journal, export and deletion | Included | Included |

Quantities do not create extra records. Photo allowances count encoded storage bytes. Initial device import can preserve an over-limit collection once per account, up to the hard maximum. Later growth above the plan cap is blocked. Existing records stay readable, editable and exportable after downgrade. Local legacy records are never deleted by migration. Imported photos must fit the published storage cap; excess photos remain in the local copy and backup.

The source retains legacy ash data for recovery and backup compatibility, but the challenge interface and analysis endpoint are removed. New-cigar recommendation, occasion, quiz and pairing-generation requests are disabled at the server. The optional Bar remains a private inventory. The earlier iPhone draft PR is not merged by this change. This branch replaces its packaging approach while reusing its icon, privacy manifest, third-party notices and build scheme. Do not merge the two packaging changes independently without reconciliation.

## Evidence and limits

Automated tests cover database role restrictions, revisions, plan limits, deletion cascades, quotas, CSV, merging, authentication/CSRF, administrator MFA, sandbox rejection and processor errors. Browser checks exercise actual device storage, a mocked signed-in cloud transport, guest save/reload, account separation and narrow widths. These do not substitute for configured Supabase/RevenueCat integration or physical devices. No signed archive, store purchase, live provider migration, tax agreement, or app-store approval is implied.

## Provider references

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.github.io/auth/
- https://www.revenuecat.com/docs/getting-started/installation/capacitor
- https://www.revenuecat.com/docs/api-v1
- https://www.revenuecat.com/docs/integrations/webhooks
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9878810

Public-store policies and SDK deadlines must be rechecked when submitting.

For an existing database, run `database/002_free_ai_allowance.sql` in Supabase SQL Editor to raise Free to five lifetime AI requests without resetting usage.

## Friends and family
Run database/004_family_and_premium.sql after migration 003. In /admin.html, search for a registered account and select Grant friends and family. Administrator allowlisting and MFA are required. Access has no expiration and includes unlimited AI lookups. Remove friends and family revokes this grant without changing any paid or timed entitlement. Suspensions, infrastructure request limits and collection/storage limits still apply. This does not cancel store billing. Premium now includes 50 AI requests per UTC calendar month. No existing usage is reset.
