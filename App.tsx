import React, { useState, useMemo, useEffect } from 'react';
import { useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexData, Persona, ChatRoom } from './hooks/useConvexData';
import { useChatMessages } from './hooks/useChatMessages';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import PersonaManager from './components/PersonaManager';
import CreateChatModal from './components/CreateChatModal';
import EditChatModal from './components/EditChatModal';
import { generateAvatar, generateGroupChatAvatar } from './services/geminiService';
import { DEFAULT_AVATAR } from './data/defaultPersonas';
import { Bars3Icon } from './components/icons';

const App: React.FC = () => {
  const {
    personas,
    chatRooms,
    personasMap,
    activeChatId,
    setActiveChatId,
    addPersona: addPersonaToDb,
    updatePersona: updatePersonaInDb,
    deletePersona: deletePersonaFromDb,
    addChatRoom: addChatRoomToDb,
    updateChatRoom: updateChatRoomInDb,
    deleteChatRoom: deleteChatRoomFromDb,
    addMessage: addMessageToDb,
    claimResponseSlot,
    uploadAvatar,
  } = useConvexData();

  const activeChatMessages = useChatMessages(activeChatId);

  // Every visitor gets a silent anonymous session so the app stays zero-friction
  // (writes require an identity). Signing in with Google later upgrades it.
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void signIn('anonymous');
    }
  }, [authLoading, isAuthenticated, signIn]);

  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [editingChatRoom, setEditingChatRoom] = useState<ChatRoom | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Generate an avatar, upload it to file storage, and return either a storage
  // id or an inline fallback to persist. Never throws.
  const buildAvatarFields = async (
    name: string,
    prompt: string,
  ): Promise<{ avatarStorageId?: string; avatar?: string; error: Error | null }> => {
    try {
      const dataUri = await generateAvatar(name, prompt);
      try {
        const avatarStorageId = await uploadAvatar(dataUri);
        return { avatarStorageId, error: null };
      } catch (uploadError) {
        // Generation worked but upload failed — keep the image inline.
        console.error('Avatar upload failed, storing inline:', uploadError);
        return { avatar: dataUri, error: null };
      }
    } catch (error) {
      console.error('Avatar generation failed, using fallback:', error);
      return { avatar: DEFAULT_AVATAR, error: error instanceof Error ? error : null };
    }
  };

  const addPersona = async (personaData: Omit<Persona, 'id' | 'avatar'>): Promise<Error | null> => {
    const { avatarStorageId, avatar, error } = await buildAvatarFields(personaData.name, personaData.prompt);

    await addPersonaToDb({
      name: personaData.name,
      prompt: personaData.prompt,
      canSearch: personaData.canSearch,
      avatar,
      avatarStorageId,
    });

    return error;
  };

  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    await updatePersonaInDb(id, updates);
  };

  const regeneratePersonaAvatar = async (personaId: string): Promise<void> => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    const { avatarStorageId, avatar, error } = await buildAvatarFields(persona.name, persona.prompt);
    // Generation failed — keep the existing avatar rather than reset to default.
    if (error) return;
    await updatePersonaInDb(personaId, { avatarStorageId, avatar });
  };

  const deletePersona = async (id: string) => {
    await deletePersonaFromDb(id);
  };

  const createChat = async (
    topic: string,
    personaIds: string[],
    visibility: 'public' | 'private' = 'public',
  ) => {
    // Create chat immediately without avatar for instant feedback
    const chatId = await addChatRoomToDb(topic, personaIds, undefined, visibility);
    setActiveChatId(chatId);

    // Generate avatar in background
    try {
      const personaNames = personaIds.map((id) => personasMap[id]?.name || 'Unknown');
      const dataUri = await generateGroupChatAvatar(topic, personaNames);
      const avatarStorageId = await uploadAvatar(dataUri);
      await updateChatRoomInDb(chatId, { avatarStorageId });
    } catch (error) {
      console.error('Failed to generate chat avatar:', error);
    }
  };

  const updateChatRoom = async (chatId: string, updates: Partial<ChatRoom>) => {
    await updateChatRoomInDb(chatId, updates);
  };

  const deleteChatRoom = async (chatId: string) => {
    await deleteChatRoomFromDb(chatId);
  };

  const generateChatAvatar = async (chatId: string) => {
    const chatRoom = chatRooms.find((room) => room.id === chatId);
    if (!chatRoom) return;

    const personaNames = chatRoom.personaIds.map((id) => personasMap[id]?.name || 'Unknown');
    const dataUri = await generateGroupChatAvatar(chatRoom.topic, personaNames);
    const avatarStorageId = await uploadAvatar(dataUri);

    await updateChatRoomInDb(chatId, { avatarStorageId });
  };

  const addMessageToChat = async (
    chatId: string,
    messageData: { authorId: string; text: string; sources?: { title: string; uri: string }[] },
  ) => {
    await addMessageToDb(chatId, messageData.authorId, messageData.text, messageData.sources);
  };

  const activeChat = useMemo(() => {
    if (!activeChatId) return null;
    const chatRoom = chatRooms.find((c) => c.id === activeChatId);
    if (!chatRoom) return null;
    return {
      ...chatRoom,
      messages: activeChatMessages,
    };
  }, [activeChatId, chatRooms, activeChatMessages]);

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col antialiased">
      {/* Public chat warning banner */}
      <div className="bg-yellow-600 text-black text-center py-1.5 px-3 text-sm z-50" dir="rtl">
        ⚠️ שימו לב: כל השיחות באתר חשופות לכל המבקרים. אל תשתפו מידע רגיש!
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden bg-panel-header-bg px-3 py-2 flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="text-icon-default hover:text-icon-strong p-2 rounded-full hover:bg-item-hover-bg"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <span className="text-text-primary font-semibold">
          {activeChat ? activeChat.topic : 'AI Chats'}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ChatList
          chatRooms={chatRooms}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onNewChat={() => setIsCreateChatOpen(true)}
          onManagePersonas={() => setIsPersonaManagerOpen(true)}
          onDeleteChat={deleteChatRoom}
          isMobileOpen={isSidebarOpen}
          onMobileClose={() => setIsSidebarOpen(false)}
        />

        <ChatView
          chatRoom={activeChat}
          personasMap={personasMap}
          authReady={isAuthenticated}
          onSendMessage={addMessageToChat}
          onClaimResponse={claimResponseSlot}
          onEditChat={() => activeChat && setEditingChatRoom(activeChat)}
          onDeleteChat={activeChat ? () => deleteChatRoom(activeChat.id) : undefined}
        />
      </div>

      <PersonaManager
        isOpen={isPersonaManagerOpen}
        onClose={() => setIsPersonaManagerOpen(false)}
        personas={personas}
        addPersona={addPersona}
        updatePersona={updatePersona}
        regenerateAvatar={regeneratePersonaAvatar}
        deletePersona={deletePersona}
      />

      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        personas={personas}
        createChat={createChat}
        onManagePersonas={() => { setIsCreateChatOpen(false); setIsPersonaManagerOpen(true); }}
      />

      <EditChatModal
        isOpen={!!editingChatRoom}
        onClose={() => setEditingChatRoom(null)}
        chatRoom={editingChatRoom}
        personas={personas}
        updateChatRoom={updateChatRoom}
        generateChatAvatar={generateChatAvatar}
      />
    </div>
  );
};

export default App;
