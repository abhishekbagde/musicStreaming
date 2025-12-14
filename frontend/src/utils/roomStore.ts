import { create } from 'zustand'
import { Room, User, ChatMessage } from '@/types'

interface RoomStore {
  room: Room | null
  users: User[]
  messages: ChatMessage[]
  isConnected: boolean
  isLive: boolean

  setRoom: (room: Room | null) => void
  setUsers: (users: User[]) => void
  addMessage: (message: ChatMessage) => void
  setConnected: (connected: boolean) => void
  setLive: (live: boolean) => void
  addUser: (user: User) => void
  removeUser: (userId: string) => void
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  users: [],
  messages: [],
  isConnected: false,
  isLive: false,

  setRoom: (room) => set({ room }),
  setUsers: (users) => set({ users }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setConnected: (connected) => set({ isConnected: connected }),
  setLive: (live) => set({ isLive: live }),
  addUser: (user) =>
    set((state) => ({
      users: [...state.users.filter((u) => u.userId !== user.userId), user],
    })),
  removeUser: (userId) =>
    set((state) => ({
      users: state.users.filter((u) => u.userId !== userId),
    })),
}))
