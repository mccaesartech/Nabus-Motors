export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatMileage(mileage: number): string {
  return new Intl.NumberFormat("en-US").format(mileage) + " mi";
}

export function formatVehicleName(vehicle: {
  year: number;
  make: string;
  model: string;
  trim?: string;
}): string {
  const base = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return vehicle.trim ? `${base} ${vehicle.trim}` : base;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function calculateMonthlyPayment(
  price: number,
  downPayment: number,
  annualRate: number,
  termMonths: number
): number {
  const principal = price - downPayment;
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1)
  );
}
