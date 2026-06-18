export function getCloudinaryUrl(
  publicId: string,
  options: { width?: number; height?: number; quality?: string } = {}
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return publicId;

  const transforms = [
    "f_auto",
    "q_auto",
    options.width ? `w_${options.width}` : null,
    options.height ? `h_${options.height}` : null,
    "c_fill",
  ]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}
