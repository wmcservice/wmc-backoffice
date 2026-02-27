# WMC Operations Command Center

A React-based dashboard for managing operations, staff, and job scheduling for WMC.

## Tech Stack
- **Frontend**: React 19 (Vite)
- **Routing**: React Router DOM v7
- **State Management**: custom `localStorage`-based store (`src/data/store.js`)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Scheduling**: @hello-pangea/dnd
- **Utility**: date-fns, xlsx

## Architecture & Conventions
- **Data Models**: Defined in `src/data/models.js`. Use factory functions (`createJob`, `createStaff`, etc.) to ensure consistency.
- **State Persistence**: All data is persisted in `localStorage`. The `initStore()` function in `src/App.jsx` ensures seed data is loaded on the first run.
- **Styling**: Vanilla CSS. Pages have their own CSS files (e.g., `Dashboard.jsx` -> `Dashboard.css`). Global styles are in `src/styles/global.css`.
- **Theming**: Supports Dark and Light modes using CSS variables and `data-theme` attribute on `<html>`.

## Entity Relationships
- **Jobs**: The central unit of work.
- **Staff**: Employees assigned to jobs.
- **Allocations**: Links Staff to Jobs on specific dates. Contains attendance and performance data (check-in/out, hours).

## Development Guidelines
- Always use the `saveJob`, `saveStaffMember`, etc., functions from `src/data/store.js` to modify data.
- When adding new pages, follow the existing pattern: React component + sibling CSS file.
- Use `lucide-react` for all icons.
- Ensure all Thai text is handled correctly (the UI is primarily in Thai).
