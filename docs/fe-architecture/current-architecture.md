# Current Front-End Architecture

## Component & Page Structure
- Components: `src/client/components/`
- Pages: `src/client/pages/`
- Hooks: `src/client/hooks/`
- Services: `src/client/services/`
- State Management: Context API, local state
- Routing: React Router (assumed)

## Bottlenecks & Coupling Issues
- Some components tightly coupled to data fetching logic
- Duplicated API calls in hooks and components
- Lack of clear separation between data services and presentation
- Minimal caching; mostly direct API calls
- No persisted client cache for snapshot/history
- Admin tools not separated; no hidden routes

## Diagram: Current Architecture
```mermaid
flowchart TD
    API[SC2CR API] -->|fetch| Hooks
    Hooks --> Components
    Components --> Pages
    Pages --> Router
    Router --> UI
    subgraph Issues
      A1[Coupled Components]
      A2[Duplicated API Calls]
      A3[No Persisted Cache]
      A4[No Hidden Admin Routes]
    end
```
