import axios from 'axios';
import { load } from 'cheerio';
import fs from 'fs';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // Secret GitHub
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Secret GitHub

async function fetchData() {
  // const url = 'https://www.univ-evry.fr/toute-lactualite.html?tx_solr%5Bq%5D=crous#tx-solr-search';
  const url = 'https://www.univ-evry.fr/toute-lactualite.html';

  try {
    const { data } = await axios.get(url);
    const $ = load(data);
    const actualites = [];

    $('li.grid-item').each((i, el) => {
      const title = $(el).find('h2.list--result-title').text().trim();
      const date = $(el).find('span.day').text().trim() + ' ' + $(el).find('span.month').text().trim();

      const partialLink = $(el).find('a').attr('href');
      const link = partialLink?.startsWith('http')
        ? partialLink
        : `https://www.univ-evry.fr${partialLink}`;

      if (title && date && link) {
        actualites.push({ title, date, link });
      }
    });

    return actualites;
  } catch (e) {
    console.error('Erreur de récupération :', e.message);
    return [];
  }
}

function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  return axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true, // éviter les aperçus inutiles
  });
}

async function main() {
  const actualites = await fetchData();

  const filename = 'evry-actualites.json';
  let anciens = [];

  if (fs.existsSync(filename)) {
    anciens = JSON.parse(fs.readFileSync(filename, 'utf-8'));
  }

  const nouveaux = actualites.filter(a => !anciens.some(ancien => ancien.title === a.title));

  if (nouveaux.length > 0) {
    let message = '📢 *Nouveaux articles publiés :*\n\n';
    nouveaux.forEach(a => {
      // Échapper les crochets et parenthèses dans les titres
      const safeTitle = a.title.replace(/([\[\]()])/g, '\\$1');

      message += `*${safeTitle}*\n`;
      message += `📅 Publiée le *${a.date}*\n`;
      message += `🔗 [Voir l'article](${a.link})\n\n`;
    });

    console.log(message);
    await sendTelegramMessage(message);
    fs.writeFileSync(filename, JSON.stringify(actualites));
  } else {
    console.log('Aucune nouvelle actualité.');
  }
}

main();
