/*
 * Offer block.
 * On the source site the offer was loaded at runtime from an AEM Content Fragment
 * (GraphQL persisted query). In this DA project the fragment values were snapshotted
 * during the migration and are authored directly in the block:
 *   row 1: headline
 *   row 2: detail
 *   row 3: call to action link
 */
export default function decorate(block) {
  const rows = [...block.children].map((row) => row.firstElementChild || row);
  const [headlineCell, detailCell, ctaCell] = rows;

  const content = document.createElement('div');
  content.className = 'offer-content';

  const left = document.createElement('div');
  left.className = 'offer-left';
  const headline = document.createElement('h4');
  headline.className = 'headline';
  headline.textContent = headlineCell ? headlineCell.textContent.trim() : '';
  const detail = document.createElement('p');
  detail.className = 'detail';
  detail.textContent = detailCell ? detailCell.textContent.trim() : '';
  left.append(headline, detail);

  const right = document.createElement('div');
  right.className = 'offer-right';
  const link = ctaCell && ctaCell.querySelector('a');
  if (link) {
    const cta = document.createElement('a');
    cta.href = link.getAttribute('href');
    cta.textContent = link.textContent.trim();
    cta.className = 'button secondary';
    right.append(cta);
  }

  content.append(left, right);
  block.replaceChildren(content);
}
