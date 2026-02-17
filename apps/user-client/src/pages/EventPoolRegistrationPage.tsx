import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * EventPoolRegistrationPage
 * 
 * This page redirects to the Discover page.
 * Event pool registration is now handled through a sheet/drawer component
 * opened from the Discover page, not as a separate route.
 */
export default function EventPoolRegistrationPage() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Redirect to discover page
    setLocation("/discover");
  }, [setLocation]);

  return null;
}
