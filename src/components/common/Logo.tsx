import { Film } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const Logo = ({ size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  return (
    <div className="flex items-center">
      <img
        src="https://vyquhrtfwgwmndvhffjr.supabase.co/storage/v1/object/public/movies//cinewave_logo_light.png"
        alt="CineWave"
        className={sizeClasses[size]}
      />
    </div>
  );
};

export default Logo;