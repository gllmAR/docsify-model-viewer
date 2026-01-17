/* docsify-model-viewer v1 */
(function () {
  var BABYLON_VERSION = "8.46.2";
  var LOCAL_SCENE_LOADER_URL = "./vendor/babylonjs-core/Loading/sceneLoader.js";
  var LOCAL_GLTF_LOADER_URL = "./vendor/babylonjs-loaders/glTF/2.0/glTFLoader.js";
  var DEFAULTS = {
    enabled: true,
    formats: ["stl", "gltf", "glb", "obj", "ply", "babylon"],
    mode: "replace",
    width: "100%",
    height: "480px",
    aspectRatio: null,
    lazy: "visible",
    downloadLabel: "Download",
    showOpen: false,
    runtimeUrls: ["./vendor/babylon-viewer.esm.min.js"],
    loaderUrls: {
      sceneLoader: LOCAL_SCENE_LOADER_URL,
      gltfLoader: LOCAL_GLTF_LOADER_URL
    },
    allowCdnFallback: true,
    silent: true,
    shaderRepository: "https://cdn.jsdelivr.net/gh/BabylonJS/Babylon.js@v" + BABYLON_VERSION + "/packages/dev/core/src/Shaders/",
    shaderRepositoryWgsl: "https://cdn.jsdelivr.net/gh/BabylonJS/Babylon.js@v" + BABYLON_VERSION + "/packages/dev/core/src/ShadersWGSL/",
    gltf: {
      loadNodeAnimations: false
    },
    disableEnvironment: true,
    viewerConfig: null,
    debug: false
  };

  var RUNTIME_MODULE_URLS = "https://cdn.jsdelivr.net/npm/@babylonjs/viewer@" + BABYLON_VERSION + "/dist/babylon-viewer.esm.min.js";
  var SCENE_LOADER_CDN_URL = "https://cdn.jsdelivr.net/npm/@babylonjs/core@" + BABYLON_VERSION + "/Loading/sceneLoader.js/+esm";
  var GLTF_LOADER_CDN_URL = "https://cdn.jsdelivr.net/npm/@babylonjs/loaders@" + BABYLON_VERSION + "/glTF/2.0/glTFLoader.js/+esm";

  var STATE = {
    observers: new Set(),
    sharedObserver: null,
    sharedObserverRoot: null,
    sharedObserverViewport: null,
    instances: new Set(),
    runtimePromise: null,
    shaderPromise: null,
    shaderRepo: null,
    shaderRepoWgsl: null,
    shaderHooked: false,
    loaderObserver: null,
    loaderConfig: null,
    loaderReady: false,
    loaderPromise: null,
    gltfPatchPromise: null,
    gltfPatched: false,
    runtimeWarm: false,
    configKey: null,
    configCache: null,
    lazyQueue: new Set(),
    lazyFallbackHandler: null,
    lazyFallbackScheduled: false,
    lazyFallbackInterval: null,
    lazyFallbackContainers: null,
    lazyInlineHandlers: [],
    lazyObservers: new Map()
  };

  function logDebug(config, message, data) {
    if (!config.debug) return;
    try {
      console.warn("[docsify-model-viewer]", message, data || "");
    } catch (err) {
      // ignore
    }
  }

  function ensureStyle() {
    if (document.getElementById("dmv-style")) return;
    var style = document.createElement("style");
    style.id = "dmv-style";
    style.textContent =
      ":root{" +
      "--dmv-bg:#ffffff;" +
      "--dmv-surface:#f6f6f6;" +
      "--dmv-border:#e6e6e6;" +
      "--dmv-text:#222222;" +
      "--dmv-muted:#666666;" +
      "--dmv-action-bg:#f8f8f8;" +
      "--dmv-action-border:#d0d0d0;" +
      "--dmv-shadow:0 8px 24px rgba(0,0,0,0.08);" +
      "}" +
      "@media (prefers-color-scheme: dark){" +
      ":root{" +
      "--dmv-bg:#1e1f22;" +
      "--dmv-surface:#24262b;" +
      "--dmv-border:#2f3136;" +
      "--dmv-text:#f2f3f5;" +
      "--dmv-muted:#9aa0a6;" +
      "--dmv-action-bg:#2b2d31;" +
      "--dmv-action-border:#3a3d43;" +
      "--dmv-shadow:0 10px 30px rgba(0,0,0,0.35);" +
      "}" +
      "}" +
      ".dmv-block{border:1px solid var(--dmv-border);border-radius:12px;margin:1rem 0;padding:0.85rem;background:var(--dmv-bg);box-shadow:var(--dmv-shadow)}" +
      ".dmv-header{display:flex;justify-content:space-between;align-items:center;gap:0.75rem;margin-bottom:0.6rem}" +
      ".dmv-title{font-weight:600;color:var(--dmv-text);text-decoration:none}" +
      ".dmv-title:hover{text-decoration:underline}" +
      ".dmv-actions{display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center}" +
      ".dmv-actions a,.dmv-actions button{font-size:0.85rem;text-decoration:none;border:1px solid var(--dmv-action-border);border-radius:8px;padding:0.3rem 0.55rem;background:var(--dmv-action-bg);color:var(--dmv-text);display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer}" +
      ".dmv-actions a:hover,.dmv-actions button:hover{filter:brightness(0.98)}" +
      ".dmv-actions a:disabled,.dmv-actions button:disabled{opacity:0.6;cursor:not-allowed}" +
      ".dmv-icon{width:16px;height:16px;display:inline-block}" +
      ".dmv-viewer{background:radial-gradient(circle at top, rgba(255,255,255,0.4), rgba(0,0,0,0)),var(--dmv-surface);border-radius:10px;overflow:hidden;min-height:140px;display:flex;align-items:center;justify-content:center;border:1px solid var(--dmv-border)}" +
      ".dmv-status{margin-top:0.5rem;font-size:0.85rem;color:var(--dmv-muted)}" +
      ".dmv-load{cursor:pointer}" +
      ".dmv-aspect{position:relative;width:100%}" +
      ".dmv-aspect > .dmv-viewer{position:absolute;inset:0}" +
      ".dmv-viewer babylon-viewer{width:100%;height:100%;--ui-foreground-color:var(--dmv-text);--ui-background-color:var(--dmv-action-bg);--ui-background-opacity:0.9}" +
      "babylon-viewer::part(tool-bar){max-width:100%;flex-wrap:wrap;row-gap:6px;overflow-x:auto;scrollbar-width:thin}" +
      "@media (max-width: 520px){babylon-viewer::part(tool-bar){font-size:0.82rem;padding:6px 8px;column-gap:6px}}" +
      ".dmv-block:fullscreen{width:100vw;height:100vh;margin:0;border-radius:0;padding:0;display:flex;flex-direction:column}" +
      ".dmv-block:fullscreen .dmv-header{padding:0.75rem 1rem;margin:0 0 0.5rem}" +
      ".dmv-block:fullscreen .dmv-status{padding:0 1rem 0.75rem;margin:0}" +
      ".dmv-block:fullscreen .dmv-viewer{flex:1 1 auto;height:100%;min-height:0;border-radius:0;border-left:0;border-right:0}" +
      ".dmv-block:fullscreen .dmv-aspect{flex:1 1 auto;height:100%;padding-top:0}" +
      ".dmv-block:fullscreen .dmv-aspect > .dmv-viewer{position:relative;height:100%}";
    document.head.appendChild(style);
  }

  function getConfig() {
    var base = (window.$docsify && window.$docsify.modelViewer) || {};
    var key = null;
    try {
      key = JSON.stringify(base || {});
    } catch (err) {
      key = null;
    }
    if (STATE.configCache && key && STATE.configKey === key) return STATE.configCache;
    var config = Object.assign({}, DEFAULTS, base || {});
    config.formats = Array.isArray(config.formats)
      ? config.formats.map(function (f) {
          return String(f || "").toLowerCase().replace(/^\./, "");
        })
      : DEFAULTS.formats.slice();
    if (config.mode !== "replace" && config.mode !== "augment") {
      config.mode = DEFAULTS.mode;
    }
    if (config.lazy !== "visible" && config.lazy !== "click" && config.lazy !== "none") {
      config.lazy = DEFAULTS.lazy;
    }
    if (typeof config.enabled !== "boolean") config.enabled = DEFAULTS.enabled;
    if (typeof config.showOpen !== "boolean") config.showOpen = DEFAULTS.showOpen;
    if (typeof config.silent !== "boolean") config.silent = DEFAULTS.silent;
    if (typeof config.downloadLabel !== "string" || !config.downloadLabel) {
      config.downloadLabel = DEFAULTS.downloadLabel;
    }
    if (typeof config.shaderRepository !== "string" || !config.shaderRepository) {
      config.shaderRepository = DEFAULTS.shaderRepository;
    }
    if (typeof config.shaderRepositoryWgsl !== "string" || !config.shaderRepositoryWgsl) {
      config.shaderRepositoryWgsl = DEFAULTS.shaderRepositoryWgsl;
    }
    if (!Array.isArray(config.runtimeUrls)) {
      config.runtimeUrls = DEFAULTS.runtimeUrls.slice();
    }
    if (!config.loaderUrls || typeof config.loaderUrls !== "object") {
      config.loaderUrls = {
        sceneLoader: DEFAULTS.loaderUrls.sceneLoader,
        gltfLoader: DEFAULTS.loaderUrls.gltfLoader
      };
    } else {
      if (!config.loaderUrls.sceneLoader) {
        config.loaderUrls.sceneLoader = DEFAULTS.loaderUrls.sceneLoader;
      }
      if (!config.loaderUrls.gltfLoader) {
        config.loaderUrls.gltfLoader = DEFAULTS.loaderUrls.gltfLoader;
      }
    }
    if (typeof config.allowCdnFallback !== "boolean") {
      config.allowCdnFallback = DEFAULTS.allowCdnFallback;
    }
    if (!config.gltf || typeof config.gltf !== "object") {
      config.gltf = DEFAULTS.gltf;
    }
    if (typeof config.disableEnvironment !== "boolean") {
      config.disableEnvironment = DEFAULTS.disableEnvironment;
    }
    if (key) {
      STATE.configKey = key;
      STATE.configCache = config;
    }
    return config;
  }

  function normalizeHrefForDetection(href) {
    if (!href) return "";
    if (href.startsWith("#")) {
      var hash = href.slice(1);
      if (hash.startsWith("/")) hash = hash.slice(1);
      return hash;
    }
    return href;
  }

  function isSupportedFormat(href, config) {
    if (!href) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    var target = normalizeHrefForDetection(href);
    if (!target) return false;
    var clean = target.split("#")[0].split("?")[0];
    var match = clean.match(/\.([^.\/]+)$/);
    if (!match) return false;
    var ext = match[1].toLowerCase();
    return config.formats.indexOf(ext) !== -1;
  }

  function getDocsifyRoutePath() {
    try {
      if (window.$docsify) {
        if (window.$docsify.route && typeof window.$docsify.route.path === "string") {
          return window.$docsify.route.path;
        }
        if (window.$docsify.router && typeof window.$docsify.router.getCurrentPath === "function") {
          return window.$docsify.router.getCurrentPath();
        }
      }
    } catch (err) {
      // ignore
    }
    return "";
  }

  function normalizeRouteBase(path) {
    if (!path) return "";
    var clean = String(path).split("?")[0].split("#")[0];
    var mdIndex = clean.toLowerCase().lastIndexOf(".md");
    if (mdIndex !== -1) {
      var cut = clean.lastIndexOf("/");
      clean = cut !== -1 ? clean.slice(0, cut + 1) : "";
    }
    if (clean && !clean.endsWith("/")) clean += "/";
    if (clean.startsWith("/")) clean = clean.slice(1);
    return clean;
  }

  function resolveModelUrl(href, routePath) {
    try {
      if (!href) return href;
      var originBase = window.location.href.split("#")[0];
      var docsifyRoute = normalizeRouteBase(routePath || getDocsifyRoutePath());
      var hash = window.location.hash || "";
      var hashRoute = hash.startsWith("#") ? hash.slice(1) : hash;
      hashRoute = normalizeRouteBase(hashRoute);
      var routeBase = originBase + (docsifyRoute || hashRoute || "");
      if (href.indexOf("#/") === 0) {
        var hashTarget = href.slice(2);
        if (hashTarget.startsWith("/")) hashTarget = hashTarget.slice(1);
        return new URL(hashTarget, routeBase || originBase).toString();
      }
      if (href.startsWith("#")) {
        var target = normalizeHrefForDetection(href);
        if (!target) return href;
        return new URL(target, originBase).toString();
      }
      if (/^(https?:)?\/\//i.test(href)) {
        return new URL(href, originBase).toString();
      }
      if (href.startsWith("/")) {
        if (docsifyRoute && href.indexOf("/" + docsifyRoute) !== 0) {
          return new URL(docsifyRoute + href.slice(1), originBase).toString();
        }
        return new URL(href, originBase).toString();
      }
      return new URL(href, routeBase || originBase).toString();
    } catch (err) {
      return href;
    }
  }

  function buildBlock(anchor, config, routePath) {
    var href = anchor.getAttribute("href") || "";
    var title = (anchor.textContent || "").trim() || href;
    var url = resolveModelUrl(href, routePath);
    logDebug(config, "resolve link", {
      href: href,
      routePath: routePath || "",
      resolved: url
    });

    var block = document.createElement("div");
    block.className = "dmv-block";
    block.setAttribute("data-dmv-url", url);
    block.setAttribute("data-dmv-mode", config.mode);

    var header = document.createElement("div");
    header.className = "dmv-header";

    var titleEl = document.createElement("a");
    titleEl.className = "dmv-title";
    titleEl.textContent = title;
    titleEl.href = url || href;
    titleEl.setAttribute("aria-label", "Download model");
    titleEl.setAttribute("title", "Download model");

    var actions = document.createElement("div");
    actions.className = "dmv-actions";

    var download = document.createElement("a");
    download.className = "dmv-download";
    download.href = url || href;
    download.setAttribute("aria-label", "Download model");
    download.setAttribute("title", "Download model");
    download.innerHTML =
      "<svg class=\"dmv-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M12 3a1 1 0 0 1 1 1v9.17l2.59-2.58a1 1 0 1 1 1.41 1.41l-4.3 4.3a1 1 0 0 1-1.4 0l-4.3-4.3a1 1 0 1 1 1.41-1.41L11 13.17V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z\"/></svg>";
    actions.appendChild(download);

    var fullscreen = document.createElement("button");
    fullscreen.type = "button";
    fullscreen.className = "dmv-fullscreen";
    fullscreen.setAttribute("aria-label", "Toggle fullscreen");
    fullscreen.setAttribute("title", "Toggle fullscreen");
    fullscreen.innerHTML =
      "<svg class=\"dmv-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M4 9V5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H6v3a1 1 0 1 1-2 0zm10-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V6h-3a1 1 0 0 1-1-1zM5 14a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zm14 0a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1z\"/></svg>";
    actions.appendChild(fullscreen);

    header.appendChild(titleEl);
    header.appendChild(actions);

    var viewerWrapper = document.createElement("div");
    viewerWrapper.className = "dmv-viewer";
    viewerWrapper.setAttribute("aria-label", "3D model preview: " + title);

    var status = document.createElement("div");
    status.className = "dmv-status";
    status.setAttribute("aria-live", "polite");

    if (config.aspectRatio) {
      var ratio = parseAspectRatio(config.aspectRatio);
      if (ratio) {
        var aspect = document.createElement("div");
        aspect.className = "dmv-aspect";
        aspect.style.paddingTop = ratio + "%";
        aspect.appendChild(viewerWrapper);
        block.appendChild(header);
        block.appendChild(aspect);
        block.appendChild(status);
      } else {
        block.appendChild(header);
        block.appendChild(viewerWrapper);
        block.appendChild(status);
      }
    } else {
      block.appendChild(header);
      block.appendChild(viewerWrapper);
      block.appendChild(status);
    }

    viewerWrapper.style.width = config.width;
    viewerWrapper.style.height = config.height;

    return {
      block: block,
      viewer: viewerWrapper,
      fullscreen: fullscreen,
      status: status,
      url: url,
      title: title
    };
  }

  function parseAspectRatio(value) {
    if (!value || typeof value !== "string") return null;
    var parts = value.split("/");
    if (parts.length !== 2) return null;
    var w = parseFloat(parts[0]);
    var h = parseFloat(parts[1]);
    if (!w || !h) return null;
    return (h / w) * 100;
  }

  function setStatus(statusEl, message) {
    if (!statusEl) return;
    statusEl.textContent = message || "";
  }

  function ensureRuntime(config) {
    if (STATE.runtimePromise) return STATE.runtimePromise;
    if (customElements && customElements.get("babylon-viewer")) {
      configureLogging(config, window.BABYLON);
      configureShaderRepository(config, window.BABYLON);
      configureLoaderOptions(config, window.BABYLON);
      STATE.runtimePromise = Promise.resolve();
      return STATE.runtimePromise;
    }

    STATE.runtimePromise = new Promise(function (resolve, reject) {
      var modulePromise = tryImportModule(getRuntimeUrls(config));
      if (modulePromise) {
        modulePromise
          .then(function (mod) {
            if (mod && typeof mod.registerCustomElements === "function") {
              try {
                mod.registerCustomElements();
              } catch (err) {
                logDebug(config, "registerCustomElements failed", err);
              }
            }
            if (mod && mod.BABYLON && !window.BABYLON) {
              window.BABYLON = mod.BABYLON;
            }
            configureLogging(config, mod && mod.BABYLON);
            configureShaderRepository(config, mod && mod.BABYLON);
            configureLoaderOptions(config, mod && mod.BABYLON);
            waitForViewerElement(resolve, reject);
          })
          .catch(function () {
            loadRuntimeScript(resolve, reject, config);
          });
        return;
      }

      loadRuntimeScript(resolve, reject, config);
    });

    STATE.runtimePromise.catch(function (err) {
      logDebug(config, "runtime load failed", err);
    });
    return STATE.runtimePromise;
  }

  function tryImportModule(urls) {
    try {
      var importer = new Function("u", "return import(u);");
      if (Array.isArray(urls)) {
        return urls.reduce(function (prev, url) {
          return prev.catch(function () {
            return importer(url);
          });
        }, Promise.reject(new Error("No module URL")));
      }
      return importer(urls);
    } catch (err) {
      return null;
    }
  }

  function loadRuntimeScript(resolve, reject, config) {
    var existing = document.querySelector('script[data-dmv-runtime="babylon"]');
    if (existing) {
      existing.addEventListener("load", function () {
        tryRegisterFromGlobal();
        configureLogging(getConfig(), window.BABYLON);
        configureShaderRepository(getConfig(), window.BABYLON);
        configureLoaderOptions(getConfig(), window.BABYLON);
        waitForViewerElement(resolve, reject);
      });
      existing.addEventListener("error", function () {
        reject(new Error("Babylon viewer runtime failed to load."));
      });
      return;
    }
    var script = document.createElement("script");
    script.type = "module";
    var urls = getRuntimeUrls(config);
    script.src = urls[urls.length - 1] || RUNTIME_MODULE_URLS;
    script.async = true;
    script.dataset.dmvRuntime = "babylon";
    script.onload = function () {
      tryRegisterFromGlobal();
      configureLogging(getConfig(), window.BABYLON);
      configureShaderRepository(getConfig(), window.BABYLON);
      configureLoaderOptions(getConfig(), window.BABYLON);
      waitForViewerElement(resolve, reject);
    };
    script.onerror = function () {
      reject(new Error("Babylon viewer runtime failed to load."));
    };
    document.head.appendChild(script);
  }

  function getRuntimeUrls(config) {
    var urls = [];
    var local = config && Array.isArray(config.runtimeUrls) ? config.runtimeUrls : DEFAULTS.runtimeUrls;
    local.forEach(function (url) {
      if (url && typeof url === "string") urls.push(url);
    });
    urls.push(RUNTIME_MODULE_URLS);
    return urls;
  }

  function normalizeUrlList(value) {
    if (Array.isArray(value)) {
      return value.filter(function (url) {
        return url && typeof url === "string";
      });
    }
    if (value && typeof value === "string") return [value];
    return [];
  }

  function getLoaderUrls(config, key) {
    var urls = normalizeUrlList(config && config.loaderUrls && config.loaderUrls[key]);
    if (!urls.length) {
      urls = normalizeUrlList(DEFAULTS.loaderUrls[key]);
    }
    if (config && config.allowCdnFallback === false) return urls;
    var cdn = key === "sceneLoader" ? SCENE_LOADER_CDN_URL : GLTF_LOADER_CDN_URL;
    if (cdn && urls.indexOf(cdn) === -1) urls.push(cdn);
    return urls;
  }

  function waitForViewerElement(resolve, reject) {
    tryRegisterFromGlobal();
    if (customElements && customElements.get("babylon-viewer")) {
      resolve();
      return;
    }
    if (!customElements || typeof customElements.whenDefined !== "function") {
      reject(new Error("Viewer runtime loaded but custom element is unavailable."));
      return;
    }
    var timeout = setTimeout(function () {
      tryRegisterFromGlobal();
      if (customElements && customElements.get("babylon-viewer")) {
        resolve();
        return;
      }
      reject(new Error("Viewer runtime loaded but custom element was not defined."));
    }, 5000);
    customElements.whenDefined("babylon-viewer").then(function () {
      clearTimeout(timeout);
      resolve();
    });
  }

  function configureShaderRepository(config, babylon) {
    try {
      var target = babylon || window.BABYLON;
      if (!target) return;
      var repo = (config && config.shaderRepository) || DEFAULTS.shaderRepository;
      var repoWgsl = (config && config.shaderRepositoryWgsl) || DEFAULTS.shaderRepositoryWgsl;
      if (typeof repo !== "string" || !repo) return;
      if (repo.slice(-1) !== "/") repo += "/";
      if (typeof repoWgsl === "string" && repoWgsl && repoWgsl.slice(-1) !== "/") {
        repoWgsl += "/";
      }
      if (target.Engine) {
        target.Engine.ShadersRepository = repo;
      }
      if (target.ShaderStore) {
        target.ShaderStore.ShadersRepository = repo;
        if (repoWgsl) {
          target.ShaderStore.ShadersRepositoryWGSL = repoWgsl;
        }
      }
      if (target.Effect) {
        target.Effect.ShadersRepository = repo;
      }
      ensureShaderRepository(repo);
      ensureShaderLoaderRedirect(config);
    } catch (err) {
      // ignore
    }
  }

  function configureLogging(config, babylon) {
    try {
      var target = babylon || window.BABYLON;
      if (!target || !target.Logger) return;
      if (config && config.silent) {
        target.Logger.LogLevels = target.Logger.NoneLogLevel || 0;
        target.Logger.Log = function () {};
        target.Logger.Warn = function () {};
      }
    } catch (err) {
      // ignore
    }
  }

  function configureLoaderOptions(config, babylon) {
    return ensureLoaderOptionsAsync(config, babylon).then(function () {
      return ensureGltfAnimationPatch(config);
    });
  }

  function ensureLoaderOptionsAsync(config, babylon) {
    try {
      var gltfOptions = (config && config.gltf) || DEFAULTS.gltf;
      if (gltfOptions && typeof gltfOptions === "object") {
        STATE.loaderConfig = gltfOptions;
      }
      if (STATE.loaderReady) return Promise.resolve();
      if (STATE.loaderPromise) return STATE.loaderPromise;

      var installObserver = function (sceneLoader) {
        if (!sceneLoader || !sceneLoader.OnPluginActivatedObservable) return false;
        if (!STATE.loaderObserver) {
          STATE.loaderObserver = sceneLoader.OnPluginActivatedObservable.add(function (plugin) {
            try {
              if (!plugin || plugin.name !== "gltf") return;
              var options = STATE.loaderConfig || DEFAULTS.gltf;
              if (!options || typeof options !== "object") return;
              Object.keys(options).forEach(function (key) {
                if (key in plugin) {
                  plugin[key] = options[key];
                }
              });
            } catch (err) {
              // ignore
            }
          });
        }
        STATE.loaderReady = true;
        return true;
      };

      var target = babylon || window.BABYLON;
      if (target && target.SceneLoader && installObserver(target.SceneLoader)) {
        return Promise.resolve();
      }

      var sceneLoaderUrls = getLoaderUrls(config, "sceneLoader");
      var modulePromise = tryImportModule(sceneLoaderUrls);
      if (!modulePromise) {
        STATE.loaderReady = true;
        return Promise.resolve();
      }
      STATE.loaderPromise = modulePromise
        .then(function (mod) {
          var sceneLoader = mod && (mod.SceneLoader || mod.default);
          installObserver(sceneLoader);
        })
        .catch(function () {
          // ignore
        })
        .then(function () {
          STATE.loaderReady = true;
        });
      return STATE.loaderPromise;
    } catch (err) {
      return Promise.resolve();
    }
  }

  function ensureGltfAnimationPatch(config) {
    try {
      var gltfOptions = (config && config.gltf) || DEFAULTS.gltf;
      if (!gltfOptions || gltfOptions.loadNodeAnimations !== false) {
        return Promise.resolve();
      }
      if (STATE.gltfPatched) return Promise.resolve();
      if (STATE.gltfPatchPromise) return STATE.gltfPatchPromise;
      var gltfLoaderUrls = getLoaderUrls(config, "gltfLoader");
      var modulePromise = tryImportModule(gltfLoaderUrls);
      if (!modulePromise) {
        STATE.gltfPatched = true;
        return Promise.resolve();
      }
      STATE.gltfPatchPromise = modulePromise
        .then(function (mod) {
          var GLTFLoaderCtor = mod && (mod.GLTFLoader || mod.default);
          if (!GLTFLoaderCtor || !GLTFLoaderCtor.prototype) return;
          if (GLTFLoaderCtor.prototype.__dmvPatched) return;
          var originalLoadAnimations = GLTFLoaderCtor.prototype._loadAnimationsAsync;
          GLTFLoaderCtor.prototype._loadAnimationsAsync = function () {
            try {
              var parent = this && this._parent;
              if (parent && parent.loadNodeAnimations === false) {
                return Promise.resolve();
              }
            } catch (err) {
              // ignore
            }
            return originalLoadAnimations ? originalLoadAnimations.apply(this, arguments) : Promise.resolve();
          };
          GLTFLoaderCtor.prototype.__dmvPatched = true;
        })
        .catch(function () {
          // ignore
        })
        .then(function () {
          STATE.gltfPatched = true;
        });
      return STATE.gltfPatchPromise;
    } catch (err) {
      return Promise.resolve();
    }
  }

  function ensureShaderRepository(repo) {
    try {
      if (!repo || typeof repo !== "string") return;
      if (repo.slice(-1) !== "/") repo += "/";
      if (STATE.shaderRepo === repo && STATE.shaderPromise) return STATE.shaderPromise;
      STATE.shaderRepo = repo;
      var importer = new Function("u", "return import(u);");
      var effectUrl = "https://cdn.jsdelivr.net/npm/@babylonjs/core@" + BABYLON_VERSION + "/Materials/effect.js/+esm";
      var shaderStoreUrl = "https://cdn.jsdelivr.net/npm/@babylonjs/core@" + BABYLON_VERSION + "/Engines/shaderStore.js/+esm";
      STATE.shaderPromise = Promise.all([
        importer(effectUrl).catch(function () { return null; }),
        importer(shaderStoreUrl).catch(function () { return null; })
      ]).then(function (mods) {
        var effectMod = mods[0];
        var shaderStoreMod = mods[1];
        var EffectCtor = effectMod && (effectMod.Effect || effectMod.default);
        var ShaderStoreCtor = shaderStoreMod && (shaderStoreMod.ShaderStore || shaderStoreMod.default);
        if (EffectCtor && typeof EffectCtor.ShadersRepository === "string") {
          EffectCtor.ShadersRepository = repo;
        }
        if (ShaderStoreCtor && typeof ShaderStoreCtor.ShadersRepository === "string") {
          ShaderStoreCtor.ShadersRepository = repo;
        }
        if (ShaderStoreCtor && typeof ShaderStoreCtor.ShadersRepositoryWGSL === "string") {
          var wgslRepo = STATE.shaderRepoWgsl || DEFAULTS.shaderRepositoryWgsl;
          if (wgslRepo && wgslRepo.slice(-1) !== "/") wgslRepo += "/";
          ShaderStoreCtor.ShadersRepositoryWGSL = wgslRepo;
        }
      });
      return STATE.shaderPromise;
    } catch (err) {
      return null;
    }
  }

  function ensureShaderLoaderRedirect(config) {
    if (STATE.shaderHooked) return;
    STATE.shaderHooked = true;
    var repo = (config && config.shaderRepository) || DEFAULTS.shaderRepository;
    var repoWgsl = (config && config.shaderRepositoryWgsl) || DEFAULTS.shaderRepositoryWgsl;
    if (repo && repo.slice(-1) !== "/") repo += "/";
    if (repoWgsl && repoWgsl.slice(-1) !== "/") repoWgsl += "/";
    STATE.shaderRepo = repo || STATE.shaderRepo;
    STATE.shaderRepoWgsl = repoWgsl || STATE.shaderRepoWgsl;

    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
      try {
        var nextUrl = rewriteShaderUrl(String(url || ""));
        if (nextUrl) {
          url = nextUrl;
        }
      } catch (err) {
        // ignore
      }
      return originalOpen.call(this, method, url, async, user, password);
    };

    if (typeof window.fetch === "function") {
      var originalFetch = window.fetch;
      window.fetch = function (input, init) {
        try {
          var rawUrl = typeof input === "string" ? input : (input && input.url) || "";
          var nextFetchUrl = rewriteShaderUrl(String(rawUrl || ""));
          if (nextFetchUrl) {
            if (typeof input === "string") {
              input = nextFetchUrl;
            } else if (input && input.url) {
              input = new Request(nextFetchUrl, input);
            }
          }
        } catch (err) {
          // ignore
        }
        return originalFetch.call(this, input, init);
      };
    }
  }

  function rewriteShaderUrl(url) {
    if (!url) return null;
    var repo = STATE.shaderRepo || DEFAULTS.shaderRepository;
    var repoWgsl = STATE.shaderRepoWgsl || DEFAULTS.shaderRepositoryWgsl;
    if (repo && repo.slice(-1) !== "/") repo += "/";
    if (repoWgsl && repoWgsl.slice(-1) !== "/") repoWgsl += "/";
    var wgslNeedle = "/src/ShadersWGSL/";
    var wgslIndex = url.indexOf(wgslNeedle);
    if (wgslIndex !== -1 && repoWgsl) {
      return repoWgsl + url.slice(wgslIndex + wgslNeedle.length);
    }
    if (url.indexOf("src/ShadersWGSL/") === 0 && repoWgsl) {
      return repoWgsl + url.slice("src/ShadersWGSL/".length);
    }
    var needle = "/src/Shaders/";
    var index = url.indexOf(needle);
    if (index !== -1 && repo) {
      return repo + url.slice(index + needle.length);
    }
    if (url.indexOf("src/Shaders/") === 0 && repo) {
      return repo + url.slice("src/Shaders/".length);
    }
    return null;
  }

  function tryRegisterFromGlobal() {
    try {
      var candidates = [];
      if (window.BabylonViewer) candidates.push(window.BabylonViewer);
      if (window.BABYLON && window.BABYLON.Viewer) candidates.push(window.BABYLON.Viewer);
      if (window.BABYLON && window.BABYLON.Viewer && window.BABYLON.Viewer.HTML3DElement) {
        candidates.push(window.BABYLON.Viewer.HTML3DElement);
      }
      if (window.BABYLON && window.BABYLON.Viewer && window.BABYLON.Viewer.CustomElements) {
        candidates.push(window.BABYLON.Viewer.CustomElements);
      }

      candidates.forEach(function (candidate) {
        if (candidate && typeof candidate.registerCustomElements === "function") {
          candidate.registerCustomElements();
        }
      });
    } catch (err) {
      // ignore
    }
  }

  function mountViewer(container, url, config, statusEl, optionsOverride) {
    configureShaderRepository(config, window.BABYLON);
    ensureShaderLoaderRedirect(config);
    var viewer = document.createElement("babylon-viewer");
    var pendingUrl = url;
    var options = null;
    if (config.viewerConfig && typeof config.viewerConfig === "object") {
      options = Object.assign({}, config.viewerConfig);
    }
    if (!options) {
      options = {
        environmentLighting: "none",
        environmentSkybox: "none"
      };
    }
    if (optionsOverride && typeof optionsOverride === "object") {
      options = Object.assign(options || {}, optionsOverride);
    }
    if (config.disableEnvironment) {
      options = Object.assign(options || {}, {
        environmentLighting: "none",
        environmentSkybox: "none"
      });
    }
    if (options) {
      try {
        viewer.viewerOptions = options;
      } catch (err) {
        logDebug(config, "viewerConfig apply failed", err);
      }
    }
    viewer.addEventListener("modelerror", function (event) {
      setStatus(statusEl, "Failed to load preview.");
      logDebug(config, "model error", { url: url, event: event });
    }, { once: true });
    viewer.addEventListener("environmenterror", function (event) {
      logDebug(config, "environment error", { url: url, event: event });
      var hasEnvOverride = options && ("environmentLighting" in options || "environmentSkybox" in options);
      if (!config.__dmvEnvFallback && !hasEnvOverride) {
        config.__dmvEnvFallback = true;
        setStatus(statusEl, "Retrying without environment...");
        mountViewer(container, url, config, statusEl, {
          environmentLighting: "none",
          environmentSkybox: "none"
        });
        return;
      }
      setStatus(statusEl, "Failed to load preview.");
    }, { once: true });
    viewer.addEventListener("viewerready", function (event) {
      if (config.disableEnvironment) {
        try {
          var detail = event && event.detail;
          var scene = (detail && (detail.scene || (detail.viewer && detail.viewer.scene))) || viewer.scene || (viewer.viewer && viewer.viewer.scene);
          if (scene && scene.environmentTexture) {
            scene.environmentTexture = null;
          }
        } catch (err) {
          // ignore
        }
      }
      setStatus(statusEl, "");
    }, { once: true });
    viewer.style.width = "100%";
    viewer.style.height = "100%";
    container.innerHTML = "";
    container.appendChild(viewer);
    var applySource = function () {
      if (!viewer.isConnected) return;
      viewer.setAttribute("source", pendingUrl);
      viewer.setAttribute("src", pendingUrl);
      logDebug(config, "set source", { url: pendingUrl });
    };
    applySource();
    configureLoaderOptions(config, window.BABYLON).then(function () {
      applySource();
    });
    return viewer;
  }

  function unmountViewer(instance) {
    try {
      if (instance && instance.parentNode) {
        instance.parentNode.removeChild(instance);
      }
    } catch (err) {
      // ignore
    }
  }

  function loadPreview(blockInfo, config) {
    if (blockInfo.block.getAttribute("data-dmv-loaded") === "true") return;
    if (blockInfo.block.getAttribute("data-dmv-loading") === "true") return;
    blockInfo.block.setAttribute("data-dmv-loading", "true");
    logDebug(config, "loadPreview", {
      url: blockInfo.url,
      title: blockInfo.title,
      lazy: config.lazy
    });
    setStatus(blockInfo.status, "Loading preview...");
    ensureRuntime(config)
      .then(function () {
        configureShaderRepository(config, window.BABYLON);
        if (!customElements || !customElements.get("babylon-viewer")) {
          setStatus(blockInfo.status, "Viewer runtime loaded but element is unavailable.");
          logDebug(config, "viewer element not defined", { url: blockInfo.url });
          blockInfo.block.removeAttribute("data-dmv-loading");
          return;
        }
        var instance = mountViewer(blockInfo.viewer, blockInfo.url, config, blockInfo.status);
        blockInfo.block.setAttribute("data-dmv-loaded", "true");
        blockInfo.block.removeAttribute("data-dmv-loading");
        if (STATE.lazyQueue && STATE.lazyQueue.size) {
          STATE.lazyQueue.delete(blockInfo.block);
        }
        if (blockInfo.fullscreen) {
          var fsAvailable = !!(blockInfo.viewer && blockInfo.viewer.requestFullscreen);
          if (!fsAvailable) {
            blockInfo.fullscreen.disabled = true;
          } else {
            blockInfo.fullscreen.addEventListener("click", function () {
              try {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  blockInfo.block.requestFullscreen();
                }
              } catch (err) {
                // ignore
              }
            });
          }
        }
        STATE.instances.add(instance);
      })
      .catch(function (err) {
        setStatus(blockInfo.status, "Failed to load preview.");
        logDebug(config, "preview load failed", { url: blockInfo.url, error: err });
        blockInfo.block.removeAttribute("data-dmv-loading");
      });
  }

  function attachLazy(blockInfo, config) {
    if (config.lazy === "none") {
      loadPreview(blockInfo, config);
      return;
    }

    if (config.lazy === "click") {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "dmv-load";
      button.textContent = "Load preview";
      button.addEventListener("click", function () {
        loadPreview(blockInfo, config);
      });
      blockInfo.viewer.innerHTML = "";
      blockInfo.viewer.appendChild(button);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      var fallback = document.createElement("button");
      fallback.type = "button";
      fallback.className = "dmv-load";
      fallback.textContent = "Load preview";
      fallback.addEventListener("click", function () {
        loadPreview(blockInfo, config);
      });
      blockInfo.viewer.innerHTML = "";
      blockInfo.viewer.appendChild(fallback);
      return;
    }

    var root = getScrollParent(blockInfo.block);
    logDebug(config, "attachLazy", {
      url: blockInfo.url,
      title: blockInfo.title,
      root: root ? (root.className || root.id || root.tagName) : null
    });
    blockInfo.block.__dmvBlockInfo = blockInfo;
    blockInfo.block.__dmvScrollParent = root || null;
    var observer = getLazyObserver(root, config);
    try {
      observer.observe(blockInfo.block);
    } catch (err) {
      // ignore
    }
    var viewportObserver = getLazyObserver(null, config);
    if (viewportObserver && viewportObserver !== observer) {
      try {
        viewportObserver.observe(blockInfo.block);
      } catch (err) {
        // ignore
      }
    }
    STATE.lazyQueue.add(blockInfo.block);
    ensureLazyFallback(config);
    attachInlineLazyCheck(blockInfo, config);
    blockInfo.viewer.textContent = "Preview will load when visible.";
    scheduleLazyCheck(config);
  }

  function attachInlineLazyCheck(blockInfo, config) {
    if (!blockInfo || !blockInfo.block) return;
    var handler = function () {
      if (!blockInfo.block || blockInfo.block.getAttribute("data-dmv-loaded") === "true") return;
      var root = blockInfo.block.__dmvScrollParent || getScrollParent(blockInfo.block);
      if (isElementVisible(blockInfo.block, 200, root || null)) {
        loadPreview(blockInfo, config);
      }
    };
    try {
      window.addEventListener("scroll", handler, { passive: true });
      window.addEventListener("resize", handler);
      document.addEventListener("scroll", handler, true);
      document.addEventListener("visibilitychange", handler);
    } catch (err) {
      // ignore
    }
    try {
      var content = document.querySelector(".content");
      if (content) content.addEventListener("scroll", handler, { passive: true });
    } catch (err) {
      // ignore
    }
    try {
      var parent = blockInfo.block.__dmvScrollParent || getScrollParent(blockInfo.block);
      if (parent) parent.addEventListener("scroll", handler, { passive: true });
    } catch (err) {
      // ignore
    }
    STATE.lazyInlineHandlers.push({ handler: handler, block: blockInfo.block });
    handler();
  }

  function getLazyObserver(root, config) {
    try {
      var key = root || "__viewport__";
      if (STATE.lazyObservers.has(key)) return STATE.lazyObservers.get(key);
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            logDebug(config, "observer hit", {
              url: entry.target && entry.target.__dmvBlockInfo && entry.target.__dmvBlockInfo.url,
              root: root ? (root.className || root.id || root.tagName) : null
            });
            observer.unobserve(entry.target);
            var target = entry.target.__dmvBlockInfo;
            if (target) loadPreview(target, config);
          }
        });
      }, { root: root || null, rootMargin: "200px" });
      STATE.lazyObservers.set(key, observer);
      STATE.observers.add(observer);
      return observer;
    } catch (err) {
      return null;
    }
  }

  function getScrollParent(element) {
    if (!element) return null;
    var current = element.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      if (isScrollable(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  function getObserverRoot() {
    try {
      var content = document.querySelector(".content");
      if (content && isScrollable(content)) return content;
      var main = document.getElementById("main");
      if (main && isScrollable(main)) return main;
      var body = document.body;
      if (body && isScrollable(body)) return body;
      var docEl = document.documentElement;
      if (docEl && isScrollable(docEl)) return docEl;
    } catch (err) {
      // ignore
    }
    return null;
  }

  function isScrollable(element) {
    if (!element) return false;
    try {
      var style = window.getComputedStyle(element);
      var overflowY = style.overflowY || style.overflow;
      var overflowX = style.overflowX || style.overflow;
      var canScrollY = /(auto|scroll|overlay)/.test(overflowY);
      var canScrollX = /(auto|scroll|overlay)/.test(overflowX);
      return (canScrollY && element.scrollHeight > element.clientHeight) ||
        (canScrollX && element.scrollWidth > element.clientWidth);
    } catch (err) {
      return false;
    }
  }

  function ensureLazyFallback(config) {
    if (STATE.lazyFallbackHandler) return;
    STATE.lazyFallbackHandler = function () {
      scheduleLazyCheck(config);
    };
    var containers = [];
    try {
      containers.push(window);
    } catch (err) {
      // ignore
    }
    try {
      if (document) {
        containers.push(document);
        if (document.body) containers.push(document.body);
        if (document.documentElement) containers.push(document.documentElement);
      }
    } catch (err) {
      // ignore
    }
    try {
      var content = document.querySelector(".content");
      if (content) containers.push(content);
    } catch (err) {
      // ignore
    }
    STATE.lazyFallbackContainers = containers;
    try {
      window.addEventListener("scroll", STATE.lazyFallbackHandler, { passive: true });
      window.addEventListener("resize", STATE.lazyFallbackHandler);
      document.addEventListener("scroll", STATE.lazyFallbackHandler, true);
    } catch (err) {
      // ignore
    }
    containers.forEach(function (container) {
      if (!container || container === window || container === document) return;
      try {
        container.addEventListener("scroll", STATE.lazyFallbackHandler, { passive: true });
      } catch (err) {
        // ignore
      }
    });
    if (!STATE.lazyFallbackInterval) {
      STATE.lazyFallbackInterval = setInterval(function () {
        checkLazyQueue(config);
      }, 500);
    }
    scheduleLazyCheck(config);
  }

  function scheduleLazyCheck(config) {
    if (STATE.lazyFallbackScheduled) return;
    STATE.lazyFallbackScheduled = true;
    var schedule = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    schedule(function () {
      STATE.lazyFallbackScheduled = false;
      checkLazyQueue(config);
    });
  }

  function checkLazyQueue(config) {
    if (!STATE.lazyQueue || !STATE.lazyQueue.size) return;
    var margin = 200;
    var items = Array.from(STATE.lazyQueue);
    items.forEach(function (el) {
      if (!el || !el.isConnected) {
        STATE.lazyQueue.delete(el);
        return;
      }
      var root = el.__dmvScrollParent || getScrollParent(el) || null;
      if (isNearBottom(root, margin)) {
        logDebug(config, "lazy bottom trigger", { url: el.__dmvBlockInfo && el.__dmvBlockInfo.url });
        var infoBottom = el.__dmvBlockInfo;
        if (infoBottom) loadPreview(infoBottom, config);
        return;
      }
      if (isElementVisible(el, margin, root)) {
        logDebug(config, "lazy visible", {
          url: el.__dmvBlockInfo && el.__dmvBlockInfo.url
        });
        var info = el.__dmvBlockInfo;
        if (info) loadPreview(info, config);
      }
    });
    if (!STATE.lazyQueue.size && STATE.lazyFallbackInterval) {
      clearInterval(STATE.lazyFallbackInterval);
      STATE.lazyFallbackInterval = null;
    }
  }

  function isElementVisible(element, margin, root) {
    try {
      var rect = element.getBoundingClientRect();
      var windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      var windowWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      var m = typeof margin === "number" ? margin : 0;
      if (root && root !== window && root !== document) {
        var rootRect = null;
        try {
          if (root.getBoundingClientRect) rootRect = root.getBoundingClientRect();
        } catch (err) {
          rootRect = null;
        }
        if (rootRect) {
          return rect.bottom >= rootRect.top - m &&
            rect.right >= rootRect.left - m &&
            rect.top <= rootRect.bottom + m &&
            rect.left <= rootRect.right + m;
        }
      }
      return rect.bottom >= -m && rect.right >= -m && rect.top <= windowHeight + m && rect.left <= windowWidth + m;
    } catch (err) {
      return false;
    }
  }

  function isNearBottom(root, margin) {
    var m = typeof margin === "number" ? margin : 0;
    try {
      if (root && root !== window && root !== document) {
        var clientHeight = root.clientHeight || 0;
        var scrollHeight = root.scrollHeight || 0;
        var scrollTop = root.scrollTop || 0;
        return scrollHeight - (scrollTop + clientHeight) <= m;
      }
    } catch (err) {
      // ignore
    }
    try {
      var docEl = document.documentElement || {};
      var body = document.body || {};
      var scrollTopWin = window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
      var clientHeightWin = window.innerHeight || docEl.clientHeight || body.clientHeight || 0;
      var scrollHeightWin = Math.max(docEl.scrollHeight || 0, body.scrollHeight || 0);
      return scrollHeightWin - (scrollTopWin + clientHeightWin) <= m;
    } catch (err) {
      return false;
    }
  }

  function cleanup() {
    STATE.observers.forEach(function (observer) {
      try {
        observer.disconnect();
      } catch (err) {
        // ignore
      }
    });
    STATE.observers.clear();
    if (STATE.sharedObserver) {
      try {
        STATE.sharedObserver.disconnect();
      } catch (err) {
        // ignore
      }
      STATE.sharedObserver = null;
      STATE.sharedObserverRoot = null;
    }
    if (STATE.sharedObserverViewport) {
      try {
        STATE.sharedObserverViewport.disconnect();
      } catch (err) {
        // ignore
      }
      STATE.sharedObserverViewport = null;
    }
    if (STATE.lazyFallbackHandler) {
      try {
        window.removeEventListener("scroll", STATE.lazyFallbackHandler);
        window.removeEventListener("resize", STATE.lazyFallbackHandler);
        document.removeEventListener("scroll", STATE.lazyFallbackHandler, true);
      } catch (err) {
        // ignore
      }
      if (STATE.lazyFallbackContainers && STATE.lazyFallbackContainers.length) {
        STATE.lazyFallbackContainers.forEach(function (container) {
          if (!container || container === window || container === document) return;
          try {
            container.removeEventListener("scroll", STATE.lazyFallbackHandler);
          } catch (err) {
            // ignore
          }
        });
      }
      STATE.lazyFallbackHandler = null;
    }
    STATE.lazyFallbackScheduled = false;
    if (STATE.lazyFallbackInterval) {
      clearInterval(STATE.lazyFallbackInterval);
      STATE.lazyFallbackInterval = null;
    }
    STATE.lazyFallbackContainers = null;
    STATE.lazyQueue.clear();
    if (STATE.lazyInlineHandlers && STATE.lazyInlineHandlers.length) {
      STATE.lazyInlineHandlers.forEach(function (entry) {
        try {
          window.removeEventListener("scroll", entry.handler);
          window.removeEventListener("resize", entry.handler);
          document.removeEventListener("scroll", entry.handler, true);
          document.removeEventListener("visibilitychange", entry.handler);
          var content = document.querySelector(".content");
          if (content) content.removeEventListener("scroll", entry.handler);
          var parent = entry.block && entry.block.__dmvScrollParent;
          if (parent) parent.removeEventListener("scroll", entry.handler);
        } catch (err) {
          // ignore
        }
      });
    }
    STATE.lazyInlineHandlers = [];
    if (STATE.lazyObservers && STATE.lazyObservers.size) {
      STATE.lazyObservers.clear();
    }
    STATE.instances.forEach(function (instance) {
      unmountViewer(instance);
    });
    STATE.instances.clear();
  }

  function warmRuntime(config) {
    if (STATE.runtimeWarm) return;
    STATE.runtimeWarm = true;
    var schedule = window.requestIdleCallback || function (cb) { return setTimeout(cb, 300); };
    schedule(function () { ensureRuntime(config); });
  }

  function processContainer(container, config, routePath) {
    if (!container) return;
    ensureStyle();

    var anchors = Array.prototype.slice.call(container.querySelectorAll("a[href]"));
    var found = false;
    anchors.forEach(function (anchor) {
      if (anchor.dataset.dmvProcessed === "true") return;
      if (anchor.closest(".dmv-block")) return;

      var href = anchor.getAttribute("href") || "";
      if (!isSupportedFormat(href, config)) return;
      found = true;

      var blockInfo = buildBlock(anchor, config, routePath);
      anchor.dataset.dmvProcessed = "true";

      if (config.mode === "augment") {
        anchor.insertAdjacentElement("afterend", blockInfo.block);
      } else {
        anchor.replaceWith(blockInfo.block);
      }

      attachLazy(blockInfo, config);
    });
    if (found && config.lazy === "none") warmRuntime(config);
  }

  function plugin(hook, vm) {
    hook.beforeEach(function (content) {
      cleanup();
      return content;
    });

    hook.doneEach(function () {
      var config = getConfig();
      if (!config.enabled) return;
      var container = document.querySelector(".content") || document.getElementById("main") || document.body;
      var routePath = "";
      if (vm && vm.route) {
        if (typeof vm.route.path === "string") routePath = vm.route.path;
        else if (typeof vm.route.file === "string") routePath = vm.route.file;
      }
      if (!routePath) {
        var hash = window.location.hash || "";
        if (hash.indexOf("#/") === 0) routePath = hash.slice(1);
      }
      processContainer(container, config, routePath);
    });
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(plugin);
})();
