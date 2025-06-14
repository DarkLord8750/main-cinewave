import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '../ui/input';

interface SubtitleManagerProps {
  value: { [key: string]: string };
  onChange: (value: { [key: string]: string }) => void;
  disabled?: boolean;
}

const commonLanguages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
];

export const SubtitleManager = ({ value, onChange, disabled = false }: SubtitleManagerProps) => {
  const [customLanguage, setCustomLanguage] = useState('');

  const handleAddLanguage = (languageCode: string) => {
    if (!languageCode) return;
    onChange({
      ...value,
      [languageCode]: ''
    });
  };

  const handleRemoveLanguage = (languageCode: string) => {
    const newValue = { ...value };
    delete newValue[languageCode];
    onChange(newValue);
  };

  const handleUrlChange = (languageCode: string, url: string) => {
    onChange({
      ...value,
      [languageCode]: url
    });
  };

  const getLanguageName = (code: string) => {
    const language = commonLanguages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          className="px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent"
          onChange={(e) => handleAddLanguage(e.target.value)}
          value=""
          disabled={disabled}
        >
          <option value="">Select Language</option>
          {commonLanguages.map(lang => (
            <option key={lang.code} value={lang.code} className="text-black">
              {lang.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Custom language code"
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            className="w-40 text-black"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => {
              if (customLanguage) {
                handleAddLanguage(customLanguage);
                setCustomLanguage('');
              }
            }}
            className="px-3 py-2 text-sm text-[#E50914] hover:text-[#E50914]/80 disabled:opacity-50"
            disabled={disabled || !customLanguage}
          >
            + Add Custom
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(value).length === 0 ? (
          <p className="text-sm text-gray-500">No subtitles added yet</p>
        ) : (
          Object.entries(value).map(([lang, url]) => (
            <div key={lang} className="flex items-center gap-2">
              <span className="text-sm font-medium text-black min-w-[60px]">
                {getLanguageName(lang)}
              </span>
              <Input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(lang, e.target.value)}
                placeholder="Enter subtitle URL"
                className="flex-1 text-black"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => handleRemoveLanguage(lang)}
                className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 