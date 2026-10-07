import { randomUUID } from 'node:crypto';

export function createProject() {
  const yarn = randomUUID(), moon = randomUUID(), rabbit = randomUUID();
  return {
    schemaVersion: 1,
    languages: ['ko', 'en'], sourceLanguage: 'ko', translationReviewed: true,
    artist: {
      name: { ko: '하린', en: 'Harin' },
      bio: { ko: '작은 사물에 머무는 마음을 그립니다.', en: 'Painting the feelings that linger in little things.' },
      statement: { ko: '우리가 아끼는 것들은 대개 작고 조용합니다. 손으로 묶은 실, 창가에 놓인 화분, 오래 함께한 인형. 저는 그 사물들이 간직한 시간과 마음을 그림에 담습니다. 이 전시는 일상의 작은 조각을 따라 서로의 기억을 만나보는 자리입니다.', en: 'The things we cherish are often small and quiet: a thread tied by hand, a plant by the window, a toy that has stayed with us. I paint the time and feelings these objects hold. This exhibition invites you to encounter each other’s memories through little pieces of everyday life.' },
      cv: {ko:'2026  작은 마음의 정원, 아틀리에 갤러리\n2025  일상의 조각들, 그룹전\n2024  시각예술 전공 졸업',en:'2026  Gardens of Small Things, Atelier Gallery\n2025  Pieces of Everyday Life, group exhibition\n2024  Graduated in visual arts'},
      instagram: '', email: ''
    },
    exhibition: {
      title: { ko: '작은 마음의 정원', en: 'Gardens of Small Things' },
      subtitle: { ko: '하린 개인전', en: 'A solo exhibition by Harin' },
      description: { ko: '익숙한 사물 속에서 발견하는, 오래도록 간직하고 싶은 이야기.', en: 'Stories found in familiar objects, quietly waiting to be kept.' },
      gallery: { ko: '아틀리에 갤러리', en: 'Atelier Gallery' },
      address: { ko: '서울특별시 종로구 삼청로 30', en: '30 Samcheong-ro, Jongno-gu, Seoul' },
      startDate: '2026-10-24', endDate: '2026-11-08', hours: '11:00 – 18:00',
      closed: { ko: '매주 월요일 휴관', en: 'Closed on Mondays' },
      parking: { ko: '인근 공영주차장을 이용해 주세요.', en: 'Please use a nearby public parking lot.' },
      events: { ko: '오프닝 리셉션 · 10월 24일 토요일 16:00', en: 'Opening reception · Saturday, October 24, 4 pm' },
      sns: '', admission: { ko: '무료 관람', en: 'Free admission' }, timezone: 'Asia/Seoul'
    },
    theme: { background: '#f4f5e9', accent: '#647b69', patternColor: '#c7b4d7', pattern: 'dots', patternSize: 4, patternSpacing: 38, patternOpacity: 20, motion: 'float', heroImage: 'demo-characters', font: 'serif', template: 'storybook' },
    menu: ['home', 'info', 'cv', 'statement', 'paintings', 'symbolism'],
    symbols: [
      { id: yarn, name: { ko: '실', en: 'Thread' }, story: { ko: '서로 다른 기억을 이어주는 작은 연결입니다.', en: 'A little connection tying different memories together.' } },
      { id: moon, name: { ko: '달', en: 'Moon' }, story: { ko: '고요한 밤에 남겨 둔 약속을 의미합니다.', en: 'A promise left in the quiet of the night.' } },
      { id: rabbit, name: { ko: '토끼', en: 'Rabbit' }, story: { ko: '곁에 머무르는 다정한 마음을 담았습니다.', en: 'A tender presence that stays by your side.' } }
    ],
    artworks: [
      { id: randomUUID(), imageId: 'demo-still-life', title: { ko: '기억을 묶는 시간', en: 'Threads of a Little Memory' }, date: '2026', medium: { ko: '캔버스에 아크릴', en: 'Acrylic on canvas' }, width: 65, height: 53, description: { ko: '창가에 쌓인 작은 사물들 사이로, 우리의 시간이 이어집니다.', en: 'Among little objects by the window, our time finds its threads.' }, hotspots: [{ id: randomUUID(), symbolId: yarn, story: { ko: '이 실은 함께했던 시간들을 느슨하게 묶어 두고 있습니다.', en: 'This thread loosely ties together the time we shared.' }, contours: [[[.15,.64],[.34,.64],[.36,.81],[.17,.82]]] }] },
      { id: randomUUID(), imageId: 'demo-night', title: { ko: '밤의 작은 약속', en: 'A Small Promise at Night' }, date: '2026', medium: { ko: '캔버스에 아크릴', en: 'Acrylic on canvas' }, width: 53, height: 45.5, description: { ko: '달빛 아래, 아직 하지 못한 말을 천천히 건넵니다.', en: 'Under the moonlight, we slowly share the words left unsaid.' }, hotspots: [{ id: randomUUID(), symbolId: moon, story: { ko: '오늘의 밤이 내일의 우리를 다정하게 비추기를 바랍니다.', en: 'May tonight’s light shine gently on who we become tomorrow.' }, contours: [[[.59,.1],[.81,.1],[.84,.3],[.61,.33]]] }] },
      { id: randomUUID(), imageId: 'demo-together', title: { ko: '서로의 자리', en: 'A Place for Each Other' }, date: '2025', medium: { ko: '종이에 과슈', en: 'Gouache on paper' }, width: 42, height: 29.7, description: { ko: '조금 다른 우리가 함께 머무는 자리.', en: 'A place where our differences can stay together.' }, hotspots: [{ id: randomUUID(), symbolId: rabbit, story: { ko: '여기에서 토끼는 기다려 주는 친구입니다.', en: 'Here, the rabbit is a friend who waits.' }, contours: [[[.54,.31],[.81,.31],[.83,.84],[.54,.86]]] }] }
    ]
  };
}

// All displayed people, exhibitions and artwork metadata are fictional demo content.
