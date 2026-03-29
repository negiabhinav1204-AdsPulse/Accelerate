// Platform brand colors, status colors, delta colors — from spec §12
export const platformColors = {
  google:   { primary: '#4285F4', light: '#E8F0FE' },
  meta:     { primary: '#1877F2', light: '#E7F3FF' },
  bing:     { primary: '#00809D', light: '#E0F4F7' },
  tiktok:   { primary: '#000000', light: '#F0F0F0' },
  linkedin: { primary: '#0A66C2', light: '#E8F4FD' },
  reddit:   { primary: '#FF4500', light: '#FFF0EB' },
  amazon:   { primary: '#FF9900', light: '#FFF4E5' },
} as const;

export const statusColors = {
  active:   { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  paused:   { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  draft:    { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  ended:    { bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-300'   },
  error:    { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500'    },
} as const;

export const deltaColors = {
  up:      'text-green-600',
  down:    'text-red-600',
  neutral: 'text-gray-500',
} as const;
