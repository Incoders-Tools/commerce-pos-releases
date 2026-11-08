'use strict';

// Turns the two buttons into direct downloads of the setup zip of the newest production release
// (not a prerelease) and the newest test release (prerelease) of the public releases repository.
// Without this script, or when the GitHub API is unreachable or rate-limited, both buttons keep
// opening the releases page and the note under them says what to download there.
(() => {
  const $ = (id) => document.getElementById(id);
  const REPO = 'Incoders-Tools/commerce-pos-releases';
  const RELEASES = `https://github.com/${REPO}/releases`;
  const API = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
  const TAG = /^v\d+\.\d{4}\.\d+(-rc\.\d+)?$/;
  const SETUP = /^commerce-pos-setup-[\d.]+\.zip$/;

  const NOTE_FAILED = 'No pudimos consultar la última versión. Los botones abren la página de descargas: '
    + 'ahí bajá el archivo que empieza con commerce-pos-setup y termina en .zip; '
    + 'la versión de pruebas es la marcada como Pre-release.';

  /** The setup zip of a release, or null when it has none served from that release's own folder. */
  function setupUrl(release) {
    const prefix = `${RELEASES}/download/${release.tag_name}/`;
    const asset = (Array.isArray(release.assets) ? release.assets : []).find((a) => {
      const name = String(a && a.name);
      const url = String(a && a.browser_download_url);
      return SETUP.test(name) && url === prefix + name;
    });
    return asset ? asset.browser_download_url : null;
  }

  /** The newest usable release of one kind, by published date, or null. */
  function newest(releases, prerelease) {
    return releases
      .filter((r) => r && !r.draft && r.prerelease === prerelease && typeof r.tag_name === 'string'
        && TAG.test(r.tag_name) && (r.tag_name.includes('-rc.') === prerelease))
      .map((r) => ({ release: r, url: setupUrl(r), date: new Date(r.published_at) }))
      .filter((c) => c.url && !Number.isNaN(c.date.getTime()))
      .sort((a, b) => b.date - a.date)[0] || null;
  }

  function describe(choice) {
    const version = choice.release.tag_name.replace(/^v/, '').replace(/-rc\.\d+$/, '');
    const day = choice.date.toLocaleDateString('es-AR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
    });
    return `Versión ${version} · ${day}`;
  }

  function show(id, choice, fallbackText) {
    const button = $(id);
    const detail = $(`${id}-detail`);
    if (choice) {
      button.href = choice.url;
      detail.textContent = describe(choice);
      return;
    }
    // No release of this kind yet: say so and disable the button.
    button.removeAttribute('href');
    button.setAttribute('aria-disabled', 'true');
    button.classList.add('disabled');
    detail.textContent = fallbackText;
  }

  async function load() {
    const status = $('status');
    status.textContent = 'Buscando la última versión…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const releases = await response.json();
      if (!Array.isArray(releases)) throw new Error('unexpected response');

      const prod = newest(releases, false);
      const test = newest(releases, true);
      show('prod', prod, 'Todavía no hay versión de producción');
      show('test', test, 'Todavía no hay versión de pruebas');
      if (!prod && test) {
        // The test release is the only one to download: give it the main button's look.
        $('test').classList.replace('secondary', 'primary');
        status.textContent = 'Por ahora solo está la versión de pruebas.';
      } else {
        status.textContent = '';
        status.hidden = true;
      }
    } catch {
      // Offline, rate-limited or blocked: the buttons keep opening the releases page.
      status.textContent = NOTE_FAILED;
    } finally {
      clearTimeout(timer);
    }
  }

  load();
})();
