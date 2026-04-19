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

const App: React.FC = () => {
  // Use Convex for data
  const {
    personas,
    chatRooms,
    personasMap,
    activeChatId,
    setActiveChatId,
    addPersona: addPersonaToDb,
    updatePersona: updatePersonaInDb,
    addChatRoom: addChatRoomToDb,
    updateChatRoom: updateChatRoomInDb,
    addMessage: addMessageToDb,
  } = useConvexData();

  // Load messages for active chat
  const activeChatMessages = useChatMessages(activeChatId);

  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [editingChatRoom, setEditingChatRoom] = useState<ChatRoom | null>(null);

  // Add a persona
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

  // Update a persona
  const updatePersona = async (id: string, updates: Partial<Persona>) => {
    await updatePersonaInDb(id, updates);
  };

  // Regenerate a persona's avatar
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

  // Create a chat room
  const createChat = async (topic: string, personaIds: string[]) => {
    // Generate group avatar in background
    let avatar: string | undefined;
    try {
      const personaNames = personaIds.map((id) => personasMap[id]?.name || 'Unknown');
      avatar = await generateGroupChatAvatar(topic, personaNames);
    } catch (error) {
      console.error('Failed to generate chat avatar:', error);
    }

    const chatId = await addChatRoomToDb(topic, personaIds, avatar);
    setActiveChatId(chatId);
  };

  // Update a chat room
  const updateChatRoom = async (chatId: string, updates: Partial<ChatRoom>) => {
    await updateChatRoomInDb(chatId, updates);
  };

  // Generate a chat avatar
  const generateChatAvatar = async (chatId: string) => {
    const chatRoom = chatRooms.find((room) => room.id === chatId);
    if (!chatRoom) return;

    const personaNames = chatRoom.personaIds.map((id) => personasMap[id]?.name || 'Unknown');
    const avatar = await generateGroupChatAvatar(chatRoom.topic, personaNames);

    await updateChatRoomInDb(chatId, { avatar });
  };

  // Add a message to a chat
  const addMessageToChat = async (
    chatId: string,
    messageData: { authorId: string; text: string; sources?: { title: string; uri: string }[] },
  ) => {
    await addMessageToDb(chatId, messageData.authorId, messageData.text, messageData.sources);
  };

  // Build active chat with messages
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
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col md:flex-row antialiased">
      {/* Public chat warning banner */}
      <div className="absolute top-0 left-0 right-0 bg-yellow-600 text-black text-center py-1 text-sm z-50">
        ⚠️ שימו לב: כל השיחות באתר חשופות לכל המבקרים. אל תשתפו מידע רגיש!
      </div>

      <div className="flex flex-1 pt-8">
        <ChatList
          chatRooms={chatRooms}
          activeChatId={activeChatId}
          setActiveChatId={setActiveChatId}
          onNewChat={() => setIsCreateChatOpen(true)}
          onManagePersonas={() => setIsPersonaManagerOpen(true)}
          onManageStorage={() => {}} // No longer needed
        />

        <ChatView
          chatRoom={activeChat}
          personasMap={personasMap}
          onSendMessage={addMessageToChat}
          onEditChat={() => activeChat && setEditingChatRoom(activeChat)}
        />
      </div>

      <PersonaManager
        isOpen={isPersonaManagerOpen}
        onClose={() => setIsPersonaManagerOpen(false)}
        personas={personas}
        addPersona={addPersona}
        updatePersona={updatePersona}
        regenerateAvatar={regeneratePersonaAvatar}
      />

      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        personas={personas}
        createChat={createChat}
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
