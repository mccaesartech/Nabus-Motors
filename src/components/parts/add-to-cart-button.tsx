"use client";

import { useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartQuantityStepper } from "@/components/parts/cart-quantity-stepper";
import { usePartsCart } from "@/context/parts-cart-context";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  partId: string;
  priceUsd: number | null;
  slug?: string;
  name?: string;
  sku?: string | null;
  image?: string | null;
  stockQuantity?: number;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  showIcon?: boolean;
};

export function AddToCartButton({
  partId,
  priceUsd,
  slug,
  name,
  sku,
  image,
  stockQuantity,
  className,
  size = "sm",
  variant = "outline",
  showIcon = true,
}: AddToCartButtonProps) {
  const {
    addPart,
    isPartInCart,
    getPartQuantity,
    setPartQuantity,
    removePart,
  } = usePartsCart();
  const [feedback, setFeedback] = useState(false);

  if (priceUsd == null) return null;

  const inCart = isPartInCart(partId);
  const quantity = getPartQuantity(partId);

  const snapshot =
    slug && name
      ? {
          slug,
          name,
          sku: sku ?? null,
          priceUsd: priceUsd as number,
          image: image ?? null,
          stockQuantity,
        }
      : undefined;

  function handleAdd() {
    addPart(partId, 1, snapshot);
    setFeedback(true);
    window.setTimeout(() => setFeedback(false), 1500);
  }

  if (inCart) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <CartQuantityStepper
          quantity={quantity}
          min={0}
          onDecrease={() => setPartQuantity(partId, quantity - 1)}
          onIncrease={() => addPart(partId, 1, snapshot)}
          max={stockQuantity && stockQuantity > 0 ? stockQuantity : undefined}
          size={size === "default" ? "default" : "sm"}
        />
        <button
          type="button"
          aria-label="Remove from cart"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
          onClick={() => removePart(partId)}
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
