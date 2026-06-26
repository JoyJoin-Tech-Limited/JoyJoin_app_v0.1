import { Star } from "lucide-react";

interface AdminUserStarRatingProps {
  rating: number;
}

export function AdminUserStarRating({ rating }: AdminUserStarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted"}`}
        />
      ))}
    </div>
  );
}

export default AdminUserStarRating;
