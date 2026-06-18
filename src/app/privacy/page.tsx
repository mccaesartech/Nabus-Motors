import { Container } from "@/components/shared/container";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <Container className="py-14 sm:py-16">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <div className="prose prose-sm mt-8 max-w-3xl text-muted-foreground">
        <p>
          True Goshen Auto (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting
          your privacy. This policy describes how we collect, use, and safeguard
          your personal information when you use our website and services.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">
          Information We Collect
        </h2>
        <p>
          We collect information you provide directly, including name, email,
          phone number, and vehicle preferences when you inquire about inventory,
          request financing, or create an account.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">
          How We Use Your Information
        </h2>
        <p>
          Your information is used to process inquiries, provide customer support,
          send inventory updates (with your consent), and improve our services.
          We do not sell your personal information to third parties.
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">Contact</h2>
        <p>
          For privacy-related questions, contact us at info@truegoshenauto.com or
          +233 24 487 6784.
        </p>
      </div>
    </Container>
  );
}
