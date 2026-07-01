"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartQuantityStepper } from "@/components/parts/cart-quantity-stepper";
import { usePartsCart } from "@/context/parts-cart-context";
import { isPreOrderStatus } from "@/lib/vehicles/availability";
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
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 1500);
  }

  if (inCart) {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <CartQuantityStepper
          quantity={quantity}
          onDecrease={() => setVehicleQuantity(vehicle.id, quantity - 1)}
          onIncrease={() =>
            addVehicle(vehicle.id, intent, snapshot, 1)
          }
          size={size === "default" ? "default" : "sm"}
        />
        {feedback && (
          <span className="text-xs font-medium text-emerald-700">Added!</span>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5", className)}
      onClick={handleAdd}
    >
      {showIcon && <ShoppingCart className="size-3.5" />}
      {feedback ? "Added!" : "Add to cart"}
    </Button>
  );
}
