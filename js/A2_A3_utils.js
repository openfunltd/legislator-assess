function getTerm() {
  const GET_term = document.location.search.match(/term=([0-9]*)/);
  const term = (GET_term) ? GET_term[1] : 10;
  return term;
}

function getSessionPeriod() {
  const GET_sessionPeriod = document.location.search.match(/sessionPeriod=([0-9]*)/);
  const sessionPeriod = (GET_sessionPeriod) ? GET_sessionPeriod[1] : 6;
  return sessionPeriod;
}

function getComtCode() {
  const pathname_comtCd = document.location.pathname.match(/\/(\d+)\.html$/);
  return pathname_comtCd[1];
}

function renderTitle(term, sessionPeriod) {
  $(".term-session").text(`${term}-${sessionPeriod}`);
  $(document).prop('title', $("#title").text());
}

function getCommitteeName(comtCd) {
  return new Promise((resolve, reject) => {
    const url = `https://v1.ly.govapi.tw/committee/${comtCd}`;
    $.getJSON(url, function(data) {
      resolve(data.comtName);
    });
  });
}

function getLegislators(term) {
  return new Promise((resolve, reject) => {
    const url = `https://v1.ly.govapi.tw/legislator/${term}?limit=300`;
    $.getJSON(url, function(data) {
      resolve(data.legislators);
    });
  });
}

function getComtLegislators(legislators, term, sessionPeriod, comtName) {
  comtLegislators = legislators.filter((legislator) => {
    return legislator.committee.includes(`第${term}屆第${sessionPeriod}會期：${comtName}`);
  });
  return comtLegislators;
}

function renderTableHeaders(comtLegislators) {
  const trBeforeHead0 = $("#before-point");
  const tdHead1 = $("#head-row-1");
  const tdHead2 = $("#head-row-2");
  const tdHead3 = $("#head-row-3");
  let comtIndex = 0;
  for (const legislator of comtLegislators) {
    comtIndex = comtIndex + 1;
    trBeforeHead0.before($(`<td class="dt-head-center" colspan="6">${comtIndex}</td>`));
    tdHead1.append(`<td class="dt-head-center" colspan="6">${legislator.party}</td>`);
    tdHead2.append(`<td class="dt-head-center" colspan="6">${legislator.name}</td>`);
    tdHead3.append(`<td class="nosort">出席</td>`);
    tdHead3.append(`<td class="nosort">請假</td>`);
    tdHead3.append(`<td class="nosort">缺席</td>`);
    tdHead3.append(`<td class="nosort">口頭質詢</td>`);
    tdHead3.append(`<td class="nosort">書面質詢</td>`);
    tdHead3.append(`<td class="nosort">書面採計</td>`);
  }
}

function getMeetings(term, sessionPeriod, comtCd) {
  return new Promise((resolve, reject) => {
    const url = "https://v1.ly.govapi.tw/meet/" +
        "?term=" + term +
        "&sessionPeriod=" + sessionPeriod +
        "&committee_id=" + comtCd;
    $.getJSON(url, function(data) {
      resolve(data.meets);
    });
  });
}

function isTargetMeet(meet, term, sessionPeriod, comtCd) {
  if (meet.meet_type === "聯席會議" && !meet.id.startsWith(`${term}-${sessionPeriod}-${comtCd}`, 5)) {
    return false;
  }
  if (meet.meet_id.includes("臨時會委員會")) {
    return false;
  };
  return true;
}

function getBlankRow(meet, comtLegislators) {
  let row = [];
  row.push(meet.id, meet.title ?? meet.name);
  row.push(...Array(6 + comtLegislators.length * 6).fill(""));
  return row;
}

function formatDates(dates) {
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

function getMeetTitle(meet, dates) {
  let title = meet.title ?? meet.name;
  if (dates.length > 1) { title = `${title}-${i+1}` };
  return title;
}

function extractInterpellationData(interpellations, date) {
  let [oral, written] = [[], []];
  if (interpellations != undefined) {
    oral = interpellations.filter(item => item.日期 === date && item.種類 === "口頭質詢");
    if (oral.length > 0) { oral = oral[0].委員.join(" "); }
    written = interpellations.filter(item => item.日期 === date && item.種類 === "書面質詢");
    if (written.length > 0) { written = written[0].委員.join(" "); }
  }
  return [oral, written];
}

function getAssessData(comtLegislators, attendees, leaveList, oral, written, oralMax) {
  let assessData = [];
  attendees = attendees.replace(/\s/g, '');
  leaveList = leaveList.replace(/\s/g, '');
  oral = (oral.length > 0) ? oral.replace(/\s/g, '') : '';
  written = (written.length > 0) ? written.replace(/\s/g, '') : '';
  for (legislator of comtLegislators) {
    const name = legislator.name.replace(/\s/g, '');
    const attended = (attendees.includes(name)) ? 1 : 0;
    const leave = (leaveList.includes(name)) ? 1 : 0;
    const absent = (attended === 0 && leave === 0) ? 1 : 0;
    const hasOral = (oral.includes(name)) ? 1 : 0;
    const hasWritten = (written.includes(name)) ? 1 : 0;
    let writtenCount = 0;
    if (oralMax > hasOral) {
      writtenCount = (hasOral + hasWritten > oralMax) ? oralMax - hasOral : hasWritten;
    }
    assessData.push(attended, leave, absent, hasOral, hasWritten, writtenCount);
  }
  return assessData;
}

function renderDataTable(tableId, rows) {
  const table = $('#' + tableId).DataTable({
    keys: true,
    scrollX: true,
    fixedColumns: {left: 1},
    columnDefs: [
        { orderable: false, targets: 'nosort' }
    ],
    fixedHeader: true,
    dom: '<<"row"<"col"B><"col filter_adjust"f>>>rtip',
    buttons: [
        'pageLength', 'copy', 'excel'
    ],
    order: [0, 'asc'],
  });

  table.rows.add(rows).draw(false);
}
