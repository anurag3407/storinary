// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';

type MockXHR = XMLHttpRequest & {
  status: number;
  listeners: Map<string, EventListener>;
};

async function createWidgetSource() {
  return (await import('../../public/storinary-widget.js?raw' as string)).default;
}

function createMockXHR(responses: Array<{ payload: unknown; status?: number }>) {
  let requestIndex = 0;

  const serializedResponses = responses.map(({ payload }) => JSON.stringify(payload));

  return class MockXHR {
    static instances: MockXHR[] = [];

    upload = new EventTarget();

    open = vi.fn();

    setRequestHeader = vi.fn();

    status = 200;

    listeners = new Map<string, EventListener>();

    constructor() {
      const responseIndex = Math.min(requestIndex++, responses.length - 1);
      this.status = responses[responseIndex].status ?? 200;
      (this as unknown as { response: string }).response = serializedResponses[responseIndex];
      MockXHR.instances.push(this as MockXHR);
    }

    getResponseHeader(name: string) {
      return name === 'Content-Type' ? 'application/json' : null;
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      this.listeners.set(type, listener as EventListener);
    }

    send() {
      this.upload.dispatchEvent(new ProgressEvent('progress', {
        lengthComputable: true,
        loaded: 1,
        total: 4,
      }));
      this.listeners.get('load')?.call(this, new ProgressEvent('load'));
    }
  } as unknown as (new () => MockXHR) & { instances: MockXHR[] };
}

async function selectFile(input: HTMLInputElement | null, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  input?.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  document.body.innerHTML = `
    <div
      class="storinary-widget"
      data-upload-preset="site_unsigned"
      data-folder="/site"
      data-retry-delay="0"
    ></div>
  `;
});

describe('public Storinary widget bundle', () => {
  it('injects a picker and uploads selected files without clearing earlier results', async () => {
    const source = await createWidgetSource();
    const MockXHR = createMockXHR([
      { payload: { success: true, images: [{ id: 'one', publicUrl: 'https://cdn.example/one.png', originalName: 'one.png' }], errors: [] } },
      { payload: { success: true, images: [{ id: 'two', publicUrl: 'https://cdn.example/two.png', originalName: 'two.png' }], errors: [] } },
    ]);
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    new Function(source)();
    const input = document.querySelector<HTMLInputElement>('input[type=file]');
    const output = document.querySelector('.storinary-widget-status');

    expect(input).not.toBeNull();
    expect(input?.multiple).toBe(true);
    expect(input?.getAttribute('aria-label')).toBe('Upload files to Storinary');

    Object.defineProperty(input, 'files', {
      value: [
        new File(['one'], 'one.png', { type: 'image/png' }),
        new File(['two'], 'two.png', { type: 'image/png' }),
      ],
      configurable: true,
    });
    input?.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(output?.querySelectorAll('.storinary-widget-result')).toHaveLength(2));

    expect(MockXHR.instances[0].open).toHaveBeenCalledWith(
      'POST',
      'http://localhost:3000/api/upload'
    );
    const links = [...output!.querySelectorAll('a')];
    expect(links.map((link) => link.href)).toEqual([
      'https://cdn.example/one.png',
      'https://cdn.example/two.png',
    ]);
  });

  it('reports byte progress, retries three times, and supports manual recovery', async () => {
    const source = await createWidgetSource();
    const failure = {
      success: true,
      images: [],
      errors: [{ filename: 'one.png', error: 'Too large' }],
    };
    const success = {
      success: true,
      images: [{ id: 'one', publicUrl: 'https://cdn.example/one.png', originalName: 'one.png' }],
      errors: [],
    };
    const MockXHR = createMockXHR([
      { payload: failure },
      { payload: failure },
      { payload: failure },
      { payload: success },
    ]);
    vi.stubGlobal('XMLHttpRequest', MockXHR);
    new Function(source)();
    const input = document.querySelector<HTMLInputElement>('input[type=file]');
    const status = document.querySelector('.storinary-widget-status');
    await selectFile(input, new File(['one'], 'one.png', { type: 'image/png' }));
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(3));
    await vi.waitFor(() => expect(status?.querySelector('.storinary-widget-retry')).not.toBeNull());

    expect(status?.textContent).toContain('Too large');
    expect(MockXHR.instances).toHaveLength(3);
    expect(status?.querySelector('.storinary-widget-retry')).not.toBeNull();

    const retry = status!.querySelector<HTMLButtonElement>('.storinary-widget-retry')!;
    retry.click();
    await vi.waitFor(() => expect(MockXHR.instances).toHaveLength(4));
    await vi.waitFor(() => expect(status?.querySelector('.storinary-widget-result')).not.toBeNull());

    expect(status?.textContent).toContain('Uploaded one.png');
    expect(status?.querySelector('.storinary-widget-retry')).toBeNull();
  });
});
