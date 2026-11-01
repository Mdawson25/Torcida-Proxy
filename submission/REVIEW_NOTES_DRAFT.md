# Draft notes for Apple beta review
Do not submit this file unchanged: complete the private contact/access details and verify the behavior on the signed build first.

Torcida is an adult-oriented cigar collection and personal tasting journal. There is no registration, tobacco/alcohol checkout, marketplace, public posting feed, messaging or user-to-user competition. Local records and the reference Guide are available without enabling AI.

Core workflows:
- Humidor → Add Cigar to Humidor creates a local record. Add photo uses the user's own camera/photo selection. Stock changes when explicitly saved.
- Journal → Log a Smoke records ratings, notes, optional photos and drink details. Selected ratings are filled amber; unselected ratings are hollow.
- Find → Take Photo or From Gallery uses native photo capture/selection. Before an AI network call, a disclosure names Torcida's Vercel-hosted server and Anthropic and asks for explicit permission. Declining keeps manual collection and journal features available. Settings → Privacy and AI sharing revokes permission for future requests.
- A successful cigar photo lookup carries the selected photo into the journal draft. The user can remove it before saving.
- Journal → Share opens an on-device PNG preview. Personal notes and location text are off by default. Native system sharing supports saving the PNG to Files.
- Settings provides JSON backup/restore and local privacy/support pages. Browser data is transferred by user-selected backup; there is no automatic account sync.

The application interface is bundled with the signed app rather than loaded from a remote app URL. A remote backend is used for optional AI operations. Changes to the shipped interface require a new build; this package does not include an over-the-air code updater.

Tobacco-related functionality is disclosed: the app includes cigar-label identification, humidor inventory, a smoke journal, a timer, personal taste profiles, cigar and beverage pairing suggestions, Help Me Choose, Strength Finder recommendations, alternative suggestions and Occasion Match. We understand the reviewer must assess these against guideline 1.4.3. No claim is made that an adult rating or educational description exempts these features.

Long Ash Challenge is excluded from the actual iPhone build for all beta users. No reviewer-specific detection, remote feature restoration or hidden contest is included.

[OWNER: insert reviewer contact, public policy/support URLs and a working access code privately if required. Confirm backend is online and sufficient AI quota is available during review. Do not enable a temporary bypass that changes the reviewer's experience.]
