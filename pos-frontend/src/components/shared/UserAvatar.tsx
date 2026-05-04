import React from 'react';

interface UserAvatarProps {
  name: string;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ name, className = "h-12 w-12 text-lg" }) => {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  
  return (
    <div className={`rounded-[1rem] bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center font-black flex-shrink-0 shadow-inner ${className}`}>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
        {initial}
      </span>
    </div>
  );
};

export default UserAvatar;
