import { Dashboard } from "@/components/dashboard";

export default function MarketPage() {
  return <Dashboard deskSecret={process.env.DESK_ADMIN_SECRET ?? ""} />;
}
