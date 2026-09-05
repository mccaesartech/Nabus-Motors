"use client";

import { useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { CartQuantityStepper } from "@/components/parts/cart-quantity-stepper";
import { usePartsCart } from "@/context/parts-cart-context";
import { isPreOrderStatus } from "@/lib/vehicles/availability";
import { recordVehicleEngagement } from "@/lib/vehicle-preferences";
import { formatVehicleName } from "@/lib/format";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import type { Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";

type AddVehicleToCartButtonProps = {
  vehicle: Vehicle;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  showIcon?: boolean;
};

export function AddVehicleToCartButton({
  vehicle,
  className,
  size = "sm",
  variant = "outline",
  showIcon = true,
}: AddVehicleToCartButtonProps) {
  const {
    addVehicle,
    isVehicleInCart,
    getVehicleQuantity,
    setVehicleQuantity,
    removeVehicle,
  } = usePartsCart();
  const [feedback, setFeedback] = useState(false);

  if (vehicle.status === "sold" || vehicle.price <= 0) return null;

  const inCart = isVehicleInCart(vehicle.id);
  const quantity = getVehicleQuantity(vehicle.id);
  const intent = isPreOrderStatus(vehicle.status) ? "pre_order" : "buy";

  const snapshot = {
    slug: vehicle.slug,
    name: formatVehicleName(vehicle),
    priceUsd: vehicle.price,
    image: primaryPhotoFor(vehicle),
    status: vehicle.status ?? "available",
  };

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addVehicle(vehicle.id, intent, snapshot, 1);
    recordVehicleEngagement(intent === "pre_order" ? "preorder" : "cart_add", vehicle);
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 1500);
  }

  const variantClasses =
    variant === "default"
      ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "secondary"
        ? "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
        : "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-muted";

  if (inCart) {
    return (
      <div
        className={cn(
          "flex h-10 w-full items-center justify-center gap-2",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CartQuantityStepper
          quantity={quantity}
          min={0}
          onDecrease={() => setVehicleQuantity(vehicle.id, quantity - 1)}
          onIncrease={() =>
            addVehicle(vehicle.id, intent, snapshot, 1)
          }
          size={size === "default" ? "default" : "sm"}
        />
        <button
          type="button"
          aria-label="Remove from cart"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
          onClick={() => removeVehicle(vehicle.id)}
        >
          <Trash2 className="size-3.5" />
        </button>
        {feedback && (
          <span className="text-xs font-medium text-emerald-700">Added!</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
        size === "default" ? "h-9" : "h-10",
        variantClasses,
        className
      )}
      onClick={handleAdd}
    >
      {showIcon && <ShoppingCart className="size-3.5 shrink-0" />}
      {feedback ? "Reserved!" : "Reserve"}
    </button>
  );
}
