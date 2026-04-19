import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Message } from "./useConvexData";

// Hook to load messages for a specific chat room
export function useChatMessages(chatRoomId: string | null) {
  const convexMessages = useQuery(
    api.chat.getMessages,
    chatRoomId ? { chatRoomId: chatRoomId as Id<"chatRooms"> } : "skip",
  );

  // Convert Convex messages to app format
  const messages: Message[] = (convexMessages || []).map((m) => ({
    id: m._id,
    authorId: m.authorId,
    text: m.text,
    timestamp: m.timestamp,
    sources: m.sources,
  }));

  return messages;
}
