# Guest Song Search Bug Fix

## Issue

When guests joined a room, the "Search YouTube to request a song" search bar was not functional. Guests could not search for or request songs.

**Symptoms:**
- Search input visible but non-responsive
- Clicking "Search" button did nothing
- No error messages
- Works fine for co-hosts and host

## Root Cause

The `handleYouTubeSearch` function in `room/[roomId].tsx` had an overly restrictive permission check:

```typescript
// ❌ BUG: Blocks regular guests from searching
const handleYouTubeSearch = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!canManageSongs || !searchQuery.trim()) return  // ONLY co-hosts/hosts allowed
  // ... rest of function
}
```

This check only allowed users with `canManageSongs` permission (host/cohost) to search. Regular guests were blocked, even though they should be able to request songs.

## Solution

Removed the `!canManageSongs` check from the search handler. All guests should be able to search:

```typescript
// ✅ FIXED: All guests can search
const handleYouTubeSearch = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!searchQuery.trim()) return  // Only validate search query
  try {
    const data = await apiClient.search(searchQuery)
    setSearchResults(data.results || [])
    console.log('🔍 Search results:', data.results?.length || 0)
  } catch (err) {
    console.error('YouTube search failed', err)
    setSearchResults([])
  }
}
```

## Changes Made

**File:** `frontend/src/pages/room/[roomId].tsx`  
**Function:** `handleYouTubeSearch` (lines 587-595)  
**Change:** Removed `!canManageSongs ||` from the initial validation

## Behavior After Fix

### Regular Guests (role: 'guest')
- ✅ Can search YouTube
- ✅ Can see search results
- ✅ Can click "Request Song" button
- ✅ Requests go to host for approval
- ❌ Cannot directly add songs to queue
- ❌ Cannot control playback

### Co-Hosts (role: 'cohost')
- ✅ Can search YouTube
- ✅ Can see search results
- ✅ Can click "+ Add to Queue" button
- ✅ Songs added directly to queue
- ✅ Can control playback
- ✅ Can manage songs

### Host (role: 'host')
- ✅ Can search YouTube
- ✅ Can see search results
- ✅ Can click "+ Add to Queue" button
- ✅ Songs added directly to queue
- ✅ Full playback control
- ✅ Can manage all songs and co-hosts

## Permission Logic Flow

```
User searches for song
  ↓
handleYouTubeSearch() triggers
  ↓
Show search results (works for ALL roles)
  ↓
User clicks on a song
  ↓
Check canManageSongs?
  ├─ YES (host/cohost) → Call handleAddSong() → song:add event
  └─ NO (guest) → Call handleRequestSong() → song:request event
  ↓
Host receives request → Approves/Denies
```

## Testing Verification

### ✅ Test Case 1: Guest Searches for Song
1. Join room as guest
2. Type song name in search box
3. Click "Search" button
4. **Expected:** Search results appear
5. **Actual (After Fix):** ✅ Working

### ✅ Test Case 2: Guest Requests Song
1. From search results
2. Click "Request Song" button
3. **Expected:** Song appears in requests panel for host
4. **Actual (After Fix):** ✅ Working

### ✅ Test Case 3: Co-Host Adds Song Directly
1. Join as guest
2. Get promoted to co-host by host
3. Search for song
4. Click "+ Add to Queue" button
5. **Expected:** Song added directly to queue
6. **Actual (After Fix):** ✅ Working

### ✅ Test Case 4: Regular Guest Cannot Add
1. Stay as guest
2. Search for song
3. Button shows "Request Song" (not "Add to Queue")
4. **Expected:** Cannot directly add, only request
5. **Actual (After Fix):** ✅ Correct

## Code Quality Improvements

### Before
```typescript
// Unclear why co-hosts only
if (!canManageSongs || !searchQuery.trim()) return
```

### After
```typescript
// Clear: only validate search query content
if (!searchQuery.trim()) return
```

The permission check is now handled in the button click handlers (`handleAddSong` vs `handleRequestSong`), which is more semantic and easier to understand.

## Permission Hierarchy

| Action | Guest | Co-Host | Host |
|--------|-------|---------|------|
| Search songs | ✅ | ✅ | ✅ |
| View results | ✅ | ✅ | ✅ |
| Request song | ✅ | - | - |
| Add song | ❌ | ✅ | ✅ |
| Remove song | ❌ | ✅ | ✅ |
| Skip/Pause | ❌ | ✅ | ✅ |
| Promote user | ❌ | ❌ | ✅ |

## Files Modified

- `frontend/src/pages/room/[roomId].tsx` (1 file)
  - Modified: `handleYouTubeSearch` function
  - Change: Removed overly restrictive permission check
  - Lines: 587-595

## Build Status

✅ Frontend builds successfully  
✅ No TypeScript errors  
✅ No runtime errors  
✅ All features still functional

## Rollback

If needed, revert to previous version:

```bash
git revert <commit-hash>
```

Change is isolated to one function with no side effects.

---

**Status:** ✅ Fixed and Tested  
**Build:** ✅ Verified  
**Date:** 2024-12-16

