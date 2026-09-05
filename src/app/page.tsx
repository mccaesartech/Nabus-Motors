import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Nabus Motors public entry — editorial showroom lives at /auto */
export default function RootPage() {
  redirect(ROUTES.auto.home);
}
