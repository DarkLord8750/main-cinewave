import { useState } from 'react';
import { Plus, X} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface SubtitleManagerProps {
  value: { [key: string]: string };
  onChange: (value: { [key: string]: string }) => void;
  disabled?: boolean;
}

const commonLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

function isValidUrl(url: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export const SubtitleManager = ({ value, onChange, disabled = false }: SubtitleManagerProps) => {
  const [customLanguage, setCustomLanguage] = useState('');
  const [urlErrors, setUrlErrors] = useState<{ [key: string]: boolean }>({});

  const handleAddLanguage = (languageCode: string) => {
    if (!languageCode) return;
    if (value[languageCode]) return;
    
    // Create a new value object with the new language
    const newValue = {
      ...value,
      [languageCode]: ''
    };
    
    // Call onChange with the new value
    onChange(newValue);
  };

  const handleRemoveLanguage = (languageCode: string) => {
    const newValue = { ...value };
    delete newValue[languageCode];
    onChange(newValue);
    setUrlErrors((prev) => {
      const copy = { ...prev };
      delete copy[languageCode];
      return copy;
    });
  };

  const handleUrlChange = (languageCode: string, url: string) => {
    if (url && !isValidUrl(url)) {
      setUrlErrors((prev) => ({ ...prev, [languageCode]: true }));
    } else {
      setUrlErrors((prev) => ({ ...prev, [languageCode]: false }));
    }
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
      {/* Common Languages */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Common Languages</label>
        <div className="flex flex-wrap gap-2">
          {commonLanguages.map((lang) => (
            <Button
              key={lang.code}
              type="button"
              variant="outline"
              size="default"
              onClick={() => handleAddLanguage(lang.code)}
              disabled={disabled || Boolean(value[lang.code])}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all duration-200 ${
                value[lang.code]
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="text-gray-900">{lang.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Language */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900">Custom Language</label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            placeholder="Enter language code (e.g., fr, de, it)"
            disabled={disabled}
            className="flex-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow"
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => {
              handleAddLanguage(customLanguage);
              setCustomLanguage('');
            }}
            disabled={disabled || !customLanguage}
            className="text-gray-900 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm hover:shadow"
          >
            <Plus size={14} className="text-gray-900" />
            Add
          </Button>
        </div>
      </div>

      {/* Added Subtitles */}
      {Object.keys(value).length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Added Subtitles</label>
          <div className="space-y-2">
            {Object.entries(value).map(([code, url]) => (
              <div key={code} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 font-medium">{getLanguageName(code)}</span>
                    <span className="text-gray-500 text-sm">({code})</span>
                  </div>
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(code, e.target.value)}
                    placeholder="Enter subtitle URL"
                    disabled={disabled}
                    className={`mt-1 w-full bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 shadow-sm hover:shadow ${
                      urlErrors[code] ? 'border-red-500' : ''
                    }`}
                  />
                  {urlErrors[code] && (
                    <p className="text-red-500 text-sm mt-1">Invalid URL format</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => handleRemoveLanguage(code)}
                  disabled={disabled}
                  className="text-gray-900 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm hover:shadow"
                >
                  <X size={14} className="text-gray-900" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 
