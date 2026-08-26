(function () {
  'use strict';

  var DEFAULTS = {
    endpoint: '/api/upload',
    accept: 'image/*',
    maxFiles: 20,
    retries: 2,
    retryDelay: 1000
  };

  function normalizeEndpoint(endpoint) {
    return new URL(endpoint, window.location.href).toString();
  }

  function optionsFromDataset(root) {
    var dataset = root.dataset;
    return {
      endpoint: root.getAttribute('data-endpoint') || dataset.endpoint || DEFAULTS.endpoint,
      uploadPreset: dataset.uploadPreset,
      resourceType: dataset.resourceType,
      folder: dataset.folder,
      tags: dataset.tags,
      apiKey: dataset.apiKey,
      timestamp: dataset.timestamp ? Number(dataset.timestamp) : undefined,
      signature: dataset.signature
    };
  }

  function buildFormData(file, options) {
    var data = new FormData();
    data.set('file', file);
    if (options.uploadPreset) data.set('upload_preset', options.uploadPreset);
    if (options.resourceType === 'video') data.set('resource_type', 'video');
    if (options.folder) data.set('folder', options.folder);
    if (options.tags) data.set('tags', options.tags);
    if (options.apiKey) data.set('api_key', options.apiKey);
    if (typeof options.timestamp === 'number') data.set('timestamp', String(Math.floor(options.timestamp)));
    if (options.signature) data.set('api_signature', options.signature);
    return data;
  }

  function uploadWithProgress(file, options, onProgress) {
    if (options.resourceType === 'video' && (!options.endpoint || options.endpoint === DEFAULTS.endpoint)) {
      options.endpoint = '/api/videos';
    }

    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.open('POST', normalizeEndpoint(options.endpoint));
      if (options.resourceType === 'video') request.setRequestHeader('X-API-Key', options.apiKey || '');
      request.upload.addEventListener('progress', function (event) {
        if (!onProgress) return;
        onProgress({
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : null,
          progress: event.lengthComputable ? Math.min(1, event.loaded / event.total) : 0
        });
      });
      request.addEventListener('load', function () {
        resolve(new Response(request.response, {
          status: request.status,
          headers: { 'Content-Type': request.getResponseHeader('Content-Type') || 'application/json' }
        }));
      });
      request.addEventListener('error', function () { reject(new Error('Network request failed')); });
      request.send(buildFormData(file, options));
    });
  }

  async function upload(file, options, onProgress) {
    var response = await uploadWithProgress(file, options, onProgress);
    var payload;
    try { payload = await response.json(); } catch (_) { payload = null; }
    var resources = payload && (options.resourceType === 'video' ? payload.videos : payload.images);
    if (!response.ok || !payload || !payload.success || !resources || resources.length === 0) {
      var message = payload && payload.errors && payload.errors[0]
        ? payload.errors[0].error
        : 'Upload failed (' + response.status + ')';
      throw new Error(message);
    }
    return resources[0];
  }

  function renderItem(result) {
    if (!result.publicUrl) return null;
    var item = document.createElement('div');
    item.className = 'storinary-widget-result';
    item.style.display = 'flex';
    item.style.gap = '.75rem';
    item.style.alignItems = 'center';
    item.style.marginTop = '.5rem';

    var image = document.createElement('img');
    image.src = result.posterUrl || result.publicUrl;
    image.alt = result.originalName || '';
    image.style.width = '48px';
    image.style.height = '48px';
    image.style.objectFit = 'cover';
    image.loading = 'lazy';

    var link = document.createElement('a');
    link.href = result.publicUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = result.originalName || result.publicUrl;

    item.append(image, link);
    return item;
  }

  function initialize(root) {
    var selector = root.getAttribute('data-upload-target');
    var target = selector ? document.querySelector(selector) : root;
    if (!target) throw new Error('Storinary widget target not found: ' + selector);

    var output = document.createElement('div');
    output.className = 'storinary-widget-status';
    output.setAttribute('aria-live', 'polite');
    target.append(output);

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = root.getAttribute('data-accept') || DEFAULTS.accept;
    input.multiple = root.getAttribute('data-multiple') !== 'false';
    input.className = 'storinary-widget-input';
    input.setAttribute('aria-label', root.getAttribute('data-label') || 'Upload files to Storinary');

    function renderStatus(status, text) {
      while (status.firstChild) status.removeChild(status.firstChild);
      status.append(document.createTextNode(text));
    }

    function attachRetry(file, status, retry, onResult) {
      retry.type = 'button';
      retry.className = 'storinary-widget-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', async function () {
        retry.disabled = true;
        try {
          var result = await uploadOne(file, status);
          onResult(result);
          retry.remove();
        } catch (error) {
          renderStatus(status, error instanceof Error ? error.message : String(error));
          status.append(document.createTextNode(' '), retry);
          retry.disabled = false;
        }
      });
      return retry;
    }

    async function uploadOne(file, status) {
    var options = optionsFromDataset(root);
    var retryDelay = Number(root.dataset.retryDelay || DEFAULTS.retryDelay);
    if (!Number.isFinite(retryDelay) || retryDelay < 0) retryDelay = DEFAULTS.retryDelay;
    for (var attempt = 1; attempt <= DEFAULTS.retries + 1; attempt += 1) {
        try {
          renderStatus(status, 'Uploading ' + file.name + '… 0%');
          var result = await upload(file, options, function (event) {
            var percent = Math.round((event.progress || 0) * 100);
            renderStatus(status, 'Uploading ' + file.name + '… ' + percent + '%');
          });
          renderStatus(status, 'Uploaded ' + file.name);
          return result;
        } catch (error) {
          if (attempt > DEFAULTS.retries) throw error;
          renderStatus(status, 'Retrying ' + file.name + '…');
          await new Promise(function (resolve) { setTimeout(resolve, retryDelay); });
        }
      }
      throw new Error('Upload failed');
    }

    input.addEventListener('change', async function () {
      var maxFiles = Number(root.dataset.maxFiles || DEFAULTS.maxFiles);
      var files = [];
      for (var fileIndex = 0; fileIndex < (input.files || []).length; fileIndex += 1) {
        if (!input.files) break;
        files.push(input.files[fileIndex]);
      }
      var selected = files.slice(0, maxFiles);
      if (selected.length === 0) return;

      while (output.firstChild) output.removeChild(output.firstChild);
      input.value = '';

      for (var index = 0; index < selected.length; index += 1) {
        var file = selected[index];
        var status = document.createElement('small');
        status.style.display = 'block';
        output.append(status);
        try {
          var result = await uploadOne(file, status);
          var item = renderItem(result);
          if (item) output.append(item);
        } catch (error) {
          renderStatus(status, error instanceof Error ? error.message : String(error));
          status.append(document.createTextNode(' '), attachRetry(
            file,
            status,
            document.createElement('button'),
            function (retriedResult) {
              var item = renderItem(retriedResult);
              if (item) output.append(item);
            }
          ));
        }
      }
    });

    target.prepend(input);
  }

  window.StorinaryWidget = {
    init: function (selector) {
      document.querySelectorAll(selector || '.storinary-widget').forEach(initialize);
    },
    upload: upload
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.StorinaryWidget.init(); });
  } else {
    window.StorinaryWidget.init();
  }
})();
