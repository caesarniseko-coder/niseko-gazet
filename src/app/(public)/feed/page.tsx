import { VO3Feed } from "@/components/feed/vo3-feed";

export const metadata = {
  title: "Feed | Niseko Gazet",
  description: "Latest news from Niseko, Japan",
};

export default function FeedPage() {
  return <VO3Feed />;
}
