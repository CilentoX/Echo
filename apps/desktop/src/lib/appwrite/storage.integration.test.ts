import { describe, expect, it } from "vitest";
import { uploadImage, deleteImage } from "./storage";
import { APPWRITE_CONFIG } from "./config";

const project = APPWRITE_CONFIG.projectId;
const bucket = APPWRITE_CONFIG.bucketId;
const endpoint = APPWRITE_CONFIG.endpoint;

describe("Appwrite upload (integração real)", () => {
  it("faz upload de uma imagem e devolve URL pública", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]); // cabeçalho PNG
    const file = new File([bytes], "echo-integ.png", { type: "image/png" });

    const url = await uploadImage(file);

    expect(typeof url).toBe("string");
    expect(url).toContain(endpoint);
    expect(url).toContain(bucket);
    expect(url).toContain(`/view?project=${project}`);

    // limpa o arquivo enviado
    await deleteImage(url).catch(() => {});
  });

  it("remove a imagem pela URL de visualização", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const file = new File([bytes], "echo-delete.png", { type: "image/png" });

    const url = await uploadImage(file);
    await expect(deleteImage(url)).resolves.toBeUndefined();
  });
});
