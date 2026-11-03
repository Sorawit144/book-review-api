# Book Review API — Express + Prisma + SQLite

API ตามแบบฝึกหัดในรูป เลือกใช้ **Express เพียง framework เดียว** เขียนด้วย JavaScript ใช้ Prisma ORM และฐานข้อมูล SQLite ซึ่งเก็บข้อมูลลงไฟล์จริง

## เริ่มใช้งาน

ใช้ Node.js **22.12 ขึ้นไป** (แนะนำ Node.js 24) และ npm

1. แตก ZIP ลงในโฟลเดอร์ที่ต้องการ
2. เปิด Terminal หรือ PowerShell **ในโฟลเดอร์ที่มี `package.json`** ไฟล์นี้อยู่ชั้นแรกของ ZIP ไม่ต้องเข้าโฟลเดอร์ย่อยอีก
3. รันตามลำดับ:

```bash
npm install
npm run setup
npm start
```

`npm run setup` สร้าง `.env` จาก `.env.example` เมื่อยังไม่มีไฟล์ แล้วรัน `prisma db push` เพื่อสร้างตารางใน SQLite และสร้าง Prisma Client โดยไม่ลบข้อมูลเดิม คำสั่งตรงตามโจทย์คือ `npx prisma db push` ซึ่งใช้ได้หลังมี `.env` แล้ว

เปิด <http://localhost:3000/health> จะได้:

```json
{ "status": "ok" }
```

เมื่อเริ่มครั้งแรก ฐานข้อมูลไม่มีข้อมูลหนังสือ หากต้องการข้อมูลตัวอย่างให้เปิดอีก Terminal แล้วรัน:

```bash
npm run seed
```

เปิด <http://localhost:3000/books> เพื่อดูหนังสือพร้อมรีวิว ข้อมูลเก็บอยู่ใน `prisma/dev.db` และยังอยู่เมื่อปิดแล้วเปิดเซิร์ฟเวอร์ใหม่

## โครงสร้างข้อมูลตามรูป

| Entity | Field | Type / เงื่อนไข |
| --- | --- | --- |
| Book | id | Int, Primary Key, เพิ่มอัตโนมัติ |
| Book | title | String, ต้องระบุ |
| Book | author | String, ต้องระบุ |
| Book | publishedAt | DateTime, ค่าเริ่มต้น `now()` |
| Book | coverUrl | String หรือ null, ไม่บังคับ |
| Review | id | Int, Primary Key, เพิ่มอัตโนมัติ |
| Review | rating | Int, API รับเฉพาะ 1–5 |
| Review | content | String, ต้องระบุ |
| Review | bookId | Int, Foreign Key อ้างอิง `Book.id` |

หนังสือหนึ่งเล่มมีได้หลายรีวิว (`Book.reviews` / `Review.book`) เมื่อเพิ่มรีวิว API ใช้ `bookId` จาก URL จึงไม่ต้องส่ง `bookId` ใน JSON เมื่อหนังสือถูกลบ SQLite จะลบรีวิวที่ผูกกับหนังสือเล่มนั้นด้วย (`onDelete: Cascade`)

## Endpoints

Base URL: `http://localhost:3000`

| Method | Path | การทำงาน | สำเร็จ |
| --- | --- | --- | --- |
| GET | `/health` | ตรวจการเชื่อมต่อฐานข้อมูล | 200 |
| GET | `/books` | อ่านหนังสือทั้งหมด พร้อม `reviews` | 200 |
| GET | `/books/:bookId` | อ่านหนังสือหนึ่งเล่ม พร้อม `reviews` | 200 |
| POST | `/books` | เพิ่มหนังสือ | 201 |
| PUT | `/books/:bookId` | แก้ไขหนังสือ ต้องส่ง title และ author | 200 |
| PATCH | `/books/:bookId` | แก้ไขเฉพาะ field ที่ส่งมา | 200 |
| DELETE | `/books/:bookId` | ลบหนังสือและรีวิวของหนังสือนั้น | 204 |
| GET | `/books/:bookId/reviews` | อ่านรีวิวทั้งหมดของหนังสือ | 200 |
| POST | `/books/:bookId/reviews` | เพิ่มรีวิวให้หนังสือ | 201 |
| GET | `/books/:bookId/reviews/:reviewId` | อ่านรีวิวหนึ่งรายการ | 200 |
| PATCH | `/books/:bookId/reviews/:reviewId` | แก้ไขรีวิว | 200 |
| DELETE | `/books/:bookId/reviews/:reviewId` | ลบรีวิวหนึ่งรายการ | 204 |

ทุกคำขอที่มี JSON body ต้องตั้ง Header `Content-Type: application/json`

### 1. เพิ่มหนังสือ

`POST /books`

```json
{
  "title": "เรียนรู้ Express และ Prisma",
  "author": "สมชาย ใจดี"
}
```

ไม่ส่ง `publishedAt` จะใช้เวลาปัจจุบัน และไม่ส่ง `coverUrl` จะเป็น `null` ตัวอย่างกรณีส่งทุก field:

```json
{
  "title": "พื้นฐานการพัฒนา API",
  "author": "สมหญิง รักเรียน",
  "publishedAt": "2026-10-07T00:00:00.000Z",
  "coverUrl": "https://example.com/book-cover.jpg"
}
```

เซิร์ฟเวอร์ส่งกลับ HTTP 201 และข้อมูลหนังสือที่สร้าง ให้ใช้ `id` ที่ได้ใน URL ขั้นตอนถัดไป

### 2. เพิ่มรีวิวให้หนังสือ

ตัวอย่างเมื่อหนังสือมี `id = 1`: `POST /books/1/reviews`

```json
{
  "rating": 5,
  "content": "เนื้อหาเข้าใจง่าย มีตัวอย่างประกอบ"
}
```

ผลลัพธ์ HTTP 201 (เลข ID ขึ้นอยู่กับข้อมูลในฐานข้อมูล):

```json
{
  "id": 1,
  "rating": 5,
  "content": "เนื้อหาเข้าใจง่าย มีตัวอย่างประกอบ",
  "bookId": 1
}
```

### 3. อ่านหนังสือพร้อมรีวิวแบบ nested

`GET /books/1`

ตัวอย่างผลลัพธ์:

```json
{
  "id": 1,
  "title": "เรียนรู้ Express และ Prisma",
  "author": "สมชาย ใจดี",
  "publishedAt": "2026-10-07T00:00:00.000Z",
  "coverUrl": null,
  "reviews": [
    {
      "id": 1,
      "rating": 5,
      "content": "เนื้อหาเข้าใจง่าย มีตัวอย่างประกอบ",
      "bookId": 1
    }
  ]
}
```

`GET /books` คืนค่าเป็น array ของหนังสือ โดยแต่ละเล่มมี `reviews` ของตนเอง ถ้าไม่มีรีวิวจะเป็น `[]`

### 4. แก้ไขข้อมูล

`PATCH /books/1`

```json
{
  "title": "เรียนรู้ Express และ Prisma ฉบับปรับปรุง",
  "coverUrl": null
}
```

`PATCH /books/1/reviews/1`

```json
{
  "rating": 4,
  "content": "ปรับคะแนนหลังอ่านจบ"
}
```

สำหรับ `PUT /books/:bookId` ต้องส่ง `title` และ `author` ส่วน `publishedAt` และ `coverUrl` จะคงค่าเดิมถ้าไม่ได้ส่งมา ใช้ `coverUrl: null` เมื่อต้องการล้างค่าปก

## Validation และข้อผิดพลาด

- `title`, `author`, `content` ต้องเป็น string ที่ไม่ว่าง ระบบตัดช่องว่างหัวท้าย
- `rating` ต้องเป็นตัวเลขจำนวนเต็ม 1–5 เช่น `5` ใช้ได้ แต่ `"5"`, `0`, `6`, `2.5` ใช้ไม่ได้
- `publishedAt` ต้องเป็น ISO timestamp ที่มี timezone เช่น `2026-10-07T00:00:00.000Z` หรือ `2026-10-07T07:00:00+07:00`
- `coverUrl` รับ string หรือ `null` ตาม schema ในโจทย์
- ID ใน URL ต้องเป็นจำนวนเต็มบวก ไม่เกิน 2147483647
- ไม่รับ field นอกเหนือจากที่ระบุ เช่น `id` หรือ `bookId` ใน request body
- `PATCH` ต้องส่งอย่างน้อยหนึ่ง field
- อ่าน แก้ไข หรือลบรีวิวได้เฉพาะผ่านหนังสือที่รีวิวนั้นผูกอยู่

HTTP 400 หมายถึงข้อมูลไม่ถูกต้อง, HTTP 404 หมายถึงไม่พบข้อมูลหรือ endpoint, HTTP 413 หมายถึง body เกิน 100 KB และ HTTP 500 หมายถึงข้อผิดพลาดภายในระบบ

ตัวอย่างเมื่อคะแนนเกินช่วง:

```json
{
  "error": {
    "message": "rating must be an integer from 1 to 5."
  }
}
```

HTTP 204 จากการลบสำเร็จไม่มี response body

## ทดสอบด้วย Postman

1. รันเซิร์ฟเวอร์ตามขั้นตอนเริ่มใช้งาน
2. เปิด Postman แล้ว Import `postman/Book-Review-API.postman_collection.json`
3. เรียก `01 Create book` แล้ว `02 Add review` ตามลำดับ
4. เรียก `03 Get book with reviews` และ `04 List books with reviews`

Collection ตั้ง `baseUrl` เป็น `http://localhost:3000` และบันทึก `bookId` / `reviewId` จาก response อัตโนมัติ ไม่ต้องสมมติว่า ID เป็น 1 ถ้าต้องการใช้ Collection Runner ให้รันทั้งชุดตามลำดับ การลบข้อมูลอยู่ท้ายชุด

## Automated tests

```bash
npm test
```

Tests เรียก API ผ่าน HTTP และใช้ SQLite ชั่วคราวแยกจาก `prisma/dev.db` ครอบคลุม CRUD, ค่าเริ่มต้น, nested reviews, คะแนน 1–5, การผูกรีวิวกับหนังสือ, foreign key, cascade delete, persistence, validation และ JSON ที่ไม่ถูกต้อง หลังทดสอบจะลบฐานข้อมูลชั่วคราว

## คำสั่งเพิ่มเติม

```bash
npm run dev        # รันใหม่อัตโนมัติเมื่อแก้โค้ด
npm run generate   # สร้าง Prisma Client
npm run db:push    # นำ schema ไปใช้กับ SQLite ตามโจทย์
npm run db:studio  # เปิดหน้าดูฐานข้อมูลของ Prisma
```

หลังแก้ `prisma/schema.prisma` ให้รัน `npm run db:push` อีกครั้ง โครงการนี้ใช้ Prisma **6.19.0** และ Express **5.2.1** โดยล็อกเวอร์ชันไว้ใน `package-lock.json`

## ไฟล์สำคัญ

| Path | หน้าที่ |
| --- | --- |
| `package.json` | dependencies และคำสั่งรัน อยู่ชั้นแรกของ ZIP |
| `package-lock.json` | ล็อกเวอร์ชัน dependency |
| `.env.example` | ค่า DATABASE_URL และ PORT สำหรับ setup |
| `prisma/schema.prisma` | model Book / Review และความสัมพันธ์ 1 ต่อหลาย |
| `prisma/seed.js` | เพิ่มข้อมูลตัวอย่างแบบเลือกใช้ |
| `src/app.js` | สร้าง Express app และติดตั้ง routes / middleware |
| `src/server.js` | เชื่อมต่อฐานข้อมูลและเริ่มเซิร์ฟเวอร์ |
| `src/routes/books.js` | endpoints หนังสือและรีวิว |
| `src/validation.js` | ตรวจข้อมูล request |
| `src/errors.js` | จัดรูปแบบข้อผิดพลาด |
| `src/prisma.js` | Prisma Client |
| `src/config.js` | โหลดการตั้งค่าจาก .env |
| `scripts/setup.js` | สร้าง .env และรัน prisma db push |
| `test/api.test.js` | automated integration tests |
| `postman/Book-Review-API.postman_collection.json` | ตัวอย่างเรียก API และ assertions |

ZIP ไม่มี `node_modules`, `.env` หรือฐานข้อมูลจากการทดสอบ ผู้รับติดตั้ง dependencies ด้วย `npm install` แล้วสร้างฐานข้อมูลด้วย `npm run setup` ได้เอง

## เอกสารอ้างอิง

- Express: <https://expressjs.com/en/starter/installing/>
- Prisma ORM v6 — SQLite: <https://www.prisma.io/docs/orm/v6/overview/databases/sqlite>

## หากรันไม่สำเร็จ

- ถ้าเจอ `ENOENT ... package.json` ให้เปลี่ยน Terminal ไปยังโฟลเดอร์ที่มี `package.json` หลังแตก ZIP
- ถ้าเจอ `no such table: ...` ให้รัน `npm run setup` ก่อน `npm start`
- ถ้า port 3000 ถูกใช้อยู่ ให้เปลี่ยน `PORT` ใน `.env` แล้วปรับ `baseUrl` ใน Postman ตาม port ใหม่
- `npm install` ต้องใช้อินเทอร์เน็ตเพื่อดาวน์โหลด dependencies และ Prisma engines
