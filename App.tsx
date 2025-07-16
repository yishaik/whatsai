import React, { useState, useMemo } from 'react';
import { Persona, ChatRoom, Message } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import ChatList from './components/ChatList';
import ChatView from './components/ChatView';
import PersonaManager from './components/PersonaManager';
import CreateChatModal from './components/CreateChatModal';
import EditChatModal from './components/EditChatModal';
import StorageManager from './components/StorageManager';
import { generateAvatar, generateGroupChatAvatar } from './services/geminiService';
import { defaultPersonas, DEFAULT_AVATAR } from './data/defaultPersonas';

const App: React.FC = () => {
  // Use try-catch to handle quota errors on initial load
  let initialPersonas = defaultPersonas;
  try {
    const stored = localStorage.getItem('personas');
    if (stored) {
      initialPersonas = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load personas from storage:', e);
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Opening storage manager to free up space.');
      localStorage.clear(); // Emergency clear
    }
  }

  const [personas, setPersonas] = useLocalStorage<Persona[]>('personas', initialPersonas);
  const [chatRooms, setChatRooms] = useLocalStorage<ChatRoom[]>('chatRooms', []);
  const [activeChatId, setActiveChatId] = useLocalStorage<string | null>('activeChatId', null);

  const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [editingChatRoom, setEditingChatRoom] = useState<ChatRoom | null>(null);
  const [isStorageManagerOpen, setIsStorageManagerOpen] = useState(false);

  const personasMap = useMemo(() => {
    return personas.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as { [id: string]: Persona });
  }, [personas]);

  const addPersona = async (personaData: Omit<Persona, 'id' | 'avatar'>): Promise<Error | null> => {
    let avatarUrl: string;
    let errorToReport: Error | null = null;
    
    try {
      avatarUrl = await generateAvatar(personaData.name, personaData.prompt);
    } catch (error) {
      console.error("Avatar generation failed, using fallback.", error);
      // Use the default SVG placeholder
      avatarUrl = DEFAULT_AVATAR;
      
      if (error instanceof Error) {
        errorToReport = error;
      } else {
        errorToReport = new Error("An unknown error occurred while generating the avatar.");
      }
    }

    const newPersona: Persona = {
      ...personaData,
      id: `persona_${Date.now()}`,
      avatar: avatarUrl,
    };
    setPersonas(prev => [...prev, newPersona]);
    
    return errorToReport;
  };

  const updatePersona = (id: string, data: Omit<Persona, 'id' | 'avatar'>) => {
    setPersonas(prev => prev.map(p =>
      p.id === id
        ? { ...p, ...data }
        : p
    ));
  };

  const regeneratePersonaAvatar = async (personaId: string) => {
    const persona = personas.find(p => p.id === personaId);
    if (!persona) return;
    
    const newAvatar = await generateAvatar(persona.name, persona.prompt);
    setPersonas(prev => prev.map(p =>
      p.id === personaId
        ? { ...p, avatar: newAvatar }
        : p
    ));
  };
  
  const createChat = async (topic: string, personaIds: string[]) => {
    const newChatRoom: ChatRoom = {
      id: `chat_${Date.now()}`,
      topic,
      personaIds,
      messages: [],
    };
    
    // Try to generate avatar for the chat
    try {
      const personaNames = personaIds.map(id => personasMap[id]?.name || 'Unknown');
      const avatar = await generateGroupChatAvatar(topic, personaNames);
      newChatRoom.avatar = avatar;
    } catch (error) {
      console.error('Failed to generate chat avatar:', error);
      // Chat will use text-based avatar as fallback
    }
    
    setChatRooms(prev => [...prev, newChatRoom]);
    setActiveChatId(newChatRoom.id);
  };

  const updateChatRoom = (chatId: string, updates: Partial<ChatRoom>) => {
    setChatRooms(prevRooms =>
      prevRooms.map(room =>
        room.id === chatId
          ? { ...room, ...updates }
          : room
      )
    );
  };

  const generateChatAvatar = async (chatId: string) => {
    const chatRoom = chatRooms.find(room => room.id === chatId);
    if (!chatRoom) return;
    
    const personaNames = chatRoom.personaIds.map(id => personasMap[id]?.name || 'Unknown');
    const avatar = await generateGroupChatAvatar(chatRoom.topic, personaNames);
    
    updateChatRoom(chatId, { avatar });
  };

  const addMessageToChat = (chatId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...messageData,
      id: `msg_${Date.now()}`,
      timestamp: Date.now(),
    };
    setChatRooms(prevRooms =>
      prevRooms.map(room =>
        room.id === chatId
          ? { ...room, messages: [...room.messages, newMessage] }
          : room
      )
    );
  };

  const activeChat = chatRooms.find(c => c.id === activeChatId) || null;

  return (
    <div className="h-screen w-screen bg-gray-900 text-white flex flex-col md:flex-row antialiased">
      <ChatList
        chatRooms={chatRooms}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        onNewChat={() => setIsCreateChatOpen(true)}
        onManagePersonas={() => setIsPersonaManagerOpen(true)}
        onManageStorage={() => setIsStorageManagerOpen(true)}
      />

      <ChatView
        chatRoom={activeChat}
        personasMap={personasMap}
        onSendMessage={addMessageToChat}
        onEditChat={() => activeChat && setEditingChatRoom(activeChat)}
      />

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

      <StorageManager
        isOpen={isStorageManagerOpen}
        onClose={() => setIsStorageManagerOpen(false)}
      />
    </div>
  );
};

export default App;