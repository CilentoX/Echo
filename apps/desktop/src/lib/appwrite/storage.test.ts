import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { APPWRITE_CONFIG } from "./config";
import { uploadImage, deleteImage } from "./storage";

const base = APPWRITE_CONFIG.endpoint;
const bucket = APPWRITE_CONFIG.bucketId;
const project = APPWRITE_CONFIG.projectId;

type MockFetch = ReturnType<typeof vi.fn> & typeof fetch;
const mockFetch = vi.fn() as unknown as MockFetch;
const origFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockClear();
});

afterEach(() => {
  globalThis.fetch = origFetch;
  mockFetch.mockReset();
});

describe("uploadImage", () => {
  it("envia file como FormData com cabeçalhos do Appwrite e devolve URL de visualização", async () => {
    const file = new File(["a"], "img.png", { type: "image/png" });
    const fileId = "file_123";
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ $id: fileId }), { status: 200 })
    );

    const url = await uploadImage(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [input, init] = mockFetch.mock.calls[0];
    expect(input).toBe(
      `${base}/storage/buckets/${bucket}/files`
    );
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "X-Appwrite-Project": project,
      "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
    });
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBe(file);
    expect(url).toBe(
      `${base}/storage/buckets/${bucket}/files/${fileId}/view?project=${project}`
    );
  });

  it("lança erro quando a resposta não é ok", async () => {
    const file = new File(["a"], "img.png", { type: "image/png" });
    mockFetch.mockResolvedValueOnce(
      new Response("bucket não encontrado", { status: 404 })
    );

    await expect(uploadImage(file)).rejects.toThrow(
      "Appwrite upload failed: bucket não encontrado"
    );
  });
});

describe("deleteImage", () => {
  it("envia DELETE para o arquivo extraído da URL de visualização", async () => {
    const imageUrl = `${base}/storage/buckets/${bucket}/files/file_abc/view?project=${project}`;
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteImage(imageUrl);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [input, init] = mockFetch.mock.calls[0];
    expect(input).toBe(
      `${base}/storage/buckets/${bucket}/files/file_abc`
    );
    expect(init?.method).toBe("DELETE");
    expect(init?.headers).toMatchObject({
      "X-Appwrite-Project": project,
      "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
    });
  });

  it("não faz requisição quando não consegue extrair o fileId", async () => {
    await deleteImage("https://example.com/not-an-appwrite-url");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
