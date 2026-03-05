# Library Recommendations Report

**Generated:** 2026-03-05
**Project:** Bill-App (POS System)

---

## Backend Dependencies

### 1. HTTP Framework

| | Current | Recommended |
|---|---|---|
| **Library** | Express 4.x | **Keep Express** (or migrate to Hono for greenfield) |
| **Migration Effort** | N/A | High (if migrating) |

**Reasoning:** Express is deeply integrated (middleware, rate limiting, static file serving, raw body parsing for webhooks). Hono offers 3x throughput and 40% less memory, but the migration cost is high for an existing app with 8+ route files and custom middleware. **Recommendation: Stay on Express, but upgrade to Express 5.x** which is now stable and includes native async error handling. Consider Hono only for new microservices.

---

### 2. ORM/ODM

| | Current | Recommended |
|---|---|---|
| **Library** | Mongoose 8.x | **Keep Mongoose** |
| **Migration Effort** | N/A | N/A |

**Reasoning:** The project uses MongoDB throughout. Mongoose remains the best MongoDB ODM for Node.js with excellent TypeScript support in v8. Prisma and Drizzle are SQL-first ORMs; while Prisma has experimental MongoDB support, it lacks Mongoose's mature schema validation, middleware hooks, and population features. No change needed.

---

### 3. Authentication (JWT)

| | Current | Recommended |
|---|---|---|
| **Library** | jsonwebtoken 9.x | **jose** |
| **Migration Effort** | Low |

**Reasoning:** `jose` is a modern, actively maintained JWT library with native ESM support, full TypeScript types, and support for modern cryptography standards (EdDSA, ECDH). `jsonwebtoken` lacks ESM support and has slower update cycles. The API migration is straightforward -- mostly replacing `jwt.sign()` / `jwt.verify()` with `jose` equivalents.

---

### 4. Password Hashing

| | Current | Recommended |
|---|---|---|
| **Library** | bcryptjs 3.x | **@node-rs/argon2** (or keep bcryptjs) |
| **Migration Effort** | Low |

**Reasoning:** Argon2id is the modern gold standard for password hashing, winning the Password Hashing Competition. `@node-rs/argon2` provides a high-performance Rust-based implementation. However, bcryptjs is still perfectly secure when configured with adequate rounds. **Upgrade if starting fresh; acceptable to keep bcryptjs for now** since the user base is small (POS system).

---

### 5. File Upload

| | Current | Recommended |
|---|---|---|
| **Library** | multer (types installed, not in deps) | **Add multer when needed** |
| **Migration Effort** | N/A |

**Reasoning:** `@types/multer` is in devDependencies but multer itself is not installed -- likely planned but not yet used. When file uploads are needed (e.g., dish images), multer is the standard Express-compatible choice. No change needed.

---

### 6. Job Scheduling

| | Current | Recommended |
|---|---|---|
| **Library** | node-cron 4.x | **Keep node-cron** (consider BullMQ for growth) |
| **Migration Effort** | Medium (if migrating to BullMQ) |

**Reasoning:** The project uses node-cron for a single daily earnings calculation job. node-cron is perfect for this simple use case -- no persistence or distributed processing needed. BullMQ (Redis-backed) would be overkill unless you add many jobs or need retry/persistence guarantees. **Keep node-cron for now.**

---

### 7. Runtime TypeScript Execution

| | Current | Recommended |
|---|---|---|
| **Library** | tsx 4.x + nodemon | **Keep tsx** (drop nodemon) |
| **Migration Effort** | Low |

**Reasoning:** tsx (esbuild-based) is the fastest Node.js TypeScript runner, 5-10x faster than ts-node. The current setup uses `nodemon --exec tsx`. Consider replacing nodemon with tsx's built-in watch mode: `tsx watch app.ts` -- this eliminates a dependency and simplifies the dev script.

---

## Frontend Dependencies

### 8. State Management

| | Current | Recommended |
|---|---|---|
| **Library** | Redux Toolkit 2.x + react-redux | **Zustand** |
| **Migration Effort** | Medium |

**Reasoning:** The project uses Redux for only 3 simple slices (cart, user, customer) with no async thunks, middleware, or complex selectors. Zustand would eliminate ~12KB of bundle size, remove the Provider wrapper, and significantly reduce boilerplate. The cart and user slices are simple enough to port in under an hour. **Strong recommendation to switch** -- RTK is overkill here.

---

### 9. Server State / Data Fetching

| | Current | Recommended |
|---|---|---|
| **Library** | @tanstack/react-query 5.x | **Keep React Query** |
| **Migration Effort** | N/A |

**Reasoning:** React Query is the industry standard for server state management. Already installed and likely used for API calls. No change needed -- it's the best choice for this use case.

---

### 10. Form Handling

| | Current | Recommended |
|---|---|---|
| **Library** | react-hook-form 7.x | **Keep React Hook Form** |
| **Migration Effort** | N/A |

**Reasoning:** React Hook Form is the best React form library with minimal re-renders, tiny bundle (12KB), zero dependencies, and excellent TypeScript support. Formik is unmaintained. Conform is niche (server-first). No change needed.

---

### 11. HTTP Client

| | Current | Recommended |
|---|---|---|
| **Library** | axios 1.x | **Keep axios** (or migrate to ky) |
| **Migration Effort** | Low-Medium |

**Reasoning:** Axios is used via a centralized `axiosWrapper.js` with `withCredentials: true`. The wrapper pattern makes migration easy if desired. `ky` is a modern, lightweight (3.3KB vs 11.7KB) fetch-based alternative with similar DX. However, axios works well and the centralized wrapper limits blast radius. **Keep axios unless bundle size becomes critical.**

---

### 12. Animations

| | Current | Recommended |
|---|---|---|
| **Library** | framer-motion 11.x | **Keep Framer Motion** |
| **Migration Effort** | N/A |

**Reasoning:** Framer Motion (now "Motion") is the best React animation library with declarative API, layout animations, exit animations (AnimatePresence), and gesture support. GSAP is more powerful for complex timeline animations but less React-idiomatic. Perfect fit for a POS UI.

---

### 13. Notifications / Toasts

| | Current | Recommended |
|---|---|---|
| **Library** | notistack 3.x | **Sonner** |
| **Migration Effort** | Low |

**Reasoning:** Notistack (20KB) is designed for Material UI integration, which this project does not use (it uses Tailwind). Sonner is lighter, has a simpler API (`toast('message')` from anywhere), supports stacking, and is the standard toast library for Tailwind/shadcn projects. Easy migration -- just swap the provider and toast calls.

---

### 14. Icons

| | Current | Recommended |
|---|---|---|
| **Library** | react-icons 5.x | **lucide-react** |
| **Migration Effort** | Medium |

**Reasoning:** react-icons bundles icons from 20+ icon sets but has poor tree-shaking, leading to larger bundles. lucide-react (29M weekly downloads, surpassing react-icons at 5.4M) has superior tree-shaking, consistent design language, and smaller per-icon size. Migration requires replacing icon imports but is straightforward with find-and-replace.

---

### 15. Component Library

| | Current | Recommended |
|---|---|---|
| **Library** | None (custom + Tailwind) | **Consider shadcn/ui** |
| **Migration Effort** | Low (incremental adoption) |

**Reasoning:** The project uses Tailwind CSS but has no component library. shadcn/ui provides copy-paste accessible components built on Radix UI primitives + Tailwind -- perfect fit. It's not a dependency (components are copied into your codebase), so there's zero lock-in and you can adopt incrementally. Pairs well with Sonner and lucide-react.

---

## Summary: Priority Actions

### Immediate (Low Effort, High Impact)
1. **Replace notistack with Sonner** -- Better fit for Tailwind project, simpler API
2. **Replace jsonwebtoken with jose** -- Modern ESM/TS support, better security
3. **Drop nodemon, use `tsx watch`** -- Eliminate a dependency

### Short-Term (Medium Effort, High Impact)
4. **Replace react-icons with lucide-react** -- Significant bundle size reduction
5. **Replace Redux Toolkit with Zustand** -- Massive boilerplate reduction for this simple use case
6. **Adopt shadcn/ui incrementally** -- Better component primitives with accessibility

### Long-Term (Higher Effort, Lower Urgency)
7. **Consider @node-rs/argon2** for password hashing when doing auth refactor
8. **Upgrade Express to v5** when stable ecosystem support is confirmed
9. **Consider ky over axios** if bundle size optimization becomes a priority

---

## Dependencies to Remove
- `nodemon` -- replaced by `tsx watch`
- `buffer-equal-constant-time` -- only needed as jsonwebtoken transitive dep override; goes away with jose

## Dependencies That Are Fine As-Is
- mongoose, react-query, react-hook-form, framer-motion, date-fns, cors, cookie-parser, express-rate-limit, razorpay, tailwindcss, vite, react-router-dom
