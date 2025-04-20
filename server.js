

const serverless = require('serverless-http');
const express = require('express');
const multer = require('multer');
const app = express();
const path = require('path');
const fs = require('fs');

const bodyParser = require('body-parser');
const mysql = require('mysql2');
// const bcrypt = require('bcrypt');
const bcrypt = require('bcryptjs');
const uploadFolder = 'uploads'; // 저장 폴더


// 폴더 없으면 생성
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

const cors = require('cors');

// 동적으로 origin 설정
const allowedOrigins = [
  'http://localhost:5173',
  'https://jinjoobootcamp-f3fq.vercel.app'
];


const corsOptions = {
  origin: function (origin, callback) {
    // origin이 없으면 (postman이나 서버 내부 요청) 허용
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions)); // ✅ 한 번만!

// multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // 확장자 추출(.jpg, .png)
    const filename = Date.now() + ext; // 예: 1713646478156.jpg
    cb(null, filename);
  }
});


app.use(express.json());
app.use(bodyParser.json());


const upload = multer({ storage: storage });
app.use('/uploads', express.static('uploads'));

const router = express.Router();

const db = mysql.createConnection({
  host: 'nozomi.proxy.rlwy.net',  // Railway에서 제공한 host
  port: 10904,                       // 포트 확인 (기본 3306)
  user: 'root',                     // 유저명
  password: 'ZiDACevkGUVbIwdUZtwVswdRLkmNALAn',             // 비밀번호
  database: 'railway'          // DB 이름
});


db.connect();


// 🔥 유저 정보 가져오기 API
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  const sql = 'SELECT * FROM users WHERE id = ?';

  db.query(sql, [userId], (err, result) => {
      if (err) {
          console.error('DB 에러:', err);
          return res.status(500).send('서버 오류');
      }

      if (result.length === 0) {
          return res.status(404).send('유저를 찾을 수 없습니다.');
      }

      const user = result[0];

      // 불필요한 패스워드는 빼고 보내기 (보안용)
      delete user.password;

      res.send({
          message: '유저 정보 조회 성공',
          user,
      });
  });
});


// ✅ 사용자 정보 업데이트 API
app.put('/api/user', (req, res) => {
  const {
    id,
    name,
    job_title,
    birthday,
    location,
    phone,
    email,
    twitter_url,
    dribbble_url,
    github_url,
    profile_image,
  } = req.body;

  console.log("req.body:", req.body);
  console.log("id:", id);
  console.log("name:", name);

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

  const values = [
    name,
    job_title,
    birthday,
    location,
    phone,
    twitter_url,
    dribbble_url,
    github_url,
    id
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('DB 업데이트 오류:', err);
      return res.status(500).send('서버 오류');
    }

    res.send({
      message: '유저 정보 업데이트 성공',
    });
  });
});



// 🔥 사용자 정보 업데이트 API
app.put('/api/user/update', (req, res) => {
  const {
    id,
    name,
    job_title,
    birthday,
    location,
    phone,
    email,
    twitter_url,
    dribbble_url,
    github_url,
    profile_image
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
    name,
    job_title,
    birthday,
    location,
    phone,
    email,
    twitter_url,
    dribbble_url,
    github_url,
    profile_image,
    id,
  ];

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('회원정보 수정 실패');
    }
    res.send('회원정보 수정 성공!');
  });
});

// 🔥 프로필 사진 업로드 엔드포인트
app.post('/api/upload-profile', upload.single('profile'), (req, res) => {
  try {
    const filePath = '/' + req.file.path.replace(/\\/g, '/'); // 윈도우 대응
    const userId = req.body.userId; // 프론트에서 userId 받아야 함

    if (!userId) {
      return res.status(400).send('userId가 필요합니다.');
    }

    console.log('프로필 이미지 경로:', filePath);
  
    

    const sql = 'UPDATE users SET profile_image = ? WHERE id = ?';
    
    db.query(sql, [filePath, userId], (err, result) => {
      if (err) {
        console.error('DB 업데이트 실패:', err);
        return res.status(500).send('DB 업데이트 실패');
      }
    }); 
    res.send({ filePath }); // 프론트로 파일 경로 반환
  } catch (error) {
    console.error(error);
    res.status(500).send('파일 업로드 실패');
  }
});




// 회원가입
app.post('/api/register', async (req, res) => {
  console.log("회원가입");
  const { userId, name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  console.log(hashed, ":hashed");

  const sql = 'INSERT INTO users (name_id, name, email, password) VALUES (?, ?, ?, ?)';
  db.query(sql, [userId, name, email, hashed], (err, result) => {
      if (err) {
          return res.status(500).send("이미 가입된 이메일입니다.");
      }

      // INSERT 성공했으면 방금 가입한 유저 정보를 다시 조회
      const findUserSql = 'SELECT * FROM users WHERE email = ?';
      db.query(findUserSql, [email], (err, userResult) => {
          if (err || userResult.length === 0) {
              return res.status(500).send("회원가입 후 사용자 정보를 가져오는 데 실패했습니다.");
          }

          const user = userResult[0];
          res.send({
              message: '회원가입 성공!',
              user: {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  user_extra: user.user_extra, // (만약 user_extra 대신 extraCompleted를 원하면 이름 통일 필요)
                  profileImage: user.profile_image , // 만약 profileImage 칼럼이 없으면 생략 가능
              }
          });
      });
  });
});

// app.post('/api/login', async (req, res) => {
//   console.log("req.body:", req.body);
//   const { email, password } = req.body;

//   const sql = 'SELECT * FROM users WHERE email = ?';
//   db.query(sql, [email], async (err, result) => {
//       if (err) {
//           res.status(500).send('서버 오류 발생');
//           return;
//       }

//       if (result.length === 0) {
//           res.status(401).send('이메일이 존재하지 않습니다');
//           return;
//       }

//       const user = result[0];
//       const isMatch = await bcrypt.compare(password, user.password);

//       if (!isMatch) {
//           res.status(401).send('비밀번호가 일치하지 않습니다');
//           return;
//       }

//       // 로그인 성공
//       res.send({
//           message: '로그인 성공!',
//           user: {
//               id: user.id,             // ✅ 추가
//               name: user.name,
//               email: user.email,
//               user_extra: user.user_extra,
//               profileImage: user.profile_image, // 만약 profileImage 칼럼이 없으면 생략 가능
//               job_title: user.job_title,
//               birthday:user.birthday,
//               location: user.location
//           },
//       });
//   });
// });


app.get('/api/calendar', (req, res) => {
  const sql = 'SELECT * FROM calendar ORDER BY start ASC';
  db.query(sql, (err, result) => {
      if (err) return res.status(500).send('DB 조회 실패');
      res.send(result);
  });
});



app.post('/api/calendar', async (req, res) => {
  const { title, start, end, category, description } = req.body;

  const sql = 'INSERT INTO calendar (title, start, end, category, description) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [title, start, end, category, description], (err, result) => {
    if (err) {
      console.error('DB 저장 실패:', err);
      return res.status(500).send('DB 저장 실패');
    }
    res.status(201).json({ id: result.insertId });
  });
});


let calendarEvents = []; // 메모리 저장용
// PUT 수정 API
// ⭐ 이벤트 수정 (Update) --- 여기 중요
app.put('/api/calendar/:id', (req, res) => {
  const { id } = req.params;
  const { title, start, end, description, category } = req.body;

  db.query(
      'UPDATE calendar SET title = ?, start = ?, end = ?, description = ?, category = ? WHERE id = ?',
      [title, start, end, description, category, id],
      (err, result) => {
          if (err) return res.status(500).send('DB 수정 실패');
          if (result.affectedRows === 0) return res.status(404).send('수정할 데이터 없음');
          res.send('Update Success');
      }
  );
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
            설문지 저장 API   
----------------------------------------------------*/
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
    hope,
    is_temp
  } = req.body;

  console.log('폼 데이터:', req.body);

  const sqlInsertSurvey = `
    INSERT INTO user_survey (user_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const sqlUpdateUserExtra = `
    UPDATE users SET user_extra = ? WHERE id = ?
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
      db.query(sqlUpdateUserExtra, [is_temp,user_id], (err, result2) => {
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



//설문수정
app.put('/api/survey/:id', (req, res) => {
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
    hope,
    is_temp
  } = req.body;

  console.log('폼 데이터:', req.body);


  const sqlInsertSurvey = `
     UPDATE user_survey SET
       name = ?, phone = ?, call_name = ?, experience = ?, skills = ?,
       computer_skill = ?, goal = ?, interest = ?, study_style = ?, question_attitude = ?, one_word = ?, hope = ?
     WHERE user_id = ?
     `;

  const sqlUpdateUserExtra = `
    UPDATE users SET user_extra = ? WHERE id = ?
  `;

   db.beginTransaction((err) => {
    if (err) {
      console.error('트랜잭션 시작 에러:', err);
      return res.status(500).send('트랜잭션 시작 실패');
    }

    // 1. 설문지 저장
    db.query(sqlInsertSurvey, [name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope,user_id], (err, result) => {
      if (err) {
        console.error('설문 저장 에러:', err);
        return db.rollback(() => {
          res.status(500).send('설문 저장 실패');
        });
      }

      // 2. user_extra 업데이트
      db.query(sqlUpdateUserExtra, [is_temp,user_id], (err, result2) => {
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


// 🔥 언어 변경 API
app.put('/api/user/update-lang', (req, res) => {
  const { id, lan } = req.body;
  const sql = 'UPDATE users SET lan = ? WHERE id = ?';

  db.query(sql, [lan, id], (err, result) => {
      if (err) {
          console.error('DB 업데이트 실패', err);
          return res.status(500).send('서버 오류');
      }
      res.send({ message: '언어 업데이트 성공' });
  });
});





// todo 추가
app.post('/api/todos', (req, res) => {
  const { user_id, title, tag, priority, description, due_date, shared_with_user_id } = req.body;

  if (!user_id) {
    return res.status(400).send('user_id가 없습니다.');
  }

  const sql = `
    INSERT INTO todos (user_id, title, tag, priority, description, due_date, shared_with_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, title, tag, priority, description, due_date, shared_with_user_id], (err, result) => {
    if (err) {
      console.error('DB 저장 실패:', err);
      return res.status(500).send('DB 저장 실패');
    }
    res.send('DB 저장 성공');
  });
});

// todo 수정
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, priority, tag, assignee } = req.body;
  const sql = 'UPDATE todos SET title = ?, description = ?, priority = ?, tag = ?, assignee = ? WHERE id = ?';
  db.query(sql, [title, description, priority, tag, assignee, id], (err) => {
      if (err) return res.status(500).send(err);
      res.send('Todo updated');
  });
});

// todo 삭제
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM todos WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).send(err);
      res.send('Todo deleted');
  });
});

// ✅ 카테고리 조회 API
app.get('/api/common/category', (req, res) => {
  const sql = `
    SELECT code, label
    FROM com_code
    WHERE type = 'category'
      AND use_yn = 'Y'
    ORDER BY id ASC
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('DB Error:', err);
      return res.status(500).send('DB Error');
    }
    res.json(results);
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
              profileImage: user.profile_image, // 만약 profileImage 칼럼이 없으면 생략 가능
              job_title: user.job_title,
              birthday:user.birthday,
              location: user.location,
              role_code:user.role_code,
              
          },
      });
  });
});

// app.post('/api/login', (req, res) => {
//   const { email, password } = req.body;
  
//   const sql = 'SELECT id, name, email, role FROM users WHERE email = ? AND password = ?';
//   db.query(sql, [email, password], (err, results) => {
//     if (err) return res.status(500).send("서버 오류");
//     if (results.length === 0) return res.status(400).send("로그인 실패");
    
//     const user = results[0];
//     res.json(user); // role도 같이 넘겨줌
//   });
// });

// // 로그인 성공 후
// app.get('/api/menus/:role', async (req, res) => {
//   const { role_code } = req.user;  // 로그인 시 저장된 사용자 정보
  
//   const sql = `
//     SELECT m.id, m.menu_name 
//     FROM menus m
//     JOIN role_menu_mng r ON m.id = r.menu_id
//     WHERE r.role_code = ?
//   `;

//   db.query(sql, [role_code], (err, results) => {
//     if (err) return res.status(500).send('메뉴 조회 실패');
//     res.json(results); // [{id:1, menu_name:'프로그램 관리'}, {id:2, menu_name:'메뉴 관리'}]
//   });
// });




// app.listen(5000, () => {
//   console.log("Server running on port 5000");
// });

const PORT = process.env.PORT || 5000;  // ✅ 중요: Railway는 PORT 환경변수로 포트를 할당함

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});