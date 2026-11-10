export interface IImageOptimizer {
  /** Reduce, orienta y convierte a WebP, quitando metadatos (pueden llevar la ubicación del móvil). */
  toWebp(bytes: Uint8Array): Promise<Uint8Array>;
}

export interface IImageStorage {
  /** Guarda el WebP y devuelve la URL pública con la que mostrarlo. */
  save(name: string, webp: Uint8Array): Promise<string>;
  /** Borra una foto guardada antes por este almacenamiento; lo demás lo ignora. */
  remove(url: string): Promise<void>;
}
