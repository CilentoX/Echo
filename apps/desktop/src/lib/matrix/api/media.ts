import type { MatrixClientLike } from "../types";

export type ClientFactory = (opts: Record<string, unknown>) => MatrixClientLike;

export class MediaApi {
  private client: MatrixClientLike | null;
  private readonly clientFactory: ClientFactory;

  constructor(client: MatrixClientLike | null, clientFactory: ClientFactory) {
    this.client = client;
    this.clientFactory = clientFactory;
  }

  /** Update the internal client reference (used after login/restoreSession). */
  setClient(client: MatrixClientLike | null): void {
    this.client = client;
  }

  private requireClient(): MatrixClientLike {
    if (!this.client) {
      throw new Error("MediaApi: no active session — call loginWithSsoToken or restoreSession first");
    }
    return this.client;
  }

  /** Upload a media file (avatar, banner, attachment) and return mxc:// URI. */
  async uploadMedia(file: File): Promise<string> {
    const client = this.requireClient();
    const res = await client.uploadContent(file, {
      name: file.name,
      type: file.type,
    });
    return res.content_uri;
  }

  /** Convert mxc:// URL to HTTP (supports authenticated access to avoid M_FORBIDDEN). */
  mxcUrlToHttp(
    mxcUrl: string,
    width?: number,
    height?: number,
    resizeMethod?: string,
    _allowDirectLinks?: boolean,
    _allowRedirects?: boolean,
    useAuthentication?: boolean
  ): string | null {
    const client = this.requireClient();
    return client.mxcUrlToHttp(
      mxcUrl,
      width,
      height,
      resizeMethod,
      true,
      true,
      useAuthentication ?? true
    );
  }
}