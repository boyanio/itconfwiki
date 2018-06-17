import * as https from 'https';
import { JSDOM } from 'jsdom';
import { Conference, ConferenceCfp } from './conference';
import { writeFile } from 'fs';
import { promisify } from 'util';

const writeFileAsync = promisify(writeFile);

const parseConference = (node: Element): Conference => {
  const varEl = node.querySelector('.atc_event');
  if (!varEl)
    throw 'No var element found';

  const h4List = node.querySelectorAll('.panel-body h4');
  if (h4List.length < 2)
    throw `Insufficient H4 elements: ${h4List.length}. Min 2 expected`;

  const cfpDeadlineEl = node.querySelector('.panel-body h4 table time');
  const hasCfp = !!cfpDeadlineEl;
  let cfp: ConferenceCfp = null;
  if (hasCfp) {
    cfp = {
      deadline: new Date(Date.parse(cfpDeadlineEl.getAttribute('datetime'))),
      expenseSupport: !!node.querySelector('.panel-heading .fa-plane'),
      url: node.querySelector('.btn--green-l').getAttribute('href')
    };
  }

  const urlEl = h4List[0].querySelector('a') || node.querySelector('.event__title a:last-child');
  const startDateString = varEl.querySelector('.atc_date_start').innerHTML;
  if (startDateString === '')
    throw 'Invalid start date';

  const conference: Conference = {
    url: urlEl.getAttribute('href'),
    name: varEl.querySelector('.atc_title').innerHTML,
    endDate: new Date(Date.parse(varEl.querySelector('.atc_date_end').innerHTML)),
    startDate: new Date(Date.parse(startDateString)),
    keywords: Array.prototype.slice.call(h4List[h4List.length - 1].querySelectorAll('a')).map(n => n.innerHTML).join(','),
    location: varEl.querySelector('.atc_location').innerHTML,
    cfp
  };
  return conference;
};

const parseConferences = (html: string): Conference[] => {
  const dom = new JSDOM(html);
  const nodes: NodeListOf<Element> = dom.window.document.querySelectorAll('.event-list-detail');
  const conferences = [];
  for (let i = 0; i < nodes.length; i++) {
    try {
      const conference = parseConference(nodes[i]);
      conferences.push(conference);
    } catch (error) {
      console.error(`Error when parsing conference for node ${i}. ${error}`);
      if (error !== 'No var element found' && error !== 'Invalid start date')
        throw error;
    }
  }
  return conferences;
};

const fetchConferencesByPage = (page: number): Promise<Conference[]> => {
  return new Promise((resolve, reject) => {
    https.get(`https://www.papercall.io/events?page=${page}`, (res) => {
      let html = '';
      res.on('data', (data) => {
        html += data;
      });

      res.on('end', () => {
        resolve(parseConferences(html));
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
};

const fetchConferences = async () => {
  let allConferences = [];
  let page = 1;
  do {
    console.log(`Fetching conferences from page ${page} ...`);
    const conferences = await fetchConferencesByPage(page);
    if (!conferences.length) {
      break;
    }

    allConferences = [...allConferences, ...conferences];
    page++;
  }
  while (true);

  return allConferences;
};

const groupConferencesByYear = (conferences: Conference[]) => {
  const group = {};
  for (let conference of conferences) {
    const year = conference.startDate.getFullYear().toString();
    if (!group[year]) {
      group[year] = [conference];
    } else {
      group[year] = [...group[year], conference];
    }
  }
  return group;
};

const saveConferencesToFile = async (conferences: Conference[]) => {
  const sortedConferences = conferences.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const conferencesByYear = groupConferencesByYear(sortedConferences);
  for (let year in conferencesByYear) {
    const filePath = `${__dirname}\\..\\web\\conf.${year}.json`;
    const contents = JSON.stringify(conferencesByYear[year], null, 2);
    await writeFileAsync(filePath, contents, { encoding: 'utf-8' });
  }
};

const crawlConferences = async () => {
  const allConferences = await fetchConferences();
  saveConferencesToFile(allConferences);
};

crawlConferences();