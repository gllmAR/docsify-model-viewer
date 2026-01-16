# docsify-model-viewer

Docsify plugin that converts standard Markdown links to supported 3D models into inline, interactive previews while keeping a download link.

[Acrobatic Plane glb](./samples/babylonjs/acrobaticPlane_variants.glb)

## Quick Start (Docsify v5)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/core.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/docsify@5/dist/themes/addons/core-dark.min.css" media="(prefers-color-scheme: dark)">

<script>
	window.$docsify = {
		name: "docsify-model-viewer",
		modelViewer: {
			height: "420px",
			lazy: "visible",
			showOpen: true
		}
	};
</script>

<script src="https://cdn.jsdelivr.net/npm/docsify@5/dist/docsify.min.js"></script>
<script src="https://gllmar.github.io/docsify-model-viewer/docsify-model-viewer.js"></script>
```

Then in Markdown:

```md
[Example Model](models/example.glb)
```

## Supported Formats

Supported extensions (case-insensitive):

* `.stl`
* `.gltf`, `.glb`
* `.obj`
* `.ply`
* `.babylon`

## Babylon Viewer (V2) Notes

This plugin uses the Babylon Viewer V2 custom element (`<babylon-viewer>`) via the public CDN runtime:

* The Viewer dynamically loads format loaders on demand.
* WebGL/WebGPU engines are supported and selected automatically.
* Rendering is suspended when the viewer is offscreen for power savings.

For production bundling, Babylon recommends installing `@babylonjs/viewer` via npm and bundling your own build; this plugin defaults to CDN for zero-config usage.

## Configuration

All settings are optional under `window.$docsify.modelViewer`.

```js
window.$docsify = {
	modelViewer: {
		enabled: true,
		formats: ["stl", "glb", "gltf"],
		mode: "replace",
		width: "100%",
		height: "480px",
		aspectRatio: null,
		lazy: "visible",
		downloadLabel: "Download",
		showOpen: false,
		viewerConfig: null,
		debug: false
	}
}
```
