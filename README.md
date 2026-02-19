# htmx-r-dist

CDN distribution files for [htmx-r](https://github.com/birddigital/htmx-r) — a dependency-free, React-like frontend framework built with Go + HTMX.

## Usage via jsDelivr

```html
<!-- CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/birddigital/htmx-r-dist@main/css/htmx-r.css" />

<!-- JS -->
<script src="https://cdn.jsdelivr.net/gh/birddigital/htmx-r-dist@main/js/htmx-r-modal.js" defer></script>
<script src="https://cdn.jsdelivr.net/gh/birddigital/htmx-r-dist@main/js/htmx-r-observer.js" defer></script>
<script src="https://cdn.jsdelivr.net/gh/birddigital/htmx-r-dist@main/js/htmx-r-scroll.js" defer></script>
```

## Files

| File | Description |
|------|-------------|
| `css/htmx-r.css` | Design system — CSS custom properties, layout, components |
| `js/htmx-r-modal.js` | Modal management (HtmxRModal.open/close) |
| `js/htmx-r-observer.js` | Docs sidebar active-section tracking (HtmxRObserver) |
| `js/htmx-r-scroll.js` | Smooth scroll utilities |

## Pinned versions

For production use, pin to a specific commit or tag instead of @main:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/birddigital/htmx-r-dist@{commit}/css/htmx-r.css" />
```

Source: github.com/birddigital/htmx-r (private)
