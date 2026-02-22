# Version Locations

All files that must be updated when bumping the version. "Bump version everywhere" means all of these **except** `appcast.xml` (only touch appcast when cutting a new macOS Sparkle release).

| File | Field(s) |
| --- | --- |
| `package.json` | `version` (CLI) |
| `apps/android/app/build.gradle.kts` | `versionName`, `versionCode` |
| `apps/ios/Sources/Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |
| `apps/ios/Tests/Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |
| `apps/macos/Sources/OpenClaw/Resources/Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |
| `docs/install/updating.md` | Pinned npm version |
| `docs/platforms/mac/release.md` | `APP_VERSION`, `APP_BUILD` examples |
| Peekaboo Xcode projects / `Info.plist` files | `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` |

## Notes

- `appcast.xml`: only update when cutting a new macOS Sparkle release, not for every version bump.
- See `docs/platforms/mac/release.md` for the full macOS release checklist.
