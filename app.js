'use strict';
const tracks = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth'];
// Единый список файлов, описаний и привязок к аудио. Номер track считается с нуля.
const illustrations = [
  {
    "file": "0.png",
    "description": "Знакомьтесь, это Саша",
    "start": {
      "track": 0,
      "fraction": 0
    }
  },
  {
    "file": "1.png",
    "description": "Саша и рыжий кот с купюрой у магазина",
    "start": {
      "track": 0,
      "fraction": 0.48
    }
  },
  {
    "file": "2.png",
    "description": "Саша выбирает чипсы с необычными вкусами",
    "start": {
      "track": 1,
      "fraction": 0
    }
  },
  {
    "file": "3.png",
    "description": "Галина появляется у полки с новыми ценниками",
    "start": {
      "track": 1,
      "fraction": 0.7
    }
  },
  {
    "file": "4.png",
    "description": "Новый ценник: 239 рублей вместо 179",
    "start": {
      "track": 1,
      "fraction": 0.85
    }
  },
  {
    "file": "5.png",
    "description": "Саша и Галина обсуждают подорожание чипсов",
    "start": {
      "track": 2,
      "fraction": 0
    }
  },
  {
    "file": "6.png",
    "description": "Саша спешит за газировкой, пока цены не изменились",
    "start": {
      "track": 7,
      "seconds": 7
    }
  },
  {
    "file": "7.png",
    "description": "Саша с покупками у кассы Галины",
    "start": {
      "track": 7,
      "fraction": 0.5
    }
  },
  {
    "file": "8.jpg",
    "description": "Терминал сообщает: на счёте недостаточно средств",
    "start": {
      "track": 10,
      "seconds": 13
    }
  },
  {
    "file": "9.png",
    "description": "Саша и Галина видят ошибку оплаты",
    "start": {
      "track": 10,
      "fraction": 0.6,
      "minSeconds": 14
    }
  },
  {
    "file": "10.png",
    "description": "Уведомление о списании 499 рублей за подписку",
    "start": {
      "track": 11,
      "fraction": 0
    }
  },
  {
    "file": "11.png",
    "description": "Саша узнаёт о списании за подписку",
    "start": {
      "track": 12,
      "fraction": 0
    }
  }
];
const pictures = illustrations.map(image => image.file);
const descriptions = illustrations.map(image => image.description);
const pictureCount = String(pictures.length).padStart(2,'0');
const $ = id => document.getElementById(id);
$('illustration-count').textContent = pictures.length + ' иллюстраций';
$('cover-count').textContent = '02 / ' + pictureCount;
const player = $('player');
const audio = new Audio();
audio.preload = 'auto';
let active = false;
let paused = false;
let current = 0;
let generation = 0;
let noticeTimer;
let wakeLock = null;

window.STORY.forEach(block => {
  const paragraph = document.createElement('p');
  if (block.speaker) {
    paragraph.className = 'dialogue';
    const name = document.createElement('span');
    name.className = 'speaker';
    name.textContent = block.speaker;
    paragraph.append(name);
  }
  paragraph.append(document.createTextNode(block.text));
  $('story').append(paragraph);
  if (typeof block.image === 'string') {
    const imageIndex = pictures.indexOf(block.image);
    if (imageIndex < 0) throw new Error('Неизвестная иллюстрация: ' + block.image);
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = `static/image/${block.image}`;
    img.alt = descriptions[imageIndex];
    img.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = `Иллюстрация ${block.image.replace(/\.[^.]+$/, '')} — ${descriptions[imageIndex]}`;
    figure.append(img, caption);
    $('story').append(figure);
  }
});

function notify(message) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 7000);
}
function showChoice() {
  $('reader').hidden = true;
  $('choice').hidden = false;
  window.scrollTo(0,0);
}
function updateScene(track, seconds = 0, duration = 0) {
  const scene = illustrations.reduce((last, image, i) => {
    const start = image.start;
    const threshold = start.seconds ?? Math.max(start.minSeconds ?? 0,
      start.fraction === 0 ? 0 : (Number.isFinite(duration) && duration > 0 ? duration * start.fraction : Infinity));
    return track > start.track || (track === start.track && seconds >= threshold) ? i : last;
  }, 0);
  const src = 'static/image/' + pictures[scene];
  if ($('slide').getAttribute('src') !== src) {
    $('slide').src = src;
    $('slide').alt = descriptions[scene];
  }
}
function updateProgress() {
  const fraction = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
  if (active) updateScene(current, audio.currentTime, audio.duration);
  const value = (current + fraction) / tracks.length * 100;
  $('progress-fill').style.width = `${value}%`;
  document.querySelector('.progress').setAttribute('aria-valuenow', Math.round(value));
}
async function keepAwake() {
  if (!('wakeLock' in navigator) || !active || document.visibilityState !== 'visible') return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (active) wakeLock = lock;
    else await lock.release();
  } catch { /* Воспроизведение работает и без блокировки сна. */ }
}
function stop(message) {
  active = false;
  generation++;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  if (player.open) player.close();
  $('site').inert = false;
  document.body.classList.remove('listening');
  showChoice();
  $('listen').focus();
  if (message) notify(message);
}
function updateControls() {
  $('previous-track').disabled = current === 0;
  $('next-track').disabled = current === tracks.length - 1;
  $('toggle-audio').textContent = paused ? '▶' : 'Ⅱ';
  $('toggle-audio').setAttribute('aria-label', paused ? 'Продолжить воспроизведение' : 'Приостановить воспроизведение');
  $('playback-status').textContent = paused ? 'На паузе' : 'История звучит';
  player.classList.toggle('is-paused', paused);
}
async function resumeAudio() {
  const token = ++generation;
  paused = false;
  updateControls();
  try {
    await audio.play();
    if (token !== generation || !active) return;
  } catch {
    if (token === generation && active) stop('Не удалось запустить аудио. Проверьте соединение и попробуйте ещё раз.');
  }
}
function playTrack(index) {
  if (!active || index < 0 || index >= tracks.length) return;
  generation++;
  audio.pause();
  current = index;
  updateScene(index);
  $('chapter').textContent = `Фрагмент ${index + 1} из ${tracks.length}`;
  audio.src = `static/audio/${tracks[index]}.mp3`;
  $('progress-fill').style.width = `${index / tracks.length * 100}%`;
  document.querySelector('.progress').setAttribute('aria-valuenow', Math.round(index / tracks.length * 100));
  updateControls();
  if (paused) audio.load();
  else resumeAudio();
}
$('listen').addEventListener('click', () => {
  if (active) return;
  $('notice').hidden = true;
  active = true;
  paused = false;
  player.showModal();
  $('site').inert = true;
  document.body.classList.add('listening');
  $('cancel').focus();
  playTrack(0);
  keepAwake();
});
$('cancel').addEventListener('click', () => stop());
$('previous-track').addEventListener('click', () => playTrack(current - 1));
$('next-track').addEventListener('click', () => playTrack(current + 1));
$('toggle-audio').addEventListener('click', () => {
  if (!active) return;
  if (paused) resumeAudio();
  else {
    generation++;
    paused = true;
    audio.pause();
    updateControls();
  }
});
// Системная клавиша Escape эквивалентна кнопке «Отмена».
player.addEventListener('cancel', event => { event.preventDefault(); stop(); });
audio.addEventListener('ended', () => {
  if (!active || paused) return;
  if (current + 1 < tracks.length) playTrack(current + 1);
  else stop('История закончилась. Спасибо, что послушали!');
});
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('error', () => { if (active && audio.error) stop(`Не удалось загрузить фрагмент ${current + 1}. Попробуйте запустить историю ещё раз.`); });
$('read').addEventListener('click', () => {
  $('choice').hidden = true;
  $('reader').hidden = false;
  window.scrollTo(0,0);
  $('back').focus();
});
for (const id of ['back','read-again']) $(id).addEventListener('click', () => { showChoice(); $('read').focus(); });
document.addEventListener('visibilitychange', () => { if (active && !wakeLock) keepAwake(); });
window.addEventListener('pagehide', () => { if (active) stop(); });
