# Physical iPhone beta acceptance test
Run on a signed build using sample data. Record app version/build, iPhone model, iOS version, date, result and any bug reference. Every item starts NOT RUN. Browser/unit tests do not mark these items passed.

| Area | Test | Required result | Status |
| --- | --- | --- | --- |
| First launch | Install clean, launch without network | App screens open; no Google Fonts or remote UI dependency | NOT RUN |
| AI consent | Decline the first AI disclosure | No AI network request; manual journal/collection still usable | NOT RUN |
| AI revocation | Allow, use a lookup, revoke in Settings, try again | Explicit permission requested before another AI call | NOT RUN |
| Camera | Allow and deny camera access; cancel capture | Valid image works; denial/cancel leaves app usable | NOT RUN |
| Photo picker | Select, cancel and use limited-library access | Selected image works without forced full-library access | NOT RUN |
| Scan log | Identify a cigar from a photo, open Log, save | Photo preview is included and persisted in the saved entry | NOT RUN |
| No stale photo | Scan cigar A, then search cigar B by text | B's log does not inherit A's image | NOT RUN |
| Remove scan photo | Remove the automatic photo before saving | Saved entry has no automatic photo | NOT RUN |
| Ratings | Tap and VoiceOver-select overall and attribute ratings in both themes | Filled/hollow states and saved values agree; each tap target is usable | NOT RUN |
| Collection | Add cigar and photo, edit quantity, force close, relaunch | Records/photos persist; no unexpected stock decrement | NOT RUN |
| Offline | Existing collection in airplane mode, attempt AI | Local data works; AI returns a clear error and no endless spinner | NOT RUN |
| Backups | Export sample data to Files and inspect JSON | Valid full backup, not an empty file or inaccessible blob URL | NOT RUN |
| Restore | Browser backup → Files → app preview → confirm | Counts, photos and ratings preserved; current collection backed up first | NOT RUN |
| Cancel restore backup | Cancel the system share before replacement | Existing collection is not replaced | NOT RUN |
| Invalid restore | Malformed JSON, unsupported schema, interrupted import | Saved data unchanged; actionable message | NOT RUN |
| Cards | All three formats, with and without private fields | Correct PNG size, exact preview, notes/location opt-in | NOT RUN |
| Share | Save card to Files and cancel sharing | Correct file; cancel leaves app responsive | NOT RUN |
| Layout | Small iPhone, landscape, large text, zoom and keyboard | No blocked controls or horizontal overflow; modal buttons reachable | NOT RUN |
| Accessibility | VoiceOver, keyboard and reduced motion | Descriptive controls, rating state and modal focus work | NOT RUN |
| Timer | Start, background, wait, reopen and finish | Elapsed time sensible; no false promises of background notifications | NOT RUN |
| External link | Recipe search or provider link | Opens in in-app browser; collection remains available on return | NOT RUN |
| Permissions | Privacy strings and OS permission screens | Explain actual use; no GPS/mic/contacts permission request | NOT RUN |
| Upgrade | Install build N+1 over N | Existing local collection, photos and appearance remain | NOT RUN |
| Restart/recovery | Reboot device, reopen and use recovery tools | Data survives; backup accessible | NOT RUN |
| Backend | Bad access code, network error, rate limit and timeout | No secret leakage; local collection unaffected | NOT RUN |
| Final archive | Validate signed Release archive and privacy report | No missing permission/manifest/icon/signing warnings | NOT RUN |

Before external testing, use Settings to back up real collections. Native-app uninstall may remove its data. A backup restore replaces rather than merges records. Do not use another person's private collection as test data.
