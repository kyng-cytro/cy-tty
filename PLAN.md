# cy-tty — Architecture Plan

> Mobile SSH terminal emulator for **Android & iOS** (web out of scope).  
> Stack: Expo prebuild · libssh2/NMSSH · libghostty-vt · react-native-skia · react-native-paper

---

## Architecture

```
[SSH Server]
     │  TCP/SSH stream
     ▼
[expo-ssh module]          ← NMSSH (iOS) | libssh2 via NDK (Android)
     │  raw bytes
     ▼
[expo-ghostty-vt module]   ← libghostty-vt (Zig/C) via Swift Package (iOS) | JNI (Android)
     │  TerminalDelta events
     ▼
[useTerminal hook]         ← JS: TerminalGrid state (cells · cursor · colors)
     │  TerminalState
     ▼
[TerminalCanvas]           ← @shopify/react-native-skia  (Rect fills + Glyphs API)
     │
     ▼
[react-native-paper UI]    ← Material You / MD3 theming
```

---

## Native Modules

### `modules/expo-ssh/`

| Platform | Implementation |
|----------|---------------|
| iOS | NMSSH CocoaPod (Swift wrapper around libssh2) |
| Android | libssh2 via Android NDK + JNI; fallback: `sshj` pure-Java |

**JS API**:
```ts
connect(host, port, user, password): Promise<void>
disconnect(): Promise<void>
write(data: string): Promise<void>
resize(cols: number, rows: number): Promise<void>
// events: onData · onError · onClose
```

### `modules/expo-ghostty-vt/`

| Platform | Implementation |
|----------|---------------|
| iOS | `libghostty-spm` Swift Package (prebuilt XCFramework — no Zig needed) |
| Android | Zig cross-compile `libghostty-vt` C API → `arm64-v8a` + `x86_64` via Gradle exec task + JNI |

**JS API**:
```ts
createTerminal(cols, rows): Promise<TerminalHandle>
processBytes(handle, bytes): Promise<void>
resize(handle, cols, rows): Promise<void>
destroy(handle): Promise<void>
// event: onTerminalDelta(handle, delta)
```

> **Android risk**: Zig→NDK cross-compile is non-trivial. Fallback: minimal JS ANSI parser until resolved.

---

## JS Layer

| File | Role |
|------|------|
| `src/core/terminal/types.ts` | `TerminalCell`, `TerminalState`, `TerminalCursor` |
| `src/core/terminal/grid.ts` | Grid manipulation utilities |
| `src/hooks/use-terminal.ts` | Apply VT deltas → React state |
| `src/hooks/use-ssh-session.ts` | SSH lifecycle (connect → shell → pipe → resize) |
| `src/hooks/use-terminal-size.ts` | cols/rows from screen dimensions + font metrics |

---

## Rendering — `src/components/terminal/terminal-canvas.tsx`

Uses `@shopify/react-native-skia`:

1. Load bundled monospace font (JetBrains Mono) via `useFonts`
2. Measure glyph → `cellWidth × cellHeight`
3. **Background pass** — batched `Rect` fills per color group
4. **Glyph pass** — pre-computed glyph IDs, one draw call per row via `Glyphs` API
5. **Cursor overlay** — blinking `Rect`/underline via `useSharedValue`
6. **Dirty tracking** — diff rows, only repaint changed

---

## Screens

| Route | Screen |
|-------|--------|
| `/` | Connection form (host · port · user · password) |
| `/terminal/[id]` | Full-screen `TerminalCanvas` + mobile keyboard toolbar |

Root layout: `PaperProvider` with dynamic Material You theme.

---

## File Tree

```
cy-tty/
├── modules/
│   ├── expo-ssh/
│   └── expo-ghostty-vt/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── terminal/[id].tsx
│   ├── components/
│   │   ├── terminal/{terminal-canvas, terminal-keyboard, terminal-session}.tsx
│   │   └── connection/connection-form.tsx
│   ├── core/terminal/{types, grid}.ts
│   └── hooks/{use-ssh-session, use-terminal, use-terminal-size}.ts
├── PLAN.md
├── TASKS.md
└── app.json
```

---

## Future Work

- Saved credentials (SecureStore)
- Session tabs
- Terminal config (font · colors · buffer size)
- SSH key auth
- SFTP file browser
- mosh support
