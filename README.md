# Torcida
Personal cigar collection, journal and reference app, with a prepared Capacitor iPhone beta project.

Start the iPhone handoff at [submission/START_HERE.md](submission/START_HERE.md). It includes Mac commands, owner fields, privacy/review risks and the physical-device test checklist.

```sh
npm ci
npm test
npm run build
npm run ios:sync
npm run ios:check
```

`dist/` is the web build. `native-dist/` is the independently bundled iPhone build. Neither generated output nor signing material is committed. `ios/App/App.xcodeproj` is the prepared Xcode project. Native signing, compilation, archive validation and physical-device tests require a Mac and Apple Developer account.

Do not claim submission readiness from the JavaScript/source checks alone. Privacy/support drafts and App Store Connect owner information must be finalized. No Apple credentials or provider keys should be added to the app or repository.
