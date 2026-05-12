/**
 * Comprime uma imagem no browser antes de fazer upload.
 * Reduz tamanho preservando qualidade visual aceitavel pra chat.
 *
 * - Imagens > 1920px de largura sao redimensionadas
 * - JPEG com quality 0.85 (visualmente quase identico)
 * - Mantem formato original se nao for imagem
 *
 * Retorna File novo (ou o mesmo se nao precisar comprimir).
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file; // gif animado nao perde quadros

  const maxWidth = options.maxWidth ?? 1920;
  const quality = options.quality ?? 0.85;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width <= maxWidth) {
          // Nao precisa redimensionar; mas ainda recomprime pra reduzir
        } else {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG eh o formato mais eficiente para fotos
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            // Se a compressao deixou maior, devolve original
            if (blob.size >= file.size) return resolve(file);
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" }
            );
            resolve(compressed);
          },
          "image/jpeg",
          quality
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar imagem"));
    };
    img.src = url;
  });
}
