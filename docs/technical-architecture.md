# Technical Architecture

## Overview
This architecture uses a modern, type-safe stack designed for performance and developer experience. It consists of a **React Native (Expo)** frontend and a **Hono** backend using **oRPC** for type-safe communication.

## 1. Frontend: Mobile App (React Native)

### Core Stack
- **Framework**: [Expo](https://expo.dev) (Managed Workflow) for rapid development and easy deployment.
- **Language**: TypeScript.
- **State Management**: 
  - **Global Server State**: [TanStack Query](https://tanstack.com/query/latest) (React Query) for caching and synchronizing API data.
  - **Local UI State**: React Context or Zustand for simple client-side state (e.g., theme, session).
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing) or React Navigation.

### UI & Styling
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native) for rapid, consistent styling.
- **Components**: Custom component library built on top of unstyled primitives (like Radix UI for mobile) or a lightweight library like `tamagui` or `gluestack-ui`.
- **Icons**: Lucide React Native.

### Key Libraries
- **Calendar Sync**: `react-native-calendar-events` for interacting with the device's local calendar (iOS/Android).
- **Storage**: `react-native-mmkv` for fast local storage (user preferences, offline cache).
- **Date Handling**: `date-fns` for lightweight date manipulation.

---

## 2. Backend: API (Hono + oRPC)

### Core Stack
- **Framework**: [Hono](https://hono.dev) - Ultra-fast web standard web framework.
- **Runtime**: Cloudflare Workers (Edge) or Node.js (Serverless).
- **Communication**: [oRPC](https://orpc.unnoq.com/) (or tRPC-like pattern) for end-to-end type safety between backend and frontend.
  - *Benefit*: Shared types mean if you change the backend schema, the frontend alerts you immediately.

### Database Layer
- **Database**: PostgreSQL (hosted on Supabase, Neon, or Railway).
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - Lightweight, type-safe SQL builder.
- **Migrations**: Drizzle Kit.

### AI Engine Integration
- **Provider**: OpenRouter (access to GPT-4, Claude 3.5, Llama 3).
- **Implementation**:
  - Hono endpoints act as a proxy/middleware to secure API keys.
  - Streaming responses supported for "Generate my month" features to reduce perceived latency.

---

## 3. Data Flow & Synchronization

### A. User Action (e.g., "Create Goal")
1. **Frontend**: User submits form.
2. **Mutation**: TanStack Query calls the oRPC client.
3. **Backend**: Hono validates input (Zod), Drizzle writes to turso.
4. **Response**: Updated Goal object returned.
5. **Update**: Frontend cache invalidates, UI updates immediately.

### B. AI Generation Flow
1. **Request**: User sends "I want to run a marathon".
2. **Backend**: 
   - Fetches user context (existing schedule).
   - Constructs prompt for LLM.
   - Calls OpenRouter API.
3. **Processing**: LLM returns JSON structure of tasks/events.
4. **Persist**: Backend saves these as `Draft` tasks in DB.
5. **Review**: Frontend fetches drafts for user approval.

### C. Calendar Sync (Local Device)
1. **Permission**: App requests Calendar access.
2. **Read**: App reads local events to avoid conflicts (optional, privacy-focused).
3. **Write**: When a Task is "Scheduled", the App writes to the native Calendar using `react-native-calendar-events`.
   - *Note*: This happens client-side (React Native layer), not server-side.

---

## 4. Infrastructure & DevOps

- **Repo**: Monorepo (Turborepo) containing `apps/mobile` and `packages/api`.
- **CI/CD**: GitHub Actions for linting, type-checking, and deploying the API.
- **Auth**: Supabase Auth or Clerk (easy integration with React Native & Hono).

## 5. Directory Structure (Monorepo)

```text
/
├── apps
│   ├── mobile (Expo app)
│   └── api (Hono worker)
├── packages
│   ├── db (Drizzle schema & connection)
│   └── api-client (Shared oRPC client types)
├── turbo.json
└── package.json
```
