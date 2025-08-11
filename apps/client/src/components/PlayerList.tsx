'use client';

interface PlayerListProps {
  users: any[];
  currentUserId?: string;
}

export default function PlayerList({ users, currentUserId }: PlayerListProps) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3">Players ({users.length})</h3>
      
      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className={`flex items-center justify-between p-2 rounded-lg ${
              user.id === currentUserId ? 'bg-blue-500/20' : 'bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${user.hasConfession ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-white">
                {user.nickname}
                {user.id === currentUserId && ' (You)'}
              </span>
            </div>
            {user.hasConfession && (
              <span className="text-xs text-green-400">Ready</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/20">
        <p className="text-white/60 text-xs">
          🟢 Has confession • 🟡 No confession yet
        </p>
      </div>
    </div>
  );
}