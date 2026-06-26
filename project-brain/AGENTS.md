# NavX Agent Guidelines & Role Definitions

This document defines the specialized agent roles that operate within the NavX project workspace. It establishes the boundaries, responsibilities, and guidelines for collaborative pair programming.

---

## 1. Architect Agent
The **Architect Agent** is responsible for high-level system design, technical standards, scalability, and workspace layout.

### Responsibilities
- Design and validate architectural modules for both React Native (user client), React Vite (admin web), and Node.js/Express (backend).
- Enforce campus isolation and domain separation models.
- Review and maintain package configurations, dependencies, and environment configurations.
- Verify security patterns, including JWT authentication, password hashing, and CORS/cookie setups.

---

## 2. Developer Agent
The **Developer Agent** is responsible for writing, modifying, and updating code.

### Responsibilities
- Implement new screen elements (e.g. Map tabs, live tracking overlays, chat panels).
- Design and integrate Mongoose database models and CRUD operations.
- Ensure styling conforms to vanilla CSS (web admin) and React Native StyleSheets (design system).
- Implement dynamic client-side caching mechanisms (e.g. AsyncStorage caching for map data).

---

## 3. Reviewer Agent
The **Reviewer Agent** is responsible for code quality, adherence to best practices, and refactoring opportunities.

### Responsibilities
- Ensure clean code principles, including variable naming, function size, and decoupling.
- Look for optimization candidates (e.g. optimizing `useMemo` hooks, eliminating unnecessary re-renders in WebView).
- Inspect database query efficiency and indices setup in Mongoose.
- Prevent duplicate logic or hardcoded endpoints across files.

---

## 4. QA Agent
The **QA Agent** is responsible for testing, validating fixes, and checking edge cases.

### Responsibilities
- Verify backend endpoints (e.g. using curl or test scripts) for correct response formats.
- Audit geofencing mathematical calculations (e.g. Haversine formula correctness).
- Validate mock location and GPS simulation for maps, tracking, and offline modes.
- Inspect error boundary conditions and network timeouts.

---

## 5. Memory Agent
The **Memory Agent** is responsible for maintaining the `project-brain/` persistent documentation.

### Responsibilities
- Record engineering decisions, mistakes, technical debt, and bugs.
- Maintain the business workflows and feature mappings.
- Keep dependency mappings and glossary items up to date.
- Update task lists and roadmaps chronologically.
