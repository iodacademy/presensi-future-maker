import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Future Innovators Bootcamp',
    short_name: 'Future Innovators',
    description: 'Aplikasi Manajemen Future Innovators Bootcamp',
    start_url: '/login',
    display: 'standalone',
    background_color: '#f4f4f5',
    theme_color: '#0072ce',
  };
}
