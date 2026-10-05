const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateVideos() {
  const videos = await prisma.youTubeVideo.findMany({ orderBy: { sortOrder: 'asc' } });
  
  const replacements = [
    { id: 'ZKcCmWeW7sI', url: 'https://www.youtube.com/watch?v=ZKcCmWeW7sI' }, // ITR
    { id: 'zfgXNZxoq58', url: 'https://www.youtube.com/watch?v=zfgXNZxoq58' }, // GST
    { id: 'I_tBLiowbrw', url: 'https://www.youtube.com/watch?v=I_tBLiowbrw' }  // Tax Saving
  ];
  
  for (let i = 0; i < videos.length; i++) {
    const rep = replacements[i % replacements.length];
    await prisma.youTubeVideo.update({
      where: { id: videos[i].id },
      data: {
        videoId: rep.id,
        videoUrl: rep.url,
        thumbnailUrl: `https://img.youtube.com/vi/${rep.id}/mqdefault.jpg`
      }
    });
  }
  console.log('Videos updated successfully with real links');
}

updateVideos().catch(console.error).finally(() => prisma.$disconnect());
