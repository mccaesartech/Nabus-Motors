import { getSiteContent } from "@/lib/site-content";
import { ContactPageClient } from "./contact-client";

export const metadata = {
  title: "Contact",
  description: "Get in touch with Nabus Motors for vehicle inquiries and support.",
};

export default async function ContactPage() {
  const content = await getSiteContent();
  return <ContactPageClient contact={content.contact} footer={content.footer} />;
}
