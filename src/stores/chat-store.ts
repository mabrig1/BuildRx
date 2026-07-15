import { create } from "zustand";

import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  appendToLastMessage: (delta: string) => void;
  updateMessage: (id: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  appendToLastMessage: (delta) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = {
        ...last,
        content: last.content + delta,
      };
      return { messages };
    }),
  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  clear: () => set({ messages: [], isStreaming: false }),
}));
