import { useState } from 'react';
import { Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
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
    onChange({
      ...value,
      [languageCode]: ''
    });
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

  const getFlag = (code: string) => {
    const language = commonLanguages.find(lang => lang.code === code);
    return language ? language.flag : '🏳️';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {commonLanguages.map(lang => (
          <Button
            key={lang.code}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddLanguage(lang.code)}
            disabled={disabled || !!value[lang.code]}
            className="text-sm bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 flex items-center gap-1"
            title={lang.name}
          >
            <span>{lang.flag}</span> {lang.name}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <Input
          type="text"
          placeholder="Custom language code (e.g., 'ar' for Arabic)"
          value={customLanguage}
          onChange={(e) => setCustomLanguage(e.target.value.toLowerCase())}
          disabled={disabled}
          className="flex-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (customLanguage) {
              handleAddLanguage(customLanguage);
              setCustomLanguage('');
            }
          }}
          disabled={disabled || !customLanguage}
          className="text-sm bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200"
          title={customLanguage ? `Add ${customLanguage}` : ''}
        >
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="border-t pt-4 mt-2">
        <div className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>Added Subtitles</span>
        </div>
        {Object.keys(value).length === 0 && (
          <div className="text-gray-400 text-sm italic">No subtitles added yet. Select a language above to add.</div>
        )}
        <div className="space-y-3">
          {Object.entries(value).map(([code, url]) => {
            const isCommon = !!commonLanguages.find(l => l.code === code);
            const valid = isValidUrl(url);
            return (
              <div key={code} className={`flex gap-2 items-center rounded-lg p-2 ${valid ? 'bg-green-50' : url ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" title={getLanguageName(code)}>{isCommon ? getFlag(code) : '🏳️'}</span>
                    <span className="text-sm font-medium text-gray-700" title={isCommon ? '' : getLanguageName(code)}>{getLanguageName(code)}</span>
                    <span className="text-xs text-gray-500">({code})</span>
                    {valid && <CheckCircle size={16} className="text-green-500 ml-1" title="Valid URL" />}
                    {!valid && url && <AlertCircle size={16} className="text-red-500 ml-1" title="Invalid URL" />}
                  </div>
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(code, e.target.value)}
                    placeholder="Enter subtitle URL"
                    disabled={disabled}
                    className={`mt-1 bg-white/80 backdrop-blur-sm border-gray-200 focus:border-red-500 focus:ring-red-500/20 transition-all duration-200 ${!valid && url ? 'border-red-400' : ''}`}
                  />
                  {!valid && url && (
                    <div className="text-xs text-red-500 mt-1">Please enter a valid URL (http:// or https://)</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveLanguage(code)}
                  disabled={disabled}
                  className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                  title={`Remove ${getLanguageName(code)}`}
                >
                  <X size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 
