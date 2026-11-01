# Preparation validation
November 1, 2026. Environment: Linux, Node 24.22.1. No Apple signing identity was used.

| Check | Result |
| --- | --- |
| Node automated suite | 77 passed, zero failed |
| Web static asset build | Passed |
| iOS JavaScript/asset bundle | Passed |
| Capacitor iOS project generation and sync | Passed, Swift Package Manager configuration generated |
| iOS source-preparation check | Passed |
| Web and native inline JavaScript syntax / unique HTML IDs | Passed |
| XML property lists, storyboards and shared scheme parse | Passed |
| App icon dimensions and opaque RGB format | Passed, 1024 × 1024 |
| Production npm dependency audit | Zero reported vulnerabilities at preparation time |
| AI disclosure in browser preview | Appears before transport; decline restores local navigation |
| Native beta Journal preview | Long Ash Challenge UI absent |
| Release signoff check with missing owner fields | Correctly blocks submission readiness |
| Xcode compilation and dependency resolution on macOS | NOT RUN |
| Signed archive, validation and upload | NOT RUN |
| Native camera/share/Files/VoiceOver behavior on physical iPhone | NOT RUN |
| Current production backend accepts native origin | NOT DEPLOYED by this preparation branch |
| Final public policy/contact and provider retention verification | OWNER REQUIRED |
| Apple review decision | NOT SUBMITTED |

The native iOS runtime cannot be verified by running its JavaScript in a desktop browser. Follow DEVICE_TEST_PLAN.md on the signed app before marking the device or archive signoffs true.

[Engineering browser preview of the AI disclosure](consent-browser-preview.jpg). This is not a native iPhone screenshot and must not be submitted as an App Store screenshot.
