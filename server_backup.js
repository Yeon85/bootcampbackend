const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'reactui_user',
  password: '1234',
  database: 'reactui_db',
});

db.connect();


// 회원가입
app.post('/api/register', async (req, res) => {
    console.log("회원가입");
  const { userId,name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  console.log(hashed,":hashed");
  const sql = 'INSERT INTO users (name_id, name, email, password) VALUES (?, ?, ?, ?)';
  db.query(sql, [userId,name, email, hashed], (err, result) => {
    if (err) return res.status(500).send("이미 가입된 이메일입니다.");
    res.send("회원가입 성공!");
  });
});


app.post('/api/login', async (req, res) => {
  console.log("req.body:", req.body);
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, result) => {
      if (err) {
          res.status(500).send('서버 오류 발생');
          return;
      }

      if (result.length === 0) {
          res.status(401).send('이메일이 존재하지 않습니다');
          return;
      }

      const user = result[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
          res.status(401).send('비밀번호가 일치하지 않습니다');
          return;
      }

      // 로그인 성공
      res.send({
          message: '로그인 성공!',
          user: {
              id: user.id,             // ✅ 추가
              name: user.name,
              email: user.email,
              user_extra: user.user_extra,
          },
      });
  });
});


app.get('/api/calendar', (req, res) => {
  const sql = 'SELECT * FROM calendar ORDER BY start ASC';
  db.query(sql, (err, result) => {
      if (err) return res.status(500).send('DB 조회 실패');
      res.send(result);
  });
});

// app.post('/api/calendar', (req, res) => {
//   const { title, start, end, className, description } = req.body;
//   const sql = 'INSERT INTO calendar_events (title, start, end, category, description) VALUES (?, ?, ?, ?, ?)';
//   db.query(sql, [title, start, end, className, description], (err, result) => {
//       if (err) return res.status(500).send('DB 저장 실패');
//       res.send({ success: true, id: result.insertId });
//   });
// });

app.post('/api/calendar', async (req, res) => {
  const { title, start, end, className, description } = req.body;

  const sql = 'INSERT INTO calendar (title, start, end, className, description) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [title, start, end, className, description], (err, result) => {
    if (err) {
      console.error('DB 저장 실패:', err);
      return res.status(500).send('DB 저장 실패');
    }
    res.status(201).json({ id: result.insertId });
  });
});


app.delete('/api/calendar/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM calendar WHERE id = ?', [id], (err, result) => {
      if (err) return res.status(500).send('삭제 실패');
      res.send('삭제 완료');
  });
});


app.get('/api/notes', (req, res) => {
  const sql = `
      SELECT n.*, u.name AS author, u.avatar
      FROM notes n
      JOIN users u ON n.user_id = u.id
      ORDER BY n.created_at DESC
  `;
  db.query(sql, (err, result) => {
      if (err) return res.status(500).send('노트 불러오기 실패');
      res.json(result);
  });
});

// ✅ 노트 추가
app.post('/api/notes', (req, res) => {
  const { name_id, title, content, tag, is_favorite } = req.body;
  const sql = `
      INSERT INTO notes (name_id, title, content, tag, is_favorite)
      VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [name_id, title, content, tag, is_favorite], (err, result) => {
      if (err) return res.status(500).send('노트 저장 실패');
      res.json({ id: result.insertId });
  });
});

// ✅ 노트 수정
app.put('/api/notes/:id', (req, res) => {
  const { title, content, tag, is_favorite } = req.body;
  const sql = `
      UPDATE notes
      SET title = ?, content = ?, tag = ?, is_favorite = ?
      WHERE id = ?
  `;
  db.query(sql, [title, content, tag, is_favorite, req.params.id], (err) => {
      if (err) return res.status(500).send('노트 수정 실패');
      res.send('수정 완료');
  });
});

// ✅ 노트 삭제
app.delete('/api/notes/:id', (req, res) => {
  const sql = `DELETE FROM notes WHERE id = ?`;
  db.query(sql, [req.params.id], (err) => {
      if (err) return res.status(500).send('노트 삭제 실패');
      res.send('삭제 완료');
  });
});


/*--------------------------------------------------
설문지시작
----------------------------------------------------*/

// app.post('/api/survey', async (req, res) => {
//   const {
//       name_id,
//       name,
//       phone,
//       call_name,
//       experience,
//       skills,
//       computer_skill,
//       goal,
//       interest,
//       study_style,
//       question_attitude,
//       one_word,
//       hope
//   } = req.body;
//   console.log('폼 데이터:', req.body);

//   const sql = `
//       INSERT INTO user_survey (name_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//   `;
//   db.query(sql, [name_id, name ,phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope], (err, result) => {
//       if (err) {
//         console.error('DB 에러:', err); // 추가!
//         return res.status(500).send('설문 저장 실패');
//       }
//       res.send({ message: '설문 저장 성공!' });
//   });
// });

app.post('/api/survey', async (req, res) => {
  const {
    user_id,
    name,
    phone,
    call_name,
    experience,
    skills,
    computer_skill,
    goal,
    interest,
    study_style,
    question_attitude,
    one_word,
    hope
  } = req.body;

  console.log('폼 데이터:', req.body);

  const sqlInsertSurvey = `
    INSERT INTO user_survey (user_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const sqlUpdateUserExtra = `
    UPDATE users SET user_extra = 0 WHERE id = ?
  `;

  db.beginTransaction((err) => {
    if (err) {
      console.error('트랜잭션 시작 에러:', err);
      return res.status(500).send('트랜잭션 시작 실패');
    }

    // 1. 설문지 저장
    db.query(sqlInsertSurvey, [user_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope], (err, result) => {
      if (err) {
        console.error('설문 저장 에러:', err);
        return db.rollback(() => {
          res.status(500).send('설문 저장 실패');
        });
      }

      // 2. user_extra 업데이트
      db.query(sqlUpdateUserExtra, [user_id], (err, result2) => {
        if (err) {
          console.error('user_extra 업데이트 에러:', err);
          return db.rollback(() => {
            res.status(500).send('user_extra 업데이트 실패');
          });
        }

        // 3. 모두 성공하면 커밋
        db.commit((err) => {
          if (err) {
            console.error('커밋 에러:', err);
            return db.rollback(() => {
              res.status(500).send('DB 커밋 실패');
            });
          }

          res.send({ message: '설문과 user_extra 저장 성공!' });
        });
      });
    });
  });
});


// 설문 리스트 조회 라우터
app.get('/api/surveys', (req, res) => {
  console.log("req.body:", req.body);
  const userId = req.query.user_id; // 🔥 쿼리스트링에서 user_id를 받아옴
  if (!userId) {
    return res.status(400).send('user_id가 필요합니다.');
  }

  const sql = 'SELECT * FROM user_survey WHERE user_id = ? ORDER BY created_at DESC';

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('나의 설문 리스트 조회 실패:', err);
      res.status(500).send('설문 조회 실패');
      return;
    }

    res.send(results); // 🔥 내 설문만 반환
  });
});

// 설문 조회
app.get('/api/my-survey', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).send('user_id가 필요합니다.');

  const sql = 'SELECT * FROM user_survey WHERE user_id = ? LIMIT 1';
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('DB 조회 실패:', err);
      return res.status(500).send('서버 오류 발생');
    }
    res.send(results[0] || null); // 없으면 null
  });
});

// 설문 수정
app.put('/api/survey/:id', (req, res) => {
  const {
    name, phone, call_name, experience, skills,
    computer_skill, goal, interest, study_style, question_attitude, one_word, hope
  } = req.body;

  const sql = `
    UPDATE user_survey SET
      name = ?, phone = ?, call_name = ?, experience = ?, skills = ?,
      computer_skill = ?, goal = ?, interest = ?, study_style = ?, question_attitude = ?, one_word = ?, hope = ?
    WHERE id = ?;
        
    UPDATE users SET user_extra = 1 WHERE id = ?;
  `;
  db.query(sql, [name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope, req.params.id
                  ,user_id
  ], (err, result) => {
    if (err) {
      console.error('DB 수정 실패:', err);
      return res.status(500).send('설문 수정 실패');
    }
    res.send({ message: '설문 수정 성공!' });
  });
});


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
