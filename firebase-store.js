// firebase-store.js — 쪼코 코딩교실 MVP의 저장소(store)를 Firestore로 바꾸는 어댑터
// index.html의 `const store = {...}` 와 함수 이름·입출력이 같다.
// 사용: index.html의 <script>를 <script type="module">로 바꾸고, store 블록 대신
//   import { createFirebaseStore, askGemini } from './firebase-store.js';
//   const store = await createFirebaseStore(firebaseConfig);
// 그리고 closeWeek() 안의 writeFeedback(sm) 을 await askGemini(sm, AI_RULES) 로 바꾼다.
//
// ※ SDK 버전은 배포 직전에 https://firebase.google.com/support/release-notes/js 에서 확인할 것.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, where, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-ai.js';

let app, fs, model;

export async function createFirebaseStore(config, classId = '1-1') {
  app = initializeApp(config);
  fs = getFirestore(app);
  // 컬렉션 구조: classes/{classId}/students|weeks|attempts|predictions|feedback
  const col = name => collection(fs, 'classes', classId, name);
  const listeners = new Set();
  const unsubs = [];
  const notify = () => listeners.forEach(f => f());
  const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data(), at: d.data().at?.toMillis?.() ?? Date.now() }));

  const filtered = async (name, f = {}) => {
    const cond = [];
    if (f.student) cond.push(where('student', '==', f.student));
    if (f.week != null) cond.push(where('week', '==', f.week));
    return rows(await getDocs(query(col(name), ...cond)));
  };

  return {
    async getStudent(code) {
      const s = await getDoc(doc(col('students'), code));
      return s.exists() ? { code, ...s.data() } : null;
    },
    async listStudents() {
      return (await getDocs(col('students'))).docs.map(d => ({ code: d.id, ...d.data() }))
        .sort((a, b) => a.code.localeCompare(b.code));
    },
    async addStudent(code) {
      const ref = doc(col('students'), code);
      if ((await getDoc(ref)).exists()) return false;
      await setDoc(ref, { cls: classId }); return true;
    },
    async getWeeks() {
      const out = {};
      (await getDocs(col('weeks'))).docs.forEach(d => out[d.id] = d.data());
      for (let n = 1; n <= 8; n++) out[n] ??= { status: 'locked' };
      return out;
    },
    async setWeekStatus(n, status) { await setDoc(doc(col('weeks'), String(n)), { status, at: serverTimestamp() }); },
    async addAttempt(a) { await addDoc(col('attempts'), { ...a, at: serverTimestamp() }); },
    listAttempts: f => filtered('attempts', f),
    async addPrediction(p) { await addDoc(col('predictions'), { ...p, at: serverTimestamp() }); },
    listPredictions: f => filtered('predictions', f),
    async addFeedback(f) { await addDoc(col('feedback'), { ...f, read: false, at: serverTimestamp() }); },
    async listFeedback(student) { return (await filtered('feedback', { student })).sort((a, b) => b.at - a.at); },
    async markRead(id) { await updateDoc(doc(col('feedback'), id), { read: true }); },

    // 실시간: 피드백·주차·시도 기록이 바뀌면 화면을 다시 그린다 (학생 알림 배지가 여기서 뜬다)
    onChange(cb) {
      if (!unsubs.length) {
        for (const name of ['feedback', 'weeks', 'attempts', 'students']) {
          let first = true;
          unsubs.push(onSnapshot(col(name), () => { if (first) { first = false; return; } notify(); }));
        }
      }
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async resetDemo() { throw new Error('실제 반 데이터는 콘솔에서 관리하세요.'); }
  };
}

// 주차 마감 때 선생님 화면에서 호출 (Firebase AI Logic, 무료 Spark 요금제에서 사용 가능)
// 학생 이름은 보내지 않는다. 번호와 시도 요약만 보낸다.
const REMEDIAL_IDS = ['lr', 'count', 'order', 'off', 'early', 'wall', 'plan', 'bonus'];
export async function askGemini(summary, rules) {
  model ??= getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });
  const prompt = `너는 초등 1학년 코딩 수업의 피드백 도우미야.
규칙: ${rules}
보충문제 id 목록: ${REMEDIAL_IDS.join(', ')} (틀린 유형이 없고 성공했으면 bonus, 활동이 적으면 null)
학생의 이번 주 기록 요약(JSON): ${JSON.stringify(summary)}
{"text": "피드백 두 문장 이내", "remedial": "id 또는 null"} 형식의 JSON으로만 답해.`;
  const res = await model.generateContent(prompt);
  const out = JSON.parse(res.response.text());
  if (!REMEDIAL_IDS.includes(out.remedial)) out.remedial = null;   // 목록 밖 문제는 쓰지 않는다
  return out;
}
