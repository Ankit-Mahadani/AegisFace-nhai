# AegisFace — Open-Source Dependency Licences

All dependencies are MIT or Apache-2.0. No proprietary or paid licences.

| Package | Version | Licence | Notes |
|---------|---------|---------|-------|
| react-native | 0.85.x | MIT | Core framework |
| expo | 56.x | MIT | Bare workflow shell |
| react-native-vision-camera | 5.x | MIT | Camera + frame output |
| react-native-fast-tflite | 3.x | MIT | JSI TFLite inference |
| react-native-reanimated | 4.x | MIT | Animations |
| react-native-worklets-core | 1.x | MIT | JS worklet runtime |
| @op-engineering/op-sqlite | 16.x | MIT | Encrypted SQLite storage |
| react-native-mmkv | 4.x | MIT | Fast key-value store |
| react-native-keychain | 10.x | MIT | Secure key storage (Keystore/Keychain) |
| @react-native-community/netinfo | 12.x | MIT | Connectivity monitoring |
| react-native-svg | latest | MIT | Face overlay SVG rendering |
| @react-navigation/native | 7.x | MIT | Navigation container |
| @react-navigation/native-stack | 7.x | MIT | Stack navigator |
| react-native-screens | latest | MIT | Native screen optimisation |
| react-native-safe-area-context | latest | MIT | Safe area insets |
| react-native-device-info | latest | MIT | Device ID for event records |
| react-native-nitro-modules | latest | MIT | Used by vision-camera v5 internally |
| uuid | 11.x | MIT | UUID v4 for event IDs |
| typescript | 6.x | Apache-2.0 | Type system |

## Model licences

| Model | Source | Licence |
|-------|--------|---------|
| MobileFaceNet (weights) | Community / insightface | MIT / Apache-2.0 (check specific checkpoint) |
| face_landmarker.task | Google MediaPipe Model Cards | Apache-2.0 |
| MiniFASNet (optional) | minivision-tech/Silent-Face-Anti-Spoofing | Apache-2.0 |
| MediaPipe Tasks SDK (Android) | Google | Apache-2.0 |
| MediaPipe Tasks SDK (iOS) | Google | Apache-2.0 |

## Verification

Run `npm ls --depth=0` to list all direct dependencies.  
Use `npx license-checker --summary` to audit the full transitive licence tree.

All source code in this repository is released under MIT unless otherwise noted.
