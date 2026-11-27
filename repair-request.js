(() => {
  'use strict';
  const box = document.getElementById('trackedRequest');
  if (!box || location.origin !== 'https://alexanderkadukov-sys.github.io') return;
  const get = id => document.getElementById(id);
  const api = 'https://qlggbdzodqagtxqifslg.supabase.co/functions/v1/repair-requests/';
  const storageKey = 'kadukov-repair-status-v1';
  const result = get('trackedRequestResult');
  const status = get('trackedRequestStatus');
  const create = get('createTrackedRequest');
  const refresh = get('refreshTrackedRequest');
  const copy = get('copyTrackedRequest');
  const telegram = get('trackedTelegram');
  const tokenPattern = /^[a-f0-9]{64}$/;
  const labels = {
    draft:'Ожидает подтверждения в Telegram',received:'Принята',diagnosis:'Диагностика',
    awaiting_approval:'Смета ждёт ответа',in_repair:'В работе',declined:'Смета отклонена',
    waiting_part:'Ждём деталь',ready:'Готово к выдаче',completed:'Выдано',cancelled:'Закрыта',
  };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  const accessFromLink = new URLSearchParams(location.hash.slice(1)).get('repair');
  const known = tokenPattern.test(accessFromLink || '') ? {access:accessFromLink} : saved;
  let ticket = tokenPattern.test(known.access || '') ? known : null;
  let attempt = null;

  async function ask(action, data) {
    const response = await fetch(api + action, {
      ...(data ? {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {}),
      credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(9000),
    });
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error('request'), {status:response.status});
    return value;
  }

  function show(message) {
    status.textContent = message;
    result.hidden = false;
  }

  function remember(value) {
    ticket = value;
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {}
  }

  function display(value) {
    const quote = value.amount ? ' · ' + value.amount.toLocaleString('ru-RU') + ' ₽' : '';
    const time = value.estimateTime ? ' · ' + value.estimateTime : '';
    show('Заявка К-' + value.id + ' · ' + (labels[value.status] || 'Уточняется') + quote + time);
    refresh.hidden = false;
    copy.hidden = false;
    const botUrl = /^https:\/\/t\.me\/KadukovTechLoginBot\?start=r_[a-f0-9]{60}$/;
    telegram.hidden = value.status !== 'draft' || !botUrl.test(ticket.telegram || '');
    if (!telegram.hidden) telegram.href = ticket.telegram;
    else telegram.removeAttribute('href');
  }

  create.addEventListener('click', async () => {
    validateFields();
    if (!request.reportValidity()) return;
    const lines = [selectedAction, message.value.trim()];
    if (includeItems.checked) lines.push(...cart.slice(0, 10).map(item => '• ' + String(item).slice(0, 90)));
    const requestData = {service:service.value, model:context.value.trim(), details:lines.filter(Boolean).join('\n').slice(0,2600)};
    const signature = JSON.stringify(requestData);
    if (!attempt || attempt.signature !== signature) attempt = {id:crypto.randomUUID(), signature};
    create.disabled = true;
    show('Сохраняем заявку…');
    try {
      const value = await ask('create', {requestId:attempt.id, ...requestData});
      if (!tokenPattern.test(value.access) || !Number.isSafeInteger(value.id)) throw new Error('invalid result');
      remember({access:value.access, telegram:value.telegram});
      display(value);
    } catch (error) {
      show(error.status === 429 ? 'Слишком много запросов. Можно написать мастеру через «Открыть Telegram».'
        : 'Сейчас не удалось сохранить заявку. Попробуйте снова или напишите мастеру через «Открыть Telegram».');
    } finally { create.disabled = false; }
  });

  async function refreshStatus() {
    if (!ticket || refresh.disabled) return;
    refresh.disabled = true;
    show('Проверяем статус…');
    try {
      const value = await ask('status', {access:ticket.access});
      if (value.status !== 'draft' && ticket.telegram) remember({access:ticket.access});
      display(value);
      if (accessFromLink) result.scrollIntoView({block:'center'});
    } catch (error) {
      show(error.status === 404 ? 'Личная ссылка недействительна или заявка удалена.' : 'Не удалось обновить статус. Попробуйте позже.');
      refresh.hidden = error.status === 404;
    } finally { refresh.disabled = false; }
  }

  refresh.addEventListener('click', refreshStatus);
  copy.addEventListener('click', async () => {
    if (!ticket) return;
    const link = location.origin + '/kadukov-tech/#repair=' + ticket.access;
    try {
      await navigator.clipboard.writeText(link);
      show('Личная ссылка скопирована. По ней можно посмотреть статус заявки.');
    } catch {
      show('Копирование недоступно. Можно открыть статус в Telegram командой /status.');
    }
  });
  void ask('health').then(value => {
    if (!value.ready) return;
    box.hidden = false;
    if (ticket) void refreshStatus();
  }).catch(() => {});
})();
