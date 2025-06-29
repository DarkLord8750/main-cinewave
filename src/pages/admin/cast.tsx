import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '../../components/ui/button';
import { Trash2, Plus, Edit2 } from 'lucide-react';

interface CastMember {
  id: string;
  name: string;
  photoUrl: string;
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const CastPage = () => {
  const [cast, setCast] = useState<CastMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedCast, setSelectedCast] = useState<CastMember | null>(null);
  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCast = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('cast_members').select('*').order('name');
    if (!error && data) setCast(data.map((m: any) => ({ ...m, photoUrl: m.photo_url || '' })));
    setLoading(false);
  };

  useEffect(() => {
    fetchCast();
  }, []);

  const openAddModal = () => {
    setModalMode('add');
    setSelectedCast(null);
    setName('');
    setPhotoUrl('');
    setIsModalOpen(true);
    setError(null);
  };

  const openEditModal = (member: CastMember) => {
    setModalMode('edit');
    setSelectedCast(member);
    setName(member.name);
    setPhotoUrl(member.photoUrl);
    setIsModalOpen(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this cast member?')) return;
    setLoading(true);
    const { error } = await supabase.from('cast_members').delete().eq('id', id);
    if (error) setError(error.message);
    else await fetchCast();
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    if (modalMode === 'add') {
      const { error } = await supabase.from('cast_members').insert({ name, photo_url: photoUrl });
      if (error) setError(error.message);
      else {
        setIsModalOpen(false);
        await fetchCast();
      }
    } else if (modalMode === 'edit' && selectedCast) {
      const { error } = await supabase.from('cast_members').update({ name, photo_url: photoUrl }).eq('id', selectedCast.id);
      if (error) setError(error.message);
      else {
        setIsModalOpen(false);
        await fetchCast();
      }
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">Cast Management</h1>
        <Button onClick={openAddModal} className="flex items-center gap-2 text-white bg-[#E50914] hover:bg-[#b00610]">
          <Plus size={16} /> Add Cast Member
        </Button>
      </div>
      {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-black">{error}</div>}
      <div className="bg-white rounded shadow p-4">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left text-black">Photo</th>
              <th className="px-4 py-2 text-left text-black">Name</th>
              <th className="px-4 py-2 text-left text-black">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cast.map(member => (
              <tr key={member.id} className="border-b">
                <td className="px-4 py-2">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-black">No Photo</span>
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-black">{member.name}</td>
                <td className="px-4 py-2">
                  <button onClick={() => openEditModal(member)} className="text-blue-600 hover:underline mr-2 text-black"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(member.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {cast.length === 0 && (
              <tr><td colSpan={3} className="text-center py-4 text-gray-500 text-black">No cast members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">{modalMode === 'add' ? 'Add Cast Member' : 'Edit Cast Member'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Name</label>
                <input type="text" className="w-full border px-3 py-2 rounded text-black" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Photo URL</label>
                <input type="url" className="w-full border px-3 py-2 rounded text-black" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="text-black">Cancel</Button>
                <Button type="submit" disabled={loading} className="text-white bg-[#E50914] hover:bg-[#b00610]">{modalMode === 'add' ? 'Add' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CastPage; 