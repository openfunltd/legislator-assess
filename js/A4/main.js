$(document).ready(main("A4"));


async function main(tableId) {
  const GET_term = document.location.search.match(/term=([0-9]*)/);
  const GET_sessionPeriod = document.location.search.match(/sessionPeriod=([0-9]*)/);
  const pathname_comtCd = document.location.pathname.match(/\/(\d+)\.html$/);
  let term = (GET_term) ? GET_term[1] : 10;
  let sessionPeriod = (GET_sessionPeriod) ? GET_sessionPeriod[1] : 6;
  term = encodeURIComponent(term);
  sessionPeriod = encodeURIComponent(sessionPeriod);
  comtCd = encodeURIComponent(pathname_comtCd[1]);

  $(".term-session").text(`${term}-${sessionPeriod}`);
  $(document).prop('title', $("#title").text());

  let comtLegislators = [];
  let comtIndex = 0;
  const comtName = await getCommitteeName(comtCd);
  const legislators = await getLegislators(term);
  const trBeforeHead0 = $("#before-point");
  const tdHead1 = $("#head-row-1");
  const tdHead2 = $("#head-row-2");

  for (const legislator of legislators) {
    const isComt = legislator.committee.includes(`第${term}屆第${sessionPeriod}會期：${comtName}`);
    if (isComt) {
      comtIndex = comtIndex + 1;
      trBeforeHead0.before($(`<td class="dt-head-center">${comtIndex}</td>`));
      tdHead1.append(`<td class="dt-head-center">${legislator.party}</td>`);
      tdHead2.append(`<td class="dt-head-center nosort">${legislator.name}</td>`);
      comtLegislators.push(legislator.name);
    }
  }

  meetings = await getMeetings(term, sessionPeriod, comtCd);
  rowsData = []
  for(const meeting of meetings) {
    if (meeting.meet_type === "聯席會議" && !meeting.id.startsWith(`${term}-${sessionPeriod}-${comtCd}`, 5)) {
      continue;
    }
    if (meeting.公報發言紀錄 === undefined) { continue; }
    let rowData = [];
    const dates = formatDates(meeting.議事錄.時間);
    let commentRecords = meeting.公報發言紀錄;
    if (commentRecords.length > dates.length) {
      commentRecords = commentRecords.filter((record) => record.speakers.length > 1)
    }
    for (const [i, date] of dates.entries()) {
      const commentRecord = commentRecords[i];
      if (commentRecord === undefined) { continue };
      const meetingContent = commentRecord.content;
      if (!meetingContent.includes("審查")) { continue; }
      let title = commentRecord.meet_name;
      if (dates.length > 1) { title = `${meeting.title}-${i+1}` };
      const deliberation = commentRecord.speakers;
      rowData = [comtName, date, title, meetingContent];
      rowData.push(deliberation.join("、"));
      for (const name of comtLegislators) {
        const hasDeliberate = (deliberation.includes(name)) ? 1 : 0;
        rowData.push(hasDeliberate);
      }
      rowData.push(1);
      rowsData.push(rowData);
    }
  }

  const table = $(`#${tableId}`).DataTable({
    keys: true,
    scrollX: true,
    fixedColumns: {left: 2},
    columnDefs: [
        { orderable: false, targets: 'nosort' }
    ],
    fixedHeader: true,
    dom: '<<"row"<"col"B><"col filter_adjust"f>>>rtip',
    buttons: [
        'pageLength', 'copy', 'excel'
    ],
    order: [1, 'asc'],
  });

  table.rows.add(rowsData).draw(false);
}

function getMeetings(term, sessionPeriod, comtCd) {
  return new Promise((resolve, reject) => {
    const url = "https://ly.govapi.tw/v1/meet/" +
        "?term=" + term +
        "&sessionPeriod=" + sessionPeriod +
        "&committee_id=" + comtCd;
    $.getJSON(url, function(data) {
      resolve(data.meets);
    });
  });
}

function formatDates(dates) {
  dates = dates.replace("曰", "日");
  const yearPattern = /(\d+年)/g;
  const datePattern = /(\d+月\d+日)/g;
  const year = parseInt(dates.match(yearPattern)[0].slice(0, -1))  + 1911;
  const dateMatches = dates.match(datePattern);
  dates = dateMatches.map((match) => {
    const [month, day] = match.match(/(\d+)/g);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });
  return dates;
}

function getLegislators(term) {
  return new Promise((resolve, reject) => {
    const url = `https://ly.govapi.tw/v1/legislator/${term}?limit=300`;
    $.getJSON(url, function(data) {
      resolve(data.legislators);
    });
  });
}

function getCommitteeName(comtCd) {
  return new Promise((resolve, reject) => {
    const url = `https://ly.govapi.tw/v1/committee/${comtCd}`;
    $.getJSON(url, function(data) {
      resolve(data.comtName);
    });
  });
}
