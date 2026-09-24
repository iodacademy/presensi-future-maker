import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bootcamp Future Makers 2026',
    short_name: 'Future Makers 2026',
    description: 'Aplikasi Manajemen Bootcamp Future Makers 2026',
    start_url: '/login',
    display: 'standalone',
    background_color: '#f4f4f5',
    theme_color: '#0072ce',
  };
}
