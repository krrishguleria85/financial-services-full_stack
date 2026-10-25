export type SocialPlatform = 'youtube' | 'instagram' | 'facebook' | 'snapchat' | 'moj';

export interface SocialConfig {
  key: string;
  platform: SocialPlatform;
  label: string;
  buttonText: string;
  placeholder: string;
  colorClasses: {
    badgeBg: string;
    text: string;
    border: string;
    hoverBg: string;
    iconColor: string;
  };
}

export const SOCIAL_PLATFORMS: SocialConfig[] = [
  {
    key: 'youtubeChannelUrl',
    platform: 'youtube',
    label: 'YouTube',
    buttonText: 'YouTube',
    placeholder: 'https://www.youtube.com/@rajeshguleria1973',
    colorClasses: {
      badgeBg: 'bg-red-600/10',
      text: 'text-red-400',
      border: 'border-red-500/40 hover:border-red-500',
      hoverBg: 'hover:bg-red-600/20',
      iconColor: 'text-red-500',
    },
  },
  {
    key: 'instagramUrl',
    platform: 'instagram',
    label: 'Instagram',
    buttonText: 'Instagram',
    placeholder: 'https://www.instagram.com/guleria2877',
    colorClasses: {
      badgeBg: 'bg-pink-600/10',
      text: 'text-pink-400',
      border: 'border-pink-500/40 hover:border-pink-500',
      hoverBg: 'hover:bg-pink-600/20',
      iconColor: 'text-pink-500',
    },
  },
  {
    key: 'facebookUrl',
    platform: 'facebook',
    label: 'Facebook',
    buttonText: 'Facebook',
    placeholder: 'https://www.facebook.com/yourpage',
    colorClasses: {
      badgeBg: 'bg-blue-600/10',
      text: 'text-blue-400',
      border: 'border-blue-500/40 hover:border-blue-500',
      hoverBg: 'hover:bg-blue-600/20',
      iconColor: 'text-blue-500',
    },
  },
  {
    key: 'snapchatUrl',
    platform: 'snapchat',
    label: 'Snapchat',
    buttonText: 'Snapchat',
    placeholder: 'https://www.snapchat.com/add/username',
    colorClasses: {
      badgeBg: 'bg-amber-400/10',
      text: 'text-amber-300',
      border: 'border-amber-400/40 hover:border-amber-400',
      hoverBg: 'hover:bg-amber-400/20',
      iconColor: 'text-amber-400',
    },
  },
  {
    key: 'mojUrl',
    platform: 'moj',
    label: 'Moj',
    buttonText: 'Moj',
    placeholder: 'https://mojapp.in/@username',
    colorClasses: {
      badgeBg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/40 hover:border-rose-500',
      hoverBg: 'hover:bg-rose-500/20',
      iconColor: 'text-rose-500',
    },
  },
];
