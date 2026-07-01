"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { normalizeMediaUrl } from "@/lib/site-content/media-url";
import { scrollToElement } from "@/lib/scroll-to-element";
import { cn } from "@/lib/utils";

export type ServiceImageCardData = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  href?: string;
};

type ServiceImageCardProps = ServiceImageCardData & {
  className?: string;
  priority?: boolean;
};

function handleHashNavigation(
  e: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  pathname: string,
  router: ReturnType<typeof useRouter>
) {
  const target = new URL(href, window.location.href);
  if (!target.hash) return;

  const isSamePage =
    target.pathname === pathname ||
    (target.pathname === "" && href.startsWith("#")) ||
    (target.pathname === "" && href.startsWith("?"));

  if (!isSamePage) return;

  e.preventDefault();

  const hash = target.hash;
  const nextUrl = `${target.pathname || pathname}${target.search}${hash}`;

  if (target.search) {
    router.push(nextUrl, { scroll: false });
  } else {
    window.history.pushState(null, "", nextUrl);
  }

  const id = decodeURIComponent(hash.slice(1));
  requestAnimationFrame(() => scrollToElement(id));
}

export function ServiceImageCard({
  title,
  subtitle,
  image,
  imageAlt,
  href,
  className,
  priority = false,
}: ServiceImageCardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const imageSrc = normalizeMediaUrl(image) || image;
  const cardClass = cn(
    "group relative aspect-[2/1] w-[min(100%,12cm)] overflow-hidden rounded-lg border border-border/40 shadow-sm transition-shadow duration-200 hover:shadow-md sm:h-[6cm] sm:w-[12cm] sm:aspect-auto",
    href && "block",
    className
  );

  const content = (
    <>
      <Image
        src={imageSrc}
        alt={imageAlt}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        sizes="(max-width: 640px) 100vw, 454px"
        quality={75}
        loading={priority ? undefined : "lazy"}
        priority={priority}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/85 via-brand-black/35 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 px-4 py-3 sm:px-5 sm:py-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-white sm:text-lg">
          {title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/75 sm:text-sm">
          {subtitle}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cardClass}
        onClick={(e) => handleHashNavigation(e, href, pathname, router)}
      >
        {content}
      </Link>
    );
  }

  return <article className={cardClass}>{content}</article>;
}

type ServiceImageCardGridProps = {
  cards: ServiceImageCardData[];
  className?: string;
};

export function ServiceImageCardGrid({ cards, className }: ServiceImageCardGridProps) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-[26cm] grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 sm:gap-5",
        className
      )}
    >
      {cards.map((card) => (
        <ServiceImageCard key={card.id} {...card} />
      ))}
    </div>
  );
}
