# CodeVisualizer Frontend Testing Strategy

This document outlines the testing strategies applied to the CodeVisualizer React frontend application to ensure robustness, compatibility, accessibility, and high performance.

---

## 🧪 Testing Strategies & Checklists

### 1. Functional Testing
- **State Stepping**: Verify Playback Controls step forward/backward correctly.
- **Trace Synchronization**: Verify that stepping to index `N` highlights the correct line in `CodeViewer` and corresponds to the variables in `VariablesTable` and `CallStack`.
- **Autoplay Control**: Verify play/pause state toggle and slider speeds (0.2s - 2.0s per step).
- **Tab Switching**: Verify that switching modules (Playground → Memory → SQL → Performance) resets stepping states cleanly.

### 2. Cross-Browser Testing
- **3D Transform Rendering**: Verify CSS 3D perspectives (`perspective: 1000px`, `preserve-3d`, `translateZ`) compile and animate smoothly across:
  - **Chromium Engines** (Google Chrome, Microsoft Edge, Opera).
  - **Gecko Engines** (Mozilla Firefox).
  - **WebKit Engines** (Apple Safari).
- **Text Alignment**: Ensure that text overlaid on 3D SVG blocks remains horizontal and crisp across all layout engines.

### 3. Responsive & Device Testing
- **Desktop Sidebar collapsing**: Verify sidebar transitions smoothly from `w-72` to `w-20` on toggling `sidebarCollapsed`.
- **Icon Hover Tooltips**: Verify `.sidebar-tooltip` displays correctly on hover when the sidebar is collapsed on viewport width >= 768px.
- **Mobile Menu Drawer**: Verify that viewport widths < 768px hide the sidebar and display a hamburger menu that opens a sliding overlay drawer.

### 4. Performance & Speed Testing
- **Modular Code-Splitting**: Assert that Vite builds generate split chunks under the **50-100kb** budget (currently, all individual modules compile to < 16 kB).
- **Local Playback Play latency**: Ensure trace playback operates with **zero network requests** during stepping (SVG elements updated in real time via DOM IDs).
- **Asset Size Audits**: Run `npm run build` to monitor code bundle footprint.

### 5. Security Testing
- **SVG Injection Sanitization**: Verify that raw SVGs received from `/api/playground/trace` are structured correctly and rendered safely via React `dangerouslySetInnerHTML`.
- **Sandbox Execution Scope**: Ensure compilation outputs do not leak variables across workspace sessions.

### 6. Usability Testing
- **Visual Gutter Arrow Markers**: Ensure execution gutter arrows (🟢 active, 🔴 previous) align vertically with code lines.
- **Interactive Tooltips**: Verify hover tooltips on system vocabulary (e.g. `def`, `for`, `malloc`) display definitions immediately.

### 7. Accessibility Testing (a11y)
- **High Contrast Glows**: Verify highlight states use strong contrast colors (neon pink `#FF3366` and cyan `#00F0FF`) with high-contrast text (`#FFFFFF` on dark backgrounds) for color-blind accessibility.
- **Semantic HTML**: Use proper `<nav>`, `<aside>`, `<main>`, `<header>` elements with outline structure hierarchy.

### 8. End-to-End (E2E) Testing (Automation Plan)
- **Target Flow**: Compile a Python factorial snippet, wait for trace response, select `main` scope, step through execution loops, verify variable values, and verify process finishes at exit node.
- **Tooling Option**: Can be automated using Playwright or Cypress tests.
