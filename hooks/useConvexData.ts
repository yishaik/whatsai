import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { Attachment, ReminderInput, Reminder, UsageInfo, UsageRow } from "../types";
import { DEFAULT_MODEL_ID } from "../services/models";

export type { Attachment, Reminder, UsageRow };

// Types matching the existing app types
export interface Persona {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  canSearch?: boolean;
  model?: string;
}

export interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
  attachments?: Attachment[];
}

export interface ChatRoom {
  id: string;
  topic: string;
  avatar?: string;
  personaIds: string[];
  messages: Message[];
  visibility?: "public" | "private";
  lastMessageText?: string;
  lastMessageTime?: number;
  model?: string;
  temperature?: number;
  maxResponders?: number;
  shareId?: string;
}

// Hook to manage all data with Convex
export function useConvexData() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Convex queries
  const convexPersonas = useQuery(api.chat.getAllPersonas) || [];
  const convexChatRooms = useQuery(api.chat.getAllChatRooms) || [];
  const settings = useQuery(api.chat.getMySettings);
  const setDefaultModelMutation = useMutation(api.chat.setDefaultModel);

  // The user's chosen default reply model (falls back before they pick one).
  const defaultModel = settings?.defaultModel || DEFAULT_MODEL_ID;
  const setDefaultModel = async (model: string) => {
    await setDefaultModelMutation({ model });
  };

  // Convex mutations
  const createPersonaMutation = useMutation(api.chat.createPersona);
  const updatePersonaMutation = useMutation(api.chat.updatePersona);
  const deletePersonaMutation = useMutation(api.chat.deletePersona);

  const createChatRoomMutation = useMutation(api.chat.createChatRoom);
  const updateChatRoomMutation = useMutation(api.chat.updateChatRoom);
  const deleteChatRoomMutation = useMutation(api.chat.deleteChatRoom);
  const createShareLinkMutation = useMutation(api.sharing.createShareLink);
  const revokeShareLinkMutation = useMutation(api.sharing.revokeShareLink);

  const addMessageMutation = useMutation(api.chat.addMessage);
  const deleteMessageMutation = useMutation(api.chat.deleteMessage);
  const claimResponseSlotMutation = useMutation(api.chat.claimResponseSlot);
  const generateUploadUrlMutation = useMutation(api.chat.generateUploadUrl);

  // Reminders
  const reminders: Reminder[] = (useQuery(api.reminders.listMyReminders) || []).map((r: any) => ({
    id: r.id,
    chatId: r.chatId,
    personaId: r.personaId,
    text: r.text,
    nextRunAt: r.nextRunAt,
    repeat: r.repeat,
  }));
  const scheduleReminderMutation = useMutation(api.reminders.scheduleReminder);
  const cancelReminderMutation = useMutation(api.reminders.cancelReminder);

  // Usage
  const usage: UsageRow[] = (useQuery(api.usage.getMyUsage) || []) as UsageRow[];
  const recordUsageMutation = useMutation(api.usage.recordUsage);

  // Convert Convex data to app format
  const personas: Persona[] = useMemo(() => {
    return convexPersonas.map((p: any) => ({
      id: p._id,
      name: p.name,
      avatar: p.avatar,
      prompt: p.prompt,
      canSearch: p.canSearch,
      model: p.model,
    }));
  }, [convexPersonas]);

  const chatRooms: ChatRoom[] = useMemo(() => {
    return convexChatRooms.map((cr: any) => ({
      id: cr._id,
      topic: cr.topic,
      avatar: cr.avatar,
      personaIds: cr.personaIds,
      visibility: cr.visibility ?? "public",
      lastMessageText: cr.lastMessageText,
      lastMessageTime: cr.lastMessageTime,
      model: cr.model,
      temperature: cr.temperature,
      maxResponders: cr.maxResponders,
      shareId: cr.shareId,
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
  const addPersona = async (
    personaData: Omit<Persona, "id" | "avatar"> & { avatar?: string; avatarStorageId?: string },
  ) => {
    const id = await createPersonaMutation({
      name: personaData.name,
      // Prefer a stored image; only fall back to an inline avatar string.
      avatar: personaData.avatarStorageId ? undefined : personaData.avatar || "",
      avatarStorageId: personaData.avatarStorageId as Id<"_storage"> | undefined,
      prompt: personaData.prompt,
      canSearch: personaData.canSearch || false,
      model: personaData.model,
    });
    return id;
  };

  const updatePersona = async (
    id: string,
    updates: Partial<Persona> & { avatarStorageId?: string },
  ) => {
    const personaId = id as Id<"personas">;
    await updatePersonaMutation({
      id: personaId,
      name: updates.name,
      avatar: updates.avatar,
      avatarStorageId: updates.avatarStorageId as Id<"_storage"> | undefined,
      prompt: updates.prompt,
      canSearch: updates.canSearch,
      model: updates.model,
    });
  };

  const deletePersona = async (id: string) => {
    await deletePersonaMutation({ id: id as Id<"personas"> });
  };

  // Chat room functions
  const addChatRoom = async (
    topic: string,
    personaIds: string[],
    avatar?: string,
    visibility?: "public" | "private",
  ) => {
    const id = await createChatRoomMutation({
      topic,
      avatar,
      personaIds: personaIds as Id<"personas">[],
      visibility,
    });
    return id;
  };

  const updateChatRoom = async (
    id: string,
    updates: Partial<Omit<ChatRoom, "id" | "messages">> & { avatarStorageId?: string },
  ) => {
    const { avatarStorageId, ...rest } = updates;
    await updateChatRoomMutation({
      id: id as Id<"chatRooms">,
      ...rest,
      avatarStorageId: avatarStorageId as Id<"_storage"> | undefined,
      personaIds: updates.personaIds as Id<"personas">[] | undefined,
    });
  };

  // Upload an avatar image (a data URI) to Convex file storage; returns the
  // storage id to save on the persona/chat room.
  const uploadAvatar = async (dataUri: string): Promise<string> => {
    const uploadUrl = await generateUploadUrlMutation();
    const blob = await (await fetch(dataUri)).blob();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/png" },
      body: blob,
    });
    if (!result.ok) {
      throw new Error(`Avatar upload failed with status ${result.status}`);
    }
    const { storageId } = await result.json();
    return storageId as string;
  };

  const deleteChatRoom = async (id: string) => {
    await deleteChatRoomMutation({ id: id as Id<"chatRooms"> });
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  // Create (or fetch) a public read-only share token for a chat.
  const createShareLink = async (chatId: string): Promise<string> => {
    return await createShareLinkMutation({ chatId: chatId as Id<"chatRooms"> });
  };

  const revokeShareLink = async (chatId: string): Promise<void> => {
    await revokeShareLinkMutation({ chatId: chatId as Id<"chatRooms"> });
  };

  // Upload an arbitrary file to Convex storage; returns an Attachment reference
  // (without a resolved URL — the server adds that when messages are read back).
  const uploadFile = async (file: File): Promise<Attachment> => {
    const uploadUrl = await generateUploadUrlMutation();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!result.ok) {
      throw new Error(`File upload failed with status ${result.status}`);
    }
    const { storageId } = await result.json();
    return {
      storageId: storageId as string,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    };
  };

  // Message functions
  const addMessage = async (
    chatRoomId: string,
    authorId: string,
    text: string,
    sources?: { title: string; uri: string }[],
    attachments?: Attachment[],
  ) => {
    const id = await addMessageMutation({
      chatRoomId: chatRoomId as Id<"chatRooms">,
      authorId,
      text,
      sources,
      // Persist only the storage reference; drop any resolved url field.
      attachments: attachments?.map((a) => ({
        storageId: a.storageId as Id<"_storage">,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
      })),
    });
    return id;
  };

  // Schedule a reminder parsed from a persona reply (auth is the caller's).
  const scheduleReminder = async (
    chatId: string,
    personaId: string,
    reminder: ReminderInput,
  ): Promise<void> => {
    await scheduleReminderMutation({
      chatId: chatId as Id<"chatRooms">,
      personaId,
      text: reminder.text,
      when: reminder.when,
      repeat: reminder.repeat,
    });
  };

  const cancelReminder = async (id: string): Promise<void> => {
    await cancelReminderMutation({ id: id as Id<"reminders"> });
  };

  // Record token usage for a reply (fire-and-forget; never blocks the chat).
  const recordUsage = (info: UsageInfo): void => {
    void recordUsageMutation({
      model: info.model,
      provider: info.provider,
      inputTokens: info.inputTokens,
      outputTokens: info.outputTokens,
    }).catch((err) => console.error("Failed to record usage:", err));
  };

  // Atomically claim the right to generate a persona's reply to a user message.
  // Returns true if this client should generate the response.
  const claimResponseSlot = async (
    chatRoomId: string,
    triggerMessageId: string,
    personaId: string,
  ): Promise<boolean> => {
    return await claimResponseSlotMutation({
      chatRoomId: chatRoomId as Id<"chatRooms">,
      triggerMessageId,
      personaId,
    });
  };

  return {
    // Data
    personas,
    chatRooms,
    personasMap,
    activeChatId,
    setActiveChatId,

    // Settings
    defaultModel,
    setDefaultModel,

    // Persona functions
    addPersona,
    updatePersona,
    deletePersona,

    // Chat room functions
    addChatRoom,
    updateChatRoom,
    deleteChatRoom,
    createShareLink,
    revokeShareLink,

    // Avatar storage
    uploadAvatar,

    // Message functions
    addMessage,
    uploadFile,
    claimResponseSlot,
    deleteMessage: (id: string) => deleteMessageMutation({ id: id as Id<"messages"> }),

    // Reminders
    reminders,
    scheduleReminder,
    cancelReminder,

    // Usage
    usage,
    recordUsage,
  };
}
