import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface AvatarOption {
  id: string;
  url: string;
}

interface ProfilePageProps {
  forceEdit?: boolean;
  onClose?: () => void;
}

interface Profile {
  id: string;
  name: string;
  avatar: string;
}

const ProfilePage = ({ forceEdit = false, onClose }: ProfilePageProps) => {
  const { user, selectProfile, updateProfile, logout } = useAuthStore();
  const [isEditing, setIsEditing] = useState(forceEdit);
  const [showAvatarSelector, setShowAvatarSelector] = useState(forceEdit);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(forceEdit && user?.profiles?.[0] ? user.profiles[0] : null);
  const [defaultAvatars, setDefaultAvatars] = useState<AvatarOption[]>([]);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (forceEdit && user?.profiles?.[0]) {
      setIsEditing(true);
      setShowAvatarSelector(true);
      setSelectedProfile(user.profiles[0]);
    }
  }, [forceEdit, user]);

  // Fetch default avatars from DB
  useEffect(() => {
    const fetchAvatars = async () => {
      const { data, error } = await supabase
        .from('profile_avatars')
        .select('id, url')
        .eq('category', 'default');
      if (!error && data) setDefaultAvatars(data);
    };
    fetchAvatars();
  }, []);

  // When opening avatar selector, fetch current avatar from DB
  useEffect(() => {
    if (showAvatarSelector && selectedProfile) {
      setProfileName(selectedProfile.name);
      // Fetch custom avatar from DB
      const fetchCustomAvatar = async () => {
        const { data, error } = await supabase
          .from('profile_avatars')
          .select('avatar_url')
          .eq('profile_id', selectedProfile.id)
          .maybeSingle();
        if (!error && data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        } else {
          setAvatarUrl(selectedProfile.avatar || '');
        }
      };
      fetchCustomAvatar();
    }
  }, [showAvatarSelector, selectedProfile]);

  const handleProfileSelect = (profile: Profile) => {
    if (isEditing) {
      setSelectedProfile(profile);
      setShowAvatarSelector(true);
      return;
    }
    selectProfile(profile);
    navigate('/browse');
  };

  const handleAvatarSelect = (url: string) => {
    setAvatarUrl(url);
  };

  const handleSave = async () => {
    if (!selectedProfile) return;
    setIsSaving(true);
    try {
      // Update name in profiles
      await supabase
        .from('profiles')
        .update({ name: profileName })
        .eq('id', selectedProfile.id);
      // Upsert avatar in profile_avatars
      if (avatarUrl) {
        await supabase
          .from('profile_avatars')
          .upsert({
            profile_id: selectedProfile.id,
            avatar_url: avatarUrl
          }, { onConflict: 'profile_id' });
      }
      // Update local state
      await updateProfile(selectedProfile.id, {
        ...selectedProfile,
        name: profileName,
        avatar: avatarUrl
      });
      setShowAvatarSelector(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProfile) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${selectedProfile.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      setAvatarUrl(publicUrlData.publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (showAvatarSelector && selectedProfile) {
    return (
      <div
        className="w-full max-w-lg md:max-w-2xl mx-auto my-8 bg-netflix-dark text-white rounded-xl shadow-2xl p-0 overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="p-6 flex justify-between items-center">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-2xl ml-4"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          <div className="w-full p-8">
            <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>
            <div className="flex flex-col items-center mb-8">
              <img
                src={avatarUrl || defaultAvatars[0]?.url || 'https://i.pravatar.cc/150?img=1'}
                alt="Avatar Preview"
                className="w-24 h-24 rounded-full border mb-4 object-cover"
              />
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                className="w-full max-w-xs p-3 bg-gray-700 rounded-lg text-white text-center mb-2"
                placeholder="Profile Name"
              />
            </div>
            <label className="block text-lg font-semibold mb-2">Choose Avatar</label>
            <div className="flex space-x-4 overflow-x-auto pb-2 mb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ WebkitOverflowScrolling: 'touch' }}>
              {defaultAvatars.map((avatar) => (
                <button
                  type="button"
                  key={avatar.id}
                  className={`rounded-full border-2 p-1 transition-all ${avatarUrl === avatar.url ? 'border-red-600' : 'border-transparent'} hover:border-red-400 flex-shrink-0`}
                  onClick={() => handleAvatarSelect(avatar.url)}
                >
                  <img src={avatar.url} alt="avatar" className="w-12 h-12 rounded-full object-cover" />
                </button>
              ))}
            </div>
            <div className="mt-2">
                  <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                  />
              {uploading && <span className="text-sm text-gray-500 ml-2">Uploading...</span>}
                </div>
            <div className="flex justify-end gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarSelector(false);
                      setSelectedProfile(null);
                  if (onClose && forceEdit) onClose();
                    }}
                    className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                type="button"
                onClick={async () => {
                  await handleSave();
                  if (onClose && forceEdit) onClose();
                }}
                disabled={isSaving}
                    className="px-6 py-2 bg-[#E50914] rounded-md hover:bg-opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                {isSaving ? 'Saving...' : 'Done'}
                  </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-netflix-black flex flex-col">
      <header className="p-6">
      </header>
      
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl md:text-3xl text-netflix-white mb-6">
          {isEditing ? 'Manage Profiles' : 'Who\'s watching?'}
        </h1>
        
        <div className="flex flex-wrap justify-center gap-6 max-w-4xl">
          {user?.profiles.map((profile: Profile) => (
            <div 
              key={profile.id}
              className="relative group"
              onClick={() => handleProfileSelect(profile)}
            >
              <div className={`w-[120px] h-[120px] overflow-hidden rounded-md transition-all duration-300 ${
                isEditing ? 'opacity-50' : 'cursor-pointer hover:border-4 border-netflix-white'
              }`}>
                <img 
                  src={profile.avatar} 
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {isEditing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Pencil className="text-netflix-white" size={40} />
                </div>
              )}
              <p className="text-center text-netflix-gray mt-2 group-hover:text-netflix-white">
                {profile.name}
              </p>
            </div>
          ))}
          
          {/* Add profile button */}
          <div 
            className="w-[120px] h-[120px] flex flex-col items-center justify-center border-2 border-gray-600 rounded-md text-gray-600 cursor-pointer hover:border-netflix-white hover:text-netflix-white transition-all duration-300"
            onClick={() => {
              // In a real app, this would open a modal to add a new profile
              alert('Add profile functionality would go here');
            }}
          >
            <Plus size={40} />
            <p className="text-center mt-2">Add Profile</p>
          </div>
        </div>
        
        <div className="mt-12">
          {isEditing ? (
            <button 
              onClick={() => setIsEditing(false)}
              className="py-2 px-8 bg-netflix-white text-netflix-black border border-netflix-white rounded font-medium hover:bg-netflix-white/90 transition-colors"
            >
              Done
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="py-2 px-8 border border-gray-600 text-gray-600 rounded font-medium hover:border-netflix-white hover:text-netflix-white transition-colors"
            >
              Manage Profiles
            </button>
          )}
        </div>
        
        <button 
          onClick={handleLogout}
          className="mt-4 text-gray-600 hover:text-netflix-white transition-colors"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};

export default ProfilePage;