export async function toUint8(source: Blob): Promise<Uint8Array> {
  const buffer = await source.arrayBuffer()
  return new Uint8Array(buffer)
}
