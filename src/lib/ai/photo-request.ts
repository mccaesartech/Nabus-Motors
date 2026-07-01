/** Detect when the user wants stock/placeholder photos (Pexels), not text edits. */
export function isPhotoRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  const patterns = [
    /\bstock\s*(photo|photos|image|images|picture|pictures)\b/i,
    /\bsuggest\s*(\d+\s*)?(stock\s*)?(photo|photos|image|images|picture|pictures)\b/i,
    /\bfind\s*(stock\s*)?(photo|photos|image|images|picture|pictures)\b/i,
    /\badd\s*(\d+\s*)?(stock\s*)?(photo|photos|image|images|picture|pictures)\b/i,
    /\bgenerate\s*(photo|photos|image|images|picture|pictures)\b/i,
    /\b(create|get|need|want)\s*(some\s*)?(photo|photos|image|images|picture|pictures)\b/i,
    /\bplaceholder\s*(photo|photos|image|images|picture|pictures)\b/i,
    /\bpexels\b/i,
    /\bgallery\s*(photo|photos|image|images|picture|pictures)\b/i,
    /\b(car|vehicle)\s*(photo|photos|image|images|picture|pictures)\b/i,
  ];

  return patterns.some((p) => p.test(text));
}

export function stockPhotoReply(vehicle: {
  year?: number;
  make?: string;
  model?: string;
}): string {
  const label = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return label
    ? `Here are royalty-free stock photo placeholders from Pexels for your ${label}. These are generic car images — upload your own photos for an accurate listing.`
    : "Here are royalty-free stock photo placeholders from Pexels. These are generic car images — upload your own photos for an accurate listing.";
}
