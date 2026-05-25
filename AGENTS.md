# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Cursor Cloud specific instructions

### Overview

SOMMA is a single Expo SDK 54 (React Native for Web) application — web-only target. It uses a local-first architecture (`LOCAL_FIRST_MODE = true`) so **no external services** (Supabase, OpenRouter) are required for development.

### Running the dev server

```
npx expo start --web --port 8081
```

The app is accessible at `http://localhost:8081`. Metro bundles ~1450 modules on first load (~7s).

### Type checking

```
npx tsc --noEmit
```

No ESLint config exists for the main project — TypeScript strict mode is the primary static analysis.

### Production build

```
npm run build
```

Outputs to `dist/` directory (SPA with `index.html`).

### Key caveats

- **Web-only**: `app.json` sets `"platforms": ["web"]`. Do not attempt iOS/Android builds.
- **No `.env` needed**: The app runs fully offline in local-first mode. Supabase env vars are optional and disabled by default in `lib/config.ts`.
- **Package manager**: npm (uses `package-lock.json`). Do not use yarn or pnpm.
- **Node version**: Requires Node 22+ (pre-installed in environment).
- **NativeWind v4**: Styling uses Tailwind via NativeWind — `global.css` is the entry point processed by Metro via `metro.config.js`.
- **No lint/format hooks**: No ESLint, Prettier, Husky, or pre-commit hooks are configured.
