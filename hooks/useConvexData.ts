import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useState, useMemo } from "react";

// Types matching the existing app types
export interface Persona {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  canSearch?: boolean;
}

export interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
}

export interface ChatRoom {
  id: string;
  topic: string;
  avatar?: string;
  personaIds: string[];
  messages: Message[];
}

// Hook to manage all data with Convex
export function useConvexData() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Convex queries
  const convexPersonas = useQuery(api.chat.getAllPersonas) || [];
  const convexChatRooms = useQuery(api.chat.getAllChatRooms) || [];

  // Convex mutations
  const createPersonaMutation = useMutation(api.chat.createPersona);
  const updatePersonaMutation = useMutation(api.chat.updatePersona);
  const deletePersonaMutation = useMutation(api.chat.deletePersona);

  const createChatRoomMutation = useMutation(api.chat.createChatRoom);
  const updateChatRoomMutation = useMutation(api.chat.updateChatRoom);
  const deleteChatRoomMutation = useMutation(api.chat.deleteChatRoom);

  const addMessageMutation = useMutation(api.chat.addMessage);
  const deleteMessageMutation = useMutation(api.chat.deleteMessage);

  // Convert Convex data to app format
  const personas: Persona[] = useMemo(() => {
    return convexPersonas.map((p: any) => ({
      id: p._id,
      name: p.name,
      avatar: p.avatar,
      prompt: p.prompt,
      canSearch: p.canSearch,
    }));
  }, [convexPersonas]);

  const chatRooms: ChatRoom[] = useMemo(() => {
    return convexChatRooms.map((cr: any) => ({
      id: cr._id,
      topic: cr.topic,
      avatar: cr.avatar,
      personaIds: cr.personaIds,
      messages: [], // Messages loaded separately
    }));
  }, [convexChatRooms]);

  const personasMap = useMemo(() => {
    return personas.reduce(
      (acc, p) => {
        acc[p.id] = p;
        return acc;
      },
      {} as Record<string, Persona>,
    );
  }, [personas]);

  // Persona functions
  const addPersona = async (personaData: Omit<Persona, "id" | "avatar"> & { avatar?: string }) => {
    const id = await createPersonaMutation({
      name: personaData.name,
      avatar: personaData.avatar || "",
      prompt: personaData.prompt,
      canSearch: personaData.canSearch || false,
    });
    return id;
  };

  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    const personaId = id as Id<"personas">;
    await updatePersonaMutation({
      id: personaId,
      name: updates.name,
      avatar: updates.avatar,
      prompt: updates.prompt,
      canSearch: updates.canSearch,
    });
  };

  const deletePersona = async (id: string) => {
    await deletePersonaMutation({ id: id as Id<"personas"> });
  };

  // Chat room functions
  const addChatRoom = async (topic: string, personaIds: string[], avatar?: string) => {
    const id = await createChatRoomMutation({
      topic,
      avatar,
      personaIds: personaIds as Id<"personas">[],
    });
    return id;
  };

  const updateChatRoom = async (
    id: string,
    updates: Partial<Omit<ChatRoom, "id" | "messages">>,
  ) => {
    await updateChatRoomMutation({
      id: id as Id<"chatRooms">,
      ...updates,
      personaIds: updates.personaIds as Id<"personas">[] | undefined,
    });
  };

  const deleteChatRoom = async (id: string) => {
    await deleteChatRoomMutation({ id: id as Id<"chatRooms"> });
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  // Message functions
  const addMessage = async (
    chatRoomId: string,
    authorId: string,
    text: string,
    sources?: { title: string; uri: string }[],
  ) => {
    const id = await addMessageMutation({
      chatRoomId: chatRoomId as Id<"chatRooms">,
      authorId,
      text,
      sources,
    });
    return id;
  };

  return {
    // Data
    personas,
    chatRooms,
    personasMap,
    activeChatId,
    setActiveChatId,

    // Persona functions
    addPersona,
    updatePersona,
    deletePersona,

    // Chat room functions
    addChatRoom,
    updateChatRoom,
    deleteChatRoom,

    // Message functions
    addMessage,
    deleteMessage: (id: string) => deleteMessageMutation({ id: id as Id<"messages"> }),
  };
}
