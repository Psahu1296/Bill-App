# Fix: Auto-Update Blocked by Unsigned Installer

## Problem
Auto-updates fail on Windows because `Dhaba.POS.Setup.x.x.x.exe` is not digitally signed. Two things break:

1. `electron-updater` has `publisherName: Dhaba POS` set in `electron-builder.yml` — this embeds publisher info in `latest.yml` and attempts to verify the Authenticode signature of the downloaded installer. With an unsigned build this verification throws and the update silently fails.
2. Windows SmartScreen blocks unsigned installers (especially on first-run and silent auto-update installs).

---

## Track 1 — Immediate Fix (Unsigned Builds)

### `electron-builder.yml` — comment out `publisherName`

```yaml
win:
  artifactName: "Dhaba.POS.Setup.${version}.${ext}"
  target:
    - target: nsis
      arch:
        - x64
  rfc3161TimeStampServer: http://timestamp.digicert.com
  signingHashAlgorithms:
    - sha256
  # publisherName: Dhaba POS   ← comment out until a cert is obtained
  # When set, electron-updater embeds it in latest.yml and verifies the
  # downloaded installer's Authenticode signature against it.
  # Unsigned builds have no Authenticode — the check throws, update fails.
```

### `electron/main.ts` — disable code-signature verification

In the `if (!isDev)` block (around line 260), add one line before `checkForUpdates`:

```ts
if (!isDev) {
  autoUpdater.autoDownload    = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Disable Authenticode publisher check for unsigned builds.
  // Remove this line once WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD are configured.
  (autoUpdater as any).verifyUpdateCodeSignature = false;
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}
```

> `verifyUpdateCodeSignature` is a property on `NsisUpdater` (the Windows-specific subclass of `AppUpdater`). A cast is needed to avoid a TS error since the exported type is the base class.

---

## Track 2 — Proper Fix (Code Signing Certificate)

No additional code changes needed — the CI workflow already has the wiring. Steps:

### 1. Get a certificate
| Type | Cost | SmartScreen |
|------|------|-------------|
| **OV** (Organization Validated) | ~$100–300/yr | Warns until reputation builds (weeks–months of installs) |
| **EV** (Extended Validation) | ~$400–700/yr | Bypasses SmartScreen immediately ✓ Recommended |

Providers: DigiCert, Sectigo, SSL.com.

### 2. Export as .pfx and add GitHub Secrets

| Secret name | Value |
|---|---|
| `WIN_CSC_LINK` | Base64-encoded `.pfx` file contents |
| `WIN_CSC_KEY_PASSWORD` | Password set on the `.pfx` |

Encode on Windows:
```
certutil -encode cert.pfx cert_b64.txt
# copy everything between the header/footer lines
```

Encode on macOS / Linux:
```
base64 -i cert.pfx | pbcopy
```

### 3. Restore `publisherName` in `electron-builder.yml`

Set it to the **exact Common Name (CN)** on the certificate:
```yaml
publisherName: Pankaj Sahu   # must match cert CN exactly
```

### 4. Remove the `verifyUpdateCodeSignature = false` line from `main.ts`
Signed builds don't need it; keeping it would be a small security regression.

---

## Verification

### Track 1 (Unsigned)
1. Tag a new release, let CI build
2. Install the new `.exe` — SmartScreen may warn once ("Unknown publisher") but allows proceeding
3. Install an older version, trigger auto-update → Download → Restart & Install — should complete without errors

### Track 2 (Signed)
1. Build with `WIN_CSC_LINK` env set, verify: `signtool verify /pa /v Dhaba.POS.Setup.x.x.x.exe`
2. First install should show no SmartScreen warning (EV) or reduced warning (OV)
3. Auto-update flow should complete silently without any dialog

---

## Summary of Code Changes (Track 1 — immediate)

| File | Change |
|------|--------|
| `electron-builder.yml` | Comment out `publisherName: Dhaba POS` |
| `electron/main.ts` | Add `(autoUpdater as any).verifyUpdateCodeSignature = false` in the `if (!isDev)` block |
