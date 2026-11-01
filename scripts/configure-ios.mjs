import {readFile,writeFile} from 'node:fs/promises';
import plist from 'plist';
const path='ios/App/App/Info.plist';const info=plist.parse(await readFile(path,'utf8'));
Object.assign(info,{
 NSCameraUsageDescription:'Take a cigar-label photo when you choose a lookup. AI sharing requires separate permission.',
 NSPhotoLibraryUsageDescription:'Choose photos for your cigar collection or an optional AI lookup.',
 NSPhotoLibraryAddUsageDescription:'Save a photo only when you explicitly choose to export it.',
 ITSAppUsesNonExemptEncryption:false,
 CFBundleDisplayName:'Torcida'
});
await writeFile(path,plist.build(info)+'\n');
const projectPath='ios/App/App.xcodeproj/project.pbxproj';let project=await readFile(projectPath,'utf8');
const pkg=JSON.parse(await readFile('package.json','utf8')),config=JSON.parse(await readFile('capacitor.config.json','utf8'));
project=project.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,'PRODUCT_BUNDLE_IDENTIFIER = '+config.appId+';').replace(/MARKETING_VERSION = [^;]+;/g,'MARKETING_VERSION = '+pkg.version+';').replace(/TARGETED_DEVICE_FAMILY = "1,2";/g,'TARGETED_DEVICE_FAMILY = 1;');
if(!project.includes('PrivacyInfo.xcprivacy in Resources')){
 project=project.replace('/* Begin PBXBuildFile section */','/* Begin PBXBuildFile section */\n\t\tA17000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A17000000000000000000002 /* PrivacyInfo.xcprivacy */; };');
 project=project.replace('/* Begin PBXFileReference section */','/* Begin PBXFileReference section */\n\t\tA17000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };');
 project=project.replace('504EC3131FED79650016851F /* Info.plist */,','504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tA17000000000000000000002 /* PrivacyInfo.xcprivacy */,');
 project=project.replace('504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,','504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\tA17000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,');
}
await writeFile(projectPath,project);
const manifest={NSPrivacyTracking:false,NSPrivacyTrackingDomains:[],NSPrivacyAccessedAPITypes:[{NSPrivacyAccessedAPIType:'NSPrivacyAccessedAPICategoryFileTimestamp',NSPrivacyAccessedAPITypeReasons:['C617.1']}],NSPrivacyCollectedDataTypes:['NSPrivacyCollectedDataTypePhotosorVideos','NSPrivacyCollectedDataTypeOtherUserContent','NSPrivacyCollectedDataTypeOtherDataTypes'].map(type=>({NSPrivacyCollectedDataType:type,NSPrivacyCollectedDataTypeLinked:true,NSPrivacyCollectedDataTypeTracking:false,NSPrivacyCollectedDataTypePurposes:['NSPrivacyCollectedDataTypePurposeAppFunctionality']}))};
await writeFile('ios/App/App/PrivacyInfo.xcprivacy',plist.build(manifest)+'\n');
console.log('iPhone target, permission descriptions and privacy manifest configured. Signing team remains yours to select.');
