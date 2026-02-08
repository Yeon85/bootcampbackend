const serverless = require('serverless-http'); // (사용 안 하면 삭제 가능)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');                 // ✅ 추가
const { Server } = require('socket.io');      // ✅ 추가

const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const uploadFolder = 'uploads';

// -------------------------
// uploads 폴더 생성
// -------------------------
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// -------------------------
// CORS
// -------------------------
const allowedOrigins = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:4174',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5176',
  'https://jinjoobootcamp-f3fq.vercel.app',
  'https://jinjoobootcamp-gomp.vercel.app',
  'https://jinjoobootcamp-trfz.vercel.app',
  'https://snack-chi.vercel.app',

];

const corsOptions = {
  origin: function (origin, callback) {
    
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());

// -------------------------
// multer
// -------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = Date.now() + ext;
    cb(null, filename);
  }
});

const upload = multer({ storage });
app.use('/uploads', express.static('uploads'));

// -------------------------
// DB
// -------------------------
const db = mysql.createConnection({
  host: 'nozomi.proxy.rlwy.net',
  port: 10904,
  user: 'root',
  password: 'ZiDACevkGUVbIwdUZtwVswdRLkmNALAn',
  database: 'railway'
});

db.connect();

// =====================================================
// ✅ Socket.IO 세팅
// =====================================================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// contactId 기준 room join
io.on('connection', (socket) => {
  console.log('[socket] connected:', socket.id);

  socket.on('joinRoom', ({ contactId }) => {
    if (!contactId) return;
    socket.join(String(contactId));
    // console.log(`[socket] joinRoom contactId=${contactId}`);
  });

  socket.on('leaveRoom', ({ contactId }) => {
    if (!contactId) return;
    socket.leave(String(contactId));
  });

  // ✅ 클라이언트가 socket으로 메시지 보내면 -> DB 저장 -> broadcast
  socket.on('sendMessage', (payload) => {
    try {
      const { contactId, fromUserId, toUserId, text } = payload || {};
      if (!contactId || !fromUserId || !toUserId || !text) return;

      const sql = `
        INSERT INTO messages (contact_id, from_user_id, to_user_id, text, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `;

      db.query(sql, [contactId, fromUserId, toUserId, text], (err, result) => {
        if (err) {
          console.error('[socket] 메시지 저장 실패:', err);
          socket.emit('errorMessage', { message: 'DB 저장 실패' });
          return;
        }

        const savedMsg = {
          contactId: Number(contactId),
          fromUserId: Number(fromUserId),
          toUserId: Number(toUserId),
          text: String(text),
          time: new Date().toISOString(), // 프론트는 time 필드 쓰므로 맞춰줌
        };

        // ✅ 해당 방 전체에 새 메시지 push
        io.to(String(contactId)).emit('newMessage', savedMsg);
      });
    } catch (e) {
      console.error('[socket] sendMessage error:', e);
      socket.emit('errorMessage', { message: '서버 처리 실패' });
    }
  });

  socket.on('disconnect', () => {
    console.log('[socket] disconnected:', socket.id);
  });
});

// =====================================================
// ✅ 기존 REST API들
// =====================================================

// ✅ (중요) REST로 메시지 저장하는 API도 유지하되,
// 저장 후 io로 broadcast 해주면 axios로 보내도 실시간 반영됨
app.post('/api/messages', (req, res) => {
  const { contactId, fromUserId, toUserId, text } = req.body;

  const sql = `
    INSERT INTO messages (contact_id, from_user_id, to_user_id, text, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;

  db.query(sql, [contactId, fromUserId, toUserId, text], (err, result) => {
    if (err) {
      console.error('메시지 저장 실패:', err);
      return res.status(500).json({ success: false, message: 'DB 저장 실패' });
    }

    // ✅ 저장 성공하면 방에 실시간 push
    const savedMsg = {
      contactId: Number(contactId),
      fromUserId: Number(fromUserId),
      toUserId: Number(toUserId),
      text: String(text),
      time: new Date().toISOString(),
    };
    io.to(String(contactId)).emit('newMessage', savedMsg);

    res.status(200).json({ success: true, message: '메시지 저장 완료' });
  });
});


// 🔥친구리스트 정보 가져오기 API (contacts + messages)
app.get('/api/contacts/:nameId', (req, res) => {
  const nameId = req.params.nameId;

  console.log("nameId:"+nameId);
  // contacts 쿼리 (마지막 메시지 join)
  const contactsSql = `

  SELECT
    c.id AS contactId,
    ? AS nameId,  -- 내 아이디는 그냥 파라미터로 고정
    CASE 
      WHEN c.my_user_id = ? THEN c.target_user_id
      ELSE c.my_user_id
    END AS targetUserId,
    u.name AS name,
    u.profile_image AS path,      
    c.active,
    c.time AS lastSeenTime,
    c.preview AS lastPreview,
    m.text AS lastMessage,
    m.created_at AS lastMessageTime
  FROM contacts c
  JOIN users u 
    ON u.name_id = CASE 
      WHEN c.my_user_id = ? THEN c.target_user_id
      ELSE c.my_user_id
    END
  LEFT JOIN (
    SELECT contact_id, text, created_at
    FROM messages
    WHERE id IN (SELECT MAX(id) FROM messages GROUP BY contact_id)
  ) m ON c.id = m.contact_id
  WHERE c.my_user_id = ? OR c.target_user_id = ?
  ORDER BY c.id ASC
  `;

  console.log("contactsSql:"+contactsSql);

  // messages 쿼리 (내가 속한 모든 contact의 메시지들)  

  const messagesSql = `
    SELECT
      contact_id as contactId,
      from_user_id as fromUserId,
      to_user_id as toUserId,
      text,
      created_at
    FROM messages
    WHERE contact_id IN (
      SELECT id FROM contacts WHERE my_user_id = ? OR target_user_id = ?
    )
    ORDER BY created_at ASC
  `;
  console.log("messagesSql:"+messagesSql);

  // ✅ contacts 먼저 조회  
  db.query(contactsSql, [nameId, nameId, nameId, nameId, nameId], (err, contactsResult) => {
    if (err) {
      console.error('DB 에러:', err);
      return res.status(500).send('서버 오류');
    }

    db.query(messagesSql, [nameId, nameId], (err2, messagesResult) => {
      if (err2) {
        console.error('DB 에러 (messages):', err2);
        return res.status(500).send('서버 오류');
      }

      if (!contactsResult || contactsResult.length === 0) {
        return res.status(488).send('유저를 찾을 수 없습니다.');
      }

      // ✅ contacts + messages 매칭
      const contactsWithMessages = contactsResult.map((contact) => {
        const contactMessages = messagesResult
          .filter((msg) => msg.contactId === contact.contactId)
          .map((msg) => ({
            contactId: msg.contactId,
            fromUserId: msg.fromUserId,
            toUserId: msg.toUserId,
            text: msg.text,
            time: msg.created_at,
          }));

        // ✅ 상대방 userId 계산 (내가  상대는 targetUserId, 반대면 )
        console.log("nameId:"+nameId);
        console.log("[여기]contactId:"+contact.contactId);
        console.log("[여기]contact.targetUserId:"+contact.targetUserId);    

        console.log("contact:"+JSON.stringify(contact));
        return {
          contactId: contact.contactId,   // ✅ 프론트에서 꼭 필요 (room id)
          nameId: contact.nameId,            // ✅ 내아이디 
          targetUserId: contact.targetUserId,  // ✅ 상대방 아이디
          name: contact.name,
          path: contact.path,
          active: contact.active,
          time: contact.lastSeenTime,
          preview: contact.lastPreview,
          messages: contactMessages,
        };
      });

      res.send({
        message: '유저 정보 조회 성공',
        contacts: contactsWithMessages,
      });
    });
  });
});

// ✅ 연락처(친구) 추가 API
app.post("/api/contacts", (req, res) => {
  const { nameId, targetUserId, name } = req.body;

  console.log("nameId:"+nameId);
  console.log("targetUserId:"+targetUserId);    
  console.log("name:"+name);    

  if (!nameId ) {
    return res.status(400).json({ success: false, message: "필수값 누락" });
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error("트랜잭션 시작 실패:", err);
      return res.status(500).json({ success: false, message: "트랜잭션 시작 실패" });
    }

    // 1) ✅ target 유저 프로필 이미지 조회
    db.query(
      `SELECT profile_image, name AS targetName
       FROM users
       WHERE name_id = ?`,
      [targetUserId],
      (err0, rows) => {


        console.log("rows:"+rows);
        console.log("rows.length:"+rows.length);
  
    if (rows.length === 0) {
          return db.rollback(() =>
            res.status(404).json({ success: false, message: "상대 유저가 없습니다." })
          );
        }

        if (err0) {
          console.error("users select 실패:", err0);
          return db.rollback(() =>
            res.status(500).json({ success: false, message: "유저 조회 실패" })
          );
        }

        const targetProfileImage = rows[0].profile_image || "/upload/user-profile.png";
        const contactName = name || rows[0].targetName || String(targetUserId); // name 없으면 targetName 사용

        // 2) contacts insert (✅ 조회한 profile_image를 path에)
        db.query(
          `INSERT INTO contacts (my_user_id, target_user_id, name, time, path)
           VALUES (?, ?, ?, NOW(), ?)`,
          [nameId, targetUserId, contactName, targetProfileImage],
          (err1, result) => {

            console.log("err1:"+err1);
            console.log("result:"+result);



             if ( result === undefined) {
              return db.rollback(() =>
                res.status(404).json({ success: false, message: "이미연락처에 추가되어있습니다." })
              );
            }


            if (err1) {
              console.error("contacts insert 실패:", err1);
              return db.rollback(() =>
                res.status(500).json({ success: false, message: "연락처 추가 실패" })
              );
            }

            const contactId = result.insertId;

            // 3) messages insert
            db.query(
              `INSERT INTO messages (contact_id, from_user_id, to_user_id, text, created_at)
               VALUES (?, ?, ?, ?, NOW())`,
              [contactId, nameId, targetUserId, "친구를 추가하였습니다."],
              (err2) => {
                if (err2) {
                  console.error("messages insert 실패:", err2);
                  return db.rollback(() =>
                    res.status(500).json({ success: false, message: "연락처 메시지 저장 실패" })
                  );
                }

                db.commit((err3) => {
                  if (err3) {
                    console.error("commit 실패:", err3);
                    return db.rollback(() =>
                      res.status(500).json({ success: false, message: "DB 커밋 실패" })
                    );
                  }

                  return res.json({
                    success: true,
                    message: "연락처 추가 성공",
                    contactId,
                    path: targetProfileImage,
                    name: contactName,
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});


// ✅ 연락처 삭제 API
app.delete('/api/contacts/:nameId', (req, res) => {

  const { contactId} = req.body;

  console.log("contactId:"+contactId);    

  if (!contactId) {
    return res.status(400).json({ success: false, message: 'contactId 필요' });
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error('트랜잭션 시작 실패:', err);
      return res.status(500).json({ success: false, message: '트랜잭션 오류' });
    }

    // 1️⃣ messages 삭제
    db.query(
      'DELETE FROM messages WHERE contact_id = ?',
      [contactId],
      (err1) => {
        if (err1) {
          console.error('messages 삭제 실패:', err1);
          return db.rollback(() =>
            res.status(500).json({ success: false, message: '메시지 삭제 실패' })
          );
        }

        // 2️⃣ contacts 삭제
        db.query(
          'DELETE FROM contacts WHERE id = ?',
          [contactId],
          (err2) => {
            if (err2) {
              console.error('contacts 삭제 실패:', err2);
              return db.rollback(() =>
                res.status(500).json({ success: false, message: '연락처 삭제 실패' })
              );
            }

            db.commit((err3) => {
              if (err3) {
                console.error('commit 실패:', err3);
                return db.rollback(() =>
                  res.status(500).json({ success: false, message: '커밋 실패' })
                );
              }

              res.json({ success: true, message: '연락처 삭제 완료' });
            });
          }
        );
      }
    );
  });
});


// 🔥 유저 정보 가져오기 API
app.get('/api/user/:name_id', (req, res) => {
  const nameId = req.params.name_id;
  const sql = 'SELECT * FROM users WHERE id = ?';

  db.query(sql, [nameId], (err, result) => {
    if (err) return res.status(500).send('서버 오류');
    if (result.length === 0) return res.status(404).send('유저를 찾을 수 없습니다.');

    const user = result[0];
    delete user.password;

    res.send({ message: '유저 정보 조회 성공', user });
  });
});

// ✅ 사용자 정보 업데이트 API (그대로 유지)
app.put('/api/user', (req, res) => {
  const { id, name, job_title, birthday, location, phone, twitter_url, dribbble_url, github_url } = req.body;

  const sql = `
    UPDATE users
    SET 
      name = ?,
      job_title = ?,
      birthday = ?,
      location = ?,
      phone = ?,
      twitter_url = ?,
      dribbble_url = ?,
      github_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const values = [name, job_title, birthday, location, phone, twitter_url, dribbble_url, github_url, id];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send('서버 오류');
    res.send({ message: '유저 정보 업데이트 성공' });
  });
});

// 🔥 사용자 정보 업데이트 API (그대로 유지)
app.put('/api/user/update', (req, res) => {
  const {
    id, name, job_title, birthday, location, phone, email,
    twitter_url, dribbble_url, github_url, profile_image
  } = req.body;

  const sql = `
    UPDATE users SET
      name = ?, 
      job_title = ?, 
      birthday = ?, 
      location = ?, 
      phone = ?, 
      email = ?, 
      twitter_url = ?, 
      dribbble_url = ?, 
      github_url = ?, 
      profile_image = ?
    WHERE id = ?
  `;

  const params = [
    name, job_title, birthday, location, phone, email,
    twitter_url, dribbble_url, github_url, profile_image, id
  ];

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).send('회원정보 수정 실패');
    res.send('회원정보 수정 성공!');
  });
});

// 🔥 프로필 사진 업로드
app.post('/api/upload-profile', upload.single('profile'), (req, res) => {
  try {
    const filePath = '/' + req.file.path.replace(/\\/g, '/');
    const nameId = req.body.nameId;

    if (!nameId) return res.status(400).send('ID가 필요합니다.');

    const sql = 'UPDATE users SET profile_image = ? WHERE name_id = ?';
    db.query(sql, [filePath, nameId], (err, result) => {
      if (err) return res.status(500).send('DB 업데이트 실패');
      res.send({ filePath });
    });

    //여기  'UPDATE users SET profile_image = ? WHERE name_id = ?'; 

  } catch (error) {
    console.error(error);
    res.status(500).send('파일 업로드 실패');
  }
});

// ✅ 회원가입
app.post('/api/register', async (req, res) => {
  const { nameId, name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  const sql = 'INSERT INTO users (name_id, name, email, password, profile_image) VALUES (?, ?, ?, ?,"/uploads/user-profile.jpg")';
  db.query(sql, [nameId, name, email, hashed], (err, result) => {
    if (err) return res.status(500).send("이미 가입된 이메일입니다.");

    const findUserSql = 'SELECT * FROM users WHERE email = ?';
    db.query(findUserSql, [email], (err2, userResult) => {
      if (err2 || userResult.length === 0) return res.status(500).send("회원가입 후 사용자 정보를 가져오는 데 실패했습니다.");

      const user = userResult[0];
      res.send({
        message: '회원가입 성공!',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          user_extra: user.user_extra,
          profileImage: user.profile_image,
          role_code: user.role_code,
          job_title: user.job_title,
          user_code: user.user_code,
        }
      });
    });
  });
});

// ✅ 로그인
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE name_id = ?';
  db.query(sql, [email], async (err, result) => {
    if (err) return res.status(500).send('서버 오류 발생');
    if (result.length === 0) return res.status(401).send('아이디가 존재하지 않습니다.');

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send('비밀번호가 일치하지 않습니다.');

    console.log("sql:"+sql);  
    console.log("user.password:"+user.password);
    res.send({
      message: '로그인 성공!',
      user: {
        id: user.id,
        name: user.name,
        nameId: user.name_id,
        password:user.password,
        email: user.email,
        user_extra: user.user_extra,
        profileImage: user.profile_image,
        job_title: user.job_title,
        birthday: user.birthday,
        location: user.location,
        role_code: user.role_code,
      },
    });
  });
});

// --------------------------------------------------
// 나머지 calendar / notes / survey / todos / category
// --------------------------------------------------
// ✅ 아래는 너가 준 코드 그대로 둬도 되고,
// 필요하면 내가 “socket 붙이는 부분만” 따로 더 정리해줄게.
// (여기서부터는 변경 없이 기존 코드 유지해도 됨)
// --------------------------------------------------


// =========================
// ✅ 서버 시작 (Railway)
// =========================
const PORT = process.env.PORT || 5000;

// app.listen이 아니라 ✅ server.listen 으로 바꿈 (socket.io 때문에)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ✅ 만약 serverless 배포면 아래처럼 handler export가 필요함(지금 Railway면 필요 없음)
// module.exports.handler = serverless(app);
