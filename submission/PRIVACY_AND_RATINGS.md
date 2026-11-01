# Privacy and ratings worksheet
Owner verification is required. This is an engineering data-flow inventory, not a declaration that all privacy answers have been finalized.

## Actual data flows
| Data | On device | Leaves device | Purpose / release action |
| --- | --- | --- | --- |
| Collection, journal, ratings, attached photos | IndexedDB, with legacy localStorage migration | Not automatically synchronized | Explain local-only data and backup risk |
| AI-selected photos | Resized/re-encoded locally | Torcida server on Vercel → Anthropic after consent | Label identification; disclose optional Photos or Videos collection unless verified exempt under Apple's definition |
| Entered lookup text and recommendation context | In forms/local collection | Relevant names, notes/preferences from the constructed request → Vercel → Anthropic after consent | App functionality; assess Other User Content |
| IP address and technical requests | Not stored as a Torcida account | Infrastructure receives network metadata; server uses a hash for expiring rate counters | Rate limiting/security; verify hosting logs, linkage and the appropriate Other Data/identifier classification |
| Tasting cards and backups | Generated locally; temporary export copies in app cache | Only through the user's chosen share action | No automatic upload; chosen recipients/storage services have their own policies |
| Freeform location / occasion | Text entered by user | Excluded from card unless selected; review AI request construction | No GPS permission or GPS collection |
| Appearance, permission choice, timer drafts | Local browser/app preferences | No automatic upload | No ad tracking |
| TestFlight feedback and crash diagnostics | Apple-controlled testing tools | Apple and the developer receive data under TestFlight terms | Verify current App Store Connect/Apple terms separately |

There is no advertising SDK, third-party analytics SDK, ATT tracking integration, Torcida user account or in-app purchase in this prepared source. Adding any of those changes this worksheet.

## Provider verification before signing off
- Confirm the actual Vercel project owner, log retention, request-body logging behavior and who has access. Do not enable request-body logging for AI requests.
- Confirm the Anthropic API account/contract, retention, training use and any zero-retention eligibility. Do not infer policy from the consumer Claude product.
- Confirm the Redis provider and TTLs. The code's expiring counters include hashed IP identifiers and global budget counters; a hash alone is not anonymization.
- Verify the app's disclosure, public policy, privacy manifest and App Store Connect answers agree. Provider behavior can make data “collected” under Apple's definition even if Torcida does not create an account.
- Determine whether content can be linked through retained metadata/provider logs. Do not declare “not linked” without evidence.

The initial app privacy manifest conservatively declares Photos or Videos, Other User Content and Other Data for app functionality, marked linked, not tracking. These are deliberately not “Data Not Collected” claims. Review and adjust based on verified provider configuration before upload; manifest categories do not replace App Store Connect privacy answers.

The required-reason declaration includes File Timestamp / C617.1 for the Filesystem plugin's app-container file operations. Review the full archive privacy report and dependency manifests in Xcode. Additional native SDK behavior can require additional declarations. No Preferences plugin is included.

## Age rating and review content
Answer the current App Store Connect questionnaire truthfully for frequent tobacco-related material, alcohol references and accessible recommendations. Do not select the Kids category. If a higher adult rating/age restriction is appropriate, configure it in App Store Connect. A self-declared adult audience or age rating does not override guideline 1.4.3.

No tobacco or alcohol purchase is facilitated in this build. The journal, timer, recommendations and guide remain tobacco-related and must be assessed as actual behavior, not just marketing text. Long Ash Challenge is excluded from every iPhone beta build.

## Encryption
The prepared Info.plist sets ITSAppUsesNonExemptEncryption to false based on standard HTTPS/OS-provided encryption and no custom cryptographic feature. The backend's Node crypto use is not embedded in the mobile client. Confirm the complete app and SDKs before answering Apple's export-compliance questions; re-evaluate if cryptographic functionality is added.

## Owner fields to finalize
Working support and privacy contacts; legal publisher identity/copyright; published policy/support URLs; final privacy classification and retention information; age-rating answers; content/asset rights; reviewer contact and optional private backend access code.

Sources:
- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/app-store/review/guidelines/
- https://capacitorjs.com/docs/apis/filesystem
