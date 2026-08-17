# Telegram Mafia Bot

Node.js + Telegraf + MongoDB.

## 1. Local
```bash
npm install
cp .env.example .env
npm start
```

## 2. Render
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `BOT_TOKEN`, `MONGO_URI`, `DB_NAME`, `OWNER_ID`, `PORT`
- MongoDB Atlas kerak, chunki Render fayl tizimi restart/deploydan keyin doimiy DB sifatida ishlatilmasligi mumkin.

## 3. Telegram bot huquqlari
Botni guruhga admin qilib:
- Delete messages
- Pin messages (xohlasangiz)
- Manage chat (kerak bo'lsa)
huquqlarini bering.

## Asosiy komandalar
Guruh:
`/game`, `/start`, `/stop`, `/kik USER_ID`, `/vaqt 120`, `/top`, `/settings`

Private:
`/start`, `/til`, `/profile`

Owner:
`/give USER_ID 100`
`/givedo USER_ID 100`

## Muhim
Bu loyiha asosiy game engine, alohida group game ID, registration, roles, night/day/vote timer, private role actions, inventory, economy va MongoDB persistence bilan tayyorlangan starter/full base hisoblanadi.
Telegram token, MongoDB ulanishi va real guruhda permissionlar berilgandan keyin test qilish kerak.
