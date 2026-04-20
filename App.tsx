import React, { useState, useMemo } from 'react';
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
  } = useConvexData();

  const activeChatMessages = useChatMessages(activeChatId);

  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [editingChatRoom, setEditingChatRoom] = useState<ChatRoom | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const addPersona = async (personaData: Omit<Persona, 'id' | 'avatar'>): Promise<Error | null> => {
    let avatarUrl: string;
    let errorToReport: Error | null = null;

    try {
      avatarUrl = await generateAvatar(personaData.name, personaData.prompt);
    } catch (error) {
      console.error('Avatar generation failed, using fallback:', error);
      avatarUrl = DEFAULT_AVATAR;
      if (error instanceof Error) {
        errorToReport = error;
      }
    }

    await addPersonaToDb({
      name: personaData.name,
      prompt: personaData.prompt,
      canSearch: personaData.canSearch,
      avatar: avatarUrl,
    });

    return errorToReport;
  };

  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    await updatePersonaInDb(id, updates);
  };

  const regeneratePersonaAvatar = async (personaId: string): Promise<void> => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    try {
      const newAvatar = await generateAvatar(persona.name, persona.prompt);
      await updatePersonaInDb(personaId, { avatar: newAvatar });
    } catch (error) {
      console.error('Failed to regenerate avatar:', error);
    }
  };

  const deletePersona = async (id: string) => {
    await deletePersonaFromDb(id);
  };

  const createChat = async (topic: string, personaIds: string[]) => {
    // Create chat immediately without avatar for instant feedback
    const chatId = await addChatRoomToDb(topic, personaIds, undefined);
    setActiveChatId(chatId);

    // Generate avatar in background
    try {
      const personaNames = personaIds.map((id) => personasMap[id]?.name || 'Unknown');
      const avatar = await generateGroupChatAvatar(topic, personaNames);
      await updateChatRoomInDb(chatId, { avatar });
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
    const avatar = await generateGroupChatAvatar(chatRoom.topic, personaNames);

    await updateChatRoomInDb(chatId, { avatar });
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
          onSendMessage={addMessageToChat}
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
