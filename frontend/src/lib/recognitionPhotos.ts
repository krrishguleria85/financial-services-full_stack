export interface RecognitionPhoto {
  id: string;
  src: string;
  title: string;
  subtitle: string;
  alt: string;
}

export type RecognitionPhotoKey = 'milestone' | 'recognition' | 'trophy' | 'anniversary70';

export const RECOGNITION_PHOTOS: Record<RecognitionPhotoKey, RecognitionPhoto> = {
  milestone: {
    id: 'lic-milestone',
    src: '/images/lic-milestone.jpg',
    title: 'A Proud LIC Milestone',
    subtitle: 'Chandigarh',
    alt: 'A Proud LIC Milestone - Trophy recognition ceremony at Chandigarh',
  },
  recognition: {
    id: 'lic-recognition',
    src: '/images/lic-presentation.jpg',
    title: 'LIC Recognition',
    subtitle: 'Chandigarh',
    alt: 'LIC Recognition ceremony presentation with bouquet at Chandigarh',
  },
  trophy: {
    id: 'lic-trophy',
    src: '/images/trophy-cutout.png',
    title: 'LIC ZM’s Trophy 2026',
    subtitle: 'North Zone',
    alt: 'LIC ZM’s Trophy 2026 - North Zone',
  },
  anniversary70: {
    id: 'lic-70-years',
    src: '/images/lic-70-years.png',
    title: 'LIC 70 Years',
    subtitle: 'Our Journey, Your Trust',
    alt: 'LIC 70 Years - Our Journey, Your Trust',
  },
};
