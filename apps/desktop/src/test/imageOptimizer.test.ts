import { describe, it, expect } from "vitest";
import { optimizeImageForUpload } from "@/lib/media/imageOptimizer";

describe("imageOptimizer", () => {
  it("retorna o arquivo original para tipos que não são imagens", async () => {
    const textFile = new File(["olá mundo"], "teste.txt", { type: "text/plain" });
    const result = await optimizeImageForUpload(textFile);
    expect(result).toBe(textFile);
  });

  it("retorna o arquivo original para gifs animados", async () => {
    const gifFile = new File(["fake-gif"], "animacao.gif", { type: "image/gif" });
    const result = await optimizeImageForUpload(gifFile);
    expect(result).toBe(gifFile);
  });

  it("retorna o arquivo original se a imagem já for leve", async () => {
    const smallWebp = new File(["small"], "avatar.webp", { type: "image/webp" });
    const result = await optimizeImageForUpload(smallWebp);
    expect(result).toBe(smallWebp);
  });
});
