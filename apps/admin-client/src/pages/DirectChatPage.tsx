// Direct private chat has been removed from JoyJoin.
// The structured connection model (connections table) replaces direct messaging.
// Users connect through events → mutual selection → WeChat/contact reveal.
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function DirectChatPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/chats");
  }, [setLocation]);
  return null;
}
