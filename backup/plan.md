## Goal

Add a toggle so the user picks **Audio only** (default) or **Video**. The same YouTube IFrame player is used for both — audio mode just hides the video frame, video mode shows it.

## Why this approach

The YouTube IFrame Player API doesn't expose pure-audio streams (that would require ripping streams, which violates YouTube TOS and breaks often). The clean, stable trick used by every "YouTube music" web app:

- Always load the IFrame player (it streams audio + video).
- In audio mode, render the iframe at 1×1 px, hidden off-screen — only the audio plays. Bandwidth is slightly higher than pure audio, but playback is rock-solid and key-less.
- In video mode, render the iframe at full size in the bottom bar.

This keeps the existing search/queue/auto-advance logic untouched.

## Changes

### 1. `src/components/YouTubePlayer.tsx`
- Add a `mode: "audio" | "video"` prop.
- Wrap the container `<div>` in a parent whose styles switch on mode:
  - `video`: visible, e.g. `w-full max-w-md aspect-video`.
  - `audio`: `w-px h-px overflow-hidden opacity-0 pointer-events-none` (still mounted, still playing).
- Keep the same `new YT.Player(...)` init — only the wrapper visibility changes, so playback never restarts when toggling.

### 2. `src/routes/index.tsx`
- Add state: `const [mode, setMode] = useState<"audio" | "video">("audio")`.
- Add a small toggle (two buttons or a switch) in the bottom player bar: **Audio | Video**.
- Pass `mode` down to `<YouTubePlayer />`.
- Toggling mid-song does NOT recreate the player → audio keeps playing seamlessly.

## Out of scope (ask if you want them)
- True audio-only stream extraction (needs a backend proxy, fragile).
- Picture-in-picture / fullscreen video controls.
- Per-track default (some songs audio, some video).
