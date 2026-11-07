# Echo Music Mini-App: Spotify Link → YouTube Audio Player

**Date:** 2026-11-06  
**Status:** Draft — awaiting builder check & user approval  
**Phase:** 3 (Bot Infrastructure)  

---

## 1. Intent & Why

Users paste Spotify track/album/playlist links in Echo (Matrix-based chat). Instead of leaving the app to listen, they get an **in-app music mini-app**: a toast notification with album art + track info that opens a **full-featured modal player** synced per room via Matrix. The bot resolves Spotify metadata → finds audio on YouTube → streams via LiveKit into the voice room.

**Core principle:** One bot instance per room (activated on demand), state synced through Matrix events, UI native to Echo desktop (Tauri + React).

---

## 2. Goals

| Goal | Success Criteria |
|------|------------------|
| **Spotify link → playable audio in < 3s** | Median p95 from paste to first Opus frame in LiveKit |
| **Per-room isolation** | Bot only joins rooms where user explicitly invokes `!play` or clicks "Tocar" on notification; no auto-join |
| **Matrix-synced queue state** | All participants see same queue, now-playing, position; survives reload/reconnect |
| **Rich modal player** | Play/pause, next/prev, seek, volume, queue list with drag-reorder, per-track attribution (avatar + name), clear queue |
| **Dual notifications** | (1) Track added to queue → toast with art/title/duration. (2) Track starts playing → toast with "Tocando agora" |
| **Legal safety** | Spotify Web API only for metadata (public endpoints, no auth). Audio from YouTube via yt-dlp (personal use). No librespot. |
| **E2EE aware** | Bot only operates in unencrypted voice rooms; gracefully degrades in encrypted rooms |

---

## 3. Non-Goals / Anti-Goals

| Non-Goal | Reason |
|----------|--------|
| Spotify native streaming (librespot) | Reverse-engineered, ToS violation, brittle |
| User-hosted music library (Navidrome/Subsonic) | User explicitly declined |
| Cross-room queue (global playlist) | User wants per-room isolation |
| Mobile/web Echo support in v1 | Desktop Tauri only; mobile later |
| DJ roles / permissions | MVP: anyone in room can control; permissions v2 |
| Lyrics, recommendations, scrobbling | Out of scope |

---

## 4. Constraints

| Constraint | Impact |
|------------|--------|
| **Echo stack:** Tauri 2 + React 18 + TypeScript + Matrix JS SDK | Mini-app = React components + Tauri commands |
| **Matrix:** Synapse homeserver, E2EE by default | Bot cannot decrypt encrypted rooms → voice rooms must be unencrypted |
| **Voice:** LiveKit SFU (self-hosted on Coolify/Oracle) | Bot publishes audio as LiveKit participant |
| **Bot SDK:** `matrix-bot-sdk` (Node.js/TypeScript) | Runs on server (Coolify), not in Tauri |
| **Audio pipeline:** yt-dlp → ffmpeg (Opus 128kbps) → LiveKit Node SDK | Server-side only; Tauri never handles raw audio |
| **Auth:** Spotify PKCE OAuth in Tauri → tokens in OS keyring | Reuse existing `sso.rs` / `keyring_cmds.rs` patterns |
| **Rate limits:** Spotify Web API (public, no auth for track lookup), YouTube (yt-dlp handles) | Cache metadata; exponential backoff |

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ECHO DESKTOP (Tauri + React)                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐  │
│  │ Chat View    │    │ Toast Manager   │    │ MusicModal (React)       │  │
│  │ - Detects    │───▶│ - QueueAdded    │───▶│ - NowPlaying + Controls  │  │
│  │   Spotify URLs│    │ - NowPlaying    │    │ - Queue List (DnD)       │  │
│  │ - "Tocar" btn│    │ - Persistent ID │    │ - Attribution chips      │  │
│  └──────┬───────┘    └────────┬────────┘    └────────────┬─────────────┘  │
│         │                     │                          │                │
│         │ Matrix Events       │ Matrix Events            │ Matrix Events  │
│         ▼                     ▼                          ▼                │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              Matrix Client (matrix-js-sdk)                         │  │
│  │  - Room state events (queue, now-playing, position)               │  │
│  │  - Account data (user preferences: volume, autoplay)              │  │
│  │  - Ephemeral events (typing, presence) for "user added track"     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Matrix (HTTPS/WSS)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MUSIC BOT (Node.js on Coolify)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Matrix Listener│ │ Queue Manager │ │ YouTube Resolver│ │ LiveKit Publisher│ │
│  │ - m.room.message│ │ - Per-room    │ │ - Spotify API  │ │ - Opus frames   │ │
│  │   (spotify URLs)│ │   queue state │ │   (metadata)   │ │   via ffmpeg    │ │
│  │ - !play/!skip   │ │ - Persistence │ │ - yt-dlp search│ │ - Room:         │ │
│  │   !queue !clear │ │   (Matrix     │ │   + ISRC match │ │   music-{roomId}│ │
│  └──────┬────────┘ └──────┬────────┘ └──────┬────────┘ └────────┬────────┘  │
│         │                 │                 │                 │            │
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                                    │                                        │
│                              Matrix Events (state)                         │
│                              LiveKit (UDP)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Matrix Event Schema (State Events)

All per-room state stored as **state events** in the voice room (or associated chat room), keyed by `roomId`.

### 6.1 Queue State Event
```
Type: `io.echo.music.queue`
State Key: `{roomId}` (voice room ID)
Content:
{
  "version": 1,
  "queue": [
    {
      "id": "yt_dlp_hash_abc123",           // unique per enqueue
      "spotifyUrl": "https://open.spotify.com/track/...",
      "spotifyMetadata": {
        "trackId": "4cOdK2wGLETKBW3PvgPWqT",
        "name": "Blinding Lights",
        "artists": [{"name": "The Weeknd"}],
        "album": {"name": "After Hours", "images": [{"url": "..."}]},
        "durationMs": 200000,
        "isrc": "USUG12000123"
      },
      "youtube": {
        "videoId": "dY5YfE0kY2I",
        "title": "The Weeknd - Blinding Lights (Official Video)",
        "url": "https://youtube.com/watch?v=dY5YfE0kY2I",
        "durationSec": 200,
        "thumbnailUrl": "https://i.ytimg.com/vi/dY5YfE0kY2I/maxresdefault.jpg",
        "audioUrl": "https://.../audio.opus"  // signed, short-lived
      },
      "addedBy": {
        "userId": "@alice:echo.example.com",
        "displayName": "Alice",
        "avatarUrl": "mxc://..."
      },
      "addedAt": "2026-11-06T15:30:00.000Z",
      "status": "queued"  // "queued" | "playing" | "played" | "failed"
    }
  ],
  "currentIndex": 0,
  "playback": {
    "state": "playing",  // "playing" | "paused" | "stopped"
    "positionMs": 45000,
    "updatedAt": "2026-11-06T15:30:45.000Z",
    "volume": 0.8
  },
  "settings": {
    "autoplay": true,
    "repeat": "off",  // "off" | "queue" | "track"
    "shuffle": false
  }
}
```

### 6.2 Now-Playing Ephemeral Event (for live position sync)
```
Type: `io.echo.music.now_playing` (ephemeral / `m.ephemeral` or to-device)
Content:
{
  "roomId": "!voiceRoom:echo.example.com",
  "trackId": "yt_dlp_hash_abc123",
  "positionMs": 45000,
  "durationMs": 200000,
  "state": "playing",
  "timestamp": "2026-11-06T15:30:45.000Z"
}
```
*Sent every 2s while playing; clients interpolate locally.*

### 6.3 Track Added Notification (triggers toast)
```
Type: `io.echo.music.track_added` (ephemeral, per-user or room-wide)
Content:
{
  "roomId": "!voiceRoom:echo.example.com",
  "queueEventId": "yt_dlp_hash_abc123",
  "track": { ... },  // same as queue item
  "positionInQueue": 3
}
```

### 6.4 Track Started Notification (triggers "Tocando agora" toast)
```
Type: `io.echo.music.track_started` (ephemeral)
Content:
{
  "roomId": "!voiceRoom:echo.example.com",
  "queueEventId": "yt_dlp_hash_abc123",
  "track": { ... }
}
```

---

## 7. UI/UX Specification

### 7.1 Toast Notification (Queue Added)

```
┌─────────────────────────────────────────────────────────────┐
│ 🎵  Adicionado à fila: The Weeknd - Blinding Lights    3:20 │
│      ┌─────┐                                                │
│      │ img │  [Tocar agora]  [Ver fila]  ✕                  │
│      └─────┘                                                │
└─────────────────────────────────────────────────────────────┘
```
- **Position:** Bottom-right (desktop), slides up
- **Duration:** 8s auto-dismiss, pause on hover
- **Actions:**
  - `Tocar agora` → jumps to front of queue, starts playback, opens modal
  - `Ver fila` → opens MusicModal at queue tab
  - Click track area → opens MusicModal at now-playing
- **Persisted:** Dismissed toasts don't reappear; queue state in Matrix

### 7.2 Toast Notification (Now Playing)

```
┌─────────────────────────────────────────────────────────────┐
│ ▶  Tocando agora: The Weeknd - Blinding Lights         3:20 │
│      ┌─────┐                                                │
│      │ img │  [Abrir player]  ✕                             │
│      └─────┘                                                │
└─────────────────────────────────────────────────────────────┘
```
- **Trigger:** Bot sends `track_started` ephemeral event
- **Action:** `Abrir player` → opens MusicModal at now-playing tab

### 7.3 MusicModal (Full Player)

**Layout:** 520px wide × 600px tall, centered, backdrop blur, draggable header

```
┌────────────────────────────────────────────────────────────┐
│ 🎵  Player de Música — Sala: "Geral"                    ✕ │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NOW PLAYING                                         │  │
│  │  ┌────────┐  Blinding Lights                         │  │
│  │  │ 300×300│  The Weeknd · After Hours                │  │
│  │  │  art   │  ████████░░░░░░░░░░░░░░░░░░░░  1:45/3:20 │  │
│  │  └────────┘  🔀  🔁  ⏮  ⏸  ⏭  🔊━━━━━━━━━━━━━━━━  │  │
│  │         Adicionado por Alice · 3/8 na fila           │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  QUEUE                              [Limpar fila] [🔀] [🔁]│
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1 ▶ Blinding Lights          The Weeknd      3:20  👤│  │
│  │ 2   Save Your Tears          The Weeknd      3:35  👤│  │
│  │ 3   Levitating               Dua Lipa        3:23  👤│  │
│  │ 4   Good 4 U                 Olivia Rodrigo  2:58  👤│  │
│  │ 5   Stay                     The Kid LAROI   2:21  👤│  │
│  │        ↳ Drag handle (☰) on hover to reorder         │  │
│  │        Click to jump; right-click: remover, mover    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Tabs (top of content area):**
- **Tocando agora** (default) — large art, seek bar, full controls
- **Fila** — compact list, drag-reorder, attribution chips

**Controls:**
| Control | Action | Matrix Event |
|---------|--------|--------------|
| Play/Pause | Toggle `playback.state` | `io.echo.music.queue` patch |
| Next | `currentIndex++`, play next | Queue state update |
| Previous | `currentIndex--` (if > 0) or restart current | Queue state update |
| Seek (drag) | Set `playback.positionMs` | Queue state + ephemeral `now_playing` |
| Volume | Set `playback.volume` (0-1) | Queue state (persisted) |
| Shuffle | Toggle `settings.shuffle` | Queue state |
| Repeat | Cycle `off → queue → track` | Queue state |
| Clear queue | Empty `queue`, stop playback | Queue state |
| Remove track | Delete from `queue` | Queue state |
| Reorder (DnD) | Move array indices | Queue state |

**Attribution chip:** `👤 Alice` (avatar tooltip on hover) — shows who added each track.

**Keyboard shortcuts:** Space=play/pause, ←/→=seek ±10s, ↑/↓=volume, N=next, P=prev.

---

## 8. Bot Architecture (Server-Side)

### 8.1 Components

| Component | Responsibility | Tech |
|-----------|----------------|------|
| **MatrixListener** | Listen for `m.room.message` with Spotify URLs, `!play`, `!skip`, `!queue`, `!clear`, `!pause`, `!volume` | `matrix-bot-sdk` |
| **QueueManager** | Per-room queue CRUD, persist to Matrix state events, emit ephemeral events | In-memory + Matrix state |
| **SpotifyResolver** | `GET /v1/tracks/{id}` (public, no auth) → metadata + ISRC | `spotify-web-api-node` or fetch |
| **YouTubeResolver** | `yt-dlp -J "ytsearch1:artist track"` → match by ISRC, duration ±3s | `yt-dlp-exec` or spawn |
| **AudioPipeline** | `yt-dlp -f "bestaudio" -o - URL \| ffmpeg -i - -c:a libopus -b:a 128k -f opus -` → stdout → LiveKit | Node `child_process`, `@livekit/rtc-node` |
| **LiveKitPublisher** | Join `music-{roomId}` room, publish Opus track, handle reconnection | `@livekit/server-sdk` + `@livekit/rtc-node` |

### 8.2 Bot Lifecycle per Room

```
User clicks "Tocar agora" or sends !play
       │
       ▼
Bot checks: Is room encrypted? → Yes → Reply "Sala criptografada não suportada" → STOP
       │
       ▼
Bot joins Matrix room (if not already) + LiveKit room `music-{roomId}`
       │
       ▼
Resolve Spotify URL → metadata → YouTube match → audio stream URL
       │
       ▼
Enqueue: emit `track_added` ephemeral → update queue state event
       │
       ▼
If queue was empty: start playback
       │
       ▼
Stream: yt-dlp → ffmpeg (Opus) → LiveKit publish
       │
       ▼
Emit `track_started` ephemeral + update queue state (currentIndex, playback)
       │
       ▼
Every 2s: emit `now_playing` ephemeral with position
       │
       ▼
Track ends → currentIndex++ → loop or stop per settings
```

### 8.3 Commands (Matrix Message Commands)

| Command | Args | Description |
|---------|------|-------------|
| `!play` | `<spotify_url>` or nothing (resume) | Add to queue or resume |
| `!skip` | `[n]` | Skip current or n tracks |
| `!back` | — | Previous track |
| `!pause` | — | Pause playback |
| `!resume` | — | Resume playback |
| `!volume` | `<0-100>` | Set volume |
| `!queue` | — | Show queue (bot replies with formatted list) |
| `!clear` | — | Clear queue, stop |
| `!shuffle` | `on|off` | Toggle shuffle |
| `!repeat` | `off|queue|track` | Set repeat mode |
| `!np` | — | Show now-playing |

*All commands also available via modal UI → Matrix state events (bot watches state).*

---

## 9. Tauri Integration (Desktop)

### 9.1 Spotify OAuth (PKCE)
- Reuse existing `sso.rs` pattern: `tauri::plugin::oauth2` or custom webview flow
- Scopes: `user-read-playback-state user-read-currently-playing` (metadata only)
- Tokens stored via `keyring_cmds.rs` → OS keyring (Credential Manager / Keychain / libsecret)
- Bot uses **user's token** only for Spotify Web API metadata calls (rate-limited per user)

### 9.2 Tauri Commands (Rust ↔ React)

```rust
// src-tauri/src/music_commands.rs

#[tauri::command]
async fn music_get_spotify_token() -> Result<Option<String>, String> {
    // Read from keyring via existing keyring_cmds
}

#[tauri::command]
async fn music_set_spotify_token(token: String) -> Result<(), String> {
    // Store in keyring
}

#[tauri::command]
async fn music_revoke_spotify_token() -> Result<(), String> {
    // Delete from keyring
}

// No audio commands — all audio is server-side
```

### 9.3 React Hooks (Frontend)

```typescript
// src/hooks/useMusicPlayer.ts
export function useMusicPlayer(roomId: string) {
  // Subscribe to Matrix state event: io.echo.music.queue
  // Subscribe to ephemeral: io.echo.music.now_playing, track_added, track_started
  // Actions: dispatch state patches via sendStateEvent()
  // Toasts: listen for ephemeral events → trigger toast store
}
```

---

## 10. Data Flow: User Pastes Spotify Link → Audio Plays

```
1. User pastes https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT in chat
       │
2. Echo React detects Spotify URL regex → shows inline "🎵 Tocar" button on message
       │
3. User clicks "Tocar" → React calls MatrixClient.sendStateEvent(
       roomId, "io.echo.music.queue", {roomId}, patch: {queue: [...newTrack]})
       │
4. Bot (MatrixListener) receives state event → QueueManager.enqueue()
       │
5. Bot: SpotifyResolver.getTrack(spotifyId) → metadata + ISRC
       │
6. Bot: YouTubeResolver.search(artist, title, isrc) → best match videoId
       │
7. Bot: yt-dlp gets direct audio URL (signed, expires ~6h)
       │
8. Bot: Updates queue state with youtube.audioUrl, thumbnail, duration
       │
9. Bot: Emits ephemeral `track_added` → all clients show toast
       │
10. If queue was empty: Bot starts AudioPipeline → LiveKitPublisher
       │
11. Bot: Emits `track_started` → clients show "Tocando agora" toast
       │
12. Bot: Every 2s emits `now_playing` with position → clients update seek bar
       │
13. User opens MusicModal → reads queue state event → renders full UI
       │
14. User drags track in queue → React patches queue state event → Bot reorders
       │
15. User seeks → React patches playback.positionMs → Bot seeks ffmpeg/LiveKit
```

---

## 11. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Encrypted voice room** | Bot replies: "❌ Não posso tocar em salas criptografadas. Desative E2EE na sala de voz." |
| **Spotify track not found on YouTube** | Queue item `status: "failed"`, toast: "⚠️ Não encontrei no YouTube: *Track Name*" |
| **yt-dlp / ffmpeg crash** | Bot catches, marks track failed, auto-skips to next, logs error |
| **LiveKit disconnect** | Bot reconnects (exponential backoff), resumes from `playback.positionMs` |
| **User leaves voice room** | Bot detects no listeners → pauses after 30s, stops after 5min empty |
| **Rate limit (Spotify/YouTube)** | Exponential backoff + cache (Redis or in-memory TTL 1h) |
| **Invalid Spotify URL** | Inline button doesn't appear; silent ignore |
| **Queue state conflict (concurrent edits)** | Matrix state events are last-write-wins; client shows "Sincronizando..." toast on conflict |

---

## 12. Security & Privacy

- **No audio through Tauri** — all streaming server-side
- **User Spotify tokens** — only in OS keyring, never logged, only used for metadata API
- **YouTube audio URLs** — signed, short-lived (6h), fetched fresh per play
- **Matrix events** — room-scoped, respect power levels (future: moderator-only control)
- **Bot identity** — dedicated Matrix user `@musicbot:echo.example.com`, verified

---

## 13. Implementation Phases

| Phase | Scope | Est. Effort |
|-------|-------|-------------|
| **1. Core Bot + Matrix State** | MatrixListener, QueueManager, state events, `!play !skip !queue` commands | 3 days |
| **2. YouTube Resolver + Audio Pipeline** | SpotifyResolver, YouTubeResolver (ISRC match), yt-dlp → ffmpeg → LiveKit | 4 days |
| **3. Tauri Spotify OAuth** | PKCE flow, keyring storage, React hook for token status | 1 day |
| **4. React UI: Toast + Modal** | Toast manager, MusicModal (now-playing + queue tabs, DnD, controls) | 3 days |
| **5. Matrix Event Sync** | Ephemeral events (now_playing, track_added, track_started), conflict handling | 2 days |
| **6. Polish & Edge Cases** | Volume persistence, shuffle/repeat, empty-room pause, error toasts, keyboard shortcuts | 2 days |

**Total MVP: ~15 days** (single full-stack dev)

---

## 14. Open Questions (Builder Check)

1. **Matrix event type naming:** `io.echo.music.*` — confirm namespace convention matches project.
2. **Ephemeral event transport:** Use `m.ephemeral` room events vs to-device vs MSC3916 (threaded)? Recommendation: `m.ephemeral` room events for `now_playing` (high frequency), to-device for `track_added`/`track_started` (per-user toast).
3. **LiveKit room naming:** `music-{voiceRoomId}` — confirm no collision with user voice rooms.
4. **Bot hosting:** Single Coolify service (horizontal scale later)? Each bot instance handles multiple rooms concurrently.
5. **Queue persistence on bot restart:** Reconstruct from Matrix state events on startup — confirm acceptable (no separate DB).
6. **Drag-reorder library:** `@dnd-kit/core` (headless, accessible) vs `react-beautiful-dnd` (deprecated)? Recommend `@dnd-kit`.
7. **Toast library:** `sonner` (shadcn-compatible) vs custom? Recommend `sonner`.

---

## 15. Appendix: Example Matrix State Event (Full)

<details>
<summary>Click to expand</summary>

```json
{
  "type": "io.echo.music.queue",
  "state_key": "!voiceRoom:echo.example.com",
  "sender": "@musicbot:echo.example.com",
  "content": {
    "version": 1,
    "queue": [
      {
        "id": "yt_abc123",
        "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
        "spotifyMetadata": {
          "trackId": "4cOdK2wGLETKBW3PvgPWqT",
          "name": "Blinding Lights",
          "artists": [{"name": "The Weeknd"}],
          "album": {"name": "After Hours", "images": [{"url": "https://i.scdn.co/image/...", "height": 640, "width": 640}]},
          "durationMs": 200000,
          "isrc": "USUG12000123"
        },
        "youtube": {
          "videoId": "dY5YfE0kY2I",
          "title": "The Weeknd - Blinding Lights (Official Video)",
          "url": "https://youtube.com/watch?v=dY5YfE0kY2I",
          "durationSec": 200,
          "thumbnailUrl": "https://i.ytimg.com/vi/dY5YfE0kY2I/maxresdefault.jpg",
          "audioUrl": "https://rr1---sn-.../audio.opus?expire=..."
        },
        "addedBy": {
          "userId": "@alice:echo.example.com",
          "displayName": "Alice",
          "avatarUrl": "mxc://echo.example.com/abc123"
        },
        "addedAt": "2026-11-06T15:30:00.000Z",
        "status": "playing"
      },
      {
        "id": "yt_def456",
        "spotifyUrl": "https://open.spotify.com/track/6JEK0CvvjDjjMUBFoXShNZ",
        "spotifyMetadata": {
          "trackId": "6JEK0CvvjDjjMUBFoXShNZ",
          "name": "Save Your Tears",
          "artists": [{"name": "The Weeknd"}],
          "album": {"name": "After Hours", "images": [{"url": "https://i.scdn.co/image/...", "height": 640, "width": 640}]},
          "durationMs": 215000,
          "isrc": "USUG12000124"
        },
        "youtube": {
          "videoId": "XXYlFuWEuKI",
          "title": "The Weeknd - Save Your Tears (Official Video)",
          "url": "https://youtube.com/watch?v=XXYlFuWEuKI",
          "durationSec": 215,
          "thumbnailUrl": "https://i.ytimg.com/vi/XXYlFuWEuKI/maxresdefault.jpg",
          "audioUrl": "https://rr2---sn-.../audio.opus?expire=..."
        },
        "addedBy": {
          "userId": "@bob:echo.example.com",
          "displayName": "Bob",
          "avatarUrl": "mxc://echo.example.com/def456"
        },
        "addedAt": "2026-11-06T15:31:00.000Z",
        "status": "queued"
      }
    ],
    "currentIndex": 0,
    "playback": {
      "state": "playing",
      "positionMs": 45000,
      "updatedAt": "2026-11-06T15:30:45.000Z",
      "volume": 0.8
    },
    "settings": {
      "autoplay": true,
      "repeat": "off",
      "shuffle": false
    }
  },
  "origin_server_ts": 1794036645000,
  "unsigned": {
    "age": 123
  }
}
```
</details>

---

## 16. Next Steps

1. **Builder check** — dispatch subagent with `builder-check-prompt.md`
2. **User review** — address "theirs" questions from builder
3. **Approval** — then invoke `writing-plans` skill for implementation plan
4. **Phase 1 start** — Core Bot + Matrix State

---

*Document version 1.0 — ready for builder check*