/*
 * Product list block.
 * On the source site this block queried the Adobe Commerce catalog service at runtime.
 * Commerce is out of scope for this DA project, so the category listing was snapshotted
 * during the migration and is authored as one row per product:
 *   | image | name | description | price |
 * Sorting works client side over the authored products.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { isSameOriginImage } from '../../scripts/scripts.js';

const SORT_OPTIONS = [
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Product Name', value: 'name-asc' },
  { label: 'Relevance', value: 'position-asc' },
];

function parsePrice(price) {
  const value = parseFloat(price.replace(/[^0-9.]/g, ''));
  return Number.isNaN(value) ? 0 : value;
}

function readProducts(block) {
  return [...block.children].map((row, position) => {
    const cells = [...row.children];
    const img = cells[0]?.querySelector('img');
    return {
      position,
      img,
      name: cells[1]?.textContent.trim() || '',
      description: cells[2]?.textContent.trim() || '',
      price: cells[3]?.textContent.trim() || '',
    };
  }).filter((p) => p.name);
}

function renderProduct(product, index) {
  const li = document.createElement('li');
  li.setAttribute('index', index);
  const picture = document.createElement('div');
  picture.className = 'picture';
  if (product.img) {
    const src = product.img.getAttribute('src');
    const alt = product.img.getAttribute('alt') || product.name;
    let pic;
    if (isSameOriginImage(src)) {
      pic = createOptimizedPicture(src, alt, index < 4, [{ media: '(max-width: 900px)', width: '330' }, { width: '660' }]);
    } else {
      pic = document.createElement('picture');
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      pic.append(img);
    }
    pic.querySelector('img').classList.add('product-image-photo');
    picture.append(pic);
  }
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = product.name;
  const description = document.createElement('div');
  description.className = 'description';
  description.textContent = product.description;
  const price = document.createElement('div');
  price.className = 'price';
  const finalPrice = document.createElement('span');
  finalPrice.className = 'price-final';
  finalPrice.textContent = product.price;
  price.append(finalPrice);
  li.append(picture, name, description, price);
  return li;
}

export default function decorate(block) {
  const products = readProducts(block);

  const facets = document.createElement('div');
  facets.className = 'facets empty';

  const container = document.createElement('div');
  container.className = 'products';
  container.innerHTML = `
    <div class="title">
      <h1></h1>
      <span></span>
      <div class="sort">
        <button type="button"></button>
        <div class="overlay">
          <button type="button" class="close">Close</button>
          <ul></ul>
        </div>
      </div>
    </div>
    <div class="mobile-menu">
      <button type="button" class="toggle-filters">Filters</button>
      <button type="button" class="toggle-sortby">Sort By</button>
    </div>
    <div class="list"><ol></ol></div>
    <div class="pagination">
      <div>
        <label for="select-pagesize">Show:</label>
        <select id="select-pagesize" name="pageSize"><option value="12">12 Items</option></select>
      </div>
      <div>
        <label for="select-page">Page:</label>
        <select id="select-page" name="page"><option value="1">1</option></select>
        <span>of 1</span>
      </div>
      <div></div>
    </div>`;
  container.querySelector('.title span').textContent = `(${products.length} Products)`;
  container.querySelectorAll('select').forEach((select, i) => {
    select.id = `${select.id}-${Math.random().toString(36).slice(2, 7)}`;
    container.querySelectorAll('label')[i].htmlFor = select.id;
  });

  const list = container.querySelector('.list ol');
  const sortButton = container.querySelector('.sort > button');
  const overlay = container.querySelector('.sort .overlay');
  const sortList = overlay.querySelector('ul');
  let current = SORT_OPTIONS[3];

  const renderList = () => {
    const [field, direction] = current.value.split('-');
    const sorted = [...products].sort((a, b) => {
      let cmp;
      if (field === 'price') cmp = parsePrice(a.price) - parsePrice(b.price);
      else if (field === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = a.position - b.position;
      return direction === 'desc' ? -cmp : cmp;
    });
    list.replaceChildren(...sorted.map(renderProduct));
    sortButton.textContent = `Sort By: ${current.label}`;
    sortList.replaceChildren(...SORT_OPTIONS.map((option) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = option.label;
      if (option === current) a.className = 'active';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        current = option;
        overlay.classList.remove('active');
        renderList();
      });
      li.append(a);
      return li;
    }));
  };

  sortButton.addEventListener('click', () => overlay.classList.toggle('active'));
  container.querySelector('.toggle-sortby').addEventListener('click', () => overlay.classList.toggle('active'));
  overlay.querySelector('.close').addEventListener('click', () => overlay.classList.remove('active'));

  renderList();
  block.replaceChildren(facets, container);
}
