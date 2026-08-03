// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSafeSvg, svgSafeResponseHeaders } from './svg-security';

const svg = (inner: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`);

describe('isSafeSvg', () => {
  it('accepts a plain static SVG', () => {
    expect(isSafeSvg(svg('<rect width="10" height="10" fill="red"/>'))).toBe(true);
  });

  it('accepts benign attributes and styles', () => {
    expect(
      isSafeSvg(svg('<circle cx="5" cy="5" r="4" fill="blue"/>'))
    ).toBe(true);
  });

  it('rejects <script>', () => {
    expect(isSafeSvg(svg('<script>alert(1)</script>'))).toBe(false);
  });

  it('rejects entity-encoded script tags (XML entity bypass)', () => {
    expect(
      isSafeSvg(
        Buffer.from(
          '<svg>&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;</svg>'
        )
      )
    ).toBe(false);
    expect(
      isSafeSvg(Buffer.from('<svg>&#60;script&#62;alert(1)</svg>'))
    ).toBe(false);
    expect(
      isSafeSvg(Buffer.from('<svg>&lt;script&gt;alert(1)&lt;/script&gt;</svg>'))
    ).toBe(false);
  });

  it('accepts harmless numeric/named entities', () => {
    expect(
      isSafeSvg(Buffer.from('<svg><text>&#169; &amp; more</text></svg>'))
    ).toBe(true);
  });

  it('rejects event handlers', () => {
    expect(isSafeSvg(svg('<rect onload="alert(1)"/>'))).toBe(false);
    expect(isSafeSvg(svg('<rect onclick="alert(1)"/>'))).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeSvg(svg('<a href="javascript:alert(1)">x</a>'))).toBe(false);
  });

  it('rejects foreignObject, iframes, and data:text/html', () => {
    expect(isSafeSvg(svg('<foreignObject><iframe/></foreignObject>'))).toBe(false);
    expect(isSafeSvg(svg('<image href="data:text/html,<script>"/>'))).toBe(false);
  });

  it('rejects CSS @import', () => {
    expect(isSafeSvg(svg('<style>@import url("http://evil");</style>'))).toBe(false);
  });

  it('rejects event handlers encoded as entities', () => {
    expect(isSafeSvg(Buffer.from('<svg><rect on&#x6C;oad="x"/></svg>'))).toBe(
      false
    );
  });
});

describe('svgSafeResponseHeaders', () => {
  it('forces attachment download and sandboxes the content', () => {
    const headers = svgSafeResponseHeaders();
    expect(headers['Content-Disposition']).toContain('attachment');
    expect(headers['Content-Security-Policy']).toContain('sandbox');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
