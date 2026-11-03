const prisma = require('../src/prisma');

async function main() {
  // Optional sample data. Re-running does not duplicate the two sample books.
  for (const item of [
    {
      title: 'เรียนรู้ Express และ Prisma', author: 'สมชาย ใจดี',
      rating: 5, content: 'อธิบายเข้าใจง่าย เหมาะสำหรับผู้เริ่มต้น',
    },
    {
      title: 'พื้นฐานการพัฒนา API', author: 'สมหญิง รักเรียน',
      rating: 4, content: 'มีตัวอย่างการใช้งานที่นำไปฝึกต่อได้',
    },
  ]) {
    const exists = await prisma.book.findFirst({ where: { title: item.title, author: item.author } });
    if (!exists) {
      await prisma.book.create({
        data: {
          title: item.title, author: item.author,
          reviews: { create: { rating: item.rating, content: item.content } },
        },
      });
    }
  }
  console.log('Sample books and reviews are ready.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
