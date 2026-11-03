export default function decorate(fieldDiv) {
  const inputField = fieldDiv.querySelector('input[type="text"]');
  if (!inputField) {
    return fieldDiv;
  }
  inputField.type = 'password';

  const wrapper = document.createElement('div');
  wrapper.className = 'password-input-wrapper';
  inputField.insertAdjacentElement('afterend', wrapper);
  wrapper.append(inputField);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'password-toggle';
  toggle.setAttribute('aria-label', 'Show password');
  wrapper.append(toggle);

  toggle.addEventListener('click', () => {
    const isPassword = inputField.getAttribute('type') === 'password';
    inputField.setAttribute('type', isPassword ? 'text' : 'password');
    toggle.classList.toggle('is-visible', isPassword);
    toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });

  return fieldDiv;
}
