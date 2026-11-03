# Public launch gates

- [ ] Supabase migration applied to the intended environment and direct anon/authenticated table access denied.
- [ ] Verification, password recovery, password change, logout and re-login pass with real email delivery.
- [ ] No user can load another account's collection, photos, drafts, undo records or account-management controls.
- [ ] Two devices merge independent edits and stop for review on conflicting edits or deletion versus edit.
- [ ] Existing local data imports with preview, no repeated-import duplicates, and recoverable backups.
- [ ] Free limits, Premium growth, migration grace, downgrade, storage caps and account AI allowances pass.
- [ ] Administrator allowlist, enrollment, MFA, suspension, support-history access and audit records pass.
- [ ] Public support email, privacy policy, legal terms, deletion URL and store data declarations approved by publisher.
- [ ] Real iOS and Android cold offline launch, native camera/photo access, sharing and larger text pass.
- [ ] Native HTTP cookie sign-in, refresh, logout, recovery, account switching and deletion verified on both platforms.
- [ ] Apple and Google subscriptions purchase, restore, renew, cancel, refund and expire correctly.
- [ ] One customer can use Premium across platforms without a second purchase and account transfer cases are reviewed.
- [ ] Production does not grant access from sandbox purchases or device-supplied access flags.
- [ ] Export before deletion works. Deletion removes active collection/photos and requests RevenueCat deletion. Store cancellation remains separate.
- [ ] AI reports reach support records. AI consent can be refused and revoked. Identification accuracy measured on a labeled test set.
- [ ] Submission SDK/target API requirements rechecked and release signing/archive completed.
- [ ] App icons, launch screens, review screenshots, age ratings, reviewer account and accurate review notes complete.
- [ ] TestFlight and required Google closed testing complete. No unresolved blocker defects.

Run `npm run release:check` only after replacing the false values in `docs/release-signoff.json` with observed evidence. An automated test pass is not an owner signoff or hardware result.
