const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}/api${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  // User endpoints
  async createUser(nickname: string) {
    return this.request<{ user: any }>('/users', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  }

  async getUser(id: string) {
    return this.request<{ user: any }>(`/users/${id}`);
  }

  async joinRoom(userId: string, roomId: string) {
    return this.request<{ user: any }>(`/users/${userId}/join-room`, {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });
  }

  async leaveRoom(userId: string) {
    return this.request<{ user: any }>(`/users/${userId}/leave-room`, {
      method: 'POST',
    });
  }

  // Room endpoints
  async createRoom(name: string) {
    return this.request<{ room: any }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getRooms() {
    return this.request<{ rooms: any[] }>('/rooms');
  }

  async getRoom(id: string) {
    return this.request<{ room: any }>(`/rooms/${id}`);
  }

  async getRoomUsers(id: string) {
    return this.request<{ users: any[] }>(`/rooms/${id}/users`);
  }

  // Confession endpoints
  async createConfession(userId: string, content: string) {
    return this.request<{ confession: any }>('/confessions', {
      method: 'POST',
      body: JSON.stringify({ userId, content }),
    });
  }

  async getConfession(userId: string) {
    return this.request<{ confession: any }>(`/confessions/user/${userId}`);
  }

  // Game endpoints
  async getRoomGameHistory(roomId: string) {
    return this.request<{ rounds: any[] }>(`/games/room/${roomId}/rounds`);
  }

  async getGameRound(id: string) {
    return this.request<{ round: any }>(`/games/rounds/${id}`);
  }
}

export const api = new ApiClient();