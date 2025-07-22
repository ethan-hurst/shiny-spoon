# Real-time Inventory Features

This document explains the real-time inventory synchronization features implemented in TruthSource.

## Features Overview

### 1. Connection Status Indicator

- **Visual indicator**: Shows current connection status (green/yellow/red)
- **Latency display**: Real-time latency measurements
- **Quality metrics**: Connection quality assessment (excellent/good/fair/poor)
- **Recommendations**: Automatic suggestions for poor connections

### 2. Optimistic Updates

- **Instant feedback**: Changes appear immediately in the UI
- **Automatic rollback**: Failed updates revert automatically
- **Visual indicators**: Pending updates show sync status
- **Conflict detection**: Identifies when multiple users edit the same item

### 3. Offline Queue System

- **Persistent storage**: Uses IndexedDB to store updates offline
- **Automatic sync**: Queued changes sync when connection restored
- **Queue indicator**: Shows number of pending operations
- **Manual sync**: Option to trigger sync manually

### 4. Conflict Resolution

- **Side-by-side comparison**: Shows your changes vs server values
- **Resolution options**: Keep local, use server, or manual merge
- **Field-level tracking**: Identifies exactly which fields changed
- **User attribution**: Shows who made conflicting changes

### 5. Real-time Presence

- **Active user avatars**: See who's viewing/editing inventory
- **Activity indicators**: Green dot for active users
- **Hover details**: User name, email, and last activity
- **Auto-cleanup**: Stale presence removed after 5 minutes

### 6. Performance Monitoring

- **Health score**: Overall system health (0-100)
- **Key metrics**: Latency, reconnections, drop rate, subscriptions
- **Visual charts**: Latency distribution over time
- **Recommendations**: Automatic performance suggestions

## Architecture

### State Management Layers

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI Layer      │────▶│  Optimistic      │────▶│   Server        │
│                 │◀────│  State Layer     │◀────│   (Supabase)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          │
                        ┌──────────────────┐              │
                        │  Offline Queue   │◀─────────────┘
                        └──────────────────┘
```

### Message Flow

1. User makes change → Optimistic update applied
2. Change sent to server → If online, direct sync
3. If offline → Queue operation in IndexedDB
4. On reconnect → Process queue with conflict detection
5. Conflicts → Show resolution UI
6. Resolution → Apply final state

## Usage

### Basic Setup

```typescript
// In your inventory component
import { useOptimisticInventory } from '@/hooks/use-optimistic-inventory'

function InventoryTable({ initialData }) {
  const { inventory, updateInventory, getItemStatus } =
    useOptimisticInventory(initialData)

  // Updates are automatically optimistic
  const handleUpdate = async (id, changes) => {
    await updateInventory(id, changes)
  }
}
```

### Monitoring Connection

```typescript
import { RealtimeConnectionManager } from '@/lib/realtime/connection-manager'

const manager = RealtimeConnectionManager.getInstance()
const status = manager.getStatus()
console.log('Connection:', status.state, status.quality)
```

### Handling Conflicts

Conflicts are automatically detected and the UI will show a resolution dialog. Users can:

- Keep their local changes
- Accept server changes
- Manually merge (for complex objects)

## Performance Considerations

### Network Adaptation

The system automatically adapts behavior based on network quality:

- **Excellent**: Real-time sync with immediate updates
- **Good**: Optimistic updates with background sync
- **Fair**: Batched updates to reduce traffic
- **Poor**: Offline mode with queued updates

### Optimization Tips

1. **Batch updates**: Multiple changes within 100ms are batched
2. **Channel pooling**: Reuses WebSocket connections
3. **Lazy presence**: Only tracks visible items
4. **Smart reconnection**: Exponential backoff prevents server overload

## Troubleshooting

### Common Issues

**"Updates not syncing"**

- Check connection indicator in header
- Verify offline queue badge
- Try manual sync button

**"Seeing conflicts frequently"**

- Ensure users are on latest version
- Check for clock synchronization issues
- Consider enabling auto-merge for simple fields

**"Performance degraded"**

- Check performance widget metrics
- Review recommendations
- Consider reducing subscription count

## Security Notes

- All optimistic updates are re-validated server-side
- RLS policies apply to all real-time subscriptions
- Presence data is sanitized before broadcasting
- Offline queue is encrypted in IndexedDB
