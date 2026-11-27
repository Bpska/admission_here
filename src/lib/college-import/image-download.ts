import { lookup } from "node:dns/promises";
import { get } from "node:https";
import type { IncomingMessage } from "node:http";
import { BlockList, isIP } from "node:net";
import sharp from "sharp";
import { imageMimeType, MAX_IMAGE_BYTES } from "../image-format";
import { remoteImageUrl } from "./image-plan";

const nonPublic = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) nonPublic.addSubnet(address, prefix);

export function checkImageAddress(address: string) {
  if (isIP(address) !== 4 || nonPublic.check(address))
    throw new Error("Image host must resolve to a public IPv4 address.");
}

type ImageTransport = {
  resolve(host: string): Promise<string[]>;
  response(url: URL, address: string, signal: AbortSignal): Promise<IncomingMessage>;
};

const transport: ImageTransport = {
  async resolve(host) {
    return (await lookup(host, { family: 4, all: true })).map(({ address }) => address);
  },
  response(url, address, signal) {
    return new Promise((resolve, reject) => {
      // Keep TLS verification and Host tied to the original URL, but use only
      // the inspected address for the socket. No second DNS lookup or proxy.
      const request = get(url, {
        agent: false, family: 4, rejectUnauthorized: true, signal,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: { Accept: "image/jpeg,image/png,image/gif,image/webp", "Accept-Encoding": "identity" },
      }, resolve);
      request.on("error", reject);
    });
  },
};

function withinDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("Image download timed out."));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Image download timed out."));
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function downloadImage(source: string, rowSignal: AbortSignal, network = transport) {
  const signal = AbortSignal.any([rowSignal, AbortSignal.timeout(5500)]);
  let url = remoteImageUrl(source);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    const addresses = await withinDeadline(network.resolve(url.hostname), signal);
    if (!addresses.length) throw new Error("Image host could not be resolved.");
    addresses.forEach(checkImageAddress);
    const response = await network.response(url, addresses[0], signal);
    if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
      response.destroy();
      if (!response.headers.location || redirects === 3) throw new Error("Image redirect limit reached or target missing.");
      url = remoteImageUrl(new URL(response.headers.location, url).href);
      continue;
    }
    if (response.statusCode !== 200) {
      response.destroy();
      throw new Error(`Image server returned HTTP ${response.statusCode}.`);
    }
    if (Number(response.headers["content-length"]) > MAX_IMAGE_BYTES ||
        (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) {
      response.destroy();
      throw new Error("Image exceeds 3 MB or uses unsupported HTTP compression.");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        response.destroy();
        throw new Error("Image exceeds 3 MB.");
      }
      chunks.push(chunk);
    }
    signal.throwIfAborted();
    return verifyImage(Buffer.concat(chunks));
  }
  throw new Error("Image redirect limit reached.");
}

export async function verifyImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Image must be between 1 byte and 3 MB.");
  const mimeType = imageMimeType(bytes);
  if (!mimeType) throw new Error("Image content must be JPEG, PNG, GIF or WebP.");
  const image = sharp(bytes, { limitInputPixels: 12_000_000, failOn: "warning" }).timeout({ seconds: 3 });
  const { format } = await image.metadata().catch(() => ({ format: undefined }));
  if (`image/${format}` !== mimeType) throw new Error("Image content is corrupt or does not match its format.");
  const data = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 }).toBuffer().catch(() => { throw new Error("Image is corrupt, too large to decode, or timed out."); });
  if (data.length > MAX_IMAGE_BYTES) throw new Error("Processed image exceeds 3 MB.");
  return data;
}
