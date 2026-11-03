/*
 * Store locator block.
 * The source site rendered a static illustrated map (Google Maps was never initialised),
 * so this block renders the same static locator panel from the authored rows:
 *   title | subhead | search placeholder | button label
 * Rows that only hold an image/DAM reference (legacy xwalk field) are ignored.
 */
export default function decorate(block) {
  const texts = [...block.children]
    .map((row) => row.textContent.trim())
    .filter((text) => text && !text.startsWith('/content/dam/'));
  if (texts.length < 4) {
    block.textContent = '';
    return;
  }
  const [title, subhead, placeholder, buttonText] = texts;

  const shopfinder = document.createElement('div');
  shopfinder.className = 'shopfinder';
  shopfinder.innerHTML = `
    <div class="sidepanel">
      <h3 class="sidepanel__title"></h3>
      <div class="search">
        <p class="search__title"></p>
        <form class="search__box">
          <input class="search__input" type="text" name="search">
          <button type="submit" class="search__button"></button>
        </form>
      </div>
    </div>
    <div class="map" id="locator-map"></div>`;
  shopfinder.querySelector('.sidepanel__title').textContent = title;
  shopfinder.querySelector('.search__title').textContent = subhead;
  const input = shopfinder.querySelector('.search__input');
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder);
  shopfinder.querySelector('.search__button').textContent = buttonText;
  shopfinder.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
  block.replaceChildren(shopfinder);
}
