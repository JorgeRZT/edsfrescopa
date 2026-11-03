/*
 * Article block.
 * On the source site the article was loaded at runtime from an AEM Content Fragment
 * (GraphQL persisted query). In this DA project the fragment values were snapshotted
 * during the migration and are authored directly in the block:
 *   row 1: title
 *   row 2: content
 */
export default function decorate(block) {
  const rows = [...block.children].map((row) => row.firstElementChild || row);
  const [titleCell, textCell] = rows;

  const content = document.createElement('div');
  content.className = 'article-content';
  const inner = document.createElement('div');
  const headline = document.createElement('h4');
  headline.className = 'headline';
  headline.textContent = titleCell ? titleCell.textContent.trim() : '';
  const detail = document.createElement('p');
  detail.className = 'detail';
  detail.textContent = textCell ? textCell.textContent.trim() : '';
  inner.append(headline, detail);
  content.append(inner);
  block.replaceChildren(content);
}
