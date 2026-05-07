import { useEffect } from "react";
import { useParams } from "wouter";
import { useLocation } from "wouter";
import { getDiscoverJoinRoute } from "@/lib/poolRegistrationRouting";

/**
 * EventPoolRegistrationPage
 * 
 * This page redirects to the Discover page.
 * Event pool registration is now handled through a sheet/drawer component
 * opened from the Discover page, not as a separate route.
 */
export default function EventPoolRegistrationPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation(id ? getDiscoverJoinRoute(id) : "/discover");
  }, [id, setLocation]);

  return null;
}
