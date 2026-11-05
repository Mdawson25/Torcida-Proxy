# Promo codes
Run database/003_promo_codes.sql after migrations 001 and 002. No active public codes are seeded.

Create a code privately in Supabase SQL Editor using this template. Replace YOUR-PRIVATE-CODE with a unique, hard-to-guess code of at least 16 characters, uppercase letters, digits and hyphens. Replace KIND with premium or lookups and AMOUNT with 30 or 10 respectively. Adjust expiry and total uses.

```sql
insert into public.promo_codes(code_hash,kind,amount,expires_at,max_redemptions)
values(encode(sha256(convert_to('YOUR-PRIVATE-CODE','UTF8')),'hex'),'KIND',AMOUNT,now()+interval '90 days',100);
```

One redemption per code per account. Premium grants extend complimentary access by 30 days. Lookup credits are spent after the account plan allowance and never expire. Existing subscription charges are unchanged. Disable a code with active=false in Supabase Table Editor. Authenticated attempts are limited to five per minute. Codes are stored as hashes, not plaintext. Account deletion also deletes redemption history.

The separate 100% subscription discount is a free store offer, not a permanent waiver. Configure an Apple free subscription offer (one month, where supported by the subscription product) in App Store Connect and a 30-day Google Play subscription promotion in Play Console. These store codes cannot be validated by the Torcida code field. Store eligibility and renewal terms apply. Native store redemption, store setup and sandbox verification remain launch tasks. Do not advertise those offers as active until tested.

Apple: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-subscription-offer-codes/
Google: https://support.google.com/googleplay/android-developer/answer/6321495
