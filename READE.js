
/*--------------------------------------------------
            설문지 저장 API   2개 insert
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
    curriculum,
    is_temp
  } = req.body;

  console.log('폼 데이터:', req.body);

  const sqlInsertSurvey = `
    INSERT INTO user_survey (user_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope,curriculum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
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
    db.query(sqlInsertSurvey, [user_id, name, phone, call_name, experience, skills, computer_skill, goal, interest, study_style, question_attitude, one_word, hope,curriculum], (err, result) => {
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




// ✅ 연락처(친구) 추가 API (pool + async/await)
app.post("/api/contacts", async (req, res) => {
  console.log(req.body.myUserId);
  console.log(req.body.targetUserId);
  console.log(req.body.path);
  console.log(req.body.name);

  try {
    const { myUserId, targetUserId, path, name } = req.body;
    if (!myUserId || !targetUserId ) {
      return res.status(400).json({ success: false, message: "필수값 누락" });
    }



    console.log('폼 데이터:', req.body);
    const sqlContacts = `
        INSERT INTO contacts (my_user_id, target_user_id , path, name, time)
        VALUES (?, ?, ?, ?,NOW())
      `;

     const contactId = result.insertId; // ⭐ 이게 contacts.id  
     console.log("contactId"+contactId);

    const sqlMessages = `
        INSERT INTO messages (contacts_id,from_user_id, to_user_id, text, created_at)
        VALUES (?, ?, ?, '친구 추가되었습니다.' ,NOW())
      `;

    db.query(sqlContacts, [myUserId, targetUserId, path || "user-profile.png", name || ""], (err, result) => {
      if (err) {
        console.error('설문 연락처 추가 실패: ', err);
        return db.rollback(() => {
          res.status(500).send('연락처 추가 실패');
        });
      }

    db.query(sqlMessages, [contactId ,myUserId, targetUserId], (err, result) => {

      if (err) {
          console.error('user_extra 업데이트 에러:', err);
          return db.rollback(() => {
            res.status(500).send('user_extra 업데이트 실패');
          });
        }

      if (err) {
        console.error("연락처 추가 실패:", err);
        return res.status(500).json({ success: false, message: "연락처 추가 실패" });
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
  } catch (error){



  }

  