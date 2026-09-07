# TubeShelf state synchronization standard

## Source of truth

`chrome.storage.local.tubeShelfState` is the durable source of truth. The background service worker is its only writer. Dashboard, popup, and YouTube content scripts may read state, but must never call `chrome.storage.local.set()` for `tubeShelfState`.

## Mutation protocol

Frontends send a `TUBESHELF_MUTATE` runtime message containing one semantic operation. Supported operations are implemented by `TubeShelfCore.applyStateOperation()`:

- `toggle-membership`
- `bulk-membership`
- `set-subscription`
- `coalesce-channel-identities`
- `set-setting`
- `set-language`
- `set-onboarding-complete`
- `save-group`
- `merge-groups`
- `delete-group`
- `apply-auto-suggestions`
- `patch-channels`
- `reconcile-subscription-scan`
- `replace-state`
- `reset-state`

The background service worker serializes operations through one promise queue. For every operation it:

1. Reads the latest stored state.
2. Normalizes and validates the operation against that state.
3. Applies only the requested intent.
4. Increments `revision`.
5. Writes the complete normalized result once.
6. Returns that exact committed state to the caller.

Install/update schema migration uses the same queue and also advances `revision`, so already-open frontends cannot mistake a normalized migration for an old duplicate.

Do not add a frontend code path that accepts a state snapshot and writes it back. Add a semantic operation instead.

## Channel identity standard

YouTube may represent one channel as a readable `/@handle` URL on subscription cards and a `/channel/UC...` canonical URL elsewhere. Channel records keep an immutable local key, while `channelAliases` maps every strongly verified YouTube identity to that record. New records normally begin with the scanned handle as their local key; learning a stable channel ID adds an alias and never requires changing an already unambiguous key.

The scan-page Main-world bridge reads `browseId` and `canonicalBaseUrl` from the same YouTube renderer and sends only validated identity pairs to the isolated TubeShelf content script. Channel and watch pages submit their canonical path as another strong alias source. `coalesce-channel-identities` merges duplicate channel records, group memberships, manual learning labels, and the newest cached metadata. Membership and subscription operations carry the same alias context so a user action cannot recreate the split identity. Display names are never identity evidence.

## Frontend refresh standard

Each frontend keeps a read-only in-memory cache. A committed state may arrive through the mutation response or `chrome.storage.onChanged`; the frontend accepts it only when its `revision` is newer than the cached revision. The first accepted copy renders the UI and a duplicate copy is ignored.

YouTube SPA navigation is separate from state synchronization. Page navigation reapplies controls and card filters from the current cache. Subscription group selection is mirrored to `#tubeshelf-group=...` and reparsed after navigation or hash changes.

## Long-running metadata work

`settings.enabled` is the persistent global YouTube integration power state (missing values default to `true`). The popup changes it using `set-setting` through the background queue. Turning off retains channels, aliases, groups and individual settings, tears down filtering/UI/observers in every content tab, and stops identity inspection. Disabled tabs still accept storage revisions so enabling restores current state without a reload. Automatic subscription and identity operations are rejected while disabled; an interrupted full scan must not reconcile a partial list. Already-completed navigation is not reversed; a TubeShelf-disabled autoplay toggle is restored only when its original element remains connected and the user has not manually changed it.

Network work must run against cloned channel objects. On completion it sends `patch-channels`; it must not save the snapshot used to start the work. Local profile data and official metadata are merged only when their timestamps are at least as new as the stored values.

## Subscription scan reconciliation

`reconcile-subscription-scan` is reserved for a completed full subscription scan. It resolves and coalesces all strong identities first, upserts the observed subscriptions as one batch, then removes records that are definitively absent. Canonical-only legacy records without enough identity evidence are preserved until they can be resolved; they are never deleted merely because the scan returned only handles.

The whole batch normalizes once before reconciliation and once before commit. Do not normalize once per channel. If more than 15 percent of an existing shelf, or more than ten channels, would be definitively removed, the operation fails with `SCAN_SHRINK_GUARD`. The old state remains untouched. A large removal requires explicit user confirmation before resubmitting with `allowLargeRemoval`.

Import and reset use explicit `replace-state` and `reset-state` operations. Imported data always passes through the strict persisted-state schema before commit.
