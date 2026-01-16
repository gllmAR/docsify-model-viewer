# Functional Specification Requirements (FSR)

## Plugin: `docsify-model-viewer`

---

## 1. Purpose

`docsify-model-viewer` is a Docsify plugin that automatically converts standard Markdown links to supported 3D model files into inline, interactive previews while preserving the original file as a downloadable link.

The plugin targets documentation workflows where 3D assets live directly in the repository and are referenced as ordinary links.

### 1.1 Stakeholders

* **Authors**: write plain Markdown links without special syntax.
* **Readers**: view and interact with 3D previews inline.
* **Operators**: maintain a Docsify site with minimal configuration.

### 1.2 Definitions

* **Model link**: a Markdown link to a file with a supported 3D extension.
* **Preview block**: the generated DOM wrapper containing viewer + controls.
* **Backend**: rendering runtime adapter (Babylon Viewer v1).

---

## 2. Primary User Requirement (Hard Constraint)

### FR-0 — One-Line Installation

The plugin MUST be usable with **a single script include** and **no configuration**.

```html
<script src="//unpkg.com/docsify-model-viewer/dist/docsify-model-viewer.min.js"></script>
```

After inclusion, the following Markdown MUST work automatically:

```md
[Example Model](models/example.glb)
```

### FR-0.1 — Zero Authoring Friction

No custom syntax, directives, or front-matter MUST be required.

---

## 3. Supported Formats (Low-Hanging Fruit)

### FR-1 — Supported 3D Formats

The plugin MUST support all natively supported, client-side Babylon Viewer formats that require no CAD kernel or server processing.

Supported extensions (case-insensitive):

| Format  | Extensions      |
| ------- | --------------- |
| STL     | `.stl`          |
| glTF    | `.gltf`, `.glb` |
| OBJ     | `.obj`          |
| PLY     | `.ply`          |
| Babylon | `.babylon`      |

Unsupported formats MUST be ignored silently.

### FR-1.1 — Extension Parsing

Extension matching MUST be case-insensitive and ignore query/hash suffixes.

---

## 4. Default Behavior (Zero Configuration)

### FR-2 — Link Detection

* The plugin MUST detect `<a>` elements whose `href` resolves to a supported extension.
* URLs MAY be relative, absolute, or include query/hash suffixes.

### FR-2.1 — Idempotency

The plugin MUST NOT re-process an anchor already converted into a preview block.

### FR-3 — Transformation Mode

* By default, the plugin MUST **replace** the original link with:

  * an embedded 3D viewer
  * a visible Download button
* The original URL MUST remain the canonical asset reference.

### FR-3.1 — Augment Mode Behavior

When `mode: "augment"`, the original link MUST be preserved and the preview block appended immediately after it.

### FR-4 — Viewer Backend

* The default backend MUST be **Babylon Viewer (V2)**.
* The plugin MUST automatically load the Babylon Viewer runtime when required.

### FR-4.1 — Runtime Loading Constraints

The runtime loader MUST be cached so multiple previews do not trigger duplicate loads.

### FR-5 — Layout Defaults

| Property     | Default        |
| ------------ | -------------- |
| Width        | `100%`         |
| Height       | `480px`        |
| Aspect ratio | disabled       |
| Controls     | orbit + zoom   |
| Background   | viewer default |

### FR-6 — Performance Defaults

* Viewers MUST be **lazy-loaded when visible** using `IntersectionObserver`.
* A lightweight placeholder MUST be shown before loading.
* If `IntersectionObserver` is unavailable, the plugin MUST fall back to click-to-load.

### FR-6.1 — Placeholder Content

The placeholder MUST display a readable status label and remain keyboard accessible.

### FR-7 — Download Preservation

* A visible **Download** button MUST always be rendered.
* Download MUST work even if the viewer fails to load.

### FR-7.1 — Open in New Tab (Optional)

If `showOpen: true`, an **Open** action MUST be shown and MUST include `target="_blank"` and `rel="noopener"`.

---

## 5. Optional User Overrides

### FR-8 — Override Mechanism

All overrides MUST be optional and supplied via `window.$docsify.modelViewer`.

Example:

```js
window.$docsify = {
  modelViewer: {
    height: "360px",
    lazy: "click"
  }
}
```

No override MUST be required for correct operation.

### FR-8.1 — Safe Defaults

Invalid override values MUST fall back to defaults without breaking rendering.

---

## 6. Supported Overrides (v1)

| Key             | Type                             | Default       |
| --------------- | -------------------------------- | ------------- |
| `enabled`       | boolean                          | `true`        |
| `formats`       | string[]                         | all supported |
| `mode`          | `"replace" \| "augment"`         | `"replace"`   |
| `width`         | CSS size                         | `100%`        |
| `height`        | CSS size                         | `480px`       |
| `aspectRatio`   | string | null                    | `null`        |
| `lazy`          | `"visible" \| "click" \| "none"` | `"visible"`   |
| `downloadLabel` | string                           | `"Download"`  |
| `showOpen`      | boolean                          | `false`       |
| `viewerConfig`  | object | null                    | `null`        |
| `debug`         | boolean                          | `false`       |

### FR-8.2 — Override Validation

* `formats` MUST be normalized to lowercase extensions without dots.
* `width`, `height`, and `aspectRatio` MUST be treated as CSS values.
* `lazy` MUST be one of `visible`, `click`, or `none`.

---

## 7. Docsify Lifecycle Requirements

### FR-9 — SPA Compatibility

* The plugin MUST re-process content on each Docsify route change.
* The plugin MUST NOT duplicate viewers on re-render.
* Previously mounted viewers MUST be removed or disconnected on navigation.

### FR-9.1 — Memory Safety

All observers and event handlers created by the plugin MUST be cleaned up on route change.

---

## 8. Error Handling

### FR-10 — Viewer Load Failure

If a model fails to load:

* A readable error message MUST be displayed in place of the viewer.
* The Download button MUST remain available.
* The Docsify page MUST continue to render normally.

### FR-10.1 — Error Surface

Errors MUST be rendered within the preview block and announced via `aria-live`.

### FR-11 — Debug Logging

When `debug: true`:

* The plugin MUST log concise diagnostics to `console.warn`.
* Logs MUST include the model URL and route context.

---

## 9. Security Requirements

### FR-12 — Safety

* The plugin MUST NOT execute arbitrary code from Markdown.
* Link text MUST be treated as plain text.
* External links MUST use `rel="noopener"`.

### FR-12.1 — URL Handling

The plugin MUST NOT rewrite URLs beyond adding required `rel` attributes or wrapping for preview layout.

---

## 10. Accessibility Requirements

### FR-13 — Accessibility

* All controls MUST be keyboard-accessible.
* Viewer containers MUST include an accessible label:

  * `aria-label="3D model preview: <title>"`
* Error and status messages MUST be screen-reader visible.

### FR-13.1 — Focus Order

Controls within the preview block MUST have a logical tab order: title → actions → viewer.

---

## 11. Out of Scope (Explicit)

The following are NOT required for v1:

* STEP / IGES / CAD formats
* Server-side processing or conversion
* Annotations or hotspots
* Fullscreen mode
* Thumbnails or galleries
* Non-Babylon backends (planned, not required)

### 11.1 Non-Goals

* Asset conversion, compression, or optimization
* Authentication or signed URLs
* Search indexing or metadata extraction

---

## 12. Acceptance Criteria

1. A single `<script>` line enables previews site-wide.
2. Supported model links render inline viewers automatically.
3. Defaults work without configuration.
4. Overrides modify behavior without breaking defaults.
5. Route navigation does not leak or duplicate viewers.
6. Viewer failure does not block downloads or page rendering.

### 12.1 Acceptance Tests (Manual)

1. Load a page with two supported links and confirm both previews render once.
2. Navigate to another route and back; confirm no duplicate viewers exist.
3. Disable `IntersectionObserver`; confirm click-to-load fallback.
4. Force a failed URL; confirm error message and download remain.

---

## 13. Summary

`docsify-model-viewer` delivers:

* **author transparency** (links stay links)
* **reader clarity** (inline preview + download)
* **operator safety** (lazy loading by default)
* **format breadth** (all easy Babylon formats)
* **future extensibility** (backend-agnostic core)

This FSR defines a **complete, implementable v1 scope** with no ambiguity.

---

## 14. Open Questions

1. Should the plugin include a default stylesheet or keep CSS inline-only?
2. Should the runtime loader be pinned to a version or floating latest?
3. Should relative URL resolution respect Docsify `basePath` if set?
