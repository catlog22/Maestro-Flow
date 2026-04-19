import { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// ChatSidebarContext — provides sidebar toggle callbacks to child components
// ---------------------------------------------------------------------------

interface ChatSidebarContextValue {
  fileTreeOpen: boolean;
  setFileTreeOpen: (open: boolean) => void;
  historyOpen: boolean;
  setHistoryOpen: (open: boolean) => void;
}

export const ChatSidebarContext = createContext<ChatSidebarContextValue>({
  fileTreeOpen: false,
  setFileTreeOpen: () => {},
  historyOpen: false,
  setHistoryOpen: () => {},
});

export function useChatSidebar() {
  return useContext(ChatSidebarContext);
}
