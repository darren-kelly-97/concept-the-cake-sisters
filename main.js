/* the Cake Sisters: shared script. No network, no storage. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TZ = 'America/New_York';
  var DAY_MS = 86400000;
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var STAGGER = 85;

  // Real studio hours, index 0 is Sunday.
  var HOURS = [
    { type: 'closed' },
    { type: 'appt' },
    { type: 'appt' },
    { type: 'open', open: 9, close: 17 },
    { type: 'open', open: 9, close: 17 },
    { type: 'open', open: 9, close: 17 },
    { type: 'open', open: 9, close: 16 }
  ];

  // Current date and time at the studio, whatever the visitor's time zone.
  function studioNow() {
    var y, m, d, h, min;
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      y = +o.year; m = +o.month; d = +o.day; h = (+o.hour) % 24; min = +o.minute;
    } catch (e) {
      var n = new Date();
      y = n.getFullYear(); m = n.getMonth() + 1; d = n.getDate(); h = n.getHours(); min = n.getMinutes();
    }
    var date = new Date(Date.UTC(y, m - 1, d));
    return { date: date, weekday: date.getUTCDay(), minutes: h * 60 + min };
  }

  function clock(h) { return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); }
  function span(r) { return (r.open % 12 || 12) + ' - ' + (r.close % 12 || 12); }
  function addDays(date, n) { return new Date(date.getTime() + n * DAY_MS); }
  function toISO(date) { return date.toISOString().slice(0, 10); }
  function fromISO(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return null;
    var date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  function studioStatus(now) {
    var r = HOURS[now.weekday];
    if (r.type === 'open' && now.minutes >= r.open * 60 && now.minutes < r.close * 60) {
      return { state: 'open', text: 'Open now, call and ask', until: r.close };
    }
    if (r.type === 'appt') {
      return { state: 'appt', text: 'Appointment only, call to schedule' };
    }
    var when = '';
    for (var i = 0; i < 8; i++) {
      var wd = (now.weekday + i) % 7;
      var rule = HOURS[wd];
      if (rule.type !== 'open') continue;
      if (i === 0) {
        if (now.minutes < rule.open * 60) { when = 'today at ' + clock(rule.open); break; }
        continue;
      }
      when = (i === 1 ? 'tomorrow' : DAY_LONG[wd]) + ' at ' + clock(rule.open);
      break;
    }
    return { state: 'closed', text: 'Closed right now. Call during studio hours, next open ' + when + '.' };
  }

  var now = studioNow();
  var status = studioStatus(now);

  // Lamps: text now, light when their week strip has filled.
  var lamps = document.querySelectorAll('[data-lamp]');
  Array.prototype.forEach.call(lamps, function (el) {
    el.classList.add('is-' + status.state);
    var t = el.querySelector('[data-lamp-text]');
    if (t) t.textContent = status.text;
  });
  function light(el) { if (el) el.classList.add('is-lit'); }

  // The planner lamp has no strip of its own: light it straight away.
  Array.prototype.forEach.call(lamps, function (el) {
    if (!el.closest('[data-week]')) light(el);
  });

  // Hero photo settles in as part of the same moment.
  var hero = document.querySelector('.hero');
  if (hero && !reduceMotion) {
    requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('is-go'); }); });
  }

  // Week strips: tiles rise Monday to Sunday, today fills with blue, then the lamp lights.
  var blocks = document.querySelectorAll('[data-week]');
  Array.prototype.forEach.call(blocks, function (block) {
    var days = block.querySelectorAll('.day');
    var cell = block.querySelector('.day[data-day="' + now.weekday + '"]');
    var lamp = block.querySelector('[data-lamp]');
    var todayIndex = Array.prototype.indexOf.call(days, cell);

    function markToday() {
      if (!cell || cell.classList.contains('is-today')) return;
      cell.classList.add('is-today');
      cell.setAttribute('aria-current', 'date');
      var s = document.createElement('span');
      s.className = 'sr';
      s.textContent = ', today';
      cell.appendChild(s);
    }

    if (reduceMotion) {
      markToday();
      light(lamp);
      return;
    }

    Array.prototype.forEach.call(days, function (d, i) { d.style.setProperty('--i', i); });
    block.classList.add('is-staged');

    var started = false;
    function play() {
      if (started) return;
      started = true;
      requestAnimationFrame(function () { requestAnimationFrame(function () { block.classList.add('is-go'); }); });
      var fillAt = Math.max(0, todayIndex) * STAGGER + 650;
      setTimeout(markToday, fillAt);
      setTimeout(function () { light(lamp); }, fillAt + 750);
    }

    var inHero = !!block.closest('.hero');
    if (inHero || !('IntersectionObserver' in window)) {
      play();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { play(); io.disconnect(); }
        });
      }, { threshold: 0.25 });
      io.observe(block);
    }
    // Safety: never leave the strip hidden.
    setTimeout(function () { block.classList.add('is-go'); markToday(); light(lamp); }, inHero ? 2600 : 8000);
  });

  // Photo ribbon: drifts sideways as the page scrolls. Without motion it stays a swipe row.
  var ribbon = document.querySelector('[data-ribbon]');
  if (ribbon && !reduceMotion) {
    var track = ribbon.querySelector('[data-ribbon-track]');
    if (track) {
      ribbon.classList.add('is-drift');
      var ticking = false;
      var drift = function () {
        ticking = false;
        var r = ribbon.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var range = track.scrollWidth - ribbon.clientWidth;
        if (range <= 0) { track.style.transform = ''; return; }
        var p = (vh - r.top) / (vh + r.height);
        p = Math.max(0, Math.min(1, p));
        track.style.transform = 'translate3d(' + (-p * range).toFixed(1) + 'px,0,0)';
      };
      var ask = function () { if (!ticking) { ticking = true; requestAnimationFrame(drift); } };
      window.addEventListener('scroll', ask, { passive: true });
      window.addEventListener('resize', ask);
      window.addEventListener('load', ask);
      drift();
    }
  }

  // Gallery jump bar: mark the section in view.
  var jumpLinks = document.querySelectorAll('.jumpbar a[href^="#"]');
  if (jumpLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    Array.prototype.forEach.call(jumpLinks, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var jio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Array.prototype.forEach.call(jumpLinks, function (a) { a.classList.remove('is-active'); });
        var link = byId[en.target.id];
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) jio.observe(sec);
    });
  }

  // Planner: "When do you need it?"
  var input = document.getElementById('need-date');
  if (input) setupPlanner(input);

  function setupPlanner(input) {
    var els = {
      error: document.getElementById('date-error'),
      errorText: document.querySelector('[data-error-text]'),
      empty: document.querySelector('[data-plan-empty]'),
      body: document.querySelector('[data-plan-body]'),
      count: document.querySelector('[data-count]'),
      countNote: document.querySelector('[data-count-note]'),
      range: document.querySelector('[data-range]'),
      dayof: document.querySelector('[data-dayof]'),
      between: document.querySelector('[data-between]')
    };
    if (!els.body || !els.empty) return;

    input.min = toISO(now.date);
    input.max = toISO(addDays(now.date, 365));

    var longDate;
    try {
      longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    } catch (e) { longDate = null; }
    function label(date) {
      return longDate ? longDate.format(date) : DAY_LONG[date.getUTCDay()] + ' ' + date.getUTCDate();
    }

    function showError(msg) {
      if (els.errorText) els.errorText.textContent = msg;
      if (els.error) els.error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      els.body.hidden = true;
      els.empty.hidden = true;
    }
    function clearError() {
      if (els.error) els.error.hidden = true;
      input.removeAttribute('aria-invalid');
    }

    function cell(date, i, diff) {
      var wd = date.getUTCDay();
      var type = HOURS[wd].type;
      var li = document.createElement('li');
      li.className = 'm m-' + type + (i === 0 ? ' m-today' : '') + (i === diff ? ' m-target' : '');
      var a = document.createElement('span');
      a.className = 'm-day'; a.setAttribute('aria-hidden', 'true'); a.textContent = DAY_SHORT[wd];
      var b = document.createElement('span');
      b.className = 'm-date'; b.setAttribute('aria-hidden', 'true'); b.textContent = date.getUTCDate();
      var s = document.createElement('span');
      s.className = 'sr';
      var state = type === 'open' ? 'open ' + span(HOURS[wd]) : type === 'appt' ? 'by appointment' : 'closed';
      var tags = (i === 0 ? ', today' : '') + (i === diff ? ', your date' : '');
      s.textContent = label(date) + tags + ', ' + state;
      li.appendChild(a); li.appendChild(b); li.appendChild(s);
      return li;
    }

    function update() {
      clearError();
      var v = input.value;
      if (!v) { els.body.hidden = true; els.empty.hidden = false; return; }
      var target = fromISO(v);
      if (!target) { showError('Enter a full date: month, day and year.'); return; }

      var n = studioNow();
      var st = studioStatus(n);
      var diff = Math.round((target.getTime() - n.date.getTime()) / DAY_MS);
      if (diff < 0) { showError('That date has already passed. Pick today or a later date.'); return; }
      if (diff > 365) { showError('That date is more than a year away. Pick a closer date, or call and tell us about it.'); return; }

      var studioDays = 0, appt = 0, sundays = 0;
      for (var i = 1; i < diff; i++) {
        var t = HOURS[(n.weekday + i) % 7].type;
        if (t === 'open') studioDays++;
        else if (t === 'appt') appt++;
        else sundays++;
      }
      els.count.textContent = String(studioDays);

      var note;
      if (diff === 0) note = 'That is today. Call now and ask.';
      else if (studioDays === 0 && diff === 1) note = 'Your date is tomorrow, so there are no full studio days in between. Call and ask what we can do.';
      else if (studioDays === 0) note = 'No full studio days in between. Call and ask what we can do.';
      else note = 'Counting Wednesday to Saturday, from tomorrow up to the day before your date.';
      if (diff > 0 && st.state === 'open') note += ' We are also open today until ' + clock(st.until) + '.';
      els.countNote.textContent = note;

      var between = [];
      if (appt) between.push(appt + (appt === 1 ? ' appointment-only day' : ' appointment-only days') + ' in between, call to schedule.');
      if (sundays) between.push(sundays + (sundays === 1 ? ' Sunday' : ' Sundays') + ' in between, when the studio is closed.');
      els.between.textContent = between.join(' ');
      els.between.hidden = !between.length;

      var r = HOURS[target.getUTCDay()];
      var name = diff === 0 ? 'today, ' + label(target) : label(target);
      if (r.type === 'open') els.dayof.textContent = 'Your date is ' + name + '. The studio is open ' + span(r) + ' that day.';
      else if (r.type === 'appt') els.dayof.textContent = 'Your date is ' + name + '. That day is appointment only, call to schedule.';
      else els.dayof.textContent = 'Your date is ' + name + ', when the studio is closed. Call and ask what works.';

      els.range.textContent = '';
      var frag = document.createDocumentFragment();
      if (diff + 1 <= 14) {
        for (var j = 0; j <= diff; j++) frag.appendChild(cell(addDays(n.date, j), j, diff));
      } else {
        for (var k = 0; k < 12; k++) frag.appendChild(cell(addDays(n.date, k), k, diff));
        var gap = document.createElement('li');
        gap.className = 'm m-gap';
        gap.textContent = '+ ' + (diff - 12) + ' more days';
        frag.appendChild(gap);
        frag.appendChild(cell(target, diff, diff));
      }
      els.range.appendChild(frag);

      els.empty.hidden = true;
      els.body.hidden = false;
    }

    input.addEventListener('change', update);
    input.addEventListener('input', update);
    update();
  }
})();