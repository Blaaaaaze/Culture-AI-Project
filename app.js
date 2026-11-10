'use strict';
const tracks = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth'];
const pictures = ['0.png','1.png','2.jpg','3.png','4.jpg','5.png','6.png','7.png','8.png','9.jpg','10.png','11.png','12.png'];
const descriptions = ['Знакомьтесь, это Саша','Саша и рыжий кот с купюрой у магазина','Саша выбирает чипсы с необычными вкусами','Галина появляется у полки с новыми ценниками','Новый ценник: 239 рублей вместо 179','Галина меняет ценники у полки с чипсами','Саша и Галина обсуждают подорожание чипсов','Саша спешит за газировкой, пока цены не изменились','Саша с покупками у кассы Галины','Терминал сообщает: на счёте недостаточно средств','Саша и Галина видят ошибку оплаты','Уведомление о списании 499 рублей за подписку','Саша узнаёт о списании за подписку'];
// Номер фрагмента с нуля + доля его длительности. Доли приблизительные.
// Для точных привязок используются секунды внутри указанного фрагмента.
// Картинка 10 следует за картинкой 9, но не раньше 14-й секунды.
const sceneStarts = [0,0.48,1,1.7,1.85,2,4,{track:7,seconds:7},7.5,
  {track:10,seconds:13}, {track:10,fraction:0.6,minSeconds:14},11,12];
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
  if (Number.isInteger(block.image)) {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    img.src = `static/image/${pictures[block.image]}`;
    img.alt = descriptions[block.image];
    img.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = `${String(block.image + 1).padStart(2,'0')} / ${pictureCount} — ${descriptions[block.image]}`;
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
function updateScene(position, seconds = 0) {
  const scene = sceneStarts.reduce((last, start, i) => {
    if (typeof start === 'number') return position >= start ? i : last;
    const track = Math.floor(position);
    const threshold = start.seconds ?? Math.max(start.minSeconds, (Number.isFinite(audio.duration) ? audio.duration : Infinity) * start.fraction);
    return track > start.track || (track === start.track && seconds >= threshold) ? i : last;
  }, 0);
  const src = `static/image/${pictures[scene]}`;
  if ($('slide').getAttribute('src') !== src) {
    $('slide').src = src;
    $('slide').alt = descriptions[scene];
  }
}
function updateProgress() {
  const fraction = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
  if (active) updateScene(current + fraction, audio.currentTime);
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
    $('loading').hidden = true;
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
  $('loading').hidden = paused;
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
    $('loading').hidden = true;
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
audio.addEventListener('waiting', () => { if (active && !paused) $('loading').hidden = false; });
audio.addEventListener('playing', () => { if (active) $('loading').hidden = true; });
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
