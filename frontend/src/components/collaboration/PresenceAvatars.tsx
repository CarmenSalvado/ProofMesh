"use client";

import { useOptionalCollaboration, UserPresence } from "./CollaborationProvider";

interface PresenceAvatarsProps {
  maxDisplay?: number;
  showNames?: boolean;
  className?: string;
}

export function PresenceAvatars({
  maxDisplay = 5,
  showNames = false,
  className = "",
}: PresenceAvatarsProps) {
  const collaboration = useOptionalCollaboration();
  
  if (!collaboration || collaboration.users.length === 0) {
    return null;
  }
  
  const { users, isConnected } = collaboration;
  const displayUsers = users.slice(0, maxDisplay);
  const overflowCount = users.length - maxDisplay;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5 mr-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-500" : "bg-neutral-400"
          }`}
        />
        <span className="text-xs text-neutral-500">
          {isConnected ? "Live" : "Offline"}
        </span>
      </div>

      {/* User avatars */}
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <UserAvatar key={user.user_id} user={user} showName={showNames} />
        ))}
        
        {overflowCount > 0 && (
          <div
            className="relative w-8 h-8 rounded-full bg-neutral-200 border-2 border-white flex items-center justify-center text-xs font-medium text-neutral-600"
            title={`+${overflowCount} more`}
          >
            +{overflowCount}
          </div>
        )}
      </div>
      
      {/* User count */}
      <span className="ml-2 text-xs text-neutral-500">
        {users.length} {users.length === 1 ? "viewer" : "viewers"}
      </span>
    </div>
  );
}

interface UserAvatarProps {
  user: UserPresence;
  showName?: boolean;
}

function UserAvatar({ user, showName = false }: UserAvatarProps) {
  const initials = getInitials(user.display_name || user.username);
  const displayName = user.display_name || user.username;
  
  return (
    <div className="relative group">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white cursor-default"
        style={{ backgroundColor: user.avatar_color }}
        title={displayName}
      >
        {initials}
        </div>
        
        {/* Active file indicator */}
        {user.active_file && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border border-white" />
        )}
        
        {showName && (
          <span className="ml-2 text-sm text-neutral-700">
            {displayName}
          </span>
        )}
      </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Export a simple version without tooltip for use in lists
export function PresenceList({ className = "" }: { className?: string }) {
  const collaboration = useOptionalCollaboration();
  
  if (!collaboration || collaboration.users.length === 0) {
    return null;
  }
  
  const { users, isConnected } = collaboration;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-500" : "bg-neutral-400"
          }`}
        />
        <span>{isConnected ? "Collaborating" : "Disconnected"}</span>
      </div>
      
      <ul className="space-y-1">
        {users.map((user) => (
          <li key={user.user_id} className="flex items-center gap-2 py-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
              style={{ backgroundColor: user.avatar_color }}
            >
              {getInitials(user.display_name || user.username)}
            </div>
            <span className="text-sm text-neutral-700 truncate">
              {user.display_name || user.username}
            </span>
            {user.active_file && (
              <span className="text-xs text-neutral-400 truncate ml-auto">
                {user.active_file.split("/").pop()}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
