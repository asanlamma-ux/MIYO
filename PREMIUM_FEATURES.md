# Premium Subscription Features - Miyo EPUB Reader

## Overview
This document outlines features that will be locked behind a premium subscription. The app provides excellent free functionality, but premium users get advanced features.

## Free Features (Basic)
- Import and read EPUB books
- Basic reading progress tracking
- Manual reading status (unread/reading/finished)
- Basic bookmarks and highlights
- Theme customization (light/dark)
- Typography settings
- 3 term groups max
- 50 terms per group max
- Basic reading stats (daily goal, streak)
- Library organization (sort/filter)

## Premium Features (Locked)

### 1. Advanced Term Groups
- Unlimited term groups
- Unlimited terms per group
- Term group import/export (ZIP)
- Community term groups access
- Pre-made term groups download

### 2. Cloud Sync (Google Drive)
- Auto-sync reading progress
- Cloud backup and restore
- Term group cloud storage
- Cross-device sync
- Auto-detect and sync from Drive

### 3. Advanced Reading Stats
- Detailed reading analytics
- Weekly/monthly reports
- Time per chapter analytics
- Reading pace trends
- Completion rate tracking

### 4. Enhanced Library Features
- Duplicate book detection (auto-skip)
- Bulk import
- Custom collections
- Reading challenges
- Book recommendations

### 5. Advanced Reader Features
- Annotation sharing
- Note exporting (PDF, Markdown)
- Multi-book notes
- Chapter notes
- Voice navigation

### 6. Premium Support
- Priority support
- Early access to features
- Beta feature access

## Implementation Notes

### Subscription Tiers (Future)
```
Basic (Free):
- All current features
- 3 term groups
- 50 terms/group

Premium Monthly ($2.99/month):
- Unlimited terms
- Cloud sync (10GB)
- Advanced stats
- Priority support

Premium Yearly ($24.99/year):
- All Premium features
- 50GB cloud storage
- Early access
- 2 months free
```

### Detection Logic
```typescript
// Check subscription status
const isPremium = user?.subscriptionStatus === 'premium';

// Feature gate example
if (!isPremium && termGroups.length >= 3) {
  showPremiumUpgradeModal();
}
```

### Database Additions Needed
- users table with subscription fields
- subscriptions table
- usage_tracking table

## Migration Path
- Current free users keep access
- Grace period for existing data
- Clear upgrade prompts in-app
- No forced migration

---

*Last Updated: 2026-04-06*
*This is for future implementation - app is still in beta*
