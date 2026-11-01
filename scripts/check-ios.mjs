import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import plist from 'plist';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const config=await json('capacitor.config.json');
assert.equal(config.webDir,'native-dist');assert.equal(config.server.iosScheme,'capacitor');assert.equal(config.server.hostname,'localhost');assert.ok(!config.server.url);assert.ok(!config.server.allowNavigation);assert.equal(config.server.cleartext,false);
const html=await readFile('native-dist/index.html','utf8');
assert.ok(html.includes('/assets/native.js'));assert.ok(html.includes('/assets/privacy.js'));assert.ok(!html.includes('<details class="ash-feature">'));assert.ok(!html.includes('fonts.googleapis.com'));
for(const match of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)){if(match[1]==='/')continue;await access('native-dist'+match[1]);}
for(const path of ['native-dist/privacy.html','native-dist/support.html','ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'])await access(path);
const info=plist.parse(await readFile('ios/App/App/Info.plist','utf8'));
for(const key of ['NSCameraUsageDescription','NSPhotoLibraryUsageDescription','NSPhotoLibraryAddUsageDescription'])assert.ok(info[key].length>30);
assert.equal(info.NSAppTransportSecurity?.NSAllowsArbitraryLoads,undefined);assert.equal(info.ITSAppUsesNonExemptEncryption,false);
const manifest=plist.parse(await readFile('ios/App/App/PrivacyInfo.xcprivacy','utf8'));assert.equal(manifest.NSPrivacyTracking,false);assert.ok(manifest.NSPrivacyAccessedAPITypes.some(x=>x.NSPrivacyAccessedAPIType==='NSPrivacyAccessedAPICategoryFileTimestamp'&&x.NSPrivacyAccessedAPITypeReasons.includes('C617.1')));
const project=await readFile('ios/App/App.xcodeproj/project.pbxproj','utf8');assert.ok(project.includes('PrivacyInfo.xcprivacy in Resources'));assert.ok(project.includes('PRODUCT_BUNDLE_IDENTIFIER = '+config.appId+';'));assert.ok(project.includes('TARGETED_DEVICE_FAMILY = 1;'));
console.log('iOS source preparation checks passed. This is not an Xcode compile, archive, signing or device test.');
if(process.argv.includes('--submission')){
 let signoff;try{signoff=await json('submission/release-signoff.local.json');}catch{throw Error('Submission blocked: copy submission/release-signoff.example.json to release-signoff.local.json and complete the owner fields and device verification.');}
 for(const key of ['privacyPolicyURL','supportURL'])assert.match(signoff[key]||'',/^https:\/\//,key+' must be a published working URL');
 for(const key of ['feedbackEmail','privacyContactEmail'])assert.match(signoff[key]||'',/^[^@\s]+@[^@\s]+\.[^@\s]+$/,key+' is required');
 for(const key of ['bundleIdentifierConfirmed','backendDeployed','providerRetentionVerified','privacyFormsVerified','privacyPagesFinalized','tobaccoGuidelineReviewed','physicalIPhoneTestPassed','xcodeArchiveValidated'])assert.equal(signoff[key],true,'Submission blocked: '+key);
 console.log('Owner signoff fields are complete. Verify current Apple submission requirements in App Store Connect.');
}
