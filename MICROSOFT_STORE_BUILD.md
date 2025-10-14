# Microsoft Store Build Guide

## Overview
This guide explains how to build Vybez Chat for Microsoft Store submission, ensuring compliance with Store policies.

## Store Compliance Features

### Automatic Download Link Hiding
When built for Microsoft Store (`IS_STORE_BUILD=true`), the app automatically:
- Hides all "Downloads" navigation links
- Removes download buttons for other platforms
- Prevents users from accessing the downloads page
- Complies with Store Policy 10.1.5 (no external software distribution)

### How It Works
1. **Environment Detection**: The `IS_STORE_BUILD` environment variable is set during build
2. **Preload Script**: `preload.js` exposes `electronAPI.isStoreApp` flag to renderer
3. **Store Compliance Script**: `store-compliance.js` automatically hides download links
4. **Pages Protected**: `desktop-login.html` and `chat.html` include the compliance script

## Building for Microsoft Store

### Standard Build (with Download Links)
```bash
npm run dist:win
```
Outputs: NSIS installer and portable .exe with download links visible

### Microsoft Store Build (Download Links Hidden)
```bash
npm run dist:win-store
```
Outputs: `.appx` package with download links automatically hidden

### Build Configuration
The Store build uses these settings in `package.json`:
- **Identity Name**: `9NN89Z3HS891` (Store ID)
- **Application ID**: `VybezChat`
- **Publisher**: `Vybez Team`
- **Background Color**: `#5b2bff` (brand purple)

## Testing Store Compliance

### Before Submitting
1. Build with `npm run dist:win-store`
2. Install the `.appx` package locally
3. Launch the app and verify:
   - ✅ No "Downloads" link in navigation
   - ✅ No download buttons visible
   - ✅ Cannot access downloads page
   - ✅ App functions normally otherwise

### Local Testing
```bash
# Set environment variable for testing
cross-env IS_STORE_BUILD=true npm run electron
```

## Certification Issues Addressed

### 10.1.5 Software Distribution ✅ FIXED
**Issue**: "The product promotes downloading software outside the Store"
**Solution**: Download links automatically hidden when `isStoreApp === true`

### 10.1.4.6 Misleading Content
**Issue**: "Content does not accurately represent the product"
**Solution**: Ensure app description in Microsoft Partner Center accurately describes Vybez as a real-time chat application with unique features (custom rooms, reactions, file sharing, etc.)

## File Changes Summary

### Modified Files
- `preload.js` - Added `isStoreApp` detection
- `public/chat.html` - Added store-compliance.js script
- `public/desktop-login.html` - Added store-compliance.js script
- `package.json` - Added Store build script and appx config

### New Files
- `public/store-compliance.js` - Auto-hides download links for Store builds
- `MICROSOFT_STORE_BUILD.md` - This documentation

## Partner Center Setup

### Application Details
- **Store ID**: 9NN89Z3HS891
- **Product Name**: Vybez Chat
- **Category**: Social & Communication

### Unique Features to Highlight
1. Real-time messaging with Socket.IO
2. Custom chat rooms (user-created)
3. Private messaging with read receipts
4. Message reactions and typing indicators
5. File sharing (images, docs, videos)
6. User profiles with avatars and bios
7. Desktop notifications and system tray
8. Always-on-top window mode
9. Auto-launch on startup
10. Neon nightlife aesthetic UI

## Next Steps

1. ✅ Build with `npm run dist:win-store`
2. ✅ Test the `.appx` package locally
3. ✅ Upload to Microsoft Partner Center
4. ✅ Update app description to highlight unique features
5. ✅ Resubmit for certification
