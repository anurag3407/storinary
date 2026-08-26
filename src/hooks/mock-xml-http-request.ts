import { vi } from 'vitest';

export class MockXmlHttpRequest {
  static behavior = vi.fn();

  static instances = 0;

  static resetBehavior() {
    MockXmlHttpRequest.behavior.mockReset();
  }

  private progressListeners: Array<(event: ProgressEvent<EventTarget>) => void> = [];
  private loadListeners: Array<(event: ProgressEvent<EventTarget>) => void> = [];
  private errorListeners: Array<(event: ProgressEvent<EventTarget>) => void> = [];
  private abortListeners: Array<(event: ProgressEvent<EventTarget>) => void> = [];

  upload = {
    addEventListener: (name: string, listener: (event: ProgressEvent<EventTarget>) => void) => {
      if (name === 'progress') this.progressListeners.push(listener);
    },
  };
  open = vi.fn();
  status = 200;
  responseText = '';
  loadHandler?: (event: ProgressEvent<EventTarget>) => void;

  constructor() {
    MockXmlHttpRequest.instances += 1;
  }

  triggerUploadProgress(event: ProgressEvent<EventTarget>) {
    this.progressListeners.forEach((listener) => listener(event));
  }

  addEventListener(name: string, listener: (event: ProgressEvent<EventTarget>) => void) {
    if (name === 'load') this.loadListeners.push(listener);
    if (name === 'error') this.errorListeners.push(listener);
    if (name === 'abort') this.abortListeners.push(listener);
  }

  send() {
    MockXmlHttpRequest.behavior(this);
    this.loadHandler = (event) => {
      this.loadListeners.forEach((listener) => listener(event));
    };
    this.loadListeners.forEach((listener) => listener(new ProgressEvent('load')));
  }
}
