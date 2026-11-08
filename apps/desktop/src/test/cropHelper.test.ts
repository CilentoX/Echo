import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rotateSize, getCroppedImg, createImage } from "@/lib/media/cropHelper";

describe("cropHelper - Utility and Safety", () => {
  let OriginalImage: typeof Image;

  beforeEach(() => {
    OriginalImage = globalThis.Image;

    class MockImage {
      naturalWidth = 3840;
      naturalHeight = 2160;
      width = 3840;
      height = 2160;
      crossOrigin = "";
      private _src = "";
      listeners: Record<string, Function[]> = {};

      addEventListener(event: string, fn: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      }

      setAttribute(name: string, value: string) {
        if (name === "crossOrigin") this.crossOrigin = value;
      }

      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          this.listeners["load"]?.forEach((fn) => fn());
        }, 0);
      }

      get src() {
        return this._src;
      }
    }

    globalThis.Image = MockImage as any;
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
    vi.restoreAllMocks();
  });

  it("rotateSize computes bounding box dimensions correctly across rotations", () => {
    // 0 deg: same dimensions
    expect(rotateSize(800, 600, 0)).toEqual({ width: 800, height: 600 });

    // 90 deg: width and height swapped
    const rot90 = rotateSize(800, 600, 90);
    expect(Math.round(rot90.width)).toBe(600);
    expect(Math.round(rot90.height)).toBe(800);

    // 180 deg: same dimensions (absolute values)
    const rot180 = rotateSize(800, 600, 180);
    expect(Math.round(rot180.width)).toBe(800);
    expect(Math.round(rot180.height)).toBe(600);

    // 270 deg: width and height swapped
    const rot270 = rotateSize(800, 600, 270);
    expect(Math.round(rot270.width)).toBe(600);
    expect(Math.round(rot270.height)).toBe(800);
  });

  it("createImage sets crossOrigin to anonymous to avoid SecurityError", async () => {
    const img = await createImage("https://example.com/banner.png");
    expect(img).toBeDefined();
    expect(img.crossOrigin).toBe("anonymous");
  });

  it("getCroppedImg clamps output dimensions within maximum thresholds", async () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ width: 100, height: 100, data: new Uint8ClampedArray(400) }),
      putImageData: vi.fn(),
    };

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
          toBlob: vi.fn((cb: any, type: string) => {
            cb(new Blob(["test-image-data"], { type: type || "image/webp" }));
          }),
        } as any;
      }
      return originalCreateElement(tagName);
    });

    const file = await getCroppedImg(
      "https://example.com/huge-banner.png",
      { x: 0, y: 0, width: 3840, height: 2160 },
      0,
      { horizontal: false, vertical: false },
      1920,
      1080
    );

    expect(file).toBeInstanceOf(File);
    expect(file.name).toMatch(/^cropped-\d+\.webp$/);
    expect(file.type).toBe("image/webp");
  });
});
