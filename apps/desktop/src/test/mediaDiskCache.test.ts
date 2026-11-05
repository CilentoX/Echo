import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCachedMediaUrl,
  resolveCanonicalMediaUrl,
  clearMediaDiskCache,
  prefetchMedia,
} from "@/lib/media/mediaDiskCache";

describe("Media Disk Cache System (Armazenamento Local de Imagens)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearMediaDiskCache();
  });

  it("resolve URLs canônicas corretamente para data, blob, http e mxc", () => {
    expect(resolveCanonicalMediaUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(resolveCanonicalMediaUrl("blob:http://localhost/123")).toBe("blob:http://localhost/123");
    expect(resolveCanonicalMediaUrl("https://example.com/avatar.png")).toBe("https://example.com/avatar.png");

    const mxcResolved = resolveCanonicalMediaUrl("mxc://matrix.org/media123");
    expect(mxcResolved).toContain("https://echo.litteris.online/_matrix/media/v3/download/matrix.org/media123");
  });

  it("baixa a imagem uma única vez e serve do cache local sem novas requisições de rede", async () => {
    const mockBlob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const testUrl = "https://example.com/foto_membro.png";

    // 1ª Chamada: busca da rede e armazena em disco local
    const firstBlobUrl = await getCachedMediaUrl(testUrl);
    expect(firstBlobUrl).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 2ª Chamada: deve vir instantaneamente do cache local em memória/disco sem chamar a API de novo
    const secondBlobUrl = await getCachedMediaUrl(testUrl);
    expect(secondBlobUrl).toBe(firstBlobUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Não chamou a API novamente!
  });

  it("deduplica requisições concorrentes em voo (apenas 1 fetch para múltiplas mensagens simultâneas)", async () => {
    const mockBlob = new Blob(["avatar-bytes"], { type: "image/png" });
    let resolveNetwork!: (res: Response) => void;
    const fetchPromise = new Promise<Response>((res) => {
      resolveNetwork = res;
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => fetchPromise);

    const testUrl = "https://example.com/avatar_popular.png";

    // 10 componentes solicitando a mesma foto ao mesmo tempo (ex: 10 mensagens na timeline)
    const promises = Array.from({ length: 10 }, () => getCachedMediaUrl(testUrl));

    // Resolve a requisição da rede
    resolveNetwork({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const results = await Promise.all(promises);

    // Todas as 10 chamadas receberam a mesma URL em cache
    expect(results).toHaveLength(10);
    const first = results[0];
    results.forEach((url) => expect(url).toBe(first));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("resiliência offline: devolve a URL original como fallback se a rede falhar", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network offline"));

    const testUrl = "https://example.com/foto_offline.png";
    const result = await getCachedMediaUrl(testUrl);

    // Não explode erro na aplicação, devolve fallback
    expect(result).toBe(testUrl);
  });

  it("clearMediaDiskCache limpa o pool de memória e o armazenamento", async () => {
    const mockBlob = new Blob(["bytes"], { type: "image/png" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const testUrl = "https://example.com/limpar.png";
    await getCachedMediaUrl(testUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await clearMediaDiskCache();

    // Nova chamada após clear refaz a busca
    await getCachedMediaUrl(testUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("prefetchMedia pré-carrega múltiplos itens em lote sem lançar erros", async () => {
    const mockBlob = new Blob(["bytes"], { type: "image/png" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    await prefetchMedia([
      "https://example.com/img1.png",
      "https://example.com/img2.png",
      null,
      undefined,
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
