# Software Design Document (SDD)

## docsify-model-viewer

---

## 1. Purpose & Vision

**docsify-model-viewer** is a zero-friction Docsify plugin that automatically upgrades ordinary Markdown links to 3D model files into embedded, interactive previews with a preserved download workflow.

The author experience is intentionally minimal:

```md
[Motor Mount](models/motor_mount.stl)
```

No custom syntax, no directives, no build step.

The reader experience is:

* inline 3D preview
* orbit / zoom interaction
* explicit download access
* graceful failure handling

The system is designed to be:

* **lightweight by default**
* **progressively enhanced**
* **format-agnostic internally**
* **backend-pluggable**

### 1.1 Design Principles

* **Progressive enhancement**: links remain functional without JS.
* **Idempotency**: repeated renders must be safe.
* **Composable backend**: keep the rendering adapter isolated.
* **Minimal footprint**: avoid heavy dependencies beyond the viewer runtime.

---

## 2. Supported Formats (Low-Hanging Fruit)

### 2.1 Definition: “Low-Hanging Fruit”

Formats that meet all of the following:

* Natively supported by Babylon Viewer / Babylon SceneLoader
* Client-side only (no WASM CAD kernel)
* Widely used and stable
* Predictable rendering semantics

### 2.2 Supported Formats (v1)

| Format                | Extensions      | Notes                           |
| --------------------- | --------------- | ------------------------------- |
| STL                   | `.stl`          | Triangle mesh, no materials     |
| glTF                  | `.gltf`, `.glb` | Preferred modern format         |
| OBJ                   | `.obj`          | Geometry only; MTL optional     |
| PLY                   | `.ply`          | Common for scans / point clouds |
| Babylon               | `.babylon`      | Native Babylon JSON             |
| Draco-compressed glTF | `.glb`          | If decoder is available         |

> STEP / IGES / CAD formats are explicitly **out of scope**.

---

## 3. User Experience Requirements

### 3.1 One-Line Installation (Hard Requirement)

```html
<script src="//unpkg.com/docsify-model-viewer/dist/docsify-model-viewer.min.js"></script>
```

No configuration required.

### 3.2 Authoring Model

* Authors write **standard Markdown links**
* File extension determines preview eligibility
* Link remains the canonical reference

---

## 4. High-Level Architecture

```
Docsify Render
      ↓
Plugin Hook (doneEach)
      ↓
Anchor Scanner
      ↓
Format Resolver
      ↓
DOM Transformer
      ↓
Viewer Backend Adapter
      ↓
Babylon Viewer Runtime
```

### 4.1 Data Flow

1. Docsify renders Markdown to HTML.
2. Plugin scans anchors in the content container.
3. Supported links are transformed into preview blocks.
4. Lazy loading attaches observers or click handlers.
5. Backend adapter mounts the viewer when activated.

---

## 5. Core Components

### 5.1 Docsify Integration Layer

* Hooks into `hook.doneEach`
* Scoped to Docsify content container
* Idempotent (safe on re-render)

#### 5.1.1 Route Lifecycle

* **enter**: create observers and mount viewers as needed
* **leave**: disconnect observers and unmount viewer instances

### 5.2 Link Scanner

* Finds `<a>` elements
* Skips already processed nodes
* Resolves final URL (relative → absolute)

#### 5.2.1 Link Normalization

* Strip query/hash for extension detection
* Preserve original URL for download and open actions

### 5.3 Format Resolver

Maps file extension → preview capability.

```js
{
  stl: true,
  glb: true,
  gltf: true,
  obj: true,
  ply: true,
  babylon: true
}
```

Unknown extensions are ignored.

#### 5.3.1 Configuration Merge

Formats are filtered by user config while maintaining default safety.

### 5.4 DOM Transformer

Rewrites link into a **Model Preview Block**:

* header (title + actions)
* viewer container
* status / error region

Supports:

* replace (default)
* augment (append under link)

#### 5.4.1 DOM Attributes

* `data-dmv-url` canonical model URL
* `data-dmv-mode` replace or augment
* `aria-label` on viewer container

### 5.5 Viewer Backend Adapter (Abstract)

The plugin core never talks directly to Babylon APIs.

**Adapter Interface**

```ts
ensureRuntime(): Promise<void>
mount(container, url, options): ViewerInstance
unmount(instance): void
```

#### 5.5.1 Adapter Contract Notes

* `ensureRuntime()` must be idempotent
* `mount()` must return a handle usable by `unmount()`

This guarantees:

* future Three.js backend
* backend-specific optimizations
* no Markdown or API changes

### 5.6 Babylon Viewer Backend (v1 Default)

* Uses Babylon Viewer V2
* Auto-loads runtime
* Uses `<babylon-viewer>` custom element
* Delegates rendering, controls, lifecycle to Babylon

#### 5.6.2 Viewer Capabilities (V2)

* Dynamically imports loaders based on model format.
* Selects WebGL or WebGPU automatically.
* Suspends rendering when offscreen to save power.

#### 5.6.1 Runtime Strategy

* Runtime is loaded once via dynamic `<script>` injection
* Promise is shared across preview instances

---

## 6. Generated DOM Contract

```html
<div class="dmv-block" data-dmv-url="model.glb">
  <div class="dmv-header">
    <span class="dmv-title">Model Title</span>
    <div class="dmv-actions">
      <a class="dmv-download" href="model.glb">Download</a>
      <a class="dmv-open" href="model.glb" target="_blank" rel="noopener">Open</a>
    </div>
  </div>

  <div class="dmv-viewer" aria-label="3D model preview: Model Title">
    <!-- viewer or placeholder -->
  </div>

  <div class="dmv-status" aria-live="polite"></div>
</div>
```

  ### 6.1 Accessibility Notes

  * The status region must receive errors and loading messages.
  * The download action must remain keyboard reachable.

---

## 7. Default Behavior (Sane Defaults)

| Feature         | Default                        |
| --------------- | ------------------------------ |
| Mode            | Replace link                   |
| Width           | 100%                           |
| Height          | 480px                          |
| Lazy loading    | Visible (IntersectionObserver) |
| Viewer backend  | Babylon Viewer                 |
| Controls        | Orbit + zoom                   |
| Download button | Enabled                        |
| Open in new tab | Disabled                       |
| Debug           | Off                            |

### 7.1 Visual Defaults

* Minimal neutral styling to blend with Docsify themes
* No opinionated colors beyond basic borders and spacing

---

## 8. Configuration Overrides (Optional)

```js
window.$docsify = {
  modelViewer: {
    height: "360px",
    lazy: "click",
    showOpen: true,
    formats: ["stl", "glb", "gltf"]
  }
}
```

### 8.1 Config Schema

| Key             | Type       | Default       |         |         |
| --------------- | ---------- | ------------- | ------- | ------- |
| `enabled`       | boolean    | true          |         |         |
| `formats`       | string[]   | all supported |         |         |
| `mode`          | `"replace" | "augment"`    | replace |         |
| `width`         | CSS        | `100%`        |         |         |
| `height`        | CSS        | `480px`       |         |         |
| `aspectRatio`   | string     | null          |         |         |
| `lazy`          | `"visible" | "click"       | "none"` | visible |
| `downloadLabel` | string     | Download      |         |         |
| `showOpen`      | boolean    | false         |         |         |
| `viewerConfig`  | object     | null          |         |         |
| `debug`         | boolean    | false         |         |         |

### 8.2 Invalid Config Handling

Invalid or unknown keys are ignored; defaults remain effective.

---

## 9. Lazy Loading Strategy

### 9.1 Modes

* **visible (default)**: load when entering viewport
* **click**: explicit “Load preview” button
* **none**: immediate load

### 9.2 Fallback

If `IntersectionObserver` unavailable → click mode.

### 9.3 Idle Loading (Optional Future)

Use `requestIdleCallback` to pre-warm runtime after first interaction.

---

## 10. Error Handling

### Failure Scenarios

* Runtime load failure
* Network error
* Unsupported model content
* Decoder missing (e.g., Draco)

### Behavior

* Viewer replaced by readable error message
* Download link always preserved
* Page rendering unaffected

### 10.1 Error States

* Runtime load failure
* Mount failure
* Network or CORS failure
* Unsupported content within supported extension

---

## 11. Accessibility

* All controls keyboard-accessible
* `aria-label` on viewer container
* Error/status messages announced
* No canvas-only interaction dependency

### 11.1 Keyboard Behavior

* Load buttons must be focusable
* Actions must be visible on focus

---

## 12. Performance Considerations

* Lazy by default
* No background render loop when offscreen
* Optional future optimization: single active viewer
* No heavy WASM dependencies

### 12.1 Caching

* Cache runtime promise
* Avoid duplicate observers for the same block

---

## 13. Security Model

* No inline script execution
* No HTML injection from Markdown
* URLs treated as data only
* External opens use `rel="noopener"`

### 13.1 Trust Boundaries

* Markdown content is untrusted
* Viewer runtime is trusted from CDN
* Model files are treated as data only

---

## 14. Testing Strategy

### Unit

* Extension detection
* DOM rewrite idempotency
* Config parsing

### Integration

* Docsify route navigation
* Multiple models per page
* Lazy modes
* Error scenarios

### Manual

* GitHub Pages
* Codeberg Pages
* Local Docsify server

### 14.1 Test Matrix

| Scenario | Expected Result |
| --- | --- |
| Same route re-render | No duplicate previews |
| Two models per page | Two independent viewers |
| Unsupported format | Link left unchanged |
| Viewer runtime failure | Error message + download |
| Lazy visible | Load when in viewport |

---

## 15. Deliverables

* `docsify-model-viewer.js`
* `docsify-model-viewer.min.js`
* Minimal CSS (inline or optional file)
* README (≤ 1 page)

### 15.1 Packaging

* Include unminified and minified builds
* Export as UMD for Docsify script include

---

## 16. Future Extensions (Non-Breaking)

* Three.js lightweight backend
* Fullscreen mode
* Thumbnail placeholders
* Per-link overrides via query
* Multi-model galleries
* Docsify sidebar preview integration

### 16.1 Observability (Optional)

* Basic telemetry hooks (disabled by default)
* Debug timing logs when `debug` is true

---

## 17. Summary

**docsify-model-viewer** is intentionally boring in the best way:

* links stay links
* previews appear automatically
* formats “just work”
* defaults are sane
* overrides are easy
* architecture does not paint you into a corner

This makes it suitable for:

* technical documentation
* CAD / fabrication repos
* scanning & capture workflows
* educational material
* long-term archival docs
