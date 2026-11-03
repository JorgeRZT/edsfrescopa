/*
 * Quiz block.
 * On the source site the quiz questions were loaded at runtime from an AEM Content Fragment
 * (GraphQL persisted query) and rendered with Preact. In this DA project the fragment was
 * snapshotted during the migration and is authored in the block table:
 *   question row: | question text | option type (cover, icon or slider) |
 *   option row:   | image         | description                         |
 *   slider row:   | (empty)       | min label   | max label             |
 */

function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') elem.className = value;
    else elem.setAttribute(key, value);
  });
  children.filter((c) => c !== null && c !== undefined).forEach((c) => elem.append(c));
  return elem;
}

function parseQuestions(block) {
  const questions = [];
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const [first, second, third] = cells;
    if (!first) return;
    const img = first.querySelector('img');
    const firstText = first.textContent.trim();
    if (!img && firstText) {
      questions.push({
        question: firstText,
        type: (second?.textContent.trim() || 'cover').toLowerCase(),
        options: [],
      });
      return;
    }
    const current = questions[questions.length - 1];
    if (!current) return;
    if (current.type === 'slider') {
      current.options.push({
        minOption: second?.textContent.trim() || '',
        maxOption: third?.textContent.trim() || '',
      });
    } else {
      current.options.push({
        image: img ? img.getAttribute('src') : null,
        description: second?.textContent.trim() || '',
      });
    }
  });
  return questions;
}

function renderResults(container, restart) {
  const form = el(
    'form',
    { className: 'login-form' },
    el('label', { for: 'quiz-email', className: 'login-label' }, 'Email'),
    el('input', {
      type: 'email', id: 'quiz-email', className: 'login-input', required: '', autocomplete: 'email',
    }),
    el('label', { for: 'quiz-password', className: 'login-label' }, 'Password'),
    el('input', {
      type: 'password', id: 'quiz-password', className: 'login-input', required: '', autocomplete: 'current-password',
    }),
    el('button', { type: 'submit', className: 'button primary' }, 'Sign in'),
    el('a', { href: '#', className: 'login-forgot' }, 'Forgot Password?'),
  );
  form.addEventListener('submit', (e) => e.preventDefault());

  const restartButton = el('button', { type: 'button', className: 'button secondary' }, 'Restart Quiz');
  restartButton.addEventListener('click', restart);

  return el(
    'div',
    { className: 'quiz-results' },
    el('h2', { className: 'profile-heading' }, 'Your coffee profile:'),
    el(
      'div',
      { className: 'quiz-result' },
      el('h1', { className: 'profile-title' }, container.profile),
      el('div', { className: 'profile-subtitle' }, 'What does it mean?'),
      el('h2', { className: 'login-title' }, 'Sign in or create an account'),
      el('p', { className: 'login-subtitle' }, 'to get your full MyBarista coffee quiz results and add recommendations to your profile!'),
      el(
        'div',
        { className: 'login-form-container' },
        form,
        el(
          'div',
          { className: 'login-bottom-text' },
          "Don't have a Fréscopa account yet? ",
          el('a', { href: '#', className: 'login-create' }, 'Create one today'),
        ),
        restartButton,
      ),
    ),
  );
}

export default function decorate(block) {
  const questions = parseQuestions(block);
  const wrapper = el('div');
  block.replaceChildren(wrapper);

  const state = { step: 0, answers: [] };

  function render() {
    const total = questions.length;
    if (!total) return;
    if (state.step >= total) {
      const profile = state.answers[0] === 0 ? 'Sandy Sipper' : 'Coffee Explorer';
      wrapper.replaceChildren(renderResults({ profile }, () => {
        state.step = 0;
        state.answers = [];
        render();
      }));
      return;
    }

    const q = questions[state.step];
    const next = (idx) => {
      state.answers.push(idx);
      state.step += 1;
      render();
    };
    const progress = el('div', { className: 'quiz-progress' }, `Question ${state.step + 1} of ${total}`);

    if (q.type === 'slider') {
      const form = el('form', { className: 'quiz-options' });
      form.style.flexDirection = 'column';
      form.style.gap = '32px';
      form.style.width = '100%';
      q.options.forEach((opt) => {
        form.append(el(
          'div',
          { className: 'quiz-slider-row' },
          el(
            'div',
            { className: 'quiz-slider-labels' },
            el('span', { className: 'quiz-slider-label' }, opt.minOption),
            el('span', { className: 'quiz-slider-label right' }, opt.maxOption),
          ),
          el('input', {
            type: 'range', min: '0', max: '10', value: '5', className: 'quiz-slider', 'aria-label': `${opt.minOption} - ${opt.maxOption}`,
          }),
        ));
      });
      const cta = el('a', { href: '#', className: 'button', role: 'button' }, 'Get Your Results');
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        next(0);
      });
      form.append(el('div', { className: 'cta' }, cta));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        next(0);
      });
      wrapper.replaceChildren(el(
        'div',
        { className: `quiz-inner-container step-${state.step}` },
        el('h2', {}, q.question),
        form,
        progress,
      ));
      return;
    }

    const options = el('div', { className: 'quiz-options' });
    q.options.forEach((opt, idx) => {
      const button = el('button', { type: 'button' });
      if (opt.image) {
        button.append(el(
          'div',
          { className: `quiz-option-img-wrapper-${q.type}` },
          el('img', { src: opt.image, alt: opt.description, loading: 'lazy' }),
        ));
      }
      button.append(el('span', { className: 'quiz-option-description' }, opt.description));
      button.addEventListener('click', () => next(idx));
      options.append(button);
    });
    wrapper.replaceChildren(el(
      'div',
      { className: `quiz-inner-container step-${state.step}` },
      el('h2', {}, q.question),
      options,
      progress,
    ));
  }

  render();
}
