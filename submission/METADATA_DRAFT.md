# Torcida submission copy
Drafts for the prepared iPhone build. Review actual behavior and complete owner fields before pasting into App Store Connect.

## Basic fields
- App name: Torcida
- Subtitle: Cigar collection & journal
- Suggested primary category: Lifestyle
- Proposed bundle ID: com.torcida.journal (owner must confirm availability)
- Version: 0.1.0
- Initial build: 1
- Language: English (US)
- Beta price: free. No in-app purchase or subscription is implemented.
- Keywords draft: cigar,journal,collection,humidor,tasting,notes,inventory
- Copyright: [YEAR AND LEGAL OWNER]
- Privacy policy URL: [PUBLISHED HTTPS PRIVACY PAGE]
- Support URL: [PUBLISHED HTTPS SUPPORT PAGE]
- Beta feedback email: [MONITORED EMAIL]
- Review contact: [OWNER NAME, EMAIL AND PHONE]
- Reviewer access code if the backend requires one: [PROVIDE PRIVATELY IN APP STORE CONNECT; NEVER IN PUBLIC REPOSITORY]

## Public description draft
Torcida is a personal cigar collection and tasting journal for adults.

Organize your humidor with quantities, purchase details and your own photos. Record past smokes with ratings, tasting notes and optional drink pairings. Review your entries and create a tasting card you can save or share, choosing whether personal notes and location text appear.

Explore reference material about cigar sizes, cuts, origins and storage. Optional AI tools identify labels from photos or names and provide cigar and pairing suggestions. AI requires internet access and explicit permission to send the selected content and relevant preferences through Torcida's server to Anthropic. Results may be inaccurate and should be checked.

Your collection is stored on your device. No Torcida account or automatic Torcida cloud sync is provided. Export JSON backups regularly, and use backup/restore to transfer from the web app to the installed app. Deleting the app or clearing its data can remove the local collection.

Choose Light, After Hours, or Follow Device appearance. Torcida does not sell tobacco or alcohol.

## TestFlight beta description
Help test Torcida's iPhone collection and journal experience. This beta includes a visual humidor, photo-based label lookup, journal ratings and photos, a reference Guide, optional AI recommendations and PNG tasting-card exports. Manual collection and journal features work without AI permission. Data stays local except content deliberately sent to AI or exported/shared. Keep a backup, and use sample data until you have verified restore and upgrade behavior.

## What to test
1. Add a sample cigar, quantity and photo. Close and reopen the app and confirm it remains saved.
2. Try the camera and photo picker. Decline AI sharing first, then allow it and perform a label lookup. From a successful cigar result, open its log and confirm the scan photo is included and removable.
3. Rate a smoke in Light and After Hours. Confirm filled amber stars and hollow unselected stars match the saved rating.
4. Create square, story and landscape tasting cards. Save them to Files, and confirm notes/location remain absent unless selected.
5. Restore a sample browser backup into the app and verify records and photos. Cancel the preliminary backup share and confirm restoration does not replace current data.
6. Test airplane mode, permission denial, app restart, interrupted requests and an upgrade over the previous beta.
Report the device/iOS version, steps and expected versus actual behavior through TestFlight. Redact personal notes and images.

## Known limitations to disclose
- No account or automatic Torcida cloud sync. Safari and installed-app storage are separate.
- AI requires network access, explicit sharing consent and server availability; daily limits may apply.
- Background timers resume from elapsed timestamps. They do not provide guaranteed background execution or notifications.
- Photo recognition and AI suggestions can be inaccurate.
- Long Ash Challenge is not included in the iPhone beta.
- Signed build, physical-device verification and finalized privacy/support contacts remain owner release gates until completed.

## Screenshots to capture from the real iPhone build
Capture actual app screens with sample records: visual humidor, a journal rating form, a saved journal entry, Guide topic grid, After Hours appearance and tasting-card preview. Use screenshots from the supported device sizes shown in App Store Connect; confirm those requirements there at upload time. Do not substitute browser screenshots or concept art for genuine iPhone screenshots. Check all visible notes, photos and dates for private data.
