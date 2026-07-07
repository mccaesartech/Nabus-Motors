import { Container } from "@/components/shared/container";
import { CustomVehicleRequestForm } from "@/components/vehicle/custom-vehicle-request-form";

export const metadata = {
  title: "Request a Vehicle",
  description:
    "Can't find your car in our inventory? Tell us what you want and our team will follow up.",
};

export default function CustomVehicleRequestPage() {
  return (
    <div className="py-10 sm:py-14">
      <Container className="max-w-2xl">
        <CustomVehicleRequestForm />
      </Container>
    </div>
  );
}
