# Torcida iPhone beta handoff
Prepared November 1, 2026. Source version 0.1.0, initial build 1.

## What is prepared
- Capacitor 8 iOS project with a shared App scheme, iPhone target, stable local origin, bundled app screens and assets. No production remote `server.url`.
- Native camera/gallery lookup, native sharing for journal PNGs and JSON collection backups, and in-app browser for external HTTPS links.
- Existing IndexedDB collection storage and backup schema, including photos. Safari data stays separate; transfer is explicit backup/restore.
- AI permission before any AI network call, Settings revocation, camera/photo purpose strings, draft privacy/support pages and a privacy manifest included in Resources.
- Long Ash Challenge UI is excluded from the actual iPhone bundle for every user. The web build retains it. No reviewer-specific switches or remotely enabled hidden features.
- Signature ivory tasting-card exports, Light/After Hours/Follow Device themes and contrasting rating stars are retained.
- Initial opaque 1024px app icon derived from the current Torcida icon; neutral branded-color launch screen.

## What this handoff does not certify
This environment can generate/sync the Xcode project and build the JavaScript bundles. It cannot compile Apple frameworks, run an iPhone simulator, sign an archive or validate an upload. Those steps need your Mac, Apple Developer account and physical iPhone. Do not submit until the device checklist is complete.

Apple guideline 1.4.3 remains a material review risk: a journal and educational framing do not automatically make cigar recommendations acceptable. Label identification, pairing suggestions, Help Me Choose, Strength Finder, Occasion Match, and other recommendations remain accessible in this build and are disclosed in the draft review notes. Excluding the ash challenge does not guarantee approval. Review these features before submitting; if Apple considers them encouragement, change the product behavior for all users rather than hiding features from reviewers.

## Your next steps, in order
1. Decide on individual versus organization enrollment and finish your Apple Developer enrollment.
2. Review this beta-preparation pull request. Before device testing against the production API, merge/deploy the backend change permitting exactly `capacitor://localhost`. The existing request validation, optional access code and durable rate limits remain in place. A CORS origin is not authentication.
3. Finalize the privacy/support pages: add a monitored contact, verify Vercel/Anthropic/Redis provider retention and logging configuration, remove their preparatory notices, and publish the pages. The proposed URLs are the production origin plus `/privacy.html` and `/support.html`; they are not live merely because these drafts exist in the branch.
4. Use the Mac instructions below. Confirm the proposed bundle ID `com.torcida.journal` is available under your Apple team before registering it. Change it in `capacitor.config.json` if needed, then sync again.
5. Fill the App Store Connect fields from `METADATA_DRAFT.md`; complete age-rating, privacy, encryption and content-rights answers using actual deployment facts. Do not select “Data Not Collected” by default.
6. Run `DEVICE_TEST_PLAN.md`, then archive and upload through Xcode. The initial group should be approximately 10–20 adult external testers. Provide Apple a working review access code privately if the server uses one.
7. Complete the local release signoff and submit the first external build for TestFlight review. Apple makes the review decision. Do not promise a review date.

## Mac setup and build
Install a current compatible Xcode (Capacitor 8 requires Xcode 26+) and Node 22 or newer. Accept Xcode's license yourself and install the iOS platform components in Xcode. No Apple password, API key, signing certificate or provisioning profile belongs in this repository.

Clone the repository, check out this beta-preparation branch and run these commands from its root:

```sh
npm ci
npm test
npm run ios:sync
npm run ios:check
npm run ios:open
```

The generated project is already tracked. Use `ios:sync`, not `ios:add`. `ios:sync` builds `native-dist`, copies the assets and plugin registrations, applies permission/manifest settings and matches the Xcode marketing version to `package.json`. Do not open Xcode with stale copied assets.

In Xcode:
- Open `ios/App/App.xcodeproj`, select scheme **App**, then target **App** → Signing & Capabilities.
- Select your development team and confirm the bundle identifier. Keep Automatically manage signing enabled unless your organization requires otherwise.
- Connect your iPhone, enable Developer Mode if Xcode requests it, select it as destination and run the app. Accept normal camera/photo permissions only when testing those actions.
- Run the device checklist before archiving. Set a higher build number for each upload; `CURRENT_PROJECT_VERSION` is not reset by the sync script.
- Select a generic iOS device destination, choose Product → Archive, then Organizer → Validate App and Distribute App → App Store Connect.
- After build processing, supply the TestFlight beta details, reviewer contact and any server access code. Add the first external group and submit for beta review.

Optional unsigned compiler check on a Mac:

```sh
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

This unsigned build does not replace a signed archive or physical-device test.

## Submission signoff
Copy `submission/release-signoff.example.json` to `submission/release-signoff.local.json`. Fill only verified facts, then run:

```sh
node scripts/check-ios.mjs --submission
```

This deliberately fails while contacts, published pages, backend deployment, provider-retention verification, review-policy assessment, physical iPhone testing or Xcode archive validation are incomplete. It checks declared signoff, not Apple approval or live page availability. Verify published links manually. To change privacy-manifest declarations, edit the manifest construction in `scripts/configure-ios.mjs`, then sync again; manual edits to the generated manifest are overwritten by that script.

## Sources
- Apple TestFlight: https://developer.apple.com/testflight/
- Review guidelines, especially 1.4.3, 4.2 and 5.1: https://developer.apple.com/app-store/review/guidelines/
- App privacy definitions: https://developer.apple.com/app-store/app-privacy-details/
- Capacitor iOS: https://capacitorjs.com/docs/ios
- Camera: https://capacitorjs.com/docs/apis/camera
- Filesystem privacy reason C617.1: https://capacitorjs.com/docs/apis/filesystem
- Share: https://capacitorjs.com/docs/apis/share
