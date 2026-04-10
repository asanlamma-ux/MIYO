# MIYO

MIYO is an Android-first visual novel maker built with Kotlin, Jetpack Compose, and a small C++ runtime bridge.

This workspace contains:

- `app/`: Android app source
- `tuesday-js/`: reference clone used for importer design and feature parity study

Implemented MVP scope:

- modern editor shell with library, graph, scene, variables, manual, docs, and sync surfaces
- typed project model as source of truth
- starter template and bundled documentation
- partial Tuesday JS JSON importer
- ZIP export/import helpers
- Supabase backup/sync hooks
- native C++ bridge for interpolation and condition evaluation
- GitHub Actions Android build workflow with artifact upload

Notes:

- The local environment here does not have Java or Gradle installed, so the project was not compiled in this session.
- Dependency choices and project structure are set up for Android Studio / Gradle-based import.

## GitHub Build

The repository includes a GitHub Actions workflow at `.github/workflows/android-build.yml`.

It runs on:

- pushes to `main`
- pull requests to `main`
- manual `workflow_dispatch`

It performs:

- Java 17 setup
- Android SDK setup
- Gradle wrapper validation
- debug APK build
- artifact upload for the generated APK

Guide:

- [docs/github-build.md](/root/MIYO/docs/github-build.md)
