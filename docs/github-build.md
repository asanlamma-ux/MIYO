# GitHub Build Guide

This repository includes a GitHub Actions workflow for Android debug builds.

## Workflow file

- `.github/workflows/android-build.yml`

## What it does

On every push to `main`, pull request to `main`, or manual workflow run:

1. Checks out the repository
2. Installs Java 17
3. Installs the Android SDK
4. Validates the Gradle wrapper
5. Builds the debug APK with `./gradlew assembleDebug`
6. Uploads the APK as a workflow artifact

## Where to download the APK

After a workflow run completes:

1. Open the GitHub repository
2. Go to `Actions`
3. Open the workflow run
4. Download the `miyo-debug-apk` artifact

## Recommended next steps

For production releases, add:

- a release workflow triggered by tags
- signing secrets in GitHub repository settings
- `bundleRelease` or `assembleRelease`
- Play Store delivery or release asset upload

## Notes

- This workflow builds a debug APK only, so no signing secrets are required.
- The current app also contains native C++ code, so the workflow uses the Android SDK setup before building.
