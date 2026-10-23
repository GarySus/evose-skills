# Changelog

## 0.1.0 - 2026-10-23

### Features

- Distribute `evose-platform-manager` and `evose-agent-interaction` as independently discoverable skills.
- Include navigation helpers, configurable trusted Evose origins and local learning storage that survives skill upgrades.
- Support installation through the existing Skills CLI with a pinned CLI version.

### Distribution

- Publish versioned ZIP and npm tarball downloads with SHA-256 checksums in GitHub Releases.
- Publish `@garysus/evose-skills` to GitHub Packages from the release workflow.
- Include installation, maintenance and troubleshooting guides, plus light and dark README illustrations.

### Validation

- Check public-file boundaries, skill metadata, local links, navigation and learning behavior.
- Exercise the real Skills CLI twice in a temporary home to verify installation, upgrades and preservation of private learning data.

Evose still requires the user's own account, permissions and an authenticated ego lite browser. Local checks do not replace verification against the current Evose deployment.
